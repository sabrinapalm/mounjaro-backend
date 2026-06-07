/// <reference path="./.sst/platform/config.d.ts" />

const REGION = "eu-north-1";
const LAMBDA_RUNTIME = "nodejs22.x" as const;

export default $config({
  app(input) {
    return {
      name: "mounjaro-api",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      region: REGION,
    };
  },

  async run() {
    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
    });

    const userPoolClient = userPool.addClient("UserPoolClient");

    const healthTable = new sst.aws.Dynamo("HealthTable", {
      fields: {
        userId: "string",
        recordKey: "string",
      },
      primaryIndex: {
        hashKey: "userId",
        rangeKey: "recordKey",
      },
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: ["http://localhost:5173", "https://mounjaro-tracksy.vercel.app"],
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS", "PUT", "PATCH"],
        allowHeaders: ["content-type", "authorization"],
      },
    });

    const authorizer = api.addAuthorizer({
      name: "CognitoAuthorizer",
      jwt: {
        issuer: $interpolate`https://cognito-idp.${REGION}.amazonaws.com/${userPool.id}`,
        audiences: [userPoolClient.id],
      },
    });

    const functionDefaults = {
      runtime: LAMBDA_RUNTIME,
      link: [healthTable],
      environment: {
        HEALTH_TABLE_NAME: healthTable.name,
      },
    };

    const authOptions = {
      auth: {
        jwt: {
          authorizer: authorizer.id,
        },
      },
    };

    api.route(
      "POST /shots",
      {
        ...functionDefaults,
        handler: "src/functions/createShot.handler",
      },
      authOptions,
    );

    api.route(
      "GET /shots",
      {
        ...functionDefaults,
        handler: "src/functions/listShots.handler",
      },
      authOptions,
    );

    api.route(
      "POST /weights",
      {
        ...functionDefaults,
        handler: "src/functions/createWeight.handler",
      },
      authOptions,
    );

    api.route(
      "GET /weights",
      {
        ...functionDefaults,
        handler: "src/functions/listWeights.handler",
      },
      authOptions,
    );

    api.route(
      "DELETE /shots/{id}",
      {
        ...functionDefaults,
        handler: "src/functions/deleteShot.handler",
      },
      authOptions,
    );

    api.route(
      "DELETE /weights/{id}",
      {
        ...functionDefaults,
        handler: "src/functions/deleteWeight.handler",
      },
      authOptions,
    );

    api.route(
      "GET /profile",
      {
        ...functionDefaults,
        handler: "src/functions/getProfile.handler",
      },
      authOptions,
    );

    api.route(
      "PUT /profile",
      {
        ...functionDefaults,
        handler: "src/functions/updateProfile.handler",
      },
      authOptions,
    );

    api.route(
      "PATCH /profile/goal-weight",
      {
        ...functionDefaults,
        handler: "src/functions/updateGoalWeight.handler",
      },
      authOptions,
    );

    api.route(
      "POST /check-ins",
      {
        ...functionDefaults,
        handler: "src/functions/createCheckIn.handler",
      },
      authOptions,
    );

    api.route(
      "GET /check-ins",
      {
        ...functionDefaults,
        handler: "src/functions/listCheckIns.handler",
      },
      authOptions,
    );

    api.route(
      "DELETE /check-ins/{id}",
      {
        ...functionDefaults,
        handler: "src/functions/deleteCheckIn.handler",
      },
      authOptions,
    );

    return {
      apiUrl: api.url,
      userPoolId: userPool.id,
      userPoolClientId: userPoolClient.id,
      lambdaRuntime: LAMBDA_RUNTIME,
    };
  },
});
