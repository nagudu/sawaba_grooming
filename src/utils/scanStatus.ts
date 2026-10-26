import type { QrPaymentStatus, QrScanResult } from '../api/qrTypes'

/** Customer-facing wording for a scanned payment state (requirement: friendly labels). */
export const QR_PAYMENT_STATUS_LABELS: Record<QrPaymentStatus, string> = {
  UNPAID: 'Payment Pending',
  PENDING_VERIFICATION: 'Payment Pending Verification',
  PAID: 'Payment Verified',
  REJECTED: 'Payment Rejected',
  REFUNDED: 'Payment Refunded',
  CANCELLED: 'Payment Cancelled',
  NONE: 'No Payment',
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PAYMENT_REQUIRED: 'Payment Pending',
  PAYMENT_SUBMITTED: 'Payment Under Review',
  PAYMENT_VERIFIED: 'Booking Confirmed',
  PAYMENT_REJECTED: 'Payment Rejected',
  READY_FOR_SERVICE: 'Booking Confirmed',
  IN_PROGRESS: 'Service In Progress',
  COMPLETED: 'Booking Completed',
  CANCELLED: 'Booking Cancelled',
}

export function qrPaymentStatusLabel(status: QrPaymentStatus): string {
  return QR_PAYMENT_STATUS_LABELS[status] ?? 'Payment Pending'
}

/** Friendly booking state for a scan result, prioritising the check-in state. */
export function qrBookingStatusLabel(result: QrScanResult): string {
  if (result.checkedIn) return 'Checked In'
  const status = result.appointment?.status
  if (status && BOOKING_STATUS_LABELS[status]) return BOOKING_STATUS_LABELS[status]
  return result.valid ? 'Booking Confirmed' : 'Not Confirmed'
}
