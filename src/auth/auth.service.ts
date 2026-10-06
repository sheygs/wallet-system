import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SharedRateLimit } from './shared-rate-limit';
import { ThrottlerException } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import { HashService } from '../hash/hash.service';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { User } from '../users/user.entity';
import { LoginUserDTO } from './dtos/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private hashService: HashService,
    private jwtService: JwtService,
    private db: DataSource,
    private limiter: SharedRateLimit,
  ) {}
  async signup(body: CreateUserDTO): Promise<User> {
    try {
      // Hash user password
      const hashPassword = await this.hashService.hashPassword(body?.password);

      body.password = hashPassword;

      const user = await this.usersService.createUser(body);

      return user;
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        typeof error.driverError === 'object' &&
        error.driverError !== null &&
        'code' in error.driverError &&
        error.driverError.code === '23505'
      ) {
        throw new BadRequestException(
          'User with the email/phone number already exists',
        );
      }
      throw error;
    }
  }

  async validateUser(authPayload: LoginUserDTO): Promise<User> {
    const { email, phone_number, password } = authPayload;

    const user = await this.usersService.findUser(email, phone_number);

    const accountKey = user
      ? `account:${user.id}`
      : `account:${email || phone_number || 'missing'}`;

    const rate = await this.limiter.increment(accountKey, 60000, 5, 300000);

    if (rate.isBlocked) throw new ThrottlerException();

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    if (!(await this.hashService.comparePassword(password, user.password))) {
      throw new BadRequestException('Invalid credentials');
    }

    return user;
  }

  async login(authPayload: LoginUserDTO) {
    const user = await this.validateUser(authPayload);

    return this.db.transaction(async (manager) => {
      const current = await manager.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });

      return this.issueTokens(
        manager,
        current,
        randomUUID(),
        new Date(Date.now() + 7 * 86400000),
      );
    });
  }

  private async issueTokens(
    manager: EntityManager,
    user: User,
    family: string,
    expiry: Date,
  ) {
    const refreshToken = randomBytes(32).toString('base64url');

    await manager.query(
      `INSERT INTO refresh_tokens (token_hash, user_id, family_id, auth_version, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [
        this.tokenHash(refreshToken),
        user.id,
        family,
        user.auth_version,
        expiry,
      ],
    );
    return {
      id: user.id,
      ...(user.email && { email: user.email }),
      is_admin: user.is_admin,
      access_token: this.jwtService.sign({
        userId: user.id,
        authVersion: user.auth_version,
      }),
      refresh_token: refreshToken,
      refresh_expires_at: expiry.toISOString(),
    };
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async refresh(token: string) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException();

    const hash = this.tokenHash(token);
    const [candidate] = await this.db.query(
      'SELECT user_id FROM refresh_tokens WHERE token_hash = $1',
      [hash],
    );

    if (!candidate) throw new UnauthorizedException();

    const result = await this.db.transaction(async (manager) => {
      // Lock user first in login, refresh and revocation to avoid lock inversion.
      const user = await manager.findOne(User, {
        where: { id: candidate.user_id },
        lock: { mode: 'pessimistic_write' },
      });

      const [record] = await manager.query(
        'SELECT *, expires_at > clock_timestamp() AS unexpired FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE',
        [hash],
      );

      if (!user || !record) return null;

      if (record.used_at && record.auth_version === user.auth_version) {
        await manager.query(
          'UPDATE users SET auth_version = auth_version + 1 WHERE id = $1',
          [user.id],
        );
        await manager.query(
          'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1',
          [user.id],
        );
        this.logger.warn('security.refresh_token_reuse');
        return null;
      }
      if (
        record.used_at ||
        record.revoked_at ||
        !record.unexpired ||
        record.auth_version !== user.auth_version
      )
        return null;

      await manager.query(
        'UPDATE refresh_tokens SET used_at = now() WHERE token_hash = $1',
        [hash],
      );

      return this.issueTokens(
        manager,
        user,
        record.family_id,
        new Date(record.expires_at),
      );
    });
    // Revocation must commit before the authentication error is thrown.
    if (!result) throw new UnauthorizedException();
    return result;
  }

  async logout(userId: string): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query(
        'UPDATE users SET auth_version = auth_version + 1 WHERE id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1',
        [userId],
      );
    });
  }
}
