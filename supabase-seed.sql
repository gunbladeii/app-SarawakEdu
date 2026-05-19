insert into public.schools
  (code, name, district, candidates, pass_forecast, attendance_avg, gpa, red_count, amber_count, critical_subject)
values
  ('SMK-SERIAN', 'SMK Serian', 'Serian', 218, 88, 94, 4.91, 11, 28, 'Matematik'),
  ('SMK-TAEE', 'SMK Taee', 'Serian', 96, 77, 89, 5.42, 13, 19, 'Sejarah'),
  ('SMK-TEBAKANG', 'SMK Tebakang', 'Serian', 104, 82, 91, 5.18, 8, 17, 'Bahasa Melayu'),
  ('SMK-GEDONG', 'SMK Gedong', 'Serian', 132, 74, 86, 5.61, 18, 24, 'Matematik'),
  ('SMK-BALAI-RINGIN', 'SMK Balai Ringin', 'Serian', 156, 79, 88, 5.36, 15, 26, 'Sains'),
  ('SMK-TARAT', 'SMK Tarat', 'Serian', 119, 84, 92, 5.04, 7, 18, 'Sejarah'),
  ('SMK-TEBEDU', 'SMK Tebedu', 'Serian', 141, 81, 90, 5.22, 10, 23, 'Bahasa Inggeris'),
  ('SMK-SADONG-JAYA', 'SMK Sadong Jaya', 'Serian', 88, 72, 84, 5.83, 16, 15, 'Bahasa Melayu'),
  ('SMK-SIBURAN', 'SMK Siburan', 'Serian', 176, 86, 93, 4.98, 9, 22, 'Matematik')
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
  updated_at = now();

insert into public.student_risks
  (student_code, name, school_code, risk, issue, intervention, attendance_rate)
values
  ('STU-0001', 'Aina L.', 'SMK-GEDONG', 'red', 'Gagal BM dan kehadiran 78%', 'Sesi ibu bapa + mentor akademik', 78),
  ('STU-0002', 'Daniel A.', 'SMK-SADONG-JAYA', 'red', 'Tidak capai lulus Sejarah', 'Kelas pemulihan mikro + pemantauan mingguan', 84),
  ('STU-0003', 'Rizal J.', 'SMK-BALAI-RINGIN', 'red', 'Ponteng berselang dan Matematik E', 'Ziarah cakna bersama ketua kaum', 81),
  ('STU-0004', 'Nur F.', 'SMK-TAEE', 'amber', 'Markah Sains menurun 12 mata', 'Latih tubi terarah 4 minggu', 89),
  ('STU-0005', 'Brandon M.', 'SMK-TEBEDU', 'amber', 'Kehadiran 86% dan BI rendah', 'Buddy support + latihan lisan', 86),
  ('STU-0006', 'Siti R.', 'SMK-SERIAN', 'amber', 'GPA sasaran tergelincir', 'Klinik subjek dan semakan target', 92),
  ('STU-0007', 'Aaron K.', 'SMK-TARAT', 'green', 'Perlu kekalkan momentum', 'Set pengayaan SPM', 95)
on conflict (student_code) do update set
  name = excluded.name,
  school_code = excluded.school_code,
  risk = excluded.risk,
  issue = excluded.issue,
  intervention = excluded.intervention,
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
