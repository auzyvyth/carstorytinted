// Self-service booking: car + film -> day + slot -> details -> book_slot().
// The database re-checks everything (slot still free, phone valid, rate limit),
// so this page only has to be pleasant, never trusted.
import './site.css';
import './nav.js';
import { rpc, apiReady, shopDate, dayParts, dayLabel, slotLabel, DEMO } from '../shared/api.js';
import { SHOP, CAR_SIZES, waLink, displayPhone, fullAddress } from '../shared/shop.js';
import { esc, rm, hasNum } from '../shared/render.js';
import defaults from '../shared/catalog.default.json';

// Every code book_slot / the network can raise, in the customer's words.
const ERRORS = {
  consent_required: 'Sila tandakan persetujuan privasi.',
  bad_name: 'Sila isi nama penuh anda.',
  bad_phone: 'Nombor telefon tidak sah. Contoh: 012-345 6789.',
  bad_size: 'Sila pilih saiz kereta.',
  bad_film: 'Sila pilih jenis filem.',
  too_long: 'Maklumat terlalu panjang. Sila pendekkan.',
  too_many: 'Nombor ini sudah ada 3 tempahan minggu ini. WhatsApp kami untuk ubah tempahan.',
  busy: 'Terlalu banyak tempahan sekarang. Cuba lagi sebentar atau WhatsApp kami.',
  slot_closed: 'Slot ini sudah tidak dibuka. Sila pilih slot lain.',
  slot_full: 'Maaf, slot ini baru sahaja penuh. Sila pilih slot lain.',
  network: 'Tiada sambungan internet. Cuba lagi.',
};
const errText = (code) => ERRORS[code] || 'Ada masalah. Cuba lagi atau WhatsApp kami.';

const root = document.querySelector('[data-booking]');
const params = new URLSearchParams(location.search);
const st = {
  step: 1, catalog: defaults, size: null, film: params.get('film'), date: params.get('date'),
  slot: null, days: [], busy: false, error: '', done: null,
};

const film = () => st.catalog.films.find((f) => f.id === st.film);
const price = () => { const p = film()?.prices?.[st.size]; return hasNum(p) ? Number(p) : null; };

function stepper() {
  const names = ['Kereta', 'Slot', 'Butiran'];
  return `<ol class="stepper">${names.map((n, i) => {
    const s = i + 1, cls = s === st.step ? 'on' : s < st.step ? 'done' : '';
    return `<li class="${cls}"${s === st.step ? ' aria-current="step"' : ''}>${s}. ${n}</li>`;
  }).join('')}</ol>`;
}

function summary() {
  const f = film(), size = CAR_SIZES.find((s) => s.id === st.size), p = price();
  return `<aside class="panel summary" aria-label="Ringkasan tempahan">
  <p class="eyebrow" style="margin:0">Ringkasan</p>
  <div class="cert-row" style="margin-top:12px"><span>Saiz</span><b>${size ? size.label : '-'}</b></div>
  <div class="cert-row"><span>Filem</span><b>${f ? esc(f.name) : '-'}</b></div>
  <div class="cert-row"><span>Tarikh</span><b>${st.date && st.step > 1 ? dayLabel(st.date) : '-'}</b></div>
  <div class="cert-row"><span>Masa</span><b>${st.slot ? slotLabel(st.slot) : '-'}</b></div>
  <div class="total">${p !== null ? rm(p) : st.size && f ? 'Tanya harga' : '&nbsp;'}</div>
  <p class="note" style="margin-top:6px">${p !== null ? 'Harga tetap. Bayar di kedai selepas siap.' : 'Harga disahkan di kedai. Tiada deposit.'}</p>
</aside>`;
}

function step1() {
  const sizes = CAR_SIZES.map((s) => `<button type="button" class="opt" data-size="${s.id}" aria-pressed="${st.size === s.id}"><b>${s.label}</b><small>${esc(s.eg)}</small></button>`).join('');
  const films = st.catalog.films.map((f) => {
    const p = st.size ? f.prices?.[st.size] : null;
    const sub = st.size ? (hasNum(p) ? rm(p) : 'Tanya harga') : esc(f.tagline);
    return `<button type="button" class="opt" data-film="${esc(f.id)}" aria-pressed="${st.film === f.id}"><b>${esc(f.name)}</b><small>${sub}</small></button>`;
  }).join('');
  return `<div class="panel"><h2>Kereta anda</h2><p class="muted">Harga ikut saiz dan jenis filem.</p>
  <span class="field-label" id="l-size">Saiz kereta</span><div class="opts" role="group" aria-labelledby="l-size">${sizes}</div>
  <span class="field-label" id="l-film">Jenis filem</span><div class="opts" role="group" aria-labelledby="l-film">${films}</div>
  <div class="nav-btns"><button type="button" class="btn btn-cta" data-next ${st.size && film() ? '' : 'disabled'}>Pilih slot</button></div></div>`;
}

function step2() {
  const byDay = new Map();
  for (const r of st.days) { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r); }
  const days = [...byDay.entries()];
  if (!days.length) {
    return `<div class="panel"><h2>Pilih slot</h2><p class="lead" style="margin-top:12px">${st.busy ? 'Memuatkan slot...' : 'Tiada slot kosong dalam 3 minggu. WhatsApp kami untuk tarikh lain.'}</p>
    <div class="nav-btns"><button type="button" class="btn btn-line" data-back>Kembali</button></div></div>`;
  }
  if (!st.date || !byDay.has(st.date)) st.date = (days.find(([, s]) => s.some((x) => x.remaining > 0)) || days[0])[0];
  const dateBtns = days.map(([iso, slots]) => {
    const p = dayParts(iso), free = slots.filter((x) => x.remaining > 0).length;
    return `<button type="button" class="date" data-date="${iso}" aria-pressed="${st.date === iso}" ${free ? '' : 'disabled'} aria-label="${dayLabel(iso)}, ${free} slot kosong">
      <small>${p.short}</small><b>${p.date}</b><small>${free ? `${free} slot` : 'Penuh'}</small></button>`;
  }).join('');
  const slotBtns = byDay.get(st.date).map((r) => `<button type="button" class="opt" data-slot="${r.slot}" aria-pressed="${st.slot === r.slot}" ${r.remaining > 0 ? '' : 'disabled'}>
    <b>${slotLabel(r.slot)}</b><small>${r.remaining > 0 ? 'Kosong' : 'Penuh'}</small></button>`).join('');
  return `<div class="panel"><h2>Pilih slot</h2><p class="muted">Hanya hari yang dibuka ditunjukkan.</p>
  <span class="field-label" id="l-date">Hari</span><div class="dates" role="group" aria-labelledby="l-date">${dateBtns}</div>
  <span class="field-label" id="l-slot">Masa · ${dayLabel(st.date)}</span><div class="opts" role="group" aria-labelledby="l-slot">${slotBtns}</div>
  <div class="nav-btns"><button type="button" class="btn btn-line" data-back>Kembali</button><button type="button" class="btn btn-cta" data-next ${st.slot ? '' : 'disabled'}>Teruskan</button></div></div>`;
}

function step3() {
  const v = st.form || {};
  return `<form class="panel" data-form novalidate><h2>Butiran anda</h2><p class="muted">Kami WhatsApp untuk sahkan slot.</p>
  <div class="two">
    <div><label class="field-label" for="f-name">Nama</label><input class="input" id="f-name" name="name" autocomplete="name" required maxlength="80" value="${esc(v.name)}"></div>
    <div><label class="field-label" for="f-phone">No. telefon (WhatsApp)</label><input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="012-345 6789" value="${esc(v.phone)}"></div>
    <div><label class="field-label" for="f-car">Model kereta</label><input class="input" id="f-car" name="car" maxlength="60" placeholder="cth. Myvi 2022" value="${esc(v.car)}"></div>
    <div><label class="field-label" for="f-plate">No. plat <span class="muted">(pilihan)</span></label><input class="input" id="f-plate" name="plate" maxlength="12" autocapitalize="characters" value="${esc(v.plate)}"></div>
  </div>
  <label class="field-label" for="f-notes">Catatan <span class="muted">(pilihan)</span></label>
  <textarea class="input" id="f-notes" name="notes" rows="3" maxlength="500" placeholder="cth. cermin belakang sahaja, tinted lama perlu dibuang">${esc(v.notes)}</textarea>
  <div class="hp" aria-hidden="true"><label>Laman web<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <label class="consent"><input type="checkbox" name="consent" ${v.consent ? 'checked' : ''} required><span>Saya setuju data ini digunakan untuk tempahan, sijil dan waranti saya seperti dalam <a href="/privasi/" target="_blank">notis privasi</a>.</span></label>
  ${st.error ? `<p class="err" role="alert">${esc(st.error)}</p>` : ''}
  <div class="nav-btns"><button type="button" class="btn btn-line" data-back>Kembali</button><button class="btn btn-cta" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Menghantar...' : 'Sahkan tempahan'}</button></div>
</form>`;
}

function doneView() {
  const d = st.done, shopMsg = `Salam, saya dah tempah slot tinted. No. rujukan ${d.ref}, ${dayLabel(d.date)} ${slotLabel(d.slot)}.`;
  const contact = SHOP.contacts[0];
  return `<div class="panel done-box" role="status">
  <p class="eyebrow">Tempahan diterima</p>
  <div class="ref">${esc(d.ref)}</div>
  <p class="muted">Nombor rujukan anda</p>
  <p class="lead" style="margin:20px auto 0">${dayLabel(d.date)}, ${slotLabel(d.slot)}<br>${esc(fullAddress())}</p>
  <p class="note">Kami akan WhatsApp untuk sahkan. Mahu cepat? Hantar mesej kepada kami sekarang.</p>
  ${DEMO ? '<p class="note"><b>Demo:</b> tempahan ini kini ada di <a href="/staff/">app staf</a> (log masuk sebagai pemilik).</p>' : ''}
  <div class="row-btns">
    <a class="btn btn-cta" href="${waLink(contact.phone, shopMsg)}" rel="noopener">WhatsApp ${esc(contact.name)}</a>
    <button type="button" class="btn btn-line" data-ics>Simpan ke kalendar</button>
    <a class="btn btn-line" href="https://waze.com/ul?q=${encodeURIComponent(SHOP.mapsQuery)}" rel="noopener">Waze</a>
  </div></div>`;
}

function offlineView() {
  return `<div class="panel"><h2>Tempah melalui WhatsApp</h2><p class="lead" style="margin:12px 0 20px">Tempahan online akan dibuka tidak lama lagi.</p>
  <div class="row-btns">${SHOP.contacts.map((c) => `<a class="btn btn-cta" href="${waLink(c.phone, 'Salam, saya nak tempah slot tinted.')}">${esc(c.name)} ${displayPhone(c.phone)}</a>`).join('')}</div></div>`;
}

function render() {
  if (!apiReady) { root.innerHTML = offlineView(); return; }
  if (st.done) { root.innerHTML = doneView(); return; }
  const body = st.step === 1 ? step1() : st.step === 2 ? step2() : step3();
  root.innerHTML = `${stepper()}<div class="book-grid"><div>${body}</div>${summary()}</div>`;
}

function saveForm() {
  const f = root.querySelector('[data-form]');
  if (!f) return;
  const d = new FormData(f);
  st.form = { name: d.get('name'), phone: d.get('phone'), car: d.get('car'), plate: d.get('plate'), notes: d.get('notes'), consent: d.get('consent') === 'on' };
}

async function loadDays() {
  st.busy = true; render();
  try {
    st.days = await rpc('available_slots', { p_from: shopDate(0), p_days: 21 });
  } catch (e) { st.days = []; st.error = errText(e.code); }
  st.busy = false; render();
}

function go(step) {
  saveForm();
  st.step = step; st.error = '';
  if (step === 2) loadDays(); else render();
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// The form is long on a phone: after each pick, bring the next question into view.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
function ahead(sel) {
  const el = root.querySelector(sel);
  if (!el) return;
  const button = el.matches('[data-next]');
  el.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: button ? 'center' : 'start' });
}

root.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.size) { st.size = b.dataset.size; render(); ahead(film() ? '[data-next]' : '#l-film'); }
  else if (b.dataset.film) { st.film = b.dataset.film; render(); ahead(st.size ? '[data-next]' : '#l-size'); }
  else if (b.dataset.date) { st.date = b.dataset.date; st.slot = null; render(); ahead('#l-slot'); }
  else if (b.dataset.slot) { st.slot = b.dataset.slot; render(); ahead('[data-next]'); }
  else if ('next' in b.dataset) go(st.step + 1);
  else if ('back' in b.dataset) go(st.step - 1);
  else if ('ics' in b.dataset) downloadIcs();
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveForm();
  const d = new FormData(e.target);
  if (d.get('website')) { st.done = { ref: '------', date: st.date, slot: st.slot }; render(); return; } // bot
  if (!st.form.consent) { st.error = ERRORS.consent_required; render(); return; }
  st.busy = true; st.error = ''; render();
  try {
    st.done = await rpc('book_slot', {
      p_name: st.form.name, p_phone: st.form.phone, p_car_model: st.form.car, p_plate: st.form.plate,
      p_car_size: st.size, p_film_id: st.film, p_date: st.date, p_slot: st.slot, p_notes: st.form.notes, p_consent: true,
    });
  } catch (err) {
    st.error = errText(err.code);
    // A slot that filled up meanwhile: send them back to pick another, with fresh counts.
    if (err.code === 'slot_full' || err.code === 'slot_closed') { st.slot = null; st.busy = false; go(2); return; }
  }
  st.busy = false; render();
});

function downloadIcs() {
  const d = st.done, [h, m] = d.slot.split(':').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  // Malaysia is UTC+8 all year: convert the local slot to UTC for the calendar.
  const start = new Date(Date.UTC(...d.date.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))), h - 8, m));
  const fmt = (t) => `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tinted Carstory//MS', 'BEGIN:VEVENT',
    `UID:${d.ref}@tintedcarstory`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(new Date(start.getTime() + 3 * 36e5))}`, `SUMMARY:Pasang tinted - ${SHOP.name} (${d.ref})`,
    `LOCATION:${fullAddress().replace(/,/g, '\\,')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `tinted-${d.ref}.ics`;
  a.click();
}

// Preselect from the home page links (?film=, ?date=) and use live prices.
render();
if (apiReady) {
  rpc('get_catalog').then((c) => { if (c?.films) { st.catalog = c; render(); } }).catch(() => {});
}
