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
