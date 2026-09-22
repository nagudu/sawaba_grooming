# Run doc — SAWABA salon frontend (Vite + React)

## Reproduce the artifacts (fresh checkout)

1. Install frontend dependencies (lockfile: `package-lock.json`):
   ```bash
   npm install
   ```
2. The frontend proxies `/api` to a backend at `http://localhost:5000` (see `vite.config.ts`).
   To run the API too:
   - No root `.env.local` is needed. Copy `backend/.env` from the main checkout if absent (never commit its values).
   - `cd backend && npm install`
   - `npm run db:sync && npm run db:seed` (MySQL must be reachable per `backend/.env`)
   - `npm run dev` (serves the API on port 5000)

## Run the frontend dev server

```bash
npm run dev
```

- Default port: **5173** (`http://localhost:5173`). If taken, run `npm run dev -- --port <free-port>` or pass `--host` for LAN access.
- Backend proxy target can be changed in `vite.config.ts` (`server.proxy['/api'].target`).

## Current live process

- Vite dev server: port **5173** (`http://localhost:5173`, IPv6 `::1`) — detached via `Start-Process node.exe node_modules/vite/bin/vite.js` (the `npm.cmd` shim hangs under Start-Process on this machine). Registered as this thread's preview.
- Backend API: port **5000**, detached with `PORT=5000 nohup node node_modules/tsx/dist/cli.mjs src/server.ts` from `backend/`, logs at `.freebuff/api.out.log` / `.freebuff/api.err.log` (stdout/stderr MUST be different files). On boot it now runs the add-only schema-drift healer (`src/scripts/ensureColumns.ts`) before `sync({force:false})`, so model columns added after a table existed (e.g. `barbers.portal_enabled`) are applied automatically — no manual migration needed. Note: `$env:PORT='5000'` matters — this machine's shell exports `PORT=0`. Images now live on the backend: `backend/uploads/` served at `/uploads/...` (Vite proxies it), seeded copies come from `backend/seed-assets/` via `npm run db:seed`.
- Barber working hours: live barbers need rows in `barber_availability` — if a new barber shows no slots, run `cd backend && npx tsx src/scripts/seedAvailability.ts` (idempotent; Mon–Fri 9–8, Sat 8–9, Sun 11–6). The availability API also falls back to these default hours when a barber has no rows.
- Status-transition test battery: `node .freebuff/test-status.js` (creates its own appointments, cleans up after).
- Email reply flows: `cd backend && npm run smtp:verify` checks the provider without sending. Provider is Resend (`RESEND_API_KEY` in `backend/.env`, send-only key); SMTP vars still work as fallback. `RESEND_FROM` may be a bare address OR a pre-composed `Name <email>` (the mailer handles both — it never double-wraps). Currently `RESEND_FROM=onboarding@resend.dev`, which only delivers to the account owner's email — to reach real customers, verify `sawabasalon.com` in Resend, then set `RESEND_FROM=SAWABA Grooming Salon <noreply@sawabasalon.com>`.
- Payment flow test battery: `node .freebuff/test-payment-flow.js` (books its own appointments with randomized slots, covers upload/verify/reject/security, cleans up after).
- **Booking payment-rules battery**: `node .freebuff/payment-rules-test.mjs` — verifies the server-side enforcement on `POST /api/appointments` (cash OK without receipt; bank transfer/OPay rejected without a receipt, invalid or empty files rejected; transfer+receipt → `PAYMENT_SUBMITTED` + `PENDING_VERIFICATION`; cash → `UNPAID`; ONLINE → stays `PAYMENT_REQUIRED`/`UNPAID` until Paystack's server-verified callback; direct JSON API booking without receipt rejected). Uses random day offsets per run; the submit limiter is 20 bookings/15 min, so restart the backend between repeated runs.
- Receipt PDFs use `jspdf` (frontend, no backend dependency).
- **Paystack online payments** (TEST MODE): keys live only in `backend/.env` (`PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY`). Flow: `POST /api/payments/paystack/initialize/:token` → hosted checkout → customer returns to `/payments/callback?token=…&reference=…` → backend re-verifies directly with Paystack (`POST /api/payments/paystack/verify/:token`); `POST /api/payments/paystack/webhook` (raw-body HMAC `x-paystack-signature`, mounted BEFORE express.json in `server.ts`) is the second path. Amount always comes from the stored appointment price in kobo. For production: switch to live keys, set the real callback URL in the Paystack dashboard, and point `CLIENT_URL` at the deployed domain.
- Database uses `DATABASE_URL` (mysql2 URL format) in `backend/.env`; `npm run db:sync` applies model changes (added `payments.provider_ref` column and `ONLINE` payment method).
- Known env quirk: this machine's shell exports `PORT=0`; `env.ts` now guards with `Number(PORT) || 5000`, but if the backend ever binds to port 0, check for an inherited `PORT` env var first. Detached starts should pass `$env:PORT="5000"` explicitly.
