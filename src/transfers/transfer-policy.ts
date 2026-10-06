export function getTransferApprovalThreshold(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = env.MININUM_APPROVAL_AMOUNT ?? '1000000';

  const threshold = Number(value);
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(threshold)) {
    throw new Error(
      'MININUM_APPROVAL_AMOUNT must be a nonnegative safe integer in minor units',
    );
  }
  return threshold;
}
