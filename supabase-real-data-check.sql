with expected_objects as (
  select 'table' as object_type, 'app_user_access' as object_name, to_regclass('public.app_user_access') as relation
  union all select 'table', 'assessment_cycles', to_regclass('public.assessment_cycles')
  union all select 'table', 'data_import_batches', to_regclass('public.data_import_batches')
  union all select 'table', 'student_monitoring_records', to_regclass('public.student_monitoring_records')
  union all select 'table', 'student_subject_results', to_regclass('public.student_subject_results')
  union all select 'table', 'student_intervention_records', to_regclass('public.student_intervention_records')
  union all select 'view', 'dashboard_real_school_metrics', to_regclass('public.dashboard_real_school_metrics')
  union all select 'view', 'dashboard_real_student_risks', to_regclass('public.dashboard_real_student_risks')
),
required_objects as (
  select * from (values
    ('table', 'app_user_access'),
    ('table', 'assessment_cycles'),
    ('table', 'data_import_batches'),
    ('table', 'student_monitoring_records'),
    ('table', 'student_subject_results'),
    ('table', 'student_intervention_records'),
    ('view', 'dashboard_real_school_metrics'),
    ('view', 'dashboard_real_student_risks')
  ) as item(object_type, object_name)
)
select
  ro.object_type,
  ro.object_name,
  case when eo.relation is null then 'missing' else 'ready' end as status
from required_objects ro
left join expected_objects eo
  on eo.object_type = ro.object_type
 and eo.object_name = ro.object_name
order by ro.object_type, ro.object_name;

do $$
begin
  if to_regclass('public.assessment_cycles') is not null then
    raise notice 'assessment_cycles table exists. Run the SELECT below manually if you want cycle details.';
  else
    raise notice 'assessment_cycles table is missing. Run supabase-real-data-schema.sql first.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.app_user_access') is not null then
    raise notice 'app_user_access table exists. Run the SELECT below manually if you want access details.';
  else
    raise notice 'app_user_access table is missing. Run supabase-real-data-schema.sql first.';
  end if;
end $$;

-- Selepas semua object berstatus `ready`, boleh run dua semakan ini:
-- select code, name, year, status, is_active from public.assessment_cycles order by updated_at desc;
-- select email, role, school_code, active from public.app_user_access order by role, email, school_code;
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'student_monitoring_records' and column_name = 'student_name';
