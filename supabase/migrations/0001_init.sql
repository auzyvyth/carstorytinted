-- Carstory Pro Auto — booking site + staff CRM. One migration, run once on a
-- fresh Supabase project (SQL editor or `supabase db push`).
--
-- Security model in one paragraph:
--   * The public (anon) can NOT read or write any table. It can only call four
--     functions: get_catalog, available_slots, book_slot, get_certificate.
--     Each one validates its own input and returns only what a customer needs.
--   * Staff read/write jobs. Only the owner edits settings and the staff list.
--   * A certificate link is a password: get_certificate needs the exact token.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table public.staff (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (length(name) between 1 and 60),
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shop_settings (
  id                 int primary key default 1 check (id = 1),
  slots              text[] not null default '{09:30,12:30,15:30}',
  cars_per_slot      int not null default 1 check (cars_per_slot between 1 and 10),
  closed_weekdays    int[] not null default '{0}',   -- 0 = Sunday (extract dow)
  closed_dates       date[] not null default '{}',
  booking_days_ahead int not null default 30 check (booking_days_ahead between 1 and 90),
  -- [{id,name,tagline,heat_rejection,uv,warranty_years,prices:{small,sedan,suv,large}}]
  -- A null number = not published yet ("Tanya harga"). Never invent one.
  films              jsonb not null,
  updated_at         timestamptz not null default now()
);

create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  source         text not null check (source in ('web', 'walk_in', 'whatsapp', 'phone')),
  stage          text not null default 'baru'
                 check (stage in ('baru', 'disahkan', 'dalam_kerja', 'siap', 'selesai', 'batal')),
  customer_name  text not null check (length(customer_name) between 1 and 80),
  phone          text not null check (phone ~ '^60[0-9]{8,11}$'),
  car_model      text check (length(car_model) <= 60),
  plate          text check (length(plate) <= 12),
  car_size       text not null check (car_size in ('small', 'sedan', 'suv', 'large')),
  film_id        text not null check (length(film_id) <= 30),
  scheduled_date date,
  scheduled_slot text check (scheduled_slot ~ '^[0-2][0-9]:[0-5][0-9]$'),
  quoted_price   numeric(10,2) check (quoted_price >= 0),
  price          numeric(10,2) check (price >= 0),
  paid_amount    numeric(10,2) not null default 0 check (paid_amount >= 0),
  vlt_windscreen int check (vlt_windscreen between 0 and 100),
  vlt_front      int check (vlt_front between 0 and 100),
  vlt_rear       int check (vlt_rear between 0 and 100),
  notes          text check (length(notes) <= 1000),
  lost_reason    text check (length(lost_reason) <= 200),
  consent_at     timestamptz,
  confirmed_msg_at timestamptz,   -- staff sent the "booking confirmed" WhatsApp
  reminded_at    timestamptz,     -- staff sent the day-before reminder
  cert_sent_at   timestamptz,     -- staff sent the certificate link
  thanked_at     timestamptz,     -- staff sent the review / referral ask
  no_followup    boolean not null default false,  -- customer asked us to stop messaging
  completed_at   timestamptz,
  warranty_until date,
  cert_token     text unique
);
create index jobs_stage_idx on public.jobs (stage);
create index jobs_slot_idx on public.jobs (scheduled_date, scheduled_slot) where stage <> 'batal';
create index jobs_phone_idx on public.jobs (phone, created_at);

-- Who did what, when. Written by triggers (stage moves) and by staff (notes).
create table public.job_events (
  id         bigserial primary key,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  at         timestamptz not null default now(),
  actor      uuid references public.staff(id) on delete set null,
  kind       text not null check (kind in ('created', 'stage', 'note', 'payment')),
  from_stage text,
  to_stage   text,
  note       text check (length(note) <= 500)
);
create index job_events_job_idx on public.job_events (job_id, at);

-- One device, one identity: an endpoint belongs to whoever registered it last.
create table public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null references public.staff(id) on delete cascade,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Server-only config (push function URL + shared secret). No policies = no access.
create table public.app_config (key text primary key, value text not null);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active);
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active and role = 'owner');
$$;

-- 012-345 6789 / +6012... / 12345678 -> 60123456789. Null if it can't be a MY mobile.
create or replace function public.normalize_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '60%' then null;
  elsif d like '0%' then d := '6' || d;
  elsif d like '1%' then d := '60' || d;
  end if;
  if d !~ '^60[0-9]{8,11}$' then return null; end if;
  return d;
end $$;

create or replace function public.shop_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kuala_Lumpur')::date $$;

-- ---------------------------------------------------------------- triggers
create or replace function public.jobs_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare yrs int;
begin
  if tg_op = 'UPDATE' then
    -- Fixed at creation: nobody edits these after the fact from the app.
    new.ref := old.ref; new.source := old.source; new.created_at := old.created_at;
    new.consent_at := old.consent_at;
    new.cert_token := old.cert_token;  -- only this trigger mints it, below
  end if;
  new.phone := coalesce(normalize_phone(new.phone), new.phone);  -- CHECK rejects junk
  new.plate := nullif(upper(regexp_replace(coalesce(new.plate, ''), '\s+', ' ', 'g')), '');
  new.updated_at := now();
  -- First time a job reaches "siap": stamp completion, warranty and the certificate link.
  if new.stage in ('siap', 'selesai') and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.completed_at is not null and new.cert_token is null then
    new.cert_token := encode(gen_random_bytes(18), 'hex');
  end if;
  if new.completed_at is not null and new.warranty_until is null then
    select (f->>'warranty_years')::int into yrs
      from shop_settings s, jsonb_array_elements(s.films) f
     where s.id = 1 and f->>'id' = new.film_id;
    if yrs is not null then
      new.warranty_until := (new.completed_at at time zone 'Asia/Kuala_Lumpur')::date + make_interval(years => yrs);
    end if;
  end if;
  return new;
end $$;
create trigger trg_jobs_before_write before insert or update on public.jobs
  for each row execute function public.jobs_before_write();

create or replace function public.jobs_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := case when is_staff() then auth.uid() end;
begin
  if tg_op = 'INSERT' then
    insert into job_events (job_id, actor, kind, to_stage) values (new.id, actor, 'created', new.stage);
  elsif new.stage is distinct from old.stage then
    insert into job_events (job_id, actor, kind, from_stage, to_stage) values (new.id, actor, 'stage', old.stage, new.stage);
  end if;
  if tg_op = 'UPDATE' and new.paid_amount is distinct from old.paid_amount then
    insert into job_events (job_id, actor, kind, note)
    values (new.id, actor, 'payment', 'Bayaran: RM' || old.paid_amount || ' -> RM' || new.paid_amount);
  end if;
  return null;
end $$;
create trigger trg_jobs_after_write after insert or update on public.jobs
  for each row execute function public.jobs_after_write();

-- A web booking pings every staff phone. Needs pg_net + app_config rows
-- (notify_url, notify_secret); without them it quietly does nothing, and a push
-- failure can never block the booking itself.
create or replace function public.jobs_notify_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select value into u from app_config where key = 'notify_url';
  select value into s from app_config where key = 'notify_secret';
  if u is null or s is null or to_regproc('net.http_post') is null then return null; end if;
  perform net.http_post(url := u, body := jsonb_build_object('job_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s));
  return null;
exception when others then
  raise warning 'jobs_notify_staff: %', sqlerrm;
  return null;
end $$;
create trigger trg_jobs_notify_staff after insert on public.jobs
  for each row when (new.source = 'web') execute function public.jobs_notify_staff();

-- ---------------------------------------------------------------- public API
-- Films + prices + booking rules. Nothing about customers.
create or replace function public.get_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('films', films, 'slots', to_jsonb(slots),
    'closed_weekdays', to_jsonb(closed_weekdays), 'booking_days_ahead', booking_days_ahead)
  from shop_settings where id = 1;
$$;

-- Remaining places per slot. Counts only, never who booked.
create or replace function public.available_slots(p_from date, p_days int)
returns table (day date, slot text, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare s shop_settings; d date; t text; used int; now_local timestamp;
begin
  select * into s from shop_settings where id = 1;
  now_local := now() at time zone 'Asia/Kuala_Lumpur';
  p_from := greatest(coalesce(p_from, shop_today()), shop_today());
  p_days := least(greatest(coalesce(p_days, 7), 1), 31);
  for d in select generate_series(p_from, p_from + p_days - 1, interval '1 day')::date loop
    continue when d > shop_today() + s.booking_days_ahead;
    continue when extract(dow from d)::int = any (s.closed_weekdays) or d = any (s.closed_dates);
    foreach t in array s.slots loop
      -- same-day slots need at least an hour's notice
      continue when (d + t::time) < now_local + interval '1 hour';
      select count(*) into used from jobs
       where scheduled_date = d and scheduled_slot = t and stage <> 'batal';
      day := d; slot := t; remaining := greatest(s.cars_per_slot - used, 0);
      return next;
    end loop;
  end loop;
end $$;

-- The one way the public creates a job. Errors are short codes the site maps to
-- Malay text (src/public/booking.js ERRORS).
create or replace function public.book_slot(
  p_name text, p_phone text, p_car_model text, p_plate text, p_car_size text,
  p_film_id text, p_date date, p_slot text, p_notes text, p_consent boolean
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s shop_settings; ph text; used int; film jsonb; j jobs;
begin
  if p_consent is not true then raise exception 'consent_required'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) < 2 or length(p_name) > 80 then raise exception 'bad_name'; end if;
  ph := normalize_phone(p_phone);
  if ph is null then raise exception 'bad_phone'; end if;
  if p_car_size not in ('small', 'sedan', 'suv', 'large') then raise exception 'bad_size'; end if;
  if length(coalesce(p_car_model, '')) > 60 or length(coalesce(p_plate, '')) > 12
     or length(coalesce(p_notes, '')) > 500 then raise exception 'too_long'; end if;

  select * into s from shop_settings where id = 1;
  select f into film from jsonb_array_elements(s.films) f where f->>'id' = p_film_id;
  if film is null then raise exception 'bad_film'; end if;

  -- Spam brakes: 3 web bookings per phone per week, 30 per hour shop-wide.
  if (select count(*) from jobs where phone = ph and source = 'web'
       and created_at > now() - interval '7 days') >= 3 then raise exception 'too_many'; end if;
  if (select count(*) from jobs where source = 'web'
       and created_at > now() - interval '1 hour') >= 30 then raise exception 'busy'; end if;

  -- The slot must be one available_slots would offer right now.
  if not exists (select 1 from available_slots(p_date, 1) a where a.day = p_date and a.slot = p_slot) then
    raise exception 'slot_closed';
  end if;
  perform pg_advisory_xact_lock(hashtext('slot:' || p_date || ' ' || p_slot));
  select count(*) into used from jobs
   where scheduled_date = p_date and scheduled_slot = p_slot and stage <> 'batal';
  if used >= s.cars_per_slot then raise exception 'slot_full'; end if;

  insert into jobs (source, stage, customer_name, phone, car_model, plate, car_size, film_id,
                    scheduled_date, scheduled_slot, quoted_price, notes, consent_at)
  values ('web', 'baru', p_name, ph, nullif(btrim(p_car_model), ''), p_plate, p_car_size, p_film_id,
          p_date, p_slot, (film->'prices'->>p_car_size)::numeric, nullif(btrim(p_notes), ''), now())
  returning * into j;
  return jsonb_build_object('ref', j.ref, 'date', j.scheduled_date, 'slot', j.scheduled_slot,
                            'quoted_price', j.quoted_price);
end $$;

-- The warranty / VLT certificate. The token IS the password: exact match only,
-- and it is never returned. Name and plate are partly masked.
create or replace function public.get_certificate(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref', j.ref,
    'customer', split_part(j.customer_name, ' ', 1),
    'car_model', j.car_model,
    'plate', case when j.plate is null then null
                  else left(j.plate, greatest(length(j.plate) - 3, 1)) || repeat('*', least(3, length(j.plate) - 1)) end,
    'film', (select f->>'name' from jsonb_array_elements(s.films) f where f->>'id' = j.film_id),
    'vlt_windscreen', j.vlt_windscreen, 'vlt_front', j.vlt_front, 'vlt_rear', j.vlt_rear,
    'completed_at', (j.completed_at at time zone 'Asia/Kuala_Lumpur')::date,
    'warranty_until', j.warranty_until)
  from jobs j, shop_settings s
  where s.id = 1 and length(coalesce(p_token, '')) = 36 and j.cert_token = p_token
    and j.stage in ('siap', 'selesai');
$$;

-- Staff device registration: drops whoever held this endpoint before.
create or replace function public.push_register(p_subscription jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare ep text := p_subscription->>'endpoint';
begin
  if not is_staff() then raise exception 'not_staff'; end if;
  if ep is null or ep !~ '^https://' or length(ep) > 1000 then raise exception 'bad_subscription'; end if;
  delete from push_subscriptions where endpoint = ep;
  insert into push_subscriptions (endpoint, user_id, subscription) values (ep, auth.uid(), p_subscription);
end $$;

-- Signing out forgets the device. Takes the endpoint because the session may be gone.
create or replace function public.push_forget(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

-- Retention promised on /privasi/: kept while the warranty runs plus one year,
-- then deleted. Jobs that never completed go one year after they were made.
create or replace function public.purge_old_jobs() returns int
language sql security definer set search_path = public as $$
  with gone as (
    delete from jobs
     where coalesce(warranty_until, (completed_at at time zone 'Asia/Kuala_Lumpur')::date,
                    (created_at at time zone 'Asia/Kuala_Lumpur')::date) < shop_today() - interval '1 year'
    returning 1)
  select count(*)::int from gone;
$$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-old-jobs', '0 19 * * *', 'select public.purge_old_jobs()');  -- 3am MYT
  end if;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.staff enable row level security;
alter table public.shop_settings enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_config enable row level security;

create policy staff_read on public.staff for select using (is_staff());
create policy staff_owner_write on public.staff for all using (is_owner()) with check (is_owner());

create policy settings_read on public.shop_settings for select using (is_staff());
create policy settings_owner_update on public.shop_settings for update using (is_owner()) with check (is_owner());

create policy jobs_staff_read on public.jobs for select using (is_staff());
create policy jobs_staff_insert on public.jobs for insert with check (is_staff());
create policy jobs_staff_update on public.jobs for update using (is_staff()) with check (is_staff());
create policy jobs_owner_delete on public.jobs for delete using (is_owner());

create policy events_staff_read on public.job_events for select using (is_staff());
create policy events_staff_note on public.job_events for insert
  with check (is_staff() and actor = auth.uid() and kind = 'note');

create policy push_own on public.push_subscriptions for select using (user_id = auth.uid());

-- ---------------------------------------------------------------- grants
-- Supabase grants every new table and function to anon + authenticated by
-- default. Take it all back, then hand out exactly what each role needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.staff, public.shop_settings, public.jobs, public.job_events to authenticated;
grant insert, update, delete on public.jobs, public.staff to authenticated;
grant update on public.shop_settings to authenticated;
grant insert on public.job_events to authenticated;
grant select on public.push_subscriptions to authenticated;
grant usage on sequence public.job_events_id_seq to authenticated;

grant execute on function public.get_catalog(), public.available_slots(date, int),
  public.book_slot(text, text, text, text, text, text, date, text, text, boolean),
  public.get_certificate(text), public.push_forget(text) to anon, authenticated;
grant execute on function public.is_staff(), public.is_owner(), public.push_register(jsonb),
  public.shop_today(), public.normalize_phone(text) to authenticated;

-- ---------------------------------------------------------------- realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.jobs, public.job_events;
  end if;
end $$;

-- ---------------------------------------------------------------- seed
-- Owner's price list (compact car, 4 side windows). Other sizes null until the owner gives them.
-- ir/grade/vlt are display-only extras; the booking functions read id, name, prices, warranty_years.
insert into public.shop_settings (id, films) values (1, '[
  {"id": "black_uv", "name": "Black UV", "tagline": "Pilihan asas, sekat UV", "heat_rejection": null, "uv": 99, "warranty_years": 1, "ir": "20–30%", "grade": "Korea", "vlt": [5, 50], "prices": {"small": 60, "sedan": null, "suv": null, "large": null}},
  {"id": "black_smoke", "name": "Black Smoke", "tagline": "Lebih sejuk dari Black UV", "heat_rejection": null, "uv": 99, "warranty_years": 2, "ir": "50–70%", "grade": "Korea", "vlt": [5, 70], "prices": {"small": 100, "sedan": null, "suv": null, "large": null}},
  {"id": "carbon_ceramic", "name": "Carbon Ceramic HD", "tagline": "Seramik karbon, gred US", "heat_rejection": null, "uv": 99, "warranty_years": 3, "ir": "80%", "grade": "US", "vlt": [5, 70], "prices": {"small": 200, "sedan": null, "suv": null, "large": null}},
  {"id": "nano_ceramic", "name": "Nano Ceramic HD", "tagline": "Paling sejuk di kedai kami", "heat_rejection": null, "uv": 99, "warranty_years": 5, "ir": "95–99%", "grade": "US", "vlt": [5, 70], "prices": {"small": 300, "sedan": null, "suv": null, "large": null}}
]'::jsonb);
