// Starts the SAWABA backend as a detached dev server, independent of the shell that
// launches it (path quoting under "Shu'aibu" breaks cmd/PowerShell spawn forms).
// Run: node .freebuff/start-backend.mjs
import { spawn } from 'node:child_process'
import path from 'node:path'
import { openSync } from 'node:fs'

const ROOT = path.resolve(import.meta.dirname, '..')
const LOG = path.join(ROOT, '.freebuff', 'backend-dev.log')
const PORT = process.env.BACKEND_PORT ?? '5000'

const health = async () => {
  try { return (await fetch(`http://localhost:${PORT}/health`)).ok } catch { return false }
}
if (await health()) { console.log('backend already listening on :' + PORT); process.exit(0) }

const out = openSync(LOG, 'a')
const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
  cwd: path.join(ROOT, 'backend'),
  env: { ...process.env, PORT },
  detached: true,
  stdio: ['ignore', out, out],
})
child.unref()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 60; i++) { if (await health()) break; await sleep(500) }
console.log(await health() ? `backend up on :${PORT} (pid ${child.pid}), log: ${LOG}` : `backend FAILED to start, see ${LOG}`)
process.exit((await health()) ? 0 : 1)