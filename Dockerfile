FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json tsconfig.json ./
COPY .yarn/ .yarn/
COPY packages/ ./packages/
RUN corepack enable && corepack prepare yarn@4.6.0 --activate
RUN yarn install --immutable

COPY src/ ./src/

RUN yarn build

EXPOSE 3000

CMD ["sh", "-c", "yarn start:api"]
