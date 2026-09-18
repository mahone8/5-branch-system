'use client'

/**
 * Printable payment receipt. Builds a standalone HTML document in a popup
 * window (inline CSS only, no app styles to fight with) and opens the
 * browser's print dialog — "Save as PDF" works from there too.
 */
import type { Payment } from '@/lib/types'
import { amountToWords, formatCurrency, monthLabel } from '@/lib/types'

function esc(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function methodLabel(method: string | null): string {
  if (!method) return '—'
  return method === 'CASH' ? 'Cash' : method === 'UPI' ? 'UPI' : method === 'BANK_TRANSFER' ? 'Bank Transfer' : method
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function openPaymentReceipt(payment: Payment): void {
  const branch = payment.student.branch
  const branchTitle = branch ? `${esc(branch.name)} (${esc(branch.code)})` : 'Hostel Management System'
  const receiptNo = `RCP-${payment.month.replace('-', '')}-${payment.id.slice(-6).toUpperCase()}`
  const paidOn = payment.paidAt ?? payment.createdAt

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(receiptNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #f3f4f6; padding: 24px; color: #111827; }
  .sheet { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #d1d5db; padding: 36px 40px; }
  .head { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 14px; }
  .head h1 { font-size: 20px; letter-spacing: 0.5px; }
  .head p { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .doc-title { text-align: center; font-size: 14px; letter-spacing: 3px; font-weight: bold; margin: 18px 0 4px; }
  .paid-stamp { display: inline-block; margin: 4px auto 0; border: 2px solid #16a34a; color: #16a34a; border-radius: 6px; padding: 2px 14px; font-size: 12px; font-weight: bold; letter-spacing: 2px; }
  .stamp-row { text-align: center; }
  table.meta { width: 100%; font-size: 13px; margin-top: 16px; border-collapse: collapse; }
  table.meta td { padding: 3px 0; }
  table.meta td:first-child { color: #6b7280; width: 45%; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
  table.items th { border: 1px solid #d1d5db; background: #f9fafb; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  table.items td { border: 1px solid #d1d5db; padding: 8px; }
  .amount-cell { font-size: 15px; font-weight: bold; }
  .total td { background: #f9fafb; font-weight: bold; }
  .words { margin-top: 12px; font-size: 13px; font-style: italic; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
  .sig { border-top: 1px solid #111827; padding-top: 4px; width: 180px; text-align: center; color: #6b7280; }
  .gen { margin-top: 26px; text-align: center; font-size: 10px; color: #9ca3af; }
  .noprint { text-align: center; margin: 18px 0 0; }
  .noprint button { font-family: inherit; font-size: 14px; padding: 10px 28px; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: none; } .noprint { display: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <h1>${branchTitle}</h1>
      <p>Hostel Management System</p>
    </div>
    <div class="doc-title">PAYMENT RECEIPT</div>
    <div class="stamp-row"><span class="paid-stamp">PAID</span></div>
    <table class="meta">
      <tr><td>Receipt No.</td><td><strong>${esc(receiptNo)}</strong></td></tr>
      <tr><td>Date Paid</td><td>${formatDate(paidOn)}</td></tr>
    </table>
    <table class="items">
      <tr><th>Received From</th><th>Room</th><th>For</th><th>Amount</th></tr>
      <tr>
        <td>${esc(payment.student.name)}<br /><small style="color:#6b7280">${esc(payment.student.studentId)}</small></td>
        <td>${esc(payment.student.room?.roomNumber ?? '—')}</td>
        <td>Room rent — ${esc(monthLabel(payment.month))}</td>
        <td class="amount-cell">${esc(formatCurrency(payment.amount))}</td>
      </tr>
      <tr class="total"><td colspan="3">Total Received</td><td class="amount-cell">${esc(formatCurrency(payment.amount))}</td></tr>
    </table>
    <p class="words">Amount in words: <strong>${esc(amountToWords(payment.amount))}</strong></p>
    <table class="meta">
      <tr><td>Payment Method</td><td>${esc(methodLabel(payment.method))}</td></tr>
      <tr><td>Status</td><td>PAID</td></tr>
    </table>
    <div class="footer">
      <div class="sig">Received By</div>
      <div class="sig">Authorised Signature</div>
    </div>
    <p class="gen">This is a computer-generated receipt and does not require a stamp.</p>
  </div>
  <div class="noprint"><button onclick="window.print()">Print Receipt</button></div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=760,height=900')
  if (!win) {
    throw new Error('Popup blocked — allow popups for this site to print receipts.')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
