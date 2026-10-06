import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { signTestToken as jwtSign } from './security-test-helpers';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Repository } from 'typeorm';
import {
  ACTIVE_WALLET_UNIQUE_INDEX,
  Currency,
  Wallet,
} from '../src/wallets/wallet.entity';
import { WalletsService } from '../src/wallets/wallets.service';
import { User } from '../src/users/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

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
    await walletRepository.query('TRUNCATE ledger_entries, ledger_journals');
    await walletRepository.query('DELETE FROM wallets;');
    await userRepository.query('DELETE FROM users;');
    await userRepository.query('TRUNCATE auth_rate_limits');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Wallet Module', () => {
    const id = '4776bd35-44f3-4c82-b7d9-06627db401b3';
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
            expect(data.balance).toEqual('0.00');
          });
      });

      it('defaults to NGN even when the user already has a USD wallet', async () => {
        await walletRepository.save({ user_id: id, currency: Currency.USD });
        const response = await request(app.getHttpServer())
          .post('/wallets')
          .set('Authorization', `Bearer ${user.access_token}`)
          .send({ user_id: id })
          .expect(201);
        expect(response.body.data.currency).toBe('NGN');
        expect(await walletRepository.countBy({ user_id: id })).toBe(2);
      });

      it('returns 409 for duplicate default and explicit NGN requests', async () => {
        await request(app.getHttpServer())
          .post('/wallets')
          .set('Authorization', `Bearer ${user.access_token}`)
          .send({ user_id: id })
          .expect(201);
        const response = await request(app.getHttpServer())
          .post('/wallets')
          .set('Authorization', `Bearer ${user.access_token}`)
          .send({ user_id: id, currency: 'NGN' })
          .expect(409);
        expect(response.body.error.message).toBe(
          'Wallet of the specified currency already exists',
        );
        expect(await walletRepository.countBy({ user_id: id })).toBe(1);
      });

      it('allows separate active wallets for each supported currency', async () => {
        for (const currency of Object.values(Currency)) {
          await request(app.getHttpServer())
            .post('/wallets')
            .set('Authorization', `Bearer ${user.access_token}`)
            .send({ user_id: id, currency })
            .expect(201);
        }
        expect(await walletRepository.countBy({ user_id: id })).toBe(3);
      });

      it('maps a concurrent insert collision to 409 after both requests pass the precheck', async () => {
        const service = app.get(WalletsService);
        const search = service.searchWallet.bind(service);
        let release: () => void;
        const bothChecked = new Promise<void>((resolve) => {
          release = resolve;
        });

        let checks = 0;
        // Force the race: neither request may insert before both see no wallet.
        const precheck = jest
          .spyOn(service, 'searchWallet')
          .mockImplementation(async (params) => {
            const result = await search(params);
            if (++checks === 2) release();
            await bothChecked;
            return result;
          });

        try {
          const responses = await Promise.all([
            request(app.getHttpServer())
              .post('/wallets')
              .set('Authorization', `Bearer ${user.access_token}`)
              .send({ user_id: id }),
            request(app.getHttpServer())
              .post('/wallets')
              .set('Authorization', `Bearer ${user.access_token}`)
              .send({ user_id: id, currency: 'NGN' }),
          ]);
          expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
          expect(
            responses.find((r) => r.status === 409).body.error.message,
          ).toBe('Wallet of the specified currency already exists');
          expect(
            await walletRepository.countBy({
              user_id: id,
              currency: Currency.NGN,
            }),
          ).toBe(1);
        } finally {
          precheck.mockRestore();
        }
      });

      it('enforces uniqueness for inserts that bypass the service', async () => {
        await walletRepository.save({ user_id: id, currency: Currency.NGN });
        await expect(
          walletRepository.save({ user_id: id, currency: Currency.NGN }),
        ).rejects.toMatchObject({
          code: '23505',
          constraint: ACTIVE_WALLET_UNIQUE_INDEX,
        });
        expect(await walletRepository.countBy({ user_id: id })).toBe(1);
      });

      it('allows replacement of an archived wallet without changing its historical balance', async () => {
        const archived = await walletRepository.save({
          user_id: id,
          currency: Currency.NGN,
          kobo_balance: 10000,
          balance: 100,
        });

        await walletRepository.softDelete(archived.id);

        const response = await request(app.getHttpServer())
          .post('/wallets')
          .set('Authorization', `Bearer ${user.access_token}`)
          .send({ user_id: id })
          .expect(201);

        expect(response.body.data.id).not.toBe(archived.id);

        const history = await walletRepository.findOne({
          where: { id: archived.id },
          withDeleted: true,
        });
        expect(Number(history.kobo_balance)).toBe(10000);
        expect(history.deleted_at).toBeInstanceOf(Date);
        expect(await walletRepository.countBy({ user_id: id })).toBe(1);
        // Restoring the old wallet must not bypass the active-wallet invariant.
        await expect(
          walletRepository.restore(archived.id),
        ).rejects.toMatchObject({
          code: '23505',
          constraint: ACTIVE_WALLET_UNIQUE_INDEX,
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

      it('rejects creation of a wallet for another user', async () => {
        const otherUserId = '4776bd35-44f3-4c82-b7d9-06627db401c4';
        return request(app.getHttpServer())
          .post('/wallets')
          .set({ Authorization: `Bearer ${user.access_token}` })
          .send({
            user_id: otherUserId,
            currency: 'NGN',
          })
          .expect(403)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(403);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Forbidden');

            expect(error.message).toEqual(
              'Cannot create a wallet for another user',
            );
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
            expect(data.balance).toEqual('0.00');
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
          kobo_balance: 100000,
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
            expect(data.balance).toEqual('1000.00');
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
