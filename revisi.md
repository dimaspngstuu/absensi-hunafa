# REVISI & PENYEMPURNAAN SISTEM: REDESIGN HEADER SAPAAN & LIVE DIGITAL CLOCK WIDGET (v2.9.0)
## Projek: Al Hunafa Attendance
Dokumen Rencana & Catatan Eksekusi Revisi Berkelanjutan (by ZettBOT).

Status: **SELESAI DITERAPKAN (v2.9.0 - 29 Oktober 2026)**

---

### 1. Masalah & Kebutuhan Pengguna
1. **Pengajuan Lembur Dihapus Saja**:
   - Menghilangkan fitur formulir pengajuan lembur, perhitungan jam lembur, riwayat lembur pegawai, dan panel approval lembur di admin.
   - Menu *Leave* kembali murni dan fokus untuk pengajuan Izin, Sakit, dan Cuti.
2. **Tampilan iPhone Dihapus (Jadikan Web Standar & Normal)**:
   - Mockup frame fisik iPhone (bezel tebal hitam, Dynamic Island oval hitam, dan status bar jam `20:32` iOS) dihapus total.
   - Antarmuka dijadikan tata letak web modern yang responsif, bersih, dan normal sehingga nyaman diakses di PC/laptop maupun handphone.
3. **Kamera Masih Belum Bisa Aktif**:
   - Pada PC/laptop, constraint kamera depan (`facingMode: "user"`) memicu kegagalan stream (*OverconstrainedError*).
   - Diperlukan mekanisme *Universal Camera Fallback*: mencoba `facingMode: "user"` terlebih dahulu, jika gagal langsung beralih ke stream kamera laptop umum `{ video: true }`, dengan fallback native mobile camera `capture="user"` dan galeri.
4. **Check-In & Check-Out Fleksibel (Tanpa Patokan Jam Sistem, Berbasis Total Jam Kerja)**:
   - Menghapus aturan kaku jam masuk (08:00) dan jam pulang (17:00).
   - Menghilangkan vonis status "Terlambat" atau "Pulang Cepat". Semua presensi tercatat sebagai "Hadir".
   - Patokan utama performa kehadiran adalah **Total Jam Kerja Riil** ($\Delta t = \text{Check Out} - \text{Check In}$) yang dihitung otomatis dan ditampilkan di dashboard, riwayat, dan laporan.

---

### 2. File & Komponen yang Dimodifikasi

1. **`index.html`**:
   - **CSS**:
     * Menghapus border mockup iPhone, shadow tebal casing HP, dan ukuran kaku.
     * Mengatur layout responsif `.device-shell` menjadi web container bersih (maksimal 640px di PC, fluid full-width di HP).
     * Menghapus CSS `.dynamic-island`, `.camera-lens`, `.status-bar`, serta styling kartu lembur `.overtime-item-card`, `.ot-*`.
   - **HTML**:
     * Menghapus elemen Dynamic Island dan iOS Status Bar dari root body.
     * Pada `#viewLeave`: Menghapus tombol switcher sub-tab `segmented-control` dan kontainer `#containerSubTabLembur`. Kontainer formulir izin & sakit `#containerSubTabIzin` kini langsung tampil sebagai form utama.
     * Pada `#viewSettings`: Menghapus kartu approval lembur Admin (`#adminLemburCardsContainer`).
   - **JavaScript**:
     * Mengoptimalkan `startLiveCameraStream()` dengan fallback ganda: `facingMode: "user"` $\rightarrow$ `{ video: true }` untuk memastikan webcam PC/laptop langsung menyala normal.
     * Menghapus seluruh fungsi lembur: `initOvertimeModule()`, `switchLeaveSubTab()`, `initOvertimeDefaultDates()`, `calculateOvertimeDuration()`, `handleLemburSubmit()`, `renderUserLemburHistory()`, `renderAdminLemburCards()`, `updateLemburStatusByAdmin()`.
     * Mengubah status presensi menjadi "Hadir" (tanpa vonis "Terlambat") dan memprioritaskan kalkulasi Total Jam Kerja.

2. **`code.gs`**:
   - `apiSubmitPresensi()`: Menghapus pengecekan batas waktu `JAM_MASUK_STANDAR` dan vonis `statusMasuk = "Terlambat"`. Status masuk selalu tercatat sebagai `"Hadir"`.
   - `apiGetDashboardData()`: Menghilangkan kalkulasi `totalLateMonth`.
   - Membersihkan panggilan ke tab lembur di `apiGetAdminDashboard()` dan menyederhanakan backend controller.

3. **`setup.gs`**:
   - Menjaga inisialisasi database tetap bersih dan idempoten (*Safe Migration*).

---

### 3. Hasil & Verifikasi
- Tampilan web kini tampil normal, profesional, dan bersih tanpa bingkai tiruan iPhone.
- Fitur lembur telah bersih total dari menu Leave dan panel Admin.
- Kamera webcam PC/laptop dan kamera selfie HP dapat aktif dan menjepret foto presensi.
- Jam datang dan pulang fleksibel tanpa cap terlambat, dengan fokus utama pada akumulasi durasi total jam kerja.

---

### 4. Rincian Revisi v2.5.0 (28 Oktober 2026)
1. **Fit 1 Layar Penuh (Zero-Scroll / Lock 100dvh)**:
   - Root `html, body` dan `.device-shell` dikunci ke `height: 100dvh; overflow: hidden;` dengan `overscroll-behavior: none;` untuk meniadakan efek elastis/rubber-band browser mobile.
   - Modal login `#loginModal` dan form `.login-card-surface` menggunakan unit adaptif `clamp()` sehingga header logo, judul, form input PIN, dan tombol Login muat 100% dalam satu bingkai layar tanpa terpotong dan tanpa scrollbar.
   - Komponen dashboard (banner durasi kerja, metric cards, greeting header) dirancang lebih kompak dan proporsional.
2. **Center Alignment Judul Sambutan Login**:
   - Menambahkan `text-align: center;` pada class `.login-heading`, menyelaraskan teks *"Selamat datang di sistem absensi Al Hunafa"* tepat di tengah kartu login.
3. **Persistensi Halaman/Tab Terakhir Saat Di-refresh**:
   - Fungsi `switchNavTab(tabName)` secara otomatis menyimpan tab aktif pengguna ke `localStorage.setItem("alhunafa_active_tab", tabName)`.
   - Event `DOMContentLoaded` dan alur pasca-login secara otomatis membaca `localStorage` tersebut dan memulihkan tab terakhir yang sedang dibuka pengguna, sehingga tidak kembali terpental ke Beranda saat refresh browser (F5 / tarik refresh di HP).

---

### 5. Rincian Revisi v2.6.0 (28 Oktober 2026)
1. **Perbaikan Pencocokan Data Presensi Hari Ini (Cecep Rahmat & Seluruh Pegawai)**:
   - Mengatasi *Timezone Shift Bug* di Google Apps Script: Standarisasi pembacaan tanggal dan jam pada `normalizeDateToYMD_()` dan `formatTimeOnly()` menggunakan `Utilities.formatDate(..., "Asia/Jakarta", ...)` sehingga kebal dari pergeseran zona waktu server Google (UTC / New York).
   - Menambahkan mekanisme pencocokan identitas multi-kunci (*multi-key matcher*): mencocokkan `ID Karyawan`, `NIP`, atau `Nama Lengkap` pada `apiGetDashboardData` dan `apiSubmitPresensi`.
   - Memberikan fallback otomatis pada `apiLogin` jika kolom ID Karyawan di Google Sheets dibiarkan kosong, agar ID pegawai otomatis menggunakan NIP.
2. **Siklus Presensi Harian (Berlaku 1 Hari & Auto-Reset di Hari Baru)**:
   - Data Check In dan Check Out di dashboard hanya berlaku untuk tanggal hari ini (WIB).
   - Pada `loadInitialData()` di `index.html`, jika server mendeteksi belum ada presensi hari ini (atau kalender telah berganti hari), `AppState.todayRecord` secara eksplisit disetel ke `null`.
   - Kartu Check In dan Check Out otomatis ter-reset bersih kembali ke status `"Belum Presensi"` dan jam `"--:--"`, serta banner durasi kerja kembali ke status `"Menunggu Presensi"`.
   - Data hari-hari sebelumnya otomatis tersimpan aman di daftar **Attendance History** (Riwayat Presensi).

---

### 6. Rincian Revisi v2.7.0 (29 Oktober 2026)
1. **Attendance History pada Beranda Dirombak**:
   - Menghilangkan daftar *Attendance History* dari halaman Beranda untuk akun Pegawai agar antarmuka lebih bersih, ringkas, dan fokus pada aksi presensi serta jam kerja harian.
   - Riwayat presensi pribadi dipindahkan secara rapi ke tab **Laporan** (di bawah modul Export & Grafik Performa), sehingga pegawai tetap dapat meninjau log absensi lengkap mereka kapan saja.
2. **Lokalisasi Navigasi Bawah ke Bahasa Indonesia**:
   - Seluruh label teks tombol pada bilah navigasi bawah (*bottom bar*) diperbarui menjadi bahasa Indonesia yang ramah pengguna:
     * `Home` $\rightarrow$ `Beranda`
     * `Analytics` $\rightarrow$ `Laporan`
     * (Tombol Scan Tengah Tetap: `Presensi Sekarang`)
     * `Leave` $\rightarrow$ `Izin`
     * `Settings` $\rightarrow$ `Pengaturan`
3. **Pemberian Jam Real-Time di Frontend & Penghapusan Pin Lokasi Header**:
   - Menghilangkan pill hijau penanda statis `"📍 Kantor Al Hunafa"` pada header atas.
   - Menggantikannya dengan widget jam digital real-time interaktif (`#liveClockDisplay`) yang berdetik setiap detik dengan format `HH:mm:ss WIB` menggunakan icon jam modern dan font angka proporsional (*tabular-nums*).
4. **Live Monitoring Presensi Hari Ini untuk Role Admin**:
   - Khusus ketika pengguna login dengan hak akses `Admin`:
     * Muncul section baru di Beranda bertajuk **"Pemantauan Presensi Hari Ini (LIVE)"** lengkap dengan badge pulsasi hijau dan counter total pegawai yang sudah hadir.
     * Menampilkan feed kartu presensi seluruh karyawan yang telah Check In / Check Out pada hari ini, memuat nama karyawan, jam check in, status sedang bekerja / selesai, jam check out, dan total durasi jam kerja secara transparan untuk pengawasan HRD/Operasional.
     * Untuk role non-admin (Pegawai biasa), section pemantauan ini disembunyikan sepenuhnya.

---

### 7. Rincian Revisi v2.8.0 (29 Oktober 2026)
1. **Akses Modul Laporan & Export Dibuka untuk Pegawai Biasa**:
   - Membuka proteksi role di backend `code.gs` pada fungsi `apiGetFilteredReport()` dari semula terkunci kaku `Admin` menjadi terbuka untuk seluruh user yang memiliki sesi login valid.
   - Jika pengguna ber-role **Pegawai**, backend secara otomatis memfilter dan mengembalikan hanya data presensi miliknya sendiri (berdasarkan ID Karyawan / NIP / Nama Lengkap).
   - Jika pengguna ber-role **Admin**, backend tetap mengembalikan data rekap kehadiran seluruh pegawai.
   - Menghilangkan error merah *"Akses Terlarang: Anda tidak memiliki hak akses Administrator"* sehingga pegawai biasa kini dapat mengunduh berkas Excel (.xlsx) dan Cetak PDF untuk rekap presensinya sendiri.
2. **Pengembalian Riwayat Presensi (*Attendance History*) di Beranda**:
   - Menghadirkan kembali section **Riwayat Presensi** tepat di halaman Beranda (`#viewHome`) di bawah banner durasi kerja untuk mengisi ruang kosong.
   - Menampilkan kartu riwayat dengan tanggal, jam masuk, jam pulang, total durasi jam kerja, dan lokasi kantor beserta tombol toggle *See More / Show Less*.
3. **Fitur Keamanan Time Session: Auto-Logout Inaktivitas 3 Menit**:
   - Menambahkan pelacak aktivitas interaksi pengguna secara menyeluruh (`mousemove`, `mousedown`, `keydown`, `touchstart`, `touchmove`, `scroll`, `click`, `wheel`).
   - Apabila dalam kurun waktu **3 menit (180 detik)** berturut-turut tidak terdeteksi adanya pergerakan pada aplikasi, sistem secara otomatis mengeksekusi *Auto-Logout*:
     * Membersihkan `sessionStorage` sesi dan memanggil `apiLogout()`.
     * Menutup seluruh popup/modal yang terbuka.
     * Mengarahkan kembali ke modal login dan menampilkan pesan notifikasi: *"Sesi berakhir: Tidak ada pergerakan selama 3 menit. Silakan login kembali."*

---

### 8. Rincian Revisi v2.9.0 (29 Oktober 2026)
1. **Penyempurnaan Ukuran & Teks Sapaan "Selamat Datang"**:
   - Memperbesar ukuran font sapaan `.header-greeting` menjadi `15.5px` (font-weight: 600) dan secara eksplisit menampilkan teks sambutan **"Assalamu'alaikum, Selamat Datang"**.
   - Memperbesar nama pegawai `.header-name` menjadi `24px` (font-weight: 800) dengan tata letak yang proporsional dan mudah dibaca.
2. **Penyempurnaan Ukuran & Penempatan Jam Digital Real-Time**:
   - Menghilangkan penempatan jam lama yang semula berdempetan sempit di baris tanggal.
   - Merancang ulang widget jam digital menjadi kartu waktu modern (`.live-clock-card`) di sudut kanan atas header:
     * Label atas: Badge mini `"WAKTU NYATA"` dengan titik hijau berdenyut (*pulse dot*).
     * Waktu digital: Font angka digital berukuran besar (`16.5px`), tebal (`font-weight: 800`), font tabular (*tabular-nums*), dan icon jam SVG proporsional.
     * Tanggal lengkap (`Kamis, 29 Oktober 2026`) kini ditempatkan rapi di sisi kiri di bawah nama pegawai, menciptakan tata letak header yang simetris, berimbang, dan mewah.

---

### 9. Rincian Revisi v2.10.0 (29 Oktober 2026)
1. **Peta Google Maps Resmi (Standard Google Maps Roadmap Tiles)**:
   - Mengganti seluruh layer peta OpenStreetMap (OSM) pada peta Pengaturan Kantor Admin (`#adminInteractiveMap`) dan modal pemilih peta visual (`#pickerInteractiveMap`) menjadi raster tile resmi Google Maps Roadmap (`https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}` dengan subdomain `mt0`, `mt1`, `mt2`, `mt3`, `maxZoom: 20`, dan atribusi `© Google Maps`).
   - Tampilan peta kini 100% identik dengan aplikasi Google Maps asli (skema warna jalan, perumahan, sungai, nama jalan, dan POI resmi Google) dilengkapi custom draggable red pin ala Google Maps.
2. **Pencarian Lokasi Sama Persis dengan Google Maps (Native Google Maps Geocoder Engine)**:
   - Menambahkan API backend `apiSearchGoogleMapsLocation(token, query)` di [code.gs](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/code.gs) yang terintegrasi langsung dengan mesin Google Maps Geocoding resmi (`Maps.newGeocoder().setRegion("id")`).
   - Pencarian tempat seperti *"Al Hunafa"*, nama kantor, sekolah, masjid, gedung, atau nama jalan di Indonesia langsung ditemukan secara akurat layaknya mencari di aplikasi Google Maps.
   - Mendukung berbagai format input:
     * Nama tempat / kata kunci umum (misal: `"Al Hunafa"`, `"Monas"`, `"Gedung Cyber"`)
     * Tautan pendek Google Maps (`maps.app.goo.gl/...` dengan fitur otomatis resolusi redirect header)
     * Tautan URL lengkap Google Maps (`@lat,lon`, `!3d/!4d`, atau `?q=lat,lon`)
     * Format angka koordinat murni (`-6.321, 106.912`)
   - Mendukung penekanan tombol **Enter** pada keyboard untuk langsung mengeksekusi pencarian tanpa harus klik tombol.
3. **Penghapusan / Penyembunyian Riwayat Presensi Khusus Role Admin**:
   - Menghapus/menyembunyikan section **Riwayat Presensi** (`#homeAttendanceHistorySection`) dari halaman Beranda dan `#analyticsPersonalHistorySection` di tab Laporan jika pengguna login sebagai **Administrator**.
   - Admin tidak melakukan presensi, sehingga kartu riwayat absensi pribadi yang kosong dihilangkan sepenuhnya agar antarmuka bersih dan fokus.
   - Admin berfokus penuh pada section **"Pemantauan Presensi Hari Ini (LIVE)"** untuk memantau absensi seluruh staf karyawan yang masuk dan pulang secara real-time.
   - Untuk akun staf/pegawai biasa, section Riwayat Presensi tetap tampil utuh untuk melihat rekap kehadiran pribadinya.

---

### 10. Rincian Revisi v2.11.0 (29 Oktober 2026)
1. **Penambahan Logo Resmi Al Hunafa pada Kop Rekap Laporan**:
   - Memasang logo resmi Al Hunafa (aset yang sama dengan layar login: `https://lh3.googleusercontent.com/d/1SkgbggMKEV_TVQa3YsiLz8GjtoXeRL5M`) di atas judul kop rekapitulasi presensi pada template `#printReportArea`.
   - Menjadikan tata letak dokumen cetak resmi dan proporsional (ukuran tinggi 60px dengan fallback otomatis thumbnail Google Drive jika akses gambar utama terhalang jaringan).
2. **Penghapusan Kolom Status Masuk & Status Pulang pada Rekap Laporan**:
   - Menghapus `<th>Status Masuk</th>` dan `<th>Status Pulang</th>` pada `#printReportTable`.
   - Menghapus data `statusMasuk` dan `statusPulang` pada perulangan cetak tabel di `openPrintPdfReport()`.
   - Tabel cetak PDF kini memiliki 7 kolom yang bersih, padat, dan hemat ruang: `[No | ID Presensi | Nama Pegawai | Tanggal | Check In | Check Out | Total Jam]`.
   - Menyelaraskan fungsi unduh `exportReportToExcel()` agar berkas Excel (.xlsx) juga tidak lagi memuat kolom status masuk & pulang, berfokus murni pada akumulasi Total Jam Kerja riil.
3. **Pengalihan Langsung ke Halaman Beranda Pasca Login**:
   - Pada `handleLoginSubmit()`, sistem dipastikan selalu mengeksekusi `switchNavTab("Home")` dan menyetel `localStorage.setItem("alhunafa_active_tab", "Home")`.
   - Menghilangkan bug di mana user yang sebelumnya logout dari tab Pengaturan (Settings) otomatis terpental kembali ke tab Pengaturan saat login ulang.
   - Pada `logoutUser()`, `handleUnauthorizedSession()`, dan `triggerIdleLogout()`, tab aktif otomatis di-reset ke `"Home"`, sehingga setiap kali masuk akun, layar pertama yang disajikan selalu halaman Beranda presensi.

---

### 11. Rincian Revisi v2.12.0 (29 Oktober 2026)
1. **Tipografi Nama Proporsional Tanpa Kepotong (Anti-Ellipsis)**:
   - Menghapus pemotongan paksa `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` pada `.header-name`.
   - Menerapkan ukuran font dinamis responsif `clamp(17px, 4.6vw, 21px)` dengan `word-break: break-word` dan `line-height: 1.22`.
   - Merampingkan padding dan ukuran font jam digital (`.live-clock-card`), sehingga nama pengguna (seperti `"Adam Mumtaz"` atau `"Administrator"`) tampil utuh, proporsional, dan elegan di layar smartphone.
2. **Pembersihan Modul Absensi Pribadi Khusus Role Admin**:
   - Menyembunyikan kartu Check In & Check Out (`#homeMetricsGrid`) pada akun Admin.
   - Menyembunyikan banner durasi jam kerja (`#workDurationBanner`) pada akun Admin.
   - Menyembunyikan tombol scan kamera melayang di tengah navigasi bawah (`#navCenterScanAction`) pada akun Admin.
   - Bilah navigasi bawah Admin otomatis tertata simetris dengan 4 tab: Beranda, Laporan, Izin, Pengaturan.
   - Halaman Beranda Admin menjadi bersih dan 100% murni difokuskan sebagai **Dashboard Pemantauan Presensi Hari Ini (LIVE)** untuk memonitor kehadiran staf karyawan.
   - Seluruh modul presensi tetap aktif dan utuh untuk akun staf/pegawai biasa.

---

### 12. Rincian Revisi v2.13.0 (29 Oktober 2026)
1. **Pemisahan Tampilan Tab Izin (Admin: Approval Center, Pegawai: Formulir Pengajuan)**:
   - Pada role **Admin**: Formulir pengajuan izin disembunyikan. Menampilkan panel **Persetujuan Izin & Sakit** (`#adminLeaveSection`) yang memuat seluruh kartu pengajuan dari staf karyawan.
   - Admin dapat meninjau data pengajuan: Nama Pegawai, Jenis (Sakit/Izin/Cuti), Periode Tanggal, Keterangan, dan melihat lampiran surat bukti.
   - Menyediakan tombol aksi langsung: **Setujui** (Hijau) dan **Tolak** (Merah) yang terintegrasi langsung dengan database Google Sheets via `apiUpdateStatusIzin`.
2. **Penambahan Fitur Unggah Bukti Surat Sakit / Dokumen untuk Pegawai**:
   - Menambahkan slot upload bukti surat dokter / dokumen pada form pengajuan izin staf (`#leaveProofFileInput`).
   - Mendukung pemilihan file dari galeri maupun jepret foto langsung dari kamera HP.
   - Dilengkapi kotak pratinjau (*preview*) foto dan tombol hapus sebelum dikirim.
   - Berkas bukti otomatis dikonversi dan disimpan ke Google Drive institusi Al Hunafa melalui backend `apiSubmitIzin`.
   - Admin dapat langsung meninjau lampiran foto melalui modal pop-up peninjau bukti (`#proofViewerModal`) atau membuka tautan resmi Google Drive.
3. **Backend Controller Baru `apiGetIzinList` di `code.gs`**:
   - Menambahkan API `apiGetIzinList(token)` untuk melayani pengambilan data izin secara aman bagi Admin (seluruh pengajuan) maupun Pegawai (riwayat pribadi).

---

### 13. Rincian Revisi v2.14.0 (29 Oktober 2026)
1. **Modularisasi Kode Frontend (Arsitektur Standar Google Apps Script)**:
   - Memecah berkas raksasa `index.html` (semula ~5.118 baris) menjadi modul-modul terpisah yang bersih, terstruktur, dan mudah dipelihara:
     * `css.html`: Memuat seluruh sistem desain visual, tema Deep Sage Green, token warna, responsivitas, dan animasi (~1.747 baris).
     * `js.html`: Memuat seluruh logika aplikasi client-side, state management, in-memory cache, GPS Haversine, kontrol kamera, Chart.js, SheetJS export, modal handler, dan listener (~2.531 baris).
     * `index.html`: Merampingkan struktur dokumen HTML murni (~839 baris), menyertakan `<?!= include('css'); ?>` pada `<head>` dan `<?!= include('js'); ?>` sebelum penutup `</body>`.
2. **Dukungan Backend Google Apps Script (`code.gs`)**:
   - Menambahkan fungsi helper `include(filename)` pada [code.gs](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/code.gs) menggunakan `HtmlService.createHtmlOutputFromFile(filename).getContent()`.
   - Memastikan seluruh evaluasi template GAS (`HtmlService.createTemplateFromFile("index").evaluate()`) berjalan lancar saat dideploy ke Web App Google Apps Script.
3. **Kompatibilitas Server Lokal (`server.js`)**:
   - Memperbarui [server.js](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/server.js) dengan pra-pemrosesan regex otomatis untuk tag `<?!= include('...') ?>`.
   - Pengujian dan pengembangan lokal via `node server.js` di `http://localhost:8080` tetap berfungsi 100% tanpa kompilasi tambahan.
4. **Pembaruan Petunjuk Setup (`setup.gs`)**:
   - Menyesuaikan panduan deployment di [setup.gs](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/setup.gs) agar pengguna menyalin `setup.gs`, `code.gs`, `index.html`, `css.html`, dan `js.html` ke editor Apps Script.

---

### 14. Rincian Revisi v2.15.0 (29 Oktober 2026)
1. **Arsitektur Jamstack Hybrid (Vercel Frontend + Google Sheets & Drive Backend)**:
   - Memungkinkan aplikasi dideploy ke **Vercel** untuk kecepatan akses instan, SSL gratis, dan custom domain, sementara seluruh data (Presensi, Karyawan, Izin, Riwayat, Foto Selfie) **tetap 100% tersimpan ke Google Sheets & Google Drive**.
2. **Universal API Bridge (`app.js`)**:
   - Mengimplementasikan polyfill `createUniversalGasRunner()` yang otomatis memotong pemanggilan `google.script.run.*`.
   - Mengirimkan data via HTTP `fetch(POST)` ke URL Web App Google Apps Script dengan header `Content-Type: text/plain;charset=utf-8` untuk melewati batasan browser CORS preflight (`OPTIONS`).
   - Menyediakan fungsi `getGasApiUrl()` dan `setGasApiUrl(newUrl)` dengan penyimpanan lokal `localStorage.getItem("alhunafa_gas_api_url")`.
3. **Ekstraksi Aset Statis untuk Vercel**:
   - Menghasilkan file statis murni `style.css` (dari `css.html`) dan `app.js` (dari `js.html`).
   - Menyelaraskan [index.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/index.html) dengan tag `<link rel="stylesheet" href="style.css">` dan `<script src="app.js"></script>` dengan fallback `<?!= include(...) ?>` jika dijalankan di dalam ekosistem GAS.
4. **Input Konfigurasi URL Google Sheets di Pengaturan Admin**:
   - Menambahkan input field `#adminGasApiUrlInput` pada kartu pengaturan Admin di [index.html](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/index.html).
   - Admin dapat menempelkan URL Web App Google Apps Script kapan saja langsung melalui antarmuka web tanpa perlu mengubah kode sumber.
5. **Konfigurasi Vercel Standar (`vercel.json`)**:
   - Dibuat berkas `vercel.json` dengan pengaturan `cleanUrls`, SPA route fallback ke `/index.html`, serta header `Permissions-Policy: camera=*, geolocation=*` untuk menjamin izin kamera dan GPS berfungsi normal di Vercel.
6. **Perluasan API Controller di `code.gs`**:
   - Memperluas fungsi `doPost(e)` di [code.gs](file:///c:/Users/dimas/.gemini/antigravity-ide/project/absensi_pegawai/code.gs) untuk merespons seluruh operasi sistem: `login`, `getDashboard`, `submitPresensi`, `submitIzin`, `updateStatusIzin`, `getIzinList`, `getFilteredReport`, `saveConfig`, `searchGoogleMapsLocation`, `submitLembur`, `updateStatusLembur`, `updatePassword`, `updateProfilePhoto`, dan `logout`.
   - Menambahkan pengenal otomatis ID Spreadsheet fallback (`SPREADSHEET_ID`) jika dieksekusi sebagai Standalone script.
