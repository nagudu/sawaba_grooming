const fs = require('fs')
const s = fs.readFileSync('src/App.tsx', 'utf8')
const lines = s.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('path="/admin')) {
    console.log((i + 1) + ': ' + lines[i])
  }
}
