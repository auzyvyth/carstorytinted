// Shared by every public page: live prices + the hero's next-free-slot card.
// The HTML already holds the build-time copy, so a failed call changes nothing.
import './site.css';
import './nav.js';
import { rpc, apiReady, shopDate, dayParts } from '../shared/api.js';
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

// Three soonest days that still have a free slot, each linking straight into
// the booking page with that day chosen.
async function paintNextSlots() {
  const box = document.querySelector('[data-next-slots]');
  if (!box) return;
  // No live data: keep the card (the hero is built around it) and just point to booking.
  const fallback = () => { box.innerHTML = '<p class="muted" style="grid-column:1/-1">Lihat semua slot kosong dan tempah dalam 1 minit.</p>'; };
  if (!apiReady) { fallback(); return; }
  try {
    const rows = await rpc('available_slots', { p_from: shopDate(0), p_days: 14 });
    const byDay = new Map();
    for (const r of rows) if (r.remaining > 0) byDay.set(r.day, (byDay.get(r.day) || 0) + 1);
    const days = [...byDay.entries()].slice(0, 3);
    if (!days.length) { box.innerHTML = '<p class="muted">Slot 2 minggu ini penuh. WhatsApp kami untuk tarikh lain.</p>'; return; }
    box.innerHTML = days.map(([iso, n]) => {
      const p = dayParts(iso);
      return `<a class="slot-day" href="/tempah/?date=${iso}"><small>${p.short}</small><b>${p.date} ${p.mon}</b><small class="left">${n} slot</small></a>`;
    }).join('');
  } catch {
    fallback();
  }
}

mountStudio();
paintPrices();
paintNextSlots();
