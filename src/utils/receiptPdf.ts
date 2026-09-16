import { jsPDF } from 'jspdf'
import type { PaymentItem, PaymentSettings } from '../api/payments'
import { receiptNumber } from '../components/payment/PaymentReceipt'

/**
 * Generates the official SAWABA receipt as a real, downloadable PDF.
 * Same information as the printable on-screen receipt — branded as
 * Sawaba Grooming Salon (never any third-party brand).
 */

const GOLD: [number, number, number] = [168, 132, 61]
const DARK: [number, number, number] = [24, 24, 27]
const GRAY: [number, number, number] = [113, 113, 122]
const LIGHT: [number, number, number] = [244, 244, 245]
const WHITE: [number, number, number] = [255, 255, 255]

function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG')}`
}

function formatDay(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function downloadReceiptPdf(payment: PaymentItem, settings: PaymentSettings): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const margin = 48
  const contentWidth = width - margin * 2
  const appointment = payment.appointment

  // ── Header band ────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, width, 110, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 110, width, 4, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(settings.shopName.toUpperCase(), margin, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(212, 212, 216)
  if (settings.shopAddress) doc.text(settings.shopAddress, margin, 66)
  if (settings.shopPhone) doc.text(`Tel: ${settings.shopPhone}`, margin, 80)

  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PAYMENT RECEIPT', width - margin, 48, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(212, 212, 216)
  doc.text(`No. ${receiptNumber(payment)}`, width - margin, 66, { align: 'right' })
  if (appointment?.referenceCode) {
    doc.text(`Appointment #${appointment.referenceCode}`, width - margin, 80, { align: 'right' })
  }

  // ── Amount block ───────────────────────────────────────────────────────
  let y = 150
  doc.setFillColor(...LIGHT)
  doc.roundedRect(margin, y, contentWidth, 70, 8, 8, 'F')
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('AMOUNT PAID', margin + 20, y + 24)
  doc.setTextColor(...DARK)
  doc.setFontSize(24)
  doc.text(naira(Number(payment.amount)), margin + 20, y + 52)
  doc.setFontSize(9)
  doc.setTextColor(22, 130, 90)
  doc.setFont('helvetica', 'bold')
  doc.text('PAID / VERIFIED', width - margin - 20, y + 30, { align: 'right' })
  if (payment.verifiedAt) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(formatDay(payment.verifiedAt), width - margin - 20, y + 46, { align: 'right' })
  }

  // ── Details grid ───────────────────────────────────────────────────────
  y += 100
  const colWidth = (contentWidth - 16) / 2
  const details: Array<{ label: string; value: string }> = [
    { label: 'CUSTOMER', value: appointment?.customerName ?? '—' },
    {
      label: 'APPOINTMENT',
      value: appointment
        ? `#${appointment.referenceCode ?? appointment.id} · ${formatDay(appointment.appointmentDate)}`
        : '—',
    },
    { label: 'SERVICE', value: appointment?.service?.name ?? '—' },
    { label: 'BARBER', value: appointment?.barber?.name ?? 'Any barber' },
    {
      label: 'PAYMENT METHOD',
      value: payment.paymentMethod ? payment.paymentMethod.replace('_', ' ') : '—',
    },
    { label: 'PAID ON', value: formatDay(payment.paymentDate ?? payment.verifiedAt) },
  ]
  if (payment.transactionReference) {
    details.push({ label: 'TRANSACTION REFERENCE', value: payment.transactionReference })
  }

  details.forEach((detail, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = margin + col * (colWidth + 16)
    const boxY = y + row * 64
    doc.setDrawColor(228, 228, 231)
    doc.setFillColor(...WHITE)
    doc.roundedRect(x, boxY, colWidth, 54, 6, 6, 'FD')
    doc.setTextColor(...GRAY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(detail.label, x + 14, boxY + 20)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const value = doc.splitTextToSize(detail.value, colWidth - 28) as string[]
    doc.text(value.slice(0, 2), x + 14, boxY + 38)
  })

  // ── Service line ───────────────────────────────────────────────────────
  const rows = Math.ceil(details.length / 2)
  y += rows * 64 + 24
  if (appointment?.service) {
    doc.setDrawColor(228, 228, 231)
    doc.line(margin, y, width - margin, y)
    y += 20
    doc.setTextColor(...GRAY)
    doc.setFontSize(10)
    doc.text(appointment.service.name, margin, y)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text(naira(appointment.service.price), width - margin, y, { align: 'right' })
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.setFontSize(10)
    doc.text('Total paid', margin, y)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text(naira(Number(payment.amount)), width - margin, y, { align: 'right' })
    y += 10
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 90
  doc.setDrawColor(212, 212, 216)
  doc.setLineDashPattern([3, 3], 0)
  doc.line(margin, footerY, width - margin, footerY)
  doc.setLineDashPattern([], 0)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Thank you for choosing ${settings.shopName}.`, width / 2, footerY + 28, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text('Keep this receipt for your records.', width / 2, footerY + 46, { align: 'center' })
  if (settings.shopPhone) {
    doc.text(`Questions? Call ${settings.shopPhone}`, width / 2, footerY + 62, { align: 'center' })
  }

  const stamp = (payment.verifiedAt ?? payment.createdAt).slice(0, 10)
  doc.save(`SAWABA-Receipt-${receiptNumber(payment)}-${stamp}.pdf`)
}
