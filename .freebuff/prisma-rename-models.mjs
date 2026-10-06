// One-shot codemod: turn raw `prisma db pull` output into an ergonomic schema.
//  1. model <table_snake>  ->  model <PascalSingular>, pinned with @@map("<table>")
//  2. rename type-position references to those models / enums
//  3. rename the FK relation fields Prisma auto-generates
//     (barbers_barber_assignment_history_previous_barber_idTobarbers -> previousBarber)
// Idempotent enough to re-run: always start from a fresh `prisma db pull`.
// Correctness is enforced by `prisma validate` immediately after.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../backend/prisma/schema.prisma', import.meta.url)
const src = readFileSync(FILE, 'utf8')

const MODELS = {
  admins: 'Admin',
  appointments: 'Appointment',
  barber_assignment_history: 'BarberAssignmentHistory',
  barber_availability: 'BarberAvailability',
  barber_earnings: 'BarberEarning',
  barber_notifications: 'BarberNotification',
  barber_services: 'BarberService',
  barbers: 'Barber',
  checkout_sessions: 'CheckoutSession',
  commission_rate_history: 'CommissionRateHistory',
  contact_messages: 'ContactMessage',
  contact_replies: 'ContactReply',
  customer_otps: 'CustomerOtp',
  customers: 'Customer',
  gallery: 'Gallery',
  payment_settings: 'PaymentSetting',
  payments: 'Payment',
  reviews: 'Review',
  services: 'Service',
}
const ENUMS = {
  appointments_status: 'AppointmentStatus',
  barber_assignment_history_action: 'BarberAssignmentHistoryAction',
  barber_earnings_barber_type_snapshot: 'BarberTypeSnapshot',
  barber_earnings_commission_type: 'CommissionType',
  barber_earnings_status: 'BarberEarningStatus',
  barber_notifications_type: 'BarberNotificationType',
  barbers_barber_type: 'BarberType',
  barbers_commission_type: 'BarberCommissionType',
  checkout_sessions_payment_method: 'CheckoutPaymentMethod',
  checkout_sessions_status: 'CheckoutSessionStatus',
  commission_rate_history_commission_type: 'RateHistoryCommissionType',
  contact_messages_status: 'ContactMessageStatus',
  contact_replies_status: 'ContactReplyStatus',
  customer_otps_purpose: 'CustomerOtpPurpose',
  gallery_category: 'GalleryCategory',
  payments_payment_method: 'PaymentMethod',
  payments_status: 'PaymentStatus',
}
const NAMES = { ...MODELS, ...ENUMS }
const pascal = (snake) => snake.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join('')

let out = src
const renamedModels = []
const renamedEnums = []
const renamedRelations = []

// ---- 1. model / enum blocks ----------------------------------------------
for (const [table, model] of Object.entries(MODELS)) {
  const re = new RegExp(String.raw`^model ${table} \{$`, 'm')
  if (!re.test(out)) throw new Error(`model ${table} not found`)
  out = out.replace(re, `model ${model} {`)
  renamedModels.push(`${table} -> ${model}`)
}
for (const [table, model] of Object.entries(ENUMS)) {
  const re = new RegExp(String.raw`^enum ${table} \{$`, 'm')
  if (!re.test(out)) throw new Error(`enum ${table} not found`)
  out = out.replace(re, `enum ${model} {`)
  renamedEnums.push(`${table} -> ${model}`)
}

// ---- 2. type-position references ------------------------------------------
// Rewrite ONLY the type token of a field declaration, so a field that shares a
// name with a model (`services services`) keeps its own accessor name.
// The attribute group must stay optional: db pull does not pad the last field of
// a block, so `barber_assignment_history[]` at end-of-line has nothing after it.
const declRe = /^(\s+)(\w+)(\s+)((?:[A-Za-z_]\w*)(?:\[\])?[?!]?)(?:(\s+)(@.*))?$/gm
out = out.replace(declRe, (line, ws, field, g1, type, g2, attrs) => {
  const bare = type.replace(/(\[\])?[?!]?$/, '')
  const suffix = type.slice(bare.length)
  const to = NAMES[bare]
  return to ? `${ws}${field}${g1}${to}${suffix}${g2 || ''}${attrs || ''}` : line
})

// ---- 3. auto-generated FK relation field names -----------------------------
// Prisma names a FK relation `<owner>_<fk>_idT<target>`. Rename both ends.
const BACKREFS = {
  barber_assignment_history_barber_assignment_history_previous_barber_idTobarbers: 'previousBarberAssignments',
  barber_assignment_history_barber_assignment_history_new_barber_idTobarbers: 'newBarberAssignments',
}
// owning side: derive from the FK column in @relation("...", fields: [fk])
const relRe = /^(\s+)(\w*_idT\w+)(\s+)(\S+)(\[\])?(\?)?(\s+)@relation\("([^"]+)",\s*fields:\s*\[(\w+)\]/gm
out = out.replace(relRe, (line, ws, oldField, g1, type, arr, opt, g2, relName, fk) => {
  let name = BACKREFS[oldField]
  if (!name) {
    const base = fk.replace(/_id$/, '')
    name = base.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join('')
    name = name[0].toLowerCase() + name.slice(1)
  }
  renamedRelations.push(`${oldField} -> ${name}`)
  return `${ws}${name}${g1}${type}${arr || ''}${opt || ''}${g2}@relation("${relName}", fields: [${fk}]`
})
// inverse side: no `fields:` (it owns no FK), so name it explicitly
const backRe = /^(\s+)(\w*_idT\w+)(\s+)(\S+)(\[\])?(\?)?(\s+)(@relation\("[^"]+"\)\s*)$/gm
out = out.replace(backRe, (line, ws, oldField, g1, type, arr, opt, g2, attrs) => {
  const name = BACKREFS[oldField]
  if (!name) return line
  renamedRelations.push(`${oldField} -> ${name}`)
  return `${ws}${name}${g1}${type}${arr || ''}${opt || ''}${g2}${attrs}`
})

// ---- 4. pin physical table names with @@map -------------------------------
out = out.split(/\n(?=model |enum |\/\/)/).map((block) => {
  const m = block.match(/^model (\w+) \{$/m)
  if (!m) return block
  const model = m[1]
  const table = Object.entries(MODELS).find(([, v]) => v === model)?.[0]
  if (!table) return block
  if (/@@map\(/.test(block)) return block
  const close = block.lastIndexOf('\n}')
  if (close < 0) return block
  return `${block.slice(0, close)}\n\n  @@map("${table}")${block.slice(close)}`
}).join('\n')

// ---- 5. camelCase every scalar/enum column field, pinned with @map --------
// Critical for API compatibility: Sequelize exposes attributes as camelCase, so
// the API returns `createdAt`. Prisma would otherwise use the raw column name
// (`created_at`) and silently break every frontend payload. @map keeps the
// physical column and restores the camelCase accessor the frontend already uses.
const SCALARS = new Set(['Int', 'String', 'DateTime', 'Boolean', 'Decimal', 'Float', 'Json', 'Bytes', 'BigInt'])
const ENUM_SET = new Set(Object.values(ENUMS))
const camel = (snake) => {
  const p = snake.split('_').map((x) => x[0].toUpperCase() + x.slice(1)).join('')
  return p[0].toLowerCase() + p.slice(1)
}
const renamedFields = []
out = out
  .split('\n')
  .map((line) => {
    const m = line.match(/^(\s+)([a-z][a-z0-9]*(?:_[a-z0-9]+)+)(\s+)(\S+?)(?:(\s+)(@.*))?$/)
    if (!m) return line
    const [, ws, oldName, gap, type, , attrs] = m
    const bare = type.replace(/(\[\])?[?!]?$/, '')
    // A field is a relation only when its type names a model. Nullability (`?`)
    // and arrays (`[]`) say nothing about scalar vs relation — `Int?` is a scalar.
    if (MODELS[bare]) return line
    if (!SCALARS.has(bare) && !ENUM_SET.has(bare)) return line
    if (attrs && /@map\(/.test(attrs)) return line
    const newName = camel(oldName)
    renamedFields.push(`${oldName} -> ${newName}`)
    return attrs ? `${ws}${newName}${gap}${type}${attrs} @map("${oldName}")` : `${ws}${newName}${gap}${type} @map("${oldName}")`
  })
  .join('\n')

// ---- 6. repoint @relation(fields:/references:) at the renamed fields -------
// Step 5 renamed the scalar fields, so the FK lists inside @relation must follow.
const camelName = (s) => camel(s)
let repointed = 0
out = out.replace(/\b(fields|references):\s*\[([^\]]*)\]/g, (all, key, body) => {
  const parts = body.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) return all
  const next = parts.map((p) => {
    const mapped = camelName(p)
    if (mapped !== p) repointed++
    return mapped
  })
  return `${key}: [${next.join(', ')}]`
})

// ---- 7. repoint @@index / @@unique at the renamed fields -------------------
let reindexed = 0
out = out.replace(/@@(index|unique)\(\[([^\]]*)\]/g, (all, kind, body) => {
  const parts = body.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) return all
  const next = parts.map((p) => {
    const mapped = camelName(p)
    if (mapped !== p) reindexed++
    return mapped
  })
  return `@@${kind}([${next.join(', ')}]`
})

writeFileSync(FILE, out, 'utf8')
console.log(`models renamed : ${renamedModels.length}`)
console.log(`enums renamed  : ${renamedEnums.length}`)
console.log(`relations fixed : ${renamedRelations.length}`)
console.log(`fields camelized: ${renamedFields.length}`)
console.log(`relation FKs repointed: ${repointed}`)
console.log(`index entries repointed: ${reindexed}`)
