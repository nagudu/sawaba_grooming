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

// Always regenerate: a previously generated client can be stale after schema edits.
console.log('[sync-prisma] Generating Prisma Client...')
execSync(`npx prisma generate --schema="${schemaPath}"`, {
  cwd: rootDir,
  stdio: 'inherit',
})

// If backend has its own node_modules, sync .prisma/client into it
if (fs.existsSync(path.join(rootDir, 'backend/node_modules'))) {
  try {
    fs.mkdirSync(backendClientDir, { recursive: true })
    if (fs.existsSync(rootClientDir)) {
      fs.cpSync(rootClientDir, backendClientDir, {
        recursive: true,
        // The Prisma engine DLL may be locked by a running backend process;
        // the binary is versioned independently from the generated schema API.
        filter: (source) => !/query_engine.*\.dll\.node$/i.test(path.basename(source)),
      })
      console.log('[sync-prisma] Synced Prisma Client to backend/node_modules/.prisma/client')
    }
  } catch (err) {
    console.error('[sync-prisma] Failed syncing generated Prisma Client to backend:', err.message)
    throw err
  }
}

// Sync schema.prisma to backend/prisma/schema.prisma
const backendPrismaDir = path.join(rootDir, 'backend/prisma')
fs.mkdirSync(backendPrismaDir, { recursive: true })
fs.copyFileSync(schemaPath, path.join(backendPrismaDir, 'schema.prisma'))
