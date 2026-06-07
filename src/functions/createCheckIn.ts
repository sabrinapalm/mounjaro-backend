import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";
import { sideEffectSchema } from "../shared/schema.js";

dayjs.extend(utc);

const checkInLevelSchema = z.coerce.number().int().min(1).max(5);

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();

const createCheckInSchema = z.object({
  id: z.string().min(1).optional(),
  dateTime: z.string().datetime(),

  appetiteLevel: checkInLevelSchema.optional(),
  hungerLevel: checkInLevelSchema.optional(),
  energyLevel: checkInLevelSchema.optional(),
  nauseaLevel: checkInLevelSchema.optional(),
  moodLevel: checkInLevelSchema.optional(),

  sideEffects: z.array(sideEffectSchema).max(20).optional(),
  notes: optionalTrimmedString(250),
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

const parseCheckInDateTime = (dateTime: string) => {
  const parsedDateTime = dayjs.utc(dateTime);

  if (!parsedDateTime.isValid()) {
    return null;
  }

  return parsedDateTime;
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const parsedBody = parseBody(event.body);
  const validationResult = createCheckInSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, "Invalid check-in data");
  }

  const body = validationResult.data;
  const checkInDateTime = parseCheckInDateTime(body.dateTime);

  if (!checkInDateTime) {
    return errorResponse(400, "Invalid check-in date time");
  }

  const now = dayjs().toISOString();
  const id = body.id ?? `checkin_${crypto.randomUUID()}`;
  const dateTime = checkInDateTime.toISOString();

  const checkIn = {
    userId: event.requestContext.authorizer.jwt.claims.sub,
    recordKey: `checkin#${dateTime}#${id}`,
    type: "checkin",
    id,
    dateTime,
    ...(body.appetiteLevel ? { appetiteLevel: body.appetiteLevel } : {}),
    ...(body.hungerLevel ? { hungerLevel: body.hungerLevel } : {}),
    ...(body.energyLevel ? { energyLevel: body.energyLevel } : {}),
    ...(body.nauseaLevel ? { nauseaLevel: body.nauseaLevel } : {}),
    ...(body.moodLevel ? { moodLevel: body.moodLevel } : {}),
    ...(body.sideEffects?.length ? { sideEffects: body.sideEffects } : {}),
    ...(body.notes ? { notes: body.notes } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Item: checkIn,
      ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(recordKey)",
    }),
  );

  const { userId, recordKey, type, createdAt, updatedAt, ...frontendCheckIn } = checkIn;

  return jsonResponse(201, frontendCheckIn);
};
