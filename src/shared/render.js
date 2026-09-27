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
  // ONE nav for every width. Phones collapse it behind the menu button (nav.js);
  // without JS it falls back to a scrolling row under the bar.
  return `<header class="mast">
  <div class="mast-in">
    <a class="wordmark" href="/" aria-label="${esc(SHOP.name)} - laman utama"><span>Tinted</span> Carstory</a>
    <nav class="mast-nav" id="mast-nav" aria-label="Menu utama">${links}<a class="btn btn-cta nav-cta" href="/tempah/">Tempah slot</a></nav>
    <a class="btn btn-cta btn-sm" href="/tempah/">Tempah slot</a>
    <button class="mast-menu" type="button" aria-controls="mast-nav" aria-expanded="false" aria-label="Buka menu" hidden>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path class="m-open" d="M4 7h16M4 12h16M4 17h16"/><path class="m-close" d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
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

// How dark a window looks for a given VLT (share of light let through). The eye
// reads light on a curve, not a straight line, so 50% film still shows the
// cabin clearly and 5% nearly hides it.
export const tintOpacity = (vlt) => +(1 - (vlt / 100) ** 0.6).toFixed(3);
// Rear darkness the preview opens on, clamped into each film's range.
const PREVIEW_REAR = 30;
const clampVlt = (f, v) => (Array.isArray(f.vlt) ? Math.min(f.vlt[1], Math.max(f.vlt[0], v)) : v);

// Two panes of glass, rear (left) and front (right), with "Need a tint?" behind
// them. Each pane has a tint layer whose opacity is its VLT, so the visitor SEES
// how much the film hides. A labelled pointer names each pane. The front pane
// is drawn at the JPJ limit and never follows the slider.
function carSvg(rearVlt) {
  const T = '#05070d';
  const pane = (x) => `x="${x}" y="84" width="230" height="230" rx="18"`;
  const tag = (cx, title, value) => `<g text-anchor="middle">
    <text x="${cx}" y="24" font-size="23" font-weight="800" fill="#fff" letter-spacing=".06em">${title}</text>
    <text x="${cx}" y="50" font-size="19" font-weight="600" fill="rgba(255,255,255,.7)">${value}</text>
    <path d="M${cx} 60 L${cx} 74 M${cx - 8} 67 L${cx} 76 L${cx + 8} 67" stroke="#ffc71a" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
  return `<svg class="car-view" viewBox="0 0 520 318" role="img" aria-label="Pratonton tinted: cermin belakang ${rearVlt}%, cermin depan ${JPJ.frontSide}%">
  <defs><linearGradient id="ts-glass-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22325f"/><stop offset="1" stop-color="#101a3a"/></linearGradient></defs>
  <g font-family="Plus Jakarta Sans, system-ui, sans-serif">
    ${tag(135, 'BELAKANG', `<tspan data-rear-tag>${rearVlt}%</tspan>`)}
    ${tag(385, 'DEPAN', `${JPJ.frontSide}% (had JPJ)`)}
    <rect ${pane(20)} fill="url(#ts-glass-bg)"/><rect ${pane(270)} fill="url(#ts-glass-bg)"/>
    <g font-size="46" font-weight="800" fill="#ffd21f" text-anchor="middle">
      <text x="135" y="214">Need a</text><text x="385" y="214">tint?</text>
    </g>
    <rect class="tint-rear" ${pane(20)} fill="${T}" style="opacity:${tintOpacity(rearVlt)}"/>
    <rect class="tint-front" ${pane(270)} fill="${T}" style="opacity:${tintOpacity(JPJ.frontSide)}"/>
    <rect ${pane(20)} fill="none" stroke="#2a3140" stroke-width="6"/><rect ${pane(270)} fill="none" stroke="#2a3140" stroke-width="6"/>
  </g>
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
