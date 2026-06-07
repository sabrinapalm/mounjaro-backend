import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { dynamoDb } from "../shared/dynamoDb.js";
import { jsonResponse } from "../shared/response.js";

dayjs.extend(utc);

type CheckInLevel = 1 | 2 | 3 | 4 | 5;

type SideEffect =
  | "nausea"
  | "fatigue"
  | "headache"
  | "constipation"
  | "diarrhea"
  | "stomach_pain"
  | "injection_site_reaction"
  | "reduced_appetite"
  | "heartburn"
  | "other";

type CheckInRecord = {
  userId: string;
  recordKey: string;
  type: "checkin";
  id: string;
  dateTime: string;
  appetiteLevel?: CheckInLevel;
  hungerLevel?: CheckInLevel;
  energyLevel?: CheckInLevel;
  nauseaLevel?: CheckInLevel;
  moodLevel?: CheckInLevel;
  sideEffects?: SideEffect[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const getDateTimeTimestamp = (dateTime: string) => {
  const parsedDateTime = dayjs.utc(dateTime);

  if (!parsedDateTime.isValid()) {
    return 0;
  }

  return parsedDateTime.valueOf();
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: process.env.HEALTH_TABLE_NAME,
      KeyConditionExpression: "userId = :userId AND begins_with(recordKey, :recordPrefix)",
      ExpressionAttributeValues: {
        ":userId": userId,
        ":recordPrefix": "checkin#",
      },
    }),
  );

  const records = (result.Items ?? []) as CheckInRecord[];

  const checkIns = records
    .map(({ userId, recordKey, type, createdAt, updatedAt, ...checkIn }) => checkIn)
    .sort(
      (firstCheckIn, secondCheckIn) =>
        getDateTimeTimestamp(secondCheckIn.dateTime) - getDateTimeTimestamp(firstCheckIn.dateTime),
    );

  return jsonResponse(200, {
    checkIns,
  });
};
