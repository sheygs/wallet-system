import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { sign as jwtSign } from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { Repository } from 'typeorm';
import { Wallet } from '../src/wallets/wallet.entity';
import { User } from '../src/users/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

import { config } from 'dotenv';

config({ path: '../.env.sample' });

describe('Wallet', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let walletRepository: Repository<Wallet>;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // hack
    app.useGlobalPipes(
      // remove any additional properites not defined in the DTO
      new ValidationPipe({
        whitelist: true,
      }),
    );

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );

    walletRepository = moduleFixture.get<Repository<Wallet>>(
      getRepositoryToken(Wallet),
    );

    await app.init();
  });

  afterEach(async () => {
    await Promise.all([
      walletRepository?.query('DELETE FROM wallets;'),
      userRepository?.query('DELETE FROM users;'),
    ]);
  });

  afterAll(async () => {
    await moduleFixture.close();
    await app.close();
  });

  describe('Wallet Module', () => {
    let id = '4776bd35-44f3-4c82-b7d9-06627db401b3';
    const email = 'mark.john@gmail.com';
    const phone_number = '+2348032345346';
    const is_admin = false;
    let user: Record<string, any> = {};
    beforeEach(async () => {
      user = {
        id,
        first_name: 'mark',
        last_name: 'john',
        email,
        password: await bcrypt.hash('mark.john', 10),
        phone_number,
        is_admin,
      };

      await userRepository.save(user);

      user = {
        ...user,
        access_token: jwtSign(
          { userId: id, email, phoneNumber: phone_number, isAdmin: is_admin },
          process.env.JWT_SECRET,
        ),
      };
    });
    describe('POST /wallets', () => {
      it('Should create a wallet successfully', async () => {
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${user.access_token}` })
          .send({
            user_id: id,
            currency: 'NGN',
          })
          .expect(201)
          .then((response) => {
            const { data, status } = response.body;
            expect(status).toEqual('success');
            expect(data.user_id).toEqual(id);
            expect(data.currency).toEqual('NGN');
            expect(data.balance).toEqual('0');
          });
      });

      it('Should throw an error when user_id is not provided', async () => {
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${user.access_token}` })
          .send({
            currency: 'NGN',
          })
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');

            expect(error.message).toEqual(
              expect.arrayContaining([
                'user_id should not be empty',
                'user_id must be a UUID',
              ]),
            );
          });
      });

      it('Should throw a 404 error when an invalid user_id is provided', async () => {
        id = '4776bd35-44f3-4c82-b7d9-06627db401c4';
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${user.access_token}` })
          .send({
            user_id: id,
            currency: 'NGN',
          })
          .expect(404)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(404);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Not Found');

            expect(error.message).toEqual('No account exists for this user');
          });
      });

      it('Should throw an error when no token is provided', async () => {
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${''}` })
          .send({
            user_id: '565a34cc-6aa5-4eaa-92f4-1b8da8fb0e5d',
            currency: 'NGN',
          })
          .expect(401)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(401);
            expect(status).toEqual('failure');

            expect(error.message).toEqual('Unauthorized');
          });
      });

      it('Should throw an error when no payload is provided', async () => {
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${user.access_token}` })
          .send({})
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');
            expect(error.message).toEqual(
              expect.arrayContaining([
                'user_id should not be empty',
                'user_id must be a UUID',
              ]),
            );
          });
      });

      it('Should throw an error when no secret key is provided', async () => {
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${user.access_token}` })
          .send({
            user_id: id,
            currency: 'NGN',
          })
          .expect(201)
          .then((response) => {
            const { data, status } = response.body;
            expect(status).toEqual('success');
            expect(data.user_id).toEqual(id);
            expect(data.currency).toEqual('NGN');
            expect(data.balance).toEqual('0');
          });
      });
    });

    describe('GET /wallets/:wallet_id/balance', () => {
      const id = 'ec455a9f-7496-4529-9cb4-d235c859acd9';
      const balance = '1000';
      const currency = 'NGN';
      let wallet;
      it('Should retrieve the balance of a wallet', async () => {
        wallet = await walletRepository.save({
          id,
          user_id: user.id,
          balance,
          currency,
        } as unknown as Wallet);
        return request(app.getHttpServer())
          .get(`/wallets/${wallet.id}/balance`)
          .set({ Authorization: `Bearer ${user.access_token}` })
          .expect(200)
          .then((response) => {
            const { data, status } = response.body;
            expect(status).toEqual('success');
            expect(data.currency).toEqual('NGN');
            expect(data.balance).toEqual('1000');
          });
      });
      it('Should throw an error when no wallet_id is provided', async () => {
        return request(app.getHttpServer())
          .get(`/wallets/''/balance`)
          .set({ Authorization: `Bearer ${user.access_token}` })
          .expect(400)
          .then((response) => {
            const { status, error } = response.body;
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');

            expect(error.message).toEqual(
              expect.arrayContaining(['wallet_id must be a UUID']),
            );
          });
      });
      it('Should throw an error when an invalid wallet_id is provided', async () => {
        const wallet_id = 'ec455a9f-7496-4529-9cb4-d235c859acc7';
        return request(app.getHttpServer())
          .get(`/wallets/${wallet_id}/balance`)
          .set({ Authorization: `Bearer ${user.access_token}` })
          .expect(404)
          .then((response) => {
            const { status, error } = response.body;
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Not Found');
            expect(error.message).toEqual('Wallet account not found');
          });
      });
      it('Should throw an error when no token is provided', async () => {
        return request(app.getHttpServer())
          .get(`/wallets/${wallet.id}/balance`)
          .set({ Authorization: 'Bearer ' + '' })
          .expect(401)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(401);
            expect(status).toEqual('failure');
            expect(error.message).toEqual('Unauthorized');
          });
      });
    });
  });
});
