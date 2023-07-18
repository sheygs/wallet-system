import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Authentication System', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
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

    await app.init();
  });

  afterEach(async () => {
    await userRepository.query(`DELETE FROM users;`);
  });

  afterAll(async () => {
    await moduleFixture.close();
    await app.close();
  });

  describe('Auth Module', () => {
    describe('POST /auth/signup', () => {
      it('Should handle a sign up request', async () => {
        const email = 'john.doe@gmail.com';
        const lastName = 'Doe';
        return request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            first_name: 'John',
            last_name: lastName,
            email,
            password: 'john.doe',
            phone_number: '+2348045637284',
          })
          .expect(201)
          .then((response) => {
            const { status, code, message, data } = response.body;
            expect(code).toEqual(201);
            expect(status).toEqual('success');
            expect(message).toEqual('User created');
            expect(email).toEqual(data.email);
            expect(lastName).toEqual(data.last_name);
          });
      });

      it('Should throw an error when email is not passed not passed', async () => {
        const lastName = 'Doe';
        return request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            first_name: 'John',
            last_name: lastName,
            password: 'john.doe',
            phone_number: '+2348045637284',
          })
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');

            expect(error.message).toEqual(
              expect.arrayContaining([
                'email should not be empty',
                'email must be an email',
              ]),
            );
          });
      });

      it('Should throw an error when password is not passed not passed', async () => {
        return request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@gmail.com',
            phone_number: '+2348045637284',
          })
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');

            expect(error.message).toEqual(
              expect.arrayContaining([
                'password must be longer than or equal to 3 characters',
                'password should not be empty',
                'password must be a string',
              ]),
            );
          });
      });
    });

    describe('POST /auth/login', () => {
      it('Should login successful  with an email', async () => {
        await userRepository.save({
          id: '4776bd35-44f3-4c82-b7d9-06627db401b3',
          first_name: 'mark',
          last_name: 'john',
          email: 'mark.john@gmail.com',
          password: await bcrypt.hash('mark.john', 10),
          phone_number: '+2348032345346',
          is_admin: false,
        });

        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'mark.john@gmail.com',
            password: 'mark.john',
          })
          .expect(200)
          .then((response) => {
            const { data } = response.body;
            expect(data.id).toEqual('4776bd35-44f3-4c82-b7d9-06627db401b3');
            expect(data.email).toEqual('mark.john@gmail.com');
            expect(data.is_admin).toEqual(false);
            expect(data.access_token).toBeDefined();
          });
      });

      it('Should login successful with a phone number', async () => {
        await userRepository.save({
          id: '4776bd35-44f3-4c82-b7d9-06627db401b3',
          first_name: 'mark',
          last_name: 'john',
          email: 'mark.john@gmail.com',
          password: await bcrypt.hash('mark.john', 10),
          phone_number: '+2348032345346',
          is_admin: false,
        });

        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            phone_number: '+2348032345346',
            password: 'mark.john',
          })
          .expect(200)
          .then((response) => {
            const { data } = response.body;
            expect(data.id).toEqual('4776bd35-44f3-4c82-b7d9-06627db401b3');
            expect(data.email).toEqual('mark.john@gmail.com');
            expect(data.is_admin).toEqual(false);
            expect(data.access_token).toBeDefined();
          });
      });
      it('Should throw an error when a wrong phone number is passed', async () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            phone_number: '+2348032345347',
            password: 'mark.john',
          })
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');

            expect(error.message).toEqual('Invalid email/phone number');
          });
      });

      it('Should throw an error when a wrong password is passed', async () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            phone_number: '+2348032345346',
            password: 'mark.j',
          })
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');
            expect(error.message).toEqual('Invalid email/phone number');
          });
      });

      it('Should throw an error when a wrong email is passed', async () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'mark.jonna@gmail.com',
            password: 'mark.john',
          })
          .expect(400)
          .then((response) => {
            const { status, code, error } = response.body;
            expect(code).toEqual(400);
            expect(status).toEqual('failure');
            expect(error.name).toEqual('Bad Request');
            expect(error.message).toEqual('Invalid email/phone number');
          });
      });
    });
  });
});
