-- Direct seed for intervention stakeholder tasks.
-- Use this when the SQL editor keeps running only a partial selected block.
-- Paste the whole file into a new SQL editor tab, then press Ctrl+A and Run.

insert into public.intervention_stakeholder_tasks (
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
  item.school_code,
  item.student_code,
  item.student_name,
  item.stakeholder_type,
  item.task_title,
  item.task_detail,
  item.risk,
  item.focus_area,
  item.due_date
from (
  values
    (null::text, 'STU-0001', 'Aina L.', 'school', 'Susun klinik LMS Bahasa Melayu', 'Belum lulus Bahasa Melayu dan kehadiran 78%. Sekolah perlu menyelaras kelas bimbingan serta pemantauan mingguan.', 'red', 'LMS', current_date + 7),
    (null::text, 'STU-0001', 'Aina L.', 'parent', 'Sahkan sokongan kehadiran di rumah', 'Ibu bapa diminta membantu jadual ulang kaji dan memastikan kehadiran murid stabil.', 'red', 'LMS', current_date + 7),
    (null::text, 'STU-0002', 'Rizal J.', 'community', 'Ziarah cakna bersama ketua kaum', 'Ponteng berselang dan Matematik E. Ketua kaum atau penghulu membantu sokongan keluarga dan kehadiran.', 'red', 'GPS Kuantiti', current_date + 7),
    (null::text, 'STU-0003', 'Daniel A.', 'school', 'Kelas bimbingan Sejarah mingguan', 'Belum lulus Sejarah. Sekolah perlu jadualkan bimbingan fokus dan semakan kemajuan.', 'red', 'LMS', current_date + 7),
    (null::text, 'STU-0004', 'Nur F.', 'school', 'Latih tubi terarah empat minggu', 'Markah Sains menurun 12 mata. Guru mata pelajaran perlu susun latihan fokus.', 'amber', 'GPS Kualiti', current_date + 14),
    (null::text, 'STU-0005', 'Brandon M.', 'parent', 'Sokongan rakan sebaya dan latihan lisan', 'Kehadiran 86% dan Bahasa Inggeris rendah. Ibu bapa membantu sokongan kehadiran dan latihan di rumah.', 'amber', 'GPS Kuantiti', current_date + 14),
    (null::text, 'STU-0006', 'Siti R.', 'representative', 'Semak sokongan ruang belajar komuniti', 'Purata gred sasaran tergelincir. Agensi atau wakil komuniti boleh membantu ruang belajar dan sokongan logistik.', 'amber', 'GPS Kualiti', current_date + 14)
) as item (
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
where not exists (
  select 1
  from public.intervention_stakeholder_tasks existing
  where existing.student_code = item.student_code
    and existing.stakeholder_type = item.stakeholder_type
    and existing.task_title = item.task_title
);

notify pgrst, 'reload schema';

select
  'ok' as seed_status,
  count(*)::integer as total_tasks
from public.intervention_stakeholder_tasks;
