import { historyPolicy } from './history-policy';
import { TransactionHistoryDTO } from './dto/wallet-transactions.dto';

describe('UTC transaction history bounds', () => {
  it('includes the entire final calendar day with a half-open UTC range', () => {
    expect(
      historyPolicy({ from_date: '2024-02-28', to_date: '2024-02-29' }),
    ).toMatchObject({
      from: new Date('2024-02-28T00:00:00Z'),
      until: new Date('2024-03-01T00:00:00Z'),
      limit: 50,
    });
  });
  it('uses UTC month boundaries across daylight saving changes', () => {
    expect(
      historyPolicy({ target_month: '3', target_year: '2024' }),
    ).toMatchObject({
      from: new Date('2024-03-01T00:00:00Z'),
      until: new Date('2024-04-01T00:00:00Z'),
    });
  });
  it.each([
    { from_date: '2023-02-29', to_date: '2023-03-01' },
    { from_date: '2024-04-31', to_date: '2024-05-01' },
    { from_date: '2024-01-01' },
    { target_month: '1' },
    { target_month: '13', target_year: '2024' },
    { target_month: '1', target_year: 'abc' },
    { from_date: '2024-05-01', to_date: '2024-04-01' },
    { from_date: '2023-01-01', to_date: '2024-12-31' },
    {
      from_date: '2024-01-01',
      to_date: '2024-01-01',
      target_month: '1',
      target_year: '2024',
    },
    { limit: '0' },
    { limit: '101' },
    { cursor: 'garbage' },
  ])(
    'rejects invalid or unbounded input %j',
    (query: TransactionHistoryDTO) => {
      expect(() => historyPolicy(query)).toThrow();
    },
  );
  it('defaults to a bounded recent UTC interval', () => {
    expect(historyPolicy({}, new Date('2026-10-06T14:00:00Z'))).toMatchObject({
      from: new Date('2026-09-07T00:00:00Z'),
      until: new Date('2026-10-07T00:00:00Z'),
    });
  });
});
