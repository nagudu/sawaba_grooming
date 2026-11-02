async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sawabasalon.com', password: 'ChangeMe123!' }),
  })
  const loginBody = await loginRes.json()
  const token = loginBody?.data?.token
  const getRes = await fetch('http://localhost:5000/api/admin/payment-settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log('GET status', getRes.status)
  console.log(await getRes.text())
  const putRes = await fetch('http://localhost:5000/api/admin/payment-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      shopName: 'SAWABA Grooming Studio',
      shopPhone: '+234 706 928 8456',
      bankName: 'ZENITH BANK',
      accountName: 'JAMILU SALISU',
      accountNumber: '4206046873',
      opayAccountName: 'SAWABA Grooming Studio & GENERAL ENTERPRISES',
      opayAccountNumber: '6468362545',
      paymentInstructions: 'Transfer the exact service amount and upload your payment receipt. Kindly use your appointment ID as the transfer reference where possible.',
      enabledPaymentMethods: ['ONLINE', 'OPAY', 'BANK_TRANSFER', 'CASH'],
      minAmount: 500,
      fullPaymentRequired: true,
      receiptRequired: true,
    }),
  })
  console.log('PUT status', putRes.status)
  console.log(await putRes.text())
}
run().catch((e) => console.log('ERR ' + e.toString()))
