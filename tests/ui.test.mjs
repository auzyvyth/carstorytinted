// End-to-end UI test against a FAKE Supabase (every request to MOCK is answered
// here), so it runs with no real project. Usage:
//   VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_ANON_KEY=anon npx vite build
//   npx vite preview --port 4174 &  node tests/ui.test.mjs
// Screenshots go to $SHOTS (default ./test-shots).
const { chromium } = await import(process.env.PW || 'playwright');
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4174';
const MOCK = 'https://mock.supabase.test';
const SHOTS = process.env.SHOTS || 'test-shots';
mkdirSync(SHOTS, { recursive: true });

const shop = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(Date.now() + n * 864e5));
const OWNER = { id: '11111111-1111-1111-1111-111111111111', name: 'Maliki', role: 'owner', active: true };
const WORKER = { id: '22222222-2222-2222-2222-222222222222', name: 'Tam', role: 'staff', active: true };
const films = [
  { id: 'standard', name: 'Standard', tagline: 'Gelap, privasi', heat_rejection: null, uv: 99, warranty_years: 3, prices: { small: 250, sedan: 300, suv: 380, large: 450 } },
  { id: 'ceramic', name: 'Nano Ceramic', tagline: 'Sejuk tanpa terlalu gelap', heat_rejection: 60, uv: 99, warranty_years: 5, prices: { small: 600, sedan: 700, suv: 850, large: 1000 } },
  { id: 'premium', name: 'Premium IR', tagline: 'Paling sejuk', heat_rejection: null, uv: null, warranty_years: 7, prices: { small: null, sedan: null, suv: null, large: null } },
];
const settings = { id: 1, slots: ['09:30', '12:30', '15:30'], cars_per_slot: 1, closed_weekdays: [], closed_dates: [], booking_days_ahead: 30, films };
const now = new Date().toISOString();
const job = (o) => ({ id: crypto.randomUUID(), ref: Math.random().toString(16).slice(2, 8).toUpperCase(), created_at: now, updated_at: now, source: 'walk_in',
  stage: 'disahkan', customer_name: 'X', phone: '60123456789', car_model: null, plate: null, car_size: 'small', film_id: 'ceramic',
  scheduled_date: shop(0), scheduled_slot: '09:30', quoted_price: null, price: null, paid_amount: 0, vlt_windscreen: null, vlt_front: null, vlt_rear: null,
  notes: null, lost_reason: null, consent_at: null, confirmed_msg_at: null, reminded_at: null, cert_sent_at: null, thanked_at: null, no_followup: false,
  completed_at: null, warranty_until: null, cert_token: null, ...o });
const jobs = [
  job({ customer_name: 'Siti Aminah', car_model: 'Axia', plate: 'PNA 882', scheduled_slot: '12:30', stage: 'dalam_kerja', price: 600 }),
  job({ customer_name: 'Hafiz Rahman', car_model: 'X50', car_size: 'suv', scheduled_date: shop(1), stage: 'disahkan', price: 850 }),
  job({ customer_name: 'Lim Ah Kow', car_model: 'City', car_size: 'sedan', stage: 'siap', price: 700, paid_amount: 200, completed_at: now, cert_token: 'a'.repeat(36), vlt_windscreen: 72, vlt_front: 52, vlt_rear: 15 }),
];
const calls = [];

function slotsFrom(from, days) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = shop(i + Math.round((Date.parse(from) - Date.parse(shop(0))) / 864e5));
    for (const s of settings.slots) {
      const used = jobs.filter((j) => j.scheduled_date === d && j.scheduled_slot === s && j.stage !== 'batal').length;
      rows.push({ day: d, slot: s, remaining: Math.max(0, settings.cars_per_slot - used) });
    }
  }
  return rows;
}

async function mockSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const body = req.postDataJSON?.() ?? null;
  const single = (req.headers().accept || '').includes('vnd.pgrst.object');
  const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const p = url.pathname;
  calls.push(`${req.method()} ${p}`);
  if (p === '/auth/v1/token') {
    const u = body?.email === 'maliki@test.my' ? OWNER : null;
    if (!u || body.password !== 'pw') return json({ error: 'invalid_grant' }, 400);
    return json({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: body.email } });
  }
  if (p === '/rest/v1/rpc/get_catalog') return json({ films, slots: settings.slots, closed_weekdays: [], booking_days_ahead: 30 });
  if (p === '/rest/v1/rpc/available_slots') return json(slotsFrom(body.p_from, body.p_days));
  if (p === '/rest/v1/rpc/book_slot') {
    if (!/^0?1\d{8,9}$/.test(String(body.p_phone).replace(/\D/g, '').replace(/^6/, ''))) return json({ message: 'bad_phone' }, 400);
    const j = job({ source: 'web', stage: 'baru', customer_name: body.p_name, phone: '60' + String(body.p_phone).replace(/\D/g, '').replace(/^0/, ''),
      car_model: body.p_car_model, car_size: body.p_car_size, film_id: body.p_film_id, scheduled_date: body.p_date, scheduled_slot: body.p_slot,
      quoted_price: films.find((f) => f.id === body.p_film_id).prices[body.p_car_size], consent_at: now });
    jobs.push(j);
    return json({ ref: j.ref, date: j.scheduled_date, slot: j.scheduled_slot, quoted_price: j.quoted_price });
  }
  if (p === '/rest/v1/rpc/get_certificate') {
    const j = jobs.find((x) => x.cert_token === body.p_token);
    return json(j ? { ref: j.ref, customer: j.customer_name.split(' ')[0], car_model: j.car_model, plate: 'PNB 1***', film: 'Nano Ceramic',
      vlt_windscreen: j.vlt_windscreen, vlt_front: j.vlt_front, vlt_rear: j.vlt_rear, completed_at: shop(0), warranty_until: shop(365 * 5) } : null);
  }
  if (p === '/rest/v1/rpc/push_device_count') return json(0);
  if (p.startsWith('/rest/v1/rpc/')) return route.fulfill({ status: 204, body: '' });
  if (p === '/rest/v1/staff') {
    const who = [OWNER, WORKER];
    const id = url.searchParams.get('id');
    const rows = id ? who.filter((s) => `eq.${s.id}` === id) : who;
    return json(single ? rows[0] ?? null : rows);
  }
  if (p === '/rest/v1/shop_settings') return json(single ? settings : [settings]);
  if (p === '/rest/v1/job_events') return json([]);
  if (p === '/rest/v1/jobs') {
    const id = url.searchParams.get('id')?.replace('eq.', '');
    if (req.method() === 'PATCH') { const j = jobs.find((x) => x.id === id); Object.assign(j, body, { updated_at: new Date().toISOString() });
      if (['siap', 'selesai'].includes(j.stage) && !j.cert_token) { j.completed_at = now; j.cert_token = 'b'.repeat(36); }
      return json(single ? j : [j]); }
    if (req.method() === 'POST') { const j = job({ ...body }); jobs.push(j); return json(single ? j : [j], 201); }
    return json(jobs);
  }
  return json({});
}

const results = [];
const check = (ok, name) => { results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1; };

const browser = await chromium.launch();
async function page(width, session) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 } });
  await ctx.route(`${MOCK}/**`, mockSupabase);
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await ctx.route('https://maps.google.com/**', (r) => r.fulfill({ body: '' }));
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ body: 'whatsapp' }));
  if (session) {
    await ctx.addInitScript((s) => localStorage.setItem('cs-staff-auth', JSON.stringify(s)), {
      access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: session.id, aud: 'authenticated', role: 'authenticated', email: 'x@y.z' } });
  }
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  return p;
}
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// 1. Home: live slots + live prices, no sideways scroll on a phone.
let p = await page(375);
await p.goto(`${BASE}/`);
await p.waitForSelector('.slot-day');
check((await p.locator('.slot-day').count()) === 3, 'home shows 3 next free days');
check((await p.locator('.film-price').first().innerText()).includes('RM250'), 'home film card shows live "dari RM250"');
check(await noSideScroll(p), 'home fits 375px');
await p.screenshot({ path: `${SHOTS}/1-home-375.png`, fullPage: true });

// 2. Booking wizard end to end.
await p.goto(`${BASE}/tempah/`);
await p.click('[data-size="suv"]');
await p.click('[data-film="ceramic"]');
check((await p.locator('.summary .total').innerText()).includes('850'), 'booking summary shows SUV ceramic RM850');
check(await noSideScroll(p), 'booking step 1 fits 375px');
await p.screenshot({ path: `${SHOTS}/2-book-step1-375.png`, fullPage: true });
await p.click('[data-next]');
await p.waitForSelector('[data-slot]');
check(await p.locator(`[data-date="${shop(0)}"] small:last-child`).innerText().then((t) => /slot|Penuh/.test(t)), 'booking lists days with free counts');
await p.click(`[data-date="${shop(2)}"]`);
await p.click('[data-slot="09:30"]');
check(await noSideScroll(p), 'booking step 2 (date strip) fits 375px');
await p.screenshot({ path: `${SHOTS}/3-book-step2-375.png`, fullPage: true });
await p.click('[data-next]');
await p.fill('#f-name', 'Ahmad Faizal');
await p.fill('#f-phone', '0171234567');
await p.fill('#f-car', 'Ativa 2023');
check(await noSideScroll(p), 'booking step 3 fits 375px');
await p.click('button:has-text("Sahkan tempahan")');
check(await p.locator('.err').innerText().then((t) => t.includes('privasi')).catch(() => false), 'booking blocks submit without consent');
await p.check('input[name=consent]');
await p.click('button:has-text("Sahkan tempahan")');
await p.waitForSelector('.done-box');
check(await noSideScroll(p), 'booking confirmation fits 375px');
await p.screenshot({ path: `${SHOTS}/4-book-done-375.png`, fullPage: true });
check(jobs.some((j) => j.customer_name === 'Ahmad Faizal' && j.stage === 'baru' && j.source === 'web'), 'booking reached the database as a new web job');
check(p.errors.length === 0, `public pages have no JS errors ${p.errors.join(' | ')}`);

// 3. Certificate page.
await p.goto(`${BASE}/sijil/?t=${'a'.repeat(36)}`);
await p.waitForSelector('.cert');
check((await p.locator('.cert').innerText()).includes('Lulus JPJ'), 'certificate shows JPJ pass for 72/52');
await p.screenshot({ path: `${SHOTS}/5-cert-375.png`, fullPage: true });
await p.goto(`${BASE}/sijil/?t=nope`);
check((await p.locator('[data-cert]').innerText()).toLowerCase().includes('tidak dijumpai'), 'bad certificate token shows not found');

// 4. Staff: owner signs in through the real form (the first frame after login once crashed).
p = await page(375);
await p.goto(`${BASE}/staff/`);
await p.fill('input[type=email]', 'maliki@test.my');
await p.fill('input[type=password]', 'wrong');
await p.click('button:has-text("Masuk")');
check(await p.locator('.warnline').innerText().then((t) => t.includes('salah')).catch(() => false), 'wrong password shows an error');
await p.fill('input[type=password]', 'pw');
await p.click('button:has-text("Masuk")');
await p.waitForSelector('.tile');
check((await p.locator('.tile').count()) === 4, 'owner sees 4 money tiles');
const act = await p.locator('.row-act').allInnerTexts();
check(act.some((t) => t.includes('Ahmad Faizal') && t.includes('Tempahan online baru')), 'web booking appears in Perlu tindakan');
check(act.some((t) => t.includes('Lim Ah Kow') && t.includes('Sijil')), 'finished job asks to send certificate');
check((await p.locator('.notice').allInnerTexts()).some((t) => t.includes('Tiada telefon terima notifikasi')), 'warns when no phone will ring for a booking');
check(await noSideScroll(p), 'staff dashboard fits 375px');
await p.screenshot({ path: `${SHOTS}/6-staff-dash-375.png`, fullPage: true });
const [popup] = await Promise.all([p.waitForEvent('popup').catch(() => null),
  p.locator('.row-act', { hasText: 'Ahmad Faizal' }).locator('button:has-text("Sahkan")').click()]);
await popup?.waitForLoadState().catch(() => {});
check(Boolean(popup) && popup.url().includes('wa.me/60171234567'), 'confirm opens WhatsApp to the customer');
await p.waitForTimeout(300);
check(jobs.find((j) => j.customer_name === 'Ahmad Faizal').stage === 'disahkan', 'confirm moved the job to Disahkan');

// 5. Pipeline + drawer with a failing VLT reading.
await p.click('.bnav button:has-text("Pipeline")');
await p.click('.pills button:has-text("Dalam kerja")');
check(await noSideScroll(p), 'pipeline fits 375px');
await p.screenshot({ path: `${SHOTS}/7-pipeline-375.png`, fullPage: true });
await p.click('.jcard:has-text("Siti Aminah")');
await p.waitForSelector('.sheet');
await p.locator('.grid3 input').nth(0).fill('72');
await p.locator('.grid3 input').nth(1).fill('30');
check((await p.locator('.warnline').allInnerTexts()).some((t) => t.includes('Sisi depan 30%')), 'drawer warns on a front window below JPJ');
check(await noSideScroll(p), 'job drawer fits 375px');
await p.screenshot({ path: `${SHOTS}/8-drawer-375.png`, fullPage: true });
await p.locator('.grid3 input').nth(1).fill('52');
await p.click('.sheet-f button:has-text("Tandakan siap")');
await p.waitForTimeout(300);
const siti = jobs.find((j) => j.customer_name === 'Siti Aminah');
check(siti.stage === 'siap' && siti.vlt_front === 52 && Boolean(siti.cert_token), 'marking done saves VLT and mints a certificate');
check(p.errors.length === 0, `staff app has no JS errors ${p.errors.join(' | ')}`);

// 6. Staff role: no money tiles, no settings.
p = await page(1280, WORKER);
await p.goto(`${BASE}/staff/`);
await p.waitForSelector('.row');
check((await p.locator('.tile').count()) === 0, 'staff role sees no money tiles');
check((await p.locator('[aria-label="Tetapan kedai"]').count()) === 0, 'staff role has no settings');
await p.screenshot({ path: `${SHOTS}/9-staff-dash-1280.png`, fullPage: true });
await p.click('.top-tabs button:has-text("Pipeline")');
await p.screenshot({ path: `${SHOTS}/10-pipeline-1280.png`, fullPage: true });

await browser.close();
console.log(results.join('\n'));
