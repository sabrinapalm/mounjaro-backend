import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;
  const id = event.pathParameters?.id;
  const dateTime = event.queryStringParameters?.dateTime;

  if (!id) {
    return errorResponse(400, "Shot id is required");
  }

  if (!dateTime) {
    return errorResponse(400, "Shot date time is required");
  }

  const recordKey = `shot#${dateTime}#${id}`;

  try {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: process.env.HEALTH_TABLE_NAME,
        Key: {
          userId,
          recordKey,
        },
        ConditionExpression: "attribute_exists(userId) AND attribute_exists(recordKey)",
      }),
    );

    return jsonResponse(200, {
      id,
      deleted: true,
    });
  } catch (err) {
    console.error("Failed to delete shot", {
      id,
      dateTime,
      recordKey,
      error: err,
    });

    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return errorResponse(404, "Shot not found");
    }

    return errorResponse(500, "Unable to delete shot");
  }
};
