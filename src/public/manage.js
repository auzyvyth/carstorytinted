// The customer's ONE page ("Tempahan saya", ?t=): booking status, confirm/cancel,
// then the receipt and the VLT/warranty certificate once the car is done. Every
// WhatsApp the shop sends carries this same link. The token is the only key; the
// page shows a first name and a masked plate, never a phone number.
// Moving a booking = cancel + book again.
import './site.css';
import './hero.css';
import './cert.css';
import './booking.css';
import './manage.css';
import './nav.js';
import { rpc, apiReady, dayLabel, dateLabel, slotLabel } from '../shared/api.js';
import { SHOP, POLICY, waLink, fullAddress } from '../shared/shop.js';
import { esc, rm, VLT_WINDOWS, verdictOf, MEETS_JPJ, jpjSummary, carPlanSvg } from '../shared/render.js';
import { saveImage, saveCertImage } from './saveImage.js';

const box = document.querySelector('[data-manage]');
const token = new URLSearchParams(location.search).get('t') || '';
const ERR = { too_late: 'Tempahan ini sudah tidak boleh diubah di sini. WhatsApp kami.', not_found: 'Pautan ini tidak sah.' };
let busy = false;

// Same blue page as /tempah/ (booking.css): left = where the booking stands and what to do,
// right = the booking and its money; once the car is done, the design C certificate below.
function panel(inner) { box.innerHTML = `<div class="bk-done">${inner}</div>`; }

const STEPS = [['baru', 'Diterima'], ['disahkan', 'Disahkan'], ['dalam_kerja', 'Dalam kerja'], ['siap', 'Siap'], ['selesai', 'Selesai']];
const METHOD = { tunai: 'Tunai', pindahan: 'Pindahan bank', qr: 'DuitNow QR', kad: 'Kad' };
const hasMoney = (v) => v !== null && v !== undefined;
const SAFE_URL = /^(https:|data:image\/|\/)/;

function steps(stage) {
  if (stage === 'batal') return '';
  const at = STEPS.findIndex(([id]) => id === stage);
  return `<ol class="mg-steps">${STEPS.map(([, label], i) => `<li class="${i < at ? 'done' : i === at ? 'on' : ''}"${i === at ? ' aria-current="step"' : ''}><i aria-hidden="true"></i><span>${label}</span></li>`).join('')}</ol>`;
}

// The booking and its money: what the shop recorded, nothing estimated. A website quote is labelled as one.
function summary(b) {
  const row = (k, v) => `<div class="bk-row"><span>${k}</span><b>${v}</b></div>`;
  const film = [b.film, ...(b.addons || [])].filter(Boolean).join(' + ');
  const paid = Number(b.paid) || 0, owed = hasMoney(b.price) ? Math.max(0, Number(b.price) - paid) : 0;
  return `<aside class="bk-sum" aria-label="${b.done ? 'Resit' : 'Tempahan anda'}">
  <p class="bk-sum-h">${b.done ? 'Resit' : 'Tempahan anda'} <span class="mg-ref">No. ${esc(b.ref)}</span></p>
  <div class="bk-rows">
    ${row('Kereta', esc([b.car_model, b.plate].filter(Boolean).join(' · ') || '-'))}
    ${row('Filem', esc(film || '-'))}
    ${paid > 0 ? row(`Dibayar${b.payment_method ? ` (${esc(METHOD[b.payment_method] || b.payment_method)})` : ''}`, rm(paid)) : ''}
    ${b.done && owed > 0 ? row('Baki', rm(owed)) : ''}
  </div>
  ${hasMoney(b.price) ? `<div class="bk-price"><span>${b.price_final ? 'Harga' : 'Anggaran (laman web)'}</span><b>${rm(b.price)}</b></div>` : ''}
  <p class="bk-pay">${b.done && owed === 0 && paid > 0 ? 'Dibayar penuh. Terima kasih!' : b.done ? 'Bayar di kedai.' : 'Bayar di kedai selepas siap. Tiada deposit.'}</p>
</aside>`;
}

// Once done: the certificate, design C (same pieces as /sijil/): readings over the car, the
// meter photos, the warranty. Tap a photo for the full picture.
function certificate(b) {
  if (!b.done) return '';
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter((p) => SAFE_URL.test(String(p.url)));
  const car = photos.find((p) => p.kind === 'car');
  const sum = jpjSummary(b);
  const lbl = (w, pos) => { const v = b[w.key], vd = verdictOf(v, w.min); return `<span class="pp-lbl pp-lbl-${pos}"><span>${w.short}</span><b class="${vd || 'none'}">${hasMoney(v) ? `${v}%` : '-'}</b></span>`; };
  const shots = VLT_WINDOWS.map((w) => { const p = photos.find((x) => x.kind === w.kind); return p ? `<a class="mg-shot" href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="Foto meter VLT pada ${esc(w.label.toLowerCase())}" loading="lazy"><span>${esc(w.short)} ${hasMoney(b[w.key]) ? `${b[w.key]}%` : ''}</span></a>` : ''; }).join('');
  const years = b.warranty_until && b.completed_at ? Math.round((Date.parse(b.warranty_until) - Date.parse(b.completed_at)) / (365.25 * 864e5)) : null;
  const [ws, fr, rr] = VLT_WINDOWS;
  return `<div class="pp mg-cert" role="group" aria-labelledby="mg-cert-h">
  <div class="pp-top${car ? ' has-photo' : ''}">${car ? `<img class="pp-car" src="${esc(car.url)}" alt="Kereta selepas siap dipasang tinted">` : ''}
    <div class="pp-id"><!-- taste-skill-ignore: design C label (owner pick) --><p class="pp-eyebrow">Pasport tint · No. ${esc(b.ref)}</p><h2 class="pp-h" id="mg-cert-h">Sijil pemasangan</h2>
    <p class="pp-sub">${esc([b.film, b.completed_at && `dipasang ${dateLabel(b.completed_at)}`].filter(Boolean).join(' · '))}</p></div></div>
  <div class="pp-plan">
    ${sum === 'ok' ? `<p class="pp-sum ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${MEETS_JPJ}</p>` : sum === 'bad' ? '<p class="pp-sum bad">Ada cermin di bawah had JPJ semasa diukur</p>' : ''}
    ${VLT_WINDOWS.some((w) => hasMoney(b[w.key])) ? `<div class="pp-car-plan">${lbl(ws, 'front')}${lbl(fr, 'mid')}${lbl(rr, 'back')}<div class="pp-svg-wrap">${carPlanSvg(null)}</div></div>` : '<p class="pp-hint">Bacaan VLT tidak direkodkan untuk kerja ini.</p>'}
    ${shots ? `<div class="mg-shots">${shots}</div>` : ''}
  </div>
  <div class="pp-warranty"><div class="pp-ring" aria-hidden="true">${years >= 1 ? `${years}<small>thn</small>` : '?'}</div>
    <div><p class="pp-wh">${years >= 1 ? `Waranti ${years} tahun` : 'Waranti'}</p><p>${b.warranty_until ? `Hingga ${dateLabel(b.warranty_until)}.` : 'Tempoh waranti: rujuk kedai.'} Ada masalah filem? WhatsApp kami dengan nombor ${esc(b.ref)}.</p></div></div>
  <p class="pp-fine">Bacaan diukur pada cermin kilang dan filem bersama, selepas pasang.${photos.length ? ' Masa pada foto dicatat oleh sistem semasa dimuat naik.' : ''} Sijil ini rekod kedai, bukan dokumen JPJ.</p>
</div>`;
}

let current = null;
function show(b, msg = '') {
  current = b;
  document.title = `Tempahan ${b.ref} | ${SHOP.name}`;
  const when = b.date && b.slot ? `${dayLabel(b.date)}, ${slotLabel(b.slot)}` : '';
  const state = b.stage === 'batal' ? 'Tempahan ini dibatalkan.' : b.done ? 'Kereta anda siap.' : b.stage === 'dalam_kerja' ? 'Kereta anda sedang dipasang tinted.'
    : b.confirmed ? 'Anda sudah sahkan kehadiran. Kami tunggu anda.' : b.stage === 'baru' ? 'Kami akan WhatsApp untuk sahkan slot anda.' : 'Kedai sudah sahkan. Tekan "Saya akan datang" supaya kami tahu.';
  const contact = SHOP.contacts[0];
  box.innerHTML = `<div class="bk">
  <div class="bk-main">
    <h1 class="bk-q">Salam, ${esc(b.customer)}</h1>
    <p class="bk-hint">${esc(state)}</p>
    ${steps(b.stage)}
    ${when && !b.done && b.stage !== 'batal' ? `<p class="mg-when">${esc(when)}<span>${esc(fullAddress())}</span></p>` : ''}
    ${msg ? `<p class="mg-msg" role="status">${esc(msg)}</p>` : ''}
    ${b.can_change ? `<div class="bk-done-btns">
      ${b.confirmed ? '' : '<button type="button" class="form-go" data-act="confirm">Saya akan datang</button>'}
      <button type="button" class="bk-line" data-act="cancel">Batalkan tempahan</button></div>
      <p class="bk-pay">${esc(POLICY.late)} Mahu tukar masa? Batalkan dan <a href="/tempah/">tempah slot baru</a>, atau <a href="${waLink(contact.phone, `Salam, saya nak tukar masa tempahan ${b.ref}.`)}" rel="noopener">WhatsApp ${esc(contact.name)}</a>.</p>`
      : b.stage === 'batal' ? '<div class="bk-done-btns"><a class="form-go" href="/tempah/">Tempah semula</a></div>'
      : `<div class="bk-done-btns"><a class="form-go" href="${waLink(contact.phone, `Salam, tentang tempahan ${b.ref}.`)}" rel="noopener">WhatsApp ${esc(contact.name)}</a>
        ${b.done || hasMoney(b.price) ? `<button type="button" class="bk-line" data-save>Simpan gambar${b.done ? ' resit + sijil' : ''}</button>` : ''}</div>`}
    ${certificate(b)}
    <p class="bk-pay mg-keep"><b>Simpan pautan ini.</b> Status, resit dan sijil anda sentiasa di halaman ini.</p>
  </div>
  <div class="mg-side">${summary(b)}</div>
</div>`;
}

async function act(action) {
  if (busy) return;
  if (action === 'cancel' && !window.confirm('Batalkan tempahan ini? Slot anda akan diberi kepada pelanggan lain.')) return;
  busy = true;
  try {
    const b = await rpc('manage_booking', { p_token: token, p_action: action });
    show(b, action === 'confirm' ? 'Terima kasih! Kami tunggu kedatangan anda.' : 'Tempahan dibatalkan. Terima kasih kerana memberitahu kami.');
  } catch (e) {
    panel(`<h2 class="bk-q">Tidak berjaya</h2><p class="bk-hint">${esc(ERR[e.code] || 'Cuba lagi atau WhatsApp kami.')}</p>${askLink()}`);
  }
  busy = false;
}

box.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });

// The receipt rows for the certificate image: what the shop recorded, nothing estimated.
function receiptRows(b) {
  if (!hasMoney(b.price)) return null;
  const paid = Number(b.paid) || 0, owed = Math.max(0, Number(b.price) - paid);
  return [[b.price_final ? 'Harga' : 'Anggaran harga', rm(b.price)],
    ...(paid > 0 ? [[`Dibayar${b.payment_method ? ` (${METHOD[b.payment_method] || b.payment_method})` : ''}`, rm(paid)]] : []),
    ...(owed > 0 ? [['Baki', rm(owed), 'bad']] : paid > 0 ? [['Status', 'Dibayar penuh', 'ok']] : [])];
}

// Before the car is done: the booking and its price as one image for the phone's gallery.
function imageOf(b) {
  const paid = Number(b.paid) || 0, owed = hasMoney(b.price) ? Math.max(0, Number(b.price) - paid) : 0;
  return {
    title: b.done ? 'Resit dan sijil tinted' : 'Tempahan tinted', ref: b.ref, customer: b.customer,
    blocks: [
      { rows: [['Masa', b.date && b.slot ? `${dayLabel(b.date)}, ${slotLabel(b.slot)}` : '-'], ['Kereta', [b.car_model, b.plate].filter(Boolean).join(' · ') || '-'],
        ['Filem', [b.film, ...(b.addons || [])].filter(Boolean).join(' + ') || '-']] },
      hasMoney(b.price) && { heading: b.done ? 'Resit' : 'Harga', rows: [
        [b.price_final ? 'Harga' : 'Anggaran harga', rm(b.price)],
        ...(paid > 0 ? [[`Dibayar${b.payment_method ? ` (${METHOD[b.payment_method] || b.payment_method})` : ''}`, rm(paid)]] : []),
        ...(b.done && owed > 0 ? [['Baki', rm(owed), 'bad']] : [])],
        note: b.done && owed === 0 && paid > 0 ? 'Dibayar penuh. Terima kasih!' : '' },
    ].filter(Boolean),
  };
}
box.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-save]');
  if (!btn || !current) return;
  btn.disabled = true;
  try {
    const b = current;
    // Done: the certificate image (design C) with the receipt card under it. Before: the booking card.
    if (b.done) await saveCertImage(b, `Sijil-Tinted-Carstory-${b.ref}.png`, { receipt: receiptRows(b) });
    else await saveImage(imageOf(b), `Tinted-Carstory-${b.ref}.png`);
  } finally { btn.disabled = false; }
});

// Lost the link: the shop resends it from the staff app ("Hantar pautan"). There is
// deliberately no "find my booking by phone number": that would let anyone who knows
// a number and a plate open a stranger's record.
const askLink = () => {
  const c = SHOP.contacts[0];
  return `<div class="bk-done-btns"><a class="form-go" href="${waLink(c.phone, 'Salam, saya hilang pautan tempahan / sijil tinted saya. Boleh hantar semula? Nama: , No. plat: ')}" rel="noopener">WhatsApp untuk pautan baru</a></div>`;
};
const missing = (m) => panel(`<h2 class="bk-q">Tempahan tidak dijumpai</h2><p class="bk-hint">${m}</p>${askLink()}`);
if (!apiReady) missing('Sistem tempahan belum aktif.');
else if (!/^[0-9a-f]{36}$/.test(token)) missing('Pautan tidak lengkap. Buka semula pautan dari WhatsApp kedai.');
else rpc('get_booking', { p_token: token })
  .then((b) => (b ? show(b) : missing('Pautan ini tidak sah.')))
  .catch(() => missing('Tidak dapat memuatkan tempahan. Cuba lagi.'));
