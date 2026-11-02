const fs = require('fs')
const s = fs.readFileSync('backend/src/middleware/validate.ts', 'utf8')
const lines = s.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (/export (async )?function|export const/i.test(lines[i])) console.log((i + 1) + ': ' + lines[i])
}
