import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";

import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";

const createWeightSchema = z.object({
  id: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTime: z.string().datetime().optional(),
  weight: z.coerce.number().positive(),
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

const createDateTimeFromDate = (date: string) => {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString();
  }

  return parsedDate.toISOString();
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const parsedBody = parseBody(event.body);
  const validationResult = createWeightSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, "Invalid weight data");
  }

  const body = validationResult.data;
  const now = new Date().toISOString();

  const id = body.id ?? `weight_${Date.now()}`;
  const dateTime = body.dateTime ?? createDateTimeFromDate(body.date);

  const weight = {
    userId: event.requestContext.authorizer.jwt.claims.sub,
    recordKey: `weight#${body.date}#${id}`,
    type: "weight",
    id,
    date: body.date,
    dateTime,
    weight: body.weight,
    week: body.week,
    year: body.year,
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
