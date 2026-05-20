select
  'app_user_access' as item,
  count(*)::integer as count
from public.app_user_access
union all
select
  'assessment_cycles' as item,
  count(*)::integer as count
from public.assessment_cycles
union all
select
  'active_cycles' as item,
  count(*)::integer as count
from public.assessment_cycles
where is_active = true
union all
select
  'student_monitoring_records' as item,
  count(*)::integer as count
from public.student_monitoring_records
union all
select
  'dashboard_real_school_metrics' as item,
  count(*)::integer as count
from public.dashboard_real_school_metrics
union all
select
  'dashboard_real_student_risks' as item,
  count(*)::integer as count
from public.dashboard_real_student_risks;

select
  code,
  name,
  year,
  status,
  is_active
from public.assessment_cycles
order by updated_at desc;

select
  email,
  role,
  school_code,
  active
from public.app_user_access
order by role, email, school_code;
