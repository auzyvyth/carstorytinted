# Handoff: Tinted Carstory (read first next session)

Work continues on branch `claude/tinted-navbar-responsive-gubnm5` (built on
`claude/tinted-carstory-handoff-9sg21x`, itself from `claude/tinted-bumiputera-crm-website-bffa60`). It is NOT merged
to ShiftOS `main` and should not be: this client lives in `clients/tinted-bumiputera/`
with its own Supabase + Vercel. Outside this folder the branch touches only `CLAUDE.md`
(the "ASK FIRST" rule) and `eslint.config.mjs` (ignores `clients/**`).

## State (2026-09-27)
- Sales demo live on Vercel project `tinted-carstory-demo` (owner's current account),
  `VITE_DEMO=1`, working. Sample data lives in each visitor's browser; nothing real.
- `vercel.json` here forces `ignoreCommand: exit 1`: the repo-root `.vercelignore`
  strips `.git`, so any git-based ignore step errors the deploy. Do not put one back.
- Real (non-demo) build is untested against a real Supabase: migrations, edge function
  `notify-staff` (push + Telegram backup), and push on real phones are all unverified.
  One real-Supabase bug was already found and fixed by making the test DB mirror
  Supabase: 0001's jobs trigger could not see pgcrypto (Supabase keeps it in
  `extensions`), so finishing a job would have failed. 0002 fixes it.
- Tests: `npm run test:db` 10/10, `npm run test:ui` 38/38, `npm run test:report` 17/17.
- Dashboard round 2 (2026-09-27, migration `0002_dashboard.sql`): slot capacity on every
  write (no double-booking), backup alerts, no-shows, archive instead of delete,
  changed-fields-only saves, installer per job, payment method + WhatsApp receipt,
  owner report tab + CSV export, delta sync on foreground.

## Next steps
1. Pitch the demo to the owner (Maliki). Pricing: RM800 upfront or RM200/month.
2. Collect from owner: VLT meter yes/no (site promises every window is measured),
   real film names/specs/warranty/prices, opening hours, logo + exact blue/orange
   colours, 6-10 before/after photos, Google review link, confirm Sungai Jawi branch.
   DONE 2026-09-27: the 4 films + compact prices (catalog.default.json, from his
   WhatsApp list). STILL NEEDED: prices for sedan/SUV/large and for the windscreen +
   rear glass (the list covers 4 side windows only; site says "Tanya" for the rest).
   Ask him too: Black UV's lightest is 50% film, and JPJ measures glass + film
   together, so on the front side windows it likely reads under 50% (a fail).
   Staff Settings cannot edit the new film fields yet (`ir`, `grade`, `vlt`).
   Customer photos go in `SHOP.gallery` (shop.js) with `car` + `film` captions;
   the demo shows 6 labelled empty frames until then.
3. When owner signs: new Supabase (Singapore) + new Vercel, follow README "Setup".
   VAPID keys are generated once and never regenerated.
4. Then a real-device test: book online -> push arrives on staff phone -> job flows
   to Selesai -> certificate link opens.

## Dashboard rules (keep them in the DB, not the client)
- Capacity is `trg_jobs_check_capacity`: every write path goes through it. The staff
  picker only mirrors it (`slotUse` in src/staff/logic.js). A dated job needs a slot.
- Archive = `archived_at` (owner only, enforced in `jobs_before_write`). It forces
  stage `batal`; restore returns the stage from `job_events`. No DELETE grant exists.
- The job form sends only fields that changed (`base` ref in JobDrawer.jsx). Never go
  back to a full-row save: it overwrites the other phone's payment/readings.
- Month bucketing uses `klDate()` (logic.js), never `slice(0, 7)` of a UTC timestamp.
- The report reads the WHOLE jobs table (the live list keeps 120 days of closed work).

## Rules that apply here
- Anything NEW (feature/page) = research + ask the owner in detail before coding.
- Film options = a tint preview (`tintStudio` + `carSvg` in render.js, `src/public/tint.js`):
  a rounded dark showroom panel, film pills, two square panes labelled BELAKANG / DEPAN
  (owner, 2026-09-27: no car shapes, squares only) with "Need a tint?" in yellow behind
  the glass, rear windows darkening with a slider, and a spec bar with the price. The
  circuit-board version was dropped (owner, 2026-09-27: wrong fit for a tint shop). Windscreen + front side windows are
  ALWAYS drawn at the JPJ limits; only the rear follows the slider. Keep it that way.
- Booking form (`/tempah/`) scrolls to the next question after each pick
  (`ahead()` in src/public/booking.js). Owner asked for it: the form is long on a phone.
- Phone spacing: one side margin (`--gutter`), equal left/right. A checker that flags
  lopsided blocks at 375px lives in the session scratchpad only; re-measure after layout work.
- Never advertise darker than JPJ on the windscreen / front side windows (the
  owner's WhatsApp copy says "5% if the customer asks"): the site offers 5% on the
  REAR only. Verified 2026-09-27: 70% / 50% / rear no limit, Kaedah 1991 as amended 2019.
- Public site design (owner's call, 2026-09-27): layout from XDrive /for-salesmen
  (`src/pages/SalesmanLiteLanding.jsx` in ShiftOS), ONE typeface (Plus Jakarta Sans),
  sentence-case headings. Colours from the shopfront photo (`public/kedai.webp`):
  blue sign, yellow letters, orange building. No flat grounds: every section has a wash, cards sit on a slight shadow, pricing cards + buttons carry the `--grad`
  gradient border (blue to yellow/orange). Colours live in `:root` of
  `src/public/site.css` (`--accent`, `--sun`, `--orange`, `--grad`), placeholders until the logo file.
- Staff app colours are still placeholders (`--brand-*` in `src/staff/staff.css`).
- No auto-send to customers: WhatsApp buttons open a draft, a person presses send.
