// Warranty + VLT certificate, design C "Pasport kereta" (owner's pick, 2026-10-26):
// the finished car on top, a top-down plan with the reading on each window, tap a window
// to see its meter photo. The link's ?t= token is the only key; the page never shows a
// phone number and the plate comes back partly masked.
// Wording: the certificate is the SHOP's record. JPJ certifies no tint shop, so it says
// "Memenuhi had JPJ semasa diukur", never "Lulus JPJ" / "Diluluskan JPJ".
import './site.css';
import './hero.css';
import './cert.css';
import './booking.css';
import './manage.css';
import './nav.js';
import { rpc, apiReady, dateLabel } from '../shared/api.js';
import { SHOP, fullAddress, waLink } from '../shared/shop.js';
import { esc, VLT_WINDOWS, verdictOf, VERDICT_WORD, MEETS_JPJ, jpjSummary, carPlanSvg as plan } from '../shared/render.js';
import { saveCertImage } from './saveImage.js';

const box = document.querySelector('[data-cert]');
const token = new URLSearchParams(location.search).get('t') || '';
const SAFE_URL = /^(https:|data:image\/|\/)/;

let current = null;
let picked = 'windscreen';

const photosOf = (c) => (Array.isArray(c.photos) ? c.photos : []).filter((p) => SAFE_URL.test(String(p.url)));
const photo = (c, kind) => photosOf(c).find((p) => p.kind === kind);
const hhmm = (at) => (/T(\d{2}:\d{2})/.exec(String(at)) || [])[1] || '';
const has = (v) => v !== null && v !== undefined;

function warrantyYears(c) {
  if (!c.warranty_until || !c.completed_at) return null;
  const y = Math.round((Date.parse(c.warranty_until) - Date.parse(c.completed_at)) / (365.25 * 864e5));
  return y >= 1 ? y : null;
}

function label(c, w, pos) {
  const v = c[w.key], vd = verdictOf(v, w.min);
  return `<button type="button" class="pp-lbl pp-lbl-${pos}" data-kind="${w.kind}" aria-pressed="${w.kind === picked}"
    aria-label="${esc(w.label)}: ${has(v) ? `${v}%` : 'tiada bacaan'}${vd ? `, ${VERDICT_WORD[vd].toLowerCase()}` : ''}">
    <span>${esc(w.short)}</span><b class="${vd || 'none'}">${has(v) ? `${v}%` : '-'}</b></button>`;
}

function detail(c) {
  const w = VLT_WINDOWS.find((x) => x.kind === picked), v = c[w.key], vd = verdictOf(v, w.min), p = photo(c, w.kind);
  const limit = w.min ? `, min ${w.min}%` : ', tiada had JPJ';
  const word = vd === 'ok' ? '<b class="ok">Dalam had JPJ.</b>' : vd === 'bad' ? '<b class="bad">Bawah had JPJ.</b>' : '';
  const by = [c.installer && `Diukur oleh ${esc(c.installer)}`, p && hhmm(p.at)].filter(Boolean).join(', ');
  return `<div class="pp-detail${p ? '' : ' no-photo'}">
  ${p ? `<a class="pp-shot" href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="Foto meter VLT pada ${esc(w.label.toLowerCase())}"></a>` : ''}
  <div><p class="pp-big">${has(v) ? `${v}%` : '-'}</p>
  <p>${esc(w.label)}${limit}. ${has(v) ? word : 'Tiada bacaan direkod untuk cermin ini.'}${by ? ` ${by}.` : ''}</p>
  ${!p && has(v) ? '<p class="pp-dim">Tiada foto meter untuk cermin ini.</p>' : ''}</div></div>`;
}

function show(c) {
  current = c;
  document.title = `Sijil ${c.ref} | ${SHOP.name}`;
  const car = photo(c, 'car'), sum = jpjSummary(c), years = warrantyYears(c), anyPhoto = photosOf(c).some((p) => p.kind !== 'car');
  const anyReading = VLT_WINDOWS.some((w) => has(c[w.key]));
  const [ws, fr, rr] = VLT_WINDOWS;
  box.innerHTML = `<article class="pp" aria-labelledby="pp-title">
  <header class="pp-top${car ? ' has-photo' : ''}">
    ${car ? `<img class="pp-car" src="${esc(car.url)}" alt="Kereta selepas siap dipasang tinted">` : ''}
    <div class="pp-id">
      <p class="pp-eyebrow">Pasport tint · No. ${esc(c.ref)}</p>
      <h1 id="pp-title">${esc(c.car_model || 'Kereta anda')}</h1>
      <p class="pp-sub">${esc([c.plate, c.film, c.completed_at && dateLabel(c.completed_at)].filter(Boolean).join(' · '))}</p>
      <p class="pp-sub">Untuk ${esc(c.customer)}</p>
    </div>
  </header>
  <section class="pp-plan" aria-label="Bacaan VLT selepas pasang">
    ${sum === 'ok' ? `<p class="pp-sum ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${MEETS_JPJ}</p>`
      : sum === 'bad' ? '<p class="pp-sum bad">Ada cermin di bawah had JPJ semasa diukur</p>' : ''}
    ${anyReading ? `<div class="pp-car-plan">
      ${label(c, ws, 'front')}${label(c, fr, 'mid')}${label(c, rr, 'back')}
      <div class="pp-svg-wrap">${plan(picked)}</div>
    </div>
    <p class="pp-hint">${anyPhoto ? 'Tekan cermin untuk lihat foto meternya' : 'Tekan cermin untuk lihat bacaannya'}</p>`
      : '<p class="pp-hint">Bacaan VLT tidak direkodkan untuk kerja ini.</p>'}
  </section>
  ${anyReading ? `<div data-detail aria-live="polite">${detail(c)}</div>` : ''}
  <section class="pp-warranty">
    <div class="pp-ring" aria-hidden="true">${years ? `${years}<small>thn</small>` : '?'}</div>
    <div><h2>${years ? `Waranti ${years} tahun` : 'Waranti'}</h2>
    <p>${c.warranty_until ? `Hingga ${dateLabel(c.warranty_until)}.` : 'Tempoh waranti: rujuk kedai.'} Ada masalah filem? WhatsApp kami dengan nombor sijil ${esc(c.ref)}.</p></div>
  </section>
  <p class="pp-fine">Bacaan diukur pada cermin kilang dan filem bersama, selepas pasang.${anyPhoto ? ' Masa pada foto dicatat oleh sistem semasa dimuat naik.' : ''} Sijil ini rekod kedai, bukan dokumen JPJ.</p>
  <p class="pp-fine">${esc(SHOP.legalName)} · ${esc(fullAddress())}</p>
  <div class="pp-actions"><button type="button" class="btn btn-line btn-sm" data-save>Simpan gambar sijil</button></div>
</article>`;
}

function pick(kind) {
  if (!current || picked === kind) return;
  picked = kind;
  box.querySelectorAll('.pp-glass').forEach((e) => e.classList.toggle('on', e.dataset.kind === kind));
  box.querySelectorAll('.pp-lbl').forEach((e) => e.setAttribute('aria-pressed', String(e.dataset.kind === kind)));
  const d = box.querySelector('[data-detail]');
  if (d) d.innerHTML = detail(current);
}

function missing(msg) {
  const c = SHOP.contacts[0];
  box.innerHTML = `<div class="bk-done" style="margin:0 auto;max-width:520px"><h1 class="bk-q">Sijil tidak dijumpai</h1><p class="bk-hint">${msg}</p>
  <div class="bk-done-btns"><a class="form-go" href="${waLink(c.phone, 'Salam, saya perlukan pautan sijil tinted saya. Nama: , No. plat: ')}" rel="noopener">WhatsApp untuk pautan baru</a></div></div>`;
}

if (!apiReady) missing('Sistem sijil belum aktif.');
else if (!/^[0-9a-f]{36}$/.test(token)) missing('Pautan tidak lengkap. Buka semula pautan dari WhatsApp kedai.');
else rpc('get_certificate', { p_token: token })
  .then((c) => {
    if (!c) return missing('Pautan ini tidak sah atau kerja belum siap.');
    // Open on the first window that has a meter photo, else the windscreen.
    picked = VLT_WINDOWS.find((w) => photo(c, w.kind))?.kind || 'windscreen';
    show(c);
  })
  .catch(() => missing('Tidak dapat memuatkan sijil. Cuba lagi.'));

box.addEventListener('click', async (e) => {
  const win = e.target.closest('[data-kind]');
  if (win) return pick(win.dataset.kind);
  const btn = e.target.closest('[data-save]');
  if (!btn || !current) return;
  const c = current;
  btn.disabled = true;
  try {
    await saveCertImage(c, `Sijil-Tinted-Carstory-${c.ref}.png`);
  } finally { btn.disabled = false; }
});
