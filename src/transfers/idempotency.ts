import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { CreateTransferDTO } from './dto/transfer.dto';
import { Currency } from '../wallets/wallet.entity';

export function assertIdempotencyKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
    throw new BadRequestException(
      'Idempotency-Key must contain 1–128 ASCII letters, digits, dots, underscores, colons or hyphens',
    );
  }
}

export function transferRequestHash(
  body: CreateTransferDTO,
  walletCurrency: Currency,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        body.source_wallet_id.toLowerCase(),
        body.destination_wallet_id.toLowerCase(),
        body.amount,
        body.currency ?? walletCurrency,
        body.reason ?? null,
      ]),
    )
    .digest('hex');
}
