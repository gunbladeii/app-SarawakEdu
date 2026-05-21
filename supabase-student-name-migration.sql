alter table public.student_monitoring_records
  add column if not exists student_name text;

create or replace view public.dashboard_real_student_risks as
select
  smr.id,
  smr.cycle_id,
  ac.code as cycle_code,
  smr.student_code,
  coalesce(nullif(smr.student_name, ''), smr.student_code) as name,
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

grant select on public.dashboard_real_student_risks to authenticated;
