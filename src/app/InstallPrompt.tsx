'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (standalone) return; // already installed

    const ua = window.navigator.userAgent.toLowerCase();
    // Must run post-hydration: navigator is unavailable during SSR, and a lazy
    // useState initializer would render the iOS banner on the client only,
    // causing a hydration mismatch. The one-time setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (/iphone|ipad|ipod/.test(ua)) setIosHint(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed) return null;
  if (!deferred && !iosHint) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div className="max-w-md mx-auto px-3 pt-3">
      <div className="bg-slate-900 text-white rounded-xl shadow px-4 py-3 flex items-center gap-3">
        <span className="text-lg">📲</span>
        <div className="flex-1 text-xs leading-snug">
          {deferred
            ? 'Install Smart Rent on your phone'
            : (<>Install: tap <b>Share</b> ↗ then <b>Add to Home Screen</b></>)}
        </div>
        {deferred && (
          <button onClick={install}
            className="text-xs bg-white text-slate-900 font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
            Install
          </button>
        )}
        <button onClick={() => setDismissed(true)} aria-label="Dismiss"
          className="text-slate-400 text-xl leading-none px-1">×</button>
      </div>
    </div>
  );
}
