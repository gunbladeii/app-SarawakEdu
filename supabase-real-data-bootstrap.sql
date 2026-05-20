-- Jalankan sekali selepas `supabase-real-data-schema.sql`.
-- Tujuan: wujudkan PPD Admin pertama dan kitaran aktif pertama.
-- Nota: Untuk bootstrap pertama, jalankan melalui SQL Editor biasa, bukan sebagai pengguna biasa RLS.

insert into public.app_user_access
  (email, role, school_code, active)
select
  'gunbladeii25@gmail.com',
  'ppd_admin'::public.app_role,
  null,
  true
where not exists (
  select 1
  from public.app_user_access
  where lower(email) = lower('gunbladeii25@gmail.com')
    and school_code is null
);

update public.app_user_access
set
  role = 'ppd_admin'::public.app_role,
  school_code = null,
  active = true,
  updated_at = now()
where lower(email) = lower('gunbladeii25@gmail.com')
  and school_code is null;

update public.assessment_cycles
set
  is_active = false,
  updated_at = now()
where is_active = true
  and code <> 'SPM-2026-PERCUBAAN';

insert into public.assessment_cycles
  (code, name, year, cycle_type, starts_on, status, is_active)
values
  ('SPM-2026-PERCUBAAN', 'Percubaan SPM 2026', 2026, 'Percubaan SPM', current_date, 'open', true)
on conflict (code) do update set
  name = excluded.name,
  year = excluded.year,
  cycle_type = excluded.cycle_type,
  status = 'open',
  is_active = true,
  updated_at = now();

select
  'bootstrap_ready' as status,
  (select count(*) from public.app_user_access where role = 'ppd_admin' and active = true) as active_ppd_admin,
  (select code from public.assessment_cycles where is_active = true limit 1) as active_cycle;
