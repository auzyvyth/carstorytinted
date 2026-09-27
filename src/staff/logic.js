// Pure rules for the staff app: no React, no network, so they can be tested.
import { SHOP, JPJ, STAGES, waLink } from '../shared/shop.js';
import { dayLabel, slotLabel, shopDate, DEMO } from '../shared/api.js';

// WhatsApp to a CUSTOMER. In the demo the sample numbers are invented and could
// belong to a real stranger, so the link opens WhatsApp without a recipient.
export const waCustomer = (phone, text = '') =>
  (DEMO ? `https://wa.me/${text ? `?text=${encodeURIComponent(text)}` : ''}` : waLink(phone, text));

// A timestamp's date in the shop's time zone: a job finished at 7am on the 1st in
// Kuala Lumpur is still 23:00 on the 31st in UTC, and belongs to the 1st.
const klFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
export const klDate = (ts) => (ts ? (String(ts).length === 10 ? String(ts) : klFmt.format(new Date(ts))) : null);

export const OPEN_STAGES = ['baru', 'disahkan', 'dalam_kerja', 'siap'];
export const stageOf = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
export const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
export const balance = (j) => Math.max(0, (num(j.price) ?? num(j.quoted_price) ?? 0) - (num(j.paid_amount) || 0));
export const firstName = (j) => (j.customer_name || '').split(' ')[0] || 'tuan/puan';
export const certUrl = (j) => (j.cert_token ? `${location.origin}/sijil/?t=${j.cert_token}` : '');

// The one forward move from each stage: the drawer's primary button.
export const NEXT = {
  baru: { to: 'disahkan', label: 'Sahkan slot' },
  disahkan: { to: 'dalam_kerja', label: 'Kereta sampai, mula kerja' },
  dalam_kerja: { to: 'siap', label: 'Tandakan siap' },
  siap: { to: 'selesai', label: 'Tandakan dibayar penuh' },
};

// VLT readings that would fail a JPJ meter. Rear glass has no limit.
export function vltWarnings(j) {
  const w = [];
  const ws = num(j.vlt_windscreen), fs = num(j.vlt_front);
  if (ws !== null && ws < JPJ.windscreen) w.push(`Cermin depan ${ws}% bawah had ${JPJ.windscreen}%`);
  if (fs !== null && fs < JPJ.frontSide) w.push(`Sisi depan ${fs}% bawah had ${JPJ.frontSide}%`);
  return w;
}

const daysSince = (iso, today) => Math.round((Date.parse(today) - Date.parse(String(iso).slice(0, 10))) / 864e5);

// "Perlu tindakan": one row per JOB (never one per reason), highest priority first.
// Each row names the column its WhatsApp button stamps so it doesn't come back.
// Nothing is ever sent automatically: the button opens WhatsApp, a person sends.
export function actionsFor(jobs, today = shopDate(0)) {
  const tomorrow = shopDate(1);
  const out = [];
  for (const j of jobs) {
    const n = firstName(j), when = j.scheduled_date ? `${dayLabel(j.scheduled_date)}${j.scheduled_slot ? `, ${slotLabel(j.scheduled_slot)}` : ''}` : '';
    let a = null;
    // Date gone by and nobody moved it on: either they didn't turn up, or the job
    // was done and never updated. Never offer "confirm" for a date in the past.
    if (['baru', 'disahkan'].includes(j.stage) && j.scheduled_date && j.scheduled_date < today) {
      a = { rank: 0, kind: 'past', why: 'Tarikh sudah lepas', cta: 'Buka kerja', open: true,
        alt: { label: 'Tidak datang', done: 'Ditanda tidak datang', patch: { stage: 'batal', no_show: true, lost_reason: 'Tidak datang' } } };
    } else if (j.stage === 'baru') {
      a = { rank: 0, kind: 'confirm', why: j.source === 'web' ? 'Tempahan online baru' : 'Belum disahkan', stamp: 'confirmed_msg_at', advance: 'disahkan',
        cta: 'Sahkan & WhatsApp',
        text: `Salam ${n}, ini ${SHOP.name}. Tempahan tinted anda (${j.ref}) pada ${when} DISAHKAN. Alamat: ${SHOP.street}, ${SHOP.town}. Jumpa nanti!` };
    } else if (j.stage === 'disahkan' && j.scheduled_date === tomorrow && !j.reminded_at) {
      a = { rank: 1, kind: 'remind', why: 'Temujanji esok', stamp: 'reminded_at', cta: 'Hantar peringatan',
        text: `Salam ${n}, peringatan: temujanji tinted anda di ${SHOP.name} esok, ${when}. Balas mesej ini jika perlu tukar masa.` };
    } else if (['siap', 'selesai'].includes(j.stage) && j.cert_token && !j.cert_sent_at) {
      a = { rank: 2, kind: 'cert', why: 'Sijil belum dihantar', stamp: 'cert_sent_at', cta: 'Hantar sijil',
        text: `Terima kasih ${n}! Ini sijil tinted anda (bacaan VLT dan waranti). Simpan pautan ini: ${certUrl(j)}` };
    } else if (j.stage === 'siap' && balance(j) > 0) {
      a = { rank: 3, kind: 'balance', why: `Baki RM${balance(j).toLocaleString('en-MY')} belum bayar`, cta: 'Buka kerja', open: true };
    } else if (j.stage === 'selesai' && j.completed_at && !j.thanked_at && !j.no_followup) {
      const d = daysSince(j.completed_at, today);
      if (d >= 3 && d <= 21) {
        a = { rank: 4, kind: 'thanks', why: 'Minta ulasan', stamp: 'thanked_at', cta: 'Minta ulasan',
          text: `Salam ${n}, macam mana tinted ${j.car_model || 'kereta'} anda setakat ini?${SHOP.googleReviewUrl ? ` Kalau puas hati, boleh tinggalkan ulasan di sini: ${SHOP.googleReviewUrl}` : ' Kalau puas hati, kongsikan dengan kawan ya.'}` };
      }
    }
    if (a) out.push({ ...a, job: j, wa: a.text ? waCustomer(j.phone, a.text) : '' });
  }
  return out.sort((x, y) => x.rank - y.rank || String(x.job.scheduled_date).localeCompare(String(y.job.scheduled_date)));
}

// Month tiles (owner only). "Done in month" = completed_at in that month.
export function monthStats(jobs, today = shopDate(0)) {
  const ym = today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const prevYm = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const inMonth = (ts, k) => Boolean(ts) && klDate(ts).slice(0, 7) === k;
  const calc = (k) => {
    const done = jobs.filter((j) => ['siap', 'selesai'].includes(j.stage) && inMonth(j.completed_at, k));
    return {
      sales: done.reduce((s, j) => s + (num(j.price) ?? num(j.quoted_price) ?? 0), 0),
      cars: done.length,
      online: jobs.filter((j) => j.source === 'web' && inMonth(j.created_at, k)).length,
      owed: jobs.filter((j) => j.stage === 'siap').reduce((s, j) => s + balance(j), 0),
    };
  };
  return { cur: calc(ym), prev: calc(prevYm) };
}

// The delta contract from ShiftOS DASHBOARD_DESIGN.md: null = nothing to say,
// Infinity = growth from zero ("BARU"), otherwise a percentage.
export function chg(cur, prev) {
  if (!prev && !cur) return null;
  if (!prev) return Infinity;
  return ((cur - prev) / prev) * 100;
}

export function matches(j, q) {
  if (!q) return true;
  const hay = [j.customer_name, j.phone, j.plate, j.ref, j.car_model].join(' ').toLowerCase().replace(/\s+/g, '');
  const needle = q.toLowerCase().replace(/\s+/g, '').replace(/^0/, '');
  return hay.includes(needle);
}

export const byScheduled = (a, b) =>
  `${a.scheduled_date || '9999'}${a.scheduled_slot || ''}`.localeCompare(`${b.scheduled_date || '9999'}${b.scheduled_slot || ''}`);

// Cars already holding each slot on one day (cancelled jobs free their slot).
// Same rule as the DB trigger jobs_check_capacity; the DB is the one that refuses.
export function slotUse(jobs, date, exceptId = null) {
  const use = {};
  for (const j of jobs) {
    if (j.scheduled_date !== date || !j.scheduled_slot || j.stage === 'batal' || j.id === exceptId) continue;
    use[j.scheduled_slot] = (use[j.scheduled_slot] || 0) + 1;
  }
  return use;
}

// A walk-in is being worked on now: the slot running at this moment (the latest
// one already started), or the first free one after it. '' if today is full.
export function walkInSlot(settings, jobs, now = new Date()) {
  const slots = settings?.slots || [];
  const cap = settings?.cars_per_slot || 1;
  const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur' }).format(now);
  const use = slotUse(jobs, shopDate(0));
  const started = slots.filter((t) => t <= hm);
  const from = started.length ? slots.indexOf(started[started.length - 1]) : 0;
  return slots.slice(from).find((t) => (use[t] || 0) < cap) || '';
}

export function isClosedDay(settings, iso) {
  if (!settings || !iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  return settings.closed_weekdays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay()) || settings.closed_dates.includes(iso);
}
