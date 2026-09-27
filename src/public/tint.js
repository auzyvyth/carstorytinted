// Makes the film picker live (markup: tintStudio in src/shared/render.js).
// A tab shows that film's spec bar and fits the rear-darkness slider to the
// film's range; the slider tints the rear windows. Front glass never changes:
// it is drawn at the JPJ limits.
import { tintOpacity } from '../shared/render.js';

export function mountStudio() {
  const root = document.querySelector('[data-films]');
  const range = root?.querySelector('[data-rear]');
  if (!range) return;
  const out = root.querySelector('[data-rear-out]');
  const rear = root.querySelector('.tint-rear');
  const svg = root.querySelector('.car-view');
  const tabs = [...root.querySelectorAll('[role="tab"]')];

  const paint = () => {
    const v = Number(range.value);
    out.textContent = `${v}%`;
    rear.style.opacity = tintOpacity(v);
    svg.setAttribute('aria-label', svg.getAttribute('aria-label').replace(/belakang \d+%/, `belakang ${v}%`));
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
}
