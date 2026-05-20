# MySPMCare Serian

Prototaip awal aplikasi pemantauan prestasi SPM untuk 9 sekolah menengah di daerah Serian, Sarawak.

## Tujuan

- Mengesan awal murid berisiko cicir atau gagal SPM.
- Memberi status lampu isyarat untuk sekolah dan murid.
- Membantu PPD/sekolah merancang intervensi awal bersama ibu bapa, ketua kaum, penghulu, YB dan agensi sokongan.
- Menjadi asas sebelum peluasan ke seluruh Sarawak.

## Reka Bentuk Paparan

- Tajuk kad dan panel menggunakan font Orbitron daripada 1001Fonts untuk memberi rasa digital yang selaras dengan tema MySPMCare.
- Font Orbitron disimpan terus dalam projek di `assets/fonts/` supaya paparan kekal konsisten apabila dibuka pada peranti berbeza.

## Logik Risiko Semasa

Status sekolah dikira daripada tiga isyarat awal:

- Merah (Tindakan Segera): ramalan lulus bawah 78%, kehadiran bawah 87%, atau kadar murid merah melebihi 10%.
- Kuning (Perlu Pemantauan): ramalan lulus bawah 84%, kehadiran bawah 91%, atau kadar murid merah melebihi 6.5%.
- Hijau (Landasan kukuh): berada pada landasan sasaran semasa.

Nilai ini boleh ditukar selepas bengkel bersama PPD dan sekolah.

## Flow GPS dan LMS

Flow MySPMCare memisahkan bantuan murid kepada dua laluan utama:

1. GPS Kualiti: murid yang perlu dibantu untuk menaikkan markah dan memperbaiki purata gred sekolah.
2. GPS Kuantiti: murid yang perlu dipastikan kekal dalam kumpulan lulus supaya jumlah lulus daerah meningkat.
3. LMS: murid yang belum selamat Layak Mendapat Sijil kerana Bahasa Melayu atau Sejarah belum lulus.

Syarat LMS: Bahasa Melayu dan Sejarah mesti lulus. Jika salah satu subjek belum lulus, murid dikira masih memerlukan bantuan LMS.

Medan baharu dalam jadual `schools`:

- `gps_quality_need`
- `gps_quantity_need`
- `lms_need_help`
- `bm_need_help`
- `sejarah_need_help`

Medan baharu dalam jadual `student_risks`:

- `gps_focus`
- `bm_pass`
- `sejarah_pass`

Untuk pangkalan data sedia ada, jalankan `supabase-gps-lms-migration.sql` dahulu, kemudian jalankan semula `supabase-seed.sql` jika mahu memasukkan data contoh GPS/LMS.

## Data Minimum Yang Diperlukan

- Kod sekolah, nama sekolah, daerah, bilangan calon.
- Markah percubaan, TOV, OTI, ETR dan trend ujian berkala.
- Status lulus subjek teras: Bahasa Melayu, Sejarah, Matematik, Sains dan Bahasa Inggeris.
- Kehadiran harian atau purata 30 hari.
- Rekod intervensi, pegawai bertanggungjawab dan tarikh tindakan susulan.
- Tahap libat urus ibu bapa dan komuniti.

## Fasa Seterusnya

1. Sahkan senarai 9 sekolah dan format data sebenar.
2. Tukar data contoh dalam `app.js` kepada import CSV/Google Sheet.
3. Tambah login berperanan: PPD, pengetua, guru kanan, guru kelas dan pegawai intervensi.
4. Simpan rekod intervensi dan status tindakan susulan.
5. Bina laporan daerah, sekolah dan murid untuk mesyuarat berkala.

## Cadangan Tech Stack

Untuk sasaran universal di laptop, desktop dan telefon, pendekatan paling sesuai ialah web app responsif + PWA.

- Frontend: React atau Next.js selepas prototaip ini matang.
- Mobile capability: PWA dengan `getUserMedia` untuk kamera dan modul QR scanner.
- Data awal: Google Sheet/CSV import untuk pilot daerah Serian.
- Data production: PostgreSQL/Supabase atau Firebase, bergantung kepada polisi hosting dan integrasi KPM/JPN.
- Auth: role-based access untuk PPD, sekolah, guru dan pegawai intervensi.
- Deployment: HTTPS wajib untuk kamera pada telefon sebenar.

Prototaip semasa sudah ada `manifest.webmanifest`, `sw.js` dan modul permission kamera sebagai asas PWA.

## Google Auth

Frontend sudah ada butang `Masuk Google`, session detection dan `Keluar` menggunakan Supabase Auth. `config.js` kini menetapkan `requireAuth: true`, jadi dashboard production dikunci sehingga pengguna login.

Setup di Supabase:

1. Pergi ke Authentication > Providers.
2. Aktifkan Google.
3. Masukkan Google OAuth Client ID dan Client Secret.
4. Pergi ke Authentication > URL Configuration.
5. Set Site URL kepada `https://app-sarawakedu.vercel.app`.
6. Tambah Redirect URLs:

```text
https://app-sarawakedu.vercel.app/**
http://localhost:8080/**
https://*-gunbladeiis-projects.vercel.app/**
```

Setup di Google Cloud OAuth:

- Authorized JavaScript origins:
  - `https://app-sarawakedu.vercel.app`
  - `http://localhost:8080`
- Authorized redirect URI:
  - Ambil callback URL daripada halaman Google provider di Supabase.

Selepas login Google berjaya, app akan menggunakan access token pengguna untuk membaca data Supabase.

## Polisi Auth-Only

Fail `supabase-auth-policies.sql` disediakan untuk fasa selepas Google login disahkan berfungsi atau selepas Google provider production siap.

Selepas dijalankan, akses `anon` kepada table dashboard ditutup dan hanya pengguna yang sudah login boleh membaca data melalui REST API Supabase.

## Setup Supabase

Fail yang disediakan:

- `supabase-schema.sql` - struktur Postgres untuk sekolah, murid risiko dan saluran intervensi.
- `supabase-seed.sql` - data contoh yang sama dengan dashboard semasa.
- `config.js` - tempat masukkan URL Supabase dan anon key frontend.

Langkah setup:

1. Buka Supabase project.
2. Pergi ke SQL Editor.
3. Jalankan kandungan `supabase-schema.sql`.
4. Jalankan kandungan `supabase-seed.sql`.
5. Pergi ke Project Settings > API.
6. Salin Project URL dan anon public key ke dalam `config.js`.

Contoh `config.js`:

```js
window.SPM_WATCH_CONFIG = {
  supabaseUrl: "https://PROJECT_ID.supabase.co",
  supabaseAnonKey: "SUPABASE_ANON_PUBLIC_KEY"
};
```

Nota keselamatan: guna anon key sahaja di frontend. Jangan letak service role key dalam aplikasi web.

## Aliran Data Semasa

Frontend akan cuba baca data daripada Supabase melalui REST API:

- `schools`
- `dashboard_student_risks`
- `intervention_channels`

Jika `config.js` belum diisi atau Supabase gagal dicapai, dashboard akan fallback kepada data lokal supaya demo masih berjalan.

## Carta Animasi

Dashboard kini ada seksyen `Carta`:

- Bar chart animasi untuk ramalan lulus setiap sekolah.
- Donut chart animasi untuk komposisi murid risiko merah, kuning dan hijau.
- Carta dijana terus daripada data Supabase/fallback lokal, jadi ia akan ikut data sebenar selepas table dikemas kini.

## Deploy Ke Vercel

Fail deployment:

- `vercel.json` - header production untuk static hosting dan camera permission.
- `.vercelignore` - elak fail SQL, README dan server lokal dihantar sebagai public assets.
- `package.json` - skrip `npm run deploy` dan `npm run deploy:prod`.

Arahan:

```powershell
vercel
vercel --prod
```

Untuk kamera telefon, guna URL HTTPS Vercel. Browser mobile biasanya tidak benarkan kamera pada HTTP biasa kecuali localhost.
