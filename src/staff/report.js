// Owner report maths. Pure: no React, no network, so tests/report.test.mjs can run it.
// Every number comes from the jobs table; nothing is estimated.
import { CAR_SIZES } from '../shared/shop.js';
import { balance, num } from './logic.js';

const TZ = 'Asia/Kuala_Lumpur';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
// A timestamp's date in the shop's time zone (a 11pm job belongs to that day, not the next).
export const klDate = (ts) => (ts ? (String(ts).length === 10 ? String(ts) : fmt.format(new Date(ts))) : null);
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const firstOfMonth = (iso, back = 0) => { const [y, m] = iso.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 - back, 1)); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export const PERIODS = [
  { id: 'mtd', label: 'Bulan ini' },
  { id: 'last', label: 'Bulan lepas' },
  { id: 'd90', label: '90 hari' },
  { id: 'd365', label: '12 bulan' },
];

// [from, to) date windows. "This month" compares with the SAME number of days of last
// month, otherwise the 3rd of the month always looks like a collapse.
export function periodRange(id, today) {
  const tomorrow = addDays(today, 1);
  if (id === 'mtd') {
    const from = firstOfMonth(today);
    const n = daysBetween(from, tomorrow);
    const pFrom = firstOfMonth(today, 1);
    return { from, to: tomorrow, prevFrom: pFrom, prevTo: [addDays(pFrom, n), from].sort()[0] };
  }
  if (id === 'last') return { from: firstOfMonth(today, 1), to: firstOfMonth(today), prevFrom: firstOfMonth(today, 2), prevTo: firstOfMonth(today, 1) };
  const n = id === 'd90' ? 90 : 365;
  return { from: addDays(tomorrow, -n), to: tomorrow, prevFrom: addDays(tomorrow, -2 * n), prevTo: addDays(tomorrow, -n) };
}

const within = (d, from, to) => Boolean(d) && d >= from && d < to;
const priceOf = (j) => num(j.price) ?? num(j.quoted_price) ?? 0;
const isDone = (j) => ['siap', 'selesai'].includes(j.stage);

function group(rows, key, value = () => 1) {
  const m = new Map();
  for (const r of rows) { const k = key(r); const g = m.get(k) || { key: k, n: 0, v: 0 }; g.n += 1; g.v += value(r); m.set(k, g); }
  return [...m.values()];
}

const DOW = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
export const METHODS = { tunai: 'Tunai', pindahan: 'Pindahan bank', qr: 'DuitNow QR', kad: 'Kad' };

export function report(allJobs, { today, period = 'mtd', settings = null, staff = [] } = {}) {
  const jobs = allJobs.filter((j) => !j.archived_at);
  const { from, to, prevFrom, prevTo } = periodRange(period, today);
  const doneIn = (a, b) => jobs.filter((j) => isDone(j) && within(klDate(j.completed_at), a, b));
  const done = doneIn(from, to);
  const prev = doneIn(prevFrom, prevTo);
  const sum = (rows, f) => rows.reduce((s, j) => s + f(j), 0);

  // Online bookings made in the window, and what became of each.
  const web = jobs.filter((j) => j.source === 'web' && within(klDate(j.created_at), from, to));
  const webOut = [
    { key: 'Siap dipasang', n: web.filter(isDone).length },
    { key: 'Masih dalam proses', n: web.filter((j) => ['baru', 'disahkan', 'dalam_kerja'].includes(j.stage)).length },
    { key: 'Tidak datang', n: web.filter((j) => j.stage === 'batal' && j.no_show).length },
    { key: 'Batal', n: web.filter((j) => j.stage === 'batal' && !j.no_show).length },
  ];

  const cancelled = jobs.filter((j) => j.stage === 'batal' && !j.no_show && within(klDate(j.created_at), from, to));
  const reasons = group(cancelled, (j) => (j.lost_reason || '').trim().toLowerCase() || '(tiada sebab ditulis)')
    .map((g) => ({ ...g, key: g.key.charAt(0).toUpperCase() + g.key.slice(1) }));

  const filmName = (id) => settings?.films?.find((f) => f.id === id)?.name || id;
  const sizeName = (id) => CAR_SIZES.find((s) => s.id === id)?.label || id;
  const staffName = (id) => staff.find((s) => s.id === id)?.name || 'Tiada rekod';

  // Busy days: cars finished per weekday, Monday first (a week reads Mon-Sun here).
  const perDow = Array(7).fill(0);
  for (const j of done) { const d = klDate(j.scheduled_date || j.completed_at); perDow[new Date(`${d}T00:00:00Z`).getUTCDay()] += 1; }
  const closed = settings?.closed_weekdays || [];
  const byDay = [1, 2, 3, 4, 5, 6, 0].filter((i) => !closed.includes(i) || perDow[i]).map((i) => ({ key: DOW[i], n: perDow[i], v: perDow[i] }));

  // Bay use: booked slot-places / offered slot-places, over open days that have passed.
  let offered = 0, used = 0;
  if (settings?.slots?.length) {
    const cap = settings.slots.length * (settings.cars_per_slot || 1);
    for (let d = from; d < to && d <= today; d = addDays(d, 1)) {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (closed.includes(dow) || (settings.closed_dates || []).includes(d)) continue;
      offered += cap;
      used += jobs.filter((j) => j.scheduled_date === d && j.scheduled_slot && j.stage !== 'batal').length;
    }
  }

  // Returning customer: someone whose phone had an earlier job that went ahead.
  const firstSeen = new Map();
  for (const j of [...jobs].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (j.stage !== 'batal' && !firstSeen.has(j.phone)) firstSeen.set(j.phone, j.id);
  }
  const returning = done.filter((j) => firstSeen.get(j.phone) !== j.id).length;

  const paidRows = done.filter((j) => num(j.paid_amount) > 0);
  return {
    range: { from, to, prevFrom, prevTo },
    sales: sum(done, priceOf), prevSales: sum(prev, priceOf),
    cars: done.length, prevCars: prev.length,
    avg: done.length ? sum(done, priceOf) / done.length : null,
    collected: sum(done, (j) => Math.min(num(j.paid_amount) || 0, priceOf(j))),
    owed: sum(done, balance),
    web: { total: web.length, out: webOut, doneRate: web.length >= 5 ? webOut[0].n / web.length : null },
    reasons: reasons.sort((a, b) => b.n - a.n),
    byFilm: group(done, (j) => filmName(j.film_id), priceOf).sort((a, b) => b.v - a.v),
    bySize: group(done, (j) => sizeName(j.car_size), priceOf).sort((a, b) => b.v - a.v),
    byInstaller: group(done, (j) => staffName(j.installer_id)).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)),
    byMethod: group(paidRows, (j) => METHODS[j.payment_method] || 'Tidak direkod', (j) => num(j.paid_amount) || 0).sort((a, b) => b.v - a.v),
    byDay,
    bay: offered ? { used, offered, rate: used / offered } : null,
    returning,
    reviewsAsked: jobs.filter((j) => within(klDate(j.thanked_at), from, to)).length,
  };
}

// Spreadsheet for the accountant: finished jobs in the window. No phone numbers:
// the accountant needs the money, not the customers' contacts.
export function toCsv(allJobs, { from, to }, { settings = null, staff = [] } = {}) {
  const rows = allJobs.filter((j) => !j.archived_at && isDone(j) && within(klDate(j.completed_at), from, to))
    .sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)));
  const q = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['Tarikh siap', 'Rujukan', 'Pelanggan', 'No. plat', 'Kereta', 'Saiz', 'Filem', 'Harga (RM)', 'Dibayar (RM)', 'Baki (RM)', 'Kaedah bayaran', 'Pemasang', 'Status'];
  const body = rows.map((j) => [
    klDate(j.completed_at), j.ref, j.customer_name, j.plate, j.car_model,
    CAR_SIZES.find((s) => s.id === j.car_size)?.label || j.car_size,
    settings?.films?.find((f) => f.id === j.film_id)?.name || j.film_id,
    priceOf(j).toFixed(2), (num(j.paid_amount) || 0).toFixed(2), balance(j).toFixed(2),
    METHODS[j.payment_method] || '', staff.find((s) => s.id === j.installer_id)?.name || '',
    j.stage === 'selesai' ? 'Dibayar penuh' : 'Siap, belum bayar penuh',
  ]);
  // BOM so Excel opens the Malay text as UTF-8.
  return '﻿' + [head, ...body].map((r) => r.map(q).join(',')).join('\r\n');
}
