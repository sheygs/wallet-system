# Wallet System Postman collection

Import `Wallet_System.postman_collection.json` into Postman. It uses collection
v2.1 format, includes current response examples, and contains placeholder values
for credentials, tokens and wallet/transfer IDs.

## Configure variables

Open the collection's Variables tab. Set `BASE_URL` to the API origin (default
`http://localhost:4000`, without `/api/v1`) and supply `USER_EMAIL`,
`USER_PASSWORD` and `USER_PHONE`. Signup passwords require 12–72 characters and
at most 72 UTF-8 bytes. Use unique email/phone values for a new account.

Use collection variables for this workflow. An environment/global variable with
the same name can override them, including the token captured by Login. Clear
such overrides when using these automation scripts. Credential/token values
should stay in your private Postman session; the repository export starts empty.

## Ordinary user workflow

1. Run **Base**, then **Sign Up** and **Login**. Login saves the returned
   `data.access_token` as `ACCESS_TOKEN` and `data.id` as `USER_ID`.
2. Run **Create Wallet**. It saves `WALLET_ID`; `USER_ID` must match the signed-in
   account. `CURRENCY` can be NGN, USD or GHS. Remove the currency field to create
   the default NGN wallet. Duplicate active user/currency pairs return 409.
3. Run **Get Wallet Balance** for your wallet. Set `SOURCE_WALLET_ID` explicitly
   to the wallet you intend to spend from. Set `DESTINATION_WALLET_ID` to a
   distinct, existing recipient wallet of the same currency; create the recipient
   account/wallet in a separate session if needed.
4. To fund your wallet, set `PAYMENT_AMOUNT` in integer minor units (minimum
   1000), run **Initialize Payment**, complete the returned Paystack checkout,
   then put that completed payment's reference in `PAYMENT_REFERENCE` and run
   **Fund Wallet**. Initialization alone does not credit funds. The provider must
   report success and matching amount/currency/wallet/user metadata. Duplicate
   successful credits return 409.
5. Set `TRANSFER_AMOUNT` in integer minor units, choose `TRANSFER_REASON`, and
   clear `IDEMPOTENCY_KEY` before a deliberate new transfer. **Wallets Transfer**
   generates a UUID only when the key is empty. Preserve both the body variables
   and key after sending, especially if the response was lost.
6. Run **Retry Transfer** to replay that same request. It does not generate a
   key and checks the returned transfer ID against the original `TRANSFER_ID`.
   Matching retries return the original creation response without another debit;
   changing the payload under a recorded key returns 409. Use a new key for a
   new transfer.

Transfers at or below `MININUM_APPROVAL_AMOUNT` (default 1000000) execute
immediately. Larger transfers return `pending` without moving or reserving
funds. Their original creation response is also what retries return after later
approval/rejection. Only a failed, rolled-back creation leaves its key unrecorded.

## Administrator workflow

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for an existing account provisioned with
admin privileges, then run **Login as Admin**. It saves `ADMIN_ACCESS_TOKEN`
separately from the ordinary user's token. Public signup cannot assign admin
privileges.

Set `TRANSFER_ID` to a pending above-threshold transfer and choose **Approve
Transfer** or **Reject Transfer**. Approval rechecks current funds and settles
atomically; insufficient funds return 422 and leave the request pending.
Rejection moves no funds. Once executed or rejected, another review returns 409.
Do not run both review requests expecting both to succeed.

**Transaction Summary** uses the admin token. Enable either the date-bound pair
or the month/year pair. Its current implementation uses exact date bounds; set
an explicit UTC end-of-day timestamp to include that day. Month/year fields
currently override date bounds and end at midnight on the month's last day.
Pagination and corrected month/date semantics have not been implemented, so the
collection does not advertise them.

## Status codes and checks

Signup/wallet creation return 201. Login, payment initialization, deposit,
transfer, review and history return 200. Scripts check the success envelope and
capture session variables. Balances and database-loaded amounts are decimal
strings; a newly created transfer can return its amount as a number. Examples also cover duplicate/replay conflicts and
review failures; these examples are documentation, not requests sent by the
success-path scripts.

This is a manual workflow rather than an unattended collection run: payment
completion, funding, recipient setup and admin provisioning require external
steps. Select the appropriate requests for automation. Login is limited to five
requests per minute per IP and all endpoints have a global per-IP limit of 60 per
minute, so repeated runs may return 429.
