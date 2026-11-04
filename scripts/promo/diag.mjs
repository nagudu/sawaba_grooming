import { execSync } from 'node:child_process'

const APP = 'http://localhost:5173'
const API = 'http://localhost:5000'
const SESSION = 'promo-diag'

function ab(cmd) {
  try {
    return execSync(`agent-browser --session ${SESSION} ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
}

async function login(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.9.9' },
    body: JSON.stringify(body),
  })
  return (await response.json()).data?.token
}

function readStorage(key) {
  return ab(`eval "localStorage.getItem('${key}')"`).trim().split('\n').pop()
}

async function main() {
  const vendor = await login('/api/vendor/login', { identifier: 'promo.vendor@sawaba.test', password: 'PromoVendor1!' })
  ab('close')
  ab(`open "${APP}"`)
  ab('wait 1200')
  ab(`eval "localStorage.setItem('sawaba_vendor_token','${vendor}')"`)
  console.log('stored token length:', readStorage('sawaba_vendor_token').replace(/"/g, '').length)

  // In-browser /me call through the Vite proxy.
  ab(`eval "fetch('/api/vendor/me',{headers:{Authorization:'Bearer '+localStorage.getItem('sawaba_vendor_token')}}).then(r=>r.status).then(s=>localStorage.setItem('__me',''+s))"`)
  ab('wait 1200')
  console.log('in-browser /me:', readStorage('__me'))

  ab(`open "${APP}/vendor/products"`)
  ab('wait 3000')
  console.log('url:', ab('get url').trim().split('\n').pop())
  console.log('token after nav length:', readStorage('sawaba_vendor_token').replace(/"/g, '').length)
  console.log('text:', ab('get text body').replace(/\s+/g, ' ').slice(0, 160))
  ab('close')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
