import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { dynamoDb } from "../shared/dynamoDb.js";
import { jsonResponse } from "../shared/response.js";

type ProfileRecord = {
  userId: string;
  recordKey: "profile";
  type: "profile";
  displayName: string;
  goalWeight: number | null;
  startWeight: number | null;
  createdAt: string;
  updatedAt: string;
  height: number | null;
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  const result = await dynamoDb.send(
    new GetCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Key: {
        userId,
        recordKey: "profile",
      },
    }),
  );

  if (!result.Item) {
    return jsonResponse(200, {
      profile: null,
    });
  }

  const { userId: _userId, recordKey, type, ...profile } = result.Item as ProfileRecord;

  return jsonResponse(200, {
    profile,
  });
};
