import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { HashService } from '../hash/hash.service';

describe('Signup database errors', () => {
  let service: AuthService;
  let createUser: jest.Mock;
  beforeEach(() => {
    createUser = jest.fn();
    service = new AuthService(
      { createUser } as unknown as UsersService,
      {
        hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      } as unknown as HashService,
      {} as JwtService,
    );
  });
  const signup = () => ({
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone_number: '+2348032345346',
    password: 'secure-test-password',
  });
  it('maps a PostgreSQL unique violation to a signup validation error', async () => {
    createUser.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), { code: '23505' }),
      ),
    );
    await expect(service.signup(signup())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('preserves unexpected errors instead of assuming their type', async () => {
    const error = new Error('connection lost');
    createUser.mockRejectedValue(error);
    await expect(service.signup(signup())).rejects.toBe(error);
  });
});
