-- ================================================================================
-- AL HUNAFA ATTENDANCE - SUPABASE CLOUD DATABASE SCHEMA & SAFE MIGRATION
-- Engine: ZettBOT Core v1.0.0
-- Architecture: Supabase Cloud PostgreSQL + Storage Bucket (Ultra High Performance)
-- ================================================================================
-- Petunjuk Eksekusi:
-- 1. Buka dashboard project Anda di https://supabase.com
-- 2. Pilih menu "SQL Editor" di bilah navigasi kiri.
-- 3. Buat query baru (New Query), tempel seluruh isi skrip ini, lalu klik "RUN".
-- ================================================================================

-- 1. TABEL DATA KARYAWAN & ADMIN
CREATE TABLE IF NOT EXISTS public.karyawan (
    id TEXT PRIMARY KEY,
    nip TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Pegawai', -- 'Admin' atau 'Pegawai'
    jabatan TEXT DEFAULT 'Staff',
    pin TEXT NOT NULL DEFAULT '123456',
    is_active BOOLEAN DEFAULT TRUE,
    foto_url TEXT DEFAULT '',
    email TEXT DEFAULT '',
    username TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL RIWAYAT LOG PRESENSI
CREATE TABLE IF NOT EXISTS public.presensi (
    id TEXT PRIMARY KEY,
    id_karyawan TEXT NOT NULL REFERENCES public.karyawan(id) ON DELETE CASCADE,
    nama_karyawan TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TEXT,
    check_in_status TEXT DEFAULT 'Tepat Waktu',
    check_in_distance NUMERIC,
    check_in_photo TEXT,
    check_out_time TEXT,
    check_out_status TEXT,
    check_out_distance NUMERIC,
    check_out_photo TEXT,
    total_hours TEXT DEFAULT '-',
    lokasi TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_presensi_karyawan_tanggal UNIQUE (id_karyawan, tanggal)
);

-- Index performa tinggi untuk pencarian tanggal & pegawai
CREATE INDEX IF NOT EXISTS idx_presensi_tanggal ON public.presensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_karyawan ON public.presensi(id_karyawan);

-- 3. TABEL PENGAJUAN IZIN, SAKIT, CUTI & LEMBUR
CREATE TABLE IF NOT EXISTS public.pengajuan_izin (
    id TEXT PRIMARY KEY,
    id_karyawan TEXT NOT NULL REFERENCES public.karyawan(id) ON DELETE CASCADE,
    nama_karyawan TEXT NOT NULL,
    jenis TEXT NOT NULL, -- 'Sakit', 'Izin', 'Cuti', 'Lembur'
    tgl_mulai DATE NOT NULL,
    tgl_selesai DATE NOT NULL,
    alasan TEXT NOT NULL,
    bukti_url TEXT DEFAULT '-',
    status TEXT DEFAULT 'Menunggu', -- 'Menunggu', 'Disetujui', 'Ditolak'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_izin_karyawan ON public.pengajuan_izin(id_karyawan);
CREATE INDEX IF NOT EXISTS idx_izin_status ON public.pengajuan_izin(status);

-- 4. TABEL PENGATURAN SISTEM & GEOFENCING
CREATE TABLE IF NOT EXISTS public.config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

-- ================================================================================
-- INISIALISASI DATA AWAL (SEED DATA)
-- ================================================================================

-- Default Pengaturan Kantor & Radius
INSERT INTO public.config (key, value, description)
VALUES 
    ('NAMA_KANTOR', 'Al Hunafa Attendance Center', 'Nama Resmi Lembaga / Kantor'),
    ('ALAMAT_KANTOR', 'Jl. Gempol, RT.003/RW.006, Taman Rahayu, Kec. Setu, Kabupaten Bekasi, Jawa Barat', 'Alamat Titik Presensi'),
    ('LATITUDE_KANTOR', '-6.340000', 'Koordinat Latitude Kantor'),
    ('LONGITUDE_KANTOR', '107.030000', 'Koordinat Longitude Kantor'),
    ('RADIUS_MAKSIMAL_METER', '100', 'Radius Maksimal Presensi Diterima (Meter)'),
    ('JAM_MASUK_STANDAR', '08:00', 'Batas Jam Masuk Tepat Waktu'),
    ('JAM_PULANG_STANDAR', '17:00', 'Batas Jam Pulang Standar')
ON CONFLICT (key) DO NOTHING;

-- Akun Administrator Utama & Contoh Karyawan
INSERT INTO public.karyawan (id, nip, nama, role, jabatan, pin, is_active, foto_url, email, username)
VALUES 
    ('ADM-001', 'admin', 'Administrator', 'Admin', 'Kepala Sekolah / IT Admin', '123456', TRUE, '', 'admin@alhunafa.sch.id', 'admin'),
    ('PEG-001', '19850101', 'Cecep Rahmat', 'Pegawai', 'Guru', '123456', TRUE, '', 'cecep@alhunafa.sch.id', 'cecep'),
    ('PEG-002', '19900202', 'Saiful Majid', 'Pegawai', 'Staff Tata Usaha', '123456', TRUE, '', 'saiful@alhunafa.sch.id', 'saiful'),
    ('PEG-003', '19920303', 'Irwanto', 'Pegawai', 'Guru', '123456', TRUE, '', 'irwanto@alhunafa.sch.id', 'irwanto'),
    ('PEG-004', '19940404', 'M Suryanur', 'Pegawai', 'Staff IT', '123456', TRUE, '', 'suryanur@alhunafa.sch.id', 'suryanur')
ON CONFLICT (nip) DO NOTHING;

-- ================================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS) & POLICY AKSES ANON
-- ================================================================================
ALTER TABLE public.karyawan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengajuan_izin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Izinkan akses read/write melalui Anon Key (Client Side Jamstack)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon Access Karyawan" ON public.karyawan;
    CREATE POLICY "Anon Access Karyawan" ON public.karyawan FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon Access Presensi" ON public.presensi;
    CREATE POLICY "Anon Access Presensi" ON public.presensi FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon Access Izin" ON public.pengajuan_izin;
    CREATE POLICY "Anon Access Izin" ON public.pengajuan_izin FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon Access Config" ON public.config;
    CREATE POLICY "Anon Access Config" ON public.config FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ================================================================================
-- STORAGE BUCKET: attendance-photos (FOTO SELFIE & BUKTI IZIN)
-- ================================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy Storage: Izinkan publik membaca & mengunggah foto selfie
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Read Photos" ON storage.objects;
    CREATE POLICY "Public Read Photos" ON storage.objects FOR SELECT USING (bucket_id = 'attendance-photos');

    DROP POLICY IF EXISTS "Public Upload Photos" ON storage.objects;
    CREATE POLICY "Public Upload Photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance-photos');

    DROP POLICY IF EXISTS "Public Update Photos" ON storage.objects;
    CREATE POLICY "Public Update Photos" ON storage.objects FOR UPDATE USING (bucket_id = 'attendance-photos');
END $$;

