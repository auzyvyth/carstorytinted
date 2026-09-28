// Walk-in rules against a fixed clock. Run: npm run test:logic
// logic.js imports Vite-only modules, so bundle it first with esbuild (ships with Vite).
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(mkdtempSync(join(tmpdir(), 'logic-')), 'logic.mjs');
await build({ entryPoints: ['src/staff/logic.js'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent',
  define: { 'import.meta.env': '{}' } });
globalThis.location = { origin: 'https://kedai.test' };
const { walkInSlot, walkInNow, actionsFor, slotUse, receiptText } = await import(pathToFileURL(out).href);

let failed = 0;
const eq = (got, want, name) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

const DAY = '2026-09-28';
const at = (hm) => new Date(`${DAY}T${hm}:00+08:00`);
const settings = { slots: ['09:00', '11:00', '13:00', '15:00', '17:00'], cars_per_slot: 2 };
let n = 0;
const j = (o) => ({ id: `j${++n}`, stage: 'disahkan', customer_name: 'Pelanggan', phone: '60123456789', scheduled_date: DAY, manage_token: 'a'.repeat(36), ...o });
const late = j({ customer_name: 'Lewat Sahaja', scheduled_slot: '09:00' });
const jobs = [
  late,
  j({ stage: 'dalam_kerja', scheduled_slot: '09:00' }),            // 09:00 now full (2 bays)
  j({ scheduled_slot: '11:00' }), j({ scheduled_slot: '11:00' }),     // 11:00 full
  j({ stage: 'batal', scheduled_slot: '13:00' }),                     // cancelled: frees its bay
  j({ customer_name: 'Wan Tunggu', stage: 'baru', scheduled_slot: null, waitlist_at: `${DAY}T01:00:00Z` }),
];

eq(slotUse(jobs, DAY), { '09:00': 2, '11:00': 2 }, 'cancelled jobs do not hold a bay');
eq(walkInSlot(settings, jobs, at('10:20')), '13:00', 'walk-in: running block full, next free block offered');
eq(walkInSlot(settings, [], at('10:20')), '09:00', 'walk-in: the block running now, if it has a bay');
eq(walkInSlot(settings, [], at('18:30')), '17:00', 'last block runs as long as the gap before it');
eq(walkInSlot(settings, [], at('23:00')), '', 'after the last block: nothing offered (was: 17:00 at 11pm)');

const acts = actionsFor(jobs, DAY, { settings, now: at('10:20') });
const lateRow = acts.find((a) => a.job.id === late.id);
eq(lateRow?.kind, 'late', '09:00 booking with no arrival at 10:20 is flagged late');
eq(lateRow?.alt?.patch, { scheduled_slot: '13:00' }, 'late customer moves to the next FREE block, not a full one');
const waitRow = acts.find((a) => a.job.customer_name === 'Wan Tunggu');
eq(waitRow?.alt?.patch, { scheduled_slot: '13:00', stage: 'disahkan', waitlist_at: null }, 'waitlist: next person offered the free bay');
eq(acts.find((a) => a.job.id === late.id && a.kind === 'confirm'), undefined, 'a late booking is never offered "confirm"');

const early = actionsFor(jobs, DAY, { settings, now: at('09:10') }).find((a) => a.job.id === late.id);
eq(early?.kind === 'late', false, '10 minutes late: still their slot (rule is 15)');
const full = actionsFor(jobs.map((x) => (x.stage === 'batal' ? { ...x, stage: 'disahkan' } : x)).concat([j({ scheduled_slot: '13:00' }), j({ scheduled_slot: '15:00' }), j({ scheduled_slot: '15:00' }), j({ scheduled_slot: '17:00' }), j({ scheduled_slot: '17:00' })]), DAY, { settings, now: at('10:20') });
eq(full.find((a) => a.job.id === late.id)?.alt?.patch?.no_show, true, 'no free block left today: offer "Tidak datang" instead of a move');
eq(full.some((a) => a.kind === 'waitlist'), false, 'no free bay: the waitlist is not pinged');

const confirm = actionsFor([j({ stage: 'baru', scheduled_date: '2026-09-30', scheduled_slot: '11:00' })], DAY, { settings, now: at('10:20') })[0];
eq(confirm.text.includes('/urus/?t=') && confirm.text.includes('15 minit'), true, 'confirmation carries the customer link and the late rule');

// "Can we take the car that just drove in?"
eq(walkInNow(settings, jobs, at('10:20')), { state: 'full', slot: '09:00', next: '13:00', wait: 160 }, 'walk-in now: running block full -> next free block + wait in minutes');
eq(walkInNow(settings, [], at('12:50')).state, 'free', 'walk-in now: empty day, a bay is free');
eq(walkInNow(settings, [j({ scheduled_slot: '11:00' })], at('12:50')), { state: 'free', slot: '11:00', free: 1, cap: 2, early: false }, 'walk-in now: counts bays left, 1 of 2');
eq(walkInNow(settings, [], at('23:00')).state, 'over', 'walk-in now: after the last block');
eq(walkInNow({ ...settings, closed_weekdays: [1], closed_dates: [] }, [], at('10:00')).state, 'closed', 'walk-in now: closed day (28 Sep 2026 is a Monday)');

// A walk-in slotted into the block running now is at the shop, not late.
const walk = j({ source: 'walk_in', customer_name: 'Baru Sampai', scheduled_slot: '09:00', plate: 'PKA 1' });
const wRows = actionsFor([walk], DAY, { settings, now: at('10:20') });
eq(wRows.some((a) => a.kind === 'late'), false, 'a walk-in in the running block is never flagged late');
eq(wRows[0]?.kind, 'confirm_walkin', 'a walk-in gets a confirmation row (time + link)');
eq(wRows[0]?.text.includes('/urus/?t=') && wRows[0]?.text.includes('PKA 1'), true, 'walk-in confirmation carries plate, time and the customer link');
eq(actionsFor([{ ...walk, confirmed_msg_at: '2026-09-28T02:00:00Z' }], DAY, { settings, now: at('10:20') }).length, 0, 'sent once: the row goes away after the stamp');
eq(receiptText({ ...walk, price: 300, paid_amount: 300 }).includes('/urus/?t='), true, 'the WhatsApp receipt points to the customer page');

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log('ALL LOGIC TESTS PASSED');
