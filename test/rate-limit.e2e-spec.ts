import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { Helpers } from '../src/utilities/helpers';

describe('Login rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
      controllers: [AuthController],
      providers: [
        Helpers,
        {
          provide: AuthService,
          useValue: {
            login: jest
              .fn()
              .mockRejectedValue(
                new BadRequestException('Invalid credentials'),
              ),
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });
  it('limits failed login attempts to five per minute per IP', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(429);
  });
});
