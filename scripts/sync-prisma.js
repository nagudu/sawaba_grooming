#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, '..')
const rootClientDir = path.join(rootDir, 'node_modules/.prisma/client')
const backendClientDir = path.join(rootDir, 'backend/node_modules/.prisma/client')
const schemaPath = path.join(rootDir, 'prisma/schema.prisma')

// Ensure root has a generated client
const rootHasClient = fs.existsSync(path.join(rootClientDir, 'schema.prisma'))

if (!rootHasClient) {
  try {
    console.log('[sync-prisma] Generating Prisma Client...')
    execSync(`npx prisma generate --schema="${schemaPath}"`, {
      cwd: rootDir,
      stdio: 'inherit',
    })
  } catch (err) {
    console.error('[sync-prisma] Failed to generate Prisma Client:', err.message)
  }
}

// If backend has its own node_modules, sync .prisma/client into it
if (fs.existsSync(path.join(rootDir, 'backend/node_modules'))) {
  try {
    fs.mkdirSync(backendClientDir, { recursive: true })
    if (fs.existsSync(rootClientDir)) {
      fs.cpSync(rootClientDir, backendClientDir, { recursive: true })
      console.log('[sync-prisma] Synced Prisma Client to backend/node_modules/.prisma/client')
    }
  } catch (err) {
    console.warn('[sync-prisma] Warning syncing to backend:', err.message)
  }
}

// Sync schema.prisma to backend/prisma/schema.prisma
const backendPrismaDir = path.join(rootDir, 'backend/prisma')
try {
  fs.mkdirSync(backendPrismaDir, { recursive: true })
  fs.copyFileSync(schemaPath, path.join(backendPrismaDir, 'schema.prisma'))
} catch {
  // ignore
}

