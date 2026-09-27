-- Runs against a fresh DB with supabase_stub.sql + the migration applied.
-- Every block raises on failure; `psql -v ON_ERROR_STOP=1` stops at the first.
\set owner   '''11111111-1111-1111-1111-111111111111'''
\set worker  '''22222222-2222-2222-2222-222222222222'''
\set gone    '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id) values (:owner), (:worker), (:gone);
insert into staff (id, name, role, active) values
  (:owner, 'Maliki', 'owner', true), (:worker, 'Tam', 'staff', true), (:gone, 'Ex', 'staff', false);
-- Fixed test films, so the owner's real price list can change without breaking this.
update shop_settings set closed_weekdays = '{}',   -- keep tests independent of the weekday
  films = '[{"id":"standard","name":"Standard","warranty_years":3,"prices":{"small":250,"sedan":null,"suv":null,"large":null}},
            {"id":"ceramic","name":"Ceramic","warranty_years":5,"prices":{"small":600,"sedan":null,"suv":null,"large":null}}]';

create temp table t_ctx as select (shop_today() + 2) as d;
grant select on t_ctx to anon, authenticated;

-- helper: expect an error containing `want`
create or replace function pg_temp.expect_error(sql text, want text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED ERROR "%" but statement succeeded: %', want, sql;
exception when others then
  if sqlerrm not like '%' || want || '%' then
    raise exception 'EXPECTED "%" got "%" for: %', want, sqlerrm, sql;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- 1. The public cannot touch any table.
begin; set local role anon;
select pg_temp.expect_error('select * from jobs', 'permission denied');
select pg_temp.expect_error('select * from staff', 'permission denied');
select pg_temp.expect_error('select * from shop_settings', 'permission denied');
select pg_temp.expect_error('select * from push_subscriptions', 'permission denied');
select pg_temp.expect_error('select * from app_config', 'permission denied');
select pg_temp.expect_error($q$insert into jobs (source, customer_name, phone, car_size, film_id) values ('web','x','60123456789','small','standard')$q$, 'permission denied');
select pg_temp.expect_error('select is_staff()', 'permission denied');
select pg_temp.expect_error($q$select push_register('{"endpoint":"https://x"}')$q$, 'permission denied');
commit;
\echo 'ok 1 anon locked out of tables and staff functions'

-- 2. Public catalogue + slots work and leak nothing about customers.
begin; set local role anon;
do $$ begin
  if get_catalog()->'films' is null then raise exception 'catalog empty'; end if;
  if (select count(*) from available_slots((select d from t_ctx), 1)) <> 3 then
    raise exception 'expected 3 slots on an open day'; end if;
end $$;
commit;
\echo 'ok 2 catalogue + slots readable by anon'

-- 3. Booking: validation, success, slot full, rate limit.
begin; set local role anon;
select pg_temp.expect_error($q$select book_slot('Ali','0123456789','Myvi','PKA1234','small','ceramic',(select d from t_ctx),'09:30',null,false)$q$, 'consent_required');
select pg_temp.expect_error($q$select book_slot('Ali','12','Myvi','PKA1234','small','ceramic',(select d from t_ctx),'09:30',null,true)$q$, 'bad_phone');
select pg_temp.expect_error($q$select book_slot('Ali','0123456789','Myvi','PKA1234','small','nope',(select d from t_ctx),'09:30',null,true)$q$, 'bad_film');
select pg_temp.expect_error($q$select book_slot('Ali','0123456789','Myvi','PKA1234','small','ceramic',(select d from t_ctx),'08:00',null,true)$q$, 'slot_closed');
select pg_temp.expect_error($q$select book_slot('Ali','0123456789','Myvi','PKA1234','small','ceramic',(select d from t_ctx)-3,'09:30',null,true)$q$, 'slot_closed');
select book_slot('Ali Bin Abu','012-345 6789','Myvi','pka 1234','small','ceramic',(select d from t_ctx),'09:30','Cermin belakang sahaja',true);
select pg_temp.expect_error($q$select book_slot('Siti','0198765432','Axia',null,'small','standard',(select d from t_ctx),'09:30',null,true)$q$, 'bad_plate');
select pg_temp.expect_error($q$select book_slot('Siti','0198765432','Axia','PKB 1','small','standard',(select d from t_ctx),'09:30',null,true)$q$, 'slot_full');
select book_slot('Ali Bin Abu','0123456789','Myvi','PKA 1234','small','ceramic',(select d from t_ctx),'12:30',null,true);
select book_slot('Ali Bin Abu','+60123456789','Myvi','PKA 1234','small','ceramic',(select d from t_ctx),'15:30',null,true);
select pg_temp.expect_error($q$select book_slot('Ali Bin Abu','0123456789','Myvi','PKA 1234','small','ceramic',(select d from t_ctx)+1,'09:30',null,true)$q$, 'too_many');
do $$ begin
  if exists (select 1 from available_slots((select d from t_ctx), 1) where remaining > 0) then
    raise exception 'day should be full'; end if;
end $$;
commit;
\echo 'ok 3 booking validation, slot capacity, rate limit'

-- 4. Staff see jobs; the phone was normalised; events were written.
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from jobs) <> 3 then raise exception 'staff should see 3 jobs'; end if;
  if exists (select 1 from jobs where phone <> '60123456789') then raise exception 'phone not normalised'; end if;
  if exists (select 1 from jobs where plate <> 'PKA 1234') then raise exception 'plate not normalised'; end if;
  if (select count(*) from job_events where kind = 'created') <> 3 then raise exception 'missing created events'; end if;
end $$;
commit;
\echo 'ok 4 staff read jobs, data normalised, events logged'

-- 5. Inactive staff see nothing.
begin; set local role authenticated; set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin if (select count(*) from jobs) <> 0 then raise exception 'inactive staff can read jobs'; end if; end $$;
commit;
\echo 'ok 5 inactive staff locked out'

-- 6. Finishing a job mints a certificate; staff cannot forge one; anon reads it masked.
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update jobs set stage = 'siap', vlt_windscreen = 72, vlt_front = 52, vlt_rear = 15, price = 800
 where scheduled_slot = '09:30';
update jobs set cert_token = 'forged' where scheduled_slot = '09:30';
do $$ declare j jobs; begin
  select * into j from jobs where scheduled_slot = '09:30';
  if j.cert_token is null or length(j.cert_token) <> 36 then raise exception 'no certificate token'; end if;
  if j.warranty_until is null then raise exception 'warranty not stamped'; end if;
  if not exists (select 1 from job_events where job_id = j.id and kind = 'stage'
                  and actor = '22222222-2222-2222-2222-222222222222') then raise exception 'stage event missing actor'; end if;
end $$;
create temp table t_tok as select cert_token from jobs where scheduled_slot = '09:30';
grant select on t_tok to anon;
commit;
begin; set local role anon;
do $$ declare c jsonb; begin
  if get_certificate('0000') is not null then raise exception 'short token returned data'; end if;
  if get_certificate(repeat('a', 36)) is not null then raise exception 'wrong token returned data'; end if;
  c := get_certificate((select cert_token from t_tok));
  if c is null then raise exception 'real token returned nothing'; end if;
  if c->>'plate' <> 'PKA 1***' or c->>'customer' <> 'Ali' then raise exception 'masking wrong: %', c; end if;
  if c ? 'phone' or c ? 'cert_token' then raise exception 'certificate leaks: %', c; end if;
end $$;
commit;
\echo 'ok 6 certificate minted by trigger, unforgeable, masked for anon'

-- 7. Only the owner changes settings and the staff list; nobody hard-deletes jobs (RLS filters silently,
--    so check the rows did not change rather than expecting an error).
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update shop_settings set cars_per_slot = 9;
update staff set role = 'owner' where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_error('delete from jobs', 'permission denied');
commit;
begin; set local role authenticated; set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select cars_per_slot from shop_settings) <> 1 then raise exception 'staff changed settings'; end if;
  if (select role from staff where name = 'Tam') <> 'staff' then raise exception 'staff promoted self'; end if;
  if (select count(*) from jobs) <> 3 then raise exception 'staff deleted jobs'; end if;
end $$;
select pg_temp.expect_error('delete from jobs', 'permission denied');
update shop_settings set cars_per_slot = 2;
do $$ begin if (select cars_per_slot from shop_settings) <> 2 then raise exception 'owner cannot edit settings'; end if; end $$;
commit;
\echo 'ok 7 settings + staff list owner-only, no hard delete'

-- 8. Push devices: one owner per endpoint, never readable by the public.
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select push_register('{"endpoint":"https://push.example/abc","keys":{}}');
commit;
begin; set local role authenticated; set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select push_register('{"endpoint":"https://push.example/abc","keys":{}}');
select pg_temp.expect_error($q$select push_register('{"endpoint":"http://insecure"}')$q$, 'bad_subscription');
commit;
do $$ begin
  if (select count(*) from push_subscriptions) <> 1 then raise exception 'endpoint duplicated'; end if;
  if (select user_id from push_subscriptions) <> '11111111-1111-1111-1111-111111111111' then raise exception 'endpoint not reclaimed'; end if;
end $$;
\echo 'ok 8 push endpoint claimed by last device owner'

-- 9. Capacity holds for staff writes too (cars_per_slot is 2 after test 7).
--    09:30 and 12:30 on day d each hold one web booking already.
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into jobs (source, stage, customer_name, phone, car_size, film_id, scheduled_date, scheduled_slot)
  values ('walk_in', 'disahkan', 'Walk One', '0111111111', 'small', 'standard', (select d from t_ctx), '12:30');
select pg_temp.expect_error($q$insert into jobs (source, stage, customer_name, phone, car_size, film_id, scheduled_date, scheduled_slot)
  values ('phone', 'disahkan', 'Walk Two', '0122222222', 'small', 'standard', (select d from t_ctx), '12:30')$q$, 'slot_full');
-- moving a job INTO a full slot fails; editing a job already in it does not
select pg_temp.expect_error($q$update jobs set scheduled_slot = '12:30' where customer_name = 'Ali Bin Abu' and scheduled_slot = '15:30'$q$, 'slot_full');
update jobs set notes = 'ok' where customer_name = 'Walk One';
-- cancelling frees the slot, reopening re-checks it
update jobs set stage = 'batal' where customer_name = 'Walk One';
insert into jobs (source, stage, customer_name, phone, car_size, film_id, scheduled_date, scheduled_slot)
  values ('phone', 'disahkan', 'Walk Two', '0122222222', 'small', 'standard', (select d from t_ctx), '12:30');
select pg_temp.expect_error($q$update jobs set stage = 'baru' where customer_name = 'Walk One'$q$, 'slot_full');
commit;
\echo 'ok 9 slot capacity enforced on staff inserts, moves and reopens'

-- 10. Reopen clears the finish date; installer stamped on start; archive is owner-only.
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update jobs set stage = 'disahkan' where scheduled_slot = '09:30';
update jobs set stage = 'dalam_kerja' where customer_name = 'Walk Two';
update jobs set archived_at = now() where customer_name = 'Walk Two';
do $$ begin
  if (select completed_at from jobs where scheduled_slot = '09:30') is not null then raise exception 'reopen kept completed_at'; end if;
  if (select warranty_until from jobs where scheduled_slot = '09:30') is not null then raise exception 'reopen kept warranty'; end if;
  if (select installer_id from jobs where customer_name = 'Walk Two') <> '22222222-2222-2222-2222-222222222222' then raise exception 'installer not stamped'; end if;
  if (select archived_at from jobs where customer_name = 'Walk Two') is not null then raise exception 'staff archived a job'; end if;
end $$;
commit;
begin; set local role authenticated; set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update jobs set archived_at = now() where customer_name = 'Walk Two';
do $$ begin
  if (select stage from jobs where customer_name = 'Walk Two') <> 'batal' then raise exception 'archive did not cancel'; end if;
end $$;
update jobs set archived_at = null where customer_name = 'Walk Two';
do $$ begin
  if (select stage from jobs where customer_name = 'Walk Two') <> 'dalam_kerja' then raise exception 'restore lost the stage'; end if;
  if push_device_count() <> 1 then raise exception 'device count wrong'; end if;
end $$;
commit;
begin; set local role anon;
select pg_temp.expect_error('select push_device_count()', 'permission denied');
commit;
\echo 'ok 10 reopen clears finish, installer stamped, archive owner-only + restores its stage, device count staff-only'

-- 11. Walk-in reserve, add-on pricing, the customer's own link (0003).
--     2 bays per block (test 7), only 1 sold online. Day e is untouched so far.
create temp table t_e as select (shop_today() + 5) as e;
grant select on t_e to anon, authenticated;
update shop_settings set online_per_slot = 1,
  addons = '[{"id":"depan","name":"Cermin depan","prices":{"small":100}},{"id":"buang","name":"Buang tinted lama","prices":{"small":50}},{"id":"belakang","name":"Cermin belakang","prices":{"small":null}}]';
create temp table t_tok2 (tok text);
grant select, insert on t_tok2 to anon;
begin; set local role anon;
select pg_temp.expect_error($q$select book_slot('Rina','0133333333','Myvi','PKC 3','small','ceramic',(select e from t_e),'09:30',null,true,'{nope}')$q$, 'bad_addon');
insert into t_tok2 select book_slot('Rina','0133333333','Myvi','PKC 3','small','ceramic',(select e from t_e),'09:30',null,true,'{depan,buang}','tinggal','tiktok')->>'manage_token';
do $$ begin
  if (select remaining from available_slots((select e from t_e), 1) where slot = '09:30') <> 0 then raise exception 'online share not capped'; end if;
end $$;
select pg_temp.expect_error($q$select book_slot('Wan','0144444444','Myvi','PKD 4','small','ceramic',(select e from t_e),'09:30',null,true)$q$, 'slot_full');
do $$ declare b jsonb; begin
  b := get_booking((select tok from t_tok2));
  if b is null or b ? 'phone' or b ? 'manage_token' or b->>'customer' <> 'Rina' then raise exception 'get_booking wrong: %', b; end if;
  if get_booking(repeat('0', 36)) is not null then raise exception 'wrong token returned data'; end if;
  b := manage_booking((select tok from t_tok2), 'confirm');
  if (b->>'confirmed')::boolean is not true then raise exception 'confirm failed: %', b; end if;
end $$;
select pg_temp.expect_error($q$select manage_booking(repeat('0', 36), 'cancel')$q$, 'not_found');
commit;
do $$ declare j jobs; begin
  select * into j from jobs where customer_name = 'Rina';
  if j.quoted_price <> 750 then raise exception 'quote should be 600 + 100 + 50, got %', j.quoted_price; end if;
  if j.wait_mode <> 'tinggal' or j.heard_from <> 'tiktok' or j.addons <> '{buang,depan}' then raise exception 'fields not saved: %', j; end if;
  if quote_price('small', 'ceramic', '{belakang}') is not null then raise exception 'unpriced add-on must give no quote'; end if;
  if (select count(*) from pg_proc where proname = 'book_slot') <> 1 then raise exception 'book_slot has an old overload left'; end if;
  if has_function_privilege('anon', 'quote_price(text,text,text[])', 'execute') then raise exception 'anon can call quote_price'; end if;
  if not has_function_privilege('anon', 'get_booking(text)', 'execute') then raise exception 'anon cannot open their link'; end if;
end $$;
-- The walk-in bay is still there for staff.
begin; set local role authenticated; set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into jobs (source, stage, customer_name, phone, car_size, film_id, scheduled_date, scheduled_slot)
  values ('walk_in', 'dalam_kerja', 'Walk Three', '0155555555', 'small', 'standard', (select e from t_e), '09:30');
commit;
begin; set local role anon;
do $$ declare b jsonb; begin
  b := manage_booking((select tok from t_tok2), 'cancel');
  if b->>'stage' <> 'batal' or (b->>'can_change')::boolean then raise exception 'cancel failed: %', b; end if;
  if (select remaining from available_slots((select e from t_e), 1) where slot = '09:30') <> 1 then raise exception 'cancel did not free the online place'; end if;
end $$;
select pg_temp.expect_error($q$select manage_booking((select tok from t_tok2), 'confirm')$q$, 'too_late');
commit;
\echo 'ok 11 walk-in reserve, add-on quote, customer link confirm/cancel, one book_slot'
\echo 'ALL DB TESTS PASSED'
