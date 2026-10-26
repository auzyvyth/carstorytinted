# Handoff: Tinted Carstory (read first next session)

This repo (`auzyvyth/carstorytinted`) is the shop's own home as of 2026-09-27, with its
own Vercel account and its own Supabase project. It was split out of the ShiftOS monorepo
(`clients/tinted-bumiputera/` on branch `claude/tinted-navbar-responsive-gubnm5`) with its
history kept. It shares no code, database or deploy with ShiftOS.

## State (2026-09-27)
- **Supabase project `tinted-carstory`** (ref `yzasfglsygqinuzmaiaq`, Singapore), made
  2026-09-27 in the owner-of-record's existing "Xdrive" Supabase org (free plan; a new
  account hit a GitHub-link mismatch). Its own database: nothing shared with ShiftOS.
  Hand-over later = Supabase "project transfer" to the shop owner's own org.
  Done on it: pg_net + pg_cron, migrations 0001/0002/0003, both cron jobs
  (purge-old-jobs, nag-unconfirmed). Checked with a rolled-back anon probe: book ->
  get_booking -> confirm -> finish -> certificate all work; anon cannot read `jobs`.
  NOT done yet: push keys, `notify-staff` deploy + secrets, `app_config` rows, staff
  users, turning off public sign-ups (README Setup steps 2-4).
- **Live site (2026-09-28): Vercel project `carstorytint` -> https://carstorytint.vercel.app**
  (shop's own Vercel account, team `carstory`). REAL mode: `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` set for Production only, so only production builds reach the
  database; preview builds have no keys and the staff app shows "Belum disambung".
  Booking form = `/tempah/`. Until README Setup steps 2-4 are done, bookings land in the
  DB but no staff can log in and no alert fires.
- Same account also has `carstorytinted` and `carstorytinted2`: duplicates of the same
  repo with no env vars (booking cannot submit). Delete both.
- The old ShiftOS-account project `tinted-carstory-demo` built from the ShiftOS repo and
  failed on every ShiftOS push (folder moved here). Owner disconnected it 2026-09-28.
- `vercel.json` forces `ignoreCommand: exit 1` (always build). It was needed inside the
  monorepo; here it is harmless and can stay.
- Real (non-demo) build is untested against a real Supabase: migrations, edge function
  `notify-staff` (push + Telegram backup), and push on real phones are all unverified.
  One real-Supabase bug was already found and fixed by making the test DB mirror
  Supabase: 0001's jobs trigger could not see pgcrypto (Supabase keeps it in
  `extensions`), so finishing a job would have failed. 0002 fixes it.
- Tests: `npm run test:db` 11/11, `npm run test:ui` 40/40, `npm run test:report` 17/17, `npm run test:logic` 13/13.
- Dashboard round 2 (2026-09-27, migration `0002_dashboard.sql`): slot capacity on every
  write (no double-booking), backup alerts, no-shows, archive instead of delete,
  changed-fields-only saves, installer per job, payment method + WhatsApp receipt,
  owner report tab + CSV export, delta sync on foreground.

## Session 2026-10-25 (pitch prep)
- Owner (Maliki) asked for a one-tap Google review link. Already built: staff "Minta ulasan"
  button (`src/staff/logic.js:108`) reads `SHOP.googleReviewUrl` (`src/shared/shop.js:24`, empty).
  He sent `https://share.google/W5jrugzbdalrbugx4`: that is the PROFILE share link, not the
  review link. Need the `g.page/r/.../review` link (Maps > Business Profile > "Ask for reviews").
  Shop profile: `https://share.google/QUvgkihmd7L5UWzjE`, Google name "TINTED BUMIPUTERA
  CARSTORY PRO AUTO", 5.0 stars, review count unknown.
- Website reviews section: not built. Plan agreed in chat: badge + "Baca/Tulis ulasan" buttons
  first (no hand-typed rating); live Google reviews via Places API only once there are 5+
  reviews (needs a Google Cloud billing account; max 5 reviews; no caching per Google policy).
- He spends ~RM1,500/month on Facebook ads and does not know what it brings. Added
  Laporan "Pelanggan tahu dari mana" (`bySource`, src/staff/report.js) = cars + sales per
  `heard_from`, unrecorded shown. This is the pitch hook: the report shows whether ads pay.

## Next steps
1. Pitch the demo to the owner (Maliki). Pricing (owner's rep, 2026-10-25): **RM400/month** =
   RM200 system + maintenance, RM200 hosting + domain. Setup fee proposed RM1,200-1,500 (not
   confirmed). Optional growth add-on RM300-400/month (run his Google profile). Hosting is a real
   cost (Vercel Pro ~US$20, Supabase Pro ~US$25 if the org is on free: free pauses an idle
   project, Vercel Hobby is non-commercial; domain ~RM50-100/yr): check both billing pages.
   Never call the RM200 "domain" alone on a quote: a domain is ~RM100 a YEAR.
   Pitch line: he spends ~RM1,500/month on Facebook ads; the Laporan source section shows
   after a month what they bring. Promise he will SEE the number, never a saving.
2. Collect from owner: VLT meter yes/no (site promises every window is measured),
   real film names/specs/warranty/prices, opening hours, logo + exact blue/orange
   colours, 6-10 before/after photos, Google review link, confirm Sungai Jawi branch.
   DONE 2026-09-27: the 4 films + compact prices (catalog.default.json, from his
   WhatsApp list). STILL NEEDED: prices for sedan/SUV/large and for the windscreen +
   rear glass (the list covers 4 side windows only; site says "Tanya" for the rest).
   Ask him too: Black UV's lightest is 50% film, and JPJ measures glass + film
   together, so on the front side windows it likely reads under 50% (a fail).
   Staff Settings > Filem now edits `ir`, `grade` and `vlt` too (2026-09-28).
   Customer photos go in `SHOP.gallery` (shop.js) with `car` + `film` captions;
   the demo shows 6 labelled empty frames until then.
3. When owner signs: new Supabase (Singapore) + new Vercel, follow README "Setup".
   VAPID keys are generated once and never regenerated.
4. Then a real-device test: book online -> push arrives on staff phone -> job flows
   to Selesai -> certificate link opens.

## Staff app look (2026-10-25, replaces the dark 2026-09-28 look)
WHITE, with Salesman Premium's design (UI-1): soft shop-colour light behind the page,
white cards on a slight shadow, ONE accent = the signboard blue `#1d3fc4` (same as the
public site `--accent`). The "Perlu tindakan" card glows red while it has items (`.attn`).
Shop-floor sizes: 15px body, 12px+ labels, 16px inputs (iOS zooms under 16). Every tappable
thing scales to .96 on press (`staff.css`, end of file; reduced motion = tint instead).
Dashboard order (owner's rep, 2026-10-25): greeting, walk-in, **Perlu tindakan**, walk-in
waitlist, schedule, then "Bulan ini" money tiles. The push warning is hidden in the demo.
Phones keep the BOTTOM BAR (owner: one-handed between cars). Owner settings is a nav tab,
split into category tabs: Harga | Filem | Slot & bay | Hari tutup | Staf (`src/staff/Settings.jsx`).
One save bar for all tabs, a dot marks each tab with unsaved edits.

## Public site: content rules (2026-10-25)
Gallery and team are NOT rendered until there is a real photo, demo included.

## Walk-ins + pricing (2026-09-27, migration `0003_walkins_addons.sql`)
Owner's rule: a booking holds its slot, walk-ins get whatever is left.
- Capacity = time blocks x bays (`cars_per_slot`); only `online_per_slot` bays per block
  are sold online. `available_slots` counts web bookings against that share and every
  job against the bays; staff walk-ins use the full bay count.
- Price = side-window film (per size) + add-ons (per size, `shop_settings.addons`).
  `quote_price()` (DB) and `quote()` (render.js) are the same rule: no total unless every
  part is priced. Never bring back "Harga tetap" next to a partial price.
- Late rule: 15 minutes (`LATE_MINUTES`, shop.js). Staff move a late booking to the next
  FREE block in one tap; never bump someone on time. Waitlist gets the next free bay.
- Customer link `/urus/?t=` (`get_booking` / `manage_booking`): exact token, never
  returned, no phone number. Cancel frees the slot and pushes 'Pelanggan batal'.
- Decided with the owner's rep (2026-09-27): blocks + online cap, NOT minute-level job
  durations; staff send reminders (link inside), NO WhatsApp Business API auto-send;
  NO deposit for now (look at no-shows in Laporan after a month first).
- Still open (owner decisions, not built): security film, fleet/dealer/Grab rates, a
  "warranty visit" booking type, pick-up/drop-off service, real job durations to show
  customers, opening hours, Google reviews.

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
- Booking form (`/tempah/`) is ONE question per screen (owner, 2026-09-28): size -> film ->
  add-ons -> day -> time -> wait/leave -> details. A tap answers and slides to the next
  unanswered question (`advance()` in src/public/booking.js); only the last screen types.
  Summary chips at the bottom jump back to a question; the phone's back gesture steps back.
  Don't bring back a long scrolling form or a second column: it is the same on desktop.
- Phone spacing: one side margin (`--gutter`), equal left/right. A checker that flags
  lopsided blocks at 375px lives in the session scratchpad only; re-measure after layout work.
- Never advertise darker than JPJ on the windscreen / front side windows (the
  owner's WhatsApp copy says "5% if the customer asks"): the site offers 5% on the
  REAR only. Verified 2026-09-27: 70% / 50% / rear no limit, Kaedah 1991 as amended 2019.
- Public site design (2026-10-25, owner's rep: "use taste skill, web design guidelines, awesome
  design, image to code"). Skills live in `.claude/skills/` (design-taste-frontend, frontend-design,
  web-design-guidelines, image-to-code) and car-brand DESIGN.md references in `.claude/design-refs/`.
  Built with taste-skill: direction "One motif" (seed 1588499643). The motif is a CAR SIDE WINDOW,
  a block with one slanted edge (`--win-l` / `--win-r`, home.css): the hero photo window, the
  buttons, the bullets, the FAQ tabs, the proof heading tile. Type: Libre Franklin 700 headings,
  Source Serif 4 body. Colour: white ground, near-black ink, signboard blue `--papan` as the large
  motif field, sign yellow `--huruf` = the action. Square corners, no shadows at rest, no
  gradients, no labels above headings. Homepage order (the argument): hero (heat headline, service
  question, three facts) -> film picker (the one live thing: pick a film, drag the rear darkness,
  see the shop through the glass) -> price table -> JPJ proof tiles + sample certificate -> add-ons
  and other services -> question cards -> visit coupon -> block-letter footer. Files:
  `index.html`, `src/public/home.css`, `src/public/home.js`, `src/shared/homeRender.js`; shared
  type/header/footer at the end of `site.css`. Gate: `node .claude/skills/design-taste-frontend/
  scripts/inspect.mjs <url>` (CHROME_PATH must point at a Chrome started with --no-sandbox when
  running as root). Last run: 2 FAIL left, both waiting on the owner's photos (picture floor)
  and one off-centre reading at 390px that a direct measurement does not reproduce (24px / 24px).
- Staff app colours are still placeholders (`--brand-*` in `src/staff/staff.css`).
- No auto-send to customers: WhatsApp buttons open a draft, a person presses send.

## Public site look + owner-edited content (2026-09-28)
- Real shopfront photo in the hero (faded in from the right; below the text on phones).
  Sections carry blurred shop-colour light (`.glow`), cards are frosted glass, content
  eases in on scroll (`.reveal`, only after JS marks it, off for reduced motion).
- The tint preview is a full-width section (`#filem.studio`), not a card; same `.wrap`
  gutters as everything else. A glare sweep crosses the panes and fades as the rear
  darkens (`--glare`, tint.js). Panes stay SQUARE (owner, 2026-09-27).
- `shop_settings.site` (migration 0005) = services / team / videos, edited by the owner
  in Tetapan > Laman web; public read only through `get_catalog`. Team photos go to the
  public `site` bucket (owner-only writes), shrunk to 480x600 WebP on the phone.
  Videos: YouTube / TikTok links only (`videoOf`, render.js), click-to-play, so nothing
  from those sites loads until tapped. Empty list = that section is not rendered.
- Polish + karpet are listed as services with "Tanya harga" + WhatsApp, NOT bookable
  online (see TODO: needs packages + durations from the owner).
- No stock photos, ever: every image on the site is the shop's own.

## Stand-ins to replace before launch (2026-10-26)
- Hero car (`public/hero-car.webp`): cut from the owner's AI mockup screenshot. Replace with a real photo of a car tinted at the shop.
- The trust row, drawn-car gallery, film comparison and reviews section (commit e2f31d8) were rolled back with the CarWash-style sections on 2026-10-26; they are in git history if wanted again.

## Homepage = production page + new hero (2026-10-26)
The owner rolled the homepage back to production (`main`) and kept only the dark banner hero with the
booking form. The hero is self-contained: `src/public/hero.css`, `src/public/hero.js` (loads `site.js`),
`src/shared/heroForm.js` (slot `hero-form` in vite.config.js), `public/hero-car.webp`, body class
`v4 on-photo` (header sits on the banner; `nav.js` makes it solid on scroll). `/tempah/` accepts `?size=`.
The production hero's "Slot kosong terdekat" card is gone with the old hero; the UI test checks the form instead.

## Session end 2026-10-26 (branch ccr-5ba14573-gb4lv2, head 41a0bb5, not merged; main = 772d224)
- Our work strip (`#kerja`, under the hero): 15 owner photos in `public/kerja/01..15.webp` (600x800),
  5 across on desktop with arrows, 3 on phones with swipe. Captions are model guesses; owner confirmed
  #11 is a Proton Saga. Still to confirm: Harrier, S70, Axia.
- Tint preview (`#filem`, `carSvg` in src/shared/render.js): AI photo of a green coupe
  (`public/tint/car-front.webp`) + 2x alpha masks `car-front-{ws,front,rear,glass}.png`, built from the
  owner's magenta-glass copy (alpha = how much magenta each pixel took). Sliders: see 2026-10-26 (2)
  below (windscreen now adjustable too). Static sky reflection `.cp-glass`.
  `tintOpacity` exponent 1.4 = darker than true VLT on purpose (owner). Labelled "Gambaran sahaja".
- Back view not built: needs the same car rear 45deg + magenta copy (prompt in chat). Then add a
  front/back switch.
- BMW badge/grille visible in the coupe photo: owner's call whether to regenerate without badges.
- Tint-Simulator repo (Kevinlearynet) is PolyForm Commercial (paid licence): NOT used, do not copy.

## Session end 2026-10-26 (2) (branch claude/tinted-carstory-handoff-wkkh3o, head after this commit; main = 772d224, not merged)
Branch fast-forwarded from ccr-5ba14573-gb4lv2 (aac3276), then:
- Tint preview, look (f5a22cf, d62c29f): `car-front.webp` is now a cut-out (rembg BiRefNet, transparent
  round the car) cropped to 1128x570 (crop box x72-1200, y150-720 of the old 1264x848); the window masks
  are cropped to match. `car-front-bg.webp` = the full photo, shown only from 42% down (`.cp-bg`
  clip-path), so the roof and glass stand out above a half box.
- Phones (<=860px): `tint.js` moves `.glass-col` (car + sliders) into `[data-hero-tint]` under the hero
  trust row; the banner car hides (`.hero:has(...)` in hero.css). Desktop keeps it in `#filem`. The film
  tabs and price card stay in `#filem` and still drive it.
- Controls (da86840, 38e1692): three upright sliders (`writing-mode: vertical-lr`, up = darker):
  windscreen 70-100, front side 50-100 (never below JPJ), rear per film range. Colour swatches
  `TINT_COLOURS` in render.js: Hitam, Charcoal, Bronze, Biru, Hijau (Perak removed by owner); note says
  colours depend on stock. Blue/green/bronze are a bit brighter than real film so the hue shows when dark.
  Callouts: thin labels on circuit-style lines (`.cp-lines` SVG, % of the frame) for all three windows.
- Preview -> booking (05ddaaa): "Tempah slot" on the price card links `/tempah/?film=&ws=&front=&rear=&warna=`.
  booking.js shows a chip ("Tint 80 · 60 · 15% Bronze") and saves "Pilihan pratonton: ..." at the top of
  `p_notes` (no DB change; 500-char limit kept by shrinking the notes box). Values darker than JPJ or an
  unknown colour are dropped. UI test 2b covers it (57 checks pass).
- Running the UI test locally: build with the mock env (see tests/ui.test.mjs header), `vite preview
  --port 4174`, and link the global Playwright into node_modules (ESM import can't see it otherwise).
Open:
- Owner to confirm which colours the shop really stocks; remove the rest.
- Picks live in notes only; separate columns needed if they should show on the certificate.
- Older items above still open (back view, BMW badge, real hero photo, captions, free-days card,
  Google review link, prices, hours, Vercel access, merge only on owner's go-ahead).

## Session 2026-10-26 (3) (branch ccr-d7d3bf16-v6jrgq, from a969112; main = 772d224, not merged)
Polish on the sections under the tint preview (Servis lain, Cara tempah, Had JPJ, Soalan lazim):
- Certificate sample + footer: the header's dark-banner logo (`.v4 .wordmark`: white/yellow text, T mark,
  "PREMIUM AUTO CARE") leaked onto these light cards, so the name was unreadable and the tagline invisible.
  Scoped to `.v4 .mast .wordmark` in hero.css; the cert and footer show the plain blue/ink wordmark again.
- "Had JPJ" eyebrow was 12px while every other section's was 15px (they inherited `.sec-head p`'s size).
  `.sec-head .eyebrow, .proof .eyebrow` now set 15px on purpose.
- Servis lain: `.svc-grid` uses auto-fit, so two services fill the row instead of leaving an empty third column.
- Tests: UI 57/57, report + logic pass.
- Colour tokens (user, 2026-10-26: "use tokens from now on for these sections"): brand colours carry
  `--accent-rgb` / `--orange-rgb` / `--sun-rgb` next to their hex; `--grad`, `--glow` (the `.glow` blobs)
  and `--glass*` (frosted cards) are built from them. Servis lain reads only `--svc-*` tokens set on
  `#servis`. Do the same for each section as it gets reworked (Cara tempah, Had JPJ, Soalan lazim next).
- Servis lain: third card "Polish lampu depan" (headlamp polish) in catalog.default.json. NAME/WORDING TO
  CONFIRM with the owner. The live site reads services from the DB (`shop_settings.site`), so the owner
  must add it in Tetapan > Laman web for it to show in production.
- Servis lain, owner's direction (2026-10-26, replaces the dark/photo version, which the owner rejected):
  layout copied from his reference shot: big heading top-left, white cards stepping up to the right
  (`--svc-step`) with the `--grad` edge (`--svc-border`), an icon per service id (`SVC_ICONS` in render.js; unknown ids get a spanner), on the tint
  preview's blue (`--blue-ground-up`, the same blue flipped so it joins #filem with no edge). Cards fade in
  one after another on scroll (`.reveal` + `--i` delay). Theme for the remaining sections: WAIT for the
  owner's direction, do not convert them. `theme-dark` / `theme-light` token sets stay in site.css, unused.
- Cara tempah = owner's pick F of 7 mockups (2026-10-26): `#cara` in index.html. The shop's hex ceiling as a
  background pattern (inline SVG, faded in from the right and from the top), a hexagon marker per step that
  "switches on" like the bay lights as the steps fade in one by one. On `--blue-ground` (dark top, joins the
  bottom of Servis lain). Colours only via `--stp-*`. Old `.steps/.step` CSS (01/02/03 numbers) removed.
  Next up: Had JPJ, Soalan lazim, Lokasi, footer (still pastel). Wait for the owner's direction on each.
