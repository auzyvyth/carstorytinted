-- Walk-ins + full-car pricing. Run after 0002_dashboard.sql.
-- Owner's rule (2026-09-27): a booking holds its slot; walk-ins get whatever is left.
--   1. Each time block has cars_per_slot bays; only online_per_slot of them are ever
--      sold online, the rest are held for walk-ins.
--   2. Price = film (side windows, per car size) + priced add-ons (windscreen, rear
--      glass, sunroof, old-tint removal), per car size. A null price = "Tanya".
--   3. Every booking gets a private link (manage_token): the day-before reminder
--      carries it, and the customer confirms or cancels there. A cancel frees the slot
--      and pings the staff so the walk-in waitlist gets it.

alter table public.shop_settings
  add column online_per_slot int check (online_per_slot between 0 and 10),  -- null = every bay
  add column addons jsonb not null default '[
    {"id": "depan",    "name": "Cermin depan",               "prices": {"small": null, "sedan": null, "suv": null, "large": null}},
    {"id": "belakang", "name": "Cermin belakang",            "prices": {"small": null, "sedan": null, "suv": null, "large": null}},
    {"id": "sunroof",  "name": "Sunroof / bumbung panorama", "prices": {"small": null, "sedan": null, "suv": null, "large": null}},
    {"id": "buang",    "name": "Buang tinted lama",          "prices": {"small": null, "sedan": null, "suv": null, "large": null}}
  ]'::jsonb;

alter table public.jobs
  add column addons      text[] not null default '{}' check (cardinality(addons) <= 10),
  add column wait_mode   text check (wait_mode in ('tunggu', 'tinggal')),  -- wait at the shop / leave the car
  add column heard_from  text check (heard_from in ('facebook', 'tiktok', 'google', 'kawan', 'lalu', 'dealer', 'lain')),
  add column manage_token text unique,
  add column customer_confirmed_at timestamptz,
  add column waitlist_at timestamptz;  -- walk-in waiting for a free bay today

-- ---------------------------------------------------------------- token
-- Minted once per job, never changed, never returned by any staff read path that
-- matters to the public. Moving the appointment clears the customer's "confirmed".
create or replace function public.jobs_manage_token() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    new.manage_token := coalesce(new.manage_token, encode(gen_random_bytes(18), 'hex'));
  else
    new.manage_token := old.manage_token;
    if new.scheduled_date is distinct from old.scheduled_date or new.scheduled_slot is distinct from old.scheduled_slot then
      new.customer_confirmed_at := null;
    end if;
  end if;
  return new;
end $$;
create trigger trg_jobs_manage_token before insert or update on public.jobs
  for each row execute function public.jobs_manage_token();
update public.jobs set manage_token = encode(extensions.gen_random_bytes(18), 'hex') where manage_token is null;

-- ---------------------------------------------------------------- pricing
-- One definition of "what does this cost", used by book_slot. Null when any part
-- has no published price: then the shop quotes at the counter, and says so.
create or replace function public.quote_price(p_size text, p_film text, p_addons text[]) returns numeric
language sql stable security definer set search_path = public as $$
  with s as (select films, addons from shop_settings where id = 1),
  parts as (
    select (f->'prices'->>p_size)::numeric as p from s, jsonb_array_elements(s.films) f where f->>'id' = p_film
    union all
    select (a->'prices'->>p_size)::numeric from s, jsonb_array_elements(s.addons) a where a->>'id' = any (coalesce(p_addons, '{}'))
  )
  select case when count(*) = 0 or bool_or(p is null) then null else sum(p) end from parts;
$$;

-- ---------------------------------------------------------------- slots
-- remaining = what ONLINE may still take: within the online share of the bays AND
-- within the bays actually free (walk-ins added by staff count too).
create or replace function public.available_slots(p_from date, p_days int)
returns table (day date, slot text, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare s shop_settings; d date; t text; used int; used_web int; now_local timestamp; online int;
begin
  select * into s from shop_settings where id = 1;
  online := least(coalesce(s.online_per_slot, s.cars_per_slot), s.cars_per_slot);
  now_local := now() at time zone 'Asia/Kuala_Lumpur';
  p_from := greatest(coalesce(p_from, shop_today()), shop_today());
  p_days := least(greatest(coalesce(p_days, 7), 1), 31);
  for d in select generate_series(p_from, p_from + p_days - 1, interval '1 day')::date loop
    continue when d > shop_today() + s.booking_days_ahead;
    continue when extract(dow from d)::int = any (s.closed_weekdays) or d = any (s.closed_dates);
    foreach t in array s.slots loop
      continue when (d + t::time) < now_local + interval '1 hour';
      select count(*), count(*) filter (where source = 'web') into used, used_web from jobs
       where scheduled_date = d and scheduled_slot = t and stage <> 'batal';
      day := d; slot := t; remaining := greatest(least(s.cars_per_slot - used, online - used_web), 0);
      return next;
    end loop;
  end loop;
end $$;

-- New arguments (add-ons, wait/leave, where they heard of us), plate now required.
-- A new argument list is a NEW function in Postgres: drop the old one in the same
-- migration, or two book_slot overloads sit side by side.
drop function public.book_slot(text, text, text, text, text, text, date, text, text, boolean);
create or replace function public.book_slot(
  p_name text, p_phone text, p_car_model text, p_plate text, p_car_size text,
  p_film_id text, p_date date, p_slot text, p_notes text, p_consent boolean,
  p_addons text[] default '{}', p_wait_mode text default null, p_heard_from text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s shop_settings; ph text; film jsonb; j jobs; bad text;
begin
  if p_consent is not true then raise exception 'consent_required'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) < 2 or length(p_name) > 80 then raise exception 'bad_name'; end if;
  ph := normalize_phone(p_phone);
  if ph is null then raise exception 'bad_phone'; end if;
  if length(regexp_replace(coalesce(p_plate, ''), '\s', '', 'g')) < 2 then raise exception 'bad_plate'; end if;
  if p_car_size not in ('small', 'sedan', 'suv', 'large') then raise exception 'bad_size'; end if;
  if length(coalesce(p_car_model, '')) > 60 or length(coalesce(p_plate, '')) > 12
     or length(coalesce(p_notes, '')) > 500 then raise exception 'too_long'; end if;
  if p_wait_mode is not null and p_wait_mode not in ('tunggu', 'tinggal') then raise exception 'bad_input'; end if;
  if p_heard_from is not null and p_heard_from not in ('facebook', 'tiktok', 'google', 'kawan', 'lalu', 'dealer', 'lain') then raise exception 'bad_input'; end if;

  select * into s from shop_settings where id = 1;
  select f into film from jsonb_array_elements(s.films) f where f->>'id' = p_film_id;
  if film is null then raise exception 'bad_film'; end if;
  p_addons := coalesce(p_addons, '{}');
  if cardinality(p_addons) > 10 then raise exception 'bad_addon'; end if;
  select a into bad from unnest(p_addons) a
   where a not in (select x->>'id' from jsonb_array_elements(s.addons) x) limit 1;
  if bad is not null then raise exception 'bad_addon'; end if;

  -- Spam brakes: 3 web bookings per phone per week, 30 per hour shop-wide.
  if (select count(*) from jobs where phone = ph and source = 'web'
       and created_at > now() - interval '7 days') >= 3 then raise exception 'too_many'; end if;
  if (select count(*) from jobs where source = 'web'
       and created_at > now() - interval '1 hour') >= 30 then raise exception 'busy'; end if;

  perform pg_advisory_xact_lock(hashtext('slot:' || p_date || ' ' || p_slot));
  -- Checked under the lock: the online share of this block, and the bays left.
  if not exists (select 1 from available_slots(p_date, 1) a where a.day = p_date and a.slot = p_slot) then
    raise exception 'slot_closed';
  end if;
  if (select a.remaining from available_slots(p_date, 1) a where a.day = p_date and a.slot = p_slot) < 1 then
    raise exception 'slot_full';
  end if;

  insert into jobs (source, stage, customer_name, phone, car_model, plate, car_size, film_id, addons,
                    wait_mode, heard_from, scheduled_date, scheduled_slot, quoted_price, notes, consent_at)
  values ('web', 'baru', p_name, ph, nullif(btrim(p_car_model), ''), p_plate, p_car_size, p_film_id,
          coalesce((select array_agg(distinct a order by a) from unnest(p_addons) a), '{}'), p_wait_mode, p_heard_from,
          p_date, p_slot, quote_price(p_car_size, p_film_id, p_addons), nullif(btrim(p_notes), ''), now())
  returning * into j;
  return jsonb_build_object('ref', j.ref, 'date', j.scheduled_date, 'slot', j.scheduled_slot,
                            'quoted_price', j.quoted_price, 'manage_token', j.manage_token);
end $$;

-- get_catalog also returns the add-ons (same shape as films: id, name, prices).
create or replace function public.get_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('films', films, 'addons', addons, 'slots', to_jsonb(slots),
    'closed_weekdays', to_jsonb(closed_weekdays), 'booking_days_ahead', booking_days_ahead)
  from shop_settings where id = 1;
$$;

-- ---------------------------------------------------------------- customer link
-- The link IS the password: exact token match, the token is never returned, and the
-- answer carries a first name, not a phone number.
create or replace function public.get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref', j.ref, 'customer', split_part(j.customer_name, ' ', 1),
    'date', j.scheduled_date, 'slot', j.scheduled_slot, 'stage', j.stage,
    'film', (select f->>'name' from jsonb_array_elements(s.films) f where f->>'id' = j.film_id),
    'confirmed', j.customer_confirmed_at is not null,
    'can_change', j.stage in ('baru', 'disahkan') and j.scheduled_date is not null and j.scheduled_slot is not null
                  and (j.scheduled_date + j.scheduled_slot::time) > (now() at time zone 'Asia/Kuala_Lumpur'))
  from jobs j, shop_settings s
  where s.id = 1 and length(coalesce(p_token, '')) = 36 and j.manage_token = p_token and j.archived_at is null;
$$;

create or replace function public.manage_booking(p_token text, p_action text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare j jobs; u text; s text;
begin
  if p_action not in ('confirm', 'cancel') then raise exception 'bad_input'; end if;
  select * into j from jobs where length(coalesce(p_token, '')) = 36 and manage_token = p_token and archived_at is null for update;
  if j.id is null then raise exception 'not_found'; end if;
  if j.stage not in ('baru', 'disahkan') or j.scheduled_slot is null
     or (j.scheduled_date + j.scheduled_slot::time) <= (now() at time zone 'Asia/Kuala_Lumpur') then
    raise exception 'too_late';
  end if;
  if p_action = 'confirm' then
    update jobs set customer_confirmed_at = now() where id = j.id;
  else
    update jobs set stage = 'batal', lost_reason = 'Dibatalkan oleh pelanggan' where id = j.id;
    -- Tell the staff phones: this slot is free now (offer it to the walk-in waitlist).
    select value into u from app_config where key = 'notify_url';
    select value into s from app_config where key = 'notify_secret';
    if u is not null and s is not null and to_regproc('net.http_post') is not null then
      perform net.http_post(url := u, body := jsonb_build_object('job_id', j.id, 'event', 'cancel'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s));
    end if;
  end if;
  return get_booking(p_token);
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.jobs_manage_token(), public.quote_price(text, text, text[]),
  public.book_slot(text, text, text, text, text, text, date, text, text, boolean, text[], text, text),
  public.get_booking(text), public.manage_booking(text, text), public.get_catalog(),
  public.available_slots(date, int) from public, anon, authenticated;
grant execute on function public.get_catalog(), public.available_slots(date, int),
  public.book_slot(text, text, text, text, text, text, date, text, text, boolean, text[], text, text),
  public.get_booking(text), public.manage_booking(text, text) to anon, authenticated;
grant execute on function public.quote_price(text, text, text[]) to authenticated;
