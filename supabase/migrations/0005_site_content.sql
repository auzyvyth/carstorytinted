-- Website content the owner edits himself (staff app > Tetapan > Laman web). Run after 0004.
--   services: what the shop does besides tint (polish, car carpet, ...). Shown on the
--             site with "Tanya harga" + WhatsApp; NOT bookable online until the owner
--             gives packages, prices and how long each takes (they change bay capacity).
--   team:     "Kenali pasukan kami": name, role, one line, photo (public bucket 'site').
--   videos:   YouTube / TikTok links shown in "Video kerja kami".
-- Lives on shop_settings, so the existing owner-only UPDATE policy already guards it,
-- and get_catalog (anon) is the one public read path, as for films and prices.

alter table public.shop_settings
  add column if not exists site jsonb not null default jsonb_build_object(
    'services', jsonb_build_array(
      jsonb_build_object('id', 'polish', 'name', 'Polish kereta', 'desc', 'Harga dan masa ikut keadaan cat kereta anda. WhatsApp kami untuk sebut harga.', 'price_from', null),
      jsonb_build_object('id', 'karpet', 'name', 'Karpet kereta', 'desc', 'Harga ikut model kereta. WhatsApp kami untuk sebut harga.', 'price_from', null)),
    'team', '[]'::jsonb,
    'videos', '[]'::jsonb);

-- Shape guard: three arrays, bounded, so a bad save can never break the public page.
alter table public.shop_settings drop constraint if exists shop_settings_site_shape;
alter table public.shop_settings add constraint shop_settings_site_shape check (
  jsonb_typeof(site->'services') = 'array' and jsonb_array_length(site->'services') <= 12
  and jsonb_typeof(site->'team') = 'array' and jsonb_array_length(site->'team') <= 20
  and jsonb_typeof(site->'videos') = 'array' and jsonb_array_length(site->'videos') <= 12
  and length(site::text) <= 20000);

create or replace function public.get_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('films', films, 'addons', addons, 'slots', to_jsonb(slots),
    'closed_weekdays', to_jsonb(closed_weekdays), 'booking_days_ahead', booking_days_ahead,
    'site', site)
  from shop_settings where id = 1;
$$;
revoke execute on function public.get_catalog() from public;
grant execute on function public.get_catalog() to anon, authenticated;

-- Team photos: public bucket (anyone can view a photo on the site), only an active
-- owner can add, replace or delete one. Images only, 1 MB max (the app shrinks them
-- to ~480px WebP before upload, typically 30-60 KB).
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('site', 'site', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
    drop policy if exists site_owner_insert on storage.objects;
    drop policy if exists site_owner_update on storage.objects;
    drop policy if exists site_owner_delete on storage.objects;
    create policy site_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'site' and public.is_owner());
    create policy site_owner_update on storage.objects for update to authenticated
      using (bucket_id = 'site' and public.is_owner()) with check (bucket_id = 'site' and public.is_owner());
    create policy site_owner_delete on storage.objects for delete to authenticated
      using (bucket_id = 'site' and public.is_owner());
  end if;
end $$;
