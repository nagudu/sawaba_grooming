# SAWABA Grooming Studio — Deployment Runbook & Database Guide

SAWABA Grooming Studio uses **Prisma ORM** with seamless dual-database support:
- **Local Development**: MySQL (`127.0.0.1:3306`)
- **Online Production / Staging**: PostgreSQL (Supabase, Neon, Vercel Postgres, Railway)
- **Hosting Platform**: Vercel (Frontend SPA + Serverless Express API in a single project)

---

## 1. Dual Database Provider Architecture

Prisma schemas require specifying `provider = "mysql"` or `provider = "postgresql"`.
To support **MySQL locally** and **PostgreSQL online** with zero manual editing, the project includes an automated script:

```bash
node scripts/prepare-prisma.js
```

### How it works:
1. Inspects your `DATABASE_URL` in `.env` (or environment variable):
   - Starts with `mysql://` → sets `provider = "mysql"`
   - Starts with `postgres://` or `postgresql://` → sets `provider = "postgresql"`
2. Can also be overridden explicitly:
   - `npm run db:use:mysql`
   - `npm run db:use:postgres`
3. Automatically runs before `prisma generate`, `prisma db push`, and the Vercel build (`npm run build`).

All column types and schema definitions in `prisma/schema.prisma` are 100% compatible between MySQL and PostgreSQL without any schema drift.

---

## 2. Local Development (MySQL)

### Prerequisites:
- Local MySQL running (e.g. `127.0.0.1:3306`)
- A database named `sawaba_groom`

### Setup:
1. Configure `.env` and `backend/.env`:
   ```bash
   DATABASE_URL="mysql://root@127.0.0.1:3306/sawaba_groom"
   ```
2. Push the schema to your local MySQL database:
   ```bash
   npm run db:push
   ```
3. Seed default admin, services, barbers, schedules, gallery, and reviews:
   ```bash
   npm run db:seed
   ```
4. Start both frontend and backend concurrently:
   ```bash
   npm run dev:all
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`
   - API Docs: `http://localhost:5000/api/docs`

---

## 3. Online Production Hosting (Vercel + PostgreSQL)

You can host both the frontend and the backend API as a single Vercel project!

### Step 1: Provision a Free PostgreSQL Database
Get a PostgreSQL connection URL from any provider:
- **Neon** (neon.tech) — serverless Postgres, instant setup
- **Supabase** (supabase.com) — managed Postgres (use Transaction Pooler / port 6543 for serverless)
- **Vercel Postgres** — directly in your Vercel dashboard

Copy the connection string:
```
DATABASE_URL="postgresql://user:password@ep-cool-db.us-east-2.aws.neon.tech/sawaba?sslmode=require"
```

### Step 2: Push Schema & Seed Remote Database
From your machine (or CI pipeline), run:
```bash
# Push all tables and indexes to your online PostgreSQL database:
DATABASE_URL="postgresql://..." npm run db:push

# Seed initial admin and studio data:
DATABASE_URL="postgresql://..." npm run db:seed
```

### Step 3: Deploy to Vercel
1. Import the repository into Vercel.
2. In the Project Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables in Vercel:
   ```ini
   NODE_ENV=production
   DATABASE_URL=postgresql://user:password@host/db?sslmode=require
   JWT_SECRET=your_super_secret_jwt_key_at_least_64_characters
   CLIENT_URL=https://your-app.vercel.app
   ADMIN_SEED_EMAIL=admin@sawabasalon.com
   ADMIN_SEED_PASSWORD=YourAdminPassword123!
   ADMIN_SEED_NAME=Sawaba Admin

   # Optional for Image Uploads & Payments:
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   PAYSTACK_SECRET_KEY=sk_test_...
   PAYSTACK_PUBLIC_KEY=pk_test_...
   ```
4. Click **Deploy**!

### How Vercel Serves the Project:
- `vercel.json` rewrites `/api/(.*)` to the serverless function `api/index.ts`.
- `api/index.ts` loads the Express application in `backend/src/app.ts`.
- The build script (`npm run build`) automatically switches Prisma to PostgreSQL, runs `prisma generate`, and builds the Vite frontend into `dist/`.
- All other routes serve `index.html` for clean client-side SPA routing (`/book`, `/account`, `/admin/*`, `/pay/:token`).

---

## 4. Default Seed Credentials

After running `npm run db:seed`:

- **Admin Portal**: `/admin/login`
  - Email: `admin@sawabasalon.com`
  - Password: `Password123!` (or the value of `ADMIN_SEED_PASSWORD`)
- **Demo Customer**:
  - Phone: `08000000001`
  - Email: `customer@sawabagrooming.test`
  - Password: `TestCustomer123!`
- **Barber Portal**: `/barber/login`
  - Aminu Sawaba (Master Barber): Phone OTP login with registered phone
