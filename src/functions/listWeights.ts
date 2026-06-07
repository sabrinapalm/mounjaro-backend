import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { dynamoDb } from "../shared/dynamoDb.js";
import { jsonResponse } from "../shared/response.js";

dayjs.extend(utc);

type WeightRecord = {
  userId: string;
  recordKey: string;
  type: "weight";
  id: string;
  dateTime: string;
  weight: number;
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
        ":recordPrefix": "weight#",
      },
    }),
  );

  const records = (result.Items ?? []) as WeightRecord[];

  const weights = records
    .map(({ userId, recordKey, type, createdAt, updatedAt, ...weight }) => weight)
    .sort(
      (firstWeight, secondWeight) =>
        getDateTimeTimestamp(secondWeight.dateTime) - getDateTimeTimestamp(firstWeight.dateTime),
    );

  return jsonResponse(200, {
    weights,
  });
};
