import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';

import { dynamoDb } from '../shared/dynamoDb.js';
import { errorResponse, jsonResponse } from '../shared/response.js';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;
  const id = event.pathParameters?.id;
  const date = event.queryStringParameters?.date;

  if (!id) {
    return errorResponse(400, 'Shot id is required');
  }

  if (!date) {
    return errorResponse(400, 'Shot date is required');
  }

  await dynamoDb.send(
    new DeleteCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Key: {
        userId,
        recordKey: `shot#${date}#${id}`,
      },
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(recordKey)',
    })
  );

  return jsonResponse(200, {
    id,
    deleted: true,
  });
};