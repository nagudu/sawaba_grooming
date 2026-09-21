# SAWABA Grooming Studio — Deployment Runbook (free-tier testing)

This project is a **two-part monorepo**:

| Part | Stack | Build | Start |
|---|---|---|---|
| `frontend/` (repo root) | React 19 + Vite 8 + Tailwind 4 | `npm run build` → `dist/` | static files |
| `backend/` | Node 18+ / Express 4 / Sequelize 6 / **MySQL** | `npm run build` → `dist/` | `node dist/server.js` |

Uploads go to **Cloudinary** (no local /uploads dependency). Email via **Resend**. Online payments via **Paystack (test keys)**. Auth: admin = email+password JWT; customer = **email OTP code** (in non-production the code is returned by the API and shown on screen — this is what makes client demos possible without owning an email domain).

---

## 1. Database (free MySQL)

The app requires **MySQL** (not Postgres). Free-tier options to check at deploy time:

- **Aiven** — free MySQL plan, TLS required (`DB_SSL=true`).
- **Railway** — MySQL plugin on trial credit.
- **PlanetScale** — check current free plan; MySQL-compatible.

Steps:
1. Create the database, copy the connection URL.
2. Append `?ssl-mode=REQUIRED` style params per provider; set `DB_SSL=true` in the backend env.
3. From `backend/` with a `.env` containing the hosted `DATABASE_URL`: `npm run db:sync` — creates every table (sync, no migrations needed) + seed admin.
4. Then `npm run db:seed` — services, barbers + availability, payment settings (also migrates any legacy external image URLs to local `/uploads/seed/...` copies).

### Image storage (offline-first)

Uploads default to **local disk** (`backend/uploads/...`, served at `/uploads/...`) — no Cloudinary account needed and fully offline-capable. Set `UPLOAD_DRIVER=cloudinary` to switch back to cloud storage for a cloud deployment. The Railway bundle must include `seed-assets/` (used by `SEED_ON_BOOT`): `cp -r backend/seed-assets deploy/seed-assets` when building it.

> `db:sync` intentionally uses `sync()` (schema from Sequelize models). For a test deployment this is safe and repeatable.

## 2. Backend (free Node host)

Any host that runs `node dist/server.js` works (Render / Railway / Koyeb / Fly). Env vars to set:

```
NODE_ENV=production          # ⚠ OTP codes are NOT returned on-screen in production.
PORT=<host assigns>          # server reads process.env.PORT
DATABASE_URL=<hosted mysql url>
DB_SSL=true
JWT_SECRET=<64 random chars>
CLIENT_URL=<frontend URL>
EXTRA_CLIENT_ORIGINS=<any extra allowed origins, comma-separated>
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / CLOUDINARY_UPLOAD_FOLDER
ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD / ADMIN_SEED_NAME
RESEND_API_KEY / RESEND_FROM
PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY   (TEST MODE keys)
```

Deploy steps (no git repo exists — use the CLI/dashboard upload or `git init` + push):
1. `cd backend && npm ci && npm run build`
2. Point the host at `backend/`, build `npm ci && npm run build`, start `node dist/server.js`, health check `GET /health` → `{"status":"ok"}`.
3. Paystack dashboard: add the deployed `CLIENT_URL + /payments/callback` as an allowed callback.

**Demo-mode tip:** to keep OTP codes visible on screen during the client demo, set `NODE_ENV=staging` instead of `production` (everything production-like except the OTP devCode convenience).

## 3. Frontend (free static host)

Vercel / Netlify / Cloudflare Pages — `vercel.json` and `netlify.toml` (SPA fallback) are already committed.

1. Build with `VITE_API_URL=https://<your-api-host>` so the app calls the deployed API (`src/api/*` already supports this; leave unset for local dev where the Vite proxy handles `/api`).
2. Publish `dist/`.
3. Verify direct URLs + refreshes: `/`, `/services`, `/barbers`, `/gallery`, `/reviews`, `/book`, `/contact`, `/pay/:token`, `/receipt/:token`, `/account`, `/admin/login`, unknown → 404 page.

## 4. Post-deploy E2E checklist

- `GET /health` on API → ok; frontend loads, no console errors.
- CORS: frontend origin allowed, no browser CORS errors.
- Booking → payment token → cash declare → admin confirm-cash → appointment READY_FOR_SERVICE.
- Receipt upload (Cloudinary) → admin Verify Receipt → PAID.
- Paystack test payment (test card 4084 0840 8408 4081) → callback → server-side verify.
- Customer OTP login (devCode on screen in staging mode), dashboard, booking history.
- Admin dashboard stats, services/barbers CRUD reflected on public site instantly.
- Persistence: create a record → refresh → still exists (hosted MySQL, not memory).

## 5. Free-tier caveats to disclose to the client

- Free backend hosts **spin down** after inactivity (cold start ≈ 30–60 s on the first request).
- Free MySQL plans have small storage/connection caps; fine for a demo, not for real load.
- Paystack stays in TEST MODE — payments use test cards and no real money moves.
- Email (Resend `onboarding@resend.dev`) only delivers to the account owner's inbox until a domain is verified in Resend.

## Live Deployment (Railway) — September 17, 2026

**URL:** https://sawaba-api-production.up.railway.app (SPA + API, single service)
**DB:** Railway MySQL (private network only — no public endpoint)

### How it runs
- `railway up` from `deploy/` (scoped link) → Railpack: `npm install --omit=dev`, start `node dist/server.js`, healthcheck `/health`.
- Static SPA served by Express BEFORE the 404 handler (`SERVE_STATIC_DIR=/app/spa`).
- Tables auto-create on boot (`sequelize.sync`); `SEED_ON_BOOT=true` idempotently seeds admin + demo data.
- Redeploy after code changes: `cd backend && npm run build`, then from repo root rebuild SPA, sync `deploy/` (dist + spa), `cd deploy && railway up`.

### Fixes made during deployment
1. `.gitignore` excluded `deploy/dist` — added `!deploy/dist/`.
2. Root `package.json` start script + merged backend runtime deps for Railpack.
3. `trust proxy 1` for express-rate-limit behind Railway's proxy.
4. Static/SPA middleware was mounted inside async boot (AFTER notFoundHandler) → every page 404'd. Moved before `notFoundHandler` in server.ts.
5. Seed admin now created in `seedDatabase` (was only in db:sync).
6. `DB_SSL_REJECT_UNAUTHORIZED=false` for Railway MySQL's cert chain (still TLS-encrypted).

### E2E battery
`node .freebuff/deploy-e2e.mjs` — 46 checks: reachability, seed data, auth, booking, cash flow, receipt flow, contact+reply honesty, reviews, admin ops, customer dashboard. Current result: 46/46 passed.
