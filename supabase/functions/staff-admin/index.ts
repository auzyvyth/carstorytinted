// Owner-only staff accounts, called from the staff app (Tetapan > Staf).
// Creating a login needs the service-role key, which a browser must never hold, so
// this runs server-side. Two actions:
//   create        { name, email, password, role }  -> login + staff row, usable at once
//   set_password  { staff_id, password }           -> a worker forgot theirs
// The caller must be an ACTIVE OWNER: checked with the caller's own token through
// is_owner() (the same rule RLS uses), never from anything in the request body.
// Deploy with verify_jwt off: the browser's CORS preflight carries no token, and the
// token is verified below (getUser) before anything happens.
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// Auth is a bearer token, not a cookie, so a wildcard origin grants nothing by itself.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (error: string, status = 400) => json({ error }, status);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('bad_request', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return fail('not_owner', 401);
  const asCaller = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false }, global: { headers: { Authorization: authHeader } },
  });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return fail('not_owner', 401);
  const { data: owner } = await asCaller.rpc('is_owner');
  if (owner !== true) return fail('not_owner', 403);

  const b = await req.json().catch(() => ({}));
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 8 || password.length > 72) return fail('weak_password');

  if (b.action === 'create') {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const role = b.role === 'owner' ? 'owner' : 'staff';
    if (name.length < 1 || name.length > 60) return fail('bad_name');
    if (!EMAIL.test(email) || email.length > 120) return fail('bad_email');
    const { data: made, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
    if (error || !made?.user) {
      return fail(/already|registered|exists/i.test(error?.message ?? '') ? 'email_taken' : 'failed');
    }
    const { data: row, error: e2 } = await admin.from('staff').insert({ id: made.user.id, name, role }).select('id, name, role, active').single();
    if (e2) {
      // Never leave a login behind with no staff row.
      await admin.auth.admin.deleteUser(made.user.id);
      console.error('staff insert failed', e2.message);
      return fail('failed', 500);
    }
    return json({ staff: row });
  }

  if (b.action === 'set_password') {
    const id = typeof b.staff_id === 'string' ? b.staff_id : '';
    if (!id || id === who.user.id) return fail('bad_request');  // your own: change it while signed in
    const { data: s } = await admin.from('staff').select('id').eq('id', id).maybeSingle();
    if (!s) return fail('not_found', 404);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) { console.error('set_password failed', error.message); return fail('failed', 500); }
    return json({ ok: true });
  }

  return fail('bad_request');
});
