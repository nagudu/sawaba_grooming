import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock,
  Coins,
  Lock,
  Percent,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Field, StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import {
  vendorApi,
  type VendorEarnings,
  type VendorPayoutItem,
  type VendorWalletBalances,
} from '../../api/vendor'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const PAYOUT_LABELS: Record<string, string> = {
  REQUESTED: 'Pending',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  REJECTED: 'Rejected',
}

const SETTLEMENT_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  RELEASED: 'Available',
  PAID: 'Paid',
  REVERSED: 'Reversed',
}

const OPEN_STATUSES = ['REQUESTED', 'APPROVED', 'PROCESSING']

const EMPTY_BALANCES: VendorWalletBalances = {
  pending: 0,
  available: 0,
  locked: 0,
  paid: 0,
  reversed: 0,
  totalSales: 0,
  totalEarnings: 0,
  totalCommission: 0,
  totalWithdrawn: 0,
}

function Stat({
  label,
  value,
  icon,
  accent = false,
  hint,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent?: boolean
  hint?: string
}) {
  return (
    <div
      className={cn(
        'card-lux p-5',
        accent && 'border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">{label}</p>
          <p className="mt-2 font-display text-2xl text-night-50 sm:text-3xl">{formatPrice(value)}</p>
          {hint && <p className="mt-1 text-[11px] text-night-500">{hint}</p>}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-night-700 bg-night-900 text-gold-400">
          {icon}
        </span>
      </div>
    </div>
  )
}

export default function VendorEarningsPage() {
  const { showToast } = useToast()
  const [data, setData] = useState<VendorEarnings | null>(null)
  const [history, setHistory] = useState<VendorPayoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [requestOpen, setRequestOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [earnings, payouts] = await Promise.all([
        vendorApi.earnings({ page, perPage: 20 }),
        vendorApi.payouts({ page: 1, perPage: 20 }),
      ])
      setData(earnings)
      setHistory(payouts.items)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const balances = data?.balances ?? EMPTY_BALANCES
  const bank = data?.bankDetails
  const hasBank = Boolean(
    bank?.bankName && bank?.accountName && /^\d{10}$/.test(bank?.accountNumber ?? ''),
  )
  const openPayout = history.find((payout) => OPEN_STATUSES.includes(payout.status)) ?? null
  const canRequest = hasBank && balances.available >= 100 && !openPayout

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 100) {
      showToast('Enter a withdrawal amount of at least ₦100.', 'error')
      return
    }
    if (value > balances.available + 0.01) {
      showToast(`Amount exceeds your available balance of ${formatPrice(balances.available)}.`, 'error')
      return
    }
    setBusy(true)
    try {
      const result = await vendorApi.requestPayout(value, note || undefined)
      showToast(result.message)
      setRequestOpen(false)
      setAmount('')
      setNote('')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading your wallet…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-night-50 sm:text-3xl">Wallet &amp; Withdrawals</h1>
          <p className="mt-1.5 text-sm text-night-400">
            Earnings become available {data?.releaseDelayDays ?? 7} days after delivery. SAWABA processes
            every withdrawal to your bank account.
          </p>
        </div>
        <Button
          variant="gold"
          size="md"
          onClick={() => setRequestOpen(true)}
          disabled={!canRequest}
        >
          <Banknote className="h-4 w-4" />
          Request withdrawal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Total Sales" value={balances.totalSales} icon={<TrendingUp className="h-5 w-5" />} />
        <Stat label="Total Earnings" value={balances.totalEarnings} icon={<Coins className="h-5 w-5" />} />
        <Stat
          label="Sawaba Commission"
          value={balances.totalCommission}
          icon={<Percent className="h-5 w-5" />}
        />
        <Stat
          label="Available Balance"
          value={balances.available}
          icon={<Wallet className="h-5 w-5" />}
          accent
          hint={balances.locked > 0 ? `${formatPrice(balances.locked)} reserved in an open withdrawal` : undefined}
        />
        <Stat
          label="Pending Balance"
          value={balances.pending}
          icon={<Clock className="h-5 w-5" />}
          hint="In the delivery release period"
        />
        <Stat
          label="Total Withdrawn"
          value={balances.totalWithdrawn}
          icon={<Banknote className="h-5 w-5" />}
        />
      </div>

      {balances.locked > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-night-800 bg-night-900/40 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-night-400" />
          <p className="text-xs text-night-400">
            {formatPrice(balances.locked)} is reserved for a withdrawal awaiting payment. It returns to your
            available balance if the request is rejected.
          </p>
        </div>
      )}

      {!hasBank ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Add your bank account</p>
              <p className="mt-1 text-sm text-amber-100/90">
                You need a bank name, account name and 10-digit account number before you can withdraw.
              </p>
            </div>
          </div>
          <Link
            to="/vendor/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10"
          >
            Add bank details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-night-800 bg-night-900/40 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
              Withdrawals paid to
            </p>
            <p className="mt-1 text-sm font-semibold text-night-100">
              {bank?.bankName} · {bank?.accountNumber}
            </p>
            <p className="text-xs text-night-400">{bank?.accountName}</p>
          </div>
          <Link to="/vendor/settings" className="text-xs font-semibold text-gold-400 hover:text-gold-300">
            Edit bank details
          </Link>
        </div>
      )}

      {openPayout && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <p className="text-sm text-sky-100/90">
            Withdrawal <span className="font-semibold">{openPayout.referenceCode}</span> (
            {formatPrice(openPayout.amount)}) is{' '}
            {(PAYOUT_LABELS[openPayout.status] ?? openPayout.status).toLowerCase()} and awaiting payment.
            You can request another once it is completed.
          </p>
        </div>
      )}

      {/* Withdrawal history */}
      <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
        <div className="border-b border-night-800 bg-night-900/60 px-5 py-3">
          <h2 className="font-display text-lg text-night-50">Withdrawal History</h2>
          <p className="text-xs text-night-500">Every request and its current status.</p>
        </div>
        {history.length === 0 ? (
          <EmptyState
            icon={<Banknote className="h-10 w-10" />}
            title="No withdrawals yet"
            description="Your withdrawal requests will appear here with their status."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="border-b border-night-800">
                <tr>
                  {['Reference', 'Amount', 'Status', 'Requested', 'Paid / processed', 'Transfer ref'].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800 text-sm">
                {history.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-5 py-3 font-semibold text-night-100">{payout.referenceCode}</td>
                    <td className="px-5 py-3 text-night-100">{formatPrice(payout.amount)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        status={payout.status}
                        label={PAYOUT_LABELS[payout.status] ?? payout.status}
                      />
                    </td>
                    <td className="px-5 py-3 text-night-400">
                      {new Date(payout.requestedAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-5 py-3 text-night-400">
                      {payout.processedAt ? new Date(payout.processedAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-night-400">{payout.transactionRef ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction (ledger) history */}
      <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
        <div className="border-b border-night-800 bg-night-900/60 px-5 py-3">
          <h2 className="font-display text-lg text-night-50">Transaction History</h2>
          <p className="text-xs text-night-500">
            Every sale, with the commission rate frozen at the time of the sale.
          </p>
        </div>
        {!data || data.entries.items.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-10 w-10" />}
            title="No transactions yet"
            description="Sales appear here once a customer payment is confirmed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-night-800">
                <tr>
                  {['Order', 'Product', 'Sale', 'Rate', 'Commission', 'Your Share', 'Status'].map(
                    (heading, index) => (
                      <th
                        key={heading}
                        className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400 ${
                          index > 1 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800 text-sm">
                {data.entries.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-semibold text-night-100">{entry.orderReference}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-night-300">{entry.productName}</td>
                    <td className="px-4 py-3 text-right text-night-200">{formatPrice(entry.salePrice)}</td>
                    <td className="px-4 py-3 text-right text-night-400">{entry.commissionRate}%</td>
                    <td className="px-4 py-3 text-right text-night-400">
                      −{formatPrice(entry.commissionAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gold-300">
                      {formatPrice(entry.vendorNet)}
                      {entry.reversedAmount > 0 && (
                        <span className="block text-[10px] text-red-300">
                          {formatPrice(entry.reversedAmount)} reversed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge
                        status={entry.settlementStatus}
                        label={SETTLEMENT_LABELS[entry.settlementStatus] ?? entry.settlementStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.entries.total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 text-sm text-night-400">Page {page}</span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page * 20 >= data.entries.total}
            className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a withdrawal"
        size="sm"
      >
        <form onSubmit={requestWithdrawal} className="space-y-4">
          <div className="rounded-xl border border-night-800 bg-night-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-night-500">Available balance</p>
            <p className="mt-1 font-display text-2xl text-gold-400">{formatPrice(balances.available)}</p>
          </div>
          <Field
            label="Amount (₦)"
            hint={`Minimum ₦100 — up to ${formatPrice(balances.available)}`}
          >
            <input
              required
              type="number"
              min={100}
              max={Math.floor(balances.available)}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="5000"
              className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
            />
          </Field>
          <Field label="Note (optional)">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything the admin should know"
              className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
            />
          </Field>
          <p className="text-xs leading-relaxed text-night-500">
            Withdrawals are paid in whole earning amounts. If your requested amount doesn&apos;t match a
            combination of your released lines, the confirmed amount may be slightly less.
          </p>
          {hasBank && (
            <p className="text-xs text-night-500">
              Paid to {bank?.bankName} · {bank?.accountNumber} ({bank?.accountName})
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setRequestOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="md" loading={busy} disabled={!hasBank}>
              Submit request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
