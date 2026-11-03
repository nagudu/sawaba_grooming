import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ScanLine, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, StatusBadge } from '../../components/admin/AdminUI'
import { useToast } from '../../components/ui/ToastNotification'
import QrCameraScanner from '../../components/qr/QrCameraScanner'
import {
  marketplaceAdminApi,
  type OrderPickupLookup,
} from '../../api/marketplaceAdmin'
import { formatPrice } from '../../utils/format'

/** Pull a PK-XXXXXXXX code out of raw scanner text, or fall back to the raw value. */
function extractPickupCode(raw: string): string {
  const match = raw.toUpperCase().match(/PK-[A-Z0-9]{5,12}/)
  return (match ? match[0] : raw.trim().toUpperCase()).slice(0, 16)
}

/**
 * Admin pickup verification. Staff type or scan a customer's pickup code, the
 * order + payment are verified server-side, then collection is confirmed.
 * Duplicate collection and unpairable/invalid transitions are rejected.
 */
export default function AdminPickupVerifyPage() {
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<OrderPickupLookup | null>(null)
  const [justCollected, setJustCollected] = useState<string | null>(null)
  const autoRan = useRef(false)

  const lookup = useCallback(
    async (raw: string) => {
      const value = extractPickupCode(raw)
      if (!value) {
        showToast('Enter the customer pickup code.', 'error')
        return
      }
      setBusy(true)
      try {
        const data = await marketplaceAdminApi.lookupPickup(value)
        setResult(data)
      } catch (error) {
        setResult(null)
        showToast(error instanceof Error ? error.message : 'Could not verify that code.', 'error')
      } finally {
        setBusy(false)
      }
    },
    [showToast],
  )

  useEffect(() => {
    const initial = searchParams.get('code')
    if (!initial || autoRan.current) return
    autoRan.current = true
    setCode(extractPickupCode(initial))
    void lookup(initial)
  }, [searchParams, lookup])

  const confirmCollection = async () => {
    if (!result) return
    const value = (result.order.pickupCode ?? code).toUpperCase()
    setBusy(true)
    try {
      const order = await marketplaceAdminApi.collectPickup(value)
      setJustCollected(order.referenceCode)
      showToast(`Order ${order.referenceCode} collected.`)
      await lookup(value)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not confirm collection.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setCode('')
    setResult(null)
    setJustCollected(null)
    setScanning(false)
  }

  const order = result?.order

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-white">Pickup Verification</h1>
        <p className="mt-1 text-sm text-night-400">
          Enter or scan the customer's pickup code (e.g. PK-7F3KQ9ZM) to verify the order and payment, then confirm collection.
        </p>
      </div>

      <div className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
        {scanning ? (
          <QrCameraScanner
            onDecode={(text) => {
              setScanning(false)
              const value = extractPickupCode(text)
              setCode(value)
              void lookup(value)
            }}
            onManual={(reference) => {
              setScanning(false)
              const value = extractPickupCode(reference)
              setCode(value)
              void lookup(value)
            }}
          />
        ) : (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              void lookup(code)
            }}
          >
            <div className="flex-1">
              <Field label="Pickup code" hint="Case-insensitive. Scanning a QR code that contains the pickup code also works.">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="PK-XXXXXXXX"
                  autoComplete="off"
                  className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 font-mono text-sm tracking-wider text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" size="md" loading={busy}>
                <Search className="mr-1 h-4 w-4" /> Verify
              </Button>
              <Button type="button" variant="outline" size="md" onClick={() => setScanning(true)}>
                <ScanLine className="mr-1 h-4 w-4" /> Scan
              </Button>
            </div>
          </form>
        )}
      </div>

      {order ? (
        <div className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">Order Number</p>
              <p className="font-mono text-lg text-gold-300">{order.referenceCode}</p>
              <p className="mt-1 text-sm text-night-300">
                {order.customerName} · {order.customerPhone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.paymentStatus} />
            </div>
          </div>

          {justCollected === order.referenceCode ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Collection confirmed for {order.referenceCode}.
            </p>
          ) : null}

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-night-800 bg-night-950/40 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-night-500">Fulfilment</dt>
              <dd className="mt-1 text-sm text-night-200">{order.fulfillmentType === 'PICKUP' ? 'Store pickup' : 'Delivery'}</dd>
            </div>
            <div className="rounded-xl border border-night-800 bg-night-950/40 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-night-500">Total</dt>
              <dd className="mt-1 text-sm text-night-200">{formatPrice(order.totalAmount)}</dd>
            </div>
            <div className="rounded-xl border border-night-800 bg-night-950/40 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-night-500">Ready for pickup</dt>
              <dd className="mt-1 text-sm text-night-200">{order.pickupReadyAt ? new Date(order.pickupReadyAt).toLocaleString() : '—'}</dd>
            </div>
            <div className="rounded-xl border border-night-800 bg-night-950/40 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-night-500">Collected</dt>
              <dd className="mt-1 text-sm text-night-200">{order.collectedAt ? new Date(order.collectedAt).toLocaleString() : 'Not yet'}</dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-1 text-sm text-night-300">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>{item.productName}{item.variationLabel ? ` (${item.variationLabel})` : ''} × {item.quantity}</span>
                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          {result?.eligible ? (
            <div className="mt-5 flex justify-end gap-3 border-t border-night-800 pt-4">
              <Button variant="outline" size="md" onClick={reset} disabled={busy}>
                Clear
              </Button>
              <Button variant="gold" size="md" onClick={() => void confirmCollection()} loading={busy}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Confirm collection
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-night-800 pt-4">
              <p className="text-sm text-amber-300">{result?.reason ?? 'This order cannot be collected right now.'}</p>
              <Button variant="outline" size="md" onClick={reset} disabled={busy}>
                Clear
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-night-800 bg-night-900/20 p-8 text-center text-sm text-night-500">
          No pickup code verified yet.
        </p>
      )}
    </div>
  )
}
