# Handoff: Tinted Carstory (read first next session)

Work continues on branch `claude/tinted-bumiputera-crm-website-bffa60`. It is NOT merged
to ShiftOS `main` and should not be: this client lives in `clients/tinted-bumiputera/`
with its own Supabase + Vercel. Outside this folder the branch touches only `CLAUDE.md`
(the "ASK FIRST" rule) and `eslint.config.mjs` (ignores `clients/**`).

## State (2026-09-27)
- Sales demo live on Vercel project `tinted-carstory-demo` (owner's current account),
  `VITE_DEMO=1`, working. Sample data lives in each visitor's browser; nothing real.
- `vercel.json` here forces `ignoreCommand: exit 1`: the repo-root `.vercelignore`
  strips `.git`, so any git-based ignore step errors the deploy. Do not put one back.
- Real (non-demo) build is untested against a real Supabase: migration, edge function
  `notify-staff`, and push on real phones are all unverified.
- Tests: `npm run test:db` 8/8, `npm run test:ui` 28/28, demo click-through 12/12.

## Next steps
1. Pitch the demo to the owner (Maliki). Pricing: RM800 upfront or RM200/month.
2. Collect from owner: VLT meter yes/no (site promises every window is measured),
   real film names/specs/warranty/prices, opening hours, logo + exact blue/orange
   colours, 6-10 before/after photos, Google review link, confirm Sungai Jawi branch.
3. When owner signs: new Supabase (Singapore) + new Vercel, follow README "Setup".
   VAPID keys are generated once and never regenerated.
4. Then a real-device test: book online -> push arrives on staff phone -> job flows
   to Selesai -> certificate link opens.

## Rules that apply here
- Anything NEW (feature/page) = research + ask the owner in detail before coding.
- Colours are placeholders (`--brand-*` in `src/public/site.css`, `src/staff/staff.css`).
- No auto-send to customers: WhatsApp buttons open a draft, a person presses send.
