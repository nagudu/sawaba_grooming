const fs = require('fs')
const s = fs.readFileSync('backend/prisma/schema.prisma', 'utf8')
const lines = s.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (/^model Customer /.test(lines[i]) || lines[i].startsWith('model Customer ')) {
    console.log(i + ': ' + lines[i])
  }
}
const j = lines.map((l, i) => [i + 1, l]).filter(([n, l]) => /notification|Notification|optOut|opt_out|preferred|OptOut|Customer/.test(l))
for (const [n, l] of j) console.log(n + ': ' + l)
