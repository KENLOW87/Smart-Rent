'use client';

import { useState } from 'react';

// View the uploaded bank-in slip, or share the actual file to WhatsApp (Web Share).
export default function SlipActions({ url, caption }: { url: string; caption: string }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes('pdf') ? 'pdf' : blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `bank-slip.${ext}`, { type: blob.type || 'application/octet-stream' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Bank-in slip', text: caption });
        } catch {
          // user cancelled the share sheet — do nothing
        }
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(url, '_blank');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg font-medium"
      >
        📄 View slip
      </a>
      <button
        onClick={share}
        disabled={busy}
        className="flex-1 inline-flex items-center justify-center gap-1 text-sm bg-emerald-500 text-white py-2 rounded-lg font-medium disabled:opacity-50"
      >
        💬 WhatsApp
      </button>
    </div>
  );
}
