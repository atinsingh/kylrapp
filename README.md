# Klyr

Ontario real estate brokerage app: all-in cost to close for buyers, net proceeds for sellers, and leasing for tenants and landlords.

Start with **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. The design prototype and the chats behind it are in [`design/`](design/README.md).

## Layout

```
apps/
  api/      NestJS API + BullMQ worker, Drizzle + Postgres/PostGIS
  web/      Next.js consumer web app
  mobile/   Expo (React Native) consumer app
  pro/      Next.js: agents and providers (lawyer, lender, inspector, insurer)
  admin/    Next.js: internal back office
packages/
  core/       Ontario cost engine (LTT, CMHC, payments, all-in, seller net)
  contracts/  Roles, deal stages, OREA forms, zod request schemas
  api-client/ Typed API calls shared by web and mobile
  tokens/     Design tokens from the prototype
infra/      AWS ca-central-1 plan (Terraform)
design/     Claude Design handoff: prototype HTML and chat transcripts
```

## Run it locally

Requires Node 22, pnpm 10 and Docker.

```sh
pnpm install
cp .env.example .env         # defaults already match docker compose
pnpm db:up                      # Postgres+PostGIS, Redis, MinIO, Mailpit
pnpm db:migrate && pnpm db:seed # schema + the six prototype listings
pnpm build                      # builds the shared packages the apps import
pnpm --filter @klyr/api dev     # http://localhost:4000/health (email codes print here)
pnpm --filter @klyr/web dev     # http://localhost:3000 → sign up, then search
pnpm --filter @klyr/mobile dev  # Expo dev server; the app talks to port 4000 on the same machine
```

`pnpm build`, `pnpm typecheck` and `pnpm test` run across the whole repo.
