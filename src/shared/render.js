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

export function galleryHtml() {
  if (!SHOP.gallery.length) return '';
  return `<section id="galeri"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Hasil kerja</p><h2>Galeri</h2></div></div>
<div class="gallery">${SHOP.gallery.map((g) => `<img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy" width="400" height="300">`).join('')}</div></div></section>`;
}

export function minPrice(film) {
  const vals = Object.values(film.prices || {}).filter(hasNum).map(Number);
  return vals.length ? Math.min(...vals) : null;
}

export function filmCards(catalog) {
  return catalog.films.map((f) => {
    const specs = [
      hasNum(f.heat_rejection) && ['Tolak haba', `${f.heat_rejection}%`],
      hasNum(f.uv) && ['Sekat UV', `${f.uv}%`],
      hasNum(f.warranty_years) && ['Waranti', `${f.warranty_years} tahun`],
    ].filter(Boolean);
    const from = minPrice(f);
    return `<article class="film">
  <h3>${esc(f.name)}</h3>
  <p class="film-tag">${esc(f.tagline)}</p>
  ${specs.length ? `<dl class="specs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
  <div class="film-price">${from !== null ? `<span>dari</span> ${rm(from)}` : 'Tanya harga'}</div>
  <a class="btn btn-line" href="/tempah/?film=${encodeURIComponent(f.id)}">Pilih ${esc(f.name)}</a>
</article>`;
  }).join('');
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
