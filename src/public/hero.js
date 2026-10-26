// Homepage: the production site script, plus the hero's booking form.
import { loadCatalog } from './site.js';
import './hero.css';
import './cert.css';  // the sample certificate in #sijil
import defaults from '../shared/catalog.default.json';
import { rm, hasNum } from '../shared/render.js';
import { heroForm } from '../shared/heroForm.js';

// Hero form: each film's price follows the car size picked.
let catalog = defaults;
const form = document.querySelector('.hero-form');
function paintPrices() {
  if (!form) return;
  const size = form.querySelector('input[name="size"]:checked')?.value;
  for (const f of catalog.films || []) {
    const el = form.querySelector(`[data-film-rm="${CSS.escape(f.id)}"]`);
    if (el) el.textContent = hasNum(f.prices?.[size]) ? rm(f.prices[size]) : 'Tanya';
  }
}
form?.addEventListener('change', paintPrices);
// "Tempah Slot Sekarang" goes to the form when the form is on screen (desktop); else to /tempah/.
document.querySelector('[data-to-form]')?.addEventListener('click', (e) => {
  if (!form || !form.offsetParent) return;
  e.preventDefault();
  form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  form.querySelector('input:checked')?.focus({ preventScroll: true });
  form.classList.remove('nudge'); void form.offsetWidth; form.classList.add('nudge');
});

// The live list can differ from the one baked in (films added or renamed in the staff app):
// rebuild the form's insides from it, keeping what the visitor already picked.
loadCatalog().then((cat) => {
  if (!cat?.films || !form) return;
  catalog = cat;
  const size = form.querySelector('input[name="size"]:checked')?.value;
  const film = form.querySelector('input[name="film"]:checked')?.value;
  const tmp = document.createElement('div');
  tmp.innerHTML = heroForm(cat, size);
  form.innerHTML = tmp.firstElementChild.innerHTML;
  const keep = film && [...form.querySelectorAll('input[name="film"]')].find((i) => i.value === film);
  if (keep) keep.checked = true;
});

// Our work: the arrows page the strip by one screenful; each greys out at its end.
const track = document.querySelector('.work-track');
const workBtns = [...document.querySelectorAll('[data-work]')];
if (track && workBtns.length) {
  const sync = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    workBtns.forEach((b) => { b.disabled = b.dataset.work === '-1' ? track.scrollLeft <= 2 : track.scrollLeft >= max; });
  };
  workBtns.forEach((b) => b.addEventListener('click', () => track.scrollBy({ left: Number(b.dataset.work) * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })));
  track.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
}
