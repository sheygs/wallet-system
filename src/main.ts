import { NestFactory } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { Logger, INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { appMiddleware } from './app';
import winstonLogger from './utilities/logger';

import { AppModule } from './app.module';

(async () => {
  const app: INestApplication = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      ...winstonLogger,
    }),
  });

  app.useGlobalPipes(
    // remove any additional properites not defined in the DTO
    new ValidationPipe({
      whitelist: true,
    }),
  );

  const PORT = +process.env.PORT || 3000;

  appMiddleware(app);

  await app.listen(PORT, () => {
    Logger.verbose(`${process.env.NODE_ENV}: server listening on port:${PORT}`);
  });
})();
