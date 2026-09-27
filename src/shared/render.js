// HTML fragments shared by the build (vite.config.js bakes them into the static
// pages so search engines and AI crawlers read real text) and the browser
// (site.js re-renders the film/price parts once live prices load).
// Pure string functions: no DOM, safe to import in Node.
import { SHOP, CAR_SIZES, JPJ, waLink, displayPhone, fullAddress } from './shop.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rm = (n) => `RM${Math.round(Number(n)).toLocaleString('en-MY')}`;
export const hasNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

const NAV = [
  ['/#filem', 'Filem'],
  ['/harga/', 'Harga'],
  ['/panduan-jpj/', 'Had JPJ'],
  ['/#sijil', 'Sijil waranti'],
  ['/#lokasi', 'Lokasi'],
];

export function header(active = '') {
  const links = NAV.map(([href, label]) =>
    `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<header class="mast">
  <div class="mast-in">
    <a class="wordmark" href="/" aria-label="${esc(SHOP.name)} - laman utama"><span>Tinted</span> Carstory</a>
    <nav class="mast-nav" aria-label="Menu utama">${links}</nav>
    <a class="btn btn-cta btn-sm" href="/tempah/">Tempah slot</a>
  </div>
  <nav class="mast-nav-m" aria-label="Menu">${links}</nav>
</header>`;
}

export function footer() {
  const phones = SHOP.contacts.map((c) =>
    `<a href="${waLink(c.phone)}" rel="noopener">${esc(c.name)} ${displayPhone(c.phone)}</a>`).join('');
  return `<footer class="foot">
  <div class="wrap foot-in">
    <div>
      <div class="wordmark"><span>Tinted</span> Carstory</div>
      <p class="foot-sub">${esc(SHOP.legalName)} · ${esc(SHOP.tagline)}</p>
      <p class="foot-sub">${esc(fullAddress())}</p>
    </div>
    <div class="foot-cols">
      <div><h4>Hubungi</h4>${phones}<a href="${SHOP.facebook}" rel="noopener">Facebook</a></div>
      <div><h4>Info</h4><a href="/harga/">Harga</a><a href="/panduan-jpj/">Panduan had JPJ</a><a href="/privasi/">Privasi</a><a href="/staff/" rel="nofollow">Staf</a></div>
    </div>
  </div>
  <div class="wrap foot-base">&copy; ${new Date().getFullYear()} ${esc(SHOP.legalName)}</div>
</footer>`;
}

const mapsQ = () => encodeURIComponent(SHOP.mapsQuery);
export const mapEmbedUrl = () => `https://maps.google.com/maps?q=${mapsQ()}&output=embed`;

export function contactsHtml() {
  return SHOP.contacts.map((c) => `<div class="contact"><span><b>${esc(c.name)}</b><br><span class="muted">${displayPhone(c.phone)}</span></span>
  <a class="btn btn-line btn-sm" href="${waLink(c.phone, 'Salam, saya nak tanya pasal tinted.')}" rel="noopener">WhatsApp</a></div>`).join('');
}

export function mapLinksHtml() {
  return `<a class="btn btn-line btn-sm" href="https://waze.com/ul?q=${mapsQ()}" rel="noopener">Buka Waze</a>
<a class="btn btn-line btn-sm" href="https://www.google.com/maps/search/?api=1&query=${mapsQ()}" rel="noopener">Google Maps</a>`;
}

export function hoursHtml() {
  if (!SHOP.hours.length) return '';
  const names = { Mo: 'Isn', Tu: 'Sel', We: 'Rab', Th: 'Kha', Fr: 'Jum', Sa: 'Sab', Su: 'Aha' };
  return `<div><h3>Waktu operasi</h3>${SHOP.hours.map((h) =>
    `<p>${h.days.map((d) => names[d]).join(', ')}: ${h.opens} - ${h.closes}</p>`).join('')}</div>`;
}

// Past customers. Real photos only (SHOP.gallery); with none the section is not
// rendered, except in the sales demo, which shows labelled empty frames so the
// owner sees where his photos will go.
export function galleryHtml(demo = false) {
  const items = SHOP.gallery.length ? SHOP.gallery.map((g) => `<figure class="shot">
  <img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy" width="600" height="450">
  ${g.car || g.film ? `<figcaption><b>${esc(g.car || '')}</b>${g.film ? `<span>${esc(g.film)}</span>` : ''}</figcaption>` : ''}
</figure>`).join('') : demo ? Array.from({ length: 6 }, (_, i) => `<figure class="shot shot-empty"><div>Gambar pelanggan ${i + 1}</div>
  <figcaption><b>Model kereta</b><span>Jenis filem</span></figcaption></figure>`).join('') : '';
  if (!items) return '';
  return `<section id="galeri" class="warm"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Hasil kerja</p><h2>Kereta pelanggan kami.</h2></div>
<p>Gambar sebenar dari kedai kami di ${esc(SHOP.town)}.${SHOP.facebook ? ` Lebih banyak di <a href="${SHOP.facebook}" rel="noopener">Facebook</a>.` : ''}</p></div>
<div class="gallery">${items}</div></div></section>`;
}

export function minPrice(film) {
  const vals = Object.values(film.prices || {}).filter(hasNum).map(Number);
  return vals.length ? Math.min(...vals) : null;
}

// What every listed price covers (owner's price list). Shown next to every "dari" price.
export const PRICE_BASIS = 'Kereta kompak, 4 cermin sisi';

// How dark a window looks for a given VLT (share of light let through).
export const tintOpacity = (vlt) => +(0.94 * (1 - vlt / 100)).toFixed(3);
// Rear darkness the preview opens on, clamped into each film's range.
const PREVIEW_REAR = 30;
const clampVlt = (f, v) => (Array.isArray(f.vlt) ? Math.min(f.vlt[1], Math.max(f.vlt[0], v)) : v);

// Side view of a sedan. Seats show through the glass; each window has a tint
// layer whose opacity is its VLT, so the visitor SEES the result. Windscreen and
// front side windows are drawn at the JPJ limits and never follow the slider.
function carSvg(rearVlt) {
  const T = '#05070d';
  return `<svg class="car-view" viewBox="28 60 600 186" role="img" aria-label="Pratonton kereta bertinted: tingkap depan ${JPJ.frontSide}%, tingkap belakang ${rearVlt}%">
  <defs>
    <linearGradient id="ts-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e4e6eb"/><stop offset=".8" stop-color="#a9aeb8"/><stop offset="1" stop-color="#7d828d"/></linearGradient>
    <linearGradient id="ts-sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbe8fb"/><stop offset="1" stop-color="#8ea6c9"/></linearGradient>
    <radialGradient id="ts-shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="ts-rim" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f3f4f6"/><stop offset="1" stop-color="#6b7280"/></radialGradient>
    <clipPath id="ts-glass"><path d="M214 124 C234 104 262 88 316 84 L318 124 Z"/><path d="M328 84 C368 84 398 88 422 100 L448 124 L330 124 Z"/></clipPath>
  </defs>
  <ellipse cx="330" cy="238" rx="300" ry="12" fill="url(#ts-shadow)"/>
  <circle cx="150" cy="201" r="44" fill="#07090e"/><circle cx="494" cy="201" r="44" fill="#07090e"/>
  <path d="M40 176 C38 158 44 146 62 140 L140 132 C168 128 186 116 206 102 C236 84 272 74 322 72 C372 71 404 76 432 92 L474 120 C520 124 566 128 594 136 C610 141 618 152 616 170 L612 190 C611 197 606 201 598 201 L538 201 A44 44 0 0 0 450 201 L194 201 A44 44 0 0 0 106 201 L58 201 C46 201 40 194 40 176 Z" fill="url(#ts-paint)"/>
  <path d="M206 127 C230 100 266 80 322 78 C370 77 404 82 430 96 L462 127 Z" fill="#161a22"/>
  <g clip-path="url(#ts-glass)">
    <rect x="200" y="70" width="270" height="60" fill="url(#ts-sky)"/>
    <path d="M250 124 L254 100 Q256 94 264 94 L276 94 Q283 94 283 101 L281 124 Z M352 124 L356 98 Q358 92 366 92 L378 92 Q385 92 385 99 L383 124 Z" fill="#5b6472"/>
    <path d="M404 124 Q410 106 428 104" stroke="#5b6472" stroke-width="5" fill="none"/>
    <path class="tint-rear" d="M214 124 C234 104 262 88 316 84 L318 124 Z" fill="${T}" style="opacity:${tintOpacity(rearVlt)}"/>
    <path class="tint-front" d="M328 84 C368 84 398 88 422 100 L448 124 L330 124 Z" fill="${T}" style="opacity:${tintOpacity(JPJ.frontSide)}"/>
    <path d="M240 130 L300 70 L322 70 L262 130 Z M360 130 L420 70 L432 70 L372 130 Z" fill="#fff" opacity=".16"/>
  </g>
  <path d="M206 129 L470 129" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
  <path d="M324 130 C322 160 322 180 326 199 M212 130 C206 150 204 172 208 196" stroke="#8b909a" stroke-width="1.2" fill="none"/>
  <rect x="286" y="140" width="24" height="5" rx="2.5" fill="#8b909a"/><rect x="392" y="140" width="24" height="5" rx="2.5" fill="#8b909a"/>
  <path d="M446 118 L462 112 Q468 112 468 118 L466 124 L450 125 Z" fill="#161a22"/>
  <path d="M586 146 Q604 146 612 156 L600 160 Q590 156 584 150 Z" fill="#eef3fb" stroke="#9aa3b2"/>
  <path d="M44 150 L66 146 L66 158 L44 162 Z" fill="#e2551b"/>
  <path d="M62 196 L112 196 M188 196 L456 196 M532 196 L596 196" stroke="#6b7079" stroke-width="3"/>
  ${[150, 494].map((cx) => `<g><circle cx="${cx}" cy="201" r="36" fill="#0f1115"/><circle cx="${cx}" cy="201" r="24" fill="url(#ts-rim)"/>
    ${[0, 72, 144, 216, 288].map((d) => `<line x1="${cx}" y1="201" x2="${(cx + 22 * Math.cos((d - 90) * Math.PI / 180)).toFixed(1)}" y2="${(201 + 22 * Math.sin((d - 90) * Math.PI / 180)).toFixed(1)}" stroke="#4b5260" stroke-width="4"/>`).join('')}
    <circle cx="${cx}" cy="201" r="6" fill="#2b3039"/></g>`).join('')}
</svg>`;
}

// The film picker: pick a film, see the car's windows tint, read the specs in
// the bar under it. Static HTML carries every film's specs (crawlers read them);
// src/public/tint.js makes the tabs and the slider live.
export function tintStudio(catalog) {
  const films = catalog.films;
  if (!films.length) return '';
  const first = films[0];
  const rear = clampVlt(first, PREVIEW_REAR);
  const tabs = films.map((f, i) => `<button type="button" role="tab" class="tab" data-film="${esc(f.id)}"
    data-min="${Array.isArray(f.vlt) ? f.vlt[0] : 5}" data-max="${Array.isArray(f.vlt) ? f.vlt[1] : 70}" aria-selected="${i === 0}">${esc(f.name)}</button>`).join('');
  const panels = films.map((f, i) => {
    const cells = [
      hasNum(f.uv) && ['Sekat UV', `${f.uv}%`],
      f.ir && ['Tolak inframerah', esc(f.ir)],
      hasNum(f.heat_rejection) && ['Tolak haba', `${f.heat_rejection}%`],
      hasNum(f.warranty_years) && ['Waranti', `${f.warranty_years} tahun`],
      f.grade && ['Kualiti', esc(f.grade)],
    ].filter(Boolean);
    const from = minPrice(f);
    return `<div class="spec-bar" role="tabpanel" data-panel="${esc(f.id)}"${i ? ' hidden' : ''}>
  <div class="spec-name"><b>${esc(f.name)}</b><span>${esc(f.tagline)}</span></div>
  ${cells.map(([k, v]) => `<div class="spec-cell"><span>${k}</span><b>${v}</b></div>`).join('')}
  <div class="spec-buy"><div class="film-price">${from !== null ? `<span>dari</span> ${rm(from)}` : 'Tanya harga'}</div>
    ${from !== null ? `<p class="pnote">${PRICE_BASIS}</p>` : ''}
    <a class="btn btn-sun" href="/tempah/?film=${encodeURIComponent(f.id)}" aria-label="Tempah slot, filem ${esc(f.name)}">Tempah slot</a></div>
</div>`;
  }).join('');
  return `<div class="tabs" role="tablist" aria-label="Pilih filem">${tabs}</div>
<div class="stage">${carSvg(rear)}</div>
<div class="dial">
  <label for="ts-rear">Kegelapan cermin belakang <b data-rear-out>${rear}%</b></label>
  <input id="ts-rear" type="range" data-rear min="${Array.isArray(first.vlt) ? first.vlt[0] : 5}" max="${Array.isArray(first.vlt) ? first.vlt[1] : 70}" step="5" value="${rear}">
  <p class="dial-note">Cermin depan ${JPJ.windscreen}% dan tingkap sisi depan ${JPJ.frontSide}% kekal ikut had JPJ. Lebih kecil peratus, lebih gelap.</p>
</div>
${panels}`;
}

export function priceTable(catalog) {
  const head = catalog.films.map((f) => `<th scope="col">${esc(f.name)}</th>`).join('');
  const rows = CAR_SIZES.map((s) => `<tr><th scope="row">${s.label}<small>${esc(s.eg)}</small></th>${
    catalog.films.map((f) => { const p = f.prices?.[s.id]; return `<td>${hasNum(p) ? rm(p) : '<span class="ask">Tanya</span>'}</td>`; }).join('')
  }</tr>`).join('');
  return `<div class="table-scroll"><table class="prices"><thead><tr><th scope="col">Saiz kereta</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Top-down car with each glass zone coloured by how dark JPJ allows it to go.
export function carDiagram() {
  return `<svg class="car" viewBox="0 0 220 340" role="img" aria-label="Rajah had tinted JPJ: cermin depan ${JPJ.windscreen}%, tingkap depan ${JPJ.frontSide}%, belakang tiada had">
  <rect x="34" y="12" width="152" height="316" rx="54" fill="var(--car-body)"/>
  <rect x="42" y="20" width="136" height="300" rx="48" fill="none" stroke="var(--car-edge)"/>
  <path d="M56 84 Q110 58 164 84 L154 124 Q110 112 66 124 Z" fill="var(--glass-70)"/>
  <rect x="40" y="134" width="12" height="62" rx="5" fill="var(--glass-50)"/>
  <rect x="168" y="134" width="12" height="62" rx="5" fill="var(--glass-50)"/>
  <rect x="40" y="204" width="12" height="56" rx="5" fill="var(--glass-0)"/>
  <rect x="168" y="204" width="12" height="56" rx="5" fill="var(--glass-0)"/>
  <path d="M66 272 Q110 282 154 272 L162 300 Q110 314 58 300 Z" fill="var(--glass-0)"/>
  <rect x="66" y="132" width="88" height="130" rx="14" fill="var(--car-roof)"/>
  <g font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <text x="110" y="104" font-size="15" fill="var(--glass-70-ink)">${JPJ.windscreen}%</text>
    <text x="110" y="172" font-size="13" fill="var(--car-label)">${JPJ.frontSide}%</text>
    <text x="110" y="189" font-size="10" fill="var(--car-label-2)" font-weight="500">tingkap depan</text>
    <text x="110" y="236" font-size="13" fill="var(--car-label)">Bebas</text>
    <text x="110" y="252" font-size="10" fill="var(--car-label-2)" font-weight="500">belakang</text>
  </g>
</svg>`;
}

export const FAQ = [
  ['Adakah tinted di sini lulus JPJ?',
    `Ya. Cermin depan mesti membenarkan sekurang-kurangnya ${JPJ.windscreen}% cahaya dan tingkap sisi depan ${JPJ.frontSide}%. Tingkap belakang dan cermin belakang tiada had. Kami ukur setiap cermin dengan meter VLT selepas pasang.`],
  ['Apa itu VLT?',
    'VLT (Visible Light Transmission) ialah peratus cahaya yang tembus cermin. Lebih rendah VLT, lebih gelap. JPJ mengukur cermin kilang dan filem bersama.'],
  ['Apa denda kalau tinted terlalu gelap?',
    `Kesalahan pertama boleh didenda sehingga ${JPJ.fine}. Sebab itu kami rekod bacaan VLT dalam sijil digital anda.`],
  ['Apa itu sijil digital?',
    'Selepas siap, anda terima pautan sijil yang menunjukkan bacaan VLT setiap cermin, jenis filem dan tarikh tamat waranti. Simpan dalam telefon, tunjuk bila perlu.'],
  ['Boleh pasang lebih gelap?',
    `Boleh untuk tingkap belakang dan cermin belakang, sehingga 5%, tanpa caj tambahan. Cermin depan dan tingkap sisi depan kami pasang ikut had JPJ (${JPJ.windscreen}% dan ${JPJ.frontSide}%), kerana lebih gelap dari itu satu kesalahan.`],
  ['Perlu bayar deposit untuk tempah?',
    'Tidak. Tempah slot secara online tanpa bayaran. Bayaran dibuat di kedai selepas kerja siap.'],
  ['Boleh tukar atau batal slot?',
    'Boleh. WhatsApp kami dengan nombor rujukan tempahan anda.'],
];

export function faqHtml(items = FAQ) {
  return items.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
}

// schema.org data: tells Google and AI assistants exactly who, where and what.
export function localBusinessLd(siteUrl, catalog) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    name: SHOP.name,
    alternateName: [SHOP.legalName, `${SHOP.tagline} ${SHOP.town}`],
    description: `${SHOP.tagline} di ${SHOP.town}, ${SHOP.state}. Pasang tinted kereta ikut had JPJ dengan sijil VLT digital. Tempah slot secara online.`,
    telephone: `+${SHOP.contacts[0].phone}`,
    address: { '@type': 'PostalAddress', streetAddress: SHOP.street, addressLocality: SHOP.town,
      postalCode: SHOP.postcode, addressRegion: SHOP.state, addressCountry: 'MY' },
    areaServed: SHOP.areaServed.map((n) => ({ '@type': 'City', name: n })),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP.mapsQuery)}`,
    sameAs: [SHOP.facebook],
    makesOffer: catalog.films.map((f) => {
      const from = minPrice(f);
      return { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Tinted kereta ${f.name}` },
        ...(from !== null ? { priceCurrency: 'MYR', price: from } : {}) };
    }),
  };
  if (siteUrl) { ld.url = siteUrl; ld['@id'] = `${siteUrl}/#shop`; }
  if (SHOP.hours.length) {
    ld.openingHoursSpecification = SHOP.hours.map((h) => ({ '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => ({ Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }[d])),
      opens: h.opens, closes: h.closes }));
  }
  return ld;
}

export function faqLd(items = FAQ) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
}

export const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
