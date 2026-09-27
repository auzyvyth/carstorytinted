# Carstory Pro Auto — website + CRM

Standalone. Not part of the ShiftOS build. No server, no database, no build step.

- `index.html` — public website (BM). Film cards, JPJ limits, price estimator that
  sends a booking to WhatsApp, map/Waze.
- `crm.html` — staff CRM (`/crm`). Jobs, today's list, follow-up WhatsApp drafts
  (a person presses send), customers, monthly report, backup/CSV, PIN.
- `config.js` — every shop fact (name, phone, prices, warranty). Edit here only.

## Before launch (owner must supply — none of this could be verified online)
1. WhatsApp number -> `SHOP.whatsapp` (`60123456789`). Until set, WhatsApp buttons hide.
2. Real prices per film -> `SHOP.films[].price`. `0` shows "Tanya harga".
3. Film brand names + real warranty years, opening hours.
4. Real job photos (none included — do not use stock photos of other shops' work).
5. Confirm which business this is: search also finds "Pro Auto" in Taman Sejati
   Indah, Sungai Petani. The address used is Sungai Jawi (Penang).

## Deploy
Vercel -> New Project -> this repo -> Root Directory `clients/tinted-bumiputera`,
Framework "Other", no build command. Add the client's domain.

## CRM data — know the limit
Data lives in the browser of ONE device (localStorage). Clearing browser data or
losing the phone wipes it. Backup is in Tetapan. If the shop needs two staff on two
phones, the upgrade is a small Supabase table (`jobs`) behind a login — the job
object in `crm.html` maps 1:1 to it.

## JPJ limits used (checked 2026-09-27)
Windscreen >= 70% VLT, front side >= 50%, rear no limit; glass + film combined.
First offence up to RM2,000 or 6 months. The CRM warns when a measured VLT is below.
