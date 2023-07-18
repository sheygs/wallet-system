import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { sign as jwtSign } from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/user.entity';
import { Currency, Wallet } from '../src/wallets/wallet.entity';
import {
  TransactionStatus,
  TransactionType,
  WalletTransaction,
} from '../src/wallet-transactions/wallet-transaction.entity';

describe('Transfer', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let userRepository: Repository<User>;
  let walletRepository: Repository<Wallet>;
  let walletTransactionRepo: Repository<WalletTransaction>;

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

    walletTransactionRepo = moduleFixture.get<Repository<WalletTransaction>>(
      getRepositoryToken(WalletTransaction),
    );

    await app.init();
  });

  afterEach(async () => {
    await Promise.all([
      walletTransactionRepo.query('DELETE FROM wallet_transactions;'),
      walletRepository.query('DELETE FROM wallets;'),
      userRepository.query('DELETE FROM users;'),
    ]);
  });

  afterAll(async () => {
    await moduleFixture.close();
    await app.close();
  });

  describe('Transfer Module', () => {
    const user_id = '4776bd35-44f3-4c82-b7d9-06627db401b3';
    const email = 'mark.john@gmail.com';
    const phone_number = '+2348032345346';
    const is_admin = true;
    let walletTransactions: Partial<WalletTransaction>[];
    let wallet: Partial<Wallet>;
    let user: Record<string, any> = {};
    beforeEach(async () => {
      user = {
        id: user_id,
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
          {
            userId: user_id,
            email,
            phoneNumber: phone_number,
            isAdmin: is_admin,
          },
          process.env.JWT_SECRET,
        ),
      };

      wallet = {
        user_id,
        currency: Currency.GHS,
      };

      await walletRepository.save(wallet);

      walletTransactions = [
        {
          id: uuidv4(),
          user_id,
          source_wallet_id: wallet.id,
          amount: 10000,
          transaction_type: TransactionType.DEPOSIT,
          transaction_status: TransactionStatus.SUCCESSFUL,
        },
        {
          id: uuidv4(),
          user_id,
          source_wallet_id: wallet.id,
          amount: 50000,
          transaction_type: TransactionType.TRANSFER,
          transaction_status: TransactionStatus.PENDING,
        },
      ];

      await walletTransactionRepo.save(walletTransactions);
    });
    describe('GET /wallet-transactions/history', () => {
      const from_date = '2023-07-18';
      const to_date = '2023-07-19';
      it('Should fetch wallet transactions summary between date ranges', async () => {
        return request(app.getHttpServer())
          .get('/wallet-transactions/history')
          .query({
            from_date,
            to_date,
          })
          .set({ Authorization: `Bearer ${user.access_token}` })
          .expect(200)
          .then((response) => {
            const { data, status, code } = response.body;
            expect(code).toEqual(200);
            expect(status).toEqual('success');
            expect(data).toHaveLength(2);
            for (let i = 0; i < data.length; i++) {
              expect(data[i].id).toBeDefined();
              expect(data[i].user_id).toBeDefined();
              expect(data[i].created_at).toBeDefined();
              expect(data[i].id).toStrictEqual(walletTransactions[i].id);
              expect(data[i].user_id).toStrictEqual(
                walletTransactions[i].user_id,
              );
              expect(data[i].source_wallet_id).toStrictEqual(
                walletTransactions[i].source_wallet_id,
              );
            }
          });
      });

      it('Should throw an Unauthorized Error when token is not provided', async () => {
        const from_date = '2023-07-18';
        const to_date = '2023-07-19';
        return request(app.getHttpServer())
          .get('/wallet-transactions/history')
          .query({
            from_date,
            to_date,
          })
          .set({ Authorization: 'Bearer ' })
          .expect(401)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(401);
            expect(status).toEqual('failure');
            expect(error.message).toEqual('Unauthorized');
          });
      });

      it('Should throw a Forbidden Error for a non-Admin user', async () => {
        user = {
          ...user,
          is_admin: false,
        };

        await userRepository.save(user);

        user = {
          ...user,
          access_token: jwtSign(
            {
              userId: user_id,
              email,
              phoneNumber: phone_number,
              isAdmin: user.is_admin,
            },
            process.env.JWT_SECRET,
          ),
        };
        const from_date = '2023-07-18';
        const to_date = '2023-07-19';
        return request(app.getHttpServer())
          .get('/wallet-transactions/history')
          .query({
            from_date,
            to_date,
          })
          .set({ Authorization: `Bearer ${user.access_token}` })
          .expect(403)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(403);
            expect(status).toEqual('failure');
            expect(error.message).toEqual('Forbidden resource');
          });
      });
    });
  });
});
