// Self-service booking, ONE question per screen (owner's call, 2026-09-28): size ->
// film -> add-ons -> day -> time -> wait/leave -> details -> book_slot(). A tap answers
// and slides to the next unanswered question; only the last screen needs typing.
// The database re-checks everything (slot still free, phone valid, rate limit),
// so this page only has to be pleasant, never trusted.
import './site.css';
import './nav.js';
import { rpc, apiReady, shopDate, dayParts, dayLabel, slotLabel, DEMO } from '../shared/api.js';
import { SHOP, CAR_SIZES, waLink, displayPhone, fullAddress, POLICY, WAIT_MODES, HEARD_FROM, CAR_MODELS } from '../shared/shop.js';
import { esc, rm, hasNum, quote } from '../shared/render.js';
import defaults from '../shared/catalog.default.json';

// Every code book_slot / the network can raise, in the customer's words.
const ERRORS = {
  consent_required: 'Sila tandakan persetujuan privasi.',
  bad_name: 'Sila isi nama penuh anda.',
  bad_phone: 'Nombor telefon tidak sah. Contoh: 012-345 6789.',
  bad_size: 'Sila pilih saiz kereta.',
  bad_plate: 'Sila isi nombor plat kereta (untuk sijil dan waranti).',
  bad_addon: 'Pilihan tambahan tidak sah. Muat semula halaman.',
  bad_input: 'Ada maklumat tidak sah. Muat semula halaman.',
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
  step: 'saiz', catalog: defaults, model: '', size: null, film: params.get('film'), addons: [], addonsDone: false,
  date: params.get('date'), moreDays: false, slot: null, wait: null, days: [], daysLoaded: false, busy: false, error: '', done: null, dir: 1,
};

const film = () => st.catalog.films.find((f) => f.id === st.film);
const q = () => quote(st.catalog, st.size, st.film, st.addons);
const byDay = () => { const m = new Map(); for (const r of st.days) { if (!m.has(r.day)) m.set(r.day, []); m.get(r.day).push(r); } return m; };
const dayFree = (iso) => (byDay().get(iso) || []).some((r) => r.remaining > 0);

// The questions, in order. Add-ons only when the shop lists some.
const STEPS = () => ['saiz', 'filem', ...((st.catalog.addons || []).length ? ['tambahan'] : []), 'hari', 'masa', 'tunggu', 'butiran'];
const answered = {
  saiz: () => Boolean(st.size), filem: () => Boolean(film()), tambahan: () => st.addonsDone,
  hari: () => Boolean(st.date) && st.daysLoaded && dayFree(st.date), masa: () => Boolean(st.slot), tunggu: () => Boolean(st.wait), butiran: () => false,
};
// After an answer: the first question after this one still open (a ?film= link skips "filem").
function advance() {
  const list = STEPS(), at = list.indexOf(st.step);
  go(list.slice(at + 1).find((k) => !answered[k]()) || 'butiran', 1);
}

function progress() {
  const list = STEPS(), at = list.indexOf(st.step);
  return `<div class="wiz-top">
  ${at > 0 ? '<button type="button" class="wiz-back" data-back aria-label="Soalan sebelum">&larr;</button>' : '<span class="wiz-back" aria-hidden="true"></span>'}
  <div class="wiz-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${list.length}" aria-valuenow="${at + 1}" aria-label="Langkah ${at + 1} daripada ${list.length}"><i style="width:${((at + 1) / list.length) * 100}%"></i></div>
  <span class="wiz-count">${at + 1}/${list.length}</span></div>`;
}

// What is picked so far, one tap to change any of it, and the running price.
function summaryBar() {
  const size = CAR_SIZES.find((x) => x.id === st.size), f = film(), { lines, total, known } = q();
  const chip = (step, text) => `<button type="button" class="wiz-chip" data-goto="${step}">${esc(text)}</button>`;
  const chips = [
    size && chip('saiz', size.label), f && chip('filem', f.name),
    st.addons.length && chip('tambahan', `+${st.addons.length} tambahan`),
    st.date && st.step !== 'hari' && answered.hari() && chip('hari', dayLabel(st.date)), st.slot && chip('masa', slotLabel(st.slot)),
  ].filter(Boolean).join('');
  const price = !lines.length ? '' : total !== null ? rm(total) : known ? `<small>dari</small> ${rm(known)}` : 'Tanya harga';
  if (!chips && !price) return '';
  return `<div class="wiz-sum" aria-label="Pilihan anda"><div class="wiz-chips">${chips}</div>${price ? `<div class="wiz-total">${price}</div>` : ''}</div>`;
}

const tile = (attr, val, pressed, title, sub = '', disabled = false) => `<button type="button" class="tile" ${attr}="${esc(val)}" aria-pressed="${pressed}" ${disabled ? 'disabled' : ''}><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
const screen = (title, hint, body, foot = '') => `<h2 class="wiz-q">${title}</h2>${hint ? `<p class="muted wiz-hint">${hint}</p>` : ''}${body}${foot}`;

const VIEWS = {
  saiz: () => screen('Saiz kereta anda?', 'Harga ikut saiz.', `<div class="tiles">${CAR_SIZES.map((x) => tile('data-size', x.id, st.size === x.id, x.label, esc(x.eg))).join('')}</div>`),
  filem: () => screen('Pilih filem', 'Untuk 4 cermin sisi. Semua sekat UV 99%.', `<div class="tiles one">${st.catalog.films.map((f) => {
    const p = f.prices?.[st.size];
    const bits = [hasNum(p) ? `<span class="tile-price">${rm(p)}</span>` : '<span class="tile-price ask">Tanya harga</span>', esc(f.tagline), hasNum(f.warranty_years) ? `waranti ${f.warranty_years} tahun` : ''].filter(Boolean);
    return tile('data-film', f.id, st.film === f.id, esc(f.name), bits.join(' · '));
  }).join('')}</div>`),
  tambahan: () => screen('Perlu tambahan?', 'Pilih seberapa banyak yang perlu, atau terus.', `<div class="tiles">${(st.catalog.addons || []).map((a) => {
    const p = a.prices?.[st.size];
    return tile('data-addon', a.id, st.addons.includes(a.id), esc(a.name), hasNum(p) ? `+ ${rm(p)}` : 'Tanya harga');
  }).join('')}</div><p class="note">Ada tinted lama? Pilih "Buang tinted lama": ia ambil masa lebih.</p>`,
  `<div class="wiz-foot"><button type="button" class="btn btn-cta" data-addons-done>${st.addons.length ? `Teruskan · ${st.addons.length} dipilih` : 'Tiada tambahan, teruskan'}</button></div>`),
  hari: () => {
    if (!st.daysLoaded) return screen('Hari apa?', '', '<div class="tiles days">' + '<div class="skeleton"></div>'.repeat(6) + '</div>');
    const days = [...byDay().entries()];
    if (!days.length) return screen('Hari apa?', '', `<p class="lead">Tiada slot kosong dalam 3 minggu. <a href="${waLink(SHOP.contacts[0].phone, 'Salam, saya nak tempah slot tinted.')}">WhatsApp kami</a> untuk tarikh lain.</p>`);
    // Nine days is a choice; eighteen is a calendar to read. The rest are one tap away.
    const shown = st.moreDays || days.length <= 12 ? days : days.slice(0, 9);
    return screen('Hari apa?', 'Hanya hari kedai dibuka.', `<div class="tiles days">${shown.map(([iso, slots]) => {
      const p = dayParts(iso), free = slots.filter((x) => x.remaining > 0).length;
      return `<button type="button" class="tile day" data-date="${iso}" aria-pressed="${st.date === iso}" ${free ? '' : 'disabled'} aria-label="${dayLabel(iso)}, ${free} slot kosong">
        <small>${p.short}</small><b>${p.date} ${p.mon}</b><small>${free ? `${free} slot` : 'Penuh'}</small></button>`;
    }).join('')}</div>${shown.length < days.length ? '<div class="wiz-foot"><button type="button" class="btn btn-line" data-more-days>Lebih banyak tarikh</button></div>' : ''}`);
  },
  masa: () => screen('Pukul berapa?', esc(dayLabel(st.date)), `<div class="tiles">${(byDay().get(st.date) || []).map((r) =>
    tile('data-slot', r.slot, st.slot === r.slot, slotLabel(r.slot), r.remaining > 0 ? 'Kosong' : 'Penuh', r.remaining < 1)).join('')}</div>`),
  tunggu: () => screen('Semasa kerja dibuat?', 'Supaya kami tahu bila perlu siap.', `<div class="tiles">${WAIT_MODES.map(([k, l]) => tile('data-wait', k, st.wait === k, l)).join('')}</div>`),
  butiran: () => {
    const v = st.form || {};
    return `<form data-form novalidate>${screen('Butiran anda', 'Kami WhatsApp untuk sahkan slot.', `
  <div class="two">
    <div><label class="field-label" for="f-name">Nama</label><input class="input" id="f-name" name="name" autocomplete="name" required maxlength="80" value="${esc(v.name)}"></div>
    <div><label class="field-label" for="f-phone">No. telefon (WhatsApp)</label><input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="012-345 6789" value="${esc(v.phone)}"></div>
    <div><label class="field-label" for="f-plate">No. plat</label><input class="input" id="f-plate" name="plate" maxlength="12" required autocapitalize="characters" placeholder="cth. PKA 1234" value="${esc(v.plate)}"></div>
    <div><label class="field-label" for="f-model">Model kereta <span class="muted">(pilihan)</span></label><input class="input" id="f-model" name="model" list="car-models" maxlength="60" autocomplete="off" placeholder="cth. Myvi 2021" value="${esc(st.model)}">
      <datalist id="car-models">${CAR_MODELS.map(([m]) => `<option value="${esc(m)}">`).join('')}</datalist></div>
  </div>
  <details class="more"${v.heard || v.notes ? ' open' : ''}><summary>Tambah catatan (pilihan)</summary>
    <label class="field-label" for="f-heard">Dari mana anda tahu tentang kami?</label>
    <select class="input" id="f-heard" name="heard"><option value="">Pilih</option>${HEARD_FROM.map(([k, l]) => `<option value="${k}"${v.heard === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <label class="field-label" for="f-notes">Catatan</label>
    <textarea class="input" id="f-notes" name="notes" rows="3" maxlength="500" placeholder="cth. mahu cermin belakang lebih gelap">${esc(v.notes)}</textarea>
  </details>
  <div class="hp" aria-hidden="true"><label>Laman web<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <label class="consent"><input type="checkbox" name="consent" ${v.consent ? 'checked' : ''} required><span>Saya setuju data ini digunakan untuk tempahan, sijil dan waranti saya seperti dalam <a href="/privasi/" target="_blank">notis privasi</a>.</span></label>
  ${st.error ? `<p class="err" role="alert">${esc(st.error)}</p>` : ''}`,
    `<div class="wiz-foot"><button class="btn btn-cta" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Menghantar...' : 'Sahkan tempahan'}</button></div>`)}</form>`;
  },
};

function doneView() {
  const d = st.done, shopMsg = `Salam, saya dah tempah slot tinted. No. rujukan ${d.ref}, ${dayLabel(d.date)} ${slotLabel(d.slot)}.`;
  const contact = SHOP.contacts[0];
  return `<div class="panel done-box" role="status">
  <p class="eyebrow">Tempahan diterima</p>
  <div class="ref">${esc(d.ref)}</div>
  <p class="muted">Nombor rujukan anda</p>
  <p class="lead" style="margin:20px auto 0">${dayLabel(d.date)}, ${slotLabel(d.slot)}<br>${esc(fullAddress())}</p>
  <p class="note">Kami akan WhatsApp untuk sahkan. Mahu cepat? Hantar mesej kepada kami sekarang.</p>
  <p class="note">${esc(POLICY.late)}</p>
  ${d.manage_token ? `<div class="note" style="margin-top:16px"><b>Halaman tempahan anda:</b> status, batal, dan selepas siap, resit dan sijil waranti. Simpan pautan ini (ia juga ada dalam WhatsApp kami).
    <div class="row-btns" style="margin-top:10px;justify-content:center"><a class="btn btn-line" href="/urus/?t=${esc(d.manage_token)}">Buka tempahan saya</a></div></div>` : ''}
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
  const view = VIEWS[st.step] ? st.step : 'saiz';
  root.innerHTML = `<div class="wiz">${progress()}<div class="wiz-card panel ${st.dir < 0 ? 'from-left' : 'from-right'}" data-screen="${view}">${VIEWS[view]()}${st.error && view !== 'butiran' ? `<p class="err" role="alert">${esc(st.error)}</p>` : ''}</div>${summaryBar()}</div>`;
  st.dir = 0;  // slide only when the question changes, not on every repaint
}

function saveForm() {
  const f = root.querySelector('[data-form]');
  if (!f) return;
  const d = new FormData(f);
  st.model = String(d.get('model') || '').trim();
  st.form = { name: d.get('name'), phone: d.get('phone'), plate: d.get('plate'), heard: d.get('heard'), notes: d.get('notes'), consent: d.get('consent') === 'on' };
}

async function loadDays() {
  st.busy = true;
  try {
    st.days = await rpc('available_slots', { p_from: shopDate(0), p_days: 21 });
  } catch (e) { st.days = []; st.error = errText(e.code); }
  st.daysLoaded = true; st.busy = false;
  // A date from the home page that has no free slot left: ask again.
  if (st.date && !dayFree(st.date)) st.date = null;
  if (st.step === 'masa' && !st.date) st.step = 'hari';
  // Came in with ?date= from the home page and it is still open: straight to the time.
  if (st.step === 'hari' && answered.hari()) { advance(); return; }
  render();
}

// Each question is a history entry, so the phone's back gesture goes back one question.
function go(step, dir, { push = true } = {}) {
  saveForm();
  st.step = step; st.dir = dir; st.error = '';
  if (push) history.pushState({ step }, '', location.pathname + location.search);
  if ((step === 'hari' || step === 'masa') && !st.daysLoaded) loadDays();
  render();
  root.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' });
}
const calm = matchMedia('(prefers-reduced-motion: reduce)');
history.replaceState({ step: st.step }, '', location.pathname + location.search);
addEventListener('popstate', (e) => { if (!st.done && e.state?.step) go(e.state.step, -1, { push: false }); });

// A tap answers; the pressed state shows for a beat, then the next question slides in.
const soon = (fn) => setTimeout(fn, calm.matches ? 0 : 160);
root.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.size) { st.size = b.dataset.size; render(); soon(advance); }
  else if (b.dataset.film) { st.film = b.dataset.film; render(); soon(advance); }
  else if (b.dataset.addon) { const id = b.dataset.addon; st.addons = st.addons.includes(id) ? st.addons.filter((x) => x !== id) : [...st.addons, id]; render(); }
  else if ('addonsDone' in b.dataset) { st.addonsDone = true; advance(); }
  else if (b.dataset.date) { st.date = b.dataset.date; st.slot = null; render(); soon(advance); }
  else if (b.dataset.slot) { st.slot = b.dataset.slot; render(); soon(advance); }
  else if (b.dataset.wait) { st.wait = b.dataset.wait; render(); soon(advance); }
  else if ('moreDays' in b.dataset) { st.moreDays = true; render(); }
  else if (b.dataset.goto) go(b.dataset.goto, -1);
  else if ('back' in b.dataset) history.back();
  else if ('ics' in b.dataset) downloadIcs();
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveForm();
  const d = new FormData(e.target);
  if (d.get('website')) { st.done = { ref: '------', date: st.date, slot: st.slot }; render(); return; } // bot
  if (String(st.form.plate || '').replace(/\s/g, '').length < 2) { st.error = ERRORS.bad_plate; render(); return; }
  if (!st.form.consent) { st.error = ERRORS.consent_required; render(); return; }
  st.busy = true; st.error = ''; render();
  try {
    st.done = await rpc('book_slot', {
      p_name: st.form.name, p_phone: st.form.phone, p_car_model: st.model, p_plate: st.form.plate,
      p_car_size: st.size, p_film_id: st.film, p_date: st.date, p_slot: st.slot, p_notes: st.form.notes, p_consent: true,
      p_addons: st.addons, p_wait_mode: st.wait, p_heard_from: st.form.heard || null,
    });
  } catch (err) {
    st.error = errText(err.code);
    // A slot that filled up meanwhile: send them back to pick another, with fresh counts.
    if (err.code === 'slot_full' || err.code === 'slot_closed') { const msg = st.error; st.slot = null; st.busy = false; st.daysLoaded = false; go('masa', -1); st.error = msg; render(); return; }
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
