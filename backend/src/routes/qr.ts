import { Router } from 'express'
import { requireAdmin } from '../middleware/auth'
import { requireBarber } from '../middleware/barberAuth'
import { validate } from '../middleware/validate'
import { qrScanLimiter } from '../middleware/rateLimiter'
import {
  checkInQrHandler,
  listQrActivityHandler,
  regenerateQrHandler,
  revokeQrHandler,
  validateQrHandler,
} from '../controllers/qrController'
import {
  qrActivityQuerySchema,
  qrAppointmentBodySchema,
  qrCheckinBodySchema,
  qrValidateBodySchema,
} from '../validators/qr'

/**
 * Barber scanner endpoints — mounted at /api/barber/portal/qr. Every route is
 * scoped to the authenticated barber (the server derives the barber id from the
 * token; the client never sends it).
 */
export const barberQrRouter = Router()

barberQrRouter.use(requireBarber)
barberQrRouter.use(qrScanLimiter)

barberQrRouter.post('/validate', validate(qrValidateBodySchema), validateQrHandler)
barberQrRouter.post('/checkin', validate(qrCheckinBodySchema), checkInQrHandler)

/**
 * Admin QR oversight — mounted at /api/admin/qr. Read-only activity feed plus
 * token lifecycle controls (regenerate/revoke) for support staff.
 */
export const adminQrRouter = Router()

adminQrRouter.use(requireAdmin)

adminQrRouter.get('/activity', validate(qrActivityQuerySchema, 'query'), listQrActivityHandler)
adminQrRouter.post('/regenerate', validate(qrAppointmentBodySchema), regenerateQrHandler)
adminQrRouter.post('/revoke', validate(qrAppointmentBodySchema), revokeQrHandler)
