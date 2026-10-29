# REVISI & PENYEMPURNAAN SISTEM: PEMANTAUAN PRESENSI LIVE & API ENGINE (v2.17.0)
## Projek: Al Hunafa Attendance
Dokumen Rencana & Catatan Eksekusi Revisi Berkelanjutan (by ZettBOT).

Status: **SELESAI DITERAPKAN (v2.17.0 - 29 Oktober 2026)**

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
