FROM node:20.13.1

WORKDIR /app

# install desired version of yarn
RUN corepack enable && corepack prepare yarn@4.2.2 --activate

COPY .yarn ./yarn
COPY package.json \
	yarn.lock \
	.yarnrc.yml \
	./
RUN yarn install

COPY tsconfig.json \
	tsconfig.cjs.json \
	tsconfig.esm.json \
	tsconfig.types.json \
	rollup.config.ts \
	eslint.config.mjs \
	./

COPY src /app/src

WORKDIR /app
