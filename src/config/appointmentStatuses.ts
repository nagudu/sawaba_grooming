import type { AppointmentStatus } from '../api'

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PAYMENT_REQUIRED: 'Payment Required',
  PAYMENT_SUBMITTED: 'Payment Submitted',
  PAYMENT_VERIFIED: 'Payment Verified',
  PAYMENT_REJECTED: 'Payment Rejected',
  READY_FOR_SERVICE: 'Ready for Service',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const STATUS_BADGE_STYLES: Record<AppointmentStatus, string> = {
  PAYMENT_REQUIRED: 'border-gold-500/40 bg-gold-500/10 text-gold-300',
  PAYMENT_SUBMITTED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  PAYMENT_VERIFIED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  PAYMENT_REJECTED: 'border-red-500/40 bg-red-500/10 text-red-300',
  READY_FOR_SERVICE: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  IN_PROGRESS: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  COMPLETED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'border-red-500/40 bg-red-500/10 text-red-300',
}

export const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PAYMENT_REQUIRED: ['PAYMENT_SUBMITTED', 'CANCELLED'],
  PAYMENT_SUBMITTED: ['PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'CANCELLED'],
  PAYMENT_VERIFIED: ['READY_FOR_SERVICE', 'CANCELLED'],
  PAYMENT_REJECTED: ['PAYMENT_SUBMITTED', 'CANCELLED'],
  READY_FOR_SERVICE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function getValidNextStatuses(current: AppointmentStatus): AppointmentStatus[] {
  return VALID_TRANSITIONS[current] ?? []
}

/** All statuses in canonical order — single source for filters/dropdowns. */
export const ALL_APPOINTMENT_STATUSES = Object.keys(VALID_TRANSITIONS) as AppointmentStatus[]

/** Intuitive verb per target status; overrides below handle context-dependent wording. */
const TARGET_ACTION_LABELS: Partial<Record<AppointmentStatus, string>> = {
  PAYMENT_SUBMITTED: 'Submit Payment',
  PAYMENT_VERIFIED: 'Verify Payment',
  PAYMENT_REJECTED: 'Reject Payment',
  READY_FOR_SERVICE: 'Mark Ready for Service',
  IN_PROGRESS: 'Start Service',
  COMPLETED: 'Complete Appointment',
  CANCELLED: 'Cancel Appointment',
}

/** Human action for moving an appointment from one status to another (centralized — no per-page copies). */
export function getStatusActionLabel(from: AppointmentStatus, to: AppointmentStatus): string {
  if (from === 'PAYMENT_REJECTED' && to === 'PAYMENT_SUBMITTED') return 'Resubmit Payment'
  return TARGET_ACTION_LABELS[to] ?? APPOINTMENT_STATUS_LABELS[to]
}

/** Statuses from which an appointment can no longer change. */
export const TERMINAL_STATUSES: AppointmentStatus[] = ['COMPLETED', 'CANCELLED']
