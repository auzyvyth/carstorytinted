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

## Session end 2026-10-26 (3) (branch ccr-d7d3bf16-v6jrgq, head after this commit; main = 772d224, not merged)
Branch starts from claude/tinted-carstory-handoff-wkkh3o (a969112), so it carries session (2) too.
Nothing deployed, no PR. Tests: UI 57/57, report + logic pass.

Page order now (desktop AND phones, owner): hero (with the booking card) -> Lihat hasilnya dulu (#filem)
-> Hasil kerja kami (#kerja) -> Servis lain -> Cara tempah -> Had JPJ -> Soalan lazim -> Lokasi -> footer.

Shipped:
- Hero booking card (#borang) shows on phones too, under the buttons/badges; its styles left the desktop-only
  media query (hero.css). "Tempah Slot, Bayar di Kedai" scrolls to it on every screen.
- Tint preview no longer moves into the phone hero ([data-hero-tint] slot, tint.js move, .hero-tint CSS removed).
- Servis lain (render.js `servicesSection`/`servicesHtml`): owner's reference layout. Heading top-left, white
  cards stepping up to the right (`--svc-step`), `--grad` border (`--svc-border`), an icon per service id
  (`SVC_ICONS`; unknown ids get a spanner), whole card = WhatsApp link, staggered fade-in (`.reveal` + `--i`).
  Ground `--blue-ground-up` (the tint preview blue flipped so the join has no edge). 582px tall on desktop.
  Third card "Polish lampu depan" added to catalog.default.json.
- Cara tempah (#cara, index.html): owner's pick F of 7 mockups. The shop's hex ceiling as a background pattern
  (inline SVG, faded from the right and top), a hexagon per step that switches on like the bay lights as the
  steps fade in. Ground `--blue-ground`. 01/02/03 strip CSS removed.
- Fixes: header logo styles (`.v4 .wordmark`) leaked onto the certificate sample + footer (unreadable) ->
  scoped to `.v4 .mast .wordmark`. "Had JPJ" eyebrow size now matches the others.

Colour tokens (owner: "tokens from now on, change colour in a split second"):
- Brand colours in `:root` of site.css carry hex + `-rgb` channels (`--accent`, `--orange`, `--sun`); change
  both forms together. `--grad`, `--glow`, `--glass*`, `--blue-ground(-up)` are built from tokens.
- Each reworked section reads only its own tokens, set on the section: `--svc-*` (#servis), `--stp-*` (#cara).
  Do the same for every section reworked next.
- `.theme-dark` / `.theme-light` token sets exist in site.css but are UNUSED: the owner rejected the all-dark
  restyle. Do not restyle a section on your own; owner gives direction per section (mockups worked well:
  build 5-7 options as screenshots, let him pick).

Open:
- Next sections, wait for the owner's direction: Had JPJ, Soalan lazim, Lokasi, footer (still pastel,
  eyebrows, Plus Jakarta Sans).
- "Polish lampu depan" name/wording to confirm; production reads services from the DB, so it shows live only
  after the owner adds it in Tetapan > Laman web.
- Make it work for real (README Setup 2-4): push keys, `notify-staff` deploy + secrets, staff users. Until
  then bookings save but no one is alerted.
- Hosting/cost (answered for the owner pitch): Supabase Free is enough for one shop (add a weekly backup
  job; keep the project in the shop owner's own org to avoid the 2-free-projects limit). Vercel Hobby is
  non-commercial only: move to Cloudflare Pages (free, commercial OK, same build + 2 env vars) or pay Vercel Pro.
- Ideas raised, not built: live "next free slot" line near the booking button, Google reviews, team/videos
  content, real before/after photos.
- Older items still open (see (2) above): colours stocked, picks on the certificate, back view, BMW badge,
  real hero photo, captions, prices, hours, Vercel access, merge only on owner's go-ahead.
- Mockup + inspector tooling: `.taste-skill/` is gitignored; the design-taste inspector needs
  CHROME_PATH pointing at a wrapper that adds `--no-sandbox` (running as root).

## Session end 2026-10-26 (4) (branch ccr-adac2795-ujjh34, head after this commit; main = 772d224, not merged)
Branch starts from ccr-d7d3bf16-v6jrgq (6180149), so it carries sessions (2) and (3) too.
Nothing deployed, no PR. Tests: UI 57/57, report + logic pass.

Shipped:
- Hero: car photo (`.hero-car`) removed from index.html. Ground = the tint preview's own background, copied
  exactly (owner: "just copy the background from the tint slider"): `--blue-ground` + the two blurred lights of
  `.studio` (orange low centre, blue top right), as `--hero-ground`, `--hero-light-low`, `--hero-light-high`
  on `.v4 .hero` (hero.css). The ::before/::after reset the old photo panel's site.css rules (position, mask).
  A first "deep ocean" gradient was rejected; don't bring it back.
- Header blur is off while it sits on the hero (`.v4.on-photo .mast:not(.solid)`): it drew a band on the blue.
- Phone hero no longer reserves 300px at the bottom for the car.
- `public/hero-car.webp` is unused now but kept, in case the owner wants it back.

Known: the hero ends on the LIGHT end of --blue-ground and the tint preview starts on its DARK end, so there is
a visible line between them. One-line fix offered (hero on `--blue-ground-up`, as Servis lain does); owner
hasn't answered.

Sijil (homepage #sijil = "Had JPJ / Lulus JPJ. Ada bukti.") audit, NOT fixed yet:
1. "Lulus" shows grey: `.cert-row span` (muted) beats `.pass`/`.fail`. Same bug on the real /sijil/ page
   (vltRows in render.js), so "Bawah had" isn't red either. Customer-facing; fix first.
2. Sample cert card is tinted: site.css ~483 gives `.cert` a 78% white padding-box over the --grad border-box.
3. `aria-label` on a plain div (`.cert`) is ignored by screen readers.
4. Menu says "Sijil waranti", section says "Had JPJ".
5. Sample is thinner than the real cert (no cert no., customer, install date, min per window, shop address).
6. Sample says "Nano Ceramic"; the hero/booking say "Nano Ceramic HD".
7. The VLT bars can read as "how dark"; nothing explains it.
8. "Cari sijil dan resit anda" is small grey text at the bottom.
9. Still pastel, after two blue sections (waits for the owner's direction, like the other old sections).

Research (for the sijil and the copy):
- JPJ limits (Motor Vehicles (Prohibition of Certain Types of Glass) Rules 1991, amended 2019): windscreen
  min 70%, front side min 50%, rear free (guides add: only with both side mirrors working; not confirmed in
  an official source). Measured on factory glass + film together. Reflective films banned whatever the
  reading. Fine up to RM2,000 / 6 months (first), RM4,000 / 12 months (repeat).
- JPJ issues NO installer certificate. The sijil is the shop's own record: say "Memenuhi had JPJ semasa
  diukur", never "Diluluskan JPJ". The hero's "Lulus JPJ" chip needs the same care.
- Brand e-warranties (3M, SunTek, G3) = code/serial + check by code or plate + end date.
- PDPA: photos, and plates linked to an owner, are personal data: privacy page line, visible only via the
  customer's cert link, delete when the warranty ends.

"Bukti hasil tint" (owner's idea: installer photographs the VLT meter on each window, photos go on the sijil):
- Mockups, private artifact (user must share it with the owner):
  https://claude.ai/artifact/LmQCrgqFgtNQ2aqhFxd1HQ
  Customer cert: A Sijil kertas (document, QR, signature), B Bukti dulu (big meter photo first),
  C Pasport kereta (site blue, car photo, top-down plan with readings), D Garis masa (job timeline).
  Installer dashboard: E Petak foto (4 slots in JobDrawer, Siap greyed until required photos are in),
  F Kamera berpandu (full-screen camera, one window per step).
  Meter photos in the mockups are drawn stand-ins; car photo is public/kerja/04.webp.
- Waiting on the owner: which design (A-D) and which capture flow (E/F); which VLT meter the shop uses;
  required photos (windscreen + front side, plus finished car?).
- Build plan once picked: new `job_photos` (job_id, kind, reading, taken_by, created_at = server time);
  storage path includes cert_token (photos as private as the cert link; stricter option = private bucket
  + edge function for signed URLs); upload compressed like Settings.jsx team photos; Siap gate with a
  "teruskan juga" override (like the missing-VLT confirm in JobDrawer.advance); get_certificate returns the
  photos; /sijil/ shows them; privacy page line; delete after warranty_until. Fix audit bugs 1-3 in the same build.

Still open from (3): Had JPJ / Soalan lazim / Lokasi / footer restyle (owner direction), "Polish lampu depan"
wording + adding it in Tetapan, README Setup 2-4 (alerts), hosting move off Vercel Hobby, ideas list, and the
older items (colours stocked, back view, BMW badge, real hero photo, captions, prices, hours, Vercel access,
merge only on owner's go-ahead).

## Session 2026-10-26 (5) (branch claude/wizardly-fermi-4q1fbq, from ccr-adac2795-ujjh34 1472aea; main = 772d224, not merged)
Photo proof, first build (owner: "start the project, the dashboard now"). Capture flow = E (Petak foto).
The certificate design (A-D) is NOT picked yet: photos show on today's certificate as thumbnails.
- `supabase/migrations/0006_job_photos.sql` (NOT run on Supabase yet): `job_photos` (job_id, kind
  windscreen|front|rear|car, url, taken_by = auth.uid(), created_at forced to server time by trigger),
  unique (job_id, kind), staff select/insert/delete, no update, anon nothing. Bucket `bukti`: public by
  URL, random file names, NO anon select policy so it can't be listed; staff insert/select/delete.
  `cert_photos(job)` (internal, no grants) feeds `get_certificate` + `get_booking` (`photos` key; booking
  only once done). DB test 12 covers it.
- Job screen: `src/staff/JobPhotos.jsx`, 4 slots under the VLT readings (dalam_kerja/siap/selesai only).
  Shrinks to 1280px WebP on the phone (drops EXIF/GPS), retake replaces, Buang deletes file + row.
  "Tandakan siap" asks first when the windscreen or front photo is missing (`missingRequired`).
- Certificate (`src/shared/render.js` vltRows + carPhoto): thumbnail per reading, finished-car photo on
  top, "Masa dicatat oleh sistem" line. Used by /sijil/ and /urus/.
- Sijil audit bugs 1-3 fixed: verdict colour (`.cert-row > span`), solid white cert (dropped `.cert` from
  the frosted rule), sample `role="group"`. Sample now says "Nano Ceramic HD". Verdicts don't wrap.
- Demo backend + UI mock know `job_photos`. Tests: UI 66/66, DB 12/12, report + logic pass.
- Open: PHOTO-PURGE (TODO), "Lulus JPJ" wording on the verdict vs "Memenuhi had JPJ semasa diukur"
  (owner call), the hero/tint-preview line, and everything from (4).

### Same session, later: certificate = design C, safer wording (owner, 2026-10-26)
- /sijil/ is now design C "Pasport kereta" (`src/public/cert.js` + `src/public/cert.css`): finished-car
  photo on top (only a real `car` photo, never a stock one), site blue + the two soft lights, readings in a
  row over a top-down car (windscreen | front sides | rear), tap one -> white card with that meter photo,
  "Diukur oleh <installer first name>, HH:MM", warranty ring, fine print "Sijil ini rekod kedai, bukan
  dokumen JPJ". `get_certificate` now returns `installer` (first name; 0006, still not run).
- Wording: never "Lulus JPJ". Per window "Dalam had" / "Bawah had" / "Tiada had"; summary
  "Memenuhi had JPJ semasa diukur" (`MEETS_JPJ`, `verdictOf`, `jpjSummary` in render.js, shared with /urus/
  and the saved PNG). Homepage: hero chip "Ikut had JPJ", heading "Ikut had JPJ. Ada bukti.", sample rows
  "Dalam had". Staff drawer: "Dalam had JPJ".
- No warranty terms invented: the card says "Ada masalah filem? WhatsApp kami dengan nombor sijil", not the
  mockup's "Gelembung, kopak, bertukar ungu: kami ganti" (owner hasn't given terms).
- Tests: UI 68/68, DB 12/12, logic + report pass.

### Same session, later: short laptop screens + homepage sample (owner, 2026-10-26)
- Owner's 11-inch Chromebook (1366x768, ~640px of page) showed the hero and tint preview too big and too
  tall. New `@media (min-width: 861px/900px) and (max-height: 820px)` blocks: hero.css (header 72px, hero
  copy + booking form sized to the screen height) and site.css (tint preview: car scales with 58svh,
  shorter sliders/chips; every `section` 52px padding). Big screens unchanged. At 1366x640: hero 640 with
  the whole form, tint preview 612, #sijil 653. UI test checks the fit.
- Homepage #sijil sample = design C (`certSample()` in render.js, baked via the `cert-sample` slot;
  `carPlanSvg` shared with /sijil/; cert.css loaded by hero.js). Static, no fake meter photo.
- Tests: UI 69/69, logic + report pass. DB unchanged (12/12).

### Same session, later: /tempah/ redesign (owner: "max 2 options per stage, never full form", taste skill)
- `src/public/booking.js` rewritten, `src/public/booking.css` new, `tempah/index.html` on the blue v4 look
  (same ground and option rows as the homepage hero form). Steps, at most TWO things asked each:
  saiz -> filem -> (tambahan) -> bila (day row + time, earliest free day pre-picked) -> tunggu (2 choices)
  -> anda (name + WhatsApp) -> kereta (plate + model) -> sahkan (review + consent). Answered-by-link steps
  are skipped (?size=&film= hero form, ?film=&ws=&front=&rear=&warna= tint preview, ?date= slot card).
- "Tempahan anda" (desktop right column, phones on the last screen): the certificate's car drawing shaded
  with the darkness + colour from the tint preview (`carPlanSvg(sel, look)` in render.js), every answer
  (tap = go back to it), the estimate. Stays beside the confirmation, read-only.
- DROPPED from the online form: "Dari mana anda tahu" (heard_from, now null for web bookings; staff set it
  in the job screen) and the free-text notes (the tint picks still go into notes). Owner can ask for either back.
- All 9 booking buttons on the homepage already went to /tempah/ (header x2, hero button, hero form, 4 tint
  "Tempah slot" with the look, steps section); UI test 2c counts them.
- Tests: UI 76/76. Taste lint: 0 FAIL (warnings kept on purpose: option-row outlines match the hero form,
  brand font, calendar date padding). Chromebook 1366x640: every step fits without scrolling.

### Same session, after release #8: /urus/ (customer page) on the new design
- `src/public/manage.js` view rewritten + `src/public/manage.css`; `urus/index.html` on the blue v4 page
  (reuses booking.css + cert.css). Left: "Salam, <name>", status line, 5-step progress, date/time, actions
  (Saya akan datang / Batalkan, or WhatsApp + Simpan gambar). Right: "Tempahan anda" / "Resit" (money).
  Done: the design C certificate (readings over the car, meter photos, warranty) in the left column.
- The certificate block is a <div>, not <section>: site.css gives every section 80px padding.
- 0006_job_photos.sql applied on live Supabase (tinted-carstory) 2026-10-26 by the owner via SQL editor; verified: RLS + 3 policies, bukti bucket (2 MB, webp/jpeg) + 3 staff policies, no anon access to table/bucket/cert_photos.
