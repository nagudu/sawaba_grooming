// Static sweep: collect every `to="..."` / href="/..." target in src/ and
// check it against the routes registered in src/App.tsx.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (['.tsx', '.ts'].includes(extname(p))) files.push(p)
  }
}
walk('src')

const appTsx = readFileSync('src/App.tsx', 'utf8')
const routePaths = [...appTsx.matchAll(/path="([^"]*)"/g)].map((m) => m[1])

// Resolve relative route paths under their parent routes is complex; instead
// collect the full set of concrete routes by simple concatenation for the
// nested groups (admin/account/barber) as written in App.tsx.
const fullRoutes = new Set()
for (const r of routePaths) {
  if (r.startsWith('/admin')) fullRoutes.add(r)
  else if (r.startsWith('/account')) fullRoutes.add(r)
  else if (r.startsWith('/barber/')) fullRoutes.add(r)
  else if (r === '/barber') fullRoutes.add(r)
  else if (r.startsWith('/')) fullRoutes.add(r)
}
// nested children written without leading slash
const nested = [
  '/admin/appointments', '/admin/payments', '/admin/payment-settings',
  '/admin/appearance', '/admin/services', '/admin/barbers', '/admin/barber-earnings',
  '/admin/gallery', '/admin/reviews', '/admin/contacts', '/admin/customers', '/admin/profile',
  '/account/bookings', '/account/payments', '/account/profile',
  '/barber/appointments', '/barber/day-view', '/barber/earnings', '/barber/notifications', '/barber/availability',
]
nested.forEach((n) => fullRoutes.add(n))

const targets = new Map()
const linkRe = /(?:\bto=|href=)\{?["'`]([^"'`]+)["'`]\}?/g
for (const f of files) {
  if (f.includes('App.tsx')) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(linkRe)) {
    const t = m[1]
    if (!t.startsWith('/') || t.startsWith('//') || t.startsWith('/api')) continue
    if (!targets.has(t)) targets.set(t, new Set())
    targets.get(t).add(f.replace(/\\/g, '/'))
  }
}

function matches(route, target) {
  if (route === target) return true
  // wildcard / param segments
  const rp = route.split('/')
  const tp = target.split('/')
  if (rp.length !== tp.length) return false
  return rp.every((seg, i) => seg.startsWith(':') || seg === tp[i])
}

const dead = []
for (const [t, where] of targets) {
  if (t.includes(':') || t.includes('${')) continue // dynamic — skip
  const ok = [...fullRoutes].some((r) => matches(r, t))
  if (!ok) dead.push(`${t}   <- ${[...where].join(', ')}`)
}

console.log('Routes registered:', fullRoutes.size)
console.log('Distinct link targets:', targets.size)
console.log(dead.length ? 'DEAD LINKS:\n' + dead.join('\n') : 'No dead static links found.')
