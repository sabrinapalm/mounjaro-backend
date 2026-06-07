import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";
import { dynamoDb } from "../shared/dynamoDb.js";
import { errorResponse, jsonResponse } from "../shared/response.js";
import { sideEffectSchema } from "../shared/schema.js";

dayjs.extend(utc);

const injectionSiteSchema = z.enum([
  "abdomen_left",
  "abdomen_right",
  "left_thigh",
  "right_thigh",
  "left_upper_arm",
  "right_upper_arm",
  "other",
]);

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();

const createShotSchema = z.object({
  id: z.string().min(1).optional(),
  dateTime: z.string().datetime(),
  dosage: z.coerce.number().positive(),
  injectionSite: injectionSiteSchema.optional(),
  notes: optionalTrimmedString(250),
  sideEffects: z.array(sideEffectSchema).max(20).optional(),
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

const parseShotDateTime = (dateTime: string) => {
  const parsedDateTime = dayjs.utc(dateTime);

  if (!parsedDateTime.isValid()) {
    return null;
  }

  return parsedDateTime;
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const parsedBody = parseBody(event.body);
  const validationResult = createShotSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    return errorResponse(400, "Invalid shot data");
  }

  const body = validationResult.data;
  const shotDateTime = parseShotDateTime(body.dateTime);

  if (!shotDateTime) {
    return errorResponse(400, "Invalid shot date time");
  }

  const now = dayjs().toISOString();
  const id = body.id ?? `shot_${crypto.randomUUID()}`;
  const dateTime = shotDateTime.toISOString();

  const shot = {
    userId: event.requestContext.authorizer.jwt.claims.sub,
    recordKey: `shot#${dateTime}#${id}`,
    type: "shot",
    id,
    dateTime,
    dosage: body.dosage,
    ...(body.injectionSite ? { injectionSite: body.injectionSite } : {}),
    ...(body.sideEffects?.length ? { sideEffects: body.sideEffects } : {}),
    ...(body.notes ? { notes: body.notes } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      Item: shot,
      ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(recordKey)",
    }),
  );

  const { userId, recordKey, type, ...frontendShot } = shot;

  return jsonResponse(201, frontendShot);
};
