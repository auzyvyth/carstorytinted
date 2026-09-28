// Warranty + VLT certificate. The link's ?t= token is the only key; the page
// never shows a phone number and the plate comes back partly masked.
import './site.css';
import './nav.js';
import { rpc, apiReady, dateLabel } from '../shared/api.js';
import { SHOP, fullAddress } from '../shared/shop.js';
import { esc, vltRows } from '../shared/render.js';

const box = document.querySelector('[data-cert]');
const token = new URLSearchParams(location.search).get('t') || '';

function show(c) {
  document.title = `Sijil ${c.ref} | ${SHOP.name}`;
  box.innerHTML = `<div class="cert" style="margin:0 auto;max-width:520px">
  <div class="cert-head"><span class="wordmark"><span>Tinted</span> Carstory</span><span class="muted" style="font-size:13px">No. ${esc(c.ref)}</span></div>
  <p class="eyebrow" style="margin:4px 0 2px">Sijil pemasangan tinted</p>
  <p class="muted" style="font-size:14px;margin-bottom:8px">Untuk ${esc(c.customer)}</p>
  <div class="cert-row"><span>Kereta</span><b>${esc([c.car_model, c.plate].filter(Boolean).join(' · ') || '-')}</b></div>
  <div class="cert-row"><span>Filem</span><b>${esc(c.film || '-')}</b></div>
  <div class="cert-row"><span>Tarikh pasang</span><b>${c.completed_at ? dateLabel(c.completed_at) : '-'}</b></div>
  <p class="eyebrow" style="margin:18px 0 2px">Bacaan VLT selepas pasang</p>
  ${vltRows(c)}
  <div class="cert-row" style="border-top:1px solid var(--line);margin-top:10px;padding-top:14px"><span>Waranti hingga</span><b>${c.warranty_until ? dateLabel(c.warranty_until) : 'Rujuk kedai'}</b></div>
  <p class="note">${esc(SHOP.legalName)} · ${esc(fullAddress())}</p>
  <div class="row-btns" style="margin-top:18px"><button class="btn btn-line btn-sm" onclick="window.print()">Cetak / simpan PDF</button></div>
</div>`;
}

function missing(msg) {
  box.innerHTML = `<div class="panel" style="max-width:520px;margin:0 auto;text-align:center"><h2>Sijil tidak dijumpai</h2><p class="muted" style="margin-top:8px">${msg}</p></div>`;
}

if (!apiReady) missing('Sistem sijil belum aktif.');
else if (!/^[0-9a-f]{36}$/.test(token)) missing('Pautan tidak lengkap. Buka semula pautan dari WhatsApp kedai.');
else rpc('get_certificate', { p_token: token })
  .then((c) => (c ? show(c) : missing('Pautan ini tidak sah atau kerja belum siap.')))
  .catch(() => missing('Tidak dapat memuatkan sijil. Cuba lagi.'));
