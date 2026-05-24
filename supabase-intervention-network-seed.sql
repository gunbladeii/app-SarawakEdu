-- Populate intervention stakeholder tasks from the current student-risk views.
-- Run this after supabase-intervention-network-bootstrap.sql returns setup_status = ok.

with real_source as (
  select
    null::uuid as cycle_id,
    school_code::text as school_code,
    student_code::text as student_code,
    name::text as student_name,
    school::text as school_name,
    lower(coalesce(risk::text, '')) as risk,
    coalesce(issue::text, '') as issue,
    coalesce(intervention::text, '') as intervention,
    attendance_rate::numeric as attendance_rate,
    coalesce(gps_focus::text, '') as gps_focus,
    coalesce(lms_focus::text, '') as lms_focus
  from public.dashboard_real_student_risks
  where lower(coalesce(risk::text, '')) in ('red', 'amber')
),
fallback_source as (
  select
    null::uuid as cycle_id,
    null::text as school_code,
    coalesce(student_code::text, name::text) as student_code,
    name::text as student_name,
    school::text as school_name,
    lower(coalesce(risk::text, '')) as risk,
    coalesce(issue::text, '') as issue,
    coalesce(intervention::text, '') as intervention,
    attendance_rate::numeric as attendance_rate,
    coalesce(gps_focus::text, '') as gps_focus,
    coalesce(lms_focus::text, '') as lms_focus
  from public.dashboard_student_risks
  where not exists (select 1 from real_source)
    and lower(coalesce(risk::text, '')) in ('red', 'amber')
),
risk_students as (
  select * from real_source
  union all
  select * from fallback_source
),
prepared_students as (
  select
    cycle_id,
    school_code,
    student_code,
    student_name,
    school_name,
    risk,
    issue,
    intervention,
    attendance_rate,
    case
      when nullif(lms_focus, '') is not null and lms_focus <> 'Sedia LMS' then 'LMS'
      when nullif(gps_focus, '') is not null and gps_focus <> '-' then gps_focus
      else 'Pemantauan'
    end as focus_area
  from risk_students
),
routed_tasks as (
  select
    cycle_id,
    school_code,
    student_code,
    student_name,
    'school'::text as stakeholder_type,
    'Susun tindakan akademik dan pemantauan murid'::text as task_title,
    coalesce(nullif(intervention, ''), nullif(issue, ''), 'Sekolah menyelaras tindakan susulan mengikut isu utama murid.') as task_detail,
    risk,
    focus_area,
    current_date + case when risk = 'red' then 7 else 14 end as due_date
  from prepared_students

  union all

  select
    cycle_id,
    school_code,
    student_code,
    student_name,
    'parent'::text as stakeholder_type,
    'Sahkan sokongan kehadiran dan ulang kaji di rumah'::text as task_title,
    'Ibu bapa diminta menyokong kehadiran, jadual ulang kaji dan komunikasi berkala dengan pihak sekolah.'::text as task_detail,
    risk,
    focus_area,
    current_date + case when risk = 'red' then 7 else 14 end as due_date
  from prepared_students
  where risk = 'red' or coalesce(attendance_rate, 100) < 90

  union all

  select
    cycle_id,
    school_code,
    student_code,
    student_name,
    'community'::text as stakeholder_type,
    'Laksana ziarah cakna komuniti jika isu kehadiran berterusan'::text as task_title,
    'Ketua kaum atau penghulu membantu ziarah cakna bagi kes kehadiran kritikal dan sokongan keluarga.'::text as task_detail,
    risk,
    focus_area,
    current_date + case when risk = 'red' then 7 else 14 end as due_date
  from prepared_students
  where coalesce(attendance_rate, 100) < 88
    or lower(issue) like '%ponteng%'
    or lower(issue) like '%kehadiran%'

  union all

  select
    cycle_id,
    school_code,
    student_code,
    student_name,
    'representative'::text as stakeholder_type,
    'Semak keperluan sokongan logistik atau bantuan komuniti'::text as task_title,
    'YB atau agensi boleh membantu sokongan logistik, ruang belajar komuniti, peranti atau pengangkutan jika diperlukan.'::text as task_detail,
    risk,
    focus_area,
    current_date + 14 as due_date
  from prepared_students
  where risk = 'red'
    and (focus_area = 'LMS' or coalesce(attendance_rate, 100) < 85)
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
    task_detail,
    risk,
    focus_area,
    due_date
  from routed_tasks task
  where not exists (
    select 1
    from public.intervention_stakeholder_tasks existing
    where existing.student_code = task.student_code
      and existing.stakeholder_type = task.stakeholder_type
      and existing.task_title = task.task_title
  )
  returning 1
)
select
  'ok' as seed_status,
  (select count(*) from inserted)::integer as inserted_tasks,
  (select count(*) from public.intervention_stakeholder_tasks)::integer as total_tasks;
