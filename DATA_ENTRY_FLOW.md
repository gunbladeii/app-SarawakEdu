# Flow Data Entry MySPMCare

Dokumen ini menjadi rangka kerja sebelum dummy data dashboard diganti dengan rekod sebenar.

## Prinsip

- Data sekolah dan murid dibaca daripada API rujukan semasa diperlukan.
- Supabase hanya menyimpan rekod kerja: markah, status LMS, GPS, risiko, intervensi dan semakan.
- Nama penuh murid tidak perlu disimpan dalam Supabase untuk fasa awal. Simpan `student_code` dan `school_code`; paparan nama boleh dipadankan semula melalui API.
- Setiap kemasukan data mesti berada dalam satu kitaran pemantauan, contohnya `Ujian 1 2026`, `Percubaan SPM 2026` atau `Semakan Intervensi 1`.

## Peranan Akses

| Peranan | Skop | Tindakan |
|---|---|---|
| PPD Admin | Semua 9 sekolah | Buka kitaran data, lihat daerah, semak semua sekolah, urus akses pengguna |
| Sekolah Admin | Sekolah sendiri | Muat naik data sekolah, semak rekod, sahkan data sekolah |
| Guru Mata Pelajaran | Sekolah sendiri | Kemas kini markah subjek dan status lulus |
| Guru Kelas | Sekolah sendiri | Kemas kini kehadiran, kelas, risiko dan GPS |
| Kaunselor | Sekolah sendiri | Kemas kini intervensi, isu murid dan status susulan |
| Viewer | Ikut akses diberi | Lihat dashboard sahaja |

## Aliran Kerja

1. PPD Admin buka kitaran pemantauan.
2. Sekolah Admin tarik senarai calon SPM daripada API rujukan untuk semakan.
3. Sekolah muat naik template Excel/CSV atau isi secara manual.
4. Sistem padankan rekod menggunakan `student_code` dan `school_code`.
5. Guru menyemak data yang gagal dipadankan atau tidak lengkap.
6. Sekolah Admin sahkan data sekolah.
7. Dashboard daerah membaca view aggregate daripada Supabase.
8. PPD Admin kunci kitaran apabila data rasmi untuk mesyuarat telah dimuktamadkan.

## Rekod Minimum Setiap Murid

| Medan | Tujuan |
|---|---|
| `cycle_code` | Kitaran pemantauan |
| `school_code` | Kod sekolah daripada API rujukan |
| `student_code` | ID murid daripada API rujukan |
| `class_id`, `class_name`, `form_code` | Padanan kelas dan Tingkatan 5 |
| `attendance_rate` | Purata kehadiran terkini |
| `bm_pass`, `sejarah_pass` | Penentu LMS |
| `bm_score`, `sejarah_score` | Markah sokongan untuk intervensi |
| `current_gpa`, `target_gpa` | Asas GPS Kualiti |
| `gps_quality_need`, `gps_quantity_need` | Fokus bantuan GPS |
| `risk` | Kod risiko Merah, Kuning atau Hijau |
| `critical_subject` | Subjek utama yang perlu diberi perhatian |

## Table Baharu

| Table | Fungsi |
|---|---|
| `app_user_access` | Peranan pengguna dan skop sekolah |
| `assessment_cycles` | Kitaran data dashboard |
| `data_import_batches` | Jejak muat naik Excel/CSV |
| `student_monitoring_records` | Rekod ringkas setiap murid untuk dashboard |
| `student_subject_results` | Rekod markah subjek jika kemasukan dibuat mengikut subjek |
| `student_intervention_records` | Rekod tindakan susulan dan intervensi |

## View Dashboard

| View | Fungsi |
|---|---|
| `dashboard_real_school_metrics` | Ringkasan sekolah untuk kad dan carta dashboard |
| `dashboard_real_student_risks` | Senarai murid yang perlu perhatian dan intervensi |

## Cara Mula

1. Jalankan `supabase-real-data-schema.sql` di Supabase SQL Editor.
2. Tambah PPD Admin pertama di SQL Editor.
3. Cipta satu kitaran aktif, contohnya `SPM-2026-PERCUBAAN`.
4. Guna template `templates/student-monitoring-template.csv` untuk ujian import.
5. Selepas data sebenar stabil, frontend boleh ditukar daripada table dummy kepada view `dashboard_real_school_metrics` dan `dashboard_real_student_risks`.
