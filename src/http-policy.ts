import { isIP } from 'node:net';

export function httpPolicy(env = process.env) {
  const production = env.NODE_ENV === 'production';

  const origins = (env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const origin of origins) {
    const url = new URL(origin);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password
    )
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins');

    if (
      production &&
      url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw new Error('Production CORS origins must use HTTPS');
  }

  const proxies = (env.TRUSTED_PROXIES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const proxy of proxies) {
    const [ip, prefix, ...extra] = proxy.split('/');
    const family = isIP(ip);

    if (
      !family ||
      extra.length ||
      (prefix != null &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (family === 4 ? 32 : 128)))
    )
      throw new Error(
        'TRUSTED_PROXIES must contain explicit IP addresses or bounded CIDRs',
      );
  }

  if (
    env.SWAGGER_ENABLED != null &&
    !['true', 'false'].includes(env.SWAGGER_ENABLED)
  )
    throw new Error('SWAGGER_ENABLED must be true or false');

  if (production && env.SWAGGER_ENABLED === 'true')
    throw new Error(
      'Production Swagger is disabled; use a private development environment for documentation',
    );

  return {
    origins: origins.length ? origins : production ? false : true,
    proxies: proxies.length ? proxies : false,
    swagger: !production && env.SWAGGER_ENABLED !== 'false',
  };
}
