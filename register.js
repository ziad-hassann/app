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
  window.setTimeout(WebData.warmRemoteApi, 800);

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
    WebData.setStatus(statusBox, "info", "\u062c\u0627\u0631\u064a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a...");

    const fullName = WebData.cleanText(fullNameInput.value);
    const phoneCheck = WebData.validatePhone(phoneInput.value);
    const birthDateCheck = WebData.parseBirthDate(birthDateInput.value);
    const branch =
      branchSelect.value === "__other_branch__"
        ? WebData.cleanText(otherBranchInput.value)
        : WebData.cleanText(branchSelect.value);
    const membershipType = WebData.cleanText(membershipTypeSelect.value);

    if (fullName.length < 3) {
      WebData.setStatus(statusBox, "error", "\u0627\u0643\u062a\u0628 \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644.");
      submitButton.disabled = false;
      return;
    }

    if (!/^[\u0600-\u06FF\s]+$/.test(fullName)) {
      WebData.setStatus(statusBox, "error", "\u0627\u0643\u062a\u0628 \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0641\u0642\u0637.");
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
      WebData.setStatus(statusBox, "error", "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0641\u0631\u0639 \u0623\u0648 \u0627\u0643\u062a\u0628 \u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639.");
      submitButton.disabled = false;
      return;
    }

    if (!membershipType) {
      WebData.setStatus(statusBox, "error", "\u0627\u062e\u062a\u0627\u0631 \u0646\u0648\u0639 \u0627\u0644\u0639\u0636\u0648\u064a\u0629.");
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
        WebData.setStatus(statusBox, "error", result.message || "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0647\u0630\u0627 \u0627\u0644\u0639\u0636\u0648 \u0645\u0646 \u0642\u0628\u0644.");
        submitButton.disabled = false;
        return;
      }

      form.reset();
      birthDateInput.value = "";
      markSelectedMembership("");
      otherBranchField.classList.add("hidden");
      otherBranchInput.required = false;
      WebData.setStatus(statusBox, "success", result.message || "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u0636\u0648 \u0628\u0646\u062c\u0627\u062d.");
    } catch (error) {
      WebData.setStatus(statusBox, "error", error.message || "\u062a\u0639\u0630\u0631 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.");
    } finally {
      submitButton.disabled = false;
    }
  });
})();
