# Flow Data Entry MySPMCare

Dokumen ini menjadi rangka kerja sebelum dummy data dashboard diganti dengan rekod sebenar.

## Prinsip

- Data sekolah dan murid dibaca daripada API rujukan semasa diperlukan.
- Senarai rujukan dicache sementara supaya paparan tidak kosong apabila API luar lambat atau gagal seketika.
- Supabase hanya menyimpan rekod kerja: markah, status LMS, GPS, risiko, intervensi dan semakan.
- Nama murid disimpan sebagai snapshot paparan selepas import. API rujukan murid semasa tidak membekalkan nama murid, jadi `student_name` perlu dilengkapkan oleh sekolah untuk kemasukan pertama. Selepas rekod pernah disimpan, nama tersebut akan digunakan semula dalam template berikutnya.
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
2. Sekolah Admin pilih sekolah dan tarik senarai calon SPM daripada API rujukan.
3. Sistem menjana template CSV sekolah yang sudah berisi `cycle_code`, `school_code`, `student_code`, `student_reference`, `class_id` dan `class_name`.
4. Guru penyelaras melengkapkan `student_name` jika masih kosong, kemudian mengisi kehadiran, BM, Sejarah, GPS, risiko, catatan dan intervensi.
5. Sekolah memuat naik semula template yang sama.
6. Sistem padankan rekod menggunakan `student_code` dan `school_code`, kemudian memaparkan preview semakan.
7. Sekolah Admin simpan rekod yang telah melepasi preview.
8. Dashboard daerah membaca view aggregate daripada Supabase.
9. PPD Admin kunci kitaran apabila data rasmi untuk mesyuarat telah dimuktamadkan.

## Rekod Minimum Setiap Murid

| Medan | Tujuan |
|---|---|
| `cycle_code` | Kitaran pemantauan |
| `school_code` | Kod sekolah daripada API rujukan |
| `student_code` | ID murid daripada API rujukan |
| `student_reference` | Petunjuk padanan murid seperti kelas, ID murid dan 4 digit akhir KP |
| `student_name` | Nama murid untuk paparan dashboard; dilengkapkan oleh sekolah jika sumber data tidak membekalkannya |
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
2. Jalankan `supabase-real-data-bootstrap.sql` untuk tambah PPD Admin pertama dan kitaran aktif.
3. Jalankan `supabase-real-data-check.sql` untuk semak table, admin dan kitaran aktif.
4. Jika schema lama sudah wujud, jalankan `supabase-student-name-migration.sql` untuk tambah snapshot nama murid.
5. Buka menu `Kemasukan Data` dalam aplikasi untuk pilih sekolah, tarik calon SPM, muat turun template sekolah, muat naik CSV dan simpan rekod.
6. Selepas data sebenar stabil, frontend boleh ditukar daripada table dummy kepada view `dashboard_real_school_metrics` dan `dashboard_real_student_risks`.
