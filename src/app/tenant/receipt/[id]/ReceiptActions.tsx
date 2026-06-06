'use client';

import { useState } from 'react';

type Props = {
  amount: string;
  tenant: string;
  property: string;
  period: string;
  datePaid: string;
  method: string;
  reference: string;
};

async function buildPdf(d: Props) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: [320, 470] });
  const cx = 160;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text('Smart Rent', cx, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Receipt', cx, 60, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.line(28, 74, 292, 74);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(4, 120, 87);
  doc.text('PAID', cx, 98, { align: 'center' });

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text(`RM ${d.amount}`, cx, 134, { align: 'center' });

  let y = 178;
  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(label, 28, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(value, 292, y, { align: 'right' });
    y += 24;
  };
  row('Tenant', d.tenant);
  row('Property', d.property);
  row('For', d.period);
  row('Date paid', d.datePaid);
  row('Method', d.method);
  if (d.reference) row('Reference', d.reference);

  doc.setDrawColor(226, 232, 240);
  doc.line(28, y, 292, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for your payment.', cx, y + 20, { align: 'center' });

  return doc;
}

export default function ReceiptActions(props: Props) {
  const [busy, setBusy] = useState(false);
  const fileName =
    `SmartRent-Receipt-${props.property}-${props.period}`.replace(/[^a-zA-Z0-9-]/g, '_') + '.pdf';

  async function download() {
    setBusy(true);
    try {
      const doc = await buildPdf(props);
      doc.save(fileName);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const doc = await buildPdf(props);
      const blob = doc.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Rent Payment Receipt',
          text: `Rent receipt — ${props.property} ${props.period} (PAID)`,
        });
      } else {
        doc.save(fileName);
        alert('Receipt downloaded. Open WhatsApp and attach it to send to your landlord.');
      }
    } catch {
      // user cancelled the share sheet — ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2 mt-4 w-full max-w-sm">
      <button onClick={download} disabled={busy}
        className="flex-1 text-sm border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium disabled:opacity-50">
        ⬇ Download PDF
      </button>
      <button onClick={share} disabled={busy}
        className="flex-1 text-sm bg-emerald-500 text-white py-2.5 rounded-lg font-medium disabled:opacity-50">
        💬 WhatsApp
      </button>
    </div>
  );
}
