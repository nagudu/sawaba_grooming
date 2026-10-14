/** Shared QR check-in types used by both the barber and admin scanners. */

export type QrOutcome =
  | 'VALID'
  | 'PAYMENT_NOT_VERIFIED'
  | 'PAYMENT_MISMATCH'
  | 'NOT_FOUND'
  | 'REVOKED'
  | 'CANCELLED'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'CHECKED_IN'
  | 'ALREADY_CHECKED_IN'

export type QrPaymentStatus =
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'REJECTED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'NONE'

export interface QrScanPayment {
  id: number
  status: QrPaymentStatus
  amount: number
  method: string | null
  transactionReference: string | null
  receiptUrl: string | null
  note: string | null
  rejectionReason: string | null
  paymentDate: string | null
  verifiedAt: string | null
}

export interface QrScanAppointment {
  id: number
  referenceCode: string | null
  appointmentDate: string
  appointmentTime: string
  totalAmount: number
  status: string
  service: { id: number; name: string; duration: number } | null
  barberName: string | null
  barberId: number | null
  assignedBarberId: number | null
  checkedInAt: string | null
  customerId?: number | null
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
  notes?: string | null
  payment?: QrScanPayment | null
}

export interface QrScanResult {
  outcome: QrOutcome
  valid: boolean
  canCheckIn: boolean
  checkedIn: boolean
  paymentStatus: QrPaymentStatus
  message: string
  appointment: QrScanAppointment | null
  scannedAt: string
}

export interface QrScanHistoryEntry {
  id: number
  outcome: QrOutcome
  source: string
  actorRole: string
  barberName: string | null
  adminId: number | null
  detail: string | null
  createdAt: string
}
