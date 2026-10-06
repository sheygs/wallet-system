import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import helmet from 'helmet';
import compression from 'compression';
import { httpPolicy } from './http-policy';

export const appMiddleware = (app: INestApplication) => {
  const policy = httpPolicy();

  app.getHttpAdapter().getInstance().set('trust proxy', policy.proxies);
  app.useGlobalPipes(
    // remove any additional properites not defined in the DTO
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.enableCors({ origin: policy.origins, credentials: false });
  app.use(helmet());
  app.use(compression());

  if (!policy.swagger) return;

  const options = new DocumentBuilder()
    .setTitle('Wallet System')
    .setDescription('API for a minimalistic wallet system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, options);

  SwaggerModule.setup('/docs', app, document);
};
