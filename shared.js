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
    const dmy = normalized.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    const ymd = normalized.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    let day;
    let month;
    let year;

    if (dmy) {
      day = Number(dmy[1]);
      month = Number(dmy[2]);
      year = Number(dmy[3]);
    } else if (ymd) {
      year = Number(ymd[1]);
      month = Number(ymd[2]);
      day = Number(ymd[3]);
    } else {
      return {
        valid: false,
        iso: "",
        message: "اكتب تاريخ الميلاد بصيغة يوم/شهر/سنة مثل 15/01/2000."
      };
    }

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

  function getRegistrations() {
    try {
      const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(records) ? records : [];
    } catch (error) {
      return [];
    }
  }

  function saveRegistrations(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function addRegistration(record) {
    const records = getRegistrations();
    const exists = records.some(function (item) {
      const itemName = item.normalized_name || normalizeMemberName(item.full_name);
      return item.normalized_phone === record.normalized_phone && itemName === record.normalized_name;
    });

    if (exists) {
      return { duplicate: true };
    }

    records.push(record);
    saveRegistrations(records);
    return { duplicate: false, record: record };
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
    getRegistrations: getRegistrations,
    addRegistration: addRegistration,
    formatDisplayDate: formatDisplayDate,
    makeId: makeId,
    setStatus: setStatus,
    clearStatus: clearStatus
  };
})();
