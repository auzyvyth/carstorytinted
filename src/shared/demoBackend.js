// DEMO ONLY (VITE_DEMO=1). A pretend Supabase that lives in this browser's
// localStorage, so the shop owner can click through booking + staff app before
// a real project exists. Imported dynamically behind the VITE_DEMO flag, so a
// real build never ships this file. It mirrors the SQL functions' behaviour
// closely enough to demo, not to trust: the real rules are in 0001_init.sql.
import catalog from './catalog.default.json';

const KEY = 'cs-demo-db-v4';
const TZ = 'Asia/Kuala_Lumpur';
const day = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + n * 864e5));
const iso = (n, hh = 10) => new Date(`${day(n)}T${String(hh).padStart(2, '0')}:00:00+08:00`).toISOString();
const uid = () => crypto.randomUUID();
const ref = () => Math.random().toString(16).slice(2, 8).toUpperCase();
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');

export const DEMO_USERS = {
  'pemilik@demo.my': { id: '00000000-0000-4000-8000-000000000001', name: 'Maliki', role: 'owner' },
  'staf@demo.my': { id: '00000000-0000-4000-8000-000000000002', name: 'Tam', role: 'staff' },
};
export const DEMO_PASSWORD = 'demo1234';

// Same films as the real build (owner's list). Only compact prices exist, so the
// demo fills the other sizes with sample numbers, labelled "contoh" by the banner.
const SAMPLE_UP = { sedan: 1.2, suv: 1.4, large: 1.7 };
const FILMS = catalog.films.map((f) => ({ ...f, prices: { small: f.prices.small,
  ...Object.fromEntries(Object.entries(SAMPLE_UP).map(([k, m]) => [k, Math.round(f.prices.small * m / 10) * 10])) } }));
// Sample add-on prices (the owner has not given real ones yet; the demo banner says "contoh").
const ADDON_SMALL = { depan: 80, belakang: 40, sunroof: 60, buang: 50 };
const ADDONS = catalog.addons.map((a) => ({ ...a, prices: { small: ADDON_SMALL[a.id],
  ...Object.fromEntries(Object.entries(SAMPLE_UP).map(([k, m]) => [k, Math.round(ADDON_SMALL[a.id] * m / 10) * 10])) } }));

function job(o) {
  const created = o.created_at || iso(-2);
  return { id: uid(), ref: ref(), created_at: created, updated_at: created, source: 'walk_in', stage: 'disahkan',
    customer_name: '', phone: '60123456789', car_model: null, plate: null, car_size: 'small', film_id: 'nano_ceramic',
    scheduled_date: day(0), scheduled_slot: '09:00', quoted_price: null, price: null, paid_amount: 0,
    vlt_windscreen: null, vlt_front: null, vlt_rear: null, notes: null, lost_reason: null, consent_at: null,
    confirmed_msg_at: null, reminded_at: null, cert_sent_at: null, thanked_at: null, no_followup: false,
    completed_at: null, warranty_until: null, cert_token: null,
    no_show: false, archived_at: null, installer_id: null, payment_method: null, nagged_at: null,
    addons: [], wait_mode: null, heard_from: null, manage_token: token(), customer_confirmed_at: null, waitlist_at: null, ...o };
}
const done = (daysAgo, o) => {
  const c = iso(-daysAgo, 16);
  return job({ stage: 'selesai', scheduled_date: day(-daysAgo), completed_at: c, updated_at: c, cert_token: token(),
    cert_sent_at: c, vlt_windscreen: 74, vlt_front: 53, vlt_rear: 18, warranty_until: day(-daysAgo + 365 * 5), ...o });
};

function seed() {
  const O = DEMO_USERS['pemilik@demo.my'].id;
  const T = DEMO_USERS['staf@demo.my'].id;
  const jobs = [
    job({ source: 'web', stage: 'baru', customer_name: 'Nurul Huda', phone: '60134567821', car_model: 'Myvi 2021', car_size: 'small', scheduled_date: day(1), scheduled_slot: '13:00', quoted_price: 300, consent_at: iso(0, 8), created_at: iso(0, 8), notes: 'Cermin belakang sahaja kalau boleh lebih gelap' }),
    job({ source: 'web', stage: 'baru', customer_name: 'Faizal Rahim', phone: '60195552310', car_model: 'X50', car_size: 'suv', film_id: 'carbon_ceramic', scheduled_date: day(2), scheduled_slot: '09:00', quoted_price: 280, consent_at: iso(-1, 21), created_at: iso(-1, 21) }),
    job({ source: 'whatsapp', stage: 'disahkan', customer_name: 'Ah Chong', phone: '60126654321', car_model: 'Wira', car_size: 'sedan', film_id: 'black_uv', scheduled_date: day(-1), scheduled_slot: '13:00', price: 70 }),
    job({ stage: 'dalam_kerja', installer_id: T, customer_name: 'Siti Aminah', phone: '60123348876', car_model: 'Axia', plate: 'PNA 8821', scheduled_slot: '09:00', price: 300 }),
    job({ source: 'whatsapp', stage: 'disahkan', customer_name: 'Rosli Hamid', phone: '60174412098', car_model: 'City', plate: 'PKR 551', car_size: 'sedan', scheduled_slot: '15:00', price: 360 }),
    job({ source: 'web', stage: 'disahkan', customer_name: 'Hafiz Zulkifli', phone: '60112093344', car_model: 'Hilux', car_size: 'large', film_id: 'black_smoke', scheduled_date: day(1), scheduled_slot: '09:00', quoted_price: 170, price: 170, consent_at: iso(-3), confirmed_msg_at: iso(-3) }),
    job({ stage: 'siap', customer_name: 'Lim Wei Jie', phone: '60162217788', car_model: 'Vios', plate: 'PMB 3302', car_size: 'sedan', scheduled_date: day(-1), price: 360, paid_amount: 70, completed_at: iso(-1, 17), cert_token: token(), vlt_windscreen: 72, vlt_front: 52, vlt_rear: 15, warranty_until: day(-1 + 365 * 5) }),
    done(5, { installer_id: T, payment_method: 'qr', customer_name: 'Aisyah Kamal', phone: '60137789012', car_model: 'Bezza', plate: 'PNC 772', car_size: 'sedan', price: 360, paid_amount: 360 }),
    done(9, { installer_id: O, payment_method: 'tunai', customer_name: 'Kamarul Ariffin', phone: '60129981234', car_model: 'Ativa', car_size: 'suv', film_id: 'carbon_ceramic', price: 280, paid_amount: 280, thanked_at: iso(-4) }),
    done(33, { installer_id: T, payment_method: 'tunai', customer_name: 'Mei Ling', phone: '60168830021', car_model: 'Saga', price: 100, paid_amount: 100, film_id: 'black_smoke', thanked_at: iso(-28) }),
    done(38, { installer_id: O, payment_method: 'pindahan', customer_name: 'Azman Yusof', phone: '60193302211', car_model: 'Alza', car_size: 'suv', price: 420, paid_amount: 420, thanked_at: iso(-30) }),
    job({ stage: 'batal', customer_name: 'Zainal Abidin', phone: '60145523300', car_model: 'Persona', car_size: 'sedan', scheduled_date: day(-3), lost_reason: 'Harga lebih murah di tempat lain' }),
  ];
  return {
    jobs,
    events: jobs.map((j) => ({ id: Math.random(), job_id: j.id, at: j.created_at, actor: j.source === 'web' ? null : O, kind: 'created', from_stage: null, to_stage: j.stage, note: null })),
    // 5 blocks x 2 bays, 1 bay per block sold online, 1 kept for walk-ins (owner's rule).
    settings: { id: 1, slots: ['09:00', '11:00', '13:00', '15:00', '17:00'], cars_per_slot: 2, online_per_slot: 1, closed_weekdays: [0], closed_dates: [], booking_days_ahead: 30, films: FILMS, addons: ADDONS, updated_at: iso(-10) },
    staff: Object.values(DEMO_USERS).map((u) => ({ ...u, active: true })),
  };
}

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.jobs) return d; } catch { /* fresh */ }
  const d = seed(); save(d); return d;
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* quota */ } }
export function resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem('cs-staff-auth'); Object.keys(localStorage).filter((k) => k.startsWith('cs-jobs-')).forEach((k) => localStorage.removeItem(k)); }

const normPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = `6${d}`; else if (d.startsWith('1')) d = `60${d}`; return /^60\d{8,11}$/.test(d) ? d : null; };
const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();

function slots(db, from, days) {
  const out = [], s = db.settings;
  const start = Math.max(0, Math.round((Date.parse(from) - Date.parse(day(0))) / 864e5));
  for (let i = start; i < start + Math.min(days, 31); i++) {
    const d = day(i);
    if (i > s.booking_days_ahead || s.closed_weekdays.includes(dow(d)) || s.closed_dates.includes(d)) continue;
    for (const t of s.slots) {
      if (Date.parse(`${d}T${t}:00+08:00`) < Date.now() + 36e5) continue;
      const held = db.jobs.filter((j) => j.scheduled_date === d && j.scheduled_slot === t && j.stage !== 'batal');
      const online = Math.min(s.online_per_slot ?? s.cars_per_slot, s.cars_per_slot);
      const web = held.filter((j) => j.source === 'web').length;
      out.push({ day: d, slot: t, remaining: Math.max(0, Math.min(s.cars_per_slot - held.length, online - web)) });
    }
  }
  return out;
}

// Mirrors the DB triggers jobs_before_write + jobs_check_capacity (0002_dashboard.sql).
function rules(j, before, db, me) {
  const owner = db.staff.some((x) => x.id === me && x.role === 'owner');
  if (before && j.archived_at !== before.archived_at && !owner) j.archived_at = before.archived_at;
  if (before) j.manage_token = before.manage_token;
  if (before && (j.scheduled_date !== before.scheduled_date || j.scheduled_slot !== before.scheduled_slot)) j.customer_confirmed_at = null;
  if (before && ['baru', 'disahkan', 'dalam_kerja'].includes(j.stage) && ['siap', 'selesai'].includes(before.stage)) { j.completed_at = null; j.warranty_until = null; }
  if (j.archived_at) j.stage = 'batal';
  if (before?.archived_at && !j.archived_at) {
    const ev = db.events.filter((e) => e.job_id === j.id && e.kind === 'stage' && e.to_stage === 'batal').sort((x, y) => String(y.at).localeCompare(String(x.at)))[0];
    j.stage = ev?.from_stage || 'baru';
  }
  if (j.stage !== 'batal') j.no_show = false;
  if (j.stage === 'dalam_kerja' && !j.installer_id && me) j.installer_id = me;
  if (!j.scheduled_date || !j.scheduled_slot || j.stage === 'batal') return null;
  if (before && before.stage !== 'batal' && before.scheduled_date === j.scheduled_date && before.scheduled_slot === j.scheduled_slot) return null;
  const used = db.jobs.filter((x) => x.id !== j.id && x.scheduled_date === j.scheduled_date && x.scheduled_slot === j.scheduled_slot && x.stage !== 'batal').length;
  return used >= db.settings.cars_per_slot ? 'slot_full' : null;
}

function mint(j, db) {
  if (['siap', 'selesai'].includes(j.stage) && !j.completed_at) j.completed_at = new Date().toISOString();
  if (j.completed_at && !j.cert_token) j.cert_token = token();
  if (j.completed_at && !j.warranty_until) {
    const y = db.settings.films.find((f) => f.id === j.film_id)?.warranty_years;
    if (y) { const d = new Date(j.completed_at); d.setFullYear(d.getFullYear() + y); j.warranty_until = d.toISOString().slice(0, 10); }
  }
}

const reply = (data, status = 200) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (code, status = 400) => reply({ message: code, code: 'P0001' }, status);
// Fixed demo logins plus any the owner creates in Tetapan > Staf (db.accounts).
const accountsOf = (db) => ({ ...Object.fromEntries(Object.entries(DEMO_USERS).map(([e, u]) => [e, { ...u, password: DEMO_PASSWORD }])), ...(db.accounts || {}) });
function actorFrom(headers, db) {
  const auth = new Headers(headers).get('Authorization') || '';
  return Object.values(accountsOf(db)).find((u) => auth.includes(u.id))?.id || null;
}

export async function demoFetch(input, init = {}) {
  await new Promise((r) => setTimeout(r, 120)); // feel like a network
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = (init.method || 'GET').toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;
  const single = String(new Headers(init.headers).get('Accept') || '').includes('vnd.pgrst.object');
  const q = url.searchParams;
  const eq = (k) => q.get(k)?.replace(/^eq\./, '');
  const db = load();
  const p = url.pathname;
  const me = actorFrom(init.headers, db);
  const out = (rows) => reply(single ? rows[0] ?? null : rows);

  // --- auth: two fixed demo accounts. The access token just carries the user id.
  if (p === '/auth/v1/token') {
    const accts = accountsOf(db);
    const byRefresh = q.get('grant_type') === 'refresh_token'
      && Object.entries(accts).find(([, x]) => body?.refresh_token === `r.${x.id}`);
    if (byRefresh) body.email = byRefresh[0];
    if (byRefresh) body.password = byRefresh[1].password;
    const u = accts[String(body?.email).toLowerCase()];
    if (!u || body?.password !== u.password) return reply({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
    const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: body.email, app_metadata: {}, user_metadata: {}, created_at: iso(-30) };
    return reply({ access_token: `demo.${u.id}`, refresh_token: `r.${u.id}`, token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user });
  }
  if (p === '/auth/v1/logout') return reply(undefined, 204);
  if (p === '/auth/v1/user') {
    const u = Object.entries(accountsOf(db)).find(([, x]) => x.id === me);
    return u ? reply({ id: u[1].id, email: u[0], aud: 'authenticated', role: 'authenticated' }) : reply({ message: 'no user' }, 401);
  }

  // --- staff-admin edge function (supabase/functions/staff-admin): owner only.
  if (p === '/functions/v1/staff-admin') {
    const f = (error, status = 400) => reply({ error }, status);
    const owner = db.staff.find((x) => x.id === me && x.active && x.role === 'owner');
    if (!owner) return f('not_owner', 403);
    const pw = String(body?.password || '');
    if (pw.length < 8) return f('weak_password');
    const accts = accountsOf(db);
    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase(), name = String(body.name || '').trim();
      if (!name) return f('bad_name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return f('bad_email');
      if (accts[email]) return f('email_taken');
      const row = { id: uid(), name, role: body.role === 'owner' ? 'owner' : 'staff', active: true };
      db.accounts = { ...(db.accounts || {}), [email]: { ...row, password: pw } };
      db.staff.push(row); save(db); return reply({ staff: row });
    }
    if (body.action === 'set_password') {
      const hit = Object.entries(accts).find(([, x]) => x.id === body.staff_id);
      if (!hit || hit[1].id === me) return f('not_found', 404);
      db.accounts = { ...(db.accounts || {}), [hit[0]]: { ...hit[1], password: pw } };
      save(db); return reply({ ok: true });
    }
    return f('bad_request');
  }

  // --- the four public functions + push
  if (p === '/rest/v1/rpc/get_catalog') {
    const s = db.settings;
    return reply({ films: s.films, addons: s.addons || [], slots: s.slots, closed_weekdays: s.closed_weekdays, booking_days_ahead: s.booking_days_ahead });
  }
  if (p === '/rest/v1/rpc/available_slots') return reply(slots(db, body.p_from, body.p_days));
  if (p === '/rest/v1/rpc/book_slot') {
    if (!body.p_consent) return fail('consent_required');
    if (String(body.p_name || '').trim().length < 2) return fail('bad_name');
    const ph = normPhone(body.p_phone);
    if (!ph) return fail('bad_phone');
    if (String(body.p_plate || '').replace(/\s/g, '').length < 2) return fail('bad_plate');
    const film = db.settings.films.find((f) => f.id === body.p_film_id);
    const addons = [...new Set(body.p_addons || [])].sort();
    if (addons.some((a) => !(db.settings.addons || []).some((x) => x.id === a))) return fail('bad_addon');
    const parts = [film?.prices?.[body.p_car_size], ...addons.map((a) => db.settings.addons.find((x) => x.id === a).prices?.[body.p_car_size])];
    const quoted = parts.every((p) => p !== null && p !== undefined) ? parts.reduce((x, y) => x + Number(y), 0) : null;
    if (!film) return fail('bad_film');
    const open = slots(db, body.p_date, 1).find((r) => r.day === body.p_date && r.slot === body.p_slot);
    if (!open) return fail('slot_closed');
    if (open.remaining < 1) return fail('slot_full');
    const j = job({ source: 'web', stage: 'baru', created_at: new Date().toISOString(), customer_name: body.p_name.trim(), phone: ph,
      car_model: body.p_car_model || null, plate: body.p_plate ? body.p_plate.toUpperCase() : null, car_size: body.p_car_size, film_id: film.id,
      scheduled_date: body.p_date, scheduled_slot: body.p_slot, quoted_price: quoted, notes: body.p_notes || null, consent_at: new Date().toISOString(),
      addons, wait_mode: body.p_wait_mode || null, heard_from: body.p_heard_from || null });
    db.jobs.push(j);
    db.events.push({ id: Math.random(), job_id: j.id, at: j.created_at, actor: null, kind: 'created', to_stage: 'baru' });
    save(db);
    return reply({ ref: j.ref, date: j.scheduled_date, slot: j.scheduled_slot, quoted_price: j.quoted_price, manage_token: j.manage_token });
  }
  if (p === '/rest/v1/rpc/get_certificate') {
    const j = db.jobs.find((x) => x.cert_token === body.p_token && ['siap', 'selesai'].includes(x.stage));
    if (!j) return reply(null);
    const pl = j.plate;
    return reply({ ref: j.ref, customer: j.customer_name.split(' ')[0], car_model: j.car_model,
      plate: pl ? pl.slice(0, Math.max(pl.length - 3, 1)) + '*'.repeat(Math.min(3, pl.length - 1)) : null,
      film: db.settings.films.find((f) => f.id === j.film_id)?.name, vlt_windscreen: j.vlt_windscreen, vlt_front: j.vlt_front, vlt_rear: j.vlt_rear,
      completed_at: j.completed_at?.slice(0, 10), warranty_until: j.warranty_until });
  }
  // The customer's own link (get_booking / manage_booking in 0003).
  if (p === '/rest/v1/rpc/get_booking' || p === '/rest/v1/rpc/manage_booking') {
    const j = db.jobs.find((x) => x.manage_token === body.p_token && !x.archived_at);
    const view = (x) => ({ ref: x.ref, customer: x.customer_name.split(' ')[0], date: x.scheduled_date, slot: x.scheduled_slot, stage: x.stage,
      film: db.settings.films.find((f) => f.id === x.film_id)?.name, confirmed: Boolean(x.customer_confirmed_at),
      can_change: ['baru', 'disahkan'].includes(x.stage) && Boolean(x.scheduled_slot) && Date.parse(`${x.scheduled_date}T${x.scheduled_slot}:00+08:00`) > Date.now(),
      // Receipt + certificate, same shape as get_booking in 0004_customer_page.sql.
      ...(() => {
        const done = ['siap', 'selesai'].includes(x.stage), pl = x.plate;
        return { addons: db.settings.addons.filter((a) => (x.addons || []).includes(a.id)).map((a) => a.name), car_model: x.car_model,
          plate: pl ? pl.slice(0, Math.max(pl.length - 3, 1)) + '*'.repeat(Math.min(3, pl.length - 1)) : null,
          price: x.price ?? x.quoted_price, price_final: x.price !== null && x.price !== undefined, paid: x.paid_amount, payment_method: x.payment_method, done,
          completed_at: done ? x.completed_at?.slice(0, 10) : null, warranty_until: done ? x.warranty_until : null,
          vlt_windscreen: done ? x.vlt_windscreen : null, vlt_front: done ? x.vlt_front : null, vlt_rear: done ? x.vlt_rear : null };
      })() });
    if (p.endsWith('get_booking')) return reply(j ? view(j) : null);
    if (!j) return fail('not_found');
    if (!view(j).can_change) return fail('too_late');
    if (body.p_action === 'confirm') j.customer_confirmed_at = new Date().toISOString();
    else {
      const was = j.stage;
      Object.assign(j, { stage: 'batal', lost_reason: 'Dibatalkan oleh pelanggan', updated_at: new Date().toISOString() });
      db.events.push({ id: Math.random(), job_id: j.id, at: j.updated_at, actor: null, kind: 'stage', from_stage: was, to_stage: 'batal' });
    }
    save(db); return reply(view(j));
  }
  if (p.startsWith('/rest/v1/rpc/')) return reply(undefined, 204);

  // --- staff tables (the real app is RLS-protected; the demo trusts the login)
  if (!me) return reply({ message: 'permission denied' }, 401);
  if (p === '/rest/v1/staff') {
    if (method === 'PATCH') { const s = db.staff.find((x) => x.id === eq('id')); Object.assign(s, body); save(db); return out([s]); }
    const id = eq('id');
    return out(id ? db.staff.filter((s) => s.id === id) : db.staff);
  }
  if (p === '/rest/v1/shop_settings') {
    if (method === 'PATCH') { Object.assign(db.settings, body); save(db); }
    return out([db.settings]);
  }
  if (p === '/rest/v1/job_events') {
    if (method === 'POST') { const e = { id: Math.random(), at: new Date().toISOString(), ...body }; db.events.push(e); save(db); return out([e]); }
    return out(db.events.filter((e) => e.job_id === eq('job_id')).sort((a, b) => String(b.at).localeCompare(String(a.at))));
  }
  if (p === '/rest/v1/jobs') {
    const id = eq('id');
    if (method === 'PATCH') {
      const j = db.jobs.find((x) => x.id === id);
      const before = { stage: j.stage, paid: j.paid_amount };
      const was = { ...j };
      const next = { ...j, ...body };
      const bad = rules(next, was, db, me);
      if (bad) return fail(bad);
      Object.assign(j, next, { updated_at: new Date().toISOString() });
      if (j.phone) j.phone = normPhone(j.phone) || j.phone;
      mint(j, db);
      if (before.stage !== j.stage) db.events.push({ id: Math.random(), job_id: j.id, at: j.updated_at, actor: me, kind: 'stage', from_stage: before.stage, to_stage: j.stage });
      if (before.paid !== j.paid_amount) db.events.push({ id: Math.random(), job_id: j.id, at: j.updated_at, actor: me, kind: 'payment', note: `Bayaran: RM${before.paid} -> RM${j.paid_amount}` });
      save(db); return out([j]);
    }
    if (method === 'POST') {
      const ph = normPhone(body.phone);
      if (!ph) return reply({ message: 'new row violates check constraint "jobs_phone_check"' }, 400);
      const j = job({ ...body, phone: ph, created_at: new Date().toISOString() });
      const bad = rules(j, null, db, me);
      if (bad) return fail(bad);
      mint(j, db); db.jobs.push(j);
      db.events.push({ id: Math.random(), job_id: j.id, at: j.created_at, actor: me, kind: 'created', to_stage: j.stage });
      save(db); return out([j]);
    }
    if (method === 'DELETE') return reply({ message: 'permission denied for table jobs' }, 403);
    return out(id ? db.jobs.filter((j) => j.id === id) : db.jobs);
  }
  return reply({});
}
