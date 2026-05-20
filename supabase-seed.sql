insert into public.schools
  (code, name, district, candidates, pass_forecast, attendance_avg, gpa, red_count, amber_count, critical_subject, gps_quality_need, gps_quantity_need, lms_need_help, bm_need_help, sejarah_need_help)
values
  ('SMK-SERIAN', 'SMK Serian', 'Serian', 218, 88, 94, 4.91, 11, 28, 'Matematik', 15, 12, 13, 7, 6),
  ('SMK-TAEE', 'SMK Taee', 'Serian', 96, 77, 89, 5.42, 13, 19, 'Sejarah', 14, 11, 15, 5, 12),
  ('SMK-TEBAKANG', 'SMK Tebakang', 'Serian', 104, 82, 91, 5.18, 8, 17, 'Bahasa Melayu', 10, 8, 9, 8, 3),
  ('SMK-GEDONG', 'SMK Gedong', 'Serian', 132, 74, 86, 5.61, 18, 24, 'Matematik', 20, 14, 18, 9, 10),
  ('SMK-BALAI-RINGIN', 'SMK Balai Ringin', 'Serian', 156, 79, 88, 5.36, 15, 26, 'Sains', 17, 13, 15, 8, 7),
  ('SMK-TARAT', 'SMK Tarat', 'Serian', 119, 84, 92, 5.04, 7, 18, 'Sejarah', 9, 8, 7, 3, 5),
  ('SMK-TEBEDU', 'SMK Tebedu', 'Serian', 141, 81, 90, 5.22, 10, 23, 'Bahasa Inggeris', 12, 10, 10, 4, 7),
  ('SMK-SADONG-JAYA', 'SMK Sadong Jaya', 'Serian', 88, 72, 84, 5.83, 16, 15, 'Bahasa Melayu', 18, 11, 16, 10, 8),
  ('SMK-SIBURAN', 'SMK Siburan', 'Serian', 176, 86, 93, 4.98, 9, 22, 'Matematik', 11, 9, 9, 4, 6)
on conflict (code) do update set
  name = excluded.name,
  district = excluded.district,
  candidates = excluded.candidates,
  pass_forecast = excluded.pass_forecast,
  attendance_avg = excluded.attendance_avg,
  gpa = excluded.gpa,
  red_count = excluded.red_count,
  amber_count = excluded.amber_count,
  critical_subject = excluded.critical_subject,
  gps_quality_need = excluded.gps_quality_need,
  gps_quantity_need = excluded.gps_quantity_need,
  lms_need_help = excluded.lms_need_help,
  bm_need_help = excluded.bm_need_help,
  sejarah_need_help = excluded.sejarah_need_help,
  updated_at = now();

insert into public.student_risks
  (student_code, name, school_code, risk, issue, intervention, gps_focus, bm_pass, sejarah_pass, attendance_rate)
values
  ('STU-0001', 'Aina L.', 'SMK-GEDONG', 'red', 'Belum lulus Bahasa Melayu dan kehadiran 78%', 'Sesi ibu bapa + mentor akademik', 'LMS', false, true, 78),
  ('STU-0002', 'Daniel A.', 'SMK-SADONG-JAYA', 'red', 'Belum lulus Sejarah', 'Kelas bimbingan Sejarah + pemantauan mingguan', 'LMS', true, false, 84),
  ('STU-0003', 'Rizal J.', 'SMK-BALAI-RINGIN', 'red', 'Ponteng berselang dan Matematik E', 'Ziarah cakna bersama ketua kaum', 'GPS Kuantiti', true, true, 81),
  ('STU-0004', 'Nur F.', 'SMK-TAEE', 'amber', 'Markah Sains menurun 12 mata', 'Latih tubi terarah 4 minggu', 'GPS Kualiti', true, true, 89),
  ('STU-0005', 'Brandon M.', 'SMK-TEBEDU', 'amber', 'Kehadiran 86% dan Bahasa Inggeris rendah', 'Sokongan rakan sebaya + latihan lisan', 'GPS Kuantiti', true, true, 86),
  ('STU-0006', 'Siti R.', 'SMK-SERIAN', 'amber', 'Purata gred sasaran tergelincir', 'Klinik subjek dan semakan sasaran', 'GPS Kualiti', true, true, 92),
  ('STU-0007', 'Aaron K.', 'SMK-TARAT', 'green', 'Perlu kekalkan momentum', 'Set pengayaan SPM', '-', true, true, 95)
on conflict (student_code) do update set
  name = excluded.name,
  school_code = excluded.school_code,
  risk = excluded.risk,
  issue = excluded.issue,
  intervention = excluded.intervention,
  gps_focus = excluded.gps_focus,
  bm_pass = excluded.bm_pass,
  sejarah_pass = excluded.sejarah_pass,
  attendance_rate = excluded.attendance_rate,
  last_reviewed = current_date,
  updated_at = now();

insert into public.intervention_channels
  (owner, action, sort_order)
values
  ('Sekolah', 'Analisis item, kelas mikro, mentor mentee, pemantauan kehadiran harian.', 1),
  ('Ibu bapa', 'Aku janji belajar, semakan jadual ulang kaji, sokongan kehadiran.', 2),
  ('Ketua kaum / penghulu', 'Ziarah komuniti untuk kes kehadiran kritikal dan sokongan keluarga.', 3),
  ('YB / agensi', 'Sokongan logistik, ruang belajar komuniti, bantuan peranti atau pengangkutan.', 4)
on conflict (owner) do update set
  action = excluded.action,
  sort_order = excluded.sort_order,
  updated_at = now();
