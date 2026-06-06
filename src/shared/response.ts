import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const defaultHeaders = {
  "content-type": "application/json",
};

export const jsonResponse = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: defaultHeaders,
  body: JSON.stringify(body),
});

export const errorResponse = (
  statusCode: number,
  message: string,
): APIGatewayProxyStructuredResultV2 =>
  jsonResponse(statusCode, {
    message,
  });
