// Makes the film picker live (markup: tintStudio in src/shared/render.js).
// A tab shows that film's spec bar and fits the rear-darkness slider to the
// film's range; the slider tints the rear windows. The windscreen and front side
// window have their own sliders, never darker than the JPJ limits.
import { tintOpacity } from '../shared/render.js';

let phone;
export function mountStudio() {
  const root = document.querySelector('[data-films]');
  // A re-render (site.js) makes a fresh preview: drop the stale one in the hero, or
  // bring a moved one home before reading the markup.
  const slot = document.querySelector('[data-hero-tint]');
  if (slot && root && !root.querySelector('.glass-col')) root.querySelector('.studio-grid')?.prepend(...slot.children);
  slot?.replaceChildren();
  const range = root?.querySelector('[data-rear]');
  if (!range) return;
  const out = root.querySelector('[data-rear-out]');
  const rear = root.querySelector('.tint-rear');
  const svg = root.querySelector('.car-view');
  const tag = root.querySelector('[data-rear-tag]');
  const tabs = [...root.querySelectorAll('[role="tab"]')];

  // "Tempah slot" carries the preview to the booking page: film, each pane's VLT, colour.
  // Read through the glass column itself: on phones it has moved into the hero.
  const glass = root.querySelector('.glass-col');
  const book = () => root.querySelectorAll('[data-book]').forEach((a) => {
    const q = new URLSearchParams({ film: a.dataset.book, ws: glass.querySelector('[data-ws]').value, front: glass.querySelector('[data-front]').value, rear: range.value });
    const c = glass.querySelector('[data-tint-name][aria-checked="true"]');
    if (c) q.set('warna', c.dataset.tintName);
    a.href = `/tempah/?${q}`;
  });
  const paint = () => {
    const v = Number(range.value);
    // Darker film = less glare: the light sweeping across the glass fades with it.
    root.style.setProperty('--glare', (0.25 + (v / 100) * 0.75).toFixed(2));
    out.textContent = `${v}%`;
    rear.style.opacity = tintOpacity(v);
    if (tag) tag.textContent = `${v}%`;
    svg.setAttribute('aria-label', svg.getAttribute('aria-label').replace(/belakang \d+%/, `belakang ${v}%`));
    book();
  };
  const pick = (tab) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.film; });
    range.min = tab.dataset.min;
    range.max = tab.dataset.max;
    range.value = Math.min(Number(range.max), Math.max(Number(range.min), Number(range.value)));
    paint();
  };
  tabs.forEach((t) => t.addEventListener('click', () => { pick(t); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }));
  range.addEventListener('input', paint);
  // Front side window and windscreen: their own sliders, never darker than the JPJ
  // limit (min in the markup); 100 = no film.
  const front = (key, cls, said) => {
    const r = root.querySelector(`[data-${key}]`);
    if (!r) return;
    const o = root.querySelector(`[data-${key}-out]`), tg = root.querySelector(`[data-${key}-tag]`), layer = root.querySelector(cls);
    r.addEventListener('input', () => {
      const v = Number(r.value);
      layer.style.opacity = tintOpacity(v);
      o.textContent = v === 100 ? 'Tiada filem' : `${v}%`;
      if (tg) tg.textContent = v === 100 ? 'jernih' : `${v}%`;
      svg.setAttribute('aria-label', svg.getAttribute('aria-label').replace(new RegExp(`${said} (\\d+%|tiada filem)`), `${said} ${v === 100 ? 'tiada filem' : `${v}%`}`));
      book();
    });
  };
  front('front', '.tint-front', 'sisi depan');
  front('ws', '.tint-ws', 'cermin depan');
  // Film colour: one swatch row recolours every tinted pane.
  const sw = [...root.querySelectorAll('[data-tint-c]')];
  sw.forEach((b) => b.addEventListener('click', () => {
    sw.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    svg.style.setProperty('--tint-c', b.dataset.tintC);
    book();
  }));
  book();
  // Phones: the car and sliders sit in the hero, under the trust row; the film tabs and
  // spec card stay in #filem and still drive them. Desktop keeps them beside the spec card.
  if (slot) {
    const col = root.querySelector('.glass-col'), grid = col.parentNode;
    phone ??= matchMedia('(max-width: 860px)');
    const fit = () => (phone.matches ? slot.append(col) : grid.prepend(col));
    fit();
    phone.onchange = fit;
  }
}
