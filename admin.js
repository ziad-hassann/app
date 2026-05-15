(function () {
  const loginPanel = document.getElementById("loginPanel");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("adminPassword");
  const loginStatus = document.getElementById("loginStatus");
  const dashboard = document.getElementById("dashboard");
  const dashboardStatus = document.getElementById("dashboardStatus");
  const totalCount = document.getElementById("totalCount");
  const branchesCount = document.getElementById("branchesCount");
  const visibleCount = document.getElementById("visibleCount");
  const visibleLabel = document.getElementById("visibleLabel");
  const selectedCount = document.getElementById("selectedCount");
  const branchTabs = document.getElementById("branchTabs");
  const recordsBody = document.getElementById("recordsBody");
  const emptyState = document.getElementById("emptyState");
  const refreshButton = document.getElementById("refreshButton");
  const selectVisibleButton = document.getElementById("selectVisibleButton");
  const clearSelectionButton = document.getElementById("clearSelectionButton");
  const exportButton = document.getElementById("exportButton");
  const selectVisibleToggle = document.getElementById("selectVisibleToggle");

  let records = [];
  let activeBranch = "all";
  let currentAdminPassword = "";
  let selectedIds = new Set();

  window.setTimeout(WebData.warmRemoteApi, 800);

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function groupByBranch(list) {
    return list.reduce(function (groups, record) {
      const branch = record.branch || "\u0628\u062f\u0648\u0646 \u0641\u0631\u0639";
      groups[branch] = groups[branch] || [];
      groups[branch].push(record);
      return groups;
    }, {});
  }

  function getBranchNames(grouped) {
    return Object.keys(grouped).sort(function (a, b) {
      return a.localeCompare(b, "ar");
    });
  }

  function getVisibleRecords(grouped) {
    if (activeBranch === "all") {
      return records;
    }

    return grouped[activeBranch] || [];
  }

  function getRecordKey(record) {
    if (record.id) {
      return String(record.id);
    }

    return [
      record.normalized_phone || record.phone || "",
      record.normalized_name || record.full_name || "",
      record.created_at || ""
    ].join("|");
  }

  function getSelectedRecords() {
    return records.filter(function (record) {
      return selectedIds.has(getRecordKey(record));
    });
  }

  function syncSelectedIds() {
    const currentIds = new Set(records.map(getRecordKey));

    selectedIds.forEach(function (id) {
      if (!currentIds.has(id)) {
        selectedIds.delete(id);
      }
    });
  }

  function createBranchButton(label, count, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = value === activeBranch ? "branch-tab branch-tab--active" : "branch-tab";
    button.textContent = label + " ";

    const countTag = document.createElement("span");
    countTag.textContent = count;
    button.appendChild(countTag);

    button.addEventListener("click", function () {
      activeBranch = value;
      render();
    });

    return button;
  }

  function renderTabs(grouped, branches) {
    branchTabs.innerHTML = "";
    branchTabs.appendChild(createBranchButton("\u0627\u0644\u0643\u0644", records.length, "all"));

    branches.forEach(function (branch) {
      branchTabs.appendChild(createBranchButton(branch, grouped[branch].length, branch));
    });
  }

  function renderTable(list) {
    recordsBody.innerHTML = "";
    emptyState.classList.toggle("hidden", list.length > 0);

    list.forEach(function (record) {
      const row = document.createElement("tr");
      const recordKey = getRecordKey(record);

      row.innerHTML =
        '<td class="select-cell"><input class="select-checkbox record-select" type="checkbox" data-record-id="' + escapeHtml(recordKey) + '" aria-label="\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u062a\u0633\u062c\u064a\u0644"' + (selectedIds.has(recordKey) ? " checked" : "") + "></td>" +
        "<td>" + escapeHtml(record.full_name) + "</td>" +
        "<td>" + escapeHtml(record.phone) + "</td>" +
        "<td>" + escapeHtml(record.birth_date) + "</td>" +
        "<td>" + escapeHtml(record.branch) + "</td>" +
        "<td>" + escapeHtml(record.membership_type) + "</td>" +
        '<td><a class="whatsapp-link" href="' + escapeHtml(record.whatsapp_url) + '" target="_blank">\u0641\u062a\u062d \u0648\u0627\u062a\u0633\u0627\u0628</a></td>' +
        "<td>" + escapeHtml(WebData.formatDisplayDate(record.created_at)) + "</td>";

      recordsBody.appendChild(row);
    });
  }

  function updateSelectionControls(visibleRecords) {
    const visibleIds = visibleRecords.map(getRecordKey);
    const selectedVisibleCount = visibleIds.filter(function (id) {
      return selectedIds.has(id);
    }).length;

    selectedCount.textContent = selectedIds.size;
    selectVisibleButton.disabled = visibleIds.length === 0;
    clearSelectionButton.disabled = selectedIds.size === 0;
    exportButton.disabled = selectedIds.size === 0;
    selectVisibleToggle.disabled = visibleIds.length === 0;
    selectVisibleToggle.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
    selectVisibleToggle.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }

  function render() {
    const grouped = groupByBranch(records);
    const branches = getBranchNames(grouped);
    const visibleRecords = getVisibleRecords(grouped);

    totalCount.textContent = records.length;
    branchesCount.textContent = branches.length;
    visibleCount.textContent = visibleRecords.length;
    visibleLabel.textContent = activeBranch === "all" ? "\u0627\u0644\u0645\u0639\u0631\u0648\u0636 \u0627\u0644\u0622\u0646" : activeBranch;

    renderTabs(grouped, branches);
    renderTable(visibleRecords);
    updateSelectionControls(visibleRecords);
  }

  async function loadRecords() {
    WebData.setStatus(dashboardStatus, "info", "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0627\u062a\u0627...");
    refreshButton.disabled = true;

    try {
      records = (await WebData.listRegistrations(currentAdminPassword)).sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      syncSelectedIds();

      render();
      WebData.setStatus(dashboardStatus, "success", "\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0627\u062a\u0627 \u0628\u0646\u062c\u0627\u062d.");
    } catch (error) {
      WebData.setStatus(dashboardStatus, "error", error.message || "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0627\u062a\u0627.");
    } finally {
      refreshButton.disabled = false;
    }
  }

  function toSheetRows(list) {
    return list.map(function (record) {
      return {
        "\u0627\u0644\u0627\u0633\u0645": record.full_name,
        "\u0631\u0642\u0645 \u0627\u0644\u062a\u0644\u064a\u0641\u0648\u0646": record.phone,
        "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f": record.birth_date,
        "\u0627\u0644\u0641\u0631\u0639": record.branch,
        "\u0646\u0648\u0639 \u0627\u0644\u0639\u0636\u0648\u064a\u0629": record.membership_type,
        "\u0648\u0627\u062a\u0633\u0627\u0628": record.whatsapp_url,
        "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644": WebData.formatDisplayDate(record.created_at)
      };
    });
  }

  function buildSheet(list) {
    const sheet = XLSX.utils.json_to_sheet(toSheetRows(list));
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");

    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      const phoneCell = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
      if (phoneCell) {
        phoneCell.t = "s";
        phoneCell.z = "@";
      }
    }

    sheet["!cols"] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 }
    ];

    return sheet;
  }

  function safeSheetName(name) {
    return String(name || "\u0641\u0631\u0639").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "\u0641\u0631\u0639";
  }

  function exportExcel() {
    if (!window.XLSX) {
      WebData.setStatus(dashboardStatus, "error", "\u0645\u0644\u0641 \u0645\u0643\u062a\u0628\u0629 Excel \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f.");
      return;
    }

    const selectedRecords = getSelectedRecords();

    if (!selectedRecords.length) {
      WebData.setStatus(dashboardStatus, "error", "\u0627\u062e\u062a\u0627\u0631 \u062a\u0633\u062c\u064a\u0644 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0642\u0628\u0644 \u0627\u0644\u062a\u062d\u0645\u064a\u0644.");
      return;
    }

    const grouped = groupByBranch(selectedRecords);
    const branches = getBranchNames(grouped);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, buildSheet(selectedRecords), "\u0643\u0644 \u0627\u0644\u0645\u062d\u062f\u062f");

    branches.forEach(function (branch) {
      XLSX.utils.book_append_sheet(workbook, buildSheet(grouped[branch]), safeSheetName(branch));
    });

    XLSX.writeFile(workbook, "selected-registrations-by-branch.xlsx", {
      bookType: "xlsx",
      cellStyles: true
    });
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!passwordInput.value.trim()) {
      WebData.setStatus(loginStatus, "error", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.");
      return;
    }

    currentAdminPassword = passwordInput.value.trim();
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadRecords();
  });

  refreshButton.addEventListener("click", loadRecords);
  selectVisibleButton.addEventListener("click", function () {
    const grouped = groupByBranch(records);

    getVisibleRecords(grouped).forEach(function (record) {
      selectedIds.add(getRecordKey(record));
    });

    render();
  });
  clearSelectionButton.addEventListener("click", function () {
    selectedIds.clear();
    render();
  });
  selectVisibleToggle.addEventListener("change", function () {
    const grouped = groupByBranch(records);
    const visibleRecords = getVisibleRecords(grouped);

    visibleRecords.forEach(function (record) {
      const recordKey = getRecordKey(record);

      if (selectVisibleToggle.checked) {
        selectedIds.add(recordKey);
      } else {
        selectedIds.delete(recordKey);
      }
    });

    render();
  });
  recordsBody.addEventListener("change", function (event) {
    const target = event.target;

    if (!target.classList.contains("record-select")) {
      return;
    }

    if (target.checked) {
      selectedIds.add(target.dataset.recordId);
    } else {
      selectedIds.delete(target.dataset.recordId);
    }

    render();
  });
  exportButton.addEventListener("click", exportExcel);
})();
