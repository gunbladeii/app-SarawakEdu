alter table public.schools
  add column if not exists gps_quality_need integer not null default 0 check (gps_quality_need >= 0),
  add column if not exists gps_quantity_need integer not null default 0 check (gps_quantity_need >= 0),
  add column if not exists lms_need_help integer not null default 0 check (lms_need_help >= 0),
  add column if not exists bm_need_help integer not null default 0 check (bm_need_help >= 0),
  add column if not exists sejarah_need_help integer not null default 0 check (sejarah_need_help >= 0);

alter table public.student_risks
  add column if not exists gps_focus text not null default '-',
  add column if not exists bm_pass boolean not null default true,
  add column if not exists sejarah_pass boolean not null default true;

create or replace view public.dashboard_student_risks as
select
  sr.id,
  sr.student_code,
  sr.name,
  s.name as school,
  sr.risk::text as risk,
  sr.issue,
  sr.intervention,
  sr.attendance_rate,
  sr.last_reviewed,
  sr.updated_at,
  sr.gps_focus,
  sr.bm_pass,
  sr.sejarah_pass,
  case
    when sr.bm_pass and sr.sejarah_pass then 'Sedia LMS'
    when not sr.bm_pass and not sr.sejarah_pass then 'Perlu bantuan Bahasa Melayu dan Sejarah'
    when not sr.bm_pass then 'Perlu bantuan Bahasa Melayu'
    else 'Perlu bantuan Sejarah'
  end as lms_focus
from public.student_risks sr
join public.schools s on s.code = sr.school_code;

alter view public.dashboard_student_risks set (security_invoker = true);

grant select on public.schools to anon, authenticated;
grant select on public.student_risks to anon, authenticated;
grant select on public.dashboard_student_risks to anon, authenticated;
