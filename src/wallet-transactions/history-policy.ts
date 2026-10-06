import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import { TransactionHistoryDTO } from './dto/wallet-transactions.dto';

const DAY = 86400000;

function dateOnly(value: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Use YYYY-MM-DD dates');

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 1000
  )
    throw new BadRequestException('Invalid calendar date');

  return date;
}

export function historyPolicy(query: TransactionHistoryDTO, now = new Date()) {
  const dates = query.from_date != null || query.to_date != null;
  const month = query.target_month != null || query.target_year != null;
  let from: Date, until: Date;

  if (dates && month)
    throw new BadRequestException('Choose a date range or month, not both');

  if (dates) {
    if (!query.from_date || !query.to_date)
      throw new BadRequestException('Both from_date and to_date are required');

    from = dateOnly(query.from_date);
    until = new Date(dateOnly(query.to_date).getTime() + DAY);
  } else if (month) {
    if (
      !/^(?:[1-9]|1[0-2])$/.test(query.target_month || '') ||
      !/^[1-9]\d{3}$/.test(query.target_year || '')
    )
      throw new BadRequestException(
        'Valid target_month and target_year are required',
      );

    from = new Date(
      Date.UTC(Number(query.target_year), Number(query.target_month) - 1, 1),
    );
    until = new Date(
      Date.UTC(Number(query.target_year), Number(query.target_month), 1),
    );
  } else {
    until = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY,
    );

    from = new Date(until.getTime() - 30 * DAY);
  }

  if (until <= from || until.getTime() - from.getTime() > 366 * DAY)
    throw new BadRequestException(
      'History range must be ordered and span at most 366 days',
    );

  const limit = query.limit == null ? 50 : Number(query.limit);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new BadRequestException('limit must be between 1 and 100');

  const scope = createHash('sha256')
    .update(`${from.toISOString()}/${until.toISOString()}`)
    .digest('hex');

  let cursor: { at: string; id: string } | undefined;

  if (query.cursor != null) {
    try {
      if (
        typeof query.cursor !== 'string' ||
        query.cursor.length > 512 ||
        !/^[A-Za-z0-9_-]+$/.test(query.cursor)
      )
        throw new Error();

      const decoded = JSON.parse(
        Buffer.from(query.cursor, 'base64url').toString('utf8'),
      );

      if (
        decoded.v !== 1 ||
        decoded.scope !== scope ||
        !isUUID(decoded.id) ||
        typeof decoded.at !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(decoded.at)
      )
        throw new Error();

      const time = new Date(`${decoded.at}Z`).getTime();

      if (
        !Number.isFinite(time) ||
        time < from.getTime() ||
        time >= until.getTime()
      )
        throw new Error();

      cursor = { at: decoded.at, id: decoded.id };
    } catch {
      throw new BadRequestException('Invalid history cursor for this range');
    }
  }
  return { from, until, limit, scope, cursor };
}
