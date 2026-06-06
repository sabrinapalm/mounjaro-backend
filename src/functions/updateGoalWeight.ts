import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";

import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";

const updateGoalWeightSchema = z.object({
  goalWeight: z.coerce.number().positive(),
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
  recordKey: "profile";
  type: "profile";
  displayName?: string;
  goalWeight: number | null;
  startWeight?: number | null;
  height?: number | null;
  createdAt?: string;
  updatedAt: string;
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  const parsedBody = parseBody(event.body);
  const validationResult = updateGoalWeightSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, "Invalid goal weight");
  }

  const { goalWeight } = validationResult.data;
  const now = new Date().toISOString();

  try {
    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: process.env.HEALTH_TABLE_NAME,
        Key: {
          userId,
          recordKey: "profile",
        },
        UpdateExpression: `
          SET
            goalWeight = :goalWeight,
            updatedAt = :updatedAt
        `,
        ExpressionAttributeValues: {
          ":goalWeight": goalWeight,
          ":updatedAt": now,
        },
        ConditionExpression: "attribute_exists(userId) AND attribute_exists(recordKey)",
        ReturnValues: "ALL_NEW",
      }),
    );

    const {
      userId: _userId,
      recordKey: _recordKey,
      type: _type,
      ...profile
    } = result.Attributes as ProfileRecord;

    return jsonResponse(200, {
      profile,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return errorResponse(404, "Profile not found");
    }

    return errorResponse(500, "Unable to update goal weight");
  }
};
