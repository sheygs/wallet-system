-- Schedule daily using the runtime or maintenance role. Keep consumed token
-- hashes until the family's absolute expiry so reuse remains detectable.
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '1 day';
DELETE FROM auth_rate_limits WHERE expires_at < now() - interval '1 day'
  AND COALESCE(blocked_until, '-infinity') < now();
