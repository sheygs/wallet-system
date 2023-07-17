FROM node:18-alpine3.16

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN yarn install --pure-lockfile --non-interactive

# Bundle app source
COPY . .

RUN yarn run build

EXPOSE 4000

CMD [ "yarn", "run" , "start:prod" ]