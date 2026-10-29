/**
 * ================================================================================
 * AL HUNAFA ATTENDANCE - BACKEND CONTROLLER & API ENGINE
 * Engine: ZettBOT Core v1.0.0
 * ================================================================================
 */

// Konstanta Pemetaan Kolom Baku Berbasis Indeks (Index-Based Column Mapping)
const COL_KARYAWAN = {
  ID: 0,
  NIP: 1,
  NAMA: 2,
  ROLE: 3,
  JABATAN: 4,
  PIN: 5,
  AKTIF: 6,
  FOTO: 7,
  EMAIL: 8,
  USERNAME: 9
};

const COL_PRESENSI = {
  ID: 0,
  ID_PEG: 1,
  NAMA: 2,
  TGL: 3,
  IN_TIME: 4,
  IN_STAT: 5,
  IN_DIST: 6,
  IN_FOTO: 7,
  OUT_TIME: 8,
  OUT_STAT: 9,
  OUT_DIST: 10,
  OUT_FOTO: 11,
  HOURS: 12,
  LOKASI: 13
};

const COL_CONFIG = {
  KEY: 0,
  VAL: 1,
  DESC: 2
};

const COL_IZIN = {
  ID: 0,
  ID_PEG: 1,
  NAMA: 2,
  JENIS: 3,
  START: 4,
  END: 5,
  ALASAN: 6,
  BUKTI: 7,
  STATUS: 8
};

const COL_LEMBUR = {
  ID: 0,
  ID_PEG: 1,
  NAMA: 2,
  JENIS: 3,
  START: 4,
  END: 5,
  TOTAL_HOURS: 6,
  ALASAN: 7,
  STATUS: 8,
  TGL_SUBMIT: 9
};

/**
 * Entry point Web App
 */
function doGet(e) {
  // Dukungan REST API via GET jika parameter action disertakan
  if (e && e.parameter && e.parameter.action) {
    return doPost(e);
  }
  var template = HtmlService.createTemplateFromFile("index");
  return template.evaluate()
    .setTitle("Al Hunafa Attendance - Presensi Karyawan & Guru")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setFaviconUrl("https://lh3.googleusercontent.com/d/1SkgbggMKEV_TVQa3YsiLz8GjtoXeRL5M")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper untuk menyertakan file modular (css, js, dll.) ke dalam template index
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Handle POST request jika diakses via webhook/fetch eksternal (Universal Vercel API Bridge)
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (errJson) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var rawAction = String(payload.action || (e && e.parameter ? e.parameter.action : "") || "").trim();
    var action = rawAction.toLowerCase();
    var result = { success: false, message: "Aksi '" + rawAction + "' tidak dikenal di backend Google Apps Script." };

    if (action === "login") {
      result = apiLogin(payload.identifier || payload.email || payload.nip, payload.pin);
    } else if (action === "getdashboard" || action === "get_dashboard") {
      result = apiGetDashboardData(payload.token, payload.idKaryawan);
    } else if (action === "getadmindashboard" || action === "get_admin_dashboard") {
      result = apiGetAdminDashboard(payload.token);
    } else if (action === "submitpresensi" || action === "submit_presensi") {
      result = apiSubmitPresensi(payload.token, payload);
    } else if (action === "submitizin" || action === "submit_izin") {
      result = apiSubmitIzin(payload.token, payload);
    } else if (action === "updatestatusizin" || action === "update_status_izin") {
      result = apiUpdateStatusIzin(payload.token, payload.idPengajuan, payload.newStatus);
    } else if (action === "getizinlist" || action === "get_izin_list") {
      result = apiGetIzinList(payload.token);
    } else if (action === "getfilteredreport" || action === "get_filtered_report") {
      result = apiGetFilteredReport(payload.token, payload.startDate, payload.endDate);
    } else if (action === "saveconfig" || action === "save_config") {
      result = apiSaveConfig(payload.token, payload.newConfig);
    } else if (action === "savekaryawan" || action === "save_karyawan") {
      result = apiSaveKaryawan(payload.token, payload.karyawan);
    } else if (action === "searchgooglemapslocation" || action === "search_google_maps_location") {
      result = apiSearchGoogleMapsLocation(payload.token, payload.query);
    } else if (action === "submitlembur" || action === "submit_lembur") {
      result = apiSubmitLembur(payload.token, payload);
    } else if (action === "updatestatuslembur" || action === "update_status_lembur") {
      result = apiUpdateStatusLembur(payload.token, payload.idPengajuan, payload.newStatus);
    } else if (action === "updatepassword" || action === "update_password") {
      result = apiUpdatePassword(payload.token, payload.idKaryawan, payload.oldPin, payload.newPin);
    } else if (action === "updateprofilephoto" || action === "update_profile_photo") {
      result = apiUpdateProfilePhoto(payload.token, payload.idKaryawan, payload.photoUrl);
    } else if (action === "logout") {
      result = apiLogout(payload.token);
    } else if (action === "ping") {
      result = { success: true, message: "Pong! Google Apps Script Backend Online.", timestamp: new Date().toISOString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper untuk mengambil sheet secara aman
 */
function getDbSheet(sheetName) {
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
    throw new Error("Spreadsheet aktif tidak ditemukan. Pastikan script ini dibuka dari menu Extensions (Ekstensi) > Apps Script di dalam Google Sheets Anda, atau atur Script Properties SPREADSHEET_ID.");
  }
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(sheetName);
  }
  return sheet;
}

/**
 * Mengambil seluruh data pengaturan sebagai objek key-value
 */
function getSystemConfig() {
  var sheet = getDbSheet("PengaturanSistem");
  var data = sheet.getDataRange().getValues();
  var config = {
    NAMA_KANTOR: "Al Hunafa Attendance Center",
    ALAMAT_KANTOR: "West Jakarta, Indonesia",
    LATITUDE_KANTOR: -6.175392,
    LONGITUDE_KANTOR: 106.827153,
    RADIUS_MAKSIMAL_METER: 50,
    JAM_MASUK_STANDAR: "08:00",
    JAM_PULANG_STANDAR: "17:00",
    GOOGLE_DRIVE_FOLDER_NAME: "Al Hunafa Attendance Photos"
  };

  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][COL_CONFIG.KEY]).trim();
    var val = data[i][COL_CONFIG.VAL];
    if (key) {
      if (key === "LATITUDE_KANTOR" || key === "LONGITUDE_KANTOR" || key === "RADIUS_MAKSIMAL_METER") {
        config[key] = parseFloat(val);
      } else {
        config[key] = String(val);
      }
    }
  }
  return config;
}

/**
 * ================================================================================
 * MODUL KEAMANAN SERVER: SESSION TOKEN VIA CACHESERVICE (ZERO-TRUST ENGINE)
 * ================================================================================
 */
const SESSION_TTL_SECONDS = 21600; // 6 Jam (Batas maksimal CacheService Google Apps Script)

/**
 * Helper Private: Validasi Token Sesi & Hak Akses Role
 * Catatan Keamanan: Akhiran '_' menjamin fungsi ini TIDAK BISA dipanggil dari browser client via google.script.run!
 */
function validateSession_(token, requiredRole) {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return { valid: false, code: 401, message: "Akses Ditolak: Token sesi tidak ditemukan. Silakan login." };
  }

  var cache = CacheService.getScriptCache();
  var sessionDataStr = cache.get("sess_" + token.trim());

  if (!sessionDataStr) {
    return { valid: false, code: 401, message: "Sesi Anda telah kedaluwarsa atau tidak valid. Silakan login kembali." };
  }

  try {
    var userSession = JSON.parse(sessionDataStr);

    // Validasi Hak Akses Role Khusus (misal Admin)
    if (requiredRole && userSession.role !== requiredRole && userSession.role !== "Admin") {
      return { valid: false, code: 403, message: "Akses Terlarang: Anda tidak memiliki hak akses Administrator." };
    }

    return { valid: true, user: userSession };
  } catch (err) {
    return { valid: false, code: 401, message: "Format sesi korup. Silakan login kembali." };
  }
}

/**
 * 1. API: Login Pegawai / Admin & Pembuatan Session Token Kriptografis
 */
function apiLogin(identifier, pin) {
  try {
    var sheet = getDbSheet("DataKaryawan");
    var data = sheet.getDataRange().getValues();
    var cleanId = String(identifier || "").trim().toLowerCase();
    var cleanPin = String(pin || "").trim();

    if (data.length <= 1) {
      return { success: false, message: "Database pegawai kosong. Silakan tambahkan data karyawan / admin di tab DataKaryawan terlebih dahulu." };
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowNip = String(row[COL_KARYAWAN.NIP]).trim().toLowerCase();
      var rowEmail = row.length > COL_KARYAWAN.EMAIL ? String(row[COL_KARYAWAN.EMAIL] || "").trim().toLowerCase() : "";
      var rowUsername = row.length > COL_KARYAWAN.USERNAME ? String(row[COL_KARYAWAN.USERNAME] || "").trim().toLowerCase() : "";
      var rowPin = String(row[COL_KARYAWAN.PIN]).trim();
      var status = String(row[COL_KARYAWAN.AKTIF]).trim();

      var isMatch = (cleanId === rowNip) || (rowEmail && cleanId === rowEmail) || (rowUsername && cleanId === rowUsername);

      if (isMatch && rowPin === cleanPin) {
        if (status.toLowerCase() !== "aktif") {
          return { success: false, message: "Akun Anda saat ini sedang dinonaktifkan oleh Admin." };
        }

        // GENERATE KRIPTOGRAFIS SESSION TOKEN
        var sessionToken = Utilities.getUuid();
        var rawId = String(row[COL_KARYAWAN.ID] || "").trim();
        var rawNip = String(row[COL_KARYAWAN.NIP] || "").trim();
        var rawNama = String(row[COL_KARYAWAN.NAMA] || "Pegawai").trim();
        var finalId = rawId || rawNip || ("PEG-" + i);

        var sessionUser = {
          idKaryawan: finalId,
          nip: rawNip || finalId,
          nama: rawNama,
          role: String(row[COL_KARYAWAN.ROLE] || "Pegawai").trim(),
          jabatan: String(row[COL_KARYAWAN.JABATAN] || "Staff").trim(),
          photoUrl: row.length > COL_KARYAWAN.FOTO ? (row[COL_KARYAWAN.FOTO] || "") : "",
          email: rowEmail,
          username: rowUsername,
          loginTime: new Date().getTime()
        };

        // SIMPAN KE CACHESERVICE (EXPIRY: 6 JAM)
        CacheService.getScriptCache().put("sess_" + sessionToken, JSON.stringify(sessionUser), SESSION_TTL_SECONDS);

        return {
          success: true,
          token: sessionToken,
          user: sessionUser,
          message: "Login berhasil!"
        };
      }
    }
    return { success: false, message: "Email/Username atau PIN yang Anda masukkan salah." };
  } catch (err) {
    return { success: false, message: "Terjadi kesalahan server: " + err.message };
  }
}

/**
 * 1d. API: Logout & Revokasi Token Sesi di Server
 */
function apiLogout(token) {
  if (token) {
    CacheService.getScriptCache().remove("sess_" + String(token).trim());
  }
  return { success: true, message: "Sesi berhasil diakhiri." };
}

/**
 * 1b. API: Ubah Password / PIN Karyawan (TERPROTEKSI TOKEN)
 */
function apiUpdatePassword(token, idKaryawan, oldPin, newPin) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };
  if (auth.user.role !== "Admin") {
    idKaryawan = auth.user.idKaryawan;
  }

  try {
    var sheet = getDbSheet("DataKaryawan");
    var data = sheet.getDataRange().getValues();
    var cleanOld = String(oldPin).trim();
    var cleanNew = String(newPin).trim();

    if (cleanNew.length < 4) {
      return { success: false, message: "PIN baru minimal 4 karakter." };
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[COL_KARYAWAN.ID]).trim() === String(idKaryawan).trim()) {
        var currentPin = String(row[COL_KARYAWAN.PIN]).trim();
        if (currentPin !== cleanOld) {
          return { success: false, message: "PIN lama yang Anda masukkan tidak sesuai." };
        }
        sheet.getRange(i + 1, COL_KARYAWAN.PIN + 1).setValue(cleanNew);
        return { success: true, message: "Password/PIN berhasil diperbarui!" };
      }
    }
    return { success: false, message: "Data karyawan tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal memperbarui PIN: " + err.message };
  }
}

/**
 * 1c. API: Simpan Foto Profil Karyawan (TERPROTEKSI TOKEN)
 */
function apiUpdateProfilePhoto(token, idKaryawan, photoUrl) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };
  if (auth.user.role !== "Admin") {
    idKaryawan = auth.user.idKaryawan;
  }

  try {
    var sheet = getDbSheet("DataKaryawan");
    var data = sheet.getDataRange().getValues();

    if (data[0].length <= COL_KARYAWAN.FOTO) {
      sheet.getRange(1, COL_KARYAWAN.FOTO + 1).setValue("Foto Profil");
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[COL_KARYAWAN.ID]).trim() === String(idKaryawan).trim()) {
        sheet.getRange(i + 1, COL_KARYAWAN.FOTO + 1).setValue(photoUrl);
        return { success: true, message: "Foto profil berhasil diperbarui!" };
      }
    }
    return { success: false, message: "Data karyawan tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal memperbarui foto: " + err.message };
  }
}

/**
 * 2. API: Mengambil Data Dashboard Pegawai (Stats, Presensi Hari Ini, History) (TERPROTEKSI TOKEN)
 */
function apiGetDashboardData(token, idKaryawan) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };
  if (auth.user.role !== "Admin") {
    idKaryawan = auth.user.idKaryawan;
  }

  try {
    var config = getSystemConfig();
    var todayStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
    var sheetPresensi = getDbSheet("LogPresensi");
    var dataPresensi = sheetPresensi.getDataRange().getValues();

    var todayRecord = null;
    var historyList = [];
    var totalAttendedMonth = 0;
    var totalLateMonth = 0;
    var currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

    // Target identifier user yang sedang login
    var targetId = String(idKaryawan || (auth.user ? auth.user.idKaryawan : "")).trim();
    var targetNip = auth.user ? String(auth.user.nip || "").trim() : "";
    var targetNama = auth.user ? String(auth.user.nama || "").trim().toLowerCase() : "";

    // Loop data presensi (terbalik agar riwayat terbaru di atas)
    for (var i = dataPresensi.length - 1; i >= 1; i--) {
      var row = dataPresensi[i];
      var rowIdPeg = String(row[COL_PRESENSI.ID_PEG]).trim();
      var rowNama = String(row[COL_PRESENSI.NAMA]).trim().toLowerCase();
      var rowDate = normalizeDateToYMD_(row[COL_PRESENSI.TGL]);

      var isUserMatch = (targetId && rowIdPeg === targetId) ||
                        (targetNip && rowIdPeg === targetNip) ||
                        (targetNama && rowNama === targetNama);

      if (isUserMatch) {
        // Cek presensi hari ini (HANYA DAN KHUSUS TANGGAL HARI INI DI WIB)
        if (rowDate === todayStr && !todayRecord) {
          todayRecord = {
            idPresensi: row[COL_PRESENSI.ID],
            checkInTime: formatTimeOnly(row[COL_PRESENSI.IN_TIME]),
            checkInStatus: row[COL_PRESENSI.IN_STAT] || "Hadir",
            checkInFoto: row[COL_PRESENSI.IN_FOTO] || "",
            checkOutTime: formatTimeOnly(row[COL_PRESENSI.OUT_TIME]),
            checkOutStatus: row[COL_PRESENSI.OUT_STAT] || "Selesai",
            checkOutFoto: row[COL_PRESENSI.OUT_FOTO] || "",
            totalHours: row[COL_PRESENSI.HOURS] || "-"
          };
        }

        // Hitung statistik bulan ini
        if (rowDate && rowDate.indexOf(currentMonthStr) === 0) {
          if (row[COL_PRESENSI.IN_TIME]) {
            totalAttendedMonth++;
          }
        }

        // Simpan 10 riwayat terakhir
        if (historyList.length < 10) {
          var dateInfo = formatHistoryDate_(rowDate);
          historyList.push({
            idPresensi: row[COL_PRESENSI.ID],
            rawDate: rowDate,
            dayNumber: dateInfo.dayNumber,
            dayName: dateInfo.dayName,
            formattedDate: dateInfo.formattedDate,
            checkInTime: formatTimeOnly(row[COL_PRESENSI.IN_TIME]) || "-",
            checkOutTime: formatTimeOnly(row[COL_PRESENSI.OUT_TIME]) || "-",
            totalHours: row[COL_PRESENSI.HOURS] || "-",
            lokasi: row[COL_PRESENSI.LOKASI] || config.ALAMAT_KANTOR
          });
        }
      }
    }

    // Ambil data izin bulan ini
    var sheetIzin = getDbSheet("PengajuanIzin");
    var dataIzin = sheetIzin.getDataRange().getValues();
    var totalAbsenceMonth = 0;
    for (var j = 1; j < dataIzin.length; j++) {
      var rIzin = dataIzin[j];
      var rIdPeg = String(rIzin[COL_IZIN.ID_PEG]).trim();
      var rStatus = String(rIzin[COL_IZIN.STATUS]).trim();
      var rStart = String(rIzin[COL_IZIN.START]);
      if (rIdPeg === idKaryawan && rStatus === "Disetujui" && rStart.indexOf(currentMonthStr) === 0) {
        totalAbsenceMonth++;
      }
    }

    // Khusus Admin: Ambil log seluruh presensi pegawai hari ini untuk live monitoring di Beranda
    var todayAllEmployeesLog = [];
    if (auth.user.role === "Admin") {
      for (var p = dataPresensi.length - 1; p >= 1; p--) {
        var rPres = dataPresensi[p];
        var rTgl = normalizeDateToYMD_(rPres[COL_PRESENSI.TGL]);
        if (rTgl === todayStr && rPres[COL_PRESENSI.ID]) {
          todayAllEmployeesLog.push({
            idPresensi: rPres[COL_PRESENSI.ID],
            idKaryawan: rPres[COL_PRESENSI.ID_PEG],
            nama: rPres[COL_PRESENSI.NAMA] || getKaryawanName(rPres[COL_PRESENSI.ID_PEG]),
            checkInTime: formatTimeOnly(rPres[COL_PRESENSI.IN_TIME]) || "-",
            checkInStatus: rPres[COL_PRESENSI.IN_STAT] || "Hadir",
            checkOutTime: formatTimeOnly(rPres[COL_PRESENSI.OUT_TIME]) || "-",
            checkOutStatus: rPres[COL_PRESENSI.OUT_STAT] || "-",
            totalHours: rPres[COL_PRESENSI.HOURS] || "-"
          });
        }
      }
    }

    return {
      success: true,
      config: config,
      todayDateStr: Utilities.formatDate(new Date(), "Asia/Jakarta", "EEEE, d MMMM yyyy"),
      todayRecord: todayRecord,
      todayAllEmployeesLog: todayAllEmployeesLog,
      stats: {
        totalAttended: totalAttendedMonth,
        totalAbsence: totalAbsenceMonth,
        totalLate: totalLateMonth
      },
      history: historyList
    };
  } catch (err) {
    return { success: false, message: "Gagal memuat dashboard: " + err.message };
  }
}

/**
 * 3. API: Submit Presensi Masuk / Pulang dengan Validasi Radius & Upload Foto ke Drive (TERPROTEKSI TOKEN)
 */
function apiSubmitPresensi(token, payload) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  var lock = LockService.getScriptLock();
  try {
    // Kunci script selama 15 detik agar anti-tabrakan nomor ID
    lock.waitLock(15000);

    var idKaryawan = String(payload.idKaryawan).trim();
    if (auth.user.role !== "Admin") {
      idKaryawan = auth.user.idKaryawan;
      payload.idKaryawan = auth.user.idKaryawan;
    }
    var type = String(payload.type).toUpperCase(); // 'CHECK_IN' atau 'CHECK_OUT'
    var userLat = parseFloat(payload.latitude);
    var userLon = parseFloat(payload.longitude);
    var base64Photo = payload.base64Photo; // data:image/jpeg;base64,...

    if (!idKaryawan || !type || isNaN(userLat) || isNaN(userLon)) {
      return { success: false, message: "Data koordinat atau identitas pegawai tidak lengkap." };
    }

    var config = getSystemConfig();
    var officeLat = config.LATITUDE_KANTOR;
    var officeLon = config.LONGITUDE_KANTOR;
    var maxRadius = config.RADIUS_MAKSIMAL_METER;

    // 1. Hitung Jarak dengan Formula Haversine
    var distanceMeter = calculateHaversineDistance(userLat, userLon, officeLat, officeLon);
    distanceMeter = Math.round(distanceMeter * 10) / 10; // 1 desimal

    // 2. Validasi Radius Toleransi 50 Meter
    if (distanceMeter > maxRadius) {
      return {
        success: false,
        isOutOfRange: true,
        currentDistance: distanceMeter,
        maxRadius: maxRadius,
        message: "Presensi Ditolak: Anda berada " + Math.round(distanceMeter) + " meter dari kantor (Batas maksimal " + maxRadius + " meter)."
      };
    }

    // 3. Upload Foto ke Folder Google Drive
    var photoUrl = "-";
    if (base64Photo && base64Photo.indexOf("base64,") !== -1) {
      photoUrl = uploadBase64ImageToDrive(base64Photo, type + "_" + idKaryawan + "_" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss"));
    }

    var now = new Date();
    var todayStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd");
    var timeStr = Utilities.formatDate(now, "Asia/Jakarta", "HH:mm:ss");
    var sheetPresensi = getDbSheet("LogPresensi");
    var data = sheetPresensi.getDataRange().getValues();

    // Target identifier user yang submit presensi
    var targetId = String(idKaryawan || (auth.user ? auth.user.idKaryawan : "")).trim();
    var targetNip = auth.user ? String(auth.user.nip || "").trim() : "";
    var targetNama = auth.user ? String(auth.user.nama || "").trim().toLowerCase() : "";
    var idKaryawanFinal = targetId || targetNip || "PEG-" + Date.now();
    var namaKaryawanFinal = (auth.user && auth.user.nama) ? auth.user.nama : getKaryawanName(idKaryawanFinal);

    if (type === "CHECK_IN") {
      // Periksa apakah sudah absen masuk hari ini
      for (var i = 1; i < data.length; i++) {
        var rId = String(data[i][COL_PRESENSI.ID_PEG]).trim();
        var rNama = String(data[i][COL_PRESENSI.NAMA]).trim().toLowerCase();
        var rTgl = normalizeDateToYMD_(data[i][COL_PRESENSI.TGL]);
        var isMatch = (targetId && rId === targetId) ||
                      (targetNip && rId === targetNip) ||
                      (targetNama && rNama === targetNama);
        if (isMatch && rTgl === todayStr) {
          return { success: false, message: "Anda sudah melakukan Check-In untuk hari ini pada jam " + formatTimeOnly(data[i][COL_PRESENSI.IN_TIME]) };
        }
      }

      // Tentukan status masuk (fleksibel tanpa batasan jam datang sistem, patokan total jam kerja)
      var statusMasuk = "Hadir";

      // Generate ID unik ATT-YYYYMM-XXX
      var newId = generateIncrementalId(sheetPresensi, "ATT-");

      var newRow = [
        newId,
        idKaryawanFinal,
        namaKaryawanFinal,
        todayStr,
        timeStr,
        statusMasuk,
        distanceMeter,
        photoUrl,
        "", // Check-Out Waktu
        "", // Check-Out Status
        "", // Check-Out Jarak
        "", // Check-Out Foto
        "", // Total Jam Kerja
        config.ALAMAT_KANTOR
      ];

      sheetPresensi.appendRow(newRow);
      try {
        var lastRow = sheetPresensi.getLastRow();
        sheetPresensi.getRange(lastRow, COL_PRESENSI.TGL + 1).setNumberFormat("@").setValue(todayStr);
        sheetPresensi.getRange(lastRow, COL_PRESENSI.IN_TIME + 1).setNumberFormat("@").setValue(timeStr);
      } catch (eFmtIn) {}

      return {
        success: true,
        type: "CHECK_IN",
        time: timeStr.substring(0, 5),
        status: statusMasuk,
        distance: distanceMeter,
        message: "Presensi Masuk Berhasil! (" + timeStr.substring(0, 5) + " WIB - Jarak " + distanceMeter + "m)"
      };

    } else if (type === "CHECK_OUT") {
      // Cari baris presensi hari ini
      var rowIndexToUpdate = -1;
      var inTimeStr = "";

      for (var k = 1; k < data.length; k++) {
        var rowPeg = String(data[k][COL_PRESENSI.ID_PEG]).trim();
        var rowNama = String(data[k][COL_PRESENSI.NAMA]).trim().toLowerCase();
        var rowDate = normalizeDateToYMD_(data[k][COL_PRESENSI.TGL]);
        var isMatch = (targetId && rowPeg === targetId) ||
                      (targetNip && rowPeg === targetNip) ||
                      (targetNama && rowNama === targetNama);
        if (isMatch && rowDate === todayStr) {
          rowIndexToUpdate = k + 1; // 1-based baris spreadsheet
          inTimeStr = formatTimeOnly(data[k][COL_PRESENSI.IN_TIME]);
          if (data[k][COL_PRESENSI.OUT_TIME]) {
            return { success: false, message: "Anda sudah melakukan Check-Out sebelumnya pada jam " + formatTimeOnly(data[k][COL_PRESENSI.OUT_TIME]) };
          }
          break;
        }
      }

      if (rowIndexToUpdate === -1) {
        return { success: false, message: "Gagal: Anda belum melakukan Check-In untuk hari ini." };
      }

      // Tentukan status pulang (fleksibel tanpa vonis Pulang Cepat)
      var statusPulang = "Selesai";

      // Hitung Total Jam Kerja Riil (Check-In s/d Check-Out)
      var totalHoursFormatted = calculateWorkDuration(inTimeStr, timeStr);

      // Perbarui kolom Check-Out pada baris sheet dengan proteksi format Plain Text
      sheetPresensi.getRange(rowIndexToUpdate, COL_PRESENSI.OUT_TIME + 1).setNumberFormat("@").setValue(timeStr);
      sheetPresensi.getRange(rowIndexToUpdate, COL_PRESENSI.OUT_STAT + 1).setValue(statusPulang);
      sheetPresensi.getRange(rowIndexToUpdate, COL_PRESENSI.OUT_DIST + 1).setValue(distanceMeter);
      sheetPresensi.getRange(rowIndexToUpdate, COL_PRESENSI.OUT_FOTO + 1).setValue(photoUrl);
      sheetPresensi.getRange(rowIndexToUpdate, COL_PRESENSI.HOURS + 1).setNumberFormat("@").setValue(totalHoursFormatted.shortFormat);

      return {
        success: true,
        type: "CHECK_OUT",
        time: timeStr.substring(0, 5),
        status: statusPulang,
        distance: distanceMeter,
        totalHours: totalHoursFormatted.shortFormat,
        durationText: totalHoursFormatted.humanText,
        message: "Presensi Pulang Berhasil! Durasi Kerja: " + totalHoursFormatted.humanText
      };
    }

    return { success: false, message: "Tipe presensi tidak valid." };

  } catch (err) {
    return { success: false, message: "Kesalahan server saat memproses presensi: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 4. API: Pengajuan Izin / Sakit / Cuti (Tab Leave) (TERPROTEKSI TOKEN)
 */
function apiSubmitIzin(token, payload) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getDbSheet("PengajuanIzin");
    var idKaryawan = String(payload.idKaryawan).trim();
    if (auth.user.role !== "Admin") {
      idKaryawan = auth.user.idKaryawan;
      payload.idKaryawan = auth.user.idKaryawan;
    }
    var namaKaryawan = auth.user.nama || getKaryawanName(idKaryawan);
    var jenis = payload.jenis; // 'Sakit', 'Izin', 'Cuti'
    var tglMulai = payload.tglMulai;
    var tglSelesai = payload.tglSelesai;
    var alasan = payload.alasan;
    var buktiPhoto = payload.buktiPhoto; // Base64 jika ada

    var buktiUrl = "-";
    if (buktiPhoto && buktiPhoto.indexOf("base64,") !== -1) {
      buktiUrl = uploadBase64ImageToDrive(buktiPhoto, "BUKTI_IZIN_" + idKaryawan + "_" + Date.now());
    }

    var newId = generateIncrementalId(sheet, "LEV-");
    var newRow = [
      newId,
      idKaryawan,
      namaKaryawan,
      jenis,
      tglMulai,
      tglSelesai,
      alasan,
      buktiUrl,
      "Menunggu"
    ];
    sheet.appendRow(newRow);

    return { success: true, message: "Pengajuan " + jenis + " berhasil dikirim dan menunggu persetujuan Admin." };
  } catch (err) {
    return { success: false, message: "Gagal mengirim pengajuan izin: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 4b. API: Ambil Daftar Pengajuan Izin (Admin: Seluruh Pegawai, Pegawai: Riwayat Pribadi)
 */
function apiGetIzinList(token) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var sheetIzin = getDbSheet("PengajuanIzin");
    var dataIzin = sheetIzin.getDataRange().getValues();
    var list = [];
    var isAdmin = (auth.user.role === "Admin");
    var userEmpId = String(auth.user.idKaryawan || auth.user.nip || "").trim();

    for (var k = dataIzin.length - 1; k >= 1; k--) {
      var rI = dataIzin[k];
      if (rI[COL_IZIN.ID]) {
        var rowEmpId = String(rI[COL_IZIN.ID_PEG]).trim();
        if (isAdmin || rowEmpId === userEmpId) {
          list.push({
            idPengajuan: String(rI[COL_IZIN.ID]),
            idKaryawan: rowEmpId,
            nama: rI[COL_IZIN.NAMA] || "-",
            jenis: rI[COL_IZIN.JENIS] || "-",
            tglMulai: normalizeDateToYMD_(rI[COL_IZIN.START]) || String(rI[COL_IZIN.START]),
            tglSelesai: normalizeDateToYMD_(rI[COL_IZIN.END]) || String(rI[COL_IZIN.END]),
            alasan: rI[COL_IZIN.ALASAN] || "-",
            bukti: rI[COL_IZIN.BUKTI] || "-",
            status: rI[COL_IZIN.STATUS] || "Menunggu"
          });
        }
      }
    }
    return { success: true, data: list };
  } catch (err) {
    return { success: false, message: "Gagal memuat data izin: " + err.message };
  }
}

/**
 * 5. API: Dashboard Admin & Rekap Data (TERPROTEKSI KHUSUS ROLE ADMIN)
 */
function apiGetAdminDashboard(token) {
  var auth = validateSession_(token, "Admin");
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var config = getSystemConfig();
    var sheetPeg = getDbSheet("DataKaryawan");
    var dataPeg = sheetPeg.getDataRange().getValues();
    var karyawanList = [];

    for (var i = 1; i < dataPeg.length; i++) {
      var row = dataPeg[i];
      if (row[COL_KARYAWAN.ID]) {
        karyawanList.push({
          idKaryawan: row[COL_KARYAWAN.ID],
          nip: row[COL_KARYAWAN.NIP],
          nama: row[COL_KARYAWAN.NAMA],
          role: row[COL_KARYAWAN.ROLE],
          jabatan: row[COL_KARYAWAN.JABATAN],
          status: row[COL_KARYAWAN.AKTIF]
        });
      }
    }

    var sheetPres = getDbSheet("LogPresensi");
    var dataPres = sheetPres.getDataRange().getValues();
    var allPresensi = [];

    for (var j = dataPres.length - 1; j >= 1; j--) {
      var r = dataPres[j];
      if (r[COL_PRESENSI.ID]) {
        var tglYmd = normalizeDateToYMD_(r[COL_PRESENSI.TGL]);
        var tglParts = tglYmd.split("-");
        var fmtDdMmYyyy = (tglParts.length === 3 ? tglParts[2] + "/" + tglParts[1] + "/" + tglParts[0] : tglYmd);
        allPresensi.push({
          idPresensi: r[COL_PRESENSI.ID],
          idKaryawan: r[COL_PRESENSI.ID_PEG],
          nama: r[COL_PRESENSI.NAMA],
          tanggal: tglYmd,
          formattedDate: fmtDdMmYyyy,
          checkIn: formatTimeOnly(r[COL_PRESENSI.IN_TIME]) || "-",
          statusMasuk: r[COL_PRESENSI.IN_STAT] || "-",
          jarakMasuk: r[COL_PRESENSI.IN_DIST] || "-",
          fotoMasuk: r[COL_PRESENSI.IN_FOTO] || "",
          checkOut: formatTimeOnly(r[COL_PRESENSI.OUT_TIME]) || "-",
          statusPulang: r[COL_PRESENSI.OUT_STAT] || "-",
          totalHours: r[COL_PRESENSI.HOURS] || "-"
        });
      }
    }

    var sheetIzin = getDbSheet("PengajuanIzin");
    var dataIzin = sheetIzin.getDataRange().getValues();
    var allIzin = [];

    for (var k = dataIzin.length - 1; k >= 1; k--) {
      var rI = dataIzin[k];
      if (rI[COL_IZIN.ID]) {
        allIzin.push({
          idPengajuan: rI[COL_IZIN.ID],
          idKaryawan: rI[COL_IZIN.ID_PEG],
          nama: rI[COL_IZIN.NAMA],
          jenis: rI[COL_IZIN.JENIS],
          tglMulai: rI[COL_IZIN.START],
          tglSelesai: rI[COL_IZIN.END],
          alasan: rI[COL_IZIN.ALASAN],
          bukti: rI[COL_IZIN.BUKTI],
          status: rI[COL_IZIN.STATUS]
        });
      }
    }

    return {
      success: true,
      config: config,
      karyawanList: karyawanList,
      presensiList: allPresensi,
      izinList: allIzin,
      lemburList: []
    };
  } catch (err) {
    return { success: false, message: "Gagal memuat data admin: " + err.message };
  }
}

/**
 * 6. API: Simpan Pengaturan Kantor oleh Admin (Koordinat, Radius, Jam Kerja) (TERPROTEKSI KHUSUS ROLE ADMIN)
 */
function apiSaveConfig(token, newConfig) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var sheet = getDbSheet("PengaturanSistem");
    var data = sheet.getDataRange().getValues();

    for (var key in newConfig) {
      var found = false;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][COL_CONFIG.KEY]).trim() === key) {
          sheet.getRange(i + 1, COL_CONFIG.VAL + 1).setValue(newConfig[key]);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([key, newConfig[key], "Diperbarui via Admin Settings"]);
      }
    }

    return { success: true, message: "Pengaturan sistem dan lokasi kantor berhasil disimpan!" };
  } catch (err) {
    return { success: false, message: "Gagal menyimpan pengaturan: " + err.message };
  }
}

/**
 * 7. API: Tambah / Edit Karyawan oleh Admin (TERPROTEKSI KHUSUS ROLE ADMIN)
 */
function apiSaveKaryawan(token, karyawan) {
  var auth = validateSession_(token, "Admin");
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getDbSheet("DataKaryawan");
    var data = sheet.getDataRange().getValues();
    var nip = String(karyawan.nip).trim();
    var idKaryawan = karyawan.idKaryawan ? String(karyawan.idKaryawan).trim() : "";

    // Edit Karyawan
    if (idKaryawan) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][COL_KARYAWAN.ID]).trim() === idKaryawan) {
          sheet.getRange(i + 1, COL_KARYAWAN.NIP + 1).setValue(nip);
          sheet.getRange(i + 1, COL_KARYAWAN.NAMA + 1).setValue(karyawan.nama);
          sheet.getRange(i + 1, COL_KARYAWAN.ROLE + 1).setValue(karyawan.role);
          sheet.getRange(i + 1, COL_KARYAWAN.JABATAN + 1).setValue(karyawan.jabatan);
          if (karyawan.pin) {
            sheet.getRange(i + 1, COL_KARYAWAN.PIN + 1).setValue(String(karyawan.pin).trim());
          }
          sheet.getRange(i + 1, COL_KARYAWAN.AKTIF + 1).setValue(karyawan.status || "Aktif");
          return { success: true, message: "Data pegawai berhasil diperbarui." };
        }
      }
    }

    // Cek duplikasi NIP saat tambah baru
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][COL_KARYAWAN.NIP]).trim() === nip) {
        return { success: false, message: "NIP " + nip + " sudah terdaftar di sistem." };
      }
    }

    var newId = generateIncrementalId(sheet, "PEG-");
    var newRow = [
      newId,
      nip,
      karyawan.nama,
      karyawan.role || "Pegawai",
      karyawan.jabatan || "Staff",
      karyawan.pin || "123456",
      "Aktif"
    ];
    sheet.appendRow(newRow);

    return { success: true, message: "Pegawai baru berhasil ditambahkan." };
  } catch (err) {
    return { success: false, message: "Gagal menyimpan pegawai: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 8. API: Approve / Tolak Pengajuan Izin oleh Admin (TERPROTEKSI KHUSUS ROLE ADMIN)
 */
function apiUpdateStatusIzin(token, idPengajuan, newStatus) {
  var auth = validateSession_(token, "Admin");
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var sheet = getDbSheet("PengajuanIzin");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL_IZIN.ID]).trim() === idPengajuan) {
        sheet.getRange(i + 1, COL_IZIN.STATUS + 1).setValue(newStatus);
        return { success: true, message: "Status pengajuan berhasil diubah menjadi: " + newStatus };
      }
    }
    return { success: false, message: "Pengajuan izin tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal mengupdate izin: " + err.message };
  }
}

/**
 * 9. API: Pengajuan Lemburan Pegawai (Overtime Submission) (TERPROTEKSI TOKEN)
 */
function apiSubmitLembur(token, payload) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getDbSheet("PengajuanLembur");
    var idKaryawan = payload.idKaryawan;
    if (auth.user.role !== "Admin") {
      idKaryawan = auth.user.idKaryawan;
      payload.idKaryawan = auth.user.idKaryawan;
      payload.namaKaryawan = auth.user.nama;
    }
    var namaKaryawan = payload.namaKaryawan || getNamaKaryawanById(idKaryawan);
    var jenisLembur = payload.jenisLembur;
    var startDateTime = payload.startDateTime;
    var endDateTime = payload.endDateTime;
    var totalHours = payload.totalHours;
    var keterangan = payload.keterangan || "-";
    var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm");

    var newId = generateIncrementalId(sheet, "OT-");
    var newRow = [
      newId,
      idKaryawan,
      namaKaryawan,
      jenisLembur,
      startDateTime,
      endDateTime,
      totalHours,
      keterangan,
      "Menunggu",
      nowStr
    ];
    sheet.appendRow(newRow);

    return {
      success: true,
      message: "Pengajuan lembur berhasil dikirim dan masuk ke Admin untuk verifikasi.",
      idPengajuan: newId
    };
  } catch (err) {
    return { success: false, message: "Gagal mengirim pengajuan lembur: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 10. API: Approve / Tolak Pengajuan Lembur oleh Admin (TERPROTEKSI KHUSUS ROLE ADMIN)
 */
function apiUpdateStatusLembur(token, idPengajuan, newStatus) {
  var auth = validateSession_(token, "Admin");
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var sheet = getDbSheet("PengajuanLembur");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL_LEMBUR.ID]).trim() === idPengajuan) {
        sheet.getRange(i + 1, COL_LEMBUR.STATUS + 1).setValue(newStatus);
        return { success: true, message: "Status lembur " + idPengajuan + " berhasil diubah menjadi: " + newStatus };
      }
    }
    return { success: false, message: "Pengajuan lembur tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal mengupdate lembur: " + err.message };
  }
}

/**
 * 11. API: Mengambil Laporan Presensi Terfilter Berdasarkan Rentang Tanggal (Bisa Diakses Admin & Pegawai)
 */
function apiGetFilteredReport(token, startDate, endDate) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var sheetPres = getDbSheet("LogPresensi");
    var data = sheetPres.getDataRange().getValues();
    var filteredList = [];

    var startClean = String(startDate || "").trim();
    var endClean = String(endDate || "").trim();

    var isPegawai = (auth.user.role !== "Admin");
    var targetId = String(auth.user.idKaryawan || "").trim();
    var targetNip = String(auth.user.nip || "").trim();
    var targetNama = String(auth.user.nama || "").trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[COL_PRESENSI.ID]) continue;

      var rowIdPeg = String(row[COL_PRESENSI.ID_PEG] || "").trim();
      var rowNama = String(row[COL_PRESENSI.NAMA] || "").trim().toLowerCase();

      // Jika role Pegawai biasa, hanya ambil data presensi miliknya sendiri
      if (isPegawai) {
        var isMatch = (targetId && rowIdPeg === targetId) ||
                      (targetNip && rowIdPeg === targetNip) ||
                      (targetNama && rowNama === targetNama);
        if (!isMatch) continue;
      }

      var rowDate = normalizeDateToYMD_(row[COL_PRESENSI.TGL]);

      var include = true;
      if (startClean && rowDate < startClean) include = false;
      if (endClean && rowDate > endClean) include = false;

      if (include) {
        var dParts = rowDate.split("-");
        var fmtDdMmYyyy = (dParts.length === 3 ? dParts[2] + "/" + dParts[1] + "/" + dParts[0] : rowDate);
        filteredList.push({
          idPresensi: row[COL_PRESENSI.ID],
          idKaryawan: row[COL_PRESENSI.ID_PEG],
          nama: row[COL_PRESENSI.NAMA],
          tanggal: rowDate,
          formattedDate: fmtDdMmYyyy,
          checkIn: formatTimeOnly(row[COL_PRESENSI.IN_TIME]) || "-",
          statusMasuk: row[COL_PRESENSI.IN_STAT] || "-",
          jarakMasuk: row[COL_PRESENSI.IN_DIST] || "-",
          fotoMasukUrl: row[COL_PRESENSI.IN_FOTO] || "",
          checkOut: formatTimeOnly(row[COL_PRESENSI.OUT_TIME]) || "-",
          statusPulang: row[COL_PRESENSI.OUT_STAT] || "-",
          jarakPulang: row[COL_PRESENSI.OUT_DIST] || "-",
          fotoPulangUrl: row[COL_PRESENSI.OUT_FOTO] || "",
          totalHours: row[COL_PRESENSI.HOURS] || "-",
          lokasi: row[COL_PRESENSI.LOKASI] || "Office"
        });
      }
    }

    return {
      success: true,
      startDate: startClean,
      endDate: endClean,
      isPersonal: isPegawai,
      userName: auth.user.nama,
      totalData: filteredList.length,
      data: filteredList
    };
  } catch (err) {
    return { success: false, message: "Gagal mengambil data laporan: " + err.message };
  }
}

/**
 * 12. API: Pencarian Lokasi Kantor Resmi Menggunakan Google Maps Native Geocoder Engine (Maps.newGeocoder)
 */
function apiSearchGoogleMapsLocation(token, query) {
  var auth = validateSession_(token);
  if (!auth.valid) return { success: false, message: auth.message, code: auth.code };

  try {
    var cleanQuery = String(query || "").trim();
    if (!cleanQuery) return { success: false, message: "Ketik nama tempat, alamat, atau link Google Maps." };

    // 1. Ekstrak koordinat langsung jika user menginput koordinat angka: -6.123, 106.123
    var coordMatch = cleanQuery.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (coordMatch) {
      return {
        success: true,
        lat: parseFloat(coordMatch[1]),
        lon: parseFloat(coordMatch[2]),
        address: "Titik Koordinat: " + coordMatch[1] + ", " + coordMatch[2]
      };
    }

    // 2. Ekstrak koordinat jika user menempel link URL Google Maps (@lat,lon atau !3d/!4d atau q=lat,lon)
    var urlCoordMatch = cleanQuery.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                        cleanQuery.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                        cleanQuery.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (urlCoordMatch) {
      return {
        success: true,
        lat: parseFloat(urlCoordMatch[1]),
        lon: parseFloat(urlCoordMatch[2]),
        address: "Lokasi dari Link Google Maps"
      };
    }

    // 2b. Dukungan Link Pendek Google Maps (maps.app.goo.gl atau goo.gl/maps)
    if (cleanQuery.indexOf("maps.app.goo.gl") !== -1 || cleanQuery.indexOf("goo.gl/maps") !== -1) {
      try {
        var response = UrlFetchApp.fetch(cleanQuery, { followRedirects: false, muteHttpExceptions: true });
        var headers = response.getAllHeaders();
        var redirectUrl = headers["Location"] || headers["location"] || "";
        if (redirectUrl) {
          var redirectCoordMatch = redirectUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                   redirectUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                                   redirectUrl.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (redirectCoordMatch) {
            return {
              success: true,
              lat: parseFloat(redirectCoordMatch[1]),
              lon: parseFloat(redirectCoordMatch[2]),
              address: "Lokasi dari Link Google Maps"
            };
          }
        }
      } catch (e) {
        // Lanjutkan ke Geocoder jika unshortening gagal
      }
    }

    // 3. Pencarian Lokasi via Google Maps Geocoder Resmi Google Apps Script
    var geocoder = Maps.newGeocoder().setRegion("id");
    var res = geocoder.geocode(cleanQuery);

    if (res && res.status === "OK" && res.results && res.results.length > 0) {
      var topResult = res.results[0];
      var loc = topResult.geometry.location;
      return {
        success: true,
        lat: loc.lat,
        lon: loc.lng,
        address: topResult.formatted_address || cleanQuery
      };
    }

    // Jika belum ketemu, coba pencarian global tanpa pembatas region
    var resGlobal = Maps.newGeocoder().geocode(cleanQuery);
    if (resGlobal && resGlobal.status === "OK" && resGlobal.results && resGlobal.results.length > 0) {
      var topResGlobal = resGlobal.results[0];
      var locGlobal = topResGlobal.geometry.location;
      return {
        success: true,
        lat: locGlobal.lat,
        lon: locGlobal.lng,
        address: topResGlobal.formatted_address || cleanQuery
      };
    }

    return {
      success: false,
      message: "Lokasi '" + cleanQuery + "' tidak ditemukan di Google Maps. Coba ketik nama jalan, kelurahan, atau geser pin langsung di peta."
    };
  } catch (err) {
    return { success: false, message: "Pencarian Google Maps: " + err.message };
  }
}

// ================================================================================
// FUNGSI HELPER & LOGIKA MATEMATIKA REKAYASA SISTEM
// ================================================================================

/**
 * Rumus Geofencing Haversine:
 * Menghitung jarak presisi (dalam meter) antara 2 titik koordinat bumi.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  var R = 6371000; // Radius Bumi dalam meter
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Kalkulasi Durasi Kerja Riil (Check-In s/d Check-Out)
 * Format output: { shortFormat: "08:03", humanText: "8 Jam 3 Menit" }
 */
function calculateWorkDuration(inTimeStr, outTimeStr) {
  if (!inTimeStr || !outTimeStr) return { shortFormat: "-", humanText: "-" };

  var inParts = inTimeStr.split(":");
  var outParts = outTimeStr.split(":");

  var inMinutes = parseInt(inParts[0], 10) * 60 + parseInt(inParts[1], 10);
  var outMinutes = parseInt(outParts[0], 10) * 60 + parseInt(outParts[1], 10);

  var diffMinutes = outMinutes - inMinutes;
  if (diffMinutes < 0) diffMinutes = 0; // proteksi jika shift malam atau typo

  var hours = Math.floor(diffMinutes / 60);
  var mins = diffMinutes % 60;

  var padHours = (hours < 10 ? "0" : "") + hours;
  var padMins = (mins < 10 ? "0" : "") + mins;

  return {
    shortFormat: padHours + ":" + padMins,
    humanText: hours + " Jam " + mins + " Menit"
  };
}

/**
 * Helper: Ambil atau buat folder khusus Google Drive untuk foto presensi
 */
function getOrCreateDriveFolder() {
  var folderName = "Al Hunafa Attendance Photos";
  try {
    var config = getSystemConfig();
    if (config && config.GOOGLE_DRIVE_FOLDER_NAME) {
      folderName = config.GOOGLE_DRIVE_FOLDER_NAME;
    }
  } catch (e) {
    Logger.log("Config fallback for Drive folder: " + e.message);
  }

  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }

  var newFolder = DriveApp.createFolder(folderName);
  try {
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    Logger.log("Folder permission note: " + err.message);
  }
  return newFolder;
}

/**
 * Upload gambar Base64 ke folder Google Drive
 */
function uploadBase64ImageToDrive(base64Data, fileName) {
  try {
    var folder = getOrCreateDriveFolder();
    var contentType = "image/jpeg";
    var cleanBase64 = base64Data;

    if (base64Data.indexOf(",") !== -1) {
      var parts = base64Data.split(",");
      var header = parts[0];
      cleanBase64 = parts[1];
      if (header.indexOf("image/png") !== -1) contentType = "image/png";
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decodedBytes, contentType, fileName + ".jpg");
    var file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log("Drive sharing note: " + e.message);
    }

    // Mengembalikan direct URL Google Drive
    return file.getUrl();
  } catch (err) {
    Logger.log("Error upload Drive: " + err.message);
    return "Error Upload: " + err.message;
  }
}

/**
 * Generator ID Unik Sekuensial Anti-Tabrakan: PREFIX-YYYYMM-XXX
 */
function generateIncrementalId(sheet, prefix) {
  var data = sheet.getDataRange().getValues();
  var monthCode = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMM");
  var targetPrefix = prefix + monthCode + "-";
  var maxNumber = 0;

  for (var i = 1; i < data.length; i++) {
    var currentId = String(data[i][0]).trim();
    if (currentId.indexOf(targetPrefix) === 0) {
      var numPart = parseInt(currentId.substring(targetPrefix.length), 10);
      if (!isNaN(numPart) && numPart > maxNumber) {
        maxNumber = numPart;
      }
    } else if (prefix === "PEG-" && currentId.indexOf("PEG-") === 0) {
      var pegNum = parseInt(currentId.substring(4), 10);
      if (!isNaN(pegNum) && pegNum > maxNumber) {
        maxNumber = pegNum;
      }
    }
  }

  var nextNumber = maxNumber + 1;
  var paddedNumber = (nextNumber < 10 ? "00" : nextNumber < 100 ? "0" : "") + nextNumber;

  if (prefix === "PEG-") {
    return "PEG-" + paddedNumber;
  }
  return targetPrefix + paddedNumber;
}

/**
 * Format string jam hanya HH:mm:ss (Kebal pergeseran timezone Date 1899)
 */
function formatTimeOnly(val) {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    try {
      return Utilities.formatDate(val, "Asia/Jakarta", "HH:mm:ss");
    } catch (eFmt) {
      var h = val.getHours();
      var m = val.getMinutes();
      var s = val.getSeconds();
      var padH = (h < 10 ? "0" : "") + h;
      var padM = (m < 10 ? "0" : "") + m;
      var padS = (s < 10 ? "0" : "") + s;
      return padH + ":" + padM + ":" + padS;
    }
  }
  var str = String(val).trim();
  if (str.length >= 8 && str.indexOf(":") !== -1) return str.substring(0, 8);
  if (str.length === 5 && str.indexOf(":") !== -1) return str + ":00";
  return str;
}

/**
 * Normalisasi tanggal ke format 'YYYY-MM-DD' (Kebal terhadap format DD/MM/YYYY, ISO, maupun objek Date)
 */
function normalizeDateToYMD_(val) {
  if (!val) return "";

  // 1. Jika berupa objek Date
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    try {
      return Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
    } catch (eFmt) {
      var y = val.getFullYear();
      var m = val.getMonth() + 1;
      var d = val.getDate();
      return y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
    }
  }

  var str = String(val).trim();
  if (!str) return "";

  // 2. Format ISO YYYY-MM-DD (e.g. "2026-10-28" atau "2026-10-28T00:00:00")
  var isoMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    var year = isoMatch[1];
    var month = (parseInt(isoMatch[2], 10) < 10 ? "0" : "") + parseInt(isoMatch[2], 10);
    var day = (parseInt(isoMatch[3], 10) < 10 ? "0" : "") + parseInt(isoMatch[3], 10);
    return year + "-" + month + "-" + day;
  }

  // 3. Format Lokal Indonesia / Eropa DD/MM/YYYY atau DD-MM-YYYY (e.g. "28/10/2026")
  var ddmmyyyyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (ddmmyyyyMatch) {
    var dDay = (parseInt(ddmmyyyyMatch[1], 10) < 10 ? "0" : "") + parseInt(ddmmyyyyMatch[1], 10);
    var dMonth = (parseInt(ddmmyyyyMatch[2], 10) < 10 ? "0" : "") + parseInt(ddmmyyyyMatch[2], 10);
    var dYear = ddmmyyyyMatch[3];
    return dYear + "-" + dMonth + "-" + dDay;
  }

  // 4. Fallback jika format teks lain
  try {
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, "Asia/Jakarta", "yyyy-MM-dd");
    }
  } catch (e) {}

  return str.substring(0, 10);
}

/**
 * Format riwayat tanggal dari string 'YYYY-MM-DD' secara aman tanpa ketergantungan new Date lokal
 */
function formatHistoryDate_(rawDateStr) {
  if (!rawDateStr || rawDateStr.indexOf("-") === -1) {
    return { dayNumber: "-", dayName: "-", formattedDate: rawDateStr || "-" };
  }
  var parts = rawDateStr.split("-");
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  var dObj = new Date(y, m, d);
  var dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  var dayFullNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var dayIdx = isNaN(dObj.getTime()) ? 0 : dObj.getDay();
  return {
    dayNumber: String(d),
    dayName: dayNames[dayIdx],
    formattedDate: dayFullNames[dayIdx] + ", " + d + " " + (monthNames[m] || "") + " " + y
  };
}

/**
 * Konversi HH:mm ke total menit
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = String(timeStr).split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
}

/**
 * Helper mencari nama karyawan berdasarkan ID
 */
function getKaryawanName(idKaryawan) {
  var sheet = getDbSheet("DataKaryawan");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_KARYAWAN.ID]).trim() === idKaryawan) {
      return String(data[i][COL_KARYAWAN.NAMA]).trim();
    }
  }
  return "Pegawai";
}

/**
  * Alias helper mencari nama karyawan berdasarkan ID
  */
function getNamaKaryawanById(idKaryawan) {
  return getKaryawanName(idKaryawan);
}

