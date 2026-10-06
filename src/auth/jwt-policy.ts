import { JwtSignOptions } from '@nestjs/jwt';

export function jwtPolicy(env = process.env) {
  const issuer = env.JWT_ISSUER || 'wallet-system';
  const audience = env.JWT_AUDIENCE || 'wallet-system-api';
  const expiry = env.JWT_EXPIRY || '15m';
  const match = /^(\d+)(s|m|h)$/.exec(expiry);
  const seconds =
    match && Number(match[1]) * { s: 1, m: 60, h: 3600 }[match[2]];

  if (!seconds || !Number.isSafeInteger(seconds) || seconds > 3600) {
    throw new Error('JWT_EXPIRY must be 1s–1h with an explicit s, m or h unit');
  }

  if (!issuer.trim() || !audience.trim())
    throw new Error('JWT issuer and audience must be nonblank');

  return {
    issuer,
    audience,
    algorithm: 'HS256' as const,
    expiresIn: expiry as JwtSignOptions['expiresIn'],
  };
}
