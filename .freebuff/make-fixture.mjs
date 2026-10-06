// Generates .freebuff/qa-receipt.png (a real 1x1 PNG) used by the booking
// batteries that upload a payment receipt. Idempotent.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const OUT = path.join(import.meta.dirname, 'qa-receipt.png')
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
writeFileSync(OUT, Buffer.from(PNG_1x1, 'base64'))
console.log('wrote', OUT)