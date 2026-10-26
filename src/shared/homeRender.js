// Homepage sections (design: .claude/skills/design-taste-frontend, direction "One motif").
// The motif is a car side window: a block whose one edge slants like a door's rear glass.
// Every renderer here is pure: the build bakes the default catalogue, home.js repaints
// with the live one.
import { SHOP, JPJ, waLink, CAR_SIZES } from './shop.js';
import { esc, rm, hasNum, minPrice, tintOpacity, siteOf, FAQ } from './render.js';

const priceOf = (f) => minPrice(f);

// The one live thing: pick a film, darken the rear glass, read what it does.
export function filmShowcase(catalog) {
  const films = catalog.films || [];
  if (!films.length) return '';
  const first = films[0];
  const rear = Array.isArray(first.vlt) ? Math.max(first.vlt[0], 15) : 15;
  const names = films.map((f, i) => `<li><button type="button" class="pick-film" data-film="${esc(f.id)}"
      data-min="${Array.isArray(f.vlt) ? f.vlt[0] : 5}" data-max="${Array.isArray(f.vlt) ? f.vlt[1] : 70}"
      aria-pressed="${i === 0}">${esc(f.name)}</button></li>`).join('');
  const facts = films.map((f, i) => {
    const from = priceOf(f);
    const bits = [f.ir && `Tolak inframerah ${esc(f.ir)}`, hasNum(f.warranty_years) && `waranti ${f.warranty_years} tahun`, hasNum(f.uv) && `sekat UV ${f.uv}%`].filter(Boolean);
    return `<div class="film-fact" data-fact="${esc(f.id)}"${i ? ' hidden' : ''}>
  <p class="fact-line">${bits.join(', ')}.</p>
  <p class="fact-price">${from !== null ? `dari <b>${rm(from)}</b> <span>kereta kompak, 4 cermin sisi</span>` : '<b>Tanya harga</b>'}</p>
  <a class="btn-win" href="/tempah/?film=${encodeURIComponent(f.id)}">Tempah ${esc(f.name)}</a>
</div>`;
  }).join('');
  return `<div class="show-grid">
  <div class="show-stage">
    <div class="win win-show"><img src="/kedai.webp" alt="Kedai Tinted Carstory dilihat melalui cermin bertinted" width="840" height="790" loading="lazy"><i class="tint" style="--t:${tintOpacity(rear)}" data-tint></i></div>
    <div class="show-dial">
      <label for="rear">Gelapkan cermin belakang <b data-rear-out>${rear}%</b></label>
      <input id="rear" type="range" data-rear min="${Array.isArray(first.vlt) ? first.vlt[0] : 5}" max="${Array.isArray(first.vlt) ? first.vlt[1] : 70}" step="5" value="${rear}">
      <p class="verdict" data-verdict aria-live="polite">Belakang ${rear}%: dibenarkan. Cermin depan kekal ${JPJ.windscreen}% dan tingkap sisi depan ${JPJ.frontSide}%, ikut had JPJ.</p>
    </div>
  </div>
  <div class="show-list">
    <h2>Pilih filem</h2>
    <ul class="film-names" aria-label="Filem">${names}</ul>
    ${facts}
  </div>
</div>`;
}

// Add-ons and other services as one menu, priced where the owner has a price.
export function menuHtml(catalog) {
  const addons = (catalog.addons || []).map((a) => {
    const vals = Object.values(a.prices || {}).filter(hasNum).map(Number);
    return { name: a.name, price: vals.length ? `dari ${rm(Math.min(...vals))}` : 'Tanya harga', note: 'Tambah pada mana-mana filem, ikut saiz kereta.' };
  });
  const services = siteOf(catalog).services.filter((x) => x?.name).map((x) => ({
    name: x.name, price: hasNum(x.price_from) ? `dari ${rm(x.price_from)}` : 'Tanya harga', note: x.desc || '',
    wa: waLink(SHOP.contacts[0].phone, `Salam, saya nak tanya harga ${String(x.name).toLowerCase()}. Kereta saya: `),
  }));
  const group = (title, rows) => (rows.length ? `<div class="menu-cat"><div class="menu-head"><h3>${title}</h3><span>${rows.length}</span></div>
  <ul class="menu-items">${rows.map((r) => `<li><i class="win-dot" aria-hidden="true"></i><div><p class="menu-row"><b>${esc(r.name)}</b><span>${r.price}</span></p>
    <p class="menu-note">${esc(r.note)}${r.wa ? ` <a href="${r.wa}" rel="noopener">WhatsApp untuk harga</a>` : ''}</p></div></li>`).join('')}</ul></div>` : '');
  return group('Tambahan tinted', addons) + group('Servis lain', services);
}

// Questions filed like cards in a drawer: each card overlaps the one above, its tab steps right.
export function faqCards(items = FAQ) {
  return `<div class="faq-stack">${items.map(([q, a], i) => `<details class="faq-card c${i % 3}"${i === 0 ? ' open' : ''} style="--i:${i}">
  <summary><span class="faq-tab">${['JPJ', 'VLT', 'Denda', 'Sijil', 'Gelap', 'Deposit', 'Tukar slot'][i] || 'Soalan'}</span><span class="faq-q">${esc(q)}</span></summary>
  <p>${esc(a)}</p></details>`).join('')}</div>`;
}

// The coupon's right half: every way to reach the shop, as filled blocks.
export function visitLinks() {
  const q = encodeURIComponent(SHOP.mapsQuery);
  const wa = SHOP.contacts.map((c) => `<a class="coupon-link" href="${waLink(c.phone, 'Salam, saya nak tanya pasal tinted.')}" rel="noopener">WhatsApp ${esc(c.name)}</a>`).join('');
  return `${wa}<a class="coupon-link" href="https://waze.com/ul?q=${q}" rel="noopener">Buka di Waze</a><a class="coupon-link" href="https://www.google.com/maps/search/?api=1&query=${q}" rel="noopener">Buka di Google Maps</a>`;
}

// Hero booking form: the two easy questions, the price live, then the rest of the booking.
// A plain GET to /tempah/, so it works without script; the booking page skips what is answered.
export function heroForm(catalog, size = 'small') {
  const films = catalog.films || [];
  const sizes = CAR_SIZES.map((s) => `<label class="seg"><input type="radio" name="size" value="${s.id}"${s.id === size ? ' checked' : ''} required><span>${esc(s.label)}</span></label>`).join('');
  const rows = films.map((f, i) => {
    const p = f.prices?.[size];
    return `<label class="film-opt"><input type="radio" name="film" value="${esc(f.id)}"${i === 0 ? ' checked' : ''} required><span class="film-name">${esc(f.name)}</span><span class="film-rm" data-film-rm="${esc(f.id)}">${hasNum(p) ? rm(p) : 'Tanya'}</span></label>`;
  }).join('');
  return `<form class="hero-form" id="borang" action="/tempah/" method="get" aria-labelledby="borang-h">
  <h2 id="borang-h">Tempah slot</h2>
  <fieldset><legend>Saiz kereta</legend><div class="segs">${sizes}</div></fieldset>
  <fieldset><legend>Filem</legend><div class="film-opts">${rows}</div></fieldset>
  <button type="submit" class="form-go">Pilih tarikh <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
</form>`;
}
