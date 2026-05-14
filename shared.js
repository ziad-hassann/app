(function () {
  const STORAGE_KEY = "web_data_registrations_v1";

  const arabicDigits = {
    "\u0660": "0",
    "\u0661": "1",
    "\u0662": "2",
    "\u0663": "3",
    "\u0664": "4",
    "\u0665": "5",
    "\u0666": "6",
    "\u0667": "7",
    "\u0668": "8",
    "\u0669": "9",
    "\u06f0": "0",
    "\u06f1": "1",
    "\u06f2": "2",
    "\u06f3": "3",
    "\u06f4": "4",
    "\u06f5": "5",
    "\u06f6": "6",
    "\u06f7": "7",
    "\u06f8": "8",
    "\u06f9": "9"
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
      }, 180000);

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
    return String(value || "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, function (digit) {
      return arabicDigits[digit];
    });
  }

  function cleanText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeMemberName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[\u064e\u064b\u064f\u064c\u0650\u064d\u0652\u0651]/g, "");
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
        message: "\u0627\u0643\u062a\u0628 \u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064a\u0644 \u0645\u0635\u0631\u064a \u0635\u062d\u064a\u062d \u064a\u0628\u062f\u0623 \u0628\u0640 010 \u0623\u0648 011 \u0623\u0648 012 \u0623\u0648 015."
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
      return { valid: false, iso: "", message: "\u0627\u062e\u062a\u0627\u0631 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f \u0628\u0627\u0644\u0643\u0627\u0645\u0644." };
    }

    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);

    if (year < 1900 || year > new Date().getFullYear() || !isRealDate(year, month, day)) {
      return { valid: false, iso: "", message: "\u0627\u062e\u062a\u0627\u0631 \u062a\u0627\u0631\u064a\u062e \u0645\u064a\u0644\u0627\u062f \u0635\u062d\u064a\u062d." };
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
      return { ok: true, duplicate: true, message: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0647\u0630\u0627 \u0627\u0644\u0639\u0636\u0648 \u0645\u0646 \u0642\u0628\u0644." };
    }

    records.push(record);
    saveLocalRegistrations(records);
    return { ok: true, duplicate: false, record: record, message: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u0636\u0648 \u0628\u0646\u062c\u0627\u062d." };
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

  function warmRemoteApi() {
    if (!hasRemoteApi()) {
      return Promise.resolve();
    }

    return apiRequest({ action: "ping" }).catch(function () {});
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
    warmRemoteApi: warmRemoteApi,
    formatDisplayDate: formatDisplayDate,
    makeId: makeId,
    setStatus: setStatus,
    clearStatus: clearStatus
  };
})();
