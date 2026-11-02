const fs = require('fs')
const s = fs.readFileSync('backend/src/services/customerAuthService.ts', 'utf8')
const lines = s.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (/export async function registerCustomer|findOrCreateCustomer|createCustomer|welcome|Welcome/i.test(lines[i])) {
    console.log((i + 1) + ': ' + lines[i])
  }
}
