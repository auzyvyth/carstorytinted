# TODO: Tinted Carstory

From the security, CRM, feature and SEO/GEO audit (2026-09-28). Nothing below is
built. Only the "Sell" section is being done now. Everything after it waits for
the owner (Maliki) to agree and pay.

## 1. Sell (now, before any paid work)
- [ ] **Demo build.** Turn Vercel project `carstorytinted` into the sales demo
      (env `VITE_DEMO=1`, no Supabase keys) so the pitch never touches the real DB.
      Delete `carstorytinted2`.
- [ ] **Pitch walkthrough.** Book on `/tempah/` -> staff app shows it -> confirm ->
      mula kerja -> siap (VLT readings) -> sijil link -> Laporan. Both logins
      (pemilik / staf) so he sees what a worker can and can't see.
- [ ] **Ask him what's missing.** Put his answers into section 4 below, marked
      "owner asked". Questions: VLT meter yes/no, sedan/SUV/large prices,
      windscreen/rear/sunroof/removal prices, opening hours, how he pays workers
      (per car?), does he track film stock, warranty claims, fleet/Grab rates.
- [ ] **Grant check (Geran Digital PMKS Madani, BSN).** 50% matching, max RM5,000,
      but ONLY for solutions bought from an MDEC Digitalisation Partner (MD-status
      company). We are not one, so he can't claim it on this build today. Confirm
      2026 intake on bsn.com.my before mentioning it in the pitch.
- [ ] **Agree price + scope in writing** (WhatsApp is fine): what is included in
      setup, what is monthly, what is a paid add-on.

## 2. On signing: setup (included in the setup fee)
- [ ] **Booking alerts.** Deploy `notify-staff`, VAPID keys (never regenerate),
      `NOTIFY_SECRET`, `app_config` rows, Telegram backup (README Setup 2-3).
      Live check 2026-09-28: no edge function, `app_config` empty, 0 push devices,
      so `nag-unconfirmed` fires every 10 min and reaches nobody.
- [ ] Staff accounts for each worker (README Setup 4).
- [ ] Auth: turn OFF public sign-ups; turn ON leaked-password protection.
- [ ] A second owner account (backup): today there is exactly one owner, and
      `staff_owner_write` (0001_init.sql:338) lets that owner switch themselves off.
- [ ] **Domain** (.my / .com.my) -> set `SITE_URL` on Vercel -> redeploy. Without it
      there is no sitemap, no canonical, no robots Sitemap line (vite.config.js:61).
- [ ] Google Search Console: add the domain, submit sitemap.xml.
- [ ] **Google Business Profile**: claim it, then fill `googleReviewUrl` and `hours`
      in `src/shared/shop.js` (both empty today, lines 21-24).
- [ ] **VLT meter claim.** FAQ (`src/shared/render.js:231`) says every window is
      measured with a meter; it also goes into FAQ JSON-LD and llms.txt. Owner has
      not confirmed he owns one. Confirm or remove BEFORE the site is promoted.
- [ ] Remaining prices (sedan/SUV/large, add-ons) via staff Settings.

## 3. Paid phase: security hardening
- [ ] **Price / payment change log.** `jobs_after_write` (0001_init.sql:168) logs only
      `paid_amount`. Log `price`, `payment_method`, `installer_id` to `job_events`;
      once money is recorded, only the owner may change the price. (Cash-skim risk.)
- [ ] **Staff read scope.** `jobs_staff_read` (0001_init.sql:343) gives every worker
      every job ever (all customer phones + money). Staff: open jobs + last 30 days;
      older search via a limited RPC. Owner keeps everything.
- [ ] **Booking spam.** No human check on `/tempah/`; brakes (0003:121) are 3/phone/week
      + 30/hour shop-wide, so fake numbers can fill a month of online slots and the
      shop-wide brake then blocks real customers. Add Cloudflare Turnstile, verified
      server-side before `book_slot`.
- [ ] **Lock `warranty_until` + `completed_at`** in `jobs_before_write` (0002:26) so
      only the trigger sets them.
- [ ] **Wipe the device cache on "Tiada akses".** `useJobs.js:21` keeps every
      customer on the phone; a deactivated worker's copy survives (App.jsx:207).
- [ ] Security headers in `vercel.json` (at least `frame-ancestors 'none'`).
- [ ] Pin `search_path` on `shop_today` + `normalize_phone` (Supabase advisor).
- [ ] Owner: add a worker from Settings (today only on/off, Settings.jsx:118) and
      reset a worker's password without the developer.

## 4. Paid add-ons: features (each one: owner asks -> quote -> build)
Owner dashboard
- [ ] End-of-day cash close: expected vs counted, per worker.
- [ ] Film stock: rolls on hand, metres used per job by car size -> real profit.
- [ ] Per-car pay for installers (`installer_id` already recorded).
- [ ] Warranty claims: claim job linked to the original, RM0, not counted as sales.
- [ ] Fleet / dealer / Grab rates.
Staff dashboard
- [ ] Before/after photos per job (private storage bucket).
- [ ] Pre-work check: existing damage, old tint, rear defogger lines + photo.
- [ ] Job timer (real job durations).
Customer follow-up
- [ ] Warranty-expiry / re-tint reminders (draft only, a person presses send).

## 5. SEO / GEO (small code, do once the domain exists)
- [ ] `og:image` (1200x630 shopfront or finished car) on every public page: WhatsApp
      and Facebook shares show no preview today.
- [ ] JSON-LD `AutoRepair` (render.js:251): add `geo`, `image`, `url`; add the Google
      profile to `sameAs`.
- [ ] `/panduan-jpj/`: visible "last checked" date + `Article` JSON-LD
      (datePublished/dateModified) + cite Kaedah 1991 (am. 2019). Re-date yearly.
- [ ] Gallery: 6-10 real before/after photos with car + film captions (shop.js:27).
- [ ] Maybe: one English page (prices + JPJ limits). Owner's call.

## Won't do (and why)
- One landing page per town: doorway pages, Google can penalise the whole site.
- Hand-typed star ratings in JSON-LD: must come from real reviews.
- Invoicing / SST / accounting: export CSV to the bookkeeper instead.
- Online deposits: look at no-show numbers in Laporan after a month first.
