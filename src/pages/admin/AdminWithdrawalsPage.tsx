import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Check,
  Clock,
  Eye,
  Landmark,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import {
  EmptyRow,
  Field,
  PageHeader,
  StatCard,
  StatusBadge,
  Td,
  Th,
} from '../../components/admin/AdminUI'
import {
  marketplaceAdminApi,
  type PayoutRow,
  type VendorWallet,
} from '../../api/marketplaceAdmin'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const PAYOUT_LABELS: Record<string, string> = {
  REQUESTED: 'Pending',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  REJECTED: 'Rejected',
}

const STATUS_FILTERS = ['', 'REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED'] as const
type PayoutAction = 'APPROVED' | 'PROCESSING' | 'REJECTED' | 'PAID'

interface ActionDialog {
  payout: PayoutRow
  action: PayoutAction
}

export default function AdminWithdrawalsPage() {
  const { showToast } = useToast()
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [dialog, setDialog] = useState<ActionDialog | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [transactionRef, setTransactionRef] = useState('')

  const [wallet, setWallet] = useState<VendorWallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  const perPage = 15
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await marketplaceAdminApi.payouts({
        status: status || undefined,
        page,
        perPage,
      })
      setPayouts(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return payouts
    return payouts.filter((row) =>
      [row.referenceCode, row.vendorName, row.vendorContactName, row.accountNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [payouts, search])

  const openDialog = (payout: PayoutRow, action: PayoutAction) => {
    setDialog({ payout, action })
    setAdminNote(payout.adminNote ?? '')
    setTransactionRef(payout.transactionRef ?? '')
  }

  const closeDialog = () => {
    setDialog(null)
    setAdminNote('')
    setTransactionRef('')
  }

  const submitAction = async () => {
    if (!dialog) return
    if (dialog.action === 'PAID' && !transactionRef.trim()) {
      showToast('A bank transfer reference is required to mark this withdrawal as paid.', 'error')
      return
    }
    setBusy(true)
    try {
      await marketplaceAdminApi.processPayout(dialog.payout.id, dialog.action, {
        transactionRef: dialog.action === 'PAID' ? transactionRef.trim() : undefined,
        note: adminNote.trim() || undefined,
      })
      showToast(
        dialog.action === 'PAID'
          ? 'Withdrawal marked as paid.'
          : `Withdrawal ${PAYOUT_LABELS[dialog.action]?.toLowerCase() ?? dialog.action.toLowerCase()}.`,
      )
      closeDialog()
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const openWallet = async (vendorId: number) => {
    setWallet(null)
    setWalletLoading(true)
    try {
      setWallet(await marketplaceAdminApi.vendorWallet(vendorId))
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setWalletLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        subtitle="Review vendor withdrawal requests, verify bank details, approve or reject, and record payouts."
        icon={<Banknote className="h-5 w-5" />}
        action={
          <Button variant="outline" size="md" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || 'ALL'}
              type="button"
              onClick={() => {
                setStatus(value)
                setPage(1)
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                status === value
                  ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                  : 'border-night-700 bg-night-900 text-night-400 hover:text-night-200',
              )}
            >
              {value === '' ? 'All' : PAYOUT_LABELS[value] ?? value}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reference, vendor or account number…"
          aria-label="Search withdrawals"
          className="field ml-auto h-10 max-w-xs text-sm"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Reference</Th>
                  <Th>Vendor</Th>
                  <Th>Bank details</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th>Requested</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {visible.length === 0 ? (
                  <EmptyRow message="No withdrawal requests match these filters." colSpan={7} />
                ) : (
                  visible.map((payout) => (
                    <tr key={payout.id} className="text-sm">
                      <Td className="font-semibold text-night-100">{payout.referenceCode}</Td>
                      <Td>
                        <p className="font-semibold text-night-100">{payout.vendorName}</p>
                        <p className="text-xs text-night-500">
                          {payout.vendorContactName}
                          {payout.vendorPhone ? ` · ${payout.vendorPhone}` : ''}
                        </p>
                      </Td>
                      <Td className="text-xs text-night-300">
                        <p className="flex items-center gap-1.5">
                          <Landmark className="h-3.5 w-3.5 text-gold-500/80" />
                          {payout.bankName ?? '—'}
                        </p>
                        <p className="mt-0.5 font-mono text-night-200">{payout.accountNumber ?? '—'}</p>
                        <p className="text-night-500">{payout.accountName ?? '—'}</p>
                      </Td>
                      <Td className="text-right font-semibold text-night-100">{formatPrice(payout.amount)}</Td>
                      <Td>
                        <StatusBadge status={payout.status} label={PAYOUT_LABELS[payout.status] ?? payout.status} />
                      </Td>
                      <Td className="text-xs text-night-400">
                        {new Date(payout.requestedAt).toLocaleDateString('en-GB')}
                        {payout.processedAt && (
                          <span className="block text-night-600">
                            {new Date(payout.processedAt).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {payout.status === 'REQUESTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openDialog(payout, 'APPROVED')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-400"
                              >
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => openDialog(payout, 'REJECTED')}
                                className="inline-flex items-center gap-1 rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-red-500/60 hover:text-red-300"
                              >
                                <X className="h-3 w-3" /> Reject
                              </button>
                            </>
                          )}
                          {payout.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => openDialog(payout, 'PROCESSING')}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20"
                            >
                              <Clock className="h-3 w-3" /> Processing
                            </button>
                          )}
                          {(payout.status === 'APPROVED' || payout.status === 'PROCESSING') && (
                            <button
                              type="button"
                              onClick={() => openDialog(payout, 'PAID')}
                              className="inline-flex items-center gap-1 rounded-lg bg-gold-500 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-950 hover:bg-gold-400"
                            >
                              <Banknote className="h-3 w-3" /> Mark paid
                            </button>
                          )}
                          {(payout.status === 'APPROVED' || payout.status === 'PROCESSING') && (
                            <button
                              type="button"
                              onClick={() => openDialog(payout, 'REJECTED')}
                              className="inline-flex items-center gap-1 rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-red-500/60 hover:text-red-300"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void openWallet(payout.vendorId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-gold-500/60 hover:text-gold-300"
                          >
                            <Eye className="h-3 w-3" /> Wallet
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 text-sm text-night-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Action dialog */}
      <Modal
        open={Boolean(dialog)}
        onClose={closeDialog}
        title={
          dialog
            ? dialog.action === 'PAID'
              ? 'Mark withdrawal as paid'
              : dialog.action === 'REJECTED'
                ? 'Reject withdrawal'
                : dialog.action === 'PROCESSING'
                  ? 'Mark as processing'
                  : 'Approve withdrawal'
            : ''
        }
        size="sm"
      >
        {dialog && (
          <div className="space-y-4">
            <div className="rounded-xl border border-night-800 bg-night-950/50 p-4 text-sm">
              <p className="text-night-400">
                {dialog.payout.vendorName} · {formatPrice(dialog.payout.amount)}
              </p>
              <p className="mt-1 text-xs text-night-500">
                {dialog.payout.bankName ?? '—'} · {dialog.payout.accountNumber ?? '—'} ·{' '}
                {dialog.payout.accountName ?? '—'}
              </p>
            </div>

            {dialog.action === 'PAID' && (
              <>
                <Field label="Transfer reference" hint="Required — recorded against the payout.">
                  <input
                    required
                    value={transactionRef}
                    onChange={(event) => setTransactionRef(event.target.value)}
                    placeholder="e.g. GTB-2026-000123456"
                    className="field"
                  />
                </Field>
                <p className="flex items-center gap-2 text-xs text-night-500">
                  <Clock className="h-3.5 w-3.5" />
                  Payment date: {new Date().toLocaleDateString('en-GB')} (recorded on confirmation)
                </p>
              </>
            )}

            <Field
              label={dialog.action === 'REJECTED' ? 'Reason' : 'Admin note (optional)'}
              hint={dialog.action === 'REJECTED' ? 'Shown to the vendor in their notification.' : 'Internal record of this action.'}
            >
              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={3}
                placeholder="Add a note for the record…"
                className="field resize-none"
              />
            </Field>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="md" onClick={closeDialog} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant={dialog.action === 'REJECTED' ? 'dark' : 'gold'}
                size="md"
                loading={busy}
                onClick={() => void submitAction()}
              >
                {dialog.action === 'PAID'
                  ? 'Confirm paid'
                  : dialog.action === 'REJECTED'
                    ? 'Reject'
                    : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Vendor wallet dialog */}
      <Modal
        open={walletLoading || Boolean(wallet)}
        onClose={() => {
          setWallet(null)
          setWalletLoading(false)
        }}
        title={wallet ? `${wallet.vendor.businessName} — Wallet` : 'Loading wallet…'}
        size="xl"
      >
        {walletLoading || !wallet ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner className="h-8 w-8 text-gold-500" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-night-800 bg-night-950/50 p-4 text-sm">
              <ShieldCheck className="h-4 w-4 text-gold-500" />
              <span className="text-night-300">
                {wallet.vendor.bankName ?? 'No bank'} · {wallet.vendor.bankAccountNumber ?? '—'} ·{' '}
                {wallet.vendor.bankAccountName ?? '—'}
              </span>
              <span className="ml-auto text-xs text-night-500">{wallet.vendor.email}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Total sales" value={formatPrice(wallet.balances.totalSales)} icon={<Landmark className="h-5 w-5" />} />
              <StatCard label="Total earnings" value={formatPrice(wallet.balances.totalEarnings)} icon={<Banknote className="h-5 w-5" />} />
              <StatCard label="Sawaba commission" value={formatPrice(wallet.balances.totalCommission)} icon={<Banknote className="h-5 w-5" />} />
              <StatCard label="Available" value={formatPrice(wallet.balances.available)} icon={<Banknote className="h-5 w-5" />} accent />
              <StatCard label="Pending" value={formatPrice(wallet.balances.pending)} icon={<Clock className="h-5 w-5" />} />
              <StatCard label="Total withdrawn" value={formatPrice(wallet.balances.totalWithdrawn)} icon={<Banknote className="h-5 w-5" />} />
            </div>

            <div className="overflow-hidden rounded-xl border border-night-800">
              <p className="border-b border-night-800 bg-night-900/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-gold-400">
                Withdrawals
              </p>
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-night-900">
                    <tr>
                      <Th>Reference</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th>Requested</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-night-800">
                    {wallet.payouts.length === 0 ? (
                      <EmptyRow message="No withdrawals yet." colSpan={4} />
                    ) : (
                      wallet.payouts.map((row) => (
                        <tr key={row.id}>
                          <Td className="text-night-100">{row.referenceCode}</Td>
                          <Td className="text-right text-night-100">{formatPrice(row.amount)}</Td>
                          <Td>
                            <StatusBadge status={row.status} label={PAYOUT_LABELS[row.status] ?? row.status} />
                          </Td>
                          <Td className="text-xs text-night-400">
                            {new Date(row.requestedAt).toLocaleDateString('en-GB')}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-night-800">
              <p className="border-b border-night-800 bg-night-900/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-gold-400">
                Ledger
              </p>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-night-900">
                    <tr>
                      <Th>Order</Th>
                      <Th>Product</Th>
                      <Th className="text-right">Sale</Th>
                      <Th className="text-right">Commission</Th>
                      <Th className="text-right">Vendor net</Th>
                      <Th>Settlement</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-night-800">
                    {wallet.ledger.length === 0 ? (
                      <EmptyRow message="No ledger entries yet." colSpan={6} />
                    ) : (
                      wallet.ledger.map((row) => (
                        <tr key={row.id}>
                          <Td className="text-night-100">{row.orderReference}</Td>
                          <Td className="max-w-[160px] truncate text-night-300">{row.productName}</Td>
                          <Td className="text-right text-night-200">{formatPrice(row.salePrice)}</Td>
                          <Td className="text-right text-night-400">{formatPrice(row.commissionAmount)}</Td>
                          <Td className="text-right text-gold-300">{formatPrice(row.vendorNet)}</Td>
                          <Td>
                            <StatusBadge status={row.settlementStatus} />
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
