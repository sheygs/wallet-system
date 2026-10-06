-- Run after every migration as the schema owner/administrator. These are
-- explicit grants so new tables do not automatically gain runtime access.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"runtime_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"runtime_role";
GRANT SELECT ON users, wallets, transfers, wallet_transactions, transfer_requests,
  refresh_tokens, auth_rate_limits, ledger_journals, ledger_entries, wallet_balance_reconciliation, migrations TO :"runtime_role";
GRANT INSERT ON users, transfers, wallet_transactions, transfer_requests,
  refresh_tokens, auth_rate_limits, ledger_journals, ledger_entries TO :"runtime_role";
-- The API cannot create a pre-funded wallet or modify its currency.
GRANT INSERT (user_id, currency) ON wallets TO :"runtime_role";
GRANT UPDATE (kobo_balance, updated_at, deleted_at) ON wallets TO :"runtime_role";
GRANT UPDATE (auth_version) ON users TO :"runtime_role";
GRANT UPDATE ON transfers, refresh_tokens, auth_rate_limits TO :"runtime_role";
GRANT DELETE ON refresh_tokens, auth_rate_limits TO :"runtime_role";
-- Trigger functions execute as the invoking role. Corrections are reserved
-- for audited administrative use by the migration role.
REVOKE ALL ON FUNCTION post_wallet_correction(uuid, numeric, text, text) FROM PUBLIC, :"runtime_role";
