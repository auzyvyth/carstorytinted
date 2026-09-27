// Called by the DB trigger trg_jobs_notify_staff when a customer books online.
// Sends a web push to every active staff device. No browser ever calls this,
// so there is no CORS: the shared secret in x-notify-secret is the only way in.
//
// Secrets (supabase secrets set ...):
//   NOTIFY_SECRET      same value as app_config.notify_secret
//   VAPID_PUBLIC_KEY   same value as VITE_VAPID_PUBLIC_KEY in the site build
//   VAPID_PRIVATE_KEY  never leaves the server. NEVER regenerate either key:
//                      every existing phone subscription dies silently.
//   VAPID_SUBJECT      mailto: address for the push services, e.g. mailto:owner@example.com
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  (optional) the backup: the same alert also
//                      goes to a Telegram chat, so a booking is heard even when no
//                      staff phone has notifications switched on.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:admin@example.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DAY = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !sameSecret(req.headers.get('x-notify-secret') ?? '', env('NOTIFY_SECRET'))) {
    return new Response('forbidden', { status: 403 });
  }
  const { job_id, nag } = await req.json().catch(() => ({}));
  if (typeof job_id !== 'string') return new Response('bad request', { status: 400 });

  const { data: job } = await db.from('jobs')
    .select('id, stage, customer_name, car_model, scheduled_date, scheduled_slot, film_id').eq('id', job_id).single();
  if (!job) return new Response('no job', { status: 404 });
  // The 30-minute reminder (nag_unconfirmed): someone may have confirmed it since.
  if (nag && job.stage !== 'baru') return Response.json({ sent: 0, skipped: 'already handled' });

  const { data: subs } = await db.from('push_subscriptions')
    .select('endpoint, subscription, staff!inner(active)').eq('staff.active', true);

  const d = job.scheduled_date ? new Date(`${job.scheduled_date}T00:00:00Z`) : null;
  const when = d ? `${DAY[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}${job.scheduled_slot ? ` ${job.scheduled_slot}` : ''}` : '';
  // Title + car + time only. No phone number on a lock screen.
  const payload = JSON.stringify({
    title: nag ? `Belum disahkan 30 minit: ${job.customer_name}` : `Tempahan online: ${job.customer_name}`,
    body: [job.car_model, when].filter(Boolean).join(' · ') || 'Buka untuk sahkan slot',
    tag: `job-${job.id}`,
    job: job.id,
  });

  let sent = 0, removed = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, payload, { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      // 404/410 = the phone unsubscribed or the app was removed: forget it.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); removed++; }
      else console.error('push failed', code, (e as Error).message);
    }
  }));
  // Backup channel. Same text as the push: name, car, time. Never the phone number.
  let telegram = false;
  const tgToken = env('TELEGRAM_BOT_TOKEN'), tgChat = env('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    const p = JSON.parse(payload);
    const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: `${p.title}\n${p.body}` }),
    }).catch((e) => { console.error('telegram failed', (e as Error).message); return null; });
    telegram = Boolean(r?.ok);
    if (r && !r.ok) console.error('telegram failed', r.status, await r.text());
  }
  return Response.json({ sent, removed, telegram });
});
