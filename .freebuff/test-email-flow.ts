import net from 'node:net'
import { ContactMessage, ContactReply } from '../backend/src/models'
import { sendContactReply } from '../backend/src/services/contactService'

/**
 * Success-path test: runs a minimal local SMTP server (the "email provider"),
 * then drives the REAL contactService.sendContactReply against it.
 * SMTP_* env vars must point at the stub (set by the shell invocation).
 */

let pass = 0
let fail = 0
const check = (n: string, c: boolean, d = '') => {
  if (c) { pass++; console.log(`  PASS  ${n}`) } else { fail++; console.log(`  FAIL  ${n} ${d}`) }
}

const smtp = net.createServer((socket) => {
  socket.write('220 test.local ESMTP stub\r\n')
  let inData = false
  let buffer = ''
  socket.on('data', (chunk) => {
    buffer += chunk.toString()
    if (inData) {
      if (buffer.includes('\r\n.\r\n')) {
        const body = buffer.split('\r\n.\r\n')[0]
        process.env.__SMTP_CAPTURE__ = body
        ;(global as unknown as { __SMTP_BODY__?: string }).__SMTP_BODY__ = body
        buffer = ''
        inData = false
        socket.write('250 Queued as TEST123456\r\n')
      }
      return
    }
    const lines = buffer.split('\r\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const cmd = line.toUpperCase()
      if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
        socket.write('250-test.local\r\n250 SIZE 10485760\r\n')
      } else if (cmd.startsWith('MAIL FROM') || cmd.startsWith('RCPT TO')) {
        socket.write('250 OK\r\n')
      } else if (cmd.startsWith('DATA')) {
        inData = true
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
      } else if (cmd.startsWith('QUIT')) {
        socket.write('221 Bye\r\n')
        socket.end()
      } else {
        socket.write('250 OK\r\n')
      }
    }
  })
})

async function main() {
  await new Promise<void>((resolve) => smtp.listen(2525, '127.0.0.1', resolve))
  console.log('[test] SMTP stub listening on 127.0.0.1:2525')

  const message = await ContactMessage.create({
    name: 'Real Delivery Test',
    email: 'customer.real@example.com',
    subject: 'Haircut Prices',
    message: 'I want to know your haircut prices.',
    phone: null,
    isRead: false,
    status: 'READ',
  })

  const result = await sendContactReply({
    contactMessageId: message.id,
    adminId: null,
    adminName: 'SAWABA Admin',
    message: 'Our current haircut prices start from ₦5,000. You can also book through our website.',
  })

  const body = (global as unknown as { __SMTP_BODY__?: string }).__SMTP_BODY__ ?? ''

  check('email provider ACCEPTED the message (receipt returned)', result.email.accepted.includes('customer.real@example.com'), JSON.stringify(result.email))
  check('providerMessageId stored', result.reply.providerMessageId !== null && result.reply.providerMessageId.length > 0, String(result.reply.providerMessageId))
  check('reply status SENT', result.reply.status === 'SENT')
  check('sentAt recorded', result.reply.sentAt !== null)
  check('message status REPLIED', result.contact.status === 'REPLIED')
  check('email body contains recipient', body.includes('customer.real@example.com') || body.includes('RCPT'), body.slice(0, 200))
  check('email body contains subject', body.toLowerCase().includes('re: haircut prices'), body.slice(0, 300))
  check('email body contains reply text', body.includes('haircut prices start from'), '')
  check('email body has greeting', body.includes('Hello Real,'), '')

  // Reload from DB to prove persistence
  const stored = await ContactReply.findAll({ where: { contactMessageId: message.id } })
  check('reply persisted in database', stored.length === 1 && stored[0].status === 'SENT')
  check('providerMessageId persisted', stored[0].providerMessageId !== null)

  await message.destroy() // cascades replies
  smtp.close()
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => {
  console.error('RUNNER ERROR', e)
  process.exit(1)
})
