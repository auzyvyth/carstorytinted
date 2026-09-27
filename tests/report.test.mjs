// Owner report maths against hand-counted fixtures. Run: npm run test:report
// report.js imports Vite-only modules, so bundle it first with esbuild (ships with Vite).
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(mkdtempSync(join(tmpdir(), 'report-')), 'report.mjs');
await build({ entryPoints: ['src/staff/report.js'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent',
  define: { 'import.meta.env': '{}' } });
const { report, periodRange, toCsv, klDate } = await import(pathToFileURL(out).href);

let failed = 0;
const eq = (got, want, name) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

const TODAY = '2026-09-27';
const settings = { slots: ['09:30', '12:30', '15:30'], cars_per_slot: 1, closed_weekdays: [0], closed_dates: [],
  films: [{ id: 'nano', name: 'Nano' }, { id: 'uv', name: 'Black UV' }] };
const staff = [{ id: 'O', name: 'Maliki' }, { id: 'T', name: 'Tam' }];
const j = (o) => ({ id: Math.random().toString(36).slice(2), source: 'walk_in', stage: 'selesai', phone: '60111', car_size: 'small',
  film_id: 'nano', price: 300, paid_amount: 300, created_at: '2026-09-01T02:00:00Z', ...o });
const jobs = [
  // September, done: 3 cars, one returning (phone 60111 seen in August), one owing 100.
  j({ completed_at: '2026-09-02T08:00:00Z', scheduled_date: '2026-09-02', scheduled_slot: '09:30', installer_id: 'T', payment_method: 'tunai' }),
  j({ phone: '60222', film_id: 'uv', price: 60, paid_amount: 60, completed_at: '2026-09-10T08:00:00Z', installer_id: 'T', payment_method: 'qr' }),
  j({ phone: '60333', stage: 'siap', price: 200, paid_amount: 100, completed_at: '2026-09-20T15:30:00Z', installer_id: 'O' }),
  // 23:30 KL on 30 Sep is 15:30 UTC: still September. 00:30 KL on 1 Sep is 31 Aug UTC: September.
  j({ phone: '60444', price: 100, paid_amount: 100, completed_at: '2026-08-31T16:30:00Z' }),
  // August, done (the earlier visit of 60111), and the comparison window.
  j({ created_at: '2026-08-01T02:00:00Z', completed_at: '2026-08-03T08:00:00Z' }),
  // Online bookings in September: 1 done, 1 open, 1 no-show, 1 cancelled with a reason.
  j({ source: 'web', phone: '60555', created_at: '2026-09-05T02:00:00Z', completed_at: '2026-09-06T08:00:00Z', price: null, quoted_price: 100, paid_amount: 100 }),
  j({ source: 'web', phone: '60666', stage: 'baru', created_at: '2026-09-25T02:00:00Z', completed_at: null, paid_amount: 0 }),
  j({ source: 'web', phone: '60777', stage: 'batal', no_show: true, created_at: '2026-09-07T02:00:00Z', completed_at: null, paid_amount: 0 }),
  j({ source: 'web', phone: '60888', stage: 'batal', lost_reason: 'Harga mahal ', created_at: '2026-09-08T02:00:00Z', completed_at: null, paid_amount: 0 }),
  // Archived: counts nowhere.
  j({ archived_at: '2026-09-15T00:00:00Z', completed_at: '2026-09-14T08:00:00Z', price: 9999 }),
];

eq(klDate('2026-08-31T16:30:00Z'), '2026-09-01', 'KL date: 00:30 on the 1st belongs to the 1st');
eq(periodRange('mtd', TODAY), { from: '2026-09-01', to: '2026-09-28', prevFrom: '2026-08-01', prevTo: '2026-08-28' }, 'this month compares with the same days of last month');
eq(periodRange('mtd', '2026-03-31').prevTo, '2026-03-01', 'month-to-date prev window never runs past the end of February');
eq(periodRange('last', TODAY), { from: '2026-08-01', to: '2026-09-01', prevFrom: '2026-07-01', prevTo: '2026-08-01' }, 'last month window');

const r = report(jobs, { today: TODAY, period: 'mtd', settings, staff });
eq([r.cars, r.sales], [5, 760], 'cars + sales: done in September, archived excluded, quoted price used when no price');
eq([r.prevCars, r.prevSales], [1, 300], 'comparison window');
eq(r.owed, 100, 'owed = unpaid part of finished work');
eq(r.collected, 660, 'collected never exceeds the price');
eq(r.web.out.map((o) => o.n), [1, 1, 1, 1], 'online bookings: done / open / no-show / cancelled');
eq(r.web.doneRate, null, 'no percentage under 5 bookings');
eq(r.reasons.map((x) => [x.key, x.n]), [['Harga mahal', 1]], 'cancel reasons exclude no-shows, trimmed');
eq(r.byFilm.map((x) => [x.key, x.n, x.v]), [['Nano', 4, 700], ['Black UV', 1, 60]], 'sales by film');
eq(r.byInstaller.map((x) => [x.key, x.n]), [['Tam', 2], ['Tiada rekod', 2], ['Maliki', 1]], 'cars by installer');
eq(r.returning, 1, 'returning customer = phone with an earlier job');
eq(r.byMethod.find((m) => m.key === 'Tidak direkod').n, 3, 'payments with no method recorded are shown, not hidden');

const csv = toCsv(jobs, r.range, { settings, staff });
eq(csv.split('\r\n').length, 6, 'CSV: header + 5 finished jobs');
eq(csv.includes('60111'), false, 'CSV carries no phone numbers');

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log('ALL REPORT TESTS PASSED');
