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
    <h2>Cuba tahap gelap</h2>
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

// Trust row: the four facts a customer checks first, as large figures.
export function trustRow(catalog) {
  const warranty = Math.max(...(catalog.films || []).map((f) => Number(f.warranty_years) || 0));
  const uv = Math.max(...(catalog.films || []).map((f) => Number(f.uv) || 0));
  const items = [
    [`${JPJ.windscreen}% / ${JPJ.frontSide}%`, 'Had JPJ cermin depan dan sisi, diukur selepas pasang'],
    [uv ? `${uv}%` : 'UV', 'Sinar UV disekat, semua filem'],
    [`${warranty} tahun`, 'Waranti paling lama, dalam sijil digital'],
    ['Bumiputera', `Kedai di ${SHOP.town}, Pulau Pinang`],
  ];
  return items.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join('');
}

// Drawn cars, side view, glass tinted to the legal set-up (windscreen 70, front side 50, rear 15).
// Stand-ins until the shop's own photographs exist; labelled as drawings on the page.
const CARS = {
  small: { label: 'Kecil', eg: 'Myvi, Axia, Saga', body: 'M30 92 L32 76 Q34 68 48 66 L92 60 L122 34 Q130 28 144 28 L226 28 Q238 28 242 36 L250 62 Q262 68 262 80 L262 92 Q262 98 254 98 L236 98 A22 22 0 0 0 192 98 L106 98 A22 22 0 0 0 62 98 L38 98 Q30 98 30 92 Z',
    ws: '92,60 120,36 126,35 100,60', front: '104,60 128,37 170,35 170,60', rear: '176,60 176,35 226,35 236,60', back: '240,60 235,40 240,38 246,60', wheels: [[84, 98, 20], [214, 98, 20]], dx: 14 },
  sedan: { label: 'Sedan', eg: 'Bezza, City, Vios', body: 'M20 92 L22 74 Q24 66 40 64 L88 58 L120 34 Q128 28 142 28 L208 28 Q222 28 232 36 L258 58 L292 64 Q304 66 304 78 L304 92 Q304 98 296 98 L272 98 A24 24 0 0 0 224 98 L104 98 A24 24 0 0 0 56 98 L28 98 Q20 98 20 92 Z',
    ws: '88,58 116,36 122,35 96,58', front: '100,58 124,37 166,35 166,58', rear: '172,58 172,35 212,35 236,58', back: '240,58 218,38 224,38 250,58', wheels: [[80, 98, 20], [248, 98, 20]], dx: -2 },
  suv: { label: 'SUV / MPV', eg: 'Ativa, X50, Alza', body: 'M18 96 L18 70 Q20 60 36 58 L80 52 L108 22 Q114 16 126 16 L262 16 Q276 16 282 26 L298 54 Q306 60 306 72 L306 96 Q306 102 298 102 L276 102 A24 24 0 0 0 228 102 L104 102 A24 24 0 0 0 56 102 L26 102 Q18 102 18 96 Z',
    ws: '78,52 104,24 110,23 86,52', front: '94,52 116,25 160,23 160,52', rear: '166,52 166,23 222,23 222,52', back: '228,52 228,23 272,23 290,52', wheels: [[80, 102, 22], [252, 102, 22]], dx: -2 },
};
const glass = (pts, vlt) => `<polygon points="${pts}" fill="#0a1222" fill-opacity="${tintOpacity(vlt).toFixed(2)}" stroke="#0a1222" stroke-opacity=".5" stroke-width="1"/>`;
export function carDrawing(id) {
  const c = CARS[id];
  const wheels = c.wheels.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#1a1f2b"/><circle cx="${x}" cy="${y}" r="${r * .5}" fill="#9aa3b5"/><circle cx="${x}" cy="${y}" r="${r * .16}" fill="#1a1f2b"/>`).join('');
  return `<svg class="car-draw" viewBox="0 0 320 130" role="img" aria-label="Lukisan kereta ${esc(c.label)} bertinted: cermin depan ${JPJ.windscreen}%, sisi depan ${JPJ.frontSide}%, belakang 15%">
  <ellipse cx="160" cy="122" rx="140" ry="5" fill="#0a1222" fill-opacity=".12"/>
  <g transform="translate(${c.dx} 0)"><path d="${c.body}" fill="#dfe4ee" stroke="#b9c1d1" stroke-width="1.2"/>
  <rect x="${c.wheels[0][0] + 30}" y="${c.wheels[0][1] - 26}" width="${c.wheels[1][0] - c.wheels[0][0] - 60}" height="1.4" fill="#b9c1d1"/>
  ${glass(c.ws, JPJ.windscreen)}${glass(c.front, JPJ.frontSide)}${glass(c.rear, 15)}${glass(c.back, 15)}${wheels}</g>
</svg>`;
}
export function tintGallery() {
  return Object.entries(CARS).map(([id, c]) => `<figure class="car-card">${carDrawing(id)}<figcaption><b>${esc(c.label)}</b><span>${esc(c.eg)}</span></figcaption></figure>`).join('');
}

// Film comparison: what each step up in price buys, heat rejection drawn as a bar.
const irTop = (s) => Math.max(0, ...String(s || '').match(/\d+/g)?.map(Number) || [0]);
export function filmCompare(catalog) {
  return (catalog.films || []).map((f) => {
    const from = minPrice(f), ir = irTop(f.ir);
    return `<article class="cmp">
  <h3>${esc(f.name)}</h3>
  <p class="cmp-ir"><b>${esc(f.ir || '-')}</b><span>haba inframerah ditolak</span></p>
  <i class="cmp-bar" style="--w:${ir}%" aria-hidden="true"></i>
  <dl><div><dt>UV disekat</dt><dd>${hasNum(f.uv) ? `${f.uv}%` : '-'}</dd></div><div><dt>Waranti</dt><dd>${hasNum(f.warranty_years) ? `${f.warranty_years} tahun` : '-'}</dd></div>
  <div><dt>Kegelapan</dt><dd>${Array.isArray(f.vlt) ? `${f.vlt[0]}% hingga ${f.vlt[1]}%` : '-'}</dd></div><div><dt>Harga</dt><dd>${from !== null ? `dari ${rm(from)}` : 'Tanya'}</dd></div></dl>
  <a class="cmp-go" href="/tempah/?film=${encodeURIComponent(f.id)}" aria-label="Tempah ${esc(f.name)}">Tempah</a>
</article>`;
  }).join('');
}
