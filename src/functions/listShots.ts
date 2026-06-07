import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { dynamoDb } from "../shared/dynamoDb.js";
import { jsonResponse } from "../shared/response.js";

dayjs.extend(utc);

type InjectionSite =
  | "abdomen_left"
  | "abdomen_right"
  | "left_thigh"
  | "right_thigh"
  | "left_upper_arm"
  | "right_upper_arm"
  | "other";

type ShotSideEffect =
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

type ShotRecord = {
  userId: string;
  recordKey: string;
  type: "shot";
  id: string;
  dateTime: string;
  dosage: number;
  injectionSite?: InjectionSite;
  sideEffects?: ShotSideEffect[];
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
        ":recordPrefix": "shot#",
      },
    }),
  );

  const records = (result.Items ?? []) as ShotRecord[];

  const shots = records
    .map(({ userId, recordKey, type, createdAt, updatedAt, ...shot }) => shot)
    .sort(
      (firstShot, secondShot) =>
        getDateTimeTimestamp(secondShot.dateTime) - getDateTimeTimestamp(firstShot.dateTime),
    );

  return jsonResponse(200, {
    shots,
  });
};
