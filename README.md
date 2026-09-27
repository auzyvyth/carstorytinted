# Tinted Carstory: booking site + staff CRM

Client build for Car Story Pro Auto (Kedai Tinted Bumiputera, Sungai Jawi).
Standalone: its own Supabase project, its own Vercel project. Not part of the ShiftOS build.

| URL | What |
|---|---|
| `/` `/harga/` `/panduan-jpj/` `/privasi/` | Public site. Static HTML (full text for Google + AI crawlers), JSON-LD `AutoRepair` + `FAQPage`, `sitemap.xml`, `robots.txt`, `llms.txt` |
| `/tempah/` | Self-service booking: car + film -> free slot -> details. No deposit |
| `/sijil/?t=...` | Customer's VLT + warranty certificate (noindex, token-protected) |
| `/urus/?t=...` | Customer's own booking link: confirm or cancel (noindex, token-protected). Sent in the confirmation + day-before reminder |
| `/staff/` | Staff CRM, installable PWA with push. Dashboard + Pipeline; owner also gets Laporan (report + CSV export) and a settings gear |

## Sales demo (VITE_DEMO=1)
Build with `VITE_DEMO=1` and no Supabase keys: every page runs on sample data kept in the
visitor's own browser (`src/shared/demoBackend.js`). Banner on every page, noindex,
robots `Disallow: /`. Staff login has one-tap "pemilik" / "staf" buttons (or
`pemilik@demo.my` / `staf@demo.my`, password `demo1234`); "Mula semula" resets.
Customer WhatsApp/call buttons never dial the invented sample numbers. A normal build
contains none of this code. Vercel project `tinted-carstory-demo` (env `VITE_DEMO=1`)
is this build; it only rebuilds when this folder changes.

## Where things live
- Shop facts (name, phones, address, towns): `src/shared/shop.js`. One place.
- Films, prices, slots, closed days: the database (`shop_settings`), edited by the owner from the gear in `/staff/`. `src/shared/catalog.default.json` is only the copy baked into the static HTML.
- Colours: the `--brand-*` lines at the top of `src/public/site.css` and `src/staff/staff.css`.
- Security model: header comment of `supabase/migrations/0001_init.sql`.

## Setup (about 30 minutes, once)
1. **Supabase**: new project, region Singapore. Database -> Extensions: enable `pg_net` (booking push) and `pg_cron` (retention + the 30-minute "still unconfirmed" reminder) FIRST. Then SQL editor -> run `supabase/migrations/0001_init.sql`, `0002_dashboard.sql`, `0003_walkins_addons.sql`, in that order. (Enabled the extensions after? Rerun each file's `do $$ ... cron.schedule` block.)
2. **Push keys**: `npx web-push generate-vapid-keys`. Save both somewhere safe. **Never regenerate**: every staff phone's subscription is bound to this pair and dies silently if it changes.
3. **Edge function**: `supabase functions deploy notify-staff --no-verify-jwt`, then
   `supabase secrets set NOTIFY_SECRET=<random 32+ chars> VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<owner email>`.
   **Backup alert (recommended):** create a Telegram bot with @BotFather, add it to a group with the owner (or message it once), get the chat id, then
   `supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...`. Every online booking (and the 30-minute reminder) then also lands in Telegram, so a booking is heard even if no staff phone has notifications on.
   In SQL: `insert into app_config values ('notify_url','https://<ref>.supabase.co/functions/v1/notify-staff'), ('notify_secret','<same random>');`
4. **Staff accounts**: Authentication -> Users -> Add user (email + password, auto-confirm) for the owner and each worker. Then:
   `insert into staff (id, name, role) values ('<owner uuid>', 'Maliki', 'owner'), ('<worker uuid>', 'Tam', 'staff');`
   Turn OFF public sign-ups (Authentication -> Providers -> Email -> "Allow new users to sign up"). Staff are the only users.
5. **Vercel**: new project from this repo, Root Directory `clients/tinted-bumiputera`, framework Vite. Env vars from `.env.example`. Add the domain, then set `SITE_URL` and redeploy (turns on canonical URLs + sitemap).
6. **Google**: create/claim the Google Business Profile, put its review link in `shop.js` (`googleReviewUrl`), submit `sitemap.xml` in Search Console.

## Before launch: owner must confirm (the site does not invent any of this)
- [ ] **A VLT meter.** The site promises every window is measured and the certificate shows the readings. No meter = remove that promise first.
- [ ] Film names, real heat-rejection / UV numbers from the supplier, warranty years, prices per size (gear in `/staff/`). Blank shows "Tanya harga".
- [ ] Opening hours (`shop.js` `hours`), time blocks, bays per block and how many are sold online (the rest are the walk-in reserve), closed days.
- [ ] Add-on prices per car size: windscreen, rear glass, sunroof, old-tint removal (gear in `/staff/`). Blank shows "Tanya" and the site never shows a partial total as the price.
- [ ] Logo file + exact brand colours; 6-10 real before/after photos (`shop.js` `gallery`).
- [ ] Check the privacy notice at `/privasi/` matches what they actually do.

## Tests
- `npm run test:db`: runs both migrations on a local Postgres 16 (with pgcrypto in `extensions`, as on Supabase) and probes them as the public, a worker, an inactive worker and the owner (11 checks).
- `npm run test:ui`: clicks through the built site and CRM at 375px against a fake Supabase (40 checks).
- `npm run test:report`: the owner report maths against hand-counted fixtures (17 checks).
- `npm run test:logic`: walk-in rules on a fixed clock: free bay, 15-minute late move, waitlist offer (13 checks). Build first with `VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_ANON_KEY=anon`, serve on :4174.

## Known limits (v1)
- Staff money totals are hidden from the `staff` role in the UI; a worker can still see a single job's price (they collect payment). The database does not hide prices per role.
- No online deposit. Forgotten passwords are reset by the developer in Supabase.
- Jobs are never hard-deleted: the owner's "Padam" archives (restorable under Batal > Dipadam). Only the retention job (`purge_old_jobs`) removes rows.
- iPhone push works only after "Add to Home Screen" (Apple rule, iOS 16.4+). The dashboard explains this.
