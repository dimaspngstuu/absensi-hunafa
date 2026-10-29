# 🌿 Al Hunafa Attendance — Sistem Presensi Karyawan & Guru

Aplikasi Presensi Mandiri berbasis Web Mobile-First dengan arsitektur **Jamstack Hybrid** (Frontend cepat di Vercel + Database gratis tanpa server di Google Sheets & Google Drive).

Dikembangkan dan dirancang sesuai standar rekayasa sistem **ZettBOT by Zettbos**.

---

## ✨ Fitur Unggulan

- **GPS Geofencing Akurat (Haversine Formula)**: Memvalidasi radius kehadiran pegawai dari titik kantor (maksimal 50 meter).
- **Universal Dual-Fallback Camera**: Mendukung kamera native ponsel (iOS Safari & Android Chrome) serta webcam laptop.
- **Penyimpanan Foto di Google Drive**: Foto selfie presensi (masuk & pulang) serta bukti surat izin/sakit langsung diunggah otomatis ke Google Drive institusi.
- **Perhitungan Jam Kerja Fleksibel**: Otomatis menghitung durasi jam kerja riil pegawai ($\Delta t = \text{Check Out} - \text{Check In}$) tanpa vonis status kaku.
- **Pusat Persetujuan Izin (Admin Approval)**: Admin dapat menyetujui (*Approve*) atau menolak (*Reject*) permohonan izin/sakit langsung dari dashboard.
- **Ekspor Laporan Resmi**:
  - 📄 Cetak Rekapitulasi Presensi PDF dengan Kop Resmi Al Hunafa.
  - 📊 Ekspor berkas murni Microsoft Excel (`.xlsx`) via SheetJS.
- **Tampilan Anti-AI (Human-Crafted Aesthetic)**: Nuansa *Deep Sage Green* yang elegan, responsif di HP maupun laptop, dengan navigasi bawah yang ramah sentuhan jempol.

---

## 🏗️ Arsitektur Jamstack Hybrid

```text
[ Pengguna / Browser ]
        │
        ▼ (HTTPS)
┌─────────────────────────────────┐
│   Vercel Edge Hosting           │
│   (index.html, style.css,       │
│    app.js, vercel.json)         │
└────────────────┬────────────────┘
                 │ Fetch POST (JSON Bridge)
                 ▼
┌─────────────────────────────────┐
│   Google Apps Script Web App    │
│   (code.gs & setup.gs)          │
└────────┬───────────────┬────────┘
         │               │
         ▼               ▼
┌─────────────────┐ ┌─────────────┐
│  Google Sheets  │ │Google Drive │
│  (Database)     │ │(Foto Selfie)│
└─────────────────┘ └─────────────┘
```

---

## 🚀 Panduan Deploy

### 1. Backend: Google Apps Script & Google Sheets
1. Buat Spreadsheet baru di [Google Sheets](https://sheets.new).
2. Buka menu **Ekstensi** > **Apps Script**.
3. Salin isi berkas `code.gs` dan `setup.gs` ke editor Apps Script.
4. Jalankan fungsi `inisialisasiDatabase()` sekali di editor Apps Script untuk membuat lembar database otomatis.
5. Klik **Terapkan (Deploy)** > **Deployment Baru (New Deployment)**:
   - Pilih jenis: **Aplikasi Web (Web App)**.
   - Eksekusi sebagai: **Saya (Akun Google Anda)**.
   - Siapa yang memiliki akses: **Siapa saja (Anyone)**.
6. Salin tautan **Web App URL** yang berakhiran `/exec`.

---

### 2. Frontend: Deploy ke Vercel

#### Cara Paling Mudah (Via GitHub & Dashboard Vercel):
1. Buat repositori baru di [GitHub](https://github.com/new).
2. Buka terminal di folder projek ini, lalu jalankan:
   ```bash
   git init
   git add .
   git commit -m "feat: inisialisasi sistem presensi al hunafa attendance"
   git branch -M main
   git remote add origin https://github.com/<USERNAME-GITHUB-ANDA>/<NAMA-REPO>.git
   git push -u origin main
   ```
3. Buka [Vercel Dashboard](https://vercel.com/dashboard) dan klik **Add New...** > **Project**.
4. Pilih repositori GitHub Anda dan klik **Import**.
5. Biarkan pengaturan default (Framework Preset: **Other**, Root: `./`), lalu klik **Deploy**.
6. Web app Anda langsung aktif dan dapat diakses dari seluruh dunia!

#### Konfigurasi URL Google Apps Script:
Setelah Web App aktif di Vercel:
1. Buka aplikasi di browser.
2. Login sebagai Admin (Default NIP: `1001`, PIN: `123456`).
3. Masuk ke tab **Pengaturan**.
4. Tempelkan tautan **Google Apps Script Web App URL** (`.../exec`) ke kolom yang tersedia dan simpan.

---

## 📁 Struktur Direktori

```text
├── index.html       # Antarmuka utama aplikasi (Single Page Application)
├── style.css        # Desain visual Deep Sage Green (Anti-AI Human Crafted)
├── app.js           # Kontroler client-side & Universal API Bridge ke Google Sheets
├── vercel.json      # Konfigurasi routing & permission headers Vercel (Camera & GPS)
├── code.gs          # Backend Controller Google Apps Script (API & Drive Uploader)
├── setup.gs         # Safe Migration & inisialisasi sheet database
├── prd.md           # Product Requirement Document & Living Context
├── ZettBOT.md       # Lisensi & pedoman rekayasa sistem ZettBOT by Zettbos
└── README.md        # Dokumentasi resmi repositori
```

---

## 🛡️ Lisensi & Hak Cipta

© 2026 Al Hunafa Attendance. Sistem ini dirancang di bawah supervisi rekayasa arsitektur **ZettBOT by Zettbos**.

