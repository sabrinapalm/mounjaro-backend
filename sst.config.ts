/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'mounjaro-api',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      region: 'eu-north-1',
    };
  },
  async run() {
    const userPool = new sst.aws.CognitoUserPool('UserPool', {
      usernames: ['email'],
    });

    const userPoolClient = userPool.addClient('UserPoolClient');

    const healthTable = new sst.aws.Dynamo('HealthTable', {
      fields: {
        userId: 'string',
        recordKey: 'string',
      },
      primaryIndex: {
        hashKey: 'userId',
        rangeKey: 'recordKey',
      },
    });

    const api = new sst.aws.ApiGatewayV2('Api', {
      cors: {
        allowOrigins: ['http://localhost:5173'],
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['content-type', 'authorization'],
      },
    });

    const authorizer = api.addAuthorizer({
      name: 'CognitoAuthorizer',
      jwt: {
        issuer: $interpolate`https://cognito-idp.eu-north-1.amazonaws.com/${userPool.id}`,
        audiences: [userPoolClient.id],
      },
    });

    api.route(
      'POST /shots',
      {
        handler: 'src/functions/createShot.handler',
        link: [healthTable],
        environment: {
          HEALTH_TABLE_NAME: healthTable.name,
        },
      },
      {
        auth: {
          jwt: {
            authorizer: authorizer.id,
          },
        },
      }
    );

    api.route(
      'GET /shots',
      {
        handler: 'src/functions/listShots.handler',
        link: [healthTable],
        environment: {
          HEALTH_TABLE_NAME: healthTable.name,
        },
      },
      {
        auth: {
          jwt: {
            authorizer: authorizer.id,
          },
        },
      }
    );

    api.route(
      'POST /weights',
      {
        handler: 'src/functions/createWeight.handler',
        link: [healthTable],
        environment: {
          HEALTH_TABLE_NAME: healthTable.name,
        },
      },
      {
        auth: {
          jwt: {
            authorizer: authorizer.id,
          },
        },
      }
    );

    api.route(
      'GET /weights',
      {
        handler: 'src/functions/listWeights.handler',
        link: [healthTable],
        environment: {
          HEALTH_TABLE_NAME: healthTable.name,
        },
      },
      {
        auth: {
          jwt: {
            authorizer: authorizer.id,
          },
        },
      }
    );

    api.route(
      'DELETE /shots/{id}',
    {
      handler: 'src/functions/deleteShot.handler',
      link: [healthTable],
      environment: {
        HEALTH_TABLE_NAME: healthTable.name,
      },
    },
    {
      auth: {
        jwt: {
          authorizer: authorizer.id,
        },
      },
  }
);

    api.route(
      'DELETE /weights/{id}',
      {
        handler: 'src/functions/deleteWeight.handler',
        link: [healthTable],
        environment: {
          HEALTH_TABLE_NAME: healthTable.name,
        },
      },
      {
        auth: {
          jwt: {
            authorizer: authorizer.id,
          },
        },
      }
    );

    return {
      apiUrl: api.url,
      userPoolId: userPool.id,
      userPoolClientId: userPoolClient.id,
    };
  },
});