/* Tamil Nadu Forest Department - IT WING- IMPORTANT ISSUES MONITORING SYSTEM
   Dedicated Cloud Sync Engine with Zero Login Required
   - 6 Persons: CCF, DCF, SSM, Mr.Thirunirai Selvan, Mr.Chelladurai, Mr.Rajagopalan
   - Automatic sequential ID: 1, 2, 3...
   - Unlimited subject text
   - Section: MIS / GIS
   - Date diff highlighting: 7d (35% red), 15d (70% red), 30d (100% full red)
   - Updating action resets row color to clean and restarts counting
*/

const STORAGE_KEY = "tnfd_it_wing_important_issues_v1";
const ADMIN_STORAGE_KEY = "tnfd_it_wing_admin_session_v1";
const DEDICATED_CLOUD_ENDPOINT = "https://mantledb.sh/v2/tnfd_it_wing_important_issues/data";

const ADMIN_USER_ID = "CCF -IT";
const ADMIN_PASSWORD = "IT@CCF";

const AUTHORIZED_OFFICERS = [
  "CCF",
  "DCF",
  "SSM",
  "Mr.Thirunirai Selvan",
  "Mr.Chelladurai",
  "Mr.Rajagopalan"
];

let issuesState = [];
let isAdminLoggedIn = false;
let isSyncing = false;
let pollingTimer = null;

// ========================================================
// INITIALIZATION ON PAGE LOAD
// ========================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Purge any stale legacy blacklist keys from browser storage
  try {
    localStorage.removeItem("tnfd_it_wing_deleted_ids_v1");
    localStorage.removeItem("tnfd_it_wing_last_mutation_time_v1");
  } catch (e) {}

  // Check admin session and render auth UI
  checkAdminSession();
  renderAdminAuthUI();

  // 1. Render immediately from local cache for instant load
  issuesState = getStoredIssues();
  renderIssuesTable();

  // 2. Fetch authoritative state from dedicated cloud endpoint
  await fetchIssuesFromCloud(true);

  // 3. Start auto-sync polling every 35 seconds
  startAutoSyncPolling();

  // 4. Listen to window focus for fresh sync
  window.addEventListener("focus", () => {
    fetchIssuesFromCloud(false);
  });

  // 5. Listen to cross-tab storage changes
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      issuesState = getStoredIssues();
      renderIssuesTable();
    }
    if (e.key === ADMIN_STORAGE_KEY) {
      checkAdminSession();
      renderAdminAuthUI();
      renderIssuesTable();
    }
  });
});

// ========================================================
// CLOUD STORAGE & SYNC ENGINE
// ========================================================

async function fetchIssuesFromCloud(isInitial = false) {
  if (isSyncing) return issuesState;
  isSyncing = true;
  updateCloudBadge("syncing");

  const cacheBusterUrl = `${DEDICATED_CLOUD_ENDPOINT}?_t=${Date.now()}`;

  try {
    const res = await fetch(cacheBusterUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      let remoteIssues = null;

      if (data && Array.isArray(data.issues)) {
        remoteIssues = data.issues;
      } else if (Array.isArray(data)) {
        remoteIssues = data;
      }

      // If remote returned an issues array (even if empty []), update state
      if (remoteIssues !== null) {
        issuesState = remoteIssues;
        saveIssuesToLocal(issuesState);
        renderIssuesTable();
      }

      updateCloudBadge("synced");
      isSyncing = false;
      return issuesState;
    } else {
      updateCloudBadge("local");
    }
  } catch (err) {
    console.warn("Cloud sync fetch error (using local cache):", err.message);
    updateCloudBadge("local");
  }

  isSyncing = false;
  return issuesState;
}

async function pushIssuesToCloud(issues) {
  issuesState = issues || [];
  saveIssuesToLocal(issuesState);
  updateCloudBadge("syncing");

  try {
    const payload = {
      issues: issuesState,
      adminAuth: { userId: ADMIN_USER_ID, password: ADMIN_PASSWORD },
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(DEDICATED_CLOUD_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      updateCloudBadge("synced");
      return true;
    } else {
      updateCloudBadge("local");
      return false;
    }
  } catch (err) {
    console.warn("Cloud push error (stored in local cache):", err.message);
    updateCloudBadge("local");
    return false;
  }
}

function updateCloudBadge(status) {
  const badge = document.getElementById("cloudStatusBadge");
  const text = document.getElementById("cloudStatusText");
  if (!badge || !text) return;

  badge.classList.remove("syncing", "local-mode");

  if (status === "synced") {
    text.textContent = "Cloud Synced";
  } else if (status === "syncing") {
    badge.classList.add("syncing");
    text.textContent = "Syncing...";
  } else {
    badge.classList.add("local-mode");
    text.textContent = "Local Mode";
  }
}

function startAutoSyncPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(() => {
    fetchIssuesFromCloud(false);
  }, 40000); // 40 seconds
}

async function manualSync() {
  showToast("Syncing with Cloud database...", "info");
  await fetchIssuesFromCloud(false);
  showToast("Synced with Cloud successfully!", "success");
}

// Local Storage Accessors
function getStoredIssues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveIssuesToLocal(issues) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues || []));
  } catch (e) {}
}

// ========================================================
// AUTOMATIC SEQUENTIAL ID (1, 2, 3...)
// ========================================================

function getNextIssueId() {
  if (!Array.isArray(issuesState) || issuesState.length === 0) {
    return 1;
  }
  let maxId = 0;
  issuesState.forEach(item => {
    const num = parseInt(item.id, 10);
    if (!isNaN(num) && num > maxId) {
      maxId = num;
    }
  });
  return maxId + 1;
}

// ========================================================
// DATE & INACTION HIGHLIGHTING CALCULATION
// ========================================================

/*
  Days elapsed since Last Action Date (or createdDate if no action yet)
  - < 7 days: clean normal row (0% fill - empty)
  - 7 to 14 days: 35% fill from left to right with alert red
  - 15 to 29 days: 70% fill from left to right with alert red
  - 30+ days (1 month+): 100% full red across the row
  * When action is updated, resets immediately back to clean/empty (0%) and restarts count.
*/
function calculateInactionInfo(issue) {
  // Use lastActionDate if present; otherwise fallback to createdDate
  const refDateStr = issue.lastActionDate || issue.createdDate;
  if (!refDateStr) {
    return { days: 0, alertClass: "row-normal", label: "No action recorded", level: "NORMAL" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const refDate = new Date(refDateStr);
  refDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - refDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    let sub = diffDays === 0 ? "Today" : (diffDays === 1 ? "1 day ago" : `${diffDays} days ago`);
    return { days: diffDays, alertClass: "row-normal", label: sub, level: "NORMAL" };
  } else if (diffDays >= 7 && diffDays < 15) {
    return { days: diffDays, alertClass: "row-fill-35", label: `⚠️ ${diffDays} days ago (35% filled)`, level: "RED35" };
  } else if (diffDays >= 15 && diffDays < 30) {
    return { days: diffDays, alertClass: "row-fill-70", label: `🚨 ${diffDays} days ago (70% filled)`, level: "RED70" };
  } else {
    return { days: diffDays, alertClass: "row-fill-100", label: `🛑 ${diffDays} days ago (100% full red)`, level: "RED100" };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ========================================================
// RENDER ISSUES TABLE
// ========================================================

function renderIssuesTable() {
  const tbody = document.getElementById("issuesTableBody");
  const emptyState = document.getElementById("emptyState");
  const countBadge = document.getElementById("issueCountBadge");
  if (!tbody) return;

  const filtered = getFilteredIssues();

  if (countBadge) {
    countBadge.textContent = `${filtered.length} of ${issuesState.length} Issues`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  tbody.innerHTML = filtered.map(issue => {
    const inaction = calculateInactionInfo(issue);
    const sectionBadgeClass = issue.section === "GIS" ? "badge-gis" : "badge-mis";
    const officerBadge = issue.updatedBy 
      ? `<span class="badge badge-officer">${escapeHtml(issue.updatedBy)}</span>` 
      : `<span class="text-muted">-</span>`;
    
    const formattedActionDate = issue.lastActionDate ? formatDate(issue.lastActionDate) : '<span class="text-muted">Not taken yet</span>';
    const currentRemarks = issue.remarks || issue.actionRemarks || "";
    const remarksText = currentRemarks ? escapeHtml(currentRemarks) : '<span class="text-muted">-</span>';
    const fileNoText = issue.fileNo ? escapeHtml(issue.fileNo) : '<span class="text-muted">-</span>';

    // Exact requested columns sequence:
    // 1. ID, 2. Subject, 3. File No, 4. Section, 5. Date, 6. Updated By, 7. Remarks, 8. Action button
    return `
      <tr class="${inaction.alertClass}" id="row-issue-${issue.id}">
        <td class="font-bold text-center">${issue.id}</td>
        <td>
          <div class="subject-text">${escapeHtml(issue.subject || "")}</div>
        </td>
        <td>${fileNoText}</td>
        <td class="text-center"><span class="badge ${sectionBadgeClass}">${escapeHtml(issue.section || "-")}</span></td>
        <td>
          <span class="date-badge">${formattedActionDate}</span>
        </td>
        <td>${officerBadge}</td>
        <td>
          <div class="remarks-text">${remarksText}</div>
        </td>
        <td class="table-actions-cell">
          <button type="button" class="btn btn-action-update" onclick="openUpdateActionModal(${issue.id})">
            Update Action
          </button>
          ${isAdminLoggedIn ? `
          <div class="actions-row-links">
            <button type="button" class="btn-edit-link" onclick="openEditIssueModal(${issue.id})">Edit</button>
            <button type="button" class="btn-edit-link" onclick="openHistoryModal(${issue.id})">History</button>
            <button type="button" class="btn-danger-link" onclick="confirmDeleteIssue(${issue.id})">Delete</button>
          </div>
          ` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

// Search and Filter logic
function getFilteredIssues() {
  const searchVal = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  const filterSec = document.getElementById("filterSection")?.value || "ALL";
  const filterOff = document.getElementById("filterOfficer")?.value || "ALL";
  const filterAlt = document.getElementById("filterAlert")?.value || "ALL";

  return issuesState.filter(item => {
    // Search
    if (searchVal) {
      const matchId = String(item.id).includes(searchVal);
      const matchSub = (item.subject || "").toLowerCase().includes(searchVal);
      const matchFile = (item.fileNo || "").toLowerCase().includes(searchVal);
      if (!matchId && !matchSub && !matchFile) return false;
    }

    // Section
    if (filterSec !== "ALL" && item.section !== filterSec) {
      return false;
    }

    // Officer
    if (filterOff !== "ALL" && item.updatedBy !== filterOff) {
      return false;
    }

    // Alert Status
    if (filterAlt !== "ALL") {
      const info = calculateInactionInfo(item);
      if (info.level !== filterAlt) return false;
    }

    return true;
  });
}

function handleSearchFilter() {
  renderIssuesTable();
}

function resetFilters() {
  const searchInput = document.getElementById("searchInput");
  const filterSection = document.getElementById("filterSection");
  const filterOfficer = document.getElementById("filterOfficer");
  const filterAlert = document.getElementById("filterAlert");

  if (searchInput) searchInput.value = "";
  if (filterSection) filterSection.value = "ALL";
  if (filterOfficer) filterOfficer.value = "ALL";
  if (filterAlert) filterAlert.value = "ALL";

  renderIssuesTable();
}

// ========================================================
// MODAL 1: CREATE NEW ISSUE
// ========================================================

function openNewIssueModal() {
  const modal = document.getElementById("newIssueModal");
  const form = document.getElementById("newIssueForm");
  const idPreview = document.getElementById("newIssueIdPreview");
  if (!modal) return;

  if (form) form.reset();
  if (idPreview) idPreview.value = getNextIssueId();

  modal.classList.add("active");
  document.getElementById("newIssueSection")?.focus();
}

function closeNewIssueModal() {
  const modal = document.getElementById("newIssueModal");
  if (modal) modal.classList.remove("active");
}

async function handleCreateIssueSubmit(e) {
  e.preventDefault();

  const section = document.getElementById("newIssueSection").value;
  const subject = document.getElementById("newIssueSubject").value.trim();
  const fileNo = document.getElementById("newIssueFileNo").value.trim();

  if (!section) {
    showToast("Please select a Section (MIS or GIS).", "error");
    return;
  }
  if (!subject) {
    showToast("Subject is mandatory.", "error");
    return;
  }

  const nextId = getNextIssueId();
  const todayStr = new Date().toISOString().split("T")[0];

  const newIssue = {
    id: nextId,
    section: section,
    subject: subject,
    fileNo: fileNo || "",
    createdDate: todayStr,
    lastActionDate: "", // Initially empty as requested
    updatedBy: "",      // Initially empty as requested
    actionRemarks: "",
    actionHistory: [
      {
        actionDate: todayStr,
        updatedBy: "System",
        remarks: "Issue created"
      }
    ]
  };

  issuesState.push(newIssue);
  closeNewIssueModal();
  renderIssuesTable();

  showToast(`Issue #${nextId} created! Syncing to Cloud...`, "info");
  await pushIssuesToCloud(issuesState);
  showToast(`Issue #${nextId} saved & synced to Cloud!`, "success");
}

// ========================================================
// MODAL 2: UPDATE LAST ACTION TAKEN
// ========================================================

function openUpdateActionModal(issueId) {
  const issue = issuesState.find(item => item.id === issueId);
  if (!issue) return;

  const modal = document.getElementById("updateActionModal");
  document.getElementById("updateActionIssueId").value = issue.id;
  document.getElementById("summaryIssueId").textContent = `#${issue.id}`;
  
  const secBadge = document.getElementById("summarySection");
  if (secBadge) {
    secBadge.textContent = issue.section;
    secBadge.className = `badge ${issue.section === "GIS" ? "badge-gis" : "badge-mis"}`;
  }

  document.getElementById("summarySubject").textContent = issue.subject.length > 120 
    ? issue.subject.substring(0, 120) + "..." 
    : issue.subject;

  // Defaults action date to today
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("actionTakenDate").value = todayStr;

  // Officer dropdown: preselect if already updated, otherwise blank
  const officerSelect = document.getElementById("actionUpdatedBy");
  if (officerSelect) {
    officerSelect.value = issue.updatedBy && AUTHORIZED_OFFICERS.includes(issue.updatedBy) 
      ? issue.updatedBy 
      : "";
  }

  document.getElementById("actionRemarks").value = "";

  if (modal) modal.classList.add("active");
  officerSelect?.focus();
}

function closeUpdateActionModal() {
  const modal = document.getElementById("updateActionModal");
  if (modal) modal.classList.remove("active");
}

async function handleUpdateActionSubmit(e) {
  e.preventDefault();

  const issueId = parseInt(document.getElementById("updateActionIssueId").value, 10);
  const actionDate = document.getElementById("actionTakenDate").value;
  const updatedBy = document.getElementById("actionUpdatedBy").value;
  const remarks = document.getElementById("actionRemarks").value.trim();

  if (!actionDate) {
    showToast("Action Taken Date is mandatory.", "error");
    return;
  }
  if (!updatedBy) {
    showToast("Updated By officer is mandatory. Please select one of the 6 officers.", "error");
    return;
  }

  const issue = issuesState.find(item => item.id === issueId);
  if (!issue) return;

  // Update properties
  issue.lastActionDate = actionDate;
  issue.updatedBy = updatedBy;
  if (remarks) {
    issue.remarks = remarks;
    issue.actionRemarks = remarks;
  }

  // Record into history timeline
  if (!Array.isArray(issue.actionHistory)) {
    issue.actionHistory = [];
  }
  issue.actionHistory.unshift({
    actionDate: actionDate,
    updatedBy: updatedBy,
    remarks: remarks || "Action recorded"
  });

  closeUpdateActionModal();
  renderIssuesTable();

  // Reset highlight immediately to clean as requested
  showToast(`Action updated for Issue #${issueId}! Syncing to Cloud...`, "info");
  await pushIssuesToCloud(issuesState);
  showToast(`Issue #${issueId} action synced to Cloud! Inaction counter reset.`, "success");
}

// ========================================================
// MODAL 3: EDIT ISSUE BASIC DETAILS
// ========================================================

function openEditIssueModal(issueId) {
  const issue = issuesState.find(item => item.id === issueId);
  if (!issue) return;

  document.getElementById("editIssueId").value = issue.id;
  document.getElementById("editIssueSection").value = issue.section;
  document.getElementById("editIssueFileNo").value = issue.fileNo || "";
  document.getElementById("editIssueSubject").value = issue.subject || "";

  const modal = document.getElementById("editIssueModal");
  if (modal) modal.classList.add("active");
}

function closeEditIssueModal() {
  const modal = document.getElementById("editIssueModal");
  if (modal) modal.classList.remove("active");
}

async function handleEditIssueSubmit(e) {
  e.preventDefault();

  const issueId = parseInt(document.getElementById("editIssueId").value, 10);
  const section = document.getElementById("editIssueSection").value;
  const fileNo = document.getElementById("editIssueFileNo").value.trim();
  const subject = document.getElementById("editIssueSubject").value.trim();

  if (!subject) {
    showToast("Subject is mandatory.", "error");
    return;
  }

  const issue = issuesState.find(item => item.id === issueId);
  if (!issue) return;

  issue.section = section;
  issue.fileNo = fileNo;
  issue.subject = subject;

  closeEditIssueModal();
  renderIssuesTable();

  showToast(`Issue #${issueId} details updated! Syncing to Cloud...`, "info");
  await pushIssuesToCloud(issuesState);
  showToast(`Issue #${issueId} synced to Cloud!`, "success");
}

// ========================================================
// MODAL 4: ACTION HISTORY TIMELINE
// ========================================================

function openHistoryModal(issueId) {
  const issue = issuesState.find(item => item.id === issueId);
  if (!issue) return;

  const header = document.getElementById("historySubjectHeader");
  const timeline = document.getElementById("historyTimeline");

  if (header) {
    header.innerHTML = `
      <div class="summary-line">
        <span class="summary-label">Issue ID:</span>
        <span class="summary-value font-bold">#${issue.id}</span>
        <span class="summary-label" style="margin-left: 1rem;">Section:</span>
        <span class="badge ${issue.section === 'GIS' ? 'badge-gis' : 'badge-mis'}">${escapeHtml(issue.section)}</span>
      </div>
      <div class="summary-line" style="margin-top: 0.35rem;">
        <span class="summary-label">Subject:</span>
        <span class="summary-value">${escapeHtml(issue.subject)}</span>
      </div>
    `;
  }

  if (timeline) {
    const history = Array.isArray(issue.actionHistory) && issue.actionHistory.length > 0
      ? issue.actionHistory
      : [{ actionDate: issue.lastActionDate || issue.createdDate, updatedBy: issue.updatedBy || "Initial", remarks: issue.actionRemarks || "Created" }];

    timeline.innerHTML = history.map(item => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-header">
          <span>${escapeHtml(item.updatedBy || "Officer")}</span>
          <span class="timeline-date">${formatDate(item.actionDate)}</span>
        </div>
        <div class="timeline-remarks">${escapeHtml(item.remarks || "-")}</div>
      </div>
    `).join("");
  }

  const modal = document.getElementById("historyModal");
  if (modal) modal.classList.add("active");
}

function closeHistoryModal() {
  const modal = document.getElementById("historyModal");
  if (modal) modal.classList.remove("active");
}

// ========================================================
// DELETE ISSUE
// ========================================================

async function confirmDeleteIssue(issueId) {
  const numId = Number(issueId);
  const confirmed = window.confirm(`Are you sure you want to delete Issue #${numId}? This will remove it permanently from Cloud and all systems.`);
  if (!confirmed) return;

  // 1. Remove from active state immediately and update local storage
  issuesState = issuesState.filter(item => Number(item.id) !== numId);
  saveIssuesToLocal(issuesState);
  renderIssuesTable();

  // 2. Immediately push deletion to cloud so cloud is 100% updated
  showToast(`Deleting Issue #${numId} permanently from Cloud...`, "info");
  const success = await pushIssuesToCloud(issuesState);
  if (success) {
    showToast(`Issue #${numId} permanently deleted from Cloud!`, "success");
  } else {
    showToast(`Issue #${numId} deleted locally. Will sync to Cloud when online.`, "info");
  }
}

// ========================================================
// ADMIN AUTHENTICATION (CCF -IT / IT@CCF)
// ========================================================

function checkAdminSession() {
  try {
    const session = localStorage.getItem(ADMIN_STORAGE_KEY);
    isAdminLoggedIn = (session === "true");
  } catch (e) {
    isAdminLoggedIn = false;
  }
}

function renderAdminAuthUI() {
  const container = document.getElementById("adminAuthContainer");
  if (!container) return;

  if (isAdminLoggedIn) {
    container.innerHTML = `
      <div class="admin-session-badge">
        <span class="admin-session-dot"></span>
        <span>CCF -IT</span>
        <button type="button" class="btn-logout" onclick="handleAdminLogout()" title="Logout from Admin Mode">Logout</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn-admin" onclick="openAdminLoginModal()" title="Login as CCF Admin">
        Admin Login
      </button>
    `;
  }
}

function openAdminLoginModal() {
  const modal = document.getElementById("adminLoginModal");
  const form = document.getElementById("adminLoginForm");
  const errorEl = document.getElementById("adminLoginError");
  if (!modal) return;

  if (form) form.reset();
  if (errorEl) {
    errorEl.style.display = "none";
    errorEl.textContent = "";
  }

  modal.classList.add("active");
  document.getElementById("adminUsername")?.focus();
}

function closeAdminLoginModal() {
  const modal = document.getElementById("adminLoginModal");
  if (modal) modal.classList.remove("active");
}

function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const usernameInput = (document.getElementById("adminUsername")?.value || "").trim();
  const passwordInput = document.getElementById("adminPassword")?.value || "";
  const errorEl = document.getElementById("adminLoginError");

  // Normalized check: accepts "CCF -IT", "CCF-IT", "CCF - IT" (case-insensitive)
  const normalizedUser = usernameInput.toUpperCase().replace(/\s+/g, " ");
  const isUserValid = (normalizedUser === "CCF -IT" || normalizedUser === "CCF-IT" || normalizedUser === "CCF - IT");
  const isPassValid = (passwordInput === ADMIN_PASSWORD);

  if (isUserValid && isPassValid) {
    isAdminLoggedIn = true;
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, "true");
    } catch (err) {}

    closeAdminLoginModal();
    renderAdminAuthUI();
    renderIssuesTable();
    showToast("Welcome CCF! Logged in as Administrator.", "success");
  } else {
    if (errorEl) {
      errorEl.textContent = "Invalid User ID or Password. Please try again.";
      errorEl.style.display = "block";
    }
    showToast("Invalid User ID or Password.", "error");
  }
}

function handleAdminLogout() {
  isAdminLoggedIn = false;
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (e) {}

  renderAdminAuthUI();
  renderIssuesTable();
  showToast("Logged out of Admin mode. Returning to landing view.", "info");
}

// ========================================================
// UTILITIES
// ========================================================

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}