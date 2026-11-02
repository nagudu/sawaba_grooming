const fs = require('fs')
const files = ['backend/src/routes/customerAuth.ts', 'backend/src/routes/barberAuth.ts', 'backend/src/controllers/customerAuthController.ts']
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const lines = s.split(/\r?\n/)
  console.log('==== ' + f)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/register|signup|createCustomer|findOrCreateCustomer|authService|export async function|export const/i.test(l)) {
      console.log((i + 1) + ': ' + l)
    }
  }
}
