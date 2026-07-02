# Anura API image. Build from the repo root (the workspace needs the whole
# monorepo): docker build -t anura-api .
# Debian slim rather than alpine: Prisma's engines want glibc + openssl.
FROM node:20-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Full sources before install: @anura/shared's `prepare` (tsc) and the API's
# `postinstall` (prisma generate) both run during npm ci and need src/schema.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# devDependencies are required to build (nest CLI, tsc, prisma CLI).
RUN npm ci --include-workspace-root --workspace @anura/shared --workspace @anura/api --include=dev

RUN npm run build:shared && npm run build -w @anura/api

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
