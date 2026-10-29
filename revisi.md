# REVISI & PENYEMPURNAAN SISTEM: PERBAIKAN AKSI API & OPTIMASI PERFORMA ANTI-LAG (v2.16.0)
## Projek: Al Hunafa Attendance
Dokumen Rencana & Catatan Eksekusi Revisi Berkelanjutan (by ZettBOT).

Status: **SEDANG DITERAPKAN (v2.16.0 - 29 Oktober 2026)**

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
