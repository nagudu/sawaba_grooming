const fs = require('fs')
const files = [
  'backend/src/services/customerService.ts',
  'backend/src/services/authService.ts',
  'backend/src/services/barberAuthService.ts',
  'backend/src/services/barberService.ts',
]
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const lines = s.split(/\r?\n/)
  console.log('==== ' + f)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/export async function|export function|export interface|export const|function findOrCreate|createCustomer|registerCustomer|signup/i.test(l)) {
      console.log((i + 1) + ': ' + l)
    }
  }
}
