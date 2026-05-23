create extension if not exists pgcrypto;

create table if not exists public.intervention_stakeholder_tasks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.assessment_cycles(id) on delete cascade,
  school_code text,
  student_code text,
  student_name text,
  stakeholder_type text not null check (
    stakeholder_type in ('school', 'parent', 'community', 'representative')
  ),
  task_title text not null,
  task_detail text,
  risk text not null default 'green' check (risk in ('red', 'amber', 'green')),
  focus_area text not null default 'Pemantauan',
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'in_progress', 'done', 'needs_help', 'cancelled')
  ),
  due_date date,
  limited_token uuid not null default gen_random_uuid(),
  assigned_by uuid default auth.uid(),
  assigned_to_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, student_code, stakeholder_type)
);

create table if not exists public.intervention_task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.intervention_stakeholder_tasks(id) on delete cascade,
  status text not null check (
    status in ('pending', 'accepted', 'in_progress', 'done', 'needs_help', 'cancelled')
  ),
  note text,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists intervention_tasks_school_idx
  on public.intervention_stakeholder_tasks (school_code, stakeholder_type, status);

create index if not exists intervention_tasks_token_idx
  on public.intervention_stakeholder_tasks (limited_token);

create or replace view public.dashboard_intervention_network_tasks as
select
  ist.id,
  ist.cycle_id,
  ac.code as cycle_code,
  ist.school_code,
  ist.student_code,
  ist.student_name,
  ist.stakeholder_type,
  case ist.stakeholder_type
    when 'school' then 'Sekolah'
    when 'parent' then 'Ibu bapa'
    when 'community' then 'Ketua kaum / penghulu'
    when 'representative' then 'YB / agensi'
    else 'Pihak berkepentingan'
  end as owner_label,
  ist.task_title,
  ist.task_detail,
  ist.risk,
  ist.focus_area,
  ist.status,
  ist.due_date,
  ist.created_at,
  ist.updated_at
from public.intervention_stakeholder_tasks ist
left join public.assessment_cycles ac on ac.id = ist.cycle_id;

alter view public.dashboard_intervention_network_tasks set (security_invoker = true);

create or replace view public.dashboard_intervention_network_summary as
select
  stakeholder_type,
  case stakeholder_type
    when 'school' then 'Sekolah'
    when 'parent' then 'Ibu bapa'
    when 'community' then 'Ketua kaum / penghulu'
    when 'representative' then 'YB / agensi'
    else 'Pihak berkepentingan'
  end as owner_label,
  case stakeholder_type
    when 'school' then 'Kelas mikro, mentor akademik, semakan markah dan pemantauan kehadiran harian.'
    when 'parent' then 'Sokongan kehadiran, jadual ulang kaji di rumah dan komunikasi berkala dengan sekolah.'
    when 'community' then 'Ziarah cakna bagi kes kehadiran kritikal, sokongan keluarga dan pemantauan komuniti.'
    when 'representative' then 'Sokongan logistik, ruang belajar komuniti, bantuan peranti atau pengangkutan.'
    else 'Tindakan intervensi murid.'
  end as action_summary,
  case stakeholder_type
    when 'school' then 1
    when 'parent' then 2
    when 'community' then 3
    when 'representative' then 4
    else 9
  end as sort_order,
  count(*)::integer as total_tasks,
  count(*) filter (where status in ('pending', 'accepted'))::integer as pending_tasks,
  count(*) filter (where status = 'in_progress')::integer as active_tasks,
  count(*) filter (where status = 'done')::integer as done_tasks,
  count(*) filter (where risk = 'red' and status <> 'done')::integer as urgent_tasks
from public.intervention_stakeholder_tasks
group by stakeholder_type;

alter view public.dashboard_intervention_network_summary set (security_invoker = true);

create or replace function public.seed_intervention_tasks_from_current_risks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with active_cycle as (
    select id
    from public.assessment_cycles
    where is_active = true
    limit 1
  ),
  risk_students as (
    select
      smr.cycle_id,
      smr.school_code,
      smr.student_code,
      coalesce(nullif(smr.student_name, ''), smr.student_code) as student_name,
      smr.risk::text as risk,
      case
        when coalesce(smr.bm_pass, false) = false or coalesce(smr.sejarah_pass, false) = false then 'LMS'
        when smr.gps_quality_need then 'GPS Kualiti'
        when smr.gps_quantity_need then 'GPS Kuantiti'
        else 'Pemantauan'
      end as focus_area,
      coalesce(smr.issue_note, 'Perlu tindakan intervensi awal') as issue_note,
      coalesce(smr.attendance_rate, 100) as attendance_rate
    from public.student_monitoring_records smr
    join active_cycle ac on ac.id = smr.cycle_id
    where smr.risk in ('red', 'amber')
  ),
  routed as (
    select rs.*, 'school'::text as stakeholder_type,
      'Susun tindakan akademik dan pemantauan murid'::text as task_title
    from risk_students rs
    union all
    select rs.*, 'parent',
      'Sahkan sokongan kehadiran dan ulang kaji di rumah'
    from risk_students rs
    where rs.risk = 'red' or rs.attendance_rate < 90
    union all
    select rs.*, 'community',
      'Laksana ziarah cakna komuniti jika isu kehadiran berterusan'
    from risk_students rs
    where rs.attendance_rate < 88 or lower(rs.issue_note) like '%ponteng%' or lower(rs.issue_note) like '%kehadiran%'
    union all
    select rs.*, 'representative',
      'Semak keperluan sokongan logistik atau bantuan komuniti'
    from risk_students rs
    where rs.risk = 'red' and (rs.focus_area = 'LMS' or rs.attendance_rate < 85)
  ),
  inserted as (
    insert into public.intervention_stakeholder_tasks (
      cycle_id,
      school_code,
      student_code,
      student_name,
      stakeholder_type,
      task_title,
      task_detail,
      risk,
      focus_area,
      due_date
    )
    select
      cycle_id,
      school_code,
      student_code,
      student_name,
      stakeholder_type,
      task_title,
      issue_note,
      risk,
      focus_area,
      current_date + case when risk = 'red' then 7 else 14 end
    from routed
    on conflict (cycle_id, student_code, stakeholder_type) do update
    set
      student_name = excluded.student_name,
      task_detail = excluded.task_detail,
      risk = excluded.risk,
      focus_area = excluded.focus_area,
      updated_at = now()
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

alter table public.intervention_stakeholder_tasks enable row level security;
alter table public.intervention_task_updates enable row level security;

drop policy if exists "read stakeholder tasks" on public.intervention_stakeholder_tasks;
drop policy if exists "manage stakeholder tasks" on public.intervention_stakeholder_tasks;
drop policy if exists "read stakeholder task updates" on public.intervention_task_updates;
drop policy if exists "create stakeholder task updates" on public.intervention_task_updates;

create policy "read stakeholder tasks"
  on public.intervention_stakeholder_tasks for select
  to authenticated
  using (
    school_code is null
    or exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and (
          aur.role::text = 'ppd_admin'
          or aur.school_code = intervention_stakeholder_tasks.school_code
        )
    )
  );

create policy "manage stakeholder tasks"
  on public.intervention_stakeholder_tasks for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and aur.role::text in ('ppd_admin', 'school_admin', 'class_teacher', 'counsellor')
        and (
          aur.role::text = 'ppd_admin'
          or aur.school_code = intervention_stakeholder_tasks.school_code
        )
    )
  )
  with check (
    exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and aur.role::text in ('ppd_admin', 'school_admin', 'class_teacher', 'counsellor')
        and (
          aur.role::text = 'ppd_admin'
          or aur.school_code = intervention_stakeholder_tasks.school_code
        )
    )
  );

create policy "read stakeholder task updates"
  on public.intervention_task_updates for select
  to authenticated
  using (
    exists (
      select 1
      from public.intervention_stakeholder_tasks ist
      where ist.id = intervention_task_updates.task_id
    )
  );

create policy "create stakeholder task updates"
  on public.intervention_task_updates for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.intervention_stakeholder_tasks ist
      where ist.id = intervention_task_updates.task_id
    )
  );

grant select, insert, update on public.intervention_stakeholder_tasks to authenticated;
grant select, insert on public.intervention_task_updates to authenticated;
grant select on public.dashboard_intervention_network_tasks to authenticated;
grant select on public.dashboard_intervention_network_summary to authenticated;
grant execute on function public.seed_intervention_tasks_from_current_risks() to authenticated;

notify pgrst, 'reload schema';
