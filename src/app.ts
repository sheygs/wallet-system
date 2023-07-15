import { INestApplication, RequestMethod } from '@nestjs/common';

import helmet from 'helmet';
import * as compression from 'compression';

export const appMiddleware = (app: INestApplication) => {
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.enableCors();
  app.use(helmet());
  app.use(compression());
};
