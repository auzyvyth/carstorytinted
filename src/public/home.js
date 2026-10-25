// Homepage: the shared site script, plus the film showcase (the page's one live thing),
// live prices and menu, and the entrance motion.
import { loadCatalog } from './site.js';
import './home.css';
import { filmShowcase, menuHtml } from '../shared/homeRender.js';
import { tintOpacity } from '../shared/render.js';
import { JPJ } from '../shared/shop.js';

function mountShowcase() {
  const root = document.querySelector('[data-show]');
  const range = root?.querySelector('[data-rear]');
  if (!range) return;
  const tint = root.querySelector('[data-tint]');
  const out = root.querySelector('[data-rear-out]');
  const verdict = root.querySelector('[data-verdict]');
  const buttons = [...root.querySelectorAll('.pick-film')];
  const paint = () => {
    const v = Number(range.value);
    tint.style.setProperty('--t', tintOpacity(v));
    out.textContent = `${v}%`;
    verdict.textContent = `Belakang ${v}%: dibenarkan. Cermin depan kekal ${JPJ.windscreen}% dan tingkap sisi depan ${JPJ.frontSide}%, ikut had JPJ.`;
  };
  const pick = (b) => {
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    root.querySelectorAll('[data-fact]').forEach((f) => { f.hidden = f.dataset.fact !== b.dataset.film; });
    range.min = b.dataset.min; range.max = b.dataset.max;
    range.value = Math.min(Number(range.max), Math.max(Number(range.min), Number(range.value)));
    paint();
  };
  buttons.forEach((b) => b.addEventListener('click', () => pick(b)));
  range.addEventListener('input', paint);
}

// Live catalogue (owner edits prices and services in the staff app).
loadCatalog().then((cat) => {
  if (!cat?.films) return;
  const show = document.querySelector('[data-show]');
  if (show) { show.innerHTML = filmShowcase(cat); mountShowcase(); }
  const menu = document.querySelector('[data-menu]');
  if (menu) menu.innerHTML = menuHtml(cat);
});
mountShowcase();

// Entrances: each section's parts rise in, staggered, once. Content is visible without
// script (the hiding class is only added here) and for reduced motion.
const motionOk = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches;
if (motionOk) {
  document.documentElement.classList.add('rise-on');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('risen'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-rise]').forEach((s) => io.observe(s));
}
