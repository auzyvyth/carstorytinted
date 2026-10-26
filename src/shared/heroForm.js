// The homepage hero's booking form, baked at build time (vite.config.js slot 'hero-form').
import { CAR_SIZES } from './shop.js';
import { esc, rm, hasNum } from './render.js';

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
