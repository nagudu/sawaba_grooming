import { useEffect, useState } from 'react'
import { RefreshCw, RotateCcw, ScanLine, ShieldOff, QrCode } from 'lucide-react'
import {
  qrApi,
  type QrActivityStats,
  type QrScanLogItem,
} from '../../api/qr'
import {
  ConfirmDialog,
  EmptyRow,
  PageHeader,
  StatCard,
  StatusBadge,
  Td,
  Th,
} from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { cn } from '../../utils/cn'

const OUTCOME_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All outcomes' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'VALID', label: 'Valid scans' },
  { value: 'ALREADY_CHECKED_IN', label: 'Duplicate' },
  { value: 'PAYMENT_NOT_VERIFIED', label: 'Payment not verified' },
  { value: 'PAYMENT_MISMATCH', label: 'Payment mismatch' },
  { value: 'UNAUTHORIZED', label: 'Unauthorized' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NOT_FOUND', label: 'Not found' },
  { value: 'INVALID_TOKEN', label: 'Invalid code' },
]

const SOURCE_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All sources' },
  { value: 'QR', label: 'QR scan' },
  { value: 'MANUAL', label: 'Manual lookup' },
  { value: 'ADMIN', label: 'Admin action' },
]

const OUTCOME_BADGE: Record<string, string> = {
  CHECKED_IN: 'CHECKED_IN',
  VALID: 'PAID',
  ALREADY_CHECKED_IN: 'IN_PROGRESS',
  PAYMENT_NOT_VERIFIED: 'PENDING',
  PAYMENT_MISMATCH: 'PAYMENT_REJECTED',
  REVOKED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  UNAUTHORIZED: 'PAYMENT_REJECTED',
  NOT_FOUND: 'UNPAID',
  INVALID_TOKEN: 'UNPAID',
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminQrPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [items, setItems] = useState<QrScanLogItem[]>([])
  const [stats, setStats] = useState<QrActivityStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [outcome, setOutcome] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [regenerating, setRegenerating] = useState<QrScanLogItem | null>(null)
  const [revoking, setRevoking] = useState<QrScanLogItem | null>(null)

  const perPage = 15

  const load = async (targetPage = page, targetOutcome = outcome, targetSource = source) => {
    setLoading(true)
    try {
      const data = await qrApi.activity({
        page: targetPage,
        perPage,
        outcome: targetOutcome || undefined,
        source: targetSource || undefined,
      })
      setItems(data.items)
      setStats(data.stats)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, outcome, source)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, source])

  const doRegenerate = async () => {
    if (!regenerating?.appointmentId) return
    setBusy(true)
    try {
      await qrApi.regenerate(regenerating.appointmentId)
      showToast('New QR generated. The previous code no longer works.')
      setRegenerating(null)
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const doRevoke = async () => {
    if (!revoking?.appointmentId) return
    setBusy(true)
    try {
      await qrApi.revoke(revoking.appointmentId)
      showToast('QR code revoked.')
      setRevoking(null)
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const selectClass =
    'rounded-lg border border-night-700 bg-night-900 px-3 py-2 text-sm text-night-200 focus:border-gold-500/60 focus:outline-none'

  return (
    <div>
      <PageHeader
        title="QR Check-in Oversight"
        subtitle="Audit every QR scan, payment verification and customer check-in across the salon."
        icon={<QrCode className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => void load(page)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total scans" value={stats.total} icon={<ScanLine className="h-5 w-5" />} />
          <StatCard label="Valid" value={stats.valid} icon={<QrCode className="h-5 w-5" />} accent />
          <StatCard label="Rejected" value={stats.rejected} icon={<ShieldOff className="h-5 w-5" />} />
          <StatCard label="Check-ins" value={stats.checkIns} icon={<ScanLine className="h-5 w-5" />} />
          <StatCard label="Last 7 days" value={stats.last7Days} icon={<RefreshCw className="h-5 w-5" />} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOME_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card-lux overflow-hidden">
        <div className="flex items-center justify-between border-b border-night-800 px-6 py-4">
          <h2 className="font-display text-lg text-night-50">
            {total} scan{total === 1 ? '' : 's'}
          </h2>
          <span className="text-xs text-night-500">
            Page {page} of {totalPages}
          </span>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading scan activity" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>When</Th>
                  <Th>Outcome</Th>
                  <Th>Source</Th>
                  <Th>Booking</Th>
                  <Th>Actor</Th>
                  <Th>Detail</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {items.length === 0 ? (
                  <EmptyRow colSpan={7} message="No QR scan activity yet." />
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <p className="whitespace-nowrap text-night-200">{formatTimestamp(item.createdAt)}</p>
                        {item.ip && <p className="text-xs text-night-500">{item.ip}</p>}
                      </Td>
                      <Td>
                        <StatusBadge status={OUTCOME_BADGE[item.outcome] ?? item.outcome} label={item.outcome} />
                      </Td>
                      <Td>
                        <span className="text-xs font-semibold uppercase tracking-wider text-night-400">
                          {item.source}
                        </span>
                      </Td>
                      <Td>
                        <p className="font-mono text-xs text-night-200">
                          {item.referenceCode ?? (item.appointmentId ? `#${item.appointmentId}` : '—')}
                        </p>
                        {item.customerName && (
                          <p className="text-xs text-night-500">{item.customerName}</p>
                        )}
                      </Td>
                      <Td>
                        {item.barberName ? (
                          <p className="text-night-200">{item.barberName}</p>
                        ) : item.adminId ? (
                          <p className="text-night-200">Admin #{item.adminId}</p>
                        ) : (
                          <p className="text-night-500">—</p>
                        )}
                      </Td>
                      <Td>
                        <p className="max-w-[240px] text-xs text-night-400">{item.detail ?? '—'}</p>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          {item.appointmentId && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRegenerating(item)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Regenerate
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRevoking(item)}
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-night-800 bg-night-900/40 px-6 py-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
              Previous
            </Button>
            <span className="px-2 text-sm text-night-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={regenerating !== null}
        onClose={() => setRegenerating(null)}
        onConfirm={doRegenerate}
        busy={busy}
        confirmLabel="Regenerate QR"
        title="Regenerate QR code?"
        description={`A new check-in QR will be issued for ${
          regenerating?.referenceCode ?? `appointment #${regenerating?.appointmentId}`
        }. The customer's existing code will stop working immediately.`}
      />

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={doRevoke}
        busy={busy}
        confirmLabel="Revoke QR"
        title="Revoke QR code?"
        description={`The check-in QR for ${
          revoking?.referenceCode ?? `appointment #${revoking?.appointmentId}`
        } will be disabled. The customer will be unable to check in until a new code is issued.`}
      />
    </div>
  )
}
