// One live list of jobs for the whole app. Paints from this device's cache
// first (the shop's signal can be weak), then refreshes, then stays in sync
// through realtime so both phones see the same board without reloading.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { DEMO } from '../shared/api.js';
import { OPEN_STAGES } from './logic.js';

const cacheKey = (uid) => `cs-jobs-${uid}`;
export const clearJobCache = (uid) => { try { localStorage.removeItem(cacheKey(uid)); } catch { /* private mode */ } };

// Closed jobs older than this are not preloaded; search reaches them server-side.
const RECENT_DAYS = 120;

export function useJobs(uid, { onWebBooking } = {}) {
  // Held in a ref: the caller passes an inline arrow, and keying the realtime
  // effect on it would resubscribe on every render.
  const onWeb = useRef(onWebBooking);
  onWeb.current = onWebBooking;
  const [jobs, setJobs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey(uid))) || []; } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cached = useRef(jobs.length > 0);

  const save = useCallback((rows) => {
    setJobs(rows);
    try { localStorage.setItem(cacheKey(uid), JSON.stringify(rows)); } catch { /* quota */ }
  }, [uid]);

  const refresh = useCallback(async () => {
    const since = new Date(Date.now() - RECENT_DAYS * 864e5).toISOString();
    const { data, error: e } = await supabase.from('jobs').select('*')
      .or(`stage.in.(${OPEN_STAGES.join(',')}),updated_at.gte.${since}`)
      .order('scheduled_date', { ascending: true, nullsFirst: false }).limit(2000);
    // A failed read keeps what we had; never replace a good list with nothing.
    if (e) setError('Tidak dapat muat turun kerja terbaru. Menunjukkan salinan terakhir.');
    else { setError(''); save(data); }
    setLoading(false);
  }, [save]);

  useEffect(() => {
    refresh();
    // The demo has no realtime server; a refresh on focus is enough there.
    const ch = DEMO ? null : supabase.channel('jobs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (p) => {
        if (p.eventType === 'INSERT' && p.new?.source === 'web') onWeb.current?.(p.new);
        setJobs((cur) => {
          const next = p.eventType === 'DELETE'
            ? cur.filter((j) => j.id !== p.old.id)
            : [p.new, ...cur.filter((j) => j.id !== p.new.id)];
          try { localStorage.setItem(cacheKey(uid), JSON.stringify(next)); } catch { /* quota */ }
          return next;
        });
      })
      .subscribe();
    // Coming back to the app after the phone slept: realtime may have missed events.
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (ch) supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh, uid]);

  // Write, then trust the returned row (triggers normalise phone, mint certificates...).
  const update = useCallback(async (id, patch) => {
    const { data, error: e } = await supabase.from('jobs').update(patch).eq('id', id).select().single();
    if (e) throw e;
    setJobs((cur) => cur.map((j) => (j.id === id ? data : j)));
    return data;
  }, []);

  const create = useCallback(async (row) => {
    const { data, error: e } = await supabase.from('jobs').insert(row).select().single();
    if (e) throw e;
    setJobs((cur) => [data, ...cur.filter((j) => j.id !== data.id)]);
    return data;
  }, []);

  // No remove(): jobs are never hard-deleted (0002_dashboard.sql). The owner archives.

  return { jobs, loading: loading && !cached.current, error, refresh, update, create };
}

// Search older jobs the preload skipped.
export async function searchAllJobs(q) {
  const s = q.replace(/[%,()]/g, '').trim();
  if (s.length < 3) return [];
  const digits = s.replace(/\D/g, '').replace(/^0/, '');
  const ors = [`customer_name.ilike.%${s}%`, `plate.ilike.%${s}%`, `ref.ilike.%${s}%`];
  if (digits.length >= 4) ors.push(`phone.like.%${digits}%`);
  const { data } = await supabase.from('jobs').select('*').is('archived_at', null).or(ors.join(',')).order('created_at', { ascending: false }).limit(50);
  return data || [];
}
