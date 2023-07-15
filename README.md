<p align="center">
    <h2>Wallet System</h2>
    <br>
    <p>A RESTful service that mocks a basic wallet system</p>
</p>

#### Development Tools

- NodeJS
- [NestJS](https://docs.nestjs.com/)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Typeorm](https://typeorm.io/)
- [Jest](https://jestjs.io/)
- [Paystack Payment Gateway](https://paystack.com/)

#### Requirements

- [NodeJS](https://nodejs.org/en/download/)
- [Postman](https://www.postman.com/downloads/)
- [Git](https://git-scm.com/downloads)
- Paystack Secret Key

#### Rename _.env.sample_ to _.env_ and replace the placeholders

```bash
PORT=4000
NODE_ENV=development
PAYSTACK_SECRET_KEY=XXXX
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=XXXX
POSTGRES_PASSWORD=XXXX
POSTGRES_DB=account
DB_TYPE=postgres
```

#### Installation 📦

````bash
   $ git clone https://github.com/sheygs13/wallet-system.git
   $ cd cd wallet-system
   $ yarn install

#### Start App

```bash
   $ yarn run start:dev
````

#### Test

```bash
   $ yarn run test
```

#### API Documentation

[Postman Collection](https://ovalfi.postman.co/workspace/Team-Workspace~c6dd75d7-d798-4c52-834c-608aac1bce0c/documentation/19819766-86ec3a2c-8337-423e-8b68-e8670ecc7836)

#### Hosted API Service

[Thirdparty Base URL](http://ovalfi-dev-env-1621902102.us-east-2.elb.amazonaws.com:8282)
