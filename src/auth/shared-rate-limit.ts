import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHmac } from 'node:crypto';
import { DataSource } from 'typeorm';

@Injectable()
export class SharedRateLimit implements ThrottlerStorage {
  private readonly logger = new Logger(SharedRateLimit.name);
  constructor(private readonly db: DataSource) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    // Database time and an atomic UPSERT share each window across replicas.
    const digest = createHmac('sha256', process.env.JWT_SECRET)
      .update(key)
      .digest('hex');

    const [row] = await this.db.query(
      `
      INSERT INTO auth_rate_limits (key, hits, expires_at, blocked_until)
      VALUES ($1, 1, clock_timestamp() + $2 * interval '1 millisecond', NULL)
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN auth_rate_limits.expires_at <= clock_timestamp()
          AND COALESCE(auth_rate_limits.blocked_until, '-infinity') <= clock_timestamp() THEN 1
          ELSE LEAST(auth_rate_limits.hits + 1, $3 + 1) END,
        expires_at = CASE WHEN auth_rate_limits.expires_at <= clock_timestamp()
          AND COALESCE(auth_rate_limits.blocked_until, '-infinity') <= clock_timestamp()
          THEN clock_timestamp() + $2 * interval '1 millisecond' ELSE auth_rate_limits.expires_at END,
        blocked_until = CASE
          WHEN auth_rate_limits.blocked_until > clock_timestamp() THEN auth_rate_limits.blocked_until
          WHEN auth_rate_limits.expires_at <= clock_timestamp() THEN NULL
          WHEN auth_rate_limits.hits >= $3 THEN clock_timestamp() + $4 * interval '1 millisecond'
          ELSE NULL END
      RETURNING hits, GREATEST(0, CEIL(EXTRACT(epoch FROM expires_at - clock_timestamp()))) AS expires,
        GREATEST(0, CEIL(EXTRACT(epoch FROM blocked_until - clock_timestamp()))) AS blocked
    `,
      [digest, ttl, limit, blockDuration],
    );

    const record = {
      totalHits: Number(row.hits),
      timeToExpire: Number(row.expires),
      isBlocked: Number(row.blocked) > 0,
      timeToBlockExpire: Number(row.blocked) || 0,
    };

    if (record.isBlocked) this.logger.warn('security.rate_limit_blocked');

    return record;
  }
}
