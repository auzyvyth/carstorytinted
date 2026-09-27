// Pure rules for the staff app: no React, no network, so they can be tested.
import { SHOP, JPJ, STAGES, waLink } from '../shared/shop.js';
import { dayLabel, slotLabel, shopDate } from '../shared/api.js';

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
    if (j.stage === 'baru') {
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
    if (a) out.push({ ...a, job: j, wa: a.text ? waLink(j.phone, a.text) : '' });
  }
  return out.sort((x, y) => x.rank - y.rank || String(x.job.scheduled_date).localeCompare(String(y.job.scheduled_date)));
}

// Month tiles (owner only). "Done in month" = completed_at in that month.
export function monthStats(jobs, today = shopDate(0)) {
  const ym = today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const prevYm = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const inMonth = (iso, k) => iso && String(iso).slice(0, 7) === k;
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
