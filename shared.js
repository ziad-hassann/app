(function () {
  const STORAGE_KEY = "web_data_registrations_v1";

  const arabicDigits = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9"
  };

  function getConfig() {
    return window.WEB_DATA_CONFIG || {};
  }

  function getAppsScriptUrl() {
    return String(getConfig().APPS_SCRIPT_URL || "").trim();
  }

  function hasRemoteApi() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(getAppsScriptUrl());
  }

  function apiRequest(params) {
    const apiUrl = getAppsScriptUrl();

    if (!hasRemoteApi()) {
      return Promise.reject(new Error("Apps Script URL is not configured."));
    }

    return new Promise(function (resolve, reject) {
      const callbackName =
        "__webDataCallback_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      const script = document.createElement("script");
      const url = new URL(apiUrl);
      const timeout = window.setTimeout(function () {
        cleanup();
        reject(new Error("Google Sheet connection timed out."));
      }, 60000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      window[callbackName] = function (response) {
        cleanup();

        if (!response || response.ok === false) {
          reject(new Error((response && response.message) || "Google Sheet request failed."));
          return;
        }

        resolve(response);
      };

      Object.keys(params || {}).forEach(function (key) {
        url.searchParams.set(key, params[key]);
      });
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", Date.now());

      script.onerror = function () {
        cleanup();
        reject(new Error("Could not connect to Google Sheet."));
      };

      script.src = url.toString();
      document.body.appendChild(script);
    });
  }

  function toLatinDigits(value) {
    return String(value || "").replace(/[٠-٩۰-۹]/g, function (digit) {
      return arabicDigits[digit];
    });
  }

  function cleanText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeMemberName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[ًٌٍَُِّْ]/g, "");
  }

  function normalizePhone(value) {
    let digits = toLatinDigits(value).replace(/\D/g, "");

    if (digits.startsWith("0020")) {
      digits = "0" + digits.slice(4);
    } else if (digits.startsWith("20")) {
      digits = "0" + digits.slice(2);
    } else if (digits.length === 10 && digits.startsWith("1")) {
      digits = "0" + digits;
    }

    return digits;
  }

  function validatePhone(value) {
    const normalized = normalizePhone(value);

    if (!/^01[0125][0-9]{8}$/.test(normalized)) {
      return {
        valid: false,
        normalized: normalized,
        message: "اكتب رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015."
      };
    }

    return { valid: true, normalized: normalized, message: "" };
  }

  function isRealDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function parseBirthDate(value) {
    const normalized = toLatinDigits(value).trim();
    const ymd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let day;
    let month;
    let year;

    if (!ymd) {
      return { valid: false, iso: "", message: "اختار تاريخ الميلاد بالكامل." };
    }

    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);

    if (year < 1900 || year > new Date().getFullYear() || !isRealDate(year, month, day)) {
      return { valid: false, iso: "", message: "اختار تاريخ ميلاد صحيح." };
    }

    return {
      valid: true,
      iso: year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"),
      message: ""
    };
  }

  function getWhatsappUrl(phone) {
    const normalized = normalizePhone(phone);
    return "https://wa.me/20" + normalized.slice(1);
  }

  function getLocalRegistrations() {
    try {
      const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(records) ? records : [];
    } catch (error) {
      return [];
    }
  }

  function saveLocalRegistrations(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function addLocalRegistration(record) {
    const records = getLocalRegistrations();
    const exists = records.some(function (item) {
      const itemName = item.normalized_name || normalizeMemberName(item.full_name);
      return item.normalized_phone === record.normalized_phone && itemName === record.normalized_name;
    });

    if (exists) {
      return { ok: true, duplicate: true, message: "تم تسجيل هذا العضو من قبل." };
    }

    records.push(record);
    saveLocalRegistrations(records);
    return { ok: true, duplicate: false, record: record, message: "تم تسجيل بيانات العضو بنجاح." };
  }

  function createRegistration(record) {
    if (!hasRemoteApi()) {
      return Promise.resolve(addLocalRegistration(record));
    }

    return apiRequest({
      action: "register",
      payload: JSON.stringify(record)
    });
  }

  function listRegistrations(adminPassword) {
    if (!hasRemoteApi()) {
      return Promise.resolve(getLocalRegistrations());
    }

    return apiRequest({
      action: "list",
      admin_password: adminPassword || ""
    }).then(function (response) {
      return response.registrations || [];
    });
  }

  function formatDisplayDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function makeId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function setStatus(element, type, message) {
    element.className = "status status--" + type;
    element.textContent = message;
    element.classList.remove("hidden");
  }

  function clearStatus(element) {
    element.textContent = "";
    element.className = "status hidden";
  }

  window.WebData = {
    cleanText: cleanText,
    normalizeMemberName: normalizeMemberName,
    validatePhone: validatePhone,
    parseBirthDate: parseBirthDate,
    getWhatsappUrl: getWhatsappUrl,
    createRegistration: createRegistration,
    listRegistrations: listRegistrations,
    formatDisplayDate: formatDisplayDate,
    makeId: makeId,
    setStatus: setStatus,
    clearStatus: clearStatus
  };
})();
