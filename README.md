# SAWABA Grooming Studio

Full-stack luxury salon & grooming appointment management platform.

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**:
  - **Local Development**: MySQL (`mysql://...`)
  - **Online Production**: PostgreSQL (`postgresql://...`)
- **Hosting**: Vercel (SPA + Serverless Express API)

---

## Quick Start (Local MySQL)

### 1. Install Dependencies
```bash
npm install
cd backend && npm install && cd ..
```

### 2. Configure Environment
Set `DATABASE_URL` in `.env` and `backend/.env`:
```bash
DATABASE_URL="mysql://root@127.0.0.1:3306/sawaba_groom"
```

### 3. Push Schema & Seed Data
```bash
npm run db:push
npm run db:seed
```

### 4. Start Development Servers
```bash
npm run dev:all
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Swagger Docs: `http://localhost:5000/api/docs`

---

## Dual Database Provider (MySQL Local & PostgreSQL Online)

The project includes an automatic database provider switcher (`scripts/prepare-prisma.js`):
- When `DATABASE_URL` starts with `mysql://` → sets `provider = "mysql"`
- When `DATABASE_URL` starts with `postgres://` or `postgresql://` → sets `provider = "postgresql"`

You can also explicitly switch providers:
```bash
npm run db:use:mysql
npm run db:use:postgres
```

---

## Deploying to Vercel

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

1. Connect your repository to Vercel.
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`
4. Set Environment Variables:
   - `DATABASE_URL`: Your hosted PostgreSQL URL (Neon, Supabase, Vercel Postgres)
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: Random 64-character secret
5. Deploy! Vercel serves the Vite SPA and routes `/api/*` to the serverless Express function `api/index.ts`.
