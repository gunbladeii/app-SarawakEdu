create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum (
    'ppd_admin',
    'school_admin',
    'subject_teacher',
    'class_teacher',
    'counsellor',
    'viewer'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.assessment_cycle_status as enum (
    'draft',
    'open',
    'locked',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.intervention_status as enum (
    'open',
    'in_progress',
    'done',
    'escalated'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.risk_level as enum ('red', 'amber', 'green');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.app_user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  role public.app_role not null default 'viewer',
  school_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_user_access_email_check check (position('@' in email) > 1),
  constraint app_user_access_school_check check (
    role in ('ppd_admin', 'viewer') or school_code is not null
  )
);

create unique index if not exists app_user_access_email_school_idx
  on public.app_user_access (lower(email), coalesce(school_code, '__district__'));

create table if not exists public.assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  year integer not null check (year between 2024 and 2100),
  cycle_type text not null default 'Pemantauan',
  starts_on date,
  ends_on date,
  status public.assessment_cycle_status not null default 'open',
  is_active boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assessment_cycles_one_active_idx
  on public.assessment_cycles (is_active)
  where is_active = true;

create table if not exists public.data_import_batches (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  school_code text not null,
  source_type text not null default 'excel' check (source_type in ('excel', 'manual', 'api')),
  file_name text,
  row_count integer not null default 0 check (row_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  status text not null default 'received' check (status in ('received', 'validated', 'approved', 'rejected')),
  notes jsonb not null default '{}'::jsonb,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_monitoring_records (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  import_batch_id uuid references public.data_import_batches(id) on delete set null,
  school_code text not null,
  student_code text not null,
  class_id text,
  class_name text,
  form_code text not null default '15',
  attendance_rate numeric(5,2) check (attendance_rate between 0 and 100),
  bm_score numeric(5,2) check (bm_score between 0 and 100),
  bm_grade text,
  bm_pass boolean,
  sejarah_score numeric(5,2) check (sejarah_score between 0 and 100),
  sejarah_grade text,
  sejarah_pass boolean,
  current_gpa numeric(4,2) check (current_gpa >= 0),
  target_gpa numeric(4,2) check (target_gpa >= 0),
  critical_subject text,
  gps_quality_need boolean not null default false,
  gps_quantity_need boolean not null default false,
  risk public.risk_level not null default 'green',
  issue_note text,
  subject_scores jsonb not null default '{}'::jsonb,
  entered_by uuid default auth.uid(),
  verified_by uuid,
  verified_at timestamptz,
  last_reviewed date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_monitoring_records_unique unique (cycle_id, student_code)
);

create table if not exists public.student_subject_results (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  school_code text not null,
  student_code text not null,
  subject_code text not null,
  subject_name text not null,
  score numeric(5,2) check (score between 0 and 100),
  grade text,
  pass boolean,
  entered_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint student_subject_results_unique unique (cycle_id, student_code, subject_code)
);

create table if not exists public.student_intervention_records (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  school_code text not null,
  student_code text not null,
  focus_area text not null check (
    focus_area in ('GPS Kualiti', 'GPS Kuantiti', 'LMS', 'Kehadiran', 'Disiplin', 'Lain-lain')
  ),
  risk public.risk_level not null default 'amber',
  issue text not null,
  action text not null,
  owner_role text,
  owner_name text,
  due_date date,
  status public.intervention_status not null default 'open',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_monitoring_school_cycle_idx
  on public.student_monitoring_records (school_code, cycle_id);

create index if not exists student_monitoring_student_idx
  on public.student_monitoring_records (student_code);

create index if not exists student_subject_school_cycle_idx
  on public.student_subject_results (school_code, cycle_id);

create index if not exists student_intervention_school_cycle_idx
  on public.student_intervention_records (school_code, cycle_id, status);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select aur.role
  from public.app_user_access aur
  where aur.active = true
    and (
      aur.user_id = auth.uid()
      or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by case aur.role
    when 'ppd_admin' then 1
    when 'school_admin' then 2
    when 'subject_teacher' then 3
    when 'class_teacher' then 4
    when 'counsellor' then 5
    else 6
  end
  limit 1;
$$;

create or replace function public.can_access_school(target_school_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user_access aur
    where aur.active = true
      and (
        aur.user_id = auth.uid()
        or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        aur.role = 'ppd_admin'
        or aur.school_code = target_school_code
      )
  );
$$;

create or replace view public.dashboard_real_school_metrics as
select
  smr.cycle_id,
  ac.code as cycle_code,
  ac.name as cycle_name,
  smr.school_code as code,
  count(*)::integer as candidates,
  round(
    100.0 * count(*) filter (
      where coalesce(smr.bm_pass, false) = true
        and coalesce(smr.sejarah_pass, false) = true
    ) / nullif(count(*), 0),
    2
  ) as pass_forecast,
  round(avg(smr.attendance_rate), 2) as attendance_avg,
  round(avg(smr.current_gpa), 2) as gpa,
  count(*) filter (where smr.risk = 'red')::integer as red_count,
  count(*) filter (where smr.risk = 'amber')::integer as amber_count,
  coalesce(
    mode() within group (order by smr.critical_subject)
      filter (where smr.critical_subject is not null and smr.critical_subject <> ''),
    '-'
  ) as critical_subject,
  count(*) filter (where smr.gps_quality_need = true)::integer as gps_quality_need,
  count(*) filter (where smr.gps_quantity_need = true)::integer as gps_quantity_need,
  count(*) filter (
    where coalesce(smr.bm_pass, false) = false
      or coalesce(smr.sejarah_pass, false) = false
  )::integer as lms_need_help,
  count(*) filter (where coalesce(smr.bm_pass, false) = false)::integer as bm_need_help,
  count(*) filter (where coalesce(smr.sejarah_pass, false) = false)::integer as sejarah_need_help,
  max(smr.updated_at) as updated_at
from public.student_monitoring_records smr
join public.assessment_cycles ac on ac.id = smr.cycle_id
where ac.is_active = true
group by smr.cycle_id, ac.code, ac.name, smr.school_code;

alter view public.dashboard_real_school_metrics set (security_invoker = true);

create or replace view public.dashboard_real_student_risks as
select
  smr.id,
  smr.cycle_id,
  ac.code as cycle_code,
  smr.student_code,
  smr.student_code as name,
  smr.school_code as school,
  smr.school_code,
  smr.risk::text as risk,
  coalesce(
    smr.issue_note,
    case
      when coalesce(smr.bm_pass, false) = false and coalesce(smr.sejarah_pass, false) = false
        then 'Perlu bantuan Bahasa Melayu dan Sejarah'
      when coalesce(smr.bm_pass, false) = false
        then 'Perlu bantuan Bahasa Melayu'
      when coalesce(smr.sejarah_pass, false) = false
        then 'Perlu bantuan Sejarah'
      when smr.gps_quality_need = true
        then 'Perlu bantuan GPS Kualiti'
      when smr.gps_quantity_need = true
        then 'Perlu bantuan GPS Kuantiti'
      else 'Perlu pemantauan berkala'
    end
  ) as issue,
  coalesce(latest_intervention.action, 'Belum direkod') as intervention,
  smr.attendance_rate,
  smr.last_reviewed,
  smr.updated_at,
  case
    when smr.gps_quality_need = true then 'GPS Kualiti'
    when smr.gps_quantity_need = true then 'GPS Kuantiti'
    else '-'
  end as gps_focus,
  coalesce(smr.bm_pass, false) as bm_pass,
  coalesce(smr.sejarah_pass, false) as sejarah_pass,
  case
    when coalesce(smr.bm_pass, false) = true and coalesce(smr.sejarah_pass, false) = true then 'Sedia LMS'
    when coalesce(smr.bm_pass, false) = false and coalesce(smr.sejarah_pass, false) = false then 'Perlu bantuan Bahasa Melayu dan Sejarah'
    when coalesce(smr.bm_pass, false) = false then 'Perlu bantuan Bahasa Melayu'
    else 'Perlu bantuan Sejarah'
  end as lms_focus
from public.student_monitoring_records smr
join public.assessment_cycles ac on ac.id = smr.cycle_id
left join lateral (
  select sir.action
  from public.student_intervention_records sir
  where sir.cycle_id = smr.cycle_id
    and sir.student_code = smr.student_code
  order by sir.updated_at desc
  limit 1
) latest_intervention on true
where ac.is_active = true;

alter view public.dashboard_real_student_risks set (security_invoker = true);

alter table public.app_user_access enable row level security;
alter table public.assessment_cycles enable row level security;
alter table public.data_import_batches enable row level security;
alter table public.student_monitoring_records enable row level security;
alter table public.student_subject_results enable row level security;
alter table public.student_intervention_records enable row level security;

drop policy if exists "read own or admin access" on public.app_user_access;
drop policy if exists "admin manage user access" on public.app_user_access;
drop policy if exists "read assessment cycles" on public.assessment_cycles;
drop policy if exists "admin manage assessment cycles" on public.assessment_cycles;
drop policy if exists "school read import batches" on public.data_import_batches;
drop policy if exists "school manage import batches" on public.data_import_batches;
drop policy if exists "school read monitoring records" on public.student_monitoring_records;
drop policy if exists "school insert monitoring records" on public.student_monitoring_records;
drop policy if exists "school update monitoring records" on public.student_monitoring_records;
drop policy if exists "school delete monitoring records" on public.student_monitoring_records;
drop policy if exists "school read subject results" on public.student_subject_results;
drop policy if exists "school manage subject results" on public.student_subject_results;
drop policy if exists "school read intervention records" on public.student_intervention_records;
drop policy if exists "school manage intervention records" on public.student_intervention_records;

create policy "read own or admin access"
  on public.app_user_access for select
  to authenticated
  using (
    public.current_app_role() = 'ppd_admin'
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "admin manage user access"
  on public.app_user_access for all
  to authenticated
  using (public.current_app_role() = 'ppd_admin')
  with check (public.current_app_role() = 'ppd_admin');

create policy "read assessment cycles"
  on public.assessment_cycles for select
  to authenticated
  using (true);

create policy "admin manage assessment cycles"
  on public.assessment_cycles for all
  to authenticated
  using (public.current_app_role() = 'ppd_admin')
  with check (public.current_app_role() = 'ppd_admin');

create policy "school read import batches"
  on public.data_import_batches for select
  to authenticated
  using (public.can_access_school(school_code));

create policy "school manage import batches"
  on public.data_import_batches for all
  to authenticated
  using (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher')
  )
  with check (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher')
  );

create policy "school read monitoring records"
  on public.student_monitoring_records for select
  to authenticated
  using (public.can_access_school(school_code));

create policy "school insert monitoring records"
  on public.student_monitoring_records for insert
  to authenticated
  with check (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher')
  );

create policy "school update monitoring records"
  on public.student_monitoring_records for update
  to authenticated
  using (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher', 'subject_teacher', 'counsellor')
  )
  with check (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher', 'subject_teacher', 'counsellor')
  );

create policy "school delete monitoring records"
  on public.student_monitoring_records for delete
  to authenticated
  using (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin')
  );

create policy "school read subject results"
  on public.student_subject_results for select
  to authenticated
  using (public.can_access_school(school_code));

create policy "school manage subject results"
  on public.student_subject_results for all
  to authenticated
  using (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'subject_teacher', 'class_teacher')
  )
  with check (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'subject_teacher', 'class_teacher')
  );

create policy "school read intervention records"
  on public.student_intervention_records for select
  to authenticated
  using (public.can_access_school(school_code));

create policy "school manage intervention records"
  on public.student_intervention_records for all
  to authenticated
  using (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher', 'counsellor')
  )
  with check (
    public.can_access_school(school_code)
    and public.current_app_role()::text in ('ppd_admin', 'school_admin', 'class_teacher', 'counsellor')
  );

grant usage on schema public to authenticated;
grant select on public.app_user_access to authenticated;
grant select, insert, update on public.assessment_cycles to authenticated;
grant select, insert, update, delete on public.data_import_batches to authenticated;
grant select, insert, update, delete on public.student_monitoring_records to authenticated;
grant select, insert, update, delete on public.student_subject_results to authenticated;
grant select, insert, update, delete on public.student_intervention_records to authenticated;
grant select on public.dashboard_real_school_metrics to authenticated;
grant select on public.dashboard_real_student_risks to authenticated;

-- Bootstrap PPD admin pertama melalui SQL Editor:
-- insert into public.app_user_access (email, role)
-- values ('email.admin@moe.gov.my', 'ppd_admin')
-- on conflict do nothing;
