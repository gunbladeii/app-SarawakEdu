create extension if not exists pgcrypto;

create table if not exists public.intervention_stakeholder_tasks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid,
  school_code text,
  student_code text,
  student_name text,
  stakeholder_type text not null,
  task_title text not null,
  task_detail text,
  risk text not null default 'green',
  focus_area text not null default 'Pemantauan',
  status text not null default 'pending',
  due_date date,
  limited_token uuid not null default gen_random_uuid(),
  assigned_by uuid default auth.uid(),
  assigned_to_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intervention_task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.intervention_stakeholder_tasks(id) on delete cascade,
  status text not null,
  note text,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists intervention_tasks_school_idx
  on public.intervention_stakeholder_tasks (school_code, stakeholder_type, status);

create index if not exists intervention_tasks_token_idx
  on public.intervention_stakeholder_tasks (limited_token);

drop view if exists public.dashboard_intervention_network_summary;

create view public.dashboard_intervention_network_summary as
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
  sum(case when status in ('pending', 'accepted') then 1 else 0 end)::integer as pending_tasks,
  sum(case when status = 'in_progress' then 1 else 0 end)::integer as active_tasks,
  sum(case when status = 'done' then 1 else 0 end)::integer as done_tasks,
  sum(case when risk = 'red' and status <> 'done' then 1 else 0 end)::integer as urgent_tasks
from public.intervention_stakeholder_tasks
group by stakeholder_type;

drop view if exists public.dashboard_intervention_network_tasks;

create view public.dashboard_intervention_network_tasks as
select
  id,
  cycle_id,
  null::text as cycle_code,
  school_code,
  student_code,
  student_name,
  stakeholder_type,
  case stakeholder_type
    when 'school' then 'Sekolah'
    when 'parent' then 'Ibu bapa'
    when 'community' then 'Ketua kaum / penghulu'
    when 'representative' then 'YB / agensi'
    else 'Pihak berkepentingan'
  end as owner_label,
  task_title,
  task_detail,
  risk,
  focus_area,
  status,
  due_date,
  created_at,
  updated_at
from public.intervention_stakeholder_tasks;

alter view public.dashboard_intervention_network_summary set (security_invoker = true);
alter view public.dashboard_intervention_network_tasks set (security_invoker = true);

grant select, insert, update on public.intervention_stakeholder_tasks to authenticated;
grant select, insert on public.intervention_task_updates to authenticated;
grant select on public.dashboard_intervention_network_summary to authenticated;
grant select on public.dashboard_intervention_network_tasks to authenticated;

notify pgrst, 'reload schema';

select
  'ok' as setup_status,
  to_regclass('public.intervention_stakeholder_tasks') as task_table,
  to_regclass('public.dashboard_intervention_network_summary') as summary_view,
  to_regclass('public.dashboard_intervention_network_tasks') as task_view;
