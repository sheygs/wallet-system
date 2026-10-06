import { sign, SignOptions } from 'jsonwebtoken';
import { jwtPolicy } from '../src/auth/jwt-policy';

export function signTestToken(
  payload: object,
  secret: string,
  options?: SignOptions,
) {
  return sign({ authVersion: 0, ...payload }, secret, {
    ...jwtPolicy(),
    ...options,
  });
}
