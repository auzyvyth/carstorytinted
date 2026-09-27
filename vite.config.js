import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import catalog from './src/shared/catalog.default.json' with { type: 'json' };
import { SHOP, JPJ, POLICY, fullAddress, displayPhone } from './src/shared/shop.js';
import * as R from './src/shared/render.js';

// Public pages. Each is plain HTML with <!--@slot--> markers the plugin below
// fills at build time, so crawlers get full text without running JavaScript.
const PAGES = {
  main: 'index.html',
  tempah: 'tempah/index.html',
  sijil: 'sijil/index.html',
  harga: 'harga/index.html',
  urus: 'urus/index.html',
  jpj: 'panduan-jpj/index.html',
  privasi: 'privasi/index.html',
  staff: 'staff/index.html',
};
// Indexable pages for the sitemap (sijil + staff are noindex).
const PUBLIC_PATHS = ['/', '/tempah/', '/harga/', '/panduan-jpj/', '/privasi/'];

const DEMO_BANNER = `<div class="demo-bar" role="note"><b>Versi demo</b> Data dan harga contoh. Tempahan di sini tidak sampai ke kedai. <a href="/staff/">Buka app staf</a></div>`;

function shopPages(siteUrl, demo) {
  const slots = {
    films: () => R.tintStudio(catalog),
    prices: () => R.pricesHtml(catalog),
    car: () => R.carDiagram(),
    faq: () => R.faqHtml(),
    footer: () => R.footer(),
    contacts: () => R.contactsHtml(),
    'map-links': () => R.mapLinksHtml(),
    hours: () => R.hoursHtml(),
    gallery: () => R.galleryHtml(demo),
    'ld-home': () => R.ldScript(R.localBusinessLd(siteUrl, catalog)) + R.ldScript(R.faqLd()),
    'ld-shop': () => R.ldScript(R.localBusinessLd(siteUrl, catalog)),
  };
  const vars = {
    SITE_URL: siteUrl, ADDRESS: fullAddress(), TOWN: SHOP.town, STATE: SHOP.state,
    AREAS: SHOP.areaServed.join(', '), JPJ_WS: JPJ.windscreen, JPJ_FS: JPJ.frontSide, JPJ_FINE: JPJ.fine,
    PHONE1: displayPhone(SHOP.contacts[0].phone), POLICY_WALKIN: POLICY.walkIn, MAP_EMBED: R.mapEmbedUrl(), YEAR: new Date().getFullYear(),
  };
  return {
    name: 'shop-pages',
    transformIndexHtml(html, ctx) {
      const staffPage = (ctx?.path || '').startsWith('/staff');
      return html
        .replace(/<!--@header:?([^>]*?)-->/g, (_, active) => R.header(active.trim()))
        .replace(/<!--@([a-z-]+)-->/g, (m, k) => (slots[k] ? slots[k]() : m))
        .replace(/%([A-Z0-9_]+)%/g, (m, k) => (k in vars ? String(vars[k]) : m))
        // No canonical/og:url until the real domain is known (SITE_URL env).
        .replace(/<link rel="canonical" href="\/?[^"]*">|<meta property="og:url" content="\/?[^"]*">/g,
          (tag) => (siteUrl && !demo ? tag : ''))
        // The demo is a sales tool on a public URL: label every page, keep it out of search.
        .replace('</head>', demo ? '<meta name="robots" content="noindex, nofollow">\n</head>' : '</head>')
        .replace(/<body>/, demo && !staffPage ? `<body>\n${DEMO_BANNER}` : '<body>');
    },
    generateBundle() {
      const robots = demo ? ['User-agent: *', 'Disallow: /'] : ['User-agent: *', 'Allow: /', 'Disallow: /staff/', 'Disallow: /sijil/', 'Disallow: /urus/'];
      if (siteUrl && !demo) {
        robots.push(`Sitemap: ${siteUrl}/sitemap.xml`);
        const urls = PUBLIC_PATHS.map((p) => `<url><loc>${siteUrl}${p}</loc></url>`).join('');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>` });
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(siteUrl) });
    },
  };
}

// Plain-text summary for AI assistants (GEO). Facts only, same source as the site.
function llmsTxt(siteUrl) {
  const u = (p) => (siteUrl ? `${siteUrl}${p}` : p);
  return `# ${SHOP.name} (${SHOP.legalName})

> ${SHOP.tagline} di ${SHOP.town}, ${SHOP.state}, Malaysia. Pasang tinted kereta ikut had JPJ, dengan sijil VLT digital untuk setiap kereta. Tempahan slot secara online, tiada deposit.

## Butiran
- Alamat: ${fullAddress()}
- Telefon / WhatsApp: ${SHOP.contacts.map((c) => `${c.name} ${displayPhone(c.phone)}`).join(', ')}
- Kawasan: ${SHOP.areaServed.join(', ')}
- Filem: ${catalog.films.map((f) => f.name).join(', ')}

## Had tinted JPJ (2026)
- Cermin depan: sekurang-kurangnya ${JPJ.windscreen}% cahaya tembus
- Tingkap sisi depan: sekurang-kurangnya ${JPJ.frontSide}%
- Tingkap belakang dan cermin belakang: tiada had
- Denda kesalahan pertama: sehingga ${JPJ.fine}

## Pautan
- [Tempah slot](${u('/tempah/')})
- [Harga ikut saiz kereta](${u('/harga/')})
- [Panduan had tinted JPJ](${u('/panduan-jpj/')})
`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.SITE_URL || '').replace(/\/$/, '');
  return {
    plugins: [react(), shopPages(siteUrl, env.VITE_DEMO === '1')],
    build: {
      rollupOptions: { input: Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [k, resolve(__dirname, p)])) },
    },
    server: { port: 3100 },
  };
});
