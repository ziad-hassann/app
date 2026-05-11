(function () {
  const form = document.getElementById("registrationForm");
  const fullNameInput = document.getElementById("fullName");
  const phoneInput = document.getElementById("phone");
  const birthDateInput = document.getElementById("birthDate");
  const birthDaySelect = document.getElementById("birthDay");
  const birthMonthSelect = document.getElementById("birthMonth");
  const birthYearSelect = document.getElementById("birthYear");
  const branchSelect = document.getElementById("branch");
  const otherBranchField = document.getElementById("otherBranchField");
  const otherBranchInput = document.getElementById("otherBranch");
  const membershipTypeSelect = document.getElementById("membershipType");
  const statusBox = document.getElementById("formStatus");
  const submitButton = document.getElementById("submitButton");
  const membershipChoices = Array.from(document.querySelectorAll(".membership-choice"));

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function getDaysInSelectedMonth() {
    const month = Number(birthMonthSelect.value);
    const year = Number(birthYearSelect.value) || new Date().getFullYear();

    if (!month) {
      return 31;
    }

    return new Date(year, month, 0).getDate();
  }

  function updateDayOptions() {
    const selectedDay = birthDaySelect.value;
    const maxDays = getDaysInSelectedMonth();

    birthDaySelect.innerHTML = '<option value="">Day</option>';

    for (let day = 1; day <= maxDays; day += 1) {
      addOption(birthDaySelect, String(day).padStart(2, "0"), String(day).padStart(2, "0"));
    }

    if (selectedDay && Number(selectedDay) <= maxDays) {
      birthDaySelect.value = selectedDay;
    }
  }

  function setupBirthDateFields() {
    const currentYear = new Date().getFullYear();

    updateDayOptions();

    monthNames.forEach(function (month, index) {
      addOption(birthMonthSelect, String(index + 1).padStart(2, "0"), month);
    });

    for (let year = currentYear; year >= 1900; year -= 1) {
      addOption(birthYearSelect, String(year), String(year));
    }
  }

  function syncBirthDate() {
    if (birthDaySelect.value && birthMonthSelect.value && birthYearSelect.value) {
      birthDateInput.value = birthYearSelect.value + "-" + birthMonthSelect.value + "-" + birthDaySelect.value;
      return;
    }

    birthDateInput.value = "";
  }

  function markSelectedMembership(value) {
    membershipChoices.forEach(function (button) {
      button.classList.toggle("membership-choice--selected", button.dataset.membership === value);
    });
  }

  setupBirthDateFields();

  branchSelect.addEventListener("change", function () {
    const isOtherBranch = branchSelect.value === "__other_branch__";
    otherBranchField.classList.toggle("hidden", !isOtherBranch);
    otherBranchInput.required = isOtherBranch;

    if (!isOtherBranch) {
      otherBranchInput.value = "";
    }
  });

  form.addEventListener("input", function () {
    WebData.clearStatus(statusBox);
  });

  fullNameInput.addEventListener("input", function () {
    fullNameInput.value = fullNameInput.value.replace(/[^\u0600-\u06FF\s]/g, "");
  });

  [birthDaySelect, birthMonthSelect, birthYearSelect].forEach(function (select) {
    select.addEventListener("change", function () {
      if (select !== birthDaySelect) {
        updateDayOptions();
      }

      syncBirthDate();
      WebData.clearStatus(statusBox);
    });
  });

  membershipChoices.forEach(function (button) {
    button.addEventListener("click", function () {
      membershipTypeSelect.value = button.dataset.membership;
      markSelectedMembership(button.dataset.membership);
      WebData.clearStatus(statusBox);
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    submitButton.disabled = true;
    WebData.setStatus(statusBox, "info", "جاري تسجيل البيانات...");

    const fullName = WebData.cleanText(fullNameInput.value);
    const phoneCheck = WebData.validatePhone(phoneInput.value);
    const birthDateCheck = WebData.parseBirthDate(birthDateInput.value);
    const branch =
      branchSelect.value === "__other_branch__"
        ? WebData.cleanText(otherBranchInput.value)
        : WebData.cleanText(branchSelect.value);
    const membershipType = WebData.cleanText(membershipTypeSelect.value);

    if (fullName.length < 3) {
      WebData.setStatus(statusBox, "error", "اكتب الاسم بالكامل.");
      submitButton.disabled = false;
      return;
    }

    if (!/^[\u0600-\u06FF\s]+$/.test(fullName)) {
      WebData.setStatus(statusBox, "error", "اكتب الاسم باللغة العربية فقط.");
      submitButton.disabled = false;
      return;
    }

    if (!phoneCheck.valid) {
      WebData.setStatus(statusBox, "error", phoneCheck.message);
      submitButton.disabled = false;
      return;
    }

    if (!birthDateCheck.valid) {
      WebData.setStatus(statusBox, "error", birthDateCheck.message);
      submitButton.disabled = false;
      return;
    }

    if (!branch) {
      WebData.setStatus(statusBox, "error", "اختار الفرع أو اكتب اسم الفرع.");
      submitButton.disabled = false;
      return;
    }

    if (!membershipType) {
      WebData.setStatus(statusBox, "error", "اختار نوع العضوية.");
      submitButton.disabled = false;
      return;
    }

    const record = {
      id: WebData.makeId(),
      full_name: fullName,
      normalized_name: WebData.normalizeMemberName(fullName),
      phone: phoneCheck.normalized,
      normalized_phone: phoneCheck.normalized,
      birth_date: birthDateCheck.iso,
      branch: branch,
      membership_type: membershipType,
      whatsapp_url: WebData.getWhatsappUrl(phoneCheck.normalized),
      created_at: new Date().toISOString()
    };

    try {
      const result = await WebData.createRegistration(record);

      if (result.duplicate) {
        WebData.setStatus(statusBox, "error", result.message || "تم تسجيل هذا العضو من قبل.");
        submitButton.disabled = false;
        return;
      }

      form.reset();
      birthDateInput.value = "";
      markSelectedMembership("");
      otherBranchField.classList.add("hidden");
      otherBranchInput.required = false;
      WebData.setStatus(statusBox, "success", result.message || "تم تسجيل بيانات العضو بنجاح.");
    } catch (error) {
      WebData.setStatus(statusBox, "error", error.message || "تعذر تسجيل البيانات. حاول مرة أخرى.");
    } finally {
      submitButton.disabled = false;
    }
  });
})();
