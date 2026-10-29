/**
 * ================================================================================
 * AL HUNAFA ATTENDANCE - SETUP DATABASE & SAFE MIGRATION
 * Engine: ZettBOT Core v1.0.0
 * ================================================================================
 * Petunjuk:
 * 1. Buka spreadsheet Google Sheets tempat data ingin disimpan.
 * 2. Buka menu Extensions (Ekstensi) > Apps Script.
 * 3. Salin berkas setup.gs, code.gs, index.html, css.html, dan js.html ke dalam project Apps Script.
 * 4. Jalankan fungsi setupDatabase() satu kali untuk menginisialisasi seluruh tab & data awal.
 *
 * Catatan Rekayasa Sistem:
 * - Tab sheet TIDAK menggunakan karakter underscore (_) sesuai aturan baku ZettBOT.
 * - Bersifat IDEMPOTEN & AMAN: Jika tab sudah ada, data lama TIDAK AKAN terhapus/ditimpa.
 */

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var propId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (propId) {
      try {
        ss = SpreadsheetApp.openById(propId);
      } catch (e) {
        Logger.log("Error membuka Spreadsheet via ID: " + e.message);
      }
    }
  }
  if (!ss) {
    Logger.log("Error: Script harus terhubung dengan Google Sheets yang aktif.");
    return { success: false, message: "Spreadsheet aktif tidak ditemukan. Pastikan membuka dari Ekstensi > Apps Script di Google Sheets Anda." };
  }

  // Kunci zona waktu spreadsheet ke Asia/Jakarta (WIB)
  try {
    ss.setSpreadsheetTimeZone("Asia/Jakarta");
  } catch (eTimezone) {
    Logger.log("Info: Timezone spreadsheet tidak dapat diset otomatis: " + eTimezone.message);
  }

  // 1. Inisialisasi Tab DataKaryawan (Kosong, siap diisi data pegawai riil Anda)
  var headersKaryawan = [
    "ID Karyawan",   // COL 0
    "NIP",           // COL 1
    "Nama Lengkap",  // COL 2
    "Role",          // COL 3 (Admin / Pegawai)
    "Jabatan",       // COL 4
    "PIN",           // COL 5
    "Status Aktif",  // COL 6 (Aktif / Nonaktif)
    "Foto Profil",   // COL 7
    "Email",         // COL 8
    "Username"       // COL 9
  ];
  var dummyKaryawan = [];
  createOrMigrateSheet(ss, "DataKaryawan", headersKaryawan, dummyKaryawan);

  // 2. Inisialisasi Tab LogPresensi (Kosong, siap menerima riwayat presensi riil)
  var headersPresensi = [
    "ID Presensi",        // COL 0
    "ID Karyawan",        // COL 1
    "Nama Karyawan",      // COL 2
    "Tanggal",            // COL 3 (YYYY-MM-DD)
    "Waktu Masuk",        // COL 4 (HH:mm:ss)
    "Status Masuk",       // COL 5 (Tepat Waktu / Terlambat)
    "Jarak Masuk (m)",    // COL 6
    "Foto Masuk URL",     // COL 7
    "Waktu Pulang",       // COL 8 (HH:mm:ss)
    "Status Pulang",      // COL 9 (Tepat Waktu / Pulang Cepat)
    "Jarak Pulang (m)",   // COL 10
    "Foto Pulang URL",    // COL 11
    "Total Jam Kerja",    // COL 12 (HH:mm)
    "Lokasi Catatan"      // COL 13
  ];
  var dummyPresensi = [];
  createOrMigrateSheet(ss, "LogPresensi", headersPresensi, dummyPresensi);

  // Format kolom Tanggal & Waktu sebagai Teks Murni (@) agar kebal pergeseran serial date 1899
  try {
    var shPresensi = ss.getSheetByName("LogPresensi");
    if (shPresensi) {
      shPresensi.getRange("D2:E").setNumberFormat("@");
      shPresensi.getRange("I2:I").setNumberFormat("@");
      shPresensi.getRange("M2:M").setNumberFormat("@");
    }
  } catch (eFormat) {
    Logger.log("Info format plain text: " + eFormat.message);
  }

  // 3. Inisialisasi Tab PengaturanSistem (Parameter Konfigurasi Dasar Sistem)
  var headersPengaturan = [
    "Kunci Pengaturan",  // COL 0
    "Nilai Pengaturan",  // COL 1
    "Keterangan"         // COL 2
  ];
  var dummyPengaturan = [
    ["NAMA_KANTOR", "Al Hunafa Attendance Center", "Nama Lembaga / Kantor"],
    ["ALAMAT_KANTOR", "Kantor Al Hunafa", "Label Lokasi Tampilan Header"],
    ["LATITUDE_KANTOR", "-6.175392", "Garis Lintang Titik Kantor"],
    ["LONGITUDE_KANTOR", "106.827153", "Garis Bujur Titik Kantor"],
    ["RADIUS_MAKSIMAL_METER", "50", "Radius Maksimal Presensi Valid (Meter)"],
    ["GOOGLE_DRIVE_FOLDER_NAME", "Al Hunafa Attendance Photos", "Nama Folder Khusus di Google Drive"]
  ];
  createOrMigrateSheet(ss, "PengaturanSistem", headersPengaturan, dummyPengaturan);

  // 4. Inisialisasi Tab PengajuanIzin (Kosong)
  var headersIzin = [
    "ID Pengajuan",      // COL 0
    "ID Karyawan",       // COL 1
    "Nama Karyawan",     // COL 2
    "Jenis Pengajuan",   // COL 3 (Sakit / Izin / Cuti)
    "Tanggal Mulai",     // COL 4
    "Tanggal Selesai",   // COL 5
    "Alasan",            // COL 6
    "Bukti URL",         // COL 7
    "Status Approval"    // COL 8 (Menunggu / Disetujui / Ditolak)
  ];
  var dummyIzin = [];
  createOrMigrateSheet(ss, "PengajuanIzin", headersIzin, dummyIzin);

  // Inisialisasi Folder Google Drive untuk Foto
  getOrCreateDriveFolder();

  Logger.log("Setup Database Al Hunafa Attendance Selesai dengan Sukses!");
  return { success: true, message: "Database dan tab berhasil diinisialisasi secara aman." };
}

/**
 * Helper Migrasi Aman (Safe Migration):
 * - Membuat sheet jika belum ada.
 * - Jika sudah ada, TIDAK MENGHAPUS data yang sudah ada.
 * - Menyelaraskan header di kolom paling kanan jika ada penambahan kolom baru.
 */
function createOrMigrateSheet(ss, sheetName, headers, sampleData) {
  var sheet = ss.getSheetByName(sheetName);
  var headerColor = "#3d5c52"; // Deep Sage Green Al Hunafa

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Tulis header
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(headerColor)
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);

    // Masukkan data dummy jika baru pertama kali dibuat
    if (sampleData && sampleData.length > 0) {
      sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
    }
    sheet.autoResizeColumns(1, headers.length);
  } else {
    // Sinkronisasi kolom baru (Safe Migration)
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      for (var i = 0; i < headers.length; i++) {
        var headerName = headers[i];
        if (currentHeaders.indexOf(headerName) === -1) {
          var newColIndex = sheet.getLastColumn() + 1;
          var headerCell = sheet.getRange(1, newColIndex);
          headerCell.setValue(headerName)
            .setBackground(headerColor)
            .setFontColor("#ffffff")
            .setFontWeight("bold")
            .setHorizontalAlignment("center");
        }
      }
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground(headerColor)
        .setFontColor("#ffffff")
        .setFontWeight("bold")
        .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * Mencari atau membuat folder khusus Google Drive untuk menampung foto presensi
 */
function getOrCreateDriveFolder() {
  var folderName = "Al Hunafa Attendance Photos";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    var newFolder = DriveApp.createFolder(folderName);
    // Set permission agar foto dapat dibuka oleh view antarmuka jika diperlukan
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log("Info sharing Drive: " + e.message);
    }
    return newFolder;
  }
}

/**
 * ================================================================================
 * FUNGSI PEMBERSIH SEMUA DATA DUMMY (RESET DATA KE NOL)
 * ================================================================================
 * Jalankan fungsi ini dari dropdown Run di Apps Script jika spreadsheet Anda sudah
 * terlanjur terisi data dummy lama (misal ATT-202311-001, dll).
 * Fungsi ini akan menghapus seluruh baris data dari baris ke-2 ke bawah pada tab:
 * - LogPresensi
 * - PengajuanIzin
 * - PengajuanLembur
 * - DataKaryawan
 *
 * Header dan tab PengaturanSistem TETAP UTUH dan aman!
 */
function bersihkanSemuaDataDummy() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log("Error: Spreadsheet aktif tidak ditemukan.");
    return { success: false, message: "Spreadsheet aktif tidak ditemukan." };
  }

  var tabsToClear = ["LogPresensi", "PengajuanIzin", "PengajuanLembur", "DataKaryawan"];
  var cleanedTabs = [];

  tabsToClear.forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
      cleanedTabs.push(sheetName);
      Logger.log("Berhasil mengosongkan data di tab: " + sheetName);
    }
  });

  Logger.log("Pembersihan data selesai! Tab yang dibersihkan: " + cleanedTabs.join(", "));
  return {
    success: true,
    message: "Seluruh data dummy berhasil dihapus dari: " + (cleanedTabs.length > 0 ? cleanedTabs.join(", ") : "Semua tab sudah kosong.")
  };
}

