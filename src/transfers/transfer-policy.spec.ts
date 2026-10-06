import { getTransferApprovalThreshold } from './transfer-policy';

describe('Transfer approval policy', () => {
  it('defaults to 1000000 minor units', () => {
    expect(getTransferApprovalThreshold({})).toBe(1000000);
  });
  it('allows zero to require approval for every transfer', () => {
    expect(getTransferApprovalThreshold({ MININUM_APPROVAL_AMOUNT: '0' })).toBe(
      0,
    );
  });
  it.each(['', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992'])(
    'rejects invalid threshold %s',
    (value) => {
      expect(() =>
        getTransferApprovalThreshold({ MININUM_APPROVAL_AMOUNT: value }),
      ).toThrow('MININUM_APPROVAL_AMOUNT');
    },
  );
});
