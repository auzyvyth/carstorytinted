-- Staff + owner dashboard round 2. Run after 0001_init.sql.
--   1. Slot capacity is enforced for EVERY write, not only online bookings.
--   2. Unconfirmed online bookings nag again after 30 minutes (push + Telegram).
--   3. Reopening a job clears its finish date; "no-show" is recorded; delete is
--      an owner-only archive, never a hard delete.
--   5. Who installed the tint.   6. How the customer paid.

alter table public.jobs
  add column no_show        boolean not null default false,
  add column archived_at    timestamptz,
  add column installer_id   uuid references public.staff(id) on delete set null,
  add column payment_method text check (payment_method in ('tunai', 'pindahan', 'qr', 'kad')),
  add column nagged_at      timestamptz;
create index jobs_updated_idx on public.jobs (updated_at);

-- ---------------------------------------------------------------- before write
-- search_path includes `extensions`: that is where Supabase installs pgcrypto, and
-- 0001's version (public only) could not find gen_random_bytes on a real project,
-- so finishing a job failed. The test stub now installs it there too.
create or replace function public.jobs_before_write() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare yrs int;
begin
  if tg_op = 'UPDATE' then
    -- Fixed at creation: nobody edits these after the fact from the app.
    new.ref := old.ref; new.source := old.source; new.created_at := old.created_at;
    new.consent_at := old.consent_at;
    new.cert_token := old.cert_token;  -- only this trigger mints it, below
    -- Archive / restore is the owner's call only.
    if new.archived_at is distinct from old.archived_at and not is_owner() then
      new.archived_at := old.archived_at;
    end if;
    -- Reopened (back to an open stage): it is not finished any more. Without this
    -- a job redone next month kept last month's date, and its warranty started early.
    if new.stage in ('baru', 'disahkan', 'dalam_kerja') and old.stage in ('siap', 'selesai') then
      new.completed_at := null; new.warranty_until := null;
    end if;
  end if;
  -- Archiving takes the job out of every count and frees its slot.
  if new.archived_at is not null then new.stage := 'batal'; end if;
  -- Restoring puts it back where it was (a paid job stays paid), read from the
  -- stage history the after-write trigger keeps. The slot is re-checked below.
  if tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null then
    new.stage := coalesce((select from_stage from job_events
                            where job_id = new.id and kind = 'stage' and to_stage = 'batal'
                            order by at desc, id desc limit 1), 'baru');
  end if;
  if new.stage <> 'batal' then new.no_show := false; end if;
  -- Whoever starts the work is the installer, unless someone already picked one.
  if new.stage = 'dalam_kerja' and new.installer_id is null and is_staff() then
    new.installer_id := auth.uid();
  end if;
  new.phone := coalesce(normalize_phone(new.phone), new.phone);  -- CHECK rejects junk
  new.plate := nullif(upper(regexp_replace(coalesce(new.plate, ''), '\s+', ' ', 'g')), '');
  new.updated_at := now();
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

-- ---------------------------------------------------------------- capacity
-- One rule for every path (web booking, staff app, reopen, restore). Only checked
-- when the job starts holding a slot it did not hold before, so editing the notes
-- of a job that was squeezed in by hand never fails.
create or replace function public.jobs_check_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; used int;
begin
  if new.scheduled_date is null or new.scheduled_slot is null or new.stage = 'batal' then return new; end if;
  if tg_op = 'UPDATE' and old.stage <> 'batal'
     and new.scheduled_date is not distinct from old.scheduled_date
     and new.scheduled_slot is not distinct from old.scheduled_slot then return new; end if;
  perform pg_advisory_xact_lock(hashtext('slot:' || new.scheduled_date || ' ' || new.scheduled_slot));
  select cars_per_slot into cap from shop_settings where id = 1;
  select count(*) into used from jobs
   where scheduled_date = new.scheduled_date and scheduled_slot = new.scheduled_slot
     and stage <> 'batal' and id <> new.id;
  if used >= cap then raise exception 'slot_full'; end if;
  return new;
end $$;
-- Named to sort after trg_jobs_before_write, so it sees the final stage.
create trigger trg_jobs_check_capacity before insert or update on public.jobs
  for each row execute function public.jobs_check_capacity();

-- ---------------------------------------------------------------- nag
-- Online booking still unconfirmed after 30 minutes: ping every phone again, once.
create or replace function public.nag_unconfirmed() returns int
language plpgsql security definer set search_path = public as $$
declare u text; s text; j record; n int := 0;
begin
  select value into u from app_config where key = 'notify_url';
  select value into s from app_config where key = 'notify_secret';
  if u is null or s is null or to_regproc('net.http_post') is null then return 0; end if;
  for j in update jobs set nagged_at = now()
            where source = 'web' and stage = 'baru' and nagged_at is null and archived_at is null
              and created_at < now() - interval '30 minutes' and created_at > now() - interval '2 days'
            returning id loop
    perform net.http_post(url := u, body := jsonb_build_object('job_id', j.id, 'nag', true),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s));
    n := n + 1;
  end loop;
  return n;
end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('nag-unconfirmed', '*/10 * * * *', 'select public.nag_unconfirmed()');
  end if;
end $$;

-- How many phones will ring for an online booking. Counts only, no endpoints.
create or replace function public.push_device_count() returns int
language sql stable security definer set search_path = public as $$
  select case when is_staff() then
    (select count(*)::int from push_subscriptions p join staff s on s.id = p.user_id where s.active)
  end;
$$;

-- ---------------------------------------------------------------- access
-- Delete becomes archive (owner-only, enforced in the trigger above). The purge
-- job is SECURITY DEFINER, so retention still works without a delete grant.
drop policy jobs_owner_delete on public.jobs;
revoke delete on public.jobs from authenticated;

revoke execute on function public.jobs_check_capacity(), public.nag_unconfirmed(),
  public.push_device_count() from public, anon, authenticated;
grant execute on function public.push_device_count() to authenticated;
