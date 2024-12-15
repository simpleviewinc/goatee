FROM node:20.13.1

WORKDIR /app

# install desired version of yarn
RUN corepack enable && corepack prepare yarn@4.2.2 --activate

COPY package.json /app/package.json
COPY .yarn /app/.yarn
COPY yarn.lock /app/yarn.lock
RUN cd /app && yarn install

COPY tsconfig.json /app/tsconfig.json
COPY tsconfig.cjs.json /app/tsconfig.cjs.json
COPY tsconfig.esm.json /app/tsconfig.esm.json
COPY tsconfig.types.json /app/tsconfig.types.json
COPY rollup.config.ts /app/rollup.config.ts
COPY eslint.config.mjs ./

COPY src /app/src

WORKDIR /app
