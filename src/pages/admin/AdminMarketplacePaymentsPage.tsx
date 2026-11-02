import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Receipt,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react'
import {
  EmptyRow,
  PageHeader,
  StatCard,
  StatusBadge,
  Td,
  Th,
} from '../../components/admin/AdminUI'
import Modal from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useDebounced } from '../../hooks/useDebounced'
import { formatDate, formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'
import { marketplaceAdminApi, type AdminOrder } from '../../api/marketplaceAdmin'

const TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All payments' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
  { value: 'PAID', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected proofs' },
  { value: 'UNPAID', label: 'Awaiting payment' },
]

const METHOD_LABELS: Record<string, string> = {
  ONLINE: 'Paystack',
  OPAY: 'OPay',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash on delivery',
}

function methodLabel(method: string | null): string {
  if (!method) return '—'
  return METHOD_LABELS[method] ?? method.replace(/_/g, ' ')
}

interface Counts {
  pending: number
  verified: number
  rejected: number
  unpaid: number
}

/**
 * Marketplace payment queue. Every shop order payment lands here; transfer and
 * OPay proofs are only confirmed after an admin checks the bank statement.
 */
export default function AdminMarketplacePaymentsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [counts, setCounts] = useState<Counts>({ pending: 0, verified: 0, rejected: 0, unpaid: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [active, setActive] = useState<AdminOrder | null>(null)
  const [verifying, setVerifying] = useState<AdminOrder | null>(null)
  const [verifyNote, setVerifyNote] = useState('')
  const [rejecting, setRejecting] = useState<AdminOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const perPage = 15
  const debouncedSearch = useDebounced(search.trim(), 300)

  const load = useCallback(
    async (targetPage = page) => {
      setLoading(true)
      try {
        const data = await marketplaceAdminApi.orders({
          paymentStatus: status || undefined,
          search: debouncedSearch || undefined,
          // The API has no method filter, so a method-scoped view pulls one
          // page and filters locally instead of paginating a partial list.
          page: method ? 1 : targetPage,
          perPage: method ? 100 : perPage,
        })
        const filtered = method
          ? data.items.filter((order) => (order.paymentMethod ?? '') === method)
          : data.items
        setOrders(filtered)
        setTotal(method ? filtered.length : data.total)
        setPage(method ? 1 : data.page)
      } catch (error) {
        notifyError(error)
      } finally {
        setLoading(false)
      }
    },
    [status, debouncedSearch, method, page, perPage, notifyError],
  )

  const loadCounts = useCallback(async () => {
    try {
      const [pending, verified, rejected, unpaid] = await Promise.all([
        marketplaceAdminApi.orders({ paymentStatus: 'PENDING_VERIFICATION', perPage: 1 }),
        marketplaceAdminApi.orders({ paymentStatus: 'PAID', perPage: 1 }),
        marketplaceAdminApi.orders({ paymentStatus: 'REJECTED', perPage: 1 }),
        marketplaceAdminApi.orders({ paymentStatus: 'UNPAID', perPage: 1 }),
      ])
      setCounts({
        pending: pending.total,
        verified: verified.total,
        rejected: rejected.total,
        unpaid: unpaid.total,
      })
    } catch (error) {
      notifyError(error)
    }
  }, [notifyError])

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearch, method])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  const pendingValue = useMemo(
    () =>
      orders
        .filter((order) => order.paymentStatus === 'PENDING_VERIFICATION')
        .reduce((sum, order) => sum + order.totalAmount, 0),
    [orders],
  )

  const doVerify = async () => {
    if (!verifying) return
    setBusy(true)
    try {
      await marketplaceAdminApi.verifyOrderPayment(
        verifying.referenceCode,
        verifyNote.trim() || 'Verified against the bank statement by an administrator.',
      )
      showToast(`${verifying.referenceCode} marked paid. Commission ledger created.`)
      setVerifying(null)
      setVerifyNote('')
      void load(page)
      void loadCounts()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const doReject = async () => {
    if (!rejecting) return
    if (rejectReason.trim().length < 5) {
      showToast('Please give a reason (at least 5 characters) so the customer can fix it.', 'error')
      return
    }
    setBusy(true)
    try {
      await marketplaceAdminApi.rejectOrderPayment(rejecting.referenceCode, rejectReason.trim())
      showToast(`${rejecting.referenceCode} payment proof rejected — the customer can retry.`)
      setRejecting(null)
      setRejectReason('')
      void load(page)
      void loadCounts()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div>
      <PageHeader
        title="Shop Payments"
        subtitle="Every marketplace payment — verify transfer and OPay proofs against the bank statement before confirming."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting verification"
          value={counts.pending}
          icon={<Clock className="h-5 w-5" />}
          accent
        />
        <StatCard
          label="Verified payments"
          value={counts.verified}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Rejected proofs"
          value={counts.rejected}
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting payment"
          value={counts.unpaid}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="field-icon h-4 w-4" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, customer, phone or transaction reference…"
            className="field pl-11"
          />
        </div>
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          aria-label="Filter by payment method"
          className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none"
        >
          <option value="">All methods</option>
          {Object.entries(METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              status === tab.value
                ? 'border-gold-500/60 bg-gold-500/10 text-gold-300'
                : 'border-night-700 text-night-300 hover:border-gold-500/40',
            )}
          >
            {tab.label}
          </button>
        ))}
        {status === 'PENDING_VERIFICATION' && orders.length > 0 && (
          <span className="ml-auto self-center text-xs text-night-400">
            Under review on this page: <span className="font-semibold text-gold-300">{formatPrice(pendingValue)}</span>
          </span>
        )}
      </div>

      <div className="card-lux overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading payments" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th>Status</Th>
                  <Th>Verified</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {orders.length === 0 ? (
                  <EmptyRow colSpan={8} message="No payments match these filters." />
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="text-sm">
                      <Td>
                        <button
                          type="button"
                          onClick={() => setActive(order)}
                          className="font-mono text-xs font-semibold text-gold-300 hover:underline"
                        >
                          {order.referenceCode}
                        </button>
                        <p className="text-[11px] text-night-500">{formatDate(order.createdAt.slice(0, 10))}</p>
                      </Td>
                      <Td>
                        <p className="text-night-100">{order.customerName}</p>
                        <p className="text-xs text-night-500">{order.customerPhone}</p>
                      </Td>
                      <Td className="text-right font-semibold text-night-100">
                        {formatPrice(order.totalAmount)}
                      </Td>
                      <Td className="text-night-300">{methodLabel(order.paymentMethod)}</Td>
                      <Td>
                        <p className="max-w-[160px] truncate font-mono text-xs text-night-300">
                          {order.transactionRef ?? '—'}
                        </p>
                        {order.receiptUrl && (
                          <a
                            href={order.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 underline"
                          >
                            <Receipt className="h-3 w-3" /> Receipt
                          </a>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={order.paymentStatus} />
                        {order.paymentNote && (
                          <p className="mt-1 max-w-[180px] truncate text-[11px] text-rose-300" title={order.paymentNote}>
                            {order.paymentNote}
                          </p>
                        )}
                      </Td>
                      <Td className="text-xs text-night-400">
                        {order.paymentVerifiedAt ? (
                          <>
                            <p>{formatDate(order.paymentVerifiedAt.slice(0, 10))}</p>
                            <p className="text-night-500">{order.paymentVerifiedByName ?? 'Administrator'}</p>
                          </>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActive(order)}
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                            aria-label="View payment"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          {order.paymentStatus === 'PENDING_VERIFICATION' && (
                            <>
                              <Button variant="gold" size="sm" onClick={() => setVerifying(order)}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setRejecting(order)}>
                                <XCircle className="h-3.5 w-3.5" /> Reject
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

        {!method && totalPages > 1 && (
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

      <Modal open={Boolean(active)} onClose={() => setActive(null)} size="lg" title={active ? `Payment · ${active.referenceCode}` : ''}>
        {active && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={active.paymentStatus} />
              <span className="text-sm text-night-400">{methodLabel(active.paymentMethod)}</span>
              <span className="ml-auto font-display text-2xl text-gold-400">{formatPrice(active.totalAmount)}</span>
            </div>
            <dl className="grid gap-3 rounded-xl border border-night-800 bg-night-900/60 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Customer</dt>
                <dd className="mt-1 text-night-100">{active.customerName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Phone</dt>
                <dd className="mt-1 text-night-100">{active.customerPhone}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Email</dt>
                <dd className="mt-1 text-night-100">{active.customerEmail ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Order status</dt>
                <dd className="mt-1 text-night-100">{active.status.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Transaction reference</dt>
                <dd className="mt-1 font-mono text-xs text-night-200">{active.transactionRef ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Payment attempts</dt>
                <dd className="mt-1 text-night-100">{active.paymentAttempts}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Verified at</dt>
                <dd className="mt-1 text-night-100">
                  {active.paymentVerifiedAt ? new Date(active.paymentVerifiedAt).toLocaleString('en-GB') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Verified by</dt>
                <dd className="mt-1 text-night-100">{active.paymentVerifiedByName ?? '—'}</dd>
              </div>
            </dl>
            {active.paymentNote && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <span className="font-semibold">Note / rejection reason:</span> {active.paymentNote}
              </p>
            )}
            {active.receiptUrl ? (
              <a
                href={active.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gold-400 underline"
              >
                <Receipt className="h-4 w-4" /> Open uploaded receipt
              </a>
            ) : (
              <p className="text-xs text-night-500">No receipt was uploaded for this order.</p>
            )}
            <div className="overflow-hidden rounded-xl border border-night-800">
              <table className="w-full">
                <thead className="border-b border-night-800 bg-night-950/60">
                  <tr>
                    <Th>Item</Th>
                    <Th>Vendor</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Line total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800 text-sm">
                  {active.items.map((item) => (
                    <tr key={item.id}>
                      <Td>{item.productName}</Td>
                      <Td className="text-night-400">{item.vendorName}</Td>
                      <Td className="text-right">{item.quantity}</Td>
                      <Td className="text-right">{formatPrice(item.lineTotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {active.paymentStatus === 'PENDING_VERIFICATION' && (
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setRejecting(active)
                    setActive(null)
                  }}
                >
                  <XCircle className="h-4 w-4" /> Reject proof
                </Button>
                <Button
                  variant="gold"
                  size="md"
                  onClick={() => {
                    setVerifying(active)
                    setActive(null)
                  }}
                >
                  <ShieldCheck className="h-4 w-4" /> Verify & mark paid
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={verifying !== null}
        onClose={() => setVerifying(null)}
        size="md"
        title={`Verify payment · ${verifying?.referenceCode ?? ''}`}
      >
        {verifying && (
          <div>
            <p className="text-sm text-night-300">
              Confirm that <span className="font-bold text-gold-300">{formatPrice(verifying.totalAmount)}</span> from{' '}
              {verifying.customerName} is in the studio account. Only verify after checking the bank statement — an
              uploaded receipt alone is not proof of payment.
            </p>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Verification note (optional)
              </span>
              <input
                type="text"
                value={verifyNote}
                onChange={(event) => setVerifyNote(event.target.value)}
                placeholder="e.g. Matches Zenith credit alert of 21 Oct."
                className="field"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => setVerifying(null)}>
                Cancel
              </Button>
              <Button variant="gold" size="md" loading={busy} onClick={() => void doVerify()}>
                <CheckCircle2 className="h-4 w-4" /> Confirm payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        size="md"
        title={`Reject payment proof · ${rejecting?.referenceCode ?? ''}`}
      >
        <div>
          <p className="text-sm text-night-400">
            The customer stays on the payment step and can upload a new proof. Explain clearly what was wrong.
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
              Reason (shown to the customer)
            </span>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. The amount transferred was ₦1,000 short and the receipt is unreadable."
              className="field resize-none"
            />
          </label>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="dark" size="md" loading={busy} onClick={() => void doReject()}>
              Reject proof
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
