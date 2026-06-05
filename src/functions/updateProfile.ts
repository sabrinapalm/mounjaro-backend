import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

import { dynamoDb } from '../shared/dynamoDb.js';
import { errorResponse, jsonResponse } from '../shared/response.js';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
  goalWeight: z.coerce.number().positive().nullable().optional(),
  startWeight: z.coerce.number().positive().nullable().optional(),
});

const parseBody = (body: string | undefined) => {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

type ProfileRecord = {
  userId: string;
  recordKey: 'profile';
  type: 'profile';
  displayName: string;
  goalWeight: number | null;
  startWeight: number | null;
  createdAt: string;
  updatedAt: string;
};

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  const parsedBody = parseBody(event.body);
  const validationResult = updateProfileSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, 'Invalid profile data');
  }

  const body = validationResult.data;
  const now = new Date().toISOString();

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Key: {
        userId,
        recordKey: 'profile',
      },
      UpdateExpression: `
        SET
          #type = if_not_exists(#type, :type),
          displayName = :displayName,
          goalWeight = :goalWeight,
          startWeight = :startWeight,
          createdAt = if_not_exists(createdAt, :createdAt),
          updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':type': 'profile',
        ':displayName': body.displayName,
        ':goalWeight': body.goalWeight ?? null,
        ':startWeight': body.startWeight ?? null,
        ':createdAt': now,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  const { userId: _userId, recordKey, type, ...profile } =
    result.Attributes as ProfileRecord;

  return jsonResponse(200, {
    profile,
  });
};