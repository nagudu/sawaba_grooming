#!/usr/bin/env node
/**
 * Automatically syncs the Prisma datasource provider in prisma/schema.prisma
 * based on the environment:
 * - Local development: MySQL (`DATABASE_URL=mysql://...` or default)
 * - Hosted / Production / Vercel: PostgreSQL (`DATABASE_URL=postgres://...` or `postgresql://...`)
 *
 * Can also be forced via:
 *   DB_PROVIDER=postgresql node scripts/prepare-prisma.js
 *   DB_PROVIDER=mysql node scripts/prepare-prisma.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from root and backend/.env if available
const rootEnvPath = path.resolve(__dirname, '../.env')
const backendEnvPath = path.resolve(__dirname, '../backend/.env')

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath })
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
}

const databaseUrl = process.env.DATABASE_URL || ''
const explicitProvider = process.env.DB_PROVIDER?.trim().toLowerCase()

let targetProvider = 'mysql' // Default for local development

if (explicitProvider === 'postgres' || explicitProvider === 'postgresql') {
  targetProvider = 'postgresql'
} else if (explicitProvider === 'mysql') {
  targetProvider = 'mysql'
} else if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
  targetProvider = 'postgresql'
} else if (databaseUrl.startsWith('mysql://')) {
  targetProvider = 'mysql'
} else if (process.env.VERCEL === '1') {
  // On Vercel, online database is PostgreSQL
  targetProvider = 'postgresql'
}

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma')

if (!fs.existsSync(schemaPath)) {
  console.error(`[prepare-prisma] schema.prisma not found at ${schemaPath}`)
  process.exit(1)
}

let content = fs.readFileSync(schemaPath, 'utf8')
const currentProviderMatch = content.match(/provider\s*=\s*"(mysql|postgresql)"/)

if (!currentProviderMatch) {
  console.warn('[prepare-prisma] Could not find provider = "mysql" or "postgresql" in schema.prisma')
} else {
  const currentProvider = currentProviderMatch[1]
  if (currentProvider !== targetProvider) {
    content = content.replace(/provider\s*=\s*"(mysql|postgresql)"/, `provider = "${targetProvider}"`)
    fs.writeFileSync(schemaPath, content, 'utf8')
    console.log(`[prepare-prisma] Switched Prisma provider from '${currentProvider}' to '${targetProvider}'`)
  } else {
    console.log(`[prepare-prisma] Prisma provider is already set to '${targetProvider}'`)
  }
}
