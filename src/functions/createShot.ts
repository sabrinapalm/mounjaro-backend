import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

import { dynamoDb } from '../shared/dynamoDb.js';
import { errorResponse, jsonResponse } from '../shared/response.js';

const createShotSchema = z.object({
  id: z.string().min(1).optional(),
  date: z.string().min(1),
  dosage: z.coerce.number().positive(),
  week: z.coerce.number().int().min(1).max(53),
  year: z.coerce.number().int().min(2000),
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

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const parsedBody = parseBody(event.body);
  const validationResult = createShotSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, 'Invalid shot data');
  }

  const body = validationResult.data;
  const now = new Date().toISOString();

  const id = body.id ?? `shot_${Date.now()}`;

  const shot = {
    userId: event.requestContext.authorizer.jwt.claims.sub,
    recordKey: `shot#${body.date}#${id}`,
    type: 'shot',
    id,
    date: body.date,
    dosage: body.dosage,
    week: body.week,
    year: body.year,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Item: shot,
      ConditionExpression:
        'attribute_not_exists(userId) AND attribute_not_exists(recordKey)',
    })
  );

  const { userId, recordKey, type, ...frontendShot } = shot;

  return jsonResponse(201, frontendShot);
};