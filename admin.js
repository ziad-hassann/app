(function () {
  const ADMIN_PASSWORD = (window.WEB_DATA_CONFIG && window.WEB_DATA_CONFIG.ADMIN_PASSWORD) || "admin123";
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
  const branchTabs = document.getElementById("branchTabs");
  const recordsBody = document.getElementById("recordsBody");
  const emptyState = document.getElementById("emptyState");
  const refreshButton = document.getElementById("refreshButton");
  const exportButton = document.getElementById("exportButton");

  let records = [];
  let activeBranch = "all";
  let currentAdminPassword = "";

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
      const branch = record.branch || "بدون فرع";
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
    branchTabs.appendChild(createBranchButton("الكل", records.length, "all"));

    branches.forEach(function (branch) {
      branchTabs.appendChild(createBranchButton(branch, grouped[branch].length, branch));
    });
  }

  function renderTable(list) {
    recordsBody.innerHTML = "";
    emptyState.classList.toggle("hidden", list.length > 0);

    list.forEach(function (record) {
      const row = document.createElement("tr");

      row.innerHTML =
        "<td>" + escapeHtml(record.full_name) + "</td>" +
        "<td>" + escapeHtml(record.phone) + "</td>" +
        "<td>" + escapeHtml(record.birth_date) + "</td>" +
        "<td>" + escapeHtml(record.branch) + "</td>" +
        "<td>" + escapeHtml(record.membership_type) + "</td>" +
        '<td><a class="whatsapp-link" href="' + escapeHtml(record.whatsapp_url) + '" target="_blank">فتح واتساب</a></td>' +
        "<td>" + escapeHtml(WebData.formatDisplayDate(record.created_at)) + "</td>";

      recordsBody.appendChild(row);
    });
  }

  function render() {
    const grouped = groupByBranch(records);
    const branches = getBranchNames(grouped);
    const visibleRecords = getVisibleRecords(grouped);

    totalCount.textContent = records.length;
    branchesCount.textContent = branches.length;
    visibleCount.textContent = visibleRecords.length;
    visibleLabel.textContent = activeBranch === "all" ? "المعروض الآن" : activeBranch;
    exportButton.disabled = records.length === 0;

    renderTabs(grouped, branches);
    renderTable(visibleRecords);
  }

  async function loadRecords() {
    WebData.setStatus(dashboardStatus, "info", "جاري تحميل الداتا...");
    refreshButton.disabled = true;

    try {
      records = (await WebData.listRegistrations(currentAdminPassword)).sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      render();
      WebData.setStatus(dashboardStatus, "success", "تم تحميل الداتا بنجاح.");
    } catch (error) {
      WebData.setStatus(dashboardStatus, "error", error.message || "تعذر تحميل الداتا.");
    } finally {
      refreshButton.disabled = false;
    }
  }

  function toSheetRows(list) {
    return list.map(function (record) {
      return {
        "الاسم": record.full_name,
        "رقم التليفون": record.phone,
        "تاريخ الميلاد": record.birth_date,
        "الفرع": record.branch,
        "نوع العضوية": record.membership_type,
        "واتساب": record.whatsapp_url,
        "تاريخ التسجيل": WebData.formatDisplayDate(record.created_at)
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
    return String(name || "فرع").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "فرع";
  }

  function exportExcel() {
    if (!window.XLSX) {
      WebData.setStatus(dashboardStatus, "error", "ملف مكتبة Excel غير موجود.");
      return;
    }

    const grouped = groupByBranch(records);
    const branches = getBranchNames(grouped);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, buildSheet(records), "كل التسجيلات");

    branches.forEach(function (branch) {
      XLSX.utils.book_append_sheet(workbook, buildSheet(grouped[branch]), safeSheetName(branch));
    });

    XLSX.writeFile(workbook, "registrations-by-branch.xlsx", {
      bookType: "xlsx",
      cellStyles: true
    });
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (passwordInput.value !== ADMIN_PASSWORD) {
      WebData.setStatus(loginStatus, "error", "كلمة السر غير صحيحة.");
      return;
    }

    currentAdminPassword = passwordInput.value;
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadRecords();
  });

  refreshButton.addEventListener("click", loadRecords);
  exportButton.addEventListener("click", exportExcel);
})();
