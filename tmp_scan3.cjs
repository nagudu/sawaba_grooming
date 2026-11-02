const fs = require('fs')
const files = [
  'backend/src/services/paymentService.ts',
  'backend/src/services/shopPaymentService.ts',
  'backend/src/services/shopService.ts',
  'backend/src/services/customerService.ts',
  'backend/src/services/barberAuthService.ts',
  'backend/src/services/vendorService.ts',
]
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const lines = s.split(/\r?\n/)
  console.log('==== ' + f)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (
      /PAYMENT_REJECTED|PENDING_VERIFICATION|REJECTED|markPaymentCancelled|refund|Refund|cancelled|Cancelled|CANCELLED|delete|welcome|Welcome|register/i.test(
        l,
      )
    ) {
      console.log((i + 1) + ': ' + l)
    }
  }
}
