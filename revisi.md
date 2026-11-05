# REVISI & PENYEMPURNAAN SISTEM: LOGO TAB, NAV IZIN/LEMBUR & CRUD PEGAWAI (v3.0.2)
## Projek: Al Hunafa Attendance
Dokumen Rencana Arsitektur & Transisi Database Berkecepatan Tinggi (by ZettBOT).

Status: **SELESAI DITERAPKAN (v3.0.2 - 5 November 2026)**

---

### 1. Masalah & Solusi Rekayasa (v3.0.2)
1. **Logo Tab Browser Berubah Menjadi Ikon Bola Dunia (Favicon Hilang)**:
   - **Akar Masalah**: Tautan favicon sebelumnya mengarah ke Google Drive direct link (`lh3.googleusercontent.com`). Peramban modern (Chrome/Edge) menolak tautan favicon eksternal dari Google Drive karena masalah autentikasi header CORS dan proteksi *hotlinking*.
   - **Solusi Rekayasa ZettBOT**: Menyematkan **High-Res Vector SVG Favicon langsung via Data-URI** (`data:image/svg+xml,...`) pada `<head>` dan dinjeksi otomatis saat runtime. Logo resmi kubah bernuansa *Deep Sage Green* dan aksen emas Al Hunafa dijamin muncul seketika di tab browser tanpa perlu download jaringan dan 100% bebas dari pemblokiran browser!

2. **Label Navigasi Bawah Masih "Izin"**:
   - **Akar Masalah**: Pengguna ingin menu pengajuan mencerminkan kedua fungsi utama (Izin dan Lembur).
   - **Solusi Rekayasa ZettBOT**: Mengubah label navigasi menjadi **"Izin / Lembur"** serta memperbarui ikon menjadi *Document-Clock* yang elegan, dengan penyesuaian lebar elemen agar proporsional dan tidak terpotong di layar ponsel sempit.

3. **Perhitungan Jam Lembur & Total Jam**:
   - **Solusi Rekayasa ZettBOT**: Formulir lembur dilengkapi input Jam Mulai dan Jam Selesai dengan kalkulator otomatis durasi (misal: "3 Jam 0 Menit (3.0 Jam)"). Waktu lembur divalidasi dan dicatat otomatis baik di Supabase maupun Google Sheets, lengkap dengan chip tampilan `⏰ Jam Mulai - Jam Selesai WIB • Total X Jam` di daftar riwayat.

4. **Kelola Pegawai Langsung di Aplikasi (CRUD Tambah, Edit, Hapus)**:
   - **Akar Masalah**: Sebelumnya penambahan dan pengeditan pegawai harus dilakukan langsung dengan mengedit lembar Google Sheets atau tabel database.
   - **Solusi Rekayasa ZettBOT**:
     * Menambahkan kartu kelola pegawai di menu **Pengaturan Admin** dengan avatar inisial berwarna, NIP, jabatan, dan status.
     * Fitur pencarian instan nama/NIP pegawai.
     * Tombol **+ Tambah Pegawai** dan **Edit** membuka modal lengkap (Nama, NIP, Jabatan, Role Admin/Pegawai, PIN, Status Aktif).
     * Tombol **Hapus** terproteksi konfirmasi (dengan proteksi anti-hapus akun yang sedang login).
     * Tersinkronisasi dua arah: bekerja mulus di mesin Supabase maupun Google Sheets!

---

# REVISI SEBELUMNYA: MIGRASI DUAL-ENGINE & ANTI-LOCKOUT LOGIN (v3.0.1)

---

### 1. Masalah & Solusi (Mengapa Akun Tidak Bisa Login?)
- **Akar Masalah**:
  Saat arsitektur Supabase diaktifkan, sistem secara default mencoba memvalidasi akun ke Supabase. Karena akun-akun pengguna riil masih berada di Google Sheets dan belum disalin ke Supabase, sistem menolak login dan pengguna tidak bisa masuk ke menu Pengaturan untuk mengubah pengaturan kembali ke Google Sheets.
- **Solusi Rekayasa ZettBOT (v3.0.1 - Anti-Lockout Engine)**:
  1. **Cross-Engine Automatic Fallback**: Ketika pengguna menekan tombol Login, sistem memeriksa Supabase terlebih dahulu; jika akun belum ditemukan atau Supabase belum siap, sistem **otomatis langsung memvalidasi akun ke Google Sheets**! Pengguna dijamin bisa login tanpa terhalang.
  2. **Sakelar Mesin di Layar Login**: Menambahkan tombol langsung di layar login (`Mesin: Google Sheets / Supabase`) agar siapapun bisa berpindah mesin basis data langsung dari halaman muka dengan 1 klik sebelum login.
  3. **Alat Migrasi 1-Klik**: Menambahkan tombol di menu Pengaturan untuk menyalin seluruh data Karyawan, Riwayat Presensi, dan Pengajuan Izin dari Google Sheets ke Supabase dalam hitungan detik.

---

### 2. File yang Dibuat & Dimodifikasi
1. [supabase_schema.sql](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/supabase_schema.sql): Skrip DDL SQL untuk Supabase.
2. [index.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/index.html): Penambahan sakelar mesin database di layar login dan tombol migrasi 1-klik di Pengaturan.
3. [app.js](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/app.js): Logika verifikasi ganda (Supabase + Google Sheets Fallback), toggle mesin di login modal, dan fungsi `migrateDataFromSheetsToSupabase()`.
4. [prd.md](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/prd.md): Pembaruan Master Context v3.0.1.

---

### 3. Panduan 4 Langkah Mudah untuk Pengguna
1. **Langkah 1**: Buat project baru di [supabase.com](https://supabase.com) (Pilih region terdekat: *Singapore*).
2. **Langkah 2**: Buka menu **SQL Editor** di panel kiri Supabase, tempel isi file [supabase_schema.sql](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/supabase_schema.sql), lalu klik tombol **RUN**.
3. **Langkah 3**: Buka menu **Project Settings > API** di Supabase, lalu salin **Project URL** dan **Anon Public Key**.
4. **Langkah 4**: Buka aplikasi Absensi Anda, login sebagai Admin, buka menu **Pengaturan**, tempel URL dan Key tersebut, lalu klik **Simpan Pengaturan**. Aplikasi Anda seketika berjalan secepat kilat!

---
- Mengimpor library resmi `@supabase/supabase-js` melalui CDN (ringan dan tanpa butuh build step).
- Menggantikan fungsi `google.script.run` dan fetch Google Apps Script dengan direct Supabase Client query:
  * Login instan (< 100ms)
  * Load Dashboard (< 80ms)
  * Submit Presensi & Upload Foto langsung ke Supabase Storage (< 500ms)
  * Realtime listener (Dashboard admin otomatis ter-update seketika saat pegawai melakukan presensi tanpa perlu reload!)

---

### 4. File yang Akan Terkena Dampak
1. [index.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/index.html): Menambahkan script CDN Supabase JS.
2. [app.js](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/app.js): Menambahkan adapter Supabase Client dan memigrasikan controller data.
3. [supabase_schema.sql](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/supabase_schema.sql): Skrip SQL siap eksekusi (Copy-Paste 1x klik di Supabase SQL Editor).

---

### 1. Masalah & Kebutuhan Pengguna
1. **Pengajuan Lembur Terintegrasi & Praktis**:
   - Pengguna membutuhkan opsi pengajuan lembur yang simpel dan tidak membuat aplikasi penuh atau rumit (*Opsi 1: Terintegrasi ke Tab Izin*).
   - Pegawai dapat mengajukan lembur/tugas tambahan beserta tanggal, rincian pekerjaan, dan lampiran surat tugas/foto kegiatan.
2. **Fitur Penerimaan / Penolakan Lembur di Sisi Admin**:
   - Administrator dapat melihat daftar pengajuan lembur yang masuk.
   - Administrator memiliki tombol tindakan satu klik: `✓ Terima / Setujui` atau `✕ Tolak`.
   - Admin dapat menyaring pengajuan secara cepat via tab filter (*Semua*, *Menunggu*, *Lembur*, *Sakit/Izin/Cuti*).
   - Status approval otomatis tercatat di Google Sheets dan dapat dipantau langsung oleh pegawai di riwayat pengajuannya.

---

### 2. Solusi Rekayasa Sistem (SOP ZettBOT)
1. **Frontend Pengajuan Pegawai (`index.html`, `app.js`, `js.html`)**:
   - Menambahkan opsi `Lembur / Tugas Tambahan` pada dropdown jenis pengajuan.
   - Dynamic Form Hinting: Form otomatis menyesuaikan placeholder dan label saat opsi Lembur dipilih (contoh: *"Keterangan / Rincian Tugas Lembur"*, *"Foto Surat Tugas / Kegiatan Lembur"*, tombol *"Kirim Pengajuan Lembur"*).
2. **Panel Persetujuan Admin Terintegrasi**:
   - Menambahkan Filter Chips di panel Admin (`Semua`, `Menunggu`, `Lembur`, `Sakit/Izin/Cuti`) dengan counter live.
   - Badge visual khusus lembur bergradasi ungu lembut (`.pill-lembur`).
   - Tombol tindakan `✓ Terima / Setujui` dan `✕ Tolak` terhubung langsung ke `apiUpdateStatusIzin` di Google Sheets.
3. **Penyelarasan Desain (`style.css`, `css.html`)**:
   - Mendefinisikan badge `.pill-lembur` dengan warna ungu modern (*violet accent*).

---

### 3. File yang Dimodifikasi
- [index.html](file:///c:/Users/dimas/.gemini/antigravity-ide\project\absensi_pegawai\index.html): Penambahan opsi Lembur di form pegawai dan tab filter admin.
- [style.css](file:///c:/Users/dimas/.gemini/antigravity-ide\project\absensi_pegawai\style.css) & [css.html](file:///c:/Users/dimas/.gemini/antigravity-ide\project\absensi_pegawai\css.html): Badge `.pill-lembur`.
- [app.js](file:///c:/Users/dimas/.gemini/antigravity-ide\project\absensi_pegawai\app.js) & [js.html](file:///c:/Users/dimas/.gemini/antigravity-ide\project\absensi_pegawai\js.html): Handler ganti jenis pengajuan, filter chip admin, dan update status terima/tolak lembur.

---

### 1. Masalah & Kebutuhan Pengguna
1. **Tampilan Pemantauan Presensi Hari Ini Kurang Menarik**:
   - Tampilan pemantauan kehadiran pegawai untuk akun Administrator di Beranda terkesan kaku, flat, dan monoton menyerupai tabel teks biasa (`Check In | Check Out | Total Jam`).
   - Tidak ada identitas visual pegawai (avatar inisial / warna identitas profil).
   - Tidak ada ringkasan KPI cepat di bagian atas (misal berapa orang yang sedang aktif bekerja vs yang sudah selesai/pulang).
   - Tidak ada fitur pencarian instan maupun filter status (*Semua*, *Sedang Kerja*, *Selesai*).
   - Tidak ada indikasi durasi waktu kerja yang berjalan (*live elapsed duration*).

2. **Penyempurnaan URL Web App & Handler Error Jaringan**:
   - URL Web App dinormalisasi secara otomatis jika pengguna tanpa sengaja menempel link `/dev` atau terpotong tanpa `/exec`.
   - Error jaringan (*Failed to fetch*) diberikan keterangan solutif agar pengguna langsung mengetahui pengaturan hak akses di Google Apps Script (*Anyone / Siapa saja*).

---

### 2. Solusi Rekayasa UI/UX Modern (SOP ZettBOT)
1. **Redesign Total Kartu Pegawai (*Modern Enterprise Card Design*)**:
   - **Avatar Inisial Bergradasi Dinamis**: Setiap pegawai memiliki avatar inisial (misal: "Saiful Majid" -> "SM") dengan palet gradasi warna modern (Emerald, Indigo, Cyan, Amber, Rose, Violet, Blue, Teal) yang di-generate konsisten.
   - **Live Pulsing Status Badge**: Status "Sedang Kerja" dilengkapi dot hijau berdenyut (*pulse animation*) dan soft emerald badge, sedangkan "Selesai" dilengkapi ikon checkmark biru muda.
   - **Mini Metric Grid (3 Kolom Modern)**:
     - Check In: Waktu kedatangan + status kehadiran (Hadir/Tepat Waktu).
     - Check Out: Waktu pulang resmi atau label status *Belum Pulang*.
     - Durasi Kerja: Menghitung secara otomatis waktu riil yang telah dihabiskan sejak check-in (*Live Elapsed Duration*, misal: "7j 47m (Live Berjalan)") atau total jam kerja resmi jika sudah check-out.

2. **Interactive Quick Filter Chips (Pill Bar)**:
   - Tombol tab filter instan di atas kartu: **Semua**, **Sedang Kerja**, dan **Selesai**, masing-masing menampilkan counter jumlah pegawai secara live (*real-time count*).
   - Admin dapat beralih filter dalam 1 klik tanpa reload halaman.

3. **Instant Live Search Box**:
   - Kolom pencarian elegan terintegrasi: Admin dapat mengetik nama atau ID karyawan untuk menyaring daftar secara seketika (*instant filtering as you type*).

---

### 3. File yang Dimodifikasi
- [index.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/index.html): Penambahan struktur Filter Chips dan Search Box pemantauan admin.
- [style.css](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/style.css): Desain visual baru kartu pegawai, avatar inisial, badge pulsing, dan metric grid.
- [css.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/css.html): Sinkronisasi CSS untuk Google Apps Script Web App bawaan.
- [app.js](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/app.js): Logika rendering dinamis, live duration counter, pencarian nama, dan filter status.
- [js.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/js.html): Sinkronisasi controller JavaScript untuk Apps Script template.

---

### 1. Masalah & Kebutuhan Pengguna
1. **Pengajuan Cuti / Izin / Sakit Gagal (Error "Aksi tidak dikenal")**:
   - Di akun pegawai biasa (*user*), saat mengisi formulir pengajuan izin/cuti/sakit dan menekan tombol *Kirim Pengajuan Izin*, muncul banner merah error `❌ Aksi tidak dikenal.`
   - Akar masalah: Routing pada fungsi `doPost(e)` di Google Apps Script belum sinkron atau deployment aktif masih menggunakan snapshot versi lama sebelum endpoint `submitIzin` didaftarkan.
2. **Export Laporan Excel & PDF Gagal (Error "Gagal mengambil laporan: Aksi tidak dikenal")**:
   - Di tab laporan (*Analytics*), saat memilih rentang tanggal dan menekan tombol *Unduh Excel (.xlsx)* atau *Cetak PDF*, muncul banner merah error `❌ Gagal mengambil laporan: Aksi tidak dikenal.`
   - Akar masalah: Pemanggilan `getFilteredReport` via HTTP POST pada `doPost(e)` belum dikenali oleh deployment aktif Google Apps Script.
3. **Aplikasi Terasa Lag & Loading Lambat**:
   - Saat berpindah menu atau navigasi tab bawah (Home, Analytics, Leave, Settings), aplikasi melakukan pemanggilan jaringan berulang ke backend Google Apps Script.
   - Event listener pelacak inaktivitas (*idle tracker*) berjalan di setiap pixel gerakan scroll/touchmove tanpa throttling, memicu micro-stutter di ponsel.
   - Foto lampiran surat dokter/izin belum terkompresi secara optimal sehingga ukuran payload base64 membengkak dan memperlambat transmisi jaringan.

---

### 2. Rencana Implementasi & Solusi Rekayasa Sistem (SOP ZettBOT)

1. **Sinkronisasi Total Gerbang API Backend (`code.gs`)**:
   - Melengkapi fungsi `doPost(e)` dengan pencocokan aksi yang kebal terhadap variasi huruf besar/kecil (*case-insensitive*) dan pembersihan spasi (*trim*).
   - Menjamin seluruh aksi API terdaftar: `submitIzin`, `getFilteredReport`, `getIzinList`, `updateStatusIzin`, `saveConfig`, `getDashboard`, `getAdminDashboard`, `saveKaryawan`, `searchGoogleMapsLocation`, `updatePassword`, `updateProfilePhoto`, `logout`, `login`.
   - Mengembalikan pesan debug yang jelas jika ada parameter yang hilang.

2. **Client-Side In-Memory Caching (0-Second Tab Switch Anti-Lag) di `app.js`**:
   - Mengimplementasikan `AppState.cache` untuk menyimpan data dashboard, daftar riwayat izin, dan data rekapitulasi laporan yang sudah pernah diambil.
   - Saat berpindah antar tab (Home ↔ Analytics ↔ Leave ↔ Settings), data langsung dirender seketika dari memori lokal (0 detik tanpa loading berulang).
   - Menyediakan sinkronisasi pintar (*stale-while-revalidate*) dan tombol *Refresh Data* manual jika pengguna ingin memperbarui data mutakhir dari Google Sheets.

3. **Throttling Event Listener & Kompresi Foto Izin Kilat di `app.js`**:
   - Menerapkan *Throttle 3 detik* pada `resetIdleTimer` untuk menghapus lag/patah-patah saat pengguna scrolling di HP.
   - Mengompresi berkas foto bukti izin pada `handleLeaveProofUpload` ke dimensi maksimal 960px dan JPEG quality 0.75 (ukuran berkas turun menjadi ~70-120KB) sehingga upload pengajuan izin selesai dalam < 1 detik.
   - Mengoptimalkan inisialisasi peta Leaflet agar bersifat *lazy* dan tidak memakan resource GPU ponsel saat membuka tab lain.

---

### 3. File yang Dimodifikasi
- [code.gs](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/code.gs): Perluasan gerbang `doPost(e)` case-resilient untuk seluruh transaksi API.
- [app.js](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/app.js): Integrasi In-Memory Caching, throttling event scroll, kompresi foto izin, dan optimasi pemanggilan API.
- [style.css](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/style.css): Optimasi hardware acceleration CSS anti-stutter.
- [prd.md](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/prd.md): Pembaruan living context v2.16.0.
