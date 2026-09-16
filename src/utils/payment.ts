import type { PaymentMethod, PaymentStatus } from '../api'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Payment Required',
  PENDING_VERIFICATION: 'Awaiting Verification',
  PAID: 'Paid & Verified',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  OPAY: 'OPay',
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  OTHER: 'Other',
  ONLINE: 'Online Payment',
}