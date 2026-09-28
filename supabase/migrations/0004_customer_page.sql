-- One page per customer. Run after 0003_walkins_addons.sql.
-- The /urus/ link (manage_token) was only "confirm or cancel". Customers had nowhere to
-- find their receipt (a WhatsApp text) or certificate (a second link). Now the same link
-- shows the whole job: booking, then receipt + certificate once the car is done.
-- Same function, same arguments, same grants (anon + authenticated): only the answer
-- grows. Still an exact-token match, the token is never returned, no phone number, and
-- the plate is masked exactly as get_certificate masks it.

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
    -- Money: the price the shop set, else the website quote at booking time.
    'price', coalesce(j.price, j.quoted_price),
    'price_final', j.price is not null,
    'paid', j.paid_amount,
    'payment_method', j.payment_method,
    -- Certificate: only once the job is done (same rule as get_certificate).
    'done', j.stage in ('siap', 'selesai'),
    'completed_at', case when j.stage in ('siap', 'selesai') then (j.completed_at at time zone 'Asia/Kuala_Lumpur')::date end,
    'warranty_until', case when j.stage in ('siap', 'selesai') then j.warranty_until end,
    'vlt_windscreen', case when j.stage in ('siap', 'selesai') then j.vlt_windscreen end,
    'vlt_front', case when j.stage in ('siap', 'selesai') then j.vlt_front end,
    'vlt_rear', case when j.stage in ('siap', 'selesai') then j.vlt_rear end)
  from jobs j, shop_settings s
  where s.id = 1 and length(coalesce(p_token, '')) = 36 and j.manage_token = p_token and j.archived_at is null;
$$;

-- CREATE OR REPLACE keeps existing grants; restated so this file is complete on its own.
revoke execute on function public.get_booking(text) from public;
grant execute on function public.get_booking(text) to anon, authenticated;
