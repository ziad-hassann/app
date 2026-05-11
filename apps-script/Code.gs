const ADMIN_PASSWORD = 'admin123';
const SHEET_NAME = 'Registrations';

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
  const sheet = getSheet_();
  const rows = getRecords_();
  const normalizedPhone = String(record.normalized_phone || '').trim();
  const normalizedName = String(record.normalized_name || '').trim();

  if (!record.full_name || !normalizedPhone || !normalizedName) {
    return { ok: false, message: 'بيانات التسجيل غير مكتملة.' };
  }

  const exists = rows.some(function (item) {
    return (
      String(item.normalized_phone || '').trim() === normalizedPhone &&
      String(item.normalized_name || '').trim() === normalizedName
    );
  });

  if (exists) {
    return { ok: true, duplicate: true, message: 'تم تسجيل هذا العضو من قبل.' };
  }

  const values = HEADERS.map(function (header) {
    const value = record[header];
    return value === null || value === undefined ? '' : String(value);
  });
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, HEADERS.length).setNumberFormat('@').setValues([values]);

  return { ok: true, duplicate: false, message: 'تم تسجيل بيانات العضو بنجاح.' };
}

function list_(params) {
  if (params.admin_password !== ADMIN_PASSWORD) {
    return { ok: false, message: 'كلمة السر غير صحيحة.' };
  }

  return {
    ok: true,
    registrations: getRecords_().reverse()
  };
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
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat('@');

  return sheet;
}

function getRecords_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();

  return values.map(function (row) {
    const record = {};
    HEADERS.forEach(function (header, index) {
      record[header] = row[index];
    });
    return record;
  });
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
