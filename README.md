# Anura

AI-native Practice Management System for Indian High Court & District Court litigators.

This is an npm-workspaces monorepo:

```
apps/
  web/         Next.js 15 (App Router) — the lawyer-facing web app
  api/         NestJS 11 modular monolith — API, AI, storage, billing, etc.
  marketing/   Static marketing site (the original landing page)
packages/
  shared/      Enums, constants and DTO/view types shared by web + api
docker/        Postgres (pgvector) init
```

## Prerequisites

- Node.js >= 20
- Docker (for Postgres + Redis + MinIO)

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env (defaults work with docker-compose)
cp .env.example .env

# 3. Start infra (Postgres+pgvector, Redis, MinIO)
npm run infra:up

# 4. Create the schema + seed demo data
npm run db:push
npm run db:seed

# 5. Run web (:3000) + api (:4000)
npm run dev
```

Then open http://localhost:3000 and sign in with the seeded account:

```
demo@anura.legal  /  anura1234
```

## Wiring real providers

Everything runs locally with mocked/log providers. To go live, set the relevant
keys in `.env` and flip the provider selector:

| Capability   | Env selector          | Options                     |
| ------------ | --------------------- | --------------------------- |
| AI chat      | `AI_PROVIDER`         | `anthropic` \| `openai`     |
| Embeddings   | `OPENAI_API_KEY`      | OpenAI text-embedding-3-large |
| Object store | `STORAGE_PROVIDER`    | `minio` \| `s3` \| `r2` \| `filesystem` |
| OCR          | `OCR_PROVIDER`        | `none` \| `textract`        |
| WhatsApp     | `WHATSAPP_PROVIDER`   | `log` \| `meta`             |
| Billing      | `PAYMENTS_PROVIDER`   | `none` \| `stripe` \| `razorpay` |
| Push         | `NOTIFICATIONS_PROVIDER` | `log` \| `firebase`      |

## Useful scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Run api + web together                    |
| `npm run build`        | Build shared, api, web                     |
| `npm run typecheck`    | Type-check all workspaces                 |
| `npm run db:push`      | Push Prisma schema to Postgres            |
| `npm run db:seed`      | Seed demo data                            |
| `npm run db:studio`    | Open Prisma Studio                        |
| `npm run infra:up/down`| Start/stop docker infra                   |

## Architecture

The API is a **modular monolith**: each domain (auth, users, cases, documents,
ai, search, billing, notifications, whatsapp, audit) is a self-contained NestJS
module with clean boundaries, so it can later be split into microservices.
Integrations (AI, storage, OCR, messaging, payments, push, queue) sit behind
provider interfaces selected by config.

Security: self-hosted JWT auth (access + rotating refresh tokens), global RBAC
guard, per-request validation, and an audit log.
