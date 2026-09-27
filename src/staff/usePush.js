// Web push for staff phones. Owns every browser trap in one place:
// iOS only allows push for an app added to the Home Screen (16.4+), and a
// "Block" answer can only be undone in the browser's own settings.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePush() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(VAPID);
  // 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'working'
  const [state, setState] = useState('working');
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    if (isIos() && !isStandalone()) return setState('ios-install');
    if (!supported) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    const reg = await navigator.serviceWorker.getRegistration('/staff/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      // Re-claim on every open: another staff member may have used this phone.
      await supabase.rpc('push_register', { p_subscription: sub.toJSON() });
      return setState('on');
    }
    setState('off');
  }, [supported]);

  useEffect(() => { check().catch(() => setState('off')); }, [check]);

  const enable = useCallback(async () => {
    setError(''); setState('working');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.register('/staff/sw.js', { scope: '/staff/' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
      const { error: e } = await supabase.rpc('push_register', { p_subscription: sub.toJSON() });
      if (e) throw e;
      setState('on');
    } catch {
      setError('Tidak berjaya. Cuba lagi.'); setState('off');
    }
  }, []);

  return { state, error, enable };
}

// Called before sign-out: this phone should stop getting this person's alerts.
export async function forgetThisDevice() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/staff/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await supabase.rpc('push_forget', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  } catch { /* best effort */ }
}
