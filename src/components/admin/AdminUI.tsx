import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl text-night-50 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-night-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'card-lux p-5',
        accent && 'border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-transparent',
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl text-night-50">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-night-700 bg-night-900 text-gold-400">
          {icon}
        </span>
      </div>
    </motion.div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-gold-500/40 bg-gold-500/10 text-gold-300',
  PAYMENT_REQUIRED: 'border-gold-500/40 bg-gold-500/10 text-gold-300',
  PAYMENT_SUBMITTED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  PAYMENT_VERIFIED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  PAYMENT_REJECTED: 'border-red-500/40 bg-red-500/10 text-red-300',
  READY_FOR_SERVICE: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  IN_PROGRESS: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  COMPLETED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'border-red-500/40 bg-red-500/10 text-red-300',
  UNPAID: 'border-night-600 bg-night-800 text-night-300',
  REJECTED: 'border-red-500/40 bg-red-500/10 text-red-300',
  REFUNDED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  PAID: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  APPROVED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
}

/** Convert a raw status enum value to a readable label, e.g. PAYMENT_SUBMITTED → Payment Submitted */
function humanizeStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
        STATUS_STYLES[status] ?? 'border-night-600 bg-night-800 text-night-300',
      )}
    >
      {label ?? humanizeStatus(status)}
    </span>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-4 align-middle text-sm text-night-200', className)}>{children}</td>
}

export function EmptyRow({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center text-sm text-night-500">
        {message}
      </td>
    </tr>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-night-300">{description}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="gold"
            size="md"
            onClick={onConfirm}
            loading={busy}
            className="bg-red-500 hover:bg-red-400 shadow-none"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-night-500">{hint}</span>}
    </label>
  )
}