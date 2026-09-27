// Public pages talk to the database ONLY through the four anon functions
// (see supabase/migrations/0001_init.sql). Plain fetch keeps these pages light;
// the staff app uses supabase-js instead.
// VITE_DEMO=1: sales demo with sample data kept in this browser (demoBackend.js).
// It is a build-time constant, so a real build drops the demo code entirely.
export const DEMO = import.meta.env.VITE_DEMO === '1';
export const SUPABASE_URL = DEMO ? 'https://demo.invalid' : import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = DEMO ? 'demo' : import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const apiReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const apiFetch = DEMO
  ? (...a) => import('./demoBackend.js').then((m) => m.demoFetch(...a))
  : (...a) => fetch(...a);

export class ApiError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export async function rpc(fn, args = {}) {
  if (!apiReady) throw new ApiError('not_configured');
  let res;
  try {
    res = await apiFetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new ApiError('network');
  }
  const body = await res.json().catch(() => null);
  // Our functions raise short codes (slot_full, bad_phone, ...) as the message.
  if (!res.ok) throw new ApiError(body?.message || `http_${res.status}`);
  return body;
}

// Shop-local date as YYYY-MM-DD (the shop is in Malaysia whatever the visitor's clock says).
export function shopDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(d);
}

const DAY = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const MON = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export function dayParts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: DAY[dt.getUTCDay()], short: DAY[dt.getUTCDay()].slice(0, 3), date: d, mon: MON[m - 1] };
}
export const dayLabel = (iso) => { const p = dayParts(iso); return `${p.dow}, ${p.date} ${p.mon}`; };
export function slotLabel(t) {
  const [h, m] = t.split(':').map(Number);
  const part = h < 12 ? 'pagi' : h < 14 ? 'tengah hari' : h < 19 ? 'petang' : 'malam';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${part}`;
}
