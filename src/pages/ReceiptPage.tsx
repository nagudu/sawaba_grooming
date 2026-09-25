import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Download, LoaderCircle, Printer, ShieldCheck, XCircle } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import { Button, ButtonLink } from '../components/ui/Button'
import PaymentReceipt from '../components/payment/PaymentReceipt'
import { fetchPayment } from '../api/payments'
import { downloadReceiptPdf } from '../utils/receiptPdf'
import { useToast } from '../components/ui/ToastNotification'
import type { PublicPaymentBundle } from '../api/payments'

export default function ReceiptPage() {
  const { token } = useParams<{ token: string }>()
  const { showToast } = useToast()
  const [bundle, setBundle] = useState<PublicPaymentBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = () => {
    if (!bundle) return
    try {
      downloadReceiptPdf(bundle.payment, bundle.settings)
      showToast('Receipt downloaded.', 'success')
    } catch {
      showToast('Could not generate the PDF. Please use Print instead.', 'error')
    }
  }

  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    fetchPayment(token)
      .then(setBundle)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Receipt not found.'),
      )
      .finally(() => setLoading(false))
  }, [token])

  // ?print=1 (opened from the customer dashboard): auto-open the print dialog
  // once the receipt renders — the stylesheet prints only the receipt itself.
  useEffect(() => {
    if (bundle && searchParams.get('print') === '1') {
      const timer = window.setTimeout(() => window.print(), 600)
      return () => window.clearTimeout(timer)
    }
  }, [bundle, searchParams])

  return (
    <PageTransition>
      <section className="bg-night-950 py-16 md:py-20">
        <div className="container-app">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-400">
              Official Receipt
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-night-50 md:text-5xl">
              Payment Receipt
            </h1>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20 text-night-400">
              <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
              <p className="text-sm">Loading receipt…</p>
            </div>
          ) : error ? (
            <div className="mx-auto max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
              <XCircle className="mx-auto h-10 w-10 text-rose-400" />
              <h2 className="mt-4 font-display text-xl text-night-50">Receipt Unavailable</h2>
              <p className="mt-2 text-sm text-night-400">{error}</p>
              <ButtonLink to="/" variant="gold" size="md" className="mt-6">
                Back to Home
              </ButtonLink>
            </div>
          ) : bundle?.payment?.status === 'PAID' ? (
            <>
              <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
                <Button variant="gold" size="md" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </Button>
                <Button variant="outline" size="md" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  Download Receipt
                </Button>
                <ButtonLink to={`/pay/${token}`} variant="outline" size="md">
                  Payment Page
                </ButtonLink>
                <ButtonLink to="/book" variant="dark" size="md">
                  Book Another Visit
                </ButtonLink>
              </div>

              <div className="rounded-3xl border border-gold-500/30 bg-night-950 p-4 shadow-[var(--shadow-glow)] md:p-8">
                <div className="mb-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  Validated by SAWABA
                </div>
                <PaymentReceipt payment={bundle.payment} settings={bundle.settings} />
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-md rounded-2xl border border-gold-500/30 bg-gold-500/5 p-8 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-gold-400" />
              <h2 className="mt-4 font-display text-xl text-night-50">
                This payment is not verified yet
              </h2>
              <p className="mt-2 text-sm text-night-400">
                The official receipt is only available once your payment has been verified.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink to={`/pay/${token}`} variant="gold" size="md">
                  View Payment Status
                </ButtonLink>
                <ButtonLink to="/" variant="outline" size="md">
                  <ArrowLeft className="h-4 w-4" />
                  Home
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageTransition>
  )
}