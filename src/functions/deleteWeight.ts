import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;
  const id = event.pathParameters?.id;
  const dateTime = event.queryStringParameters?.dateTime;

  if (!id) {
    return errorResponse(400, "Weight id is required");
  }

  if (!dateTime) {
    return errorResponse(400, "Weight date time is required");
  }

  await dynamoDb.send(
    new DeleteCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Key: {
        userId,
        recordKey: `weight#${dateTime}#${id}`,
      },
      ConditionExpression: "attribute_exists(userId) AND attribute_exists(recordKey)",
    }),
  );

  return jsonResponse(200, {
    id,
    deleted: true,
  });
};
