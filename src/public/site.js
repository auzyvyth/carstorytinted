// Shared by every public page: live prices and the tint preview.
// The HTML already holds the build-time copy, so a failed call changes nothing.
import './site.css';
import './hero.css';  // the blue header every public page now shares
import './doc.css';
import './nav.js';
import { rpc, apiReady } from '../shared/api.js';
import { tintStudio, pricesHtml, servicesSection, teamSection, videosSection } from '../shared/render.js';
import { mountStudio } from './tint.js';

export async function loadCatalog() {
  if (!apiReady) return null;
  try { return await rpc('get_catalog'); } catch { return null; }
}

async function paintPrices() {
  const films = document.querySelector('[data-films]');
  const prices = document.querySelector('[data-prices]');
  const owned = [['[data-services]', servicesSection], ['[data-team]', teamSection], ['[data-videos]', videosSection]]
    .map(([sel, fn]) => [document.querySelector(sel), fn]).filter(([el]) => el);
  if (!films && !prices && !owned.length) return;
  const cat = await loadCatalog();
  if (!cat?.films) return;
  if (films) { films.innerHTML = tintStudio(cat); mountStudio(); }
  if (prices) prices.innerHTML = pricesHtml(cat);
  // The owner's own content (Tetapan > Laman web). An older catalog with no "site"
  // keeps whatever the build baked in.
  if (cat.site) for (const [el, fn] of owned) { el.innerHTML = fn(cat); reveal(el); }
}

// Videos: nothing from YouTube/TikTok loads until the visitor taps play.
document.addEventListener('click', (e) => {
  const b = e.target.closest('.vid-play');
  if (!b) return;
  const f = document.createElement('iframe');
  f.src = b.dataset.src;
  f.title = b.getAttribute('aria-label') || 'Video';
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  b.replaceWith(f);
});

// Sections ease in as they scroll into view. Content is visible without JS (the
// hiding class is only added here) and for anyone who asked for less motion.
const io = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches
  ? new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' })
  : null;
function reveal(root = document) {
  if (!io) return;
  root.querySelectorAll('.reveal:not(.in)').forEach((el) => { el.classList.add('pre'); io.observe(el); });
}
reveal();


mountStudio();
paintPrices();
