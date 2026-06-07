import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";

dayjs.extend(utc);

const createWeightSchema = z.object({
  id: z.string().min(1).optional(),
  dateTime: z.string().datetime(),
  weight: z.coerce.number().positive(),
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

const parseWeightDateTime = (dateTime: string) => {
  const parsedDateTime = dayjs.utc(dateTime);

  if (!parsedDateTime.isValid()) {
    return null;
  }

  return parsedDateTime;
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const parsedBody = parseBody(event.body);
  const validationResult = createWeightSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, "Invalid weight data");
  }

  const body = validationResult.data;
  const weightDateTime = parseWeightDateTime(body.dateTime);

  if (!weightDateTime) {
    return errorResponse(400, "Invalid weight date time");
  }

  const now = dayjs().toISOString();
  const id = body.id ?? `weight_${crypto.randomUUID()}`;
  const dateTime = weightDateTime.toISOString();

  const weight = {
    userId: event.requestContext.authorizer.jwt.claims.sub,
    recordKey: `weight#${dateTime}#${id}`,
    type: "weight",
    id,
    dateTime,
    weight: body.weight,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Item: weight,
      ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(recordKey)",
    }),
  );

  const { userId, recordKey, type, ...frontendWeight } = weight;

  return jsonResponse(201, frontendWeight);
};
