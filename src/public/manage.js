// The customer's own booking link (?t=, from the reminder or the booking page).
// The token is the only key: the page confirms or cancels, shows a first name and
// the slot, and never a phone number. Moving a booking = cancel + book again.
import './site.css';
import './nav.js';
import { rpc, apiReady, dayLabel, slotLabel } from '../shared/api.js';
import { SHOP, POLICY, waLink, fullAddress } from '../shared/shop.js';
import { esc } from '../shared/render.js';

const box = document.querySelector('[data-manage]');
const token = new URLSearchParams(location.search).get('t') || '';
const ERR = { too_late: 'Tempahan ini sudah tidak boleh diubah di sini. WhatsApp kami.', not_found: 'Pautan ini tidak sah.' };
let busy = false;

function panel(inner) { box.innerHTML = `<div class="panel" style="max-width:520px;margin:0 auto">${inner}</div>`; }

function show(b, msg = '') {
  document.title = `Tempahan ${b.ref} | ${SHOP.name}`;
  const when = b.date && b.slot ? `${dayLabel(b.date)}, ${slotLabel(b.slot)}` : '-';
  const state = b.stage === 'batal' ? 'Dibatalkan' : b.confirmed ? 'Anda sudah sahkan kehadiran' : 'Menunggu pengesahan anda';
  const contact = SHOP.contacts[0];
  panel(`<p class="eyebrow" style="margin:0">Tempahan ${esc(b.ref)}</p>
  <h1 style="font-size:26px;margin:6px 0 4px">Salam, ${esc(b.customer)}</h1>
  <p class="muted">${esc(state)}</p>
  <div class="cert-row" style="margin-top:14px"><span>Masa</span><b>${when}</b></div>
  <div class="cert-row"><span>Filem</span><b>${esc(b.film || '-')}</b></div>
  <div class="cert-row"><span>Alamat</span><b style="text-align:right">${esc(fullAddress())}</b></div>
  ${msg ? `<p class="note" role="status" style="margin-top:14px"><b>${esc(msg)}</b></p>` : ''}
  ${b.can_change ? `<div class="row-btns" style="margin-top:18px">
    ${b.confirmed ? '' : '<button type="button" class="btn btn-cta" data-act="confirm">Saya akan datang</button>'}
    <button type="button" class="btn btn-line" data-act="cancel">Batalkan tempahan</button></div>
    <p class="note">${esc(POLICY.late)}</p>
    <p class="note">Mahu tukar masa? Batalkan di sini dan <a href="/tempah/">tempah slot baru</a>, atau <a href="${waLink(contact.phone, `Salam, saya nak tukar masa tempahan ${b.ref}.`)}" rel="noopener">WhatsApp ${esc(contact.name)}</a>.</p>`
    : `<p class="note" style="margin-top:14px">${b.stage === 'batal' ? 'Slot anda sudah dilepaskan. <a href="/tempah/">Tempah semula</a> bila-bila masa.' : 'Tempahan ini sudah tidak boleh diubah di sini.'}</p>`}`);
}

async function act(action) {
  if (busy) return;
  if (action === 'cancel' && !window.confirm('Batalkan tempahan ini? Slot anda akan diberi kepada pelanggan lain.')) return;
  busy = true;
  try {
    const b = await rpc('manage_booking', { p_token: token, p_action: action });
    show(b, action === 'confirm' ? 'Terima kasih! Kami tunggu kedatangan anda.' : 'Tempahan dibatalkan. Terima kasih kerana memberitahu kami.');
  } catch (e) {
    panel(`<h2>Tidak berjaya</h2><p class="muted" style="margin-top:8px">${esc(ERR[e.code] || 'Cuba lagi atau WhatsApp kami.')}</p>`);
  }
  busy = false;
}

box.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });

const missing = (m) => panel(`<h2>Tempahan tidak dijumpai</h2><p class="muted" style="margin-top:8px">${m}</p>`);
if (!apiReady) missing('Sistem tempahan belum aktif.');
else if (!/^[0-9a-f]{36}$/.test(token)) missing('Pautan tidak lengkap. Buka semula pautan dari WhatsApp kedai.');
else rpc('get_booking', { p_token: token })
  .then((b) => (b ? show(b) : missing('Pautan ini tidak sah.')))
  .catch(() => missing('Tidak dapat memuatkan tempahan. Cuba lagi.'));
