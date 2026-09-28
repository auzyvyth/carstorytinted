// The customer's ONE page ("Tempahan saya", ?t=): booking status, confirm/cancel,
// then the receipt and the VLT/warranty certificate once the car is done. Every
// WhatsApp the shop sends carries this same link. The token is the only key; the
// page shows a first name and a masked plate, never a phone number.
// Moving a booking = cancel + book again.
import './site.css';
import './nav.js';
import { rpc, apiReady, dayLabel, dateLabel, slotLabel } from '../shared/api.js';
import { SHOP, POLICY, waLink, fullAddress } from '../shared/shop.js';
import { esc, rm, vltRows } from '../shared/render.js';
import { saveImage, vltData } from './saveImage.js';

const box = document.querySelector('[data-manage]');
const token = new URLSearchParams(location.search).get('t') || '';
const ERR = { too_late: 'Tempahan ini sudah tidak boleh diubah di sini. WhatsApp kami.', not_found: 'Pautan ini tidak sah.' };
let busy = false;

function panel(inner) { box.innerHTML = `<div class="panel" style="max-width:520px;margin:0 auto">${inner}</div>`; }

const STEPS = [['baru', 'Diterima'], ['disahkan', 'Disahkan'], ['dalam_kerja', 'Dalam kerja'], ['siap', 'Siap'], ['selesai', 'Selesai']];
const METHOD = { tunai: 'Tunai', pindahan: 'Pindahan bank', qr: 'DuitNow QR', kad: 'Kad' };
const hasMoney = (v) => v !== null && v !== undefined;

function steps(stage) {
  if (stage === 'batal') return '<p class="muted">Tempahan ini dibatalkan.</p>';
  const at = STEPS.findIndex(([id]) => id === stage);
  return `<ol class="stepper" style="margin:14px 0 6px">${STEPS.map(([, label], i) => `<li class="${i < at ? 'done' : i === at ? 'on' : ''}"${i === at ? ' aria-current="step"' : ''}>${label}</li>`).join('')}</ol>`;
}

// The receipt: what the shop recorded, nothing estimated. A website quote is labelled as one.
function receipt(b) {
  if (!hasMoney(b.price)) return '';
  const paid = Number(b.paid) || 0, owed = Math.max(0, Number(b.price) - paid);
  return `<p class="eyebrow" style="margin:22px 0 2px">${b.done ? 'Resit' : 'Harga'}</p>
  <div class="cert-row"><span>${b.price_final ? 'Harga' : 'Anggaran harga (laman web)'}</span><b>${rm(b.price)}</b></div>
  ${paid > 0 ? `<div class="cert-row"><span>Dibayar${b.payment_method ? ` (${esc(METHOD[b.payment_method] || b.payment_method)})` : ''}</span><b>${rm(paid)}</b></div>` : ''}
  ${b.done && owed > 0 ? `<div class="cert-row"><span>Baki</span><b>${rm(owed)}</b></div>` : ''}
  ${b.done && owed === 0 && paid > 0 ? '<p class="note"><span class="pass">Dibayar penuh.</span> Terima kasih!</p>' : ''}`;
}

function certificate(b) {
  if (!b.done) return '';
  return `<p class="eyebrow" style="margin:22px 0 2px">Sijil pemasangan</p>
  <div class="cert-row"><span>Tarikh pasang</span><b>${b.completed_at ? dateLabel(b.completed_at) : '-'}</b></div>
  ${vltRows(b)}
  <div class="cert-row" style="border-top:1px solid var(--line);margin-top:10px;padding-top:14px"><span>Waranti hingga</span><b>${b.warranty_until ? dateLabel(b.warranty_until) : 'Rujuk kedai'}</b></div>`;
}

let current = null;
function show(b, msg = '') {
  current = b;
  document.title = `Tempahan ${b.ref} | ${SHOP.name}`;
  const when = b.date && b.slot ? `${dayLabel(b.date)}, ${slotLabel(b.slot)}` : '-';
  const state = b.stage === 'batal' ? 'Dibatalkan' : b.done ? 'Kereta anda siap' : b.confirmed ? 'Anda sudah sahkan kehadiran' : b.stage === 'baru' ? 'Menunggu pengesahan kedai' : 'Menunggu pengesahan anda';
  const contact = SHOP.contacts[0];
  const film = [b.film, ...(b.addons || [])].filter(Boolean).join(' + ');
  box.innerHTML = `<div class="cert" style="max-width:560px;margin:0 auto">
  <div class="cert-head"><span class="wordmark"><span>Tinted</span> Carstory</span><span class="muted" style="font-size:13px">No. ${esc(b.ref)}</span></div>
  <p class="eyebrow" style="margin:4px 0 2px">Tempahan saya</p>
  <h1 style="font-size:24px;margin:2px 0 4px">Salam, ${esc(b.customer)}</h1>
  <p class="muted">${esc(state)}</p>
  ${steps(b.stage)}
  <div class="cert-row" style="margin-top:8px"><span>Masa</span><b>${when}</b></div>
  <div class="cert-row"><span>Kereta</span><b>${esc([b.car_model, b.plate].filter(Boolean).join(' · ') || '-')}</b></div>
  <div class="cert-row"><span>Filem</span><b>${esc(film || '-')}</b></div>
  ${msg ? `<p class="note" role="status" style="margin-top:14px"><b>${esc(msg)}</b></p>` : ''}
  ${b.can_change ? `<div class="row-btns" style="margin-top:18px">
    ${b.confirmed ? '' : '<button type="button" class="btn btn-cta" data-act="confirm">Saya akan datang</button>'}
    <button type="button" class="btn btn-line" data-act="cancel">Batalkan tempahan</button></div>
    <p class="note">${esc(POLICY.late)}</p>
    <p class="note">Mahu tukar masa? Batalkan di sini dan <a href="/tempah/">tempah slot baru</a>, atau <a href="${waLink(contact.phone, `Salam, saya nak tukar masa tempahan ${b.ref}.`)}" rel="noopener">WhatsApp ${esc(contact.name)}</a>.</p>`
    : b.stage === 'batal' ? '<p class="note" style="margin-top:14px">Slot anda sudah dilepaskan. <a href="/tempah/">Tempah semula</a> bila-bila masa.</p>' : ''}
  ${receipt(b)}
  ${certificate(b)}
  <p class="note" style="margin-top:18px"><b>Simpan pautan ini.</b> Status, resit dan sijil anda sentiasa ada di halaman ini.</p>
  <p class="note">${esc(SHOP.legalName)} · ${esc(fullAddress())}</p>
  ${b.done || hasMoney(b.price) ? `<div class="row-btns" style="margin-top:14px"><button type="button" class="btn btn-line btn-sm" data-save>Simpan gambar${b.done ? ' resit + sijil' : ''}</button></div>` : ''}
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
    panel(`<h2>Tidak berjaya</h2><p class="muted" style="margin-top:8px">${esc(ERR[e.code] || 'Cuba lagi atau WhatsApp kami.')}</p>${askLink()}`);
  }
  busy = false;
}

box.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });

// The receipt (+ certificate once done) as one image for the phone's gallery.
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
      b.done && { heading: 'Sijil pemasangan', rows: [['Tarikh pasang', b.completed_at ? dateLabel(b.completed_at) : '-'], ...vltData(b),
        ['Waranti hingga', b.warranty_until ? dateLabel(b.warranty_until) : 'Rujuk kedai']] },
    ].filter(Boolean),
  };
}
box.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-save]');
  if (!btn || !current) return;
  btn.disabled = true;
  try { await saveImage(imageOf(current), `Tinted-Carstory-${current.ref}.png`); } finally { btn.disabled = false; }
});

// Lost the link: the shop resends it from the staff app ("Hantar pautan"). There is
// deliberately no "find my booking by phone number": that would let anyone who knows
// a number and a plate open a stranger's record.
const askLink = () => {
  const c = SHOP.contacts[0];
  return `<div class="row-btns" style="margin-top:16px;justify-content:center"><a class="btn btn-cta" href="${waLink(c.phone, 'Salam, saya hilang pautan tempahan / sijil tinted saya. Boleh hantar semula? Nama: , No. plat: ')}" rel="noopener">WhatsApp untuk pautan baru</a></div>`;
};
const missing = (m) => panel(`<h2>Tempahan tidak dijumpai</h2><p class="muted" style="margin-top:8px">${m}</p>${askLink()}`);
if (!apiReady) missing('Sistem tempahan belum aktif.');
else if (!/^[0-9a-f]{36}$/.test(token)) missing('Pautan tidak lengkap. Buka semula pautan dari WhatsApp kedai.');
else rpc('get_booking', { p_token: token })
  .then((b) => (b ? show(b) : missing('Pautan ini tidak sah.')))
  .catch(() => missing('Tidak dapat memuatkan tempahan. Cuba lagi.'));
