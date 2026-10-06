import { BadRequestException } from '@nestjs/common';
import { assertIdempotencyKey, transferRequestHash } from './idempotency';
import { Currency } from '../wallets/wallet.entity';

describe('Transfer idempotency inputs', () => {
  it.each([undefined, '', ' ', 'a,b', 'has space', 'é', 'a'.repeat(129)])(
    'rejects invalid key %j',
    (value) => {
      expect(() => assertIdempotencyKey(value)).toThrow(BadRequestException);
    },
  );
  it('accepts UUIDs and bounded ASCII tokens', () => {
    expect(() => assertIdempotencyKey('client.order:1_ab-c')).not.toThrow();
    expect(() => assertIdempotencyKey('a'.repeat(128))).not.toThrow();
  });
  it('canonicalizes UUID casing, omitted currency and absent reason', () => {
    const body = {
      source_wallet_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      destination_wallet_id: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
      amount: 1000,
      currency: undefined,
      reason: undefined,
    };
    expect(transferRequestHash(body, Currency.NGN)).toBe(
      transferRequestHash(
        {
          ...body,
          source_wallet_id: body.source_wallet_id.toLowerCase(),
          destination_wallet_id: body.destination_wallet_id.toLowerCase(),
          currency: Currency.NGN,
          reason: null,
        },
        Currency.NGN,
      ),
    );
  });
  it('includes every transfer payload field in the fingerprint', () => {
    const body = {
      source_wallet_id: 'source',
      destination_wallet_id: 'destination',
      amount: 1000,
      currency: Currency.NGN,
      reason: 'first',
    };
    const original = transferRequestHash(body, Currency.NGN);
    for (const change of [
      { amount: 2000 },
      { source_wallet_id: 'other-source' },
      { destination_wallet_id: 'other-destination' },
      { currency: Currency.USD },
      { reason: 'changed' },
    ]) {
      expect(
        transferRequestHash({ ...body, ...change }, Currency.NGN),
      ).not.toBe(original);
    }
  });
});
