// Phone header: the nav collapses behind a menu button. Imported by every
// public page script (site.js, booking.js, cert.js).
const mast = document.querySelector('.mast');
const btn = mast?.querySelector('.mast-menu');
const nav = mast?.querySelector('.mast-nav');

if (mast && btn && nav) {
  const phone = window.matchMedia('(max-width: 860px)');
  mast.classList.add('js-nav');
  btn.hidden = false;

  const setOpen = (open) => {
    mast.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  const isOpen = () => mast.classList.contains('open');

  btn.addEventListener('click', () => setOpen(!isOpen()));
  // Same-page anchors (/#filem) never reload, so close on any link tap.
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); }
  });
  // A tap on the dimmed page closes the menu and does nothing else, so it can't
  // also press whatever button sits under the dim.
  document.addEventListener('click', (e) => {
    if (!isOpen() || mast.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation(); setOpen(false);
  }, true);
  // Rotating to landscape / widening past the breakpoint must not leave the page locked.
  phone.addEventListener('change', (e) => { if (!e.matches) setOpen(false); });
}

// Pinned header that tucks away while reading down and comes back the moment
// the visitor scrolls up. Never tucks near the top, while the menu is open, or
// while keyboard focus is inside the header.
if (mast) {
  const DEAD = 6; // px of travel ignored, so a trembling thumb doesn't flicker it
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    const dy = y - lastY;
    if (Math.abs(dy) < DEAD) return;
    const keep = y < mast.offsetHeight * 2 || mast.classList.contains('open') || mast.contains(document.activeElement);
    mast.classList.toggle('tucked', dy > 0 && !keep);
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  mast.addEventListener('focusin', () => mast.classList.remove('tucked'));
}
