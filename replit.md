# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## Naxçıvan Residence ERP

Full-stack property management system for a residential complex.

### Features
- Role-based auth (admin / sales) — localStorage sessions, bcryptjs password hashing
- **4-level hierarchy**: Kvartal → Bina (Building) → Blok → Apartments
- Each block supports multiple **floor ranges** with different apt count/area/rooms per range
- Admin bulk setup wizard: create full structure at once (`/admin/setup`)
- Kvartal page: expandable cards showing buildings, "Yeni bina" dialog with block+floor-range config
- Per-apartment area/rooms editor (`/admin/configure`)
- Project reusability settings (name, city, prices) stored in tariffs key-value table
- Users management (`/admin/users`) — admin only
- Installment tracking with expandable rows, overdue detection
- Rentals, communal billing, internet subscriptions, tariffs
- Sales with customer creation inline
- **Dashboard**: kvartal-filtered stats, breakdown by Mənzil/QeyriYaşayış/Avto satış, İcarə (2 types), Kommunal
- **Stats API**: `GET /api/stats/summary?quarterId=N` — filters all stats by quarter
- **Tariffs**: `object_monthly_rent` tariff key added for non-residential monthly rental
- **Objects page**: kvartal + block filter dropdowns
- **Customers page**: tab-style filter (Hamısı/Sakinlər/İcarəçilər)
- **Garage rental dialog**: "Müqavilə №" renamed to "Avtomobil nömrəsi" (stores car plate)

### Auth
- Login: `POST /api/auth/login` → returns user object, stored in localStorage
- Create user: `POST /api/auth/users` (admin only in practice)
- Default admin: username=`admin`, password=`admin123`

### DB Schema
- `quarters` — residential kvartals (A, B, C...)
- `buildings` — buildings (Bina), FK to `quarters`
- `blocks` — blocks (Blok), FK to `buildings` (+ nullable `quarterId` for legacy)
- `apartments` — units with `rooms`, `area`, `status`, FK to `blocks`
- `users` — role: admin | sales
- `customers`, `sales`, `installments`, `rentals`, `communal_bills`, `internet_subscriptions`, `tariffs`, `floor_price_tiers`

### Admin-only actions
- Add/delete kvartals, buildings, blocks
- Bulk setup wizard with floor range configuration per block
- Per-apartment area/rooms configuration
- Project settings (name, city, prices)
- User management

### Routes registered in api-server
`/quarters`, `/buildings`, `/blocks`, `/apartments`, `/objects`, `/customers`, `/sales`, `/installments`, `/rentals`, `/communal`, `/internet`, `/tariffs`, `/stats`, `/auth`, `/admin`, `/floor-price-tiers`

### Key API endpoints
- `POST /api/admin/setup` — bulk create: quarters→buildings→blocks→apartments (supports floorRanges)
- `POST /api/admin/blocks` — add a block with floorRanges to an existing building
- `GET/POST /api/buildings?quarterId=X` — buildings for a kvartal
- `PATCH /api/apartments/:id` — update area, rooms, status
- `GET/POST /api/admin/settings` — project settings key-value store
