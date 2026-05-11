const ADMIN_PASSWORD_PROPERTY = 'ADMIN_PASSWORD';
const SHEET_NAME = 'Registrations';
const RECORDS_CACHE_KEY = 'registrations-json-v1';
const RECORDS_CACHE_SECONDS = 60;

const HEADERS = [
  'id',
  'full_name',
  'normalized_name',
  'phone',
  'normalized_phone',
  'birth_date',
  'branch',
  'membership_type',
  'whatsapp_url',
  'created_at'
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || '';

  try {
    if (action === 'register') {
      return respond_(register_(params), params.callback);
    }

    if (action === 'list') {
      return respond_(list_(params), params.callback);
    }

    return respond_({ ok: true, message: 'The Meg Academy API is running.' }, params.callback);
  } catch (error) {
    return respond_({ ok: false, message: error.message || String(error) }, params.callback);
  }
}

function register_(params) {
  const payloadText = params.payload || '';
  const record = JSON.parse(payloadText);
  const lock = LockService.getScriptLock();
  const sheet = getSheet_();
  const normalizedPhone = String(record.normalized_phone || '').trim();
  const normalizedName = String(record.normalized_name || '').trim();

  if (!record.full_name || !normalizedPhone || !normalizedName) {
    return { ok: false, message: 'بيانات التسجيل غير مكتملة.' };
  }

  lock.waitLock(10000);

  try {
    if (duplicateExists_(sheet, normalizedPhone, normalizedName)) {
      return { ok: true, duplicate: true, message: 'تم تسجيل هذا العضو من قبل.' };
    }

    const values = HEADERS.map(function (header) {
      const value = record[header];
      return value === null || value === undefined ? '' : String(value);
    });
    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, HEADERS.length).setNumberFormat('@').setValues([values]);
    CacheService.getScriptCache().remove(RECORDS_CACHE_KEY);
  } finally {
    lock.releaseLock();
  }

  return { ok: true, duplicate: false, message: 'تم تسجيل بيانات العضو بنجاح.' };
}

function list_(params) {
  if (params.admin_password !== getAdminPassword_()) {
    return { ok: false, message: 'كلمة السر غير صحيحة.' };
  }

  return {
    ok: true,
    registrations: getRecords_().reverse()
  };
}

function getAdminPassword_() {
  return PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_PROPERTY) || '';
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every(function (header, index) {
    return firstRow[index] === header;
  });

  if (!hasHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setNumberFormat('@');
  }

  return sheet;
}

function duplicateExists_(sheet, normalizedPhone, normalizedName) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const values = sheet.getRange(2, 3, lastRow - 1, 3).getDisplayValues();

  return values.some(function (row) {
    return (
      String(row[0] || '').trim() === normalizedName &&
      String(row[2] || '').trim() === normalizedPhone
    );
  });
}

function getRecords_() {
  const cached = CacheService.getScriptCache().get(RECORDS_CACHE_KEY);

  if (cached) {
    return JSON.parse(cached);
  }

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();

  const records = values.map(function (row) {
    const record = {};
    HEADERS.forEach(function (header, index) {
      record[header] = row[index];
    });
    return record;
  });

  const recordsJson = JSON.stringify(records);

  if (recordsJson.length < 90000) {
    CacheService.getScriptCache().put(RECORDS_CACHE_KEY, recordsJson, RECORDS_CACHE_SECONDS);
  }

  return records;
}

function respond_(data, callback) {
  const json = JSON.stringify(data);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
