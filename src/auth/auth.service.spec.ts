import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { HashService } from '../hash/hash.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let fakeUserService: Partial<UsersService>;
  let fakeJwtService: Partial<JwtService>;
  beforeEach(async () => {
    fakeUserService = {
      findUser: () => Promise.resolve([]),
      createUser: (body: User) => {
        return Promise.resolve({
          id: 1,
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          password: body.password,
          phone_number: body.phone_number,

          deleted_at: body.deleted_at,
          is_admin: body.is_admin,
          created_at: body.created_at,
          updated_at: body.updated_at,
        } as unknown as User);
      },
    };
    const fakeHashService = {
      hashPassword: (password: string) => Promise.resolve(password),
    };

    fakeJwtService = {
      sign: jest.fn().mockReturnValue('fake-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: fakeUserService,
        },
        {
          provide: HashService,
          useValue: fakeHashService,
        },
        {
          provide: JwtService,
          useValue: fakeJwtService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('can create an instance of the auth service', async () => {
    expect(service).toBeDefined();
  });

  it('it should create a user with a hashed password', async () => {
    const user = await service.signup({
      email: 'olueko34@gmail.com',
      password: 'mayor',
    } as unknown as User);

    user.password = 'xxxxx';

    expect(user.password).not.toEqual('mayor');
    expect(user.password).toEqual('xxxxx');
    expect(user.password).toBeDefined();
    expect(user.password).not.toEqual('');
  });

  it('it throws an error if user signs up with an email in use', async () => {
    fakeUserService.findUser = () =>
      Promise.resolve({ email: 'olueko34@gmail.com' } as unknown as User);
    await expect(
      service.signup({
        email: 'olueko34@gmail.com',
        password: 'mayor',
      } as unknown as User),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws if signin is called with an unused email', async () => {
    await expect(
      service.login({
        id: '1',
        email: 'asdflkj@asdlfkj.com',
        is_admin: true,
        access_token: fakeJwtService.sign('xys'),
      } as unknown as User),
    ).rejects.toThrow(UnauthorizedException);
  });
});
