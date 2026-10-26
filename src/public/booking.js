// Self-service booking (redesign 2026-10-26, owner: "prioritise visual load, max 2 options per
// stage, never a full form"). Each screen asks at most TWO things, and a tap answers and moves on:
//   saiz -> filem -> (tambahan) -> bila (day + time) -> tunggu (2 choices) -> anda (name + WhatsApp)
//   -> kereta (plate + model) -> sahkan (review + consent) -> book_slot()
// Anything already answered by the link (?size= ?film= from the hero form, ?film=&ws=&front=
// &rear=&warna= from the tint preview, ?date= from the next-free-slot card) is skipped.
// Beside the questions, "Tempahan anda" fills in as they answer: the same car drawing as the
// certificate, shaded with the darkness and colour picked on the home page.
// The database re-checks everything (slot still free, phone valid, rate limit), so this page only
// has to be pleasant, never trusted.
import './site.css';
import './hero.css';
import './cert.css';
import './booking.css';
import './dark.css';
import './nav.js';
import { rpc, apiReady, shopDate, dayParts, dayLabel, slotLabel, DEMO } from '../shared/api.js';
import { SHOP, CAR_SIZES, JPJ, waLink, displayPhone, fullAddress, POLICY, WAIT_MODES, CAR_MODELS } from '../shared/shop.js';
import { esc, rm, hasNum, quote, TINT_COLOURS, carPlanSvg } from '../shared/render.js';
import defaults from '../shared/catalog.default.json';

// Every code book_slot / the network can raise, in the customer's words, and the screen that fixes it.
const ERRORS = {
  consent_required: ['Sila tandakan persetujuan privasi.', 'sahkan'],
  bad_name: ['Sila isi nama penuh anda.', 'anda'],
  bad_phone: ['Nombor telefon tidak sah. Contoh: 012-345 6789.', 'anda'],
  bad_size: ['Sila pilih saiz kereta.', 'saiz'],
  bad_plate: ['Sila isi nombor plat kereta (untuk sijil dan waranti).', 'kereta'],
  bad_addon: ['Pilihan tambahan tidak sah. Muat semula halaman.'],
  bad_input: ['Ada maklumat tidak sah. Muat semula halaman.'],
  bad_film: ['Sila pilih jenis filem.', 'filem'],
  too_long: ['Maklumat terlalu panjang. Sila pendekkan.'],
  too_many: ['Nombor ini sudah ada 3 tempahan minggu ini. WhatsApp kami untuk ubah tempahan.'],
  busy: ['Terlalu banyak tempahan sekarang. Cuba lagi sebentar atau WhatsApp kami.'],
  slot_closed: ['Slot ini sudah tidak dibuka. Sila pilih masa lain.', 'bila'],
  slot_full: ['Maaf, slot ini baru sahaja penuh. Sila pilih masa lain.', 'bila'],
  network: ['Tiada sambungan internet. Cuba lagi.'],
};
const errText = (code) => (ERRORS[code] || ['Ada masalah. Cuba lagi atau WhatsApp kami.'])[0];

const root = document.querySelector('[data-booking]');
const params = new URLSearchParams(location.search);
const st = {
  step: 'saiz', catalog: defaults, size: CAR_SIZES.some((s) => s.id === params.get('size')) ? params.get('size') : null, film: params.get('film'),
  addons: [], addonsDone: false, date: params.get('date'), slot: null, wait: null, days: [], daysLoaded: false, moreDays: false,
  name: '', phone: '', plate: '', model: '', consent: false, busy: false, error: '', done: null, dir: 1,
};

// The look set on the home page preview (tint.js): shown while booking and saved at the top of
// the notes, so the shop sees what the customer chose. Never darker than the JPJ limits.
const vltOf = (k, lo) => { const v = Number(params.get(k)); return params.get(k) && Number.isInteger(v) && v >= lo && v <= 100 ? v : null; };
const vltText = (v) => (v === 100 ? 'tiada filem' : `${v}%`);
const LOOKV = { windscreen: vltOf('ws', JPJ.windscreen), front: vltOf('front', JPJ.frontSide), rear: vltOf('rear', 5) };
const COLOUR = TINT_COLOURS.find(([id]) => id === params.get('warna'));
const HAS_LOOK = Object.values(LOOKV).some((v) => v !== null);
const LOOK = HAS_LOOK || COLOUR ? `Pilihan pratonton: ${[['cermin depan', LOOKV.windscreen], ['tingkap depan', LOOKV.front], ['belakang', LOOKV.rear]]
  .filter(([, v]) => v !== null).map(([k, v]) => `${k} ${vltText(v)}`).concat(COLOUR ? [`warna ${COLOUR[1]}`] : []).join(', ')}.` : '';

const film = () => st.catalog.films.find((f) => f.id === st.film);
const sizeOf = () => CAR_SIZES.find((x) => x.id === st.size);
const q = () => quote(st.catalog, st.size, st.film, st.addons);
const byDay = () => { const m = new Map(); for (const r of st.days) { if (!m.has(r.day)) m.set(r.day, []); m.get(r.day).push(r); } return m; };
const dayFree = (iso) => (byDay().get(iso) || []).some((r) => r.remaining > 0);
const slotFree = () => (byDay().get(st.date) || []).some((r) => r.slot === st.slot && r.remaining > 0);
const digits = (s) => String(s).replace(/\D/g, '');

const STEPS = () => ['saiz', 'filem', ...((st.catalog.addons || []).length ? ['tambahan'] : []), 'bila', 'tunggu', 'anda', 'kereta', 'sahkan'];
const answered = {
  saiz: () => Boolean(st.size), filem: () => Boolean(film()), tambahan: () => st.addonsDone,
  bila: () => Boolean(st.slot) && st.daysLoaded && slotFree(), tunggu: () => Boolean(st.wait),
  anda: () => st.name.trim().length >= 2 && digits(st.phone).length >= 9, kereta: () => st.plate.replace(/\s/g, '').length >= 2, sahkan: () => false,
};
// After an answer: the first question after this one still open.
function advance() {
  const list = STEPS(), at = list.indexOf(st.step);
  go(list.slice(at + 1).find((k) => !answered[k]()) || 'sahkan', 1);
}

// ---------------------------------------------------------------- the running summary
const priceHtml = () => {
  const { lines, total, known } = q();
  return !lines.length ? '' : total !== null ? rm(total) : known ? `<small>dari</small> ${rm(known)}` : 'Tanya harga';
};
function lookPlan() {
  if (!HAS_LOOK) return '';
  const lbl = (pos, short, v) => `<span class="pp-lbl pp-lbl-${pos}"><span>${short}</span><b class="free">${v === null ? '-' : v === 100 ? 'Jernih' : `${v}%`}</b></span>`;
  return `<div class="bk-look"><div class="pp-car-plan">${lbl('front', 'Depan', LOOKV.windscreen)}${lbl('mid', 'Sisi depan', LOOKV.front)}${lbl('back', 'Belakang', LOOKV.rear)}
    <div class="pp-svg-wrap">${carPlanSvg(null, { ...LOOKV, colour: COLOUR?.[2] })}</div></div>
    <p class="bk-look-note">Kegelapan yang anda pilih${COLOUR ? `, warna ${esc(COLOUR[1])}` : ''}. Kami sahkan di kedai.</p></div>`;
}
// "Tempahan anda": every answer so far, one tap to change it, and the price.
function summary() {
  const size = sizeOf(), f = film();
  // Once booked the rows are a record, not buttons.
  const row = (step, k, v) => (st.done ? `<div class="bk-row"><span>${k}</span><b>${v}</b></div>`
    : `<button type="button" class="bk-row" data-goto="${step}"><span>${k}</span><b>${v}</b></button>`);
  const rows = [
    size && row('saiz', 'Kereta', esc([size.label, st.model].filter(Boolean).join(' · '))),
    f && row('filem', 'Filem', esc(f.name)),
    st.addons.length && row('tambahan', 'Tambahan', esc(st.addons.map((a) => st.catalog.addons.find((x) => x.id === a)?.name).filter(Boolean).join(', '))),
    answered.bila() && row('bila', 'Bila', `${dayLabel(st.date)}, ${slotLabel(st.slot)}`),
    st.wait && row('tunggu', 'Semasa kerja', esc(WAIT_MODES.find(([k]) => k === st.wait)?.[1] || '')),
  ].filter(Boolean).join('');
  const price = priceHtml();
  return `<aside class="bk-sum" aria-label="Tempahan anda">
  <p class="bk-sum-h">Tempahan anda</p>
  ${lookPlan()}
  ${rows ? `<div class="bk-rows">${rows}</div>` : '<p class="bk-empty">Jawapan anda muncul di sini.</p>'}
  ${price ? `<div class="bk-price"><span>Anggaran</span><b class="bk-total">${price}</b></div><p class="bk-pay">Bayar di kedai selepas siap. Tiada deposit.</p>` : ''}
</aside>`;
}
// Phones: one line instead of the panel, so the question stays on the first screen.
function strip() {
  const size = sizeOf(), f = film(), price = priceHtml();
  const bits = [size?.label, f?.name, HAS_LOOK && [LOOKV.windscreen, LOOKV.front, LOOKV.rear].filter((v) => v !== null).join(' · ') + '%'].filter(Boolean);
  if (!bits.length && !price) return '';
  return `<div class="bk-strip">${COLOUR ? `<i style="background:${COLOUR[2]}" aria-hidden="true"></i>` : ''}<span class="bk-strip-t">${esc(bits.join(' · '))}${COLOUR ? ` ${esc(COLOUR[1])}` : ''}</span>${price ? `<b class="bk-total">${price}</b>` : ''}</div>`;
}

// ---------------------------------------------------------------- the questions
function top() {
  const list = STEPS(), at = list.indexOf(st.step);
  return `<div class="bk-top">
  ${at > 0 ? '<button type="button" class="bk-back" data-back aria-label="Soalan sebelum"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' : ''}
  <div class="bk-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${list.length}" aria-valuenow="${at + 1}" aria-label="Langkah ${at + 1} daripada ${list.length}"><i style="width:${((at + 1) / list.length) * 100}%"></i></div>
  <span class="bk-count">${at + 1}/${list.length}</span></div>`;
}
const opt = (attr, val, pressed, title, sub = '', side = '', disabled = false) => `<button type="button" class="bk-opt" ${attr}="${esc(val)}" aria-pressed="${pressed}" ${disabled ? 'disabled' : ''}>
  <span class="bk-opt-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${side ? `<span class="bk-opt-s">${side}</span>` : ''}</button>`;
const screen = (title, hint, body, foot = '') => `<h2 class="bk-q" tabindex="-1">${title}</h2>${hint ? `<p class="bk-hint">${hint}</p>` : ''}${body}${foot ? `<div class="bk-foot">${foot}</div>` : ''}`;
const next = (label = 'Teruskan', attr = 'data-next') => `<button type="submit" class="form-go" ${attr}>${label} <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`;
const field = (id, name, label, attrs, value, help = '') => `<div class="bk-field"><label for="${id}">${label}</label><input class="bk-in" id="${id}" name="${name}" ${attrs} value="${esc(value)}"${help ? ` aria-describedby="${id}-h"` : ''}>${help ? `<small id="${id}-h">${help}</small>` : ''}</div>`;

const VIEWS = {
  saiz: () => screen('Saiz kereta anda?', 'Harga ikut saiz.', `<div class="bk-opts two">${CAR_SIZES.map((x) => opt('data-size', x.id, st.size === x.id, x.label, esc(x.eg))).join('')}</div>`),
  filem: () => screen('Filem mana?', 'Untuk 4 cermin sisi. Semua sekat UV 99%.', `<div class="bk-opts">${st.catalog.films.map((f) => {
    const p = f.prices?.[st.size];
    return opt('data-film', f.id, st.film === f.id, esc(f.name), [esc(f.tagline), hasNum(f.warranty_years) ? `waranti ${f.warranty_years} tahun` : ''].filter(Boolean).join(' · '),
      hasNum(p) ? rm(p) : '<span class="ask">Tanya</span>');
  }).join('')}</div>`),
  tambahan: () => screen('Perlu tambahan?', 'Pilih jika perlu. Ada tinted lama? Pilih "Buang tinted lama".', `<div class="bk-opts two">${(st.catalog.addons || []).map((a) => {
    const p = a.prices?.[st.size];
    return opt('data-addon', a.id, st.addons.includes(a.id), esc(a.name), '', hasNum(p) ? `+${rm(p)}` : '<span class="ask">Tanya</span>');
  }).join('')}</div>`, next(st.addons.length ? `Teruskan dengan ${st.addons.length} tambahan` : 'Tiada tambahan', 'data-addons-done')),
  bila: () => {
    if (!st.daysLoaded) return screen('Bila?', '', `<div class="bk-days">${'<div class="skeleton bk-sk"></div>'.repeat(5)}</div>`);
    const days = [...byDay().entries()].filter(([iso]) => dayFree(iso));
    if (!days.length) return screen('Bila?', '', `<p class="bk-hint">Tiada slot kosong dalam 3 minggu. <a href="${waLink(SHOP.contacts[0].phone, 'Salam, saya nak tempah slot tinted.')}">WhatsApp kami</a> untuk tarikh lain.</p>`);
    // The earliest free day is picked for them: the soonest booking is two taps away.
    if (!st.date || !dayFree(st.date)) st.date = days[0][0];
    const shown = st.moreDays ? days : days.slice(0, 6);
    const dayBtn = ([iso]) => { const p = dayParts(iso); return `<button type="button" class="bk-day" data-date="${iso}" aria-pressed="${st.date === iso}" aria-label="${dayLabel(iso)}"><small>${p.short}</small><b>${p.date}</b><small>${p.mon}</small></button>`; };
    // "12:30" big, "tengah hari" under it: three fit side by side on a phone.
    const times = (byDay().get(st.date) || []).map((r) => { const [t, ...part] = slotLabel(r.slot).split(' ');
      return opt('data-slot', r.slot, st.slot === r.slot, t, r.remaining > 0 ? part.join(' ') : 'Penuh', '', r.remaining < 1); }).join('');
    return screen('Bila?', 'Hari, kemudian masa. Hanya slot yang masih kosong.', `<div class="bk-days" role="group" aria-label="Hari">${shown.map(dayBtn).join('')}${shown.length < days.length ? '<button type="button" class="bk-day bk-more" data-more-days>Lagi<small>tarikh</small></button>' : ''}</div>
  <p class="bk-sub">${esc(dayLabel(st.date))}</p><div class="bk-opts three" role="group" aria-label="Masa">${times}</div>`);
  },
  tunggu: () => screen('Semasa kerja dibuat?', 'Supaya kami tahu bila perlu siap.', `<div class="bk-opts two">${WAIT_MODES.map(([k, l]) => opt('data-wait', k, st.wait === k, l)).join('')}</div>`),
  anda: () => `<form data-form="anda" novalidate>${screen('Siapa nama anda?', 'Kami WhatsApp untuk sahkan slot.', `<div class="bk-fields">
    ${field('f-name', 'name', 'Nama', 'autocomplete="name" required maxlength="80"', st.name)}
    ${field('f-phone', 'phone', 'No. WhatsApp', 'type="tel" inputmode="tel" autocomplete="tel" required placeholder="012-345 6789"', st.phone)}</div>${err()}`, next())}</form>`,
  kereta: () => `<form data-form="kereta" novalidate>${screen('Kereta anda', 'Nombor plat untuk sijil dan waranti anda.', `<div class="bk-fields">
    ${field('f-plate', 'plate', 'No. plat', 'required maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="cth. PKA 1234"', st.plate)}
    ${field('f-model', 'model', 'Model <span>(pilihan)</span>', 'list="car-models" maxlength="60" autocomplete="off" placeholder="cth. Myvi 2021"', st.model)}
    <datalist id="car-models">${CAR_MODELS.map(([m]) => `<option value="${esc(m)}">`).join('')}</datalist></div>${err()}`, next())}</form>`,
  sahkan: () => `<form data-form="sahkan" novalidate>${screen('Semak dan sahkan', `${esc(st.name.trim().split(' ')[0])} · ${esc(st.phone.trim())} · ${esc(st.plate.trim().toUpperCase())}`, `
    <div class="bk-only-phone">${summary()}</div>
    <div class="hp" aria-hidden="true"><label>Laman web<input name="website" tabindex="-1" autocomplete="off"></label></div>
    <label class="bk-consent"><input type="checkbox" name="consent" ${st.consent ? 'checked' : ''} required><span>Saya setuju data ini digunakan untuk tempahan, sijil dan waranti saya seperti dalam <a href="/privasi/" target="_blank">notis privasi</a>.</span></label>${err()}`,
    next(st.busy ? 'Menghantar...' : 'Sahkan tempahan', st.busy ? 'disabled' : 'data-submit'))}</form>`,
};
const err = () => (st.error ? `<p class="bk-err" role="alert">${esc(st.error)}</p>` : '');

function doneView() {
  const d = st.done, shopMsg = `Salam, saya dah tempah slot tinted. No. rujukan ${d.ref}, ${dayLabel(d.date)} ${slotLabel(d.slot)}.`;
  const contact = SHOP.contacts[0];
  return `<div class="bk-done" role="status">
  <h2 class="bk-q">Tempahan diterima</h2>
  <p class="bk-ref" aria-label="Nombor rujukan ${esc(d.ref)}">${esc(d.ref)}</p>
  <p class="bk-done-when">${dayLabel(d.date)}, ${slotLabel(d.slot)}<br><span>${esc(fullAddress())}</span></p>
  <p class="bk-hint">Kami akan WhatsApp untuk sahkan. ${esc(POLICY.late)}</p>
  <div class="bk-done-btns">
    <a class="form-go" href="${waLink(contact.phone, shopMsg)}" rel="noopener">WhatsApp ${esc(contact.name)}</a>
    ${d.manage_token ? `<a class="bk-line" href="/urus/?t=${esc(d.manage_token)}">Buka tempahan saya</a>` : ''}
    <button type="button" class="bk-line" data-ics>Simpan ke kalendar</button>
    <a class="bk-line" href="https://waze.com/ul?q=${encodeURIComponent(SHOP.mapsQuery)}" rel="noopener">Waze</a>
  </div>
  ${d.manage_token ? '<p class="bk-pay">Halaman tempahan anda: status, batal, dan selepas siap, resit dan sijil. Pautan ini juga ada dalam WhatsApp kami.</p>' : ''}
  ${DEMO ? '<p class="bk-pay"><b>Demo:</b> tempahan ini kini ada di <a href="/staff/">app staf</a> (log masuk sebagai pemilik).</p>' : ''}
</div>`;
}

function offlineView() {
  return `<div class="bk-done"><h2 class="bk-q">Tempah melalui WhatsApp</h2><p class="bk-hint">Tempahan online akan dibuka tidak lama lagi.</p>
  <div class="bk-done-btns">${SHOP.contacts.map((c) => `<a class="form-go" href="${waLink(c.phone, 'Salam, saya nak tempah slot tinted.')}">${esc(c.name)} ${displayPhone(c.phone)}</a>`).join('')}</div></div>`;
}

function render({ focus = false } = {}) {
  if (!apiReady) { root.innerHTML = offlineView(); return; }
  if (st.done) { root.innerHTML = `<div class="bk"><div class="bk-main">${doneView()}</div><div class="bk-side">${summary()}</div></div>`; return; }
  const view = VIEWS[st.step] ? st.step : 'saiz';
  root.innerHTML = `<div class="bk">
  <div class="bk-main">${top()}${strip()}<div class="bk-card ${st.dir < 0 ? 'from-left' : st.dir > 0 ? 'from-right' : ''}" data-screen="${view}">${VIEWS[view]()}${st.error && !['anda', 'kereta', 'sahkan'].includes(view) ? err() : ''}</div></div>
  <div class="bk-side">${summary()}</div>
</div>`;
  st.dir = 0;  // slide only when the question changes, not on every repaint
  if (focus) (root.querySelector('[data-form] input:not([type=checkbox]):not([tabindex="-1"])') || root.querySelector('.bk-q'))?.focus({ preventScroll: true });
}

function saveForm() {
  const f = root.querySelector('[data-form]');
  if (!f) return;
  const d = new FormData(f);
  for (const k of ['name', 'phone', 'plate', 'model']) if (d.has(k)) st[k] = String(d.get(k) || '');
  if (f.dataset.form === 'sahkan') st.consent = d.get('consent') === 'on';
}

async function loadDays() {
  st.busy = true;
  try {
    st.days = await rpc('available_slots', { p_from: shopDate(0), p_days: 21 });
  } catch (e) { st.days = []; st.error = errText(e.code); }
  st.daysLoaded = true; st.busy = false;
  if (st.slot && !slotFree()) st.slot = null;
  render();
}

// Each question is a history entry, so the phone's back gesture goes back one question.
function go(step, dir, { push = true } = {}) {
  saveForm();
  st.step = step; st.dir = dir; st.error = '';
  if (push) history.pushState({ step }, '', location.pathname + location.search);
  if (step === 'bila' && !st.daysLoaded) loadDays();
  render({ focus: true });
  // Every screen fits from the top of the page: back to the top, never under the fixed header.
  if (scrollY > 0) scrollTo({ top: 0, behavior: calm.matches ? 'auto' : 'smooth' });
}
const calm = matchMedia('(prefers-reduced-motion: reduce)');
// Opens on the first open question (a ?size=&film= or tint link has answered the first ones).
st.step = STEPS().find((k) => !answered[k]()) || 'bila';
history.replaceState({ step: st.step }, '', location.pathname + location.search);
addEventListener('popstate', (e) => { if (!st.done && e.state?.step) go(e.state.step, -1, { push: false }); });

// A tap answers; the pressed state shows for a beat, then the next question slides in.
const soon = (fn) => setTimeout(fn, calm.matches ? 0 : 180);
root.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled || b.type === 'submit') return;
  if (b.dataset.size) { st.size = b.dataset.size; render(); soon(advance); }
  else if (b.dataset.film) { st.film = b.dataset.film; render(); soon(advance); }
  else if (b.dataset.addon) { const id = b.dataset.addon; st.addons = st.addons.includes(id) ? st.addons.filter((x) => x !== id) : [...st.addons, id]; render(); }
  else if (b.dataset.date) { st.date = b.dataset.date; st.slot = null; render(); }
  else if (b.dataset.slot) { st.slot = b.dataset.slot; render(); soon(advance); }
  else if (b.dataset.wait) { st.wait = b.dataset.wait; render(); soon(advance); }
  else if ('moreDays' in b.dataset) { st.moreDays = true; render(); }
  else if (b.dataset.goto) go(b.dataset.goto, -1);
  else if ('back' in b.dataset) history.back();
  else if ('ics' in b.dataset) downloadIcs();
});
// The add-ons "continue" is a submit-styled button outside a form.
root.addEventListener('click', (e) => {
  if (e.target.closest('[data-addons-done]')) { st.addonsDone = true; advance(); }
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveForm();
  const form = e.target.dataset.form;
  st.error = '';
  if (form === 'anda') {
    if (st.name.trim().length < 2) st.error = errText('bad_name');
    else if (digits(st.phone).length < 9) st.error = errText('bad_phone');
    if (st.error) return render({ focus: true });
    return advance();
  }
  if (form === 'kereta') {
    if (st.plate.replace(/\s/g, '').length < 2) { st.error = errText('bad_plate'); return render({ focus: true }); }
    return advance();
  }
  if (new FormData(e.target).get('website')) { st.done = { ref: '------', date: st.date, slot: st.slot }; render(); return; } // bot
  if (!st.consent) { st.error = errText('consent_required'); render(); return; }
  st.busy = true; render();
  try {
    st.done = await rpc('book_slot', {
      p_name: st.name, p_phone: st.phone, p_car_model: st.model.trim(), p_plate: st.plate,
      p_car_size: st.size, p_film_id: st.film, p_date: st.date, p_slot: st.slot, p_notes: LOOK, p_consent: true,
      p_addons: st.addons, p_wait_mode: st.wait, p_heard_from: null,
    });
    st.busy = false; render();
    scrollTo({ top: 0 });
  } catch (x) {
    st.busy = false;
    const [msg, fix] = ERRORS[x.code] || [errText(x.code)];
    // Send them to the screen that fixes it; a slot that filled up comes back with fresh counts.
    if (fix === 'bila') { st.slot = null; st.daysLoaded = false; }
    if (fix && fix !== 'sahkan') { go(fix, -1); st.error = msg; render(); return; }
    st.error = msg; render();
  }
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

render();
if (st.step === 'bila') loadDays();
if (apiReady) {
  rpc('get_catalog').then((c) => { if (c?.films) { st.catalog = c; render(); } }).catch(() => {});
}
