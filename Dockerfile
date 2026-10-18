# syntax=docker/dockerfile:1
# Rebuild gosu with a patched Go toolchain; the upstream database image bundles
# an older Go standard library in this privilege-switching helper.
FROM golang:1.27.0-bookworm AS postgres-helper
RUN CGO_ENABLED=0 GOBIN=/out go install github.com/tianon/gosu@1.19

FROM postgres:18-alpine3.24 AS postgres
RUN apk upgrade --no-cache
COPY --from=postgres-helper /out/gosu /usr/local/bin/gosu
COPY scripts/database /opt/wallet-database
COPY scripts/database/init-roles.sh /docker-entrypoint-initdb.d/10-wallet-roles.sh

# Yarn installs dependencies; omit the unused npm bundle and its advisories.
FROM node:24-alpine3.24 AS node-base
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

FROM node-base AS dependencies
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=wallet-yarn-v2,target=/usr/local/share/.cache/yarn,sharing=locked yarn install --frozen-lockfile --non-interactive

FROM dependencies AS build
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN yarn build

FROM node-base AS production-dependencies
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=wallet-yarn-v2,target=/usr/local/share/.cache/yarn,sharing=locked yarn install --frozen-lockfile --non-interactive --production=true

FROM node-base AS application
# Refresh OS security patches and omit package managers from the runtime image.
RUN rm -rf /opt/yarn-* \
    && rm -f /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production PORT=4000 TZ=UTC
WORKDIR /usr/src/app
COPY --from=production-dependencies --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:4000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# Migration jobs need only the production CLI and compiled migration files.
FROM application AS migrations
HEALTHCHECK NONE
CMD ["node", "node_modules/typeorm/cli.js", "migration:run", "-d", "dist/database/migration-data-source.js"]

FROM application AS runtime
