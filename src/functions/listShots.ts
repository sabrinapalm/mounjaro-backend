import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

import { dynamoDb } from '../shared/dynamoDb.js';
import { jsonResponse } from '../shared/response.js';

type ShotRecord = {
  userId: string;
  recordKey: string;
  type: 'shot';
  id: string;
  date: string;
  dosage: number;
  week: number;
  year: number;
  createdAt: string;
  updatedAt: string;
};

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      KeyConditionExpression:
        'userId = :userId AND begins_with(recordKey, :recordPrefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':recordPrefix': 'shot#',
      },
    })
  );

  const records = (result.Items ?? []) as ShotRecord[];

  const shots = records
    .map(({ userId, recordKey, type, createdAt, updatedAt, ...shot }) => shot)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return jsonResponse(200, {
    shots,
  });
};