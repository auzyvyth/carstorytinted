-- Photo proof on the certificate ("Bukti hasil tint"). Run after 0005_site_content.sql.
-- The installer photographs the VLT meter on each window (and the finished car) from
-- the job screen; the photos show on the customer's certificate (/sijil/) and their
-- own page (/urus/), so the reading is backed by a picture, not just a typed number.
--
-- Privacy (PDPA): a photo of a car + its plate, linked to a customer, is personal data.
--   * Files live in the 'bukti' bucket under a random 122-bit name. The bucket is
--     public-by-URL so the certificate page can show them, but NOBODY can list it
--     (no select policy for anon), so a URL is only learnt from get_certificate /
--     get_booking, which need the customer's exact token. A photo is as private as
--     the certificate link itself.
--   * The phone re-encodes every photo before upload, which drops EXIF (GPS, phone model).
--   * Delete after the warranty ends: TODO.md PHOTO-PURGE (not automated yet).
--
-- The time on a photo is created_at = the SERVER's clock at upload, never the phone's,
-- so it cannot be backdated.

create table if not exists public.job_photos (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  kind       text not null check (kind in ('windscreen', 'front', 'rear', 'car')),
  url        text not null check (length(url) <= 400 and url ~ '^https://'),
  taken_by   uuid references public.staff(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (job_id, kind)   -- one photo per window; a retake replaces it
);

alter table public.job_photos enable row level security;
revoke all on public.job_photos from anon, public;
grant select, insert, delete on public.job_photos to authenticated;

drop policy if exists job_photos_staff_read on public.job_photos;
drop policy if exists job_photos_staff_add on public.job_photos;
drop policy if exists job_photos_staff_remove on public.job_photos;
create policy job_photos_staff_read on public.job_photos for select to authenticated using (public.is_staff());
-- You can only add a photo as yourself, and created_at is always the server's.
create policy job_photos_staff_add on public.job_photos for insert to authenticated
  with check (public.is_staff() and taken_by = auth.uid());
create policy job_photos_staff_remove on public.job_photos for delete to authenticated using (public.is_staff());

create or replace function public.job_photos_stamp() returns trigger
language plpgsql as $$
begin
  new.created_at := now();
  return new;
end $$;
drop trigger if exists job_photos_stamp on public.job_photos;
create trigger job_photos_stamp before insert on public.job_photos
  for each row execute function public.job_photos_stamp();

-- Photos for a finished job, as the certificate shows them. Internal helper:
-- only the two token-checked functions below call it.
create or replace function public.cert_photos(p_job uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', p.kind, 'url', p.url,
           'at', to_char(p.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD"T"HH24:MI'))
         order by array_position(array['windscreen', 'front', 'rear', 'car'], p.kind)), '[]'::jsonb)
  from job_photos p where p.job_id = p_job;
$$;
revoke execute on function public.cert_photos(uuid) from public, anon, authenticated;

-- Same functions, same arguments, same token checks: only the answer grows by 'photos'.
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
    'warranty_until', j.warranty_until,
    'photos', cert_photos(j.id))
  from jobs j, shop_settings s
  where s.id = 1 and length(coalesce(p_token, '')) = 36 and j.cert_token = p_token
    and j.stage in ('siap', 'selesai');
$$;

create or replace function public.get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref', j.ref, 'customer', split_part(j.customer_name, ' ', 1),
    'date', j.scheduled_date, 'slot', j.scheduled_slot, 'stage', j.stage,
    'film', (select f->>'name' from jsonb_array_elements(s.films) f where f->>'id' = j.film_id),
    'addons', coalesce((select jsonb_agg(a->>'name') from jsonb_array_elements(s.addons) a where a->>'id' = any (j.addons)), '[]'::jsonb),
    'car_model', j.car_model,
    'plate', case when j.plate is null then null
                  else left(j.plate, greatest(length(j.plate) - 3, 1)) || repeat('*', least(3, length(j.plate) - 1)) end,
    'confirmed', j.customer_confirmed_at is not null,
    'can_change', j.stage in ('baru', 'disahkan') and j.scheduled_date is not null and j.scheduled_slot is not null
                  and (j.scheduled_date + j.scheduled_slot::time) > (now() at time zone 'Asia/Kuala_Lumpur'),
    'price', coalesce(j.price, j.quoted_price),
    'price_final', j.price is not null,
    'paid', j.paid_amount,
    'payment_method', j.payment_method,
    'done', j.stage in ('siap', 'selesai'),
    'completed_at', case when j.stage in ('siap', 'selesai') then (j.completed_at at time zone 'Asia/Kuala_Lumpur')::date end,
    'warranty_until', case when j.stage in ('siap', 'selesai') then j.warranty_until end,
    'vlt_windscreen', case when j.stage in ('siap', 'selesai') then j.vlt_windscreen end,
    'vlt_front', case when j.stage in ('siap', 'selesai') then j.vlt_front end,
    'vlt_rear', case when j.stage in ('siap', 'selesai') then j.vlt_rear end,
    'photos', case when j.stage in ('siap', 'selesai') then cert_photos(j.id) else '[]'::jsonb end)
  from jobs j, shop_settings s
  where s.id = 1 and length(coalesce(p_token, '')) = 36 and j.manage_token = p_token and j.archived_at is null;
$$;

revoke execute on function public.get_certificate(text), public.get_booking(text) from public;
grant execute on function public.get_certificate(text), public.get_booking(text) to anon, authenticated;

-- The files. 2 MB cap (the app sends ~1280px WebP, typically 100-250 KB), images only.
-- Staff upload, read and delete (Storage needs select to delete); anon gets no select
-- policy, so the public can fetch a file by its exact URL but never list the bucket.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('bukti', 'bukti', true, 2097152, array['image/webp', 'image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
    drop policy if exists bukti_staff_insert on storage.objects;
    drop policy if exists bukti_staff_delete on storage.objects;
    drop policy if exists bukti_staff_select on storage.objects;
    create policy bukti_staff_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'bukti' and public.is_staff());
    create policy bukti_staff_select on storage.objects for select to authenticated
      using (bucket_id = 'bukti' and public.is_staff());
    create policy bukti_staff_delete on storage.objects for delete to authenticated
      using (bucket_id = 'bukti' and public.is_staff());
  end if;
end $$;
