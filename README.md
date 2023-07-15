<p align="center">
    <h2>Wallet System</h2>
    <br>
    <p>A RESTful service that mocks a basic wallet system</p>
</p>

#### Features

- User Authentication/Role-Based Authorization
- User Wallets Creation
- Wallet Account Crediting/Funding via Paystack Payment Gateway
- Wallet Funds Transfer & Approval
- Wallet Transaction History (Pay-in & Pay-out)

#### Development Tools

- NodeJS
- [NestJS](https://docs.nestjs.com/)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Typeorm](https://typeorm.io/)
- [Jest](https://jestjs.io/)
- [Paystack](https://paystack.com/)

#### Requirements

- [NodeJS](https://nodejs.org/en/download/)
- [Postman](https://www.postman.com/downloads/)
- [Git](https://git-scm.com/downloads)
- [Paystack API Secret Key](https://support.paystack.com/hc/en-us/articles/360011508199-How-do-I-generate-new-API-keys-#:~:text=How%20do%20I%20get%20a,'Generate%20new%20secret%20key'.)

#### Rename _.env.test_ to _.env_ and replace the placeholders

```bash
PORT=4000
NODE_ENV=development
PAYSTACK_SECRET_KEY=XXXX
PAYSTACK_API_BASE_URL=https://api.paystack.co
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=XXXX
POSTGRES_PASSWORD=XXXX
POSTGRES_DB=postgres
DB_TYPE=postgres
```

#### Installation 📦

```bash
   $ git clone https://github.com/sheygs13/wallet-system.git
   $ cd cd wallet-system
   $ yarn install
```

#### Development

```bash
   $ yarn run start:dev
```

#### Running the Service

#### Docker

- Install [Docker](https://www.docker.com/)
- Run `docker-compose up -d`. But If you like to see those clumsy logs 😬, RUN `docker-compose up`
- Open browser and visit `http://localhost:4000` and rock it

#### Without Docker

- Replace database_url in .env with your corresponding valid database url 👌
- Run `yarn install` to install project dependencies
- Run `yarn start:services` to run the services and you are good
- Open browser and visit `http://localhost:4000` and rock it

### Production Packaging

```
docker build -t ${IMAGETAG} -f Dockerfile .
```

#### Test

```bash
   $ yarn run test
```

#### Available Endpoints

`/api/v1/`

| method | route        | description   |
| ------ | ------------ | ------------- |
| POST   | /auth/signup | Register User |
| POST   | /auth/login  | Login User    |

`/api/v1/wallets`

| method | route                 | description        |
| ------ | --------------------- | ------------------ |
| POST   | /                     | Create Wallet      |
| GET    | /:`wallet_id`/balance | Get Wallet Balance |
| POST   | /initialize-payment   | Initialize Payment |
| POST   | /deposit              | Fund Payment       |

`/api/v1/transfers`

| method | route                   | description            |
| ------ | ----------------------- | ---------------------- |
| POST   | /                       | Create Wallet Transfer |
| PATCH  | /:`transfer_id`/approve | Approve Transfer       |

`/api/v1/wallet-transactions`

| method | route    | description             | Query Parameters - Optional                            |
| ------ | -------- | ----------------------- | ------------------------------------------------------ |
| GET    | /history | Get Transaction Summary | `from_date`, `to_date`, `target_month` , `target_year` |

#### Postman Documentation

- Please see `/postman_docs` on the root directory.

### Improvement Points

- Implement a Notification process (email or mobile notification) when an automated deposit fails due to insufficient funds.
