-- Simple stakeholder-task seed.
-- Important: click inside editor, press Ctrl+A, then Run. Do not run a highlighted partial block.

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
  null::uuid as cycle_id,
  src.school_code,
  src.student_code,
  src.student_name,
  'school',
  'Susun tindakan akademik dan pemantauan murid',
  coalesce(nullif(src.intervention, ''), nullif(src.issue, ''), 'Sekolah menyelaras tindakan susulan mengikut isu utama murid.'),
  src.risk,
  src.focus_area,
  current_date + case when src.risk = 'red' then 7 else 14 end
from (
  select
    school_code::text,
    student_code::text,
    name::text as student_name,
    lower(coalesce(risk::text, '')) as risk,
    coalesce(issue::text, '') as issue,
    coalesce(intervention::text, '') as intervention,
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan') as focus_area
  from public.dashboard_real_student_risks
  where lower(coalesce(risk::text, '')) in ('red', 'amber')

  union all

  select
    null::text,
    coalesce(student_code::text, name::text),
    name::text,
    lower(coalesce(risk::text, '')),
    coalesce(issue::text, ''),
    coalesce(intervention::text, ''),
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan')
  from public.dashboard_student_risks
  where not exists (select 1 from public.dashboard_real_student_risks)
    and lower(coalesce(risk::text, '')) in ('red', 'amber')
) src
where not exists (
  select 1
  from public.intervention_stakeholder_tasks existing
  where existing.student_code = src.student_code
    and existing.stakeholder_type = 'school'
);

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
  null::uuid,
  src.school_code,
  src.student_code,
  src.student_name,
  'parent',
  'Sahkan sokongan kehadiran dan ulang kaji di rumah',
  'Ibu bapa diminta menyokong kehadiran, jadual ulang kaji dan komunikasi berkala dengan pihak sekolah.',
  src.risk,
  src.focus_area,
  current_date + case when src.risk = 'red' then 7 else 14 end
from (
  select
    school_code::text,
    student_code::text,
    name::text as student_name,
    lower(coalesce(risk::text, '')) as risk,
    coalesce(attendance_rate::numeric, 100) as attendance_rate,
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan') as focus_area
  from public.dashboard_real_student_risks
  where lower(coalesce(risk::text, '')) in ('red', 'amber')

  union all

  select
    null::text,
    coalesce(student_code::text, name::text),
    name::text,
    lower(coalesce(risk::text, '')),
    coalesce(attendance_rate::numeric, 100),
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan')
  from public.dashboard_student_risks
  where not exists (select 1 from public.dashboard_real_student_risks)
    and lower(coalesce(risk::text, '')) in ('red', 'amber')
) src
where (src.risk = 'red' or src.attendance_rate < 90)
  and not exists (
    select 1
    from public.intervention_stakeholder_tasks existing
    where existing.student_code = src.student_code
      and existing.stakeholder_type = 'parent'
  );

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
  null::uuid,
  src.school_code,
  src.student_code,
  src.student_name,
  'community',
  'Laksana ziarah cakna komuniti jika isu kehadiran berterusan',
  'Ketua kaum atau penghulu membantu ziarah cakna bagi kes kehadiran kritikal dan sokongan keluarga.',
  src.risk,
  src.focus_area,
  current_date + case when src.risk = 'red' then 7 else 14 end
from (
  select
    school_code::text,
    student_code::text,
    name::text as student_name,
    lower(coalesce(risk::text, '')) as risk,
    lower(coalesce(issue::text, '')) as issue,
    coalesce(attendance_rate::numeric, 100) as attendance_rate,
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan') as focus_area
  from public.dashboard_real_student_risks
  where lower(coalesce(risk::text, '')) in ('red', 'amber')

  union all

  select
    null::text,
    coalesce(student_code::text, name::text),
    name::text,
    lower(coalesce(risk::text, '')),
    lower(coalesce(issue::text, '')),
    coalesce(attendance_rate::numeric, 100),
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan')
  from public.dashboard_student_risks
  where not exists (select 1 from public.dashboard_real_student_risks)
    and lower(coalesce(risk::text, '')) in ('red', 'amber')
) src
where (src.attendance_rate < 88 or src.issue like '%ponteng%' or src.issue like '%kehadiran%')
  and not exists (
    select 1
    from public.intervention_stakeholder_tasks existing
    where existing.student_code = src.student_code
      and existing.stakeholder_type = 'community'
  );

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
  null::uuid,
  src.school_code,
  src.student_code,
  src.student_name,
  'representative',
  'Semak keperluan sokongan logistik atau bantuan komuniti',
  'YB atau agensi boleh membantu sokongan logistik, ruang belajar komuniti, peranti atau pengangkutan jika diperlukan.',
  src.risk,
  src.focus_area,
  current_date + 14
from (
  select
    school_code::text,
    student_code::text,
    name::text as student_name,
    lower(coalesce(risk::text, '')) as risk,
    coalesce(attendance_rate::numeric, 100) as attendance_rate,
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan') as focus_area
  from public.dashboard_real_student_risks
  where lower(coalesce(risk::text, '')) in ('red', 'amber')

  union all

  select
    null::text,
    coalesce(student_code::text, name::text),
    name::text,
    lower(coalesce(risk::text, '')),
    coalesce(attendance_rate::numeric, 100),
    coalesce(nullif(lms_focus::text, ''), nullif(gps_focus::text, ''), 'Pemantauan')
  from public.dashboard_student_risks
  where not exists (select 1 from public.dashboard_real_student_risks)
    and lower(coalesce(risk::text, '')) in ('red', 'amber')
) src
where src.risk = 'red'
  and (src.focus_area = 'LMS' or src.attendance_rate < 85)
  and not exists (
    select 1
    from public.intervention_stakeholder_tasks existing
    where existing.student_code = src.student_code
      and existing.stakeholder_type = 'representative'
  );

notify pgrst, 'reload schema';

select
  'ok' as seed_status,
  count(*)::integer as total_tasks
from public.intervention_stakeholder_tasks;
