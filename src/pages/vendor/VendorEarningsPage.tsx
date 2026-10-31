import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Banknote, Clock, Download, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Field, StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { vendorApi, type VendorEarnings } from '../../api/vendor'
import { formatPrice } from '../../utils/format'

function Balance({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className={`card-lux p-5 ${tone}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">{label}</p>
          <p className="mt-2 font-display text-3xl text-night-50">{formatPrice(value)}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-night-700 bg-night-900 text-gold-400">
          {icon}
        </span>
      </div>
    </div>
  )
}

export default function VendorEarningsPage() {
  const { showToast } = useToast()
  const [data, setData] = useState<VendorEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [requestOpen, setRequestOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await vendorApi.earnings({ page, perPage: 20 })
      setData(result)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const requestPayout = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await vendorApi.requestPayout(Number(amount), note || undefined)
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
        <p className="text-sm">Loading earnings…</p>
      </div>
    )
  }

  const balances = data?.balances ?? { pending: 0, available: 0, paid: 0, reversed: 0 }
  const hasBank = Boolean(data?.bankDetails.bankName && data?.bankDetails.accountNumber)
  const openPayout = data?.payouts.find((payout) => payout.status === 'REQUESTED' || payout.status === 'APPROVED')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-night-50 sm:text-3xl">Earnings & Payouts</h1>
          <p className="mt-1.5 text-sm text-night-400">
            Earnings release {data?.releaseDelayDays ?? 7} days after delivery, then become withdrawable.
          </p>
        </div>
        <Button
          variant="gold"
          size="md"
          onClick={() => setRequestOpen(true)}
          disabled={balances.available <= 0 || Boolean(openPayout)}
        >
          <Download className="h-4 w-4" />
          Request Payout
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Balance label="Available" value={balances.available} tone="border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-transparent" icon={<Wallet className="h-5 w-5" />} />
        <Balance label="Pending (in release period)" value={balances.pending} tone="" icon={<Clock className="h-5 w-5" />} />
        <Balance label="Paid Out" value={balances.paid} tone="" icon={<Banknote className="h-5 w-5" />} />
        <Balance label="Reversed (refunds)" value={balances.reversed} tone="" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      {!hasBank && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed text-amber-100/90">
            Add your bank account details under <strong>Settings</strong> before requesting a payout — the
            admin uses them to process your transfer.
          </p>
        </div>
      )}

      {openPayout && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <p className="text-sm text-sky-100/90">
            Payout <span className="font-semibold">{openPayout.referenceCode}</span> (
            {formatPrice(openPayout.amount)}) is {openPayout.status.toLowerCase()} and being processed by the
            administrator.
          </p>
        </div>
      )}

      {/* Payout history */}
      {data && data.payouts.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="border-b border-night-800 bg-night-900/60 px-5 py-3">
            <h2 className="font-display text-lg text-night-50">Payout History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-night-800">
                <tr>
                  {['Reference', 'Amount', 'Status', 'Requested', 'Processed'].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800 text-sm">
                {data.payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-5 py-3 font-semibold text-night-100">{payout.referenceCode}</td>
                    <td className="px-5 py-3 text-night-100">{formatPrice(payout.amount)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={payout.status} />
                    </td>
                    <td className="px-5 py-3 text-night-400">
                      {new Date(payout.requestedAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-5 py-3 text-night-400">
                      {payout.processedAt ? new Date(payout.processedAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
        <div className="border-b border-night-800 bg-night-900/60 px-5 py-3">
          <h2 className="font-display text-lg text-night-50">Earnings Ledger</h2>
          <p className="text-xs text-night-500">
            Every sale, with the commission rate frozen at the time of the sale.
          </p>
        </div>
        {!data || data.entries.items.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-10 w-10" />}
            title="No earnings yet"
            description="Commission entries appear here once your orders are paid and delivered."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-night-800">
                <tr>
                  {['Order', 'Product', 'Sale', 'Rate', 'Commission', 'Your Share', 'Status'].map((heading, index) => (
                    <th
                      key={heading}
                      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400 ${index > 1 ? 'text-right' : 'text-left'}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800 text-sm">
                {data.entries.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-semibold text-night-100">{entry.orderReference}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-night-300">{entry.productName}</td>
                    <td className="px-4 py-3 text-right text-night-200">{formatPrice(entry.salePrice)}</td>
                    <td className="px-4 py-3 text-right text-night-400">{entry.commissionRate}%</td>
                    <td className="px-4 py-3 text-right text-night-400">−{formatPrice(entry.commissionAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gold-300">
                      {formatPrice(entry.vendorNet)}
                      {entry.reversedAmount > 0 && (
                        <span className="block text-[10px] text-red-300">
                          {formatPrice(entry.reversedAmount)} reversed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={entry.settlementStatus} />
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

      {/* Payout request modal */}
      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Request a payout" size="sm">
        <form onSubmit={requestPayout} className="space-y-4">
          <div className="rounded-xl border border-night-800 bg-night-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-night-500">Available balance</p>
            <p className="mt-1 font-display text-2xl text-gold-400">{formatPrice(balances.available)}</p>
          </div>
          <Field label="Amount (₦)" hint={`Minimum ₦100 — up to ${formatPrice(balances.available)}`}>
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
          {hasBank && (
            <p className="text-xs text-night-500">
              Payout will be sent to {data?.bankDetails.bankName} · {data?.bankDetails.accountNumber} (
              {data?.bankDetails.accountName})
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setRequestOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
