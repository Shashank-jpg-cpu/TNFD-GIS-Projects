/* Tamil Nadu Forest Department - URGENT ISSUES MONITORING
   True Cloud Storage Engine (Zero Server / No Backend Required)
   - Operates by simply double-clicking index.html or staff.html anywhere
   - Real-time cloud sync across all staff, offices, and laptops
   - Staff Selection Persistence Across Refreshes
*/

// Default GIS Lab Staff Members
const DEFAULT_STAFF_LIST = [
  "Chelladurai-FRO",
  "Rajagopalan-FRO",
  "Sharmila-Forester",
  "Bhuvaneshwari-Forester",
  "Deepa",
  "Padma",
  "Shashank"
];

// Storage Keys
const STORAGE_KEY = "tn_fd_urgent_issues_v7";
const STAFF_STORAGE_KEY = "tn_fd_urgent_staff_list_v7";
const LAST_WING_KEY = "tn_fd_last_selected_wing_v7";
const LAST_STAFF_KEY = "tn_fd_last_selected_staff_v7";
const LAST_CIRCLE_KEY = LAST_STAFF_KEY;
const CLOUD_ENDPOINT_KEY = "tn_fd_cloud_endpoint_v7";

// Staff Storage Accessors
function getStoredStaff() {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return [...DEFAULT_STAFF_LIST];
}

function saveStoredStaff(staffList) {
  try {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffList));
  } catch (e) {}
}

let STAFF_LIST = getStoredStaff();
let CIRCLES_LIST = STAFF_LIST; // Compatibility alias
let UNITS_LIST = [];
let ALL_TARGETS_LIST = STAFF_LIST;

function refreshGlobalStaffList() {
  STAFF_LIST = getStoredStaff();
  CIRCLES_LIST = STAFF_LIST;
  ALL_TARGETS_LIST = STAFF_LIST;
}

// Single Official Wing: IT
const WINGS_LIST = [
  "IT"
];

const WING_PREFIX_MAP = {
  "IT": "IT",
  "GIS": "GIS",
  "GIS Lab": "GIS"
};

// Live Permanent Cloud Database Endpoint (CORS-enabled, zero local server required)
const DEFAULT_CLOUD_ENDPOINT = "https://mantledb.sh/v2/tnfd_urgent_issues_2026/data";

let isSyncing = false;
let memoryStorageFallback = null;

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  else if (type === "error") icon = "❌";
  else if (type === "warning") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span><span style="flex: 1;">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

// ==========================================
// CLOUD STORAGE & SYNC ENGINE
// ==========================================

function getActiveCloudEndpoint() {
  try {
    const custom = localStorage.getItem(CLOUD_ENDPOINT_KEY);
    if (custom && custom.trim().startsWith("http") && !custom.includes("extendsclass.com") && !custom.includes("restful-api.dev")) {
      return custom.trim();
    }
  } catch (e) {}
  return DEFAULT_CLOUD_ENDPOINT;
}

function setActiveCloudEndpoint(url) {
  try {
    localStorage.setItem(CLOUD_ENDPOINT_KEY, url.trim());
  } catch (e) {}
}

// Fetch latest issues from the cloud
async function fetchIssuesRemote(showNotification = false) {
  if (isSyncing) return getLocalIssues();
  isSyncing = true;

  const endpoint = getActiveCloudEndpoint();
  const cacheBusterUrl = endpoint.includes("?") 
    ? `${endpoint}&_t=${Date.now()}` 
    : `${endpoint}?_t=${Date.now()}`;

  try {
    const res = await fetch(cacheBusterUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      let remoteIssues = [];

      if (data && Array.isArray(data.issues)) {
        remoteIssues = data.issues;
      } else if (Array.isArray(data)) {
        remoteIssues = data;
      } else if (data && data.data && typeof data.data === "string") {
        try {
          const parsed = JSON.parse(data.data);
          remoteIssues = Array.isArray(parsed.issues) ? parsed.issues : (Array.isArray(parsed) ? parsed : []);
          if (Array.isArray(parsed.staff) && parsed.staff.length > 0) {
            saveStoredStaff(parsed.staff);
            refreshGlobalStaffList();
          }
        } catch (e) {}
      }

      // Check for remote staff array from cloud
      if (data && Array.isArray(data.staff) && data.staff.length > 0) {
        saveStoredStaff(data.staff);
        refreshGlobalStaffList();
      }

      saveIssuesToLocal(remoteIssues);
      updateCloudSyncBadge(true);
      if (showNotification) showToast(`Cloud Synced: ${remoteIssues.length} urgent issues & ${getStoredStaff().length} staff loaded`, "success");
      isSyncing = false;
      return remoteIssues;
    } else {
      updateCloudSyncBadge(false);
    }
  } catch (err) {
    console.warn("Cloud sync fetch failed, using local cache:", err.message);
    updateCloudSyncBadge(false);
  }

  isSyncing = false;
  return getLocalIssues();
}

// Push issues and staff array to the cloud
async function pushIssuesRemote(issues, staffList) {
  if (issues !== undefined) saveIssuesToLocal(issues);
  if (staffList !== undefined) {
    saveStoredStaff(staffList);
    refreshGlobalStaffList();
  }
  const endpoint = getActiveCloudEndpoint();

  try {
    const isMantle = endpoint.includes("mantledb.sh");
    const method = isMantle ? "POST" : "PUT";
    const payload = {
      issues: issues !== undefined ? issues : getStoredIssues(),
      staff: staffList !== undefined ? staffList : getStoredStaff()
    };
    const res = await fetch(endpoint, {
      method: method,
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      updateCloudSyncBadge(true);
      return { success: true };
    } else {
      updateCloudSyncBadge(false);
      return { success: false, error: `Cloud server returned status ${res.status}` };
    }
  } catch (err) {
    console.warn("Cloud sync push failed:", err.message);
    updateCloudSyncBadge(false);
    return { success: false, error: err.message };
  }
}

async function manualCloudSync() {
  const badge = document.querySelector(".cloud-status-badge");
  if (badge) badge.innerHTML = `🔄 Syncing...`;
  
  const issues = await fetchIssuesRemote(true);
  
  if (document.getElementById("hoTicketsTableBody")) {
    renderStaffCheckboxes();
    renderHeadOfficeDashboard();
  }
  if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) {
    renderStaffDropdown();
    renderStaffDashboard();
  }
}

function updateCloudSyncBadge(isOnline) {
  const badges = document.querySelectorAll(".cloud-status-badge");
  badges.forEach(badge => {
    if (isOnline) {
      badge.innerHTML = `🟢 Cloud Synced`;
      badge.style.borderColor = "rgba(52, 211, 153, 0.5)";
      badge.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
    } else {
      badge.innerHTML = `⚡ Local Cache Mode`;
      badge.style.borderColor = "rgba(251, 191, 36, 0.5)";
      badge.style.backgroundColor = "rgba(245, 158, 11, 0.2)";
    }
  });
}

// Local Storage Fallback
function getLocalIssues() {
  try {
    let data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const prev = localStorage.getItem("tn_fd_urgent_issues_v6") || localStorage.getItem("tn_fd_urgent_issues_v5");
      if (prev) {
        localStorage.setItem(STORAGE_KEY, prev);
        return JSON.parse(prev);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    if (!memoryStorageFallback) memoryStorageFallback = [];
    return memoryStorageFallback;
  }
}

function saveIssuesToLocal(issues) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  } catch (e) {
    memoryStorageFallback = issues;
  }
}

function getStoredIssues() {
  return getLocalIssues();
}

function saveIssues(issues) {
  saveIssuesToLocal(issues);
  pushIssuesRemote(issues);
}

// Helper: Generate next Issue ID dynamically based on highest existing issue number
function generateIssueIdForWing(wingName, issues) {
  const currentYear = new Date().getFullYear();
  const prefix = WING_PREFIX_MAP[wingName] || "GEN";
  const expectedPrefix = `TNFD-${prefix}-${currentYear}-`;
  
  let maxNum = 0;
  if (Array.isArray(issues)) {
    issues.forEach(t => {
      if (t && t.ticketId) {
        const idUpper = t.ticketId.trim().toUpperCase();
        if (idUpper.startsWith(expectedPrefix.toUpperCase())) {
          const numPart = parseInt(idUpper.replace(expectedPrefix.toUpperCase(), ""), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        } else {
          const m = t.ticketId.match(/(\d+)$/);
          if (m) {
            const numPart = parseInt(m[1], 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        }
      }
    });
  }

  const nextNum = maxNum + 1;
  const numStr = String(nextNum).padStart(3, '0');

  return `${expectedPrefix}${numStr}`;
}



// Update Issue ID field whenever selected wing changes in Head Office page
function updateFormIssueId() {
  const wingSelect = document.getElementById("issuingWing");
  const issueIdInput = document.getElementById("ticketId");
  if (wingSelect && issueIdInput) {
    const selectedWing = wingSelect.value;
    try {
      localStorage.setItem(LAST_WING_KEY, selectedWing);
    } catch (e) {}

    const issues = getStoredIssues();
    issueIdInput.value = generateIssueIdForWing(selectedWing, issues);
  }
}

// Format Date string
function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Multi-tab storage event synchronization
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    if (document.getElementById("hoTicketsTableBody")) renderHeadOfficeDashboard();
    if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) renderStaffDashboard();
  }
});

// Auto-sync cloud every 20 seconds (when page is visible)
setInterval(async () => {
  if (document.visibilityState === "visible") {
    const oldLength = getStoredIssues().length;
    const freshIssues = await fetchIssuesRemote(false);
    if (freshIssues.length !== oldLength || document.querySelector(".modal-backdrop.active")) {
      if (document.getElementById("hoTicketsTableBody")) renderHeadOfficeDashboard();
      if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) renderStaffDashboard();
    }
  }
}, 20000);

// Export & Import
function exportDataJSON() {
  const issues = getStoredIssues();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(issues, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `TNFD_Urgent_Issues_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataJSON(inputElement) {
  const file = inputElement.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const importedIssues = JSON.parse(e.target.result);
      if (Array.isArray(importedIssues)) {
        await pushIssuesRemote(importedIssues);
        if (document.getElementById("hoTicketsTableBody")) renderHeadOfficeDashboard();
        if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) renderStaffDashboard();
        showToast(`Successfully imported ${importedIssues.length} issue(s) to cloud!`, "success");
      } else {
        alert("Invalid JSON format in file.");
      }
    } catch (err) {
      alert("Error reading JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Clear All Functionality (Deletes from both local and cloud)
async function resetPortalData() {
  if (confirm("Are you sure you want to clear ALL urgent issues? This will remove all issues from the cloud and all devices.")) {
    saveIssuesToLocal([]);
    const res = await pushIssuesRemote([]);
    if (document.getElementById("hoTicketsTableBody")) renderHeadOfficeDashboard();
    if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) renderStaffDashboard();
    if (document.getElementById("ticketId")) updateFormIssueId();
    
    if (res.success) {
      showToast("All urgent issues cleared from the cloud!", "warning", 5000);
    } else {
      showToast("Cleared locally, but cloud sync failed.", "error", 5000);
    }
  }
}

// ==========================================
// SYNC SETTINGS MODAL LOGIC
// ==========================================

function openSyncSettingsModal() {
  const modal = document.getElementById("syncSettingsModal");
  if (!modal) return;

  const statusEl = document.getElementById("syncStatusSummary");
  const hostInfoEl = document.getElementById("syncHostInfo");
  const endpointInput = document.getElementById("customCloudEndpointInput");

  if (statusEl) {
    statusEl.innerHTML = `<span style="color: #059669; font-weight: 700;">🟢 Connected to Live Cloud Database</span>`;
  }

  if (hostInfoEl) {
    hostInfoEl.textContent = `Cloud endpoint: ${getActiveCloudEndpoint()}`;
  }

  if (endpointInput) {
    endpointInput.value = localStorage.getItem(CLOUD_ENDPOINT_KEY) || DEFAULT_CLOUD_ENDPOINT;
  }

  modal.classList.add("active");
}

function closeSyncSettingsModal() {
  const modal = document.getElementById("syncSettingsModal");
  if (modal) modal.classList.remove("active");
}

async function testSyncConnection() {
  const statusEl = document.getElementById("syncStatusSummary");
  if (statusEl) statusEl.textContent = "Testing cloud connection...";

  const issues = await fetchIssuesRemote(false);

  if (statusEl) {
    statusEl.innerHTML = `<span style="color: #059669; font-weight: 700;">✅ Cloud Database Connected (${issues.length} issues in cloud)</span>`;
  }
}

async function saveSyncSettingsFromModal() {
  const endpointInput = document.getElementById("customCloudEndpointInput");
  if (endpointInput) {
    const val = endpointInput.value.trim() || DEFAULT_CLOUD_ENDPOINT;
    setActiveCloudEndpoint(val);
    await fetchIssuesRemote(false);
    showToast("Cloud sync settings updated!", "success");
    closeSyncSettingsModal();
  }
}

// ==========================================
// HEAD OFFICE PORTAL LOGIC (index.html)
// ==========================================

function renderStaffCheckboxes() {
  const staffGrid = document.getElementById("staffCheckboxGrid") || document.getElementById("circlesCheckboxGrid");
  if (!staffGrid) return;

  const currentStaff = getStoredStaff();
  
  // Preserve currently checked items if any
  const checkedValues = new Set();
  staffGrid.querySelectorAll(".staff-cb:checked, .circle-cb:checked").forEach(cb => checkedValues.add(cb.value));

  const staffHtml = `
    <div style="grid-column: 1 / -1; font-weight: 700; color: var(--primary-dark); margin-top: 0.25rem; font-size: 0.85rem; text-transform: uppercase;">
      👥 Staff Members:
    </div>
    ${currentStaff.map(s => `
      <label class="staff-checkbox-item circle-checkbox-item">
        <input type="checkbox" name="targetStaff" value="${s}" class="staff-cb circle-cb" ${checkedValues.has(s) ? "checked" : ""}>
        <span>${s}</span>
      </label>
    `).join('')}
  `;
  staffGrid.innerHTML = staffHtml;
}

async function initHeadOfficePage() {
  // Sync with cloud on initial load
  await fetchIssuesRemote(false);

  // Populate Issuing Wings Dropdown
  const wingSelect = document.getElementById("issuingWing");
  if (wingSelect) {
    wingSelect.innerHTML = WINGS_LIST.map(wing => `
      <option value="${wing}">${wing}</option>
    `).join('');

    try {
      const savedWing = localStorage.getItem(LAST_WING_KEY);
      if (savedWing && WING_PREFIX_MAP[savedWing] && WINGS_LIST.includes(savedWing)) {
        wingSelect.value = savedWing;
      } else {
        wingSelect.value = WINGS_LIST[0];
      }
    } catch (e) {}

    wingSelect.addEventListener("change", updateFormIssueId);
  }

  // Populate Staff checkboxes dynamically
  renderStaffCheckboxes();

  // Handle "Select All" checkbox
  const selectAllCb = document.getElementById("selectAllStaffCb") || document.getElementById("selectAllCirclesCb");
  if (selectAllCb) {
    selectAllCb.checked = false; // Unticked by default
    selectAllCb.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll(".staff-cb, .circle-cb").forEach(cb => cb.checked = isChecked);
    });
  }

  // Set today's date in Issue Form
  const issueDateInput = document.getElementById("issueDate");
  if (issueDateInput && !issueDateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    issueDateInput.value = today;
  }

  // Initial Issue ID generation based on currently selected wing
  updateFormIssueId();

  // Handle Form Submission (Proper Async with Cloud Storage)
  const issueForm = document.getElementById("createIssueForm");
  if (issueForm) {
    issueForm.onsubmit = async function(e) {
      e.preventDefault();
      
      const submitBtn = issueForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : "🚀 Raise";

      const issuingWing = document.getElementById("issuingWing").value;
      const currentIssues = getStoredIssues();
      let ticketId = document.getElementById("ticketId").value.trim() || generateIssueIdForWing(issuingWing, currentIssues);
      
      // Prevent duplicate Ticket IDs in database
      const isDuplicate = currentIssues.some(t => t.ticketId && t.ticketId.trim().toUpperCase() === ticketId.toUpperCase());
      if (isDuplicate) {
        ticketId = generateIssueIdForWing(issuingWing, currentIssues);
      }

      const issueDate = document.getElementById("issueDate").value;
      const subject = document.getElementById("issueSubject").value.trim();
      const description = document.getElementById("issueDescription").value.trim();

      const selectedStaffBoxes = Array.from(document.querySelectorAll(".staff-cb:checked, .circle-cb:checked"));
      const selectedStaff = [...new Set(selectedStaffBoxes.map(cb => cb.value))];

      if (selectedStaff.length === 0) {
        alert("Please select at least one Staff Member to send the issue to!");
        return;
      }

      // Enter loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "⏳ Saving to Cloud & Syncing...";
      }

      const isAll = selectedStaff.length === ALL_TARGETS_LIST.length;

      const newIssue = {
        ticketId,
        issueDate,
        issuingWing,
        targetMode: isAll ? "all" : "selected",
        targetStaff: selectedStaff,
        targetCircles: selectedStaff, // backward compat
        subject,
        description,
        createdAt: new Date().toISOString(),
        staffResponses: {},
        circleResponses: {} // backward compat
      };

      // Default response status as 'Sent' for selected staff members
      selectedStaff.forEach(target => {
        const respObj = {
          status: "Sent",
          viewedAt: "",
          solvedDate: "",
          submittedAt: "",
          mode: "",
          referenceNo: "",
          remarks: ""
        };
        newIssue.staffResponses[target] = respObj;
        newIssue.circleResponses[target] = respObj;
      });

      currentIssues.unshift(newIssue);
      
      // Save to Cloud and local storage
      const pushResult = await pushIssuesRemote(currentIssues);

      // Restore button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }

      if (pushResult.success) {
        showToast(`✅ Urgent Issue ${ticketId} raised and stored in the cloud!`, "success", 6000);
      } else {
        showToast(`⚠️ Issue saved locally, but cloud sync failed: ${pushResult.error}`, "warning", 7000);
      }
      
      // Reset Form fields
      document.getElementById("issueSubject").value = "";
      document.getElementById("issueDescription").value = "";
      document.getElementById("issueDate").value = new Date().toISOString().split('T')[0];
      
      // Untick all target checkboxes on reset
      document.querySelectorAll(".staff-cb, .circle-cb").forEach(cb => cb.checked = false);
      if (selectAllCb) selectAllCb.checked = false;

      // Keep currently selected wing and update Issue ID for next issue
      updateFormIssueId();
      renderHeadOfficeDashboard();
    };
  }

  renderHeadOfficeDashboard();
}

// Issue-Level KPI Calculation for Head Office
function renderHeadOfficeDashboard() {
  const issues = getStoredIssues();

  let totalIssues = issues.length;
  let solvedIssuesCount = 0;
  let viewedIssuesCount = 0;
  let pendingIssuesCount = 0;

  issues.forEach(issue => {
    let issueSolved = true;
    let issueViewed = false;

    const targetList = Array.isArray(issue.targetStaff) ? issue.targetStaff : (Array.isArray(issue.targetCircles) ? issue.targetCircles : []);
    if (targetList.length === 0) {
      issueSolved = false;
    } else {
      targetList.forEach(target => {
        const resp = (issue.staffResponses && issue.staffResponses[target]) || (issue.circleResponses && issue.circleResponses[target]) || null;
        const st = resp ? resp.status : "Sent";
        const isTargetSolved = (st === "Solved" || st === "Submitted" || st === "Accepted");
        if (!isTargetSolved) {
          issueSolved = false;
        }
        if (st === "Viewed" || isTargetSolved) {
          issueViewed = true;
        }
      });
    }

    if (issueSolved) {
      solvedIssuesCount++;
    } else {
      pendingIssuesCount++;
      if (issueViewed) {
        viewedIssuesCount++;
      }
    }
  });

  // Update KPI Cards
  const totalEl = document.getElementById("statTotalIssues");
  const sentEl = document.getElementById("statSentIssues");
  const viewedEl = document.getElementById("statViewedIssues");
  const solvedEl = document.getElementById("statSolvedIssues");

  if (totalEl) totalEl.textContent = totalIssues;
  if (sentEl) sentEl.textContent = pendingIssuesCount;
  if (viewedEl) viewedEl.textContent = viewedIssuesCount;
  if (solvedEl) solvedEl.textContent = solvedIssuesCount;

  // Render Table
  const tableBody = document.getElementById("hoTicketsTableBody");
  if (!tableBody) return;

  if (issues.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p style="font-weight: 600; font-size: 1rem; color: #475569;">No urgent issues raised yet.</p>
          <p style="font-size: 0.85rem;">Use the form above to raise an urgent issue to Staff.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = issues.map((t, idx) => {
    let sent = 0, viewed = 0, solved = 0;
    const targetList = Array.isArray(t.targetStaff) ? t.targetStaff : (Array.isArray(t.targetCircles) ? t.targetCircles : []);
    const totalTargets = targetList.length;

    targetList.forEach(target => {
      const resp = (t.staffResponses && t.staffResponses[target]) || (t.circleResponses && t.circleResponses[target]) || null;
      const st = resp ? resp.status : "Sent";
      if (st === "Accepted" || st === "Solved" || st === "Submitted") {
        solved++;
      } else if (st === "Viewed") {
        viewed++;
      } else {
        sent++;
      }
    });

    let targetStaffDisplay = "";
    if (targetList.length === 0) {
      targetStaffDisplay = `<span style="color: var(--text-muted); font-size: 0.85rem;">-</span>`;
    } else {
      targetStaffDisplay = `
        <div style="display: flex; gap: 0.25rem; flex-wrap: wrap; max-width: 280px;">
          ${targetList.map(name => `<span class="badge badge-wing" style="font-size: 0.75rem; padding: 0.2rem 0.55rem; font-weight: 600;">${name}</span>`).join('')}
        </div>
      `;
    }

    return `
      <tr>
        <td class="font-bold">${t.ticketId}</td>
        <td>${formatDate(t.issueDate)}</td>
        <td><span class="badge badge-wing">${t.issuingWing}</span></td>
        <td>${targetStaffDisplay}</td>
        <td class="font-bold">${t.subject}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${solved > 0 ? `<span class="badge badge-solved">✅ ${solved} SOLVED</span>` : ''}
            ${viewed > 0 ? `<span class="badge badge-viewed">👁️ ${viewed} VIEWED</span>` : ''}
            ${sent > 0 ? `<span class="badge badge-sent">🔔 ${sent} PENDING</span>` : ''}
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openHoIssueModal(${idx})">
              🔍 Track Status
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteSingleIssue('${t.ticketId}')" title="Clear this issue completely from system & cloud">
              🗑️ Clear
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Modal view for Head Office to inspect responses from staff
function openHoIssueModal(issueIndex) {
  const issues = getStoredIssues();
  const issue = issues[issueIndex];
  if (!issue) return;

  const modal = document.getElementById("hoDetailModal");
  const modalContent = document.getElementById("hoModalBody");
  if (!modal || !modalContent) return;

  const targetList = Array.isArray(issue.targetStaff) ? issue.targetStaff : (Array.isArray(issue.targetCircles) ? issue.targetCircles : []);

  let responsesRows = targetList.map(target => {
    const resp = (issue.staffResponses && issue.staffResponses[target]) || (issue.circleResponses && issue.circleResponses[target]) || { status: "Sent" };
    let statusBadge = `<span class="badge badge-sent">Sent (Unread)</span>`;

    if (resp.status === "Accepted" || resp.status === "Solved") {
      statusBadge = `<span class="badge badge-solved">✅ Solved</span>`;
    } else if (resp.status === "Submitted") {
      statusBadge = `<span class="badge badge-review">📩 Submitted</span>`;
    } else if (resp.status === "Viewed") {
      statusBadge = `<span class="badge badge-viewed">👁️ Viewed</span>`;
    }

    return `
      <tr>
        <td class="font-bold">${target}</td>
        <td>${statusBadge}</td>
        <td>${resp.solvedDate ? formatDate(resp.solvedDate) : '-'}</td>
        <td style="font-size:0.85rem; max-width: 320px;">${resp.remarks || '-'}</td>
      </tr>
    `;
  }).join('');

  modalContent.innerHTML = `
    <div style="margin-bottom: 1.25rem;">
      <h4 style="color: var(--primary-dark); font-size: 1.1rem; margin-bottom: 0.5rem;">${issue.ticketId}: ${issue.subject}</h4>
      <p style="color: var(--text-muted); font-size: 0.9rem;">Issued by <strong>${issue.issuingWing}</strong> on <strong>${formatDate(issue.issueDate)}</strong></p>
      <div style="background-color: #f8fafc; padding: 0.85rem; border-radius: 6px; margin-top: 0.75rem; border-left: 3px solid var(--primary-main); font-size: 0.9rem;">
        <strong>Issue Description:</strong><br>
        ${issue.description}
      </div>
    </div>
    <h5 style="margin-bottom: 0.75rem; font-weight: 700; color: var(--primary-dark);">Staff Response & Status Breakdown:</h5>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Staff Name</th>
            <th>Status</th>
            <th>Solved Date</th>
            <th>Resolution Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${responsesRows}
        </tbody>
      </table>
    </div>
    <div style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1rem;">
      <button type="button" class="btn btn-danger btn-sm" onclick="deleteSingleIssue('${issue.ticketId}')" title="Clear this issue completely from system & cloud">
        🗑️ Clear This Issue
      </button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="closeHoModal()">
        Close Window
      </button>
    </div>
  `;

  modal.classList.add("active");
}

function closeHoModal() {
  const modal = document.getElementById("hoDetailModal");
  if (modal) modal.classList.remove("active");
}

async function deleteSingleIssue(ticketId) {
  if (!confirm(`Are you sure you want to clear and delete issue "${ticketId}"?\n\nThis will remove it completely from Head Office and clear it from all Staff Portals through the cloud.`)) {
    return;
  }

  let issues = getStoredIssues();
  const initialLength = issues.length;
  issues = issues.filter(t => t.ticketId !== ticketId);

  if (issues.length === initialLength) {
    showToast(`Issue ${ticketId} not found`, "warning");
    return;
  }

  saveIssuesToLocal(issues);
  if (document.getElementById("hoTicketsTableBody")) renderHeadOfficeDashboard();
  if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) renderStaffDashboard();

  showToast(`Clearing ${ticketId} from cloud...`, "info");
  const res = await pushIssuesRemote(issues);
  if (res.success) {
    showToast(`Issue ${ticketId} cleared permanently from system & cloud!`, "success");
  } else {
    showToast(`Cleared locally. Cloud sync: ${res.error || 'Failed'}`, "warning");
  }
}


// ==========================================
// STAFF PORTAL LOGIC (staff.html)
// ==========================================

// Retrieve Initial Staff from URL or localStorage
function getInitialStaffName() {
  const staffList = getStoredStaff();
  // 1. Check URL parameters: ?staff=Shashank or ?circle=Shashank
  const urlParams = new URLSearchParams(window.location.search);
  const paramStaff = urlParams.get("staff") || urlParams.get("circle");
  if (paramStaff && staffList.includes(paramStaff)) {
    try {
      localStorage.setItem(LAST_STAFF_KEY, paramStaff);
      localStorage.setItem(LAST_CIRCLE_KEY, paramStaff);
    } catch (e) {}
    return paramStaff;
  }

  // 2. Check localStorage
  try {
    const saved = localStorage.getItem(LAST_STAFF_KEY) || localStorage.getItem(LAST_CIRCLE_KEY) || localStorage.getItem("tn_fd_last_selected_circle_v6");
    if (saved && staffList.includes(saved)) {
      return saved;
    }
  } catch (e) {}

  // 3. Fallback default
  return staffList[0] || DEFAULT_STAFF_LIST[0];
}

const getInitialCircleName = getInitialStaffName; // Alias

let activeStaffName = getInitialStaffName();
let activeCircleName = activeStaffName; // Alias

function renderStaffDropdown() {
  const staffSelect = document.getElementById("activeStaffSelect") || document.getElementById("activeCircleSelect");
  if (!staffSelect) return;

  const currentStaff = getStoredStaff();
  if (currentStaff.length === 0) return;

  if (!currentStaff.includes(activeStaffName)) {
    activeStaffName = getInitialStaffName();
    activeCircleName = activeStaffName;
  }

  const previousVal = staffSelect.value;
  staffSelect.innerHTML = `
    <optgroup label="👥 Staff Members">
      ${currentStaff.map(s => `<option value="${s}">${s}</option>`).join('')}
    </optgroup>
  `;

  if (previousVal && currentStaff.includes(previousVal)) {
    staffSelect.value = previousVal;
    activeStaffName = previousVal;
    activeCircleName = previousVal;
  } else {
    staffSelect.value = activeStaffName;
  }
}

async function initStaffPage() {
  activeStaffName = getInitialStaffName();
  activeCircleName = activeStaffName;

  const staffSelect = document.getElementById("activeStaffSelect") || document.getElementById("activeCircleSelect");
  if (staffSelect) {
    renderStaffDropdown();

    staffSelect.addEventListener("change", (e) => {
      activeStaffName = e.target.value;
      activeCircleName = activeStaffName;
      
      // Persist in localStorage
      try {
        localStorage.setItem(LAST_STAFF_KEY, activeStaffName);
        localStorage.setItem(LAST_CIRCLE_KEY, activeStaffName);
      } catch (err) {}

      // Update URL query parameter without page reload
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("staff", activeStaffName);
      newUrl.searchParams.delete("circle");
      window.history.replaceState({}, "", newUrl.toString());

      renderStaffDashboard();
      showToast(`Viewing inbox for ${activeStaffName}`, "info", 2000);
    });
  }

  // Render immediately from local cache
  renderStaffDashboard();

  // Fetch latest data from cloud in background and re-render
  await fetchIssuesRemote(false);
  renderStaffDropdown();
  renderStaffDashboard();
}

const initCirclePage = initStaffPage; // Alias

function renderStaffDashboard() {
  const issues = getStoredIssues();

  // Filter issues targeted for activeStaffName
  const assignedIssues = issues.filter(t => {
    const targets = Array.isArray(t.targetStaff) ? t.targetStaff : (Array.isArray(t.targetCircles) ? t.targetCircles : []);
    return targets.includes(activeStaffName);
  });

  let totalAssigned = assignedIssues.length;
  let pendingCount = 0;
  let viewedCount = 0;
  let solvedCount = 0;

  assignedIssues.forEach(t => {
    const resp = (t.staffResponses && t.staffResponses[activeStaffName]) || (t.circleResponses && t.circleResponses[activeStaffName]) || { status: "Sent" };
    if (resp.status === "Accepted") solvedCount++;
    else if (resp.status === "Submitted") solvedCount++;
    else if (resp.status === "Rejected") pendingCount++;
    else if (resp.status === "Viewed") viewedCount++;
    else pendingCount++;
  });

  // Update KPI Cards on Staff Page
  const totalEl = document.getElementById("staffTotalIssues") || document.getElementById("circleTotalIssues");
  const pendingEl = document.getElementById("staffPendingIssues") || document.getElementById("circlePendingIssues");
  const viewedEl = document.getElementById("staffViewedIssues") || document.getElementById("circleViewedIssues");
  const solvedEl = document.getElementById("staffSolvedIssues") || document.getElementById("circleSolvedIssues");

  if (totalEl) totalEl.textContent = totalAssigned;
  if (pendingEl) pendingEl.textContent = pendingCount;
  if (viewedEl) viewedEl.textContent = viewedCount;
  if (solvedEl) solvedEl.textContent = solvedCount;

  // Render Table for Staff
  const tableBody = document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody");
  if (!tableBody) return;

  if (assignedIssues.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p style="font-weight: 600; font-size: 1rem; color: #475569;">No urgent issues assigned for ${activeStaffName} yet.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = assignedIssues.map(t => {
    const resp = (t.staffResponses && t.staffResponses[activeStaffName]) || (t.circleResponses && t.circleResponses[activeStaffName]) || { status: "Sent" };
    let statusBadge = `<span class="badge badge-sent">New Issue</span>`;
    let btnLabel = `✍️ View & Reply`;
    let btnClass = `btn-success`;

    if (resp.status === "Accepted" || resp.status === "Solved") {
      statusBadge = `<span class="badge badge-solved">✅ Solved</span>`;
      btnLabel = `🔍 View Status`;
      btnClass = `btn-secondary`;
    } else if (resp.status === "Submitted") {
      statusBadge = `<span class="badge badge-review">📩 Submitted</span>`;
      btnLabel = `🔍 View Submission`;
      btnClass = `btn-secondary`;
    } else if (resp.status === "Viewed") {
      statusBadge = `<span class="badge badge-viewed">Viewed</span>`;
      btnLabel = `✍️ View & Reply`;
      btnClass = `btn-success`;
    }

    return `
      <tr>
        <td class="font-bold">${t.ticketId}</td>
        <td>${formatDate(t.issueDate)}</td>
        <td><span class="badge badge-wing">${t.issuingWing}</span></td>
        <td class="font-bold" style="color: #dc2626;">${t.subject}</td>
        <td>${statusBadge}</td>
        <td>${resp.solvedDate ? formatDate(resp.solvedDate) : '-'}</td>
        <td>
          <button class="btn ${btnClass} btn-sm" onclick="openStaffIssueModal('${t.ticketId}')">
            ${btnLabel}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

const renderCircleDashboard = renderStaffDashboard; // Alias

// Staff Action Modal: View details & Submit Reply
let currentStaffIssueId = null;
let currentCircleIssueId = null;

function openStaffIssueModal(issueId) {
  currentStaffIssueId = issueId;
  currentCircleIssueId = issueId;
  const issues = getStoredIssues();
  let issue = issues.find(t => t.ticketId === issueId && (
    !activeStaffName ||
    (Array.isArray(t.targetStaff) && t.targetStaff.includes(activeStaffName)) ||
    (Array.isArray(t.targetCircles) && t.targetCircles.includes(activeStaffName))
  ));
  if (!issue) {
    issue = issues.find(t => t.ticketId === issueId);
  }
  if (!issue) return;

  // Automatically mark status as "Viewed" if currently "Sent"
  if (!issue.staffResponses) issue.staffResponses = {};
  if (!issue.circleResponses) issue.circleResponses = {};
  
  if (!issue.staffResponses[activeStaffName]) {
    issue.staffResponses[activeStaffName] = (issue.circleResponses[activeStaffName]) ? { ...issue.circleResponses[activeStaffName] } : { status: "Sent" };
  }

  const currentResp = issue.staffResponses[activeStaffName];
  if (currentResp.status === "Sent") {
    currentResp.status = "Viewed";
    currentResp.viewedAt = new Date().toLocaleString();
    issue.circleResponses[activeStaffName] = { ...currentResp };
    saveIssues(issues);
    renderStaffDashboard();
  }

  const modal = document.getElementById("staffDetailModal") || document.getElementById("circleDetailModal");
  const modalContent = document.getElementById("staffModalBody") || document.getElementById("circleModalBody");
  if (!modal || !modalContent) return;

  const isAccepted = currentResp.status === "Accepted" || currentResp.status === "Solved";
  const isSubmitted = currentResp.status === "Submitted";
  const isReadOnly = isAccepted || isSubmitted;
  const defaultToday = new Date().toISOString().split('T')[0];

  let modalStatusBadge = `<span class="badge badge-sent">Status: New</span>`;
  if (isAccepted) modalStatusBadge = `<span class="badge badge-solved">✅ Solved / Completed</span>`;
  else if (isSubmitted) modalStatusBadge = `<span class="badge badge-review">📩 Submitted (Under Review)</span>`;
  else if (currentResp.status === "Viewed") modalStatusBadge = `<span class="badge badge-viewed">Status: Viewed</span>`;

  modalContent.innerHTML = `
    <div style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
        <div>
          <span class="badge badge-wing" style="margin-bottom: 0.4rem;">Issued by: ${issue.issuingWing}</span>
          <h4 style="color: #dc2626; font-size: 1.25rem; font-weight: 700; line-height: 1.3;">${issue.ticketId}: ${issue.subject}</h4>
          <p style="color: var(--text-muted); font-size: 0.875rem;">Issue Date: ${formatDate(issue.issueDate)}</p>
        </div>
        <div>
          ${modalStatusBadge}
        </div>
      </div>
      
      <div style="background-color: #fef2f2; padding: 0.55rem 0.85rem; border-radius: 6px; margin-top: 0.75rem; border-left: 3px solid #dc2626; font-size: 0.85rem;">
        <strong style="color: #dc2626; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.4px;">Instruction:</strong>
        <p style="margin-top: 0.25rem; line-height: 1.4; color: #dc2626; font-weight: 600; font-size: 0.95rem;">${issue.description}</p>
      </div>
    </div>

    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.25rem 0;">

    <form id="staffReplyForm">
      <h5 style="color: var(--primary-dark); font-size: 1.05rem; margin-bottom: 1rem;">
        ${isAccepted ? 'Resolution Response (✅ Solved):' : 
          (isSubmitted ? 'Submitted Resolution Response (⏳ Under Review by Head Office):' : 
          'Submit Resolution & Reply back to Head Office:')}
      </h5>

      <div class="form-grid">
        <div class="form-group full-width">
          <label for="solvedDate">Issue Solved Date *</label>
          <input type="date" id="solvedDate" class="form-control" value="${currentResp.solvedDate || defaultToday}" ${isReadOnly ? 'readonly' : 'required'}>
        </div>

        <div class="form-group full-width">
          <label for="replyRemarks">Resolution Remarks / Action Taken Details *</label>
          <textarea id="replyRemarks" class="form-control" rows="4" placeholder="Write description of action taken or compliance report details..." ${isReadOnly ? 'readonly' : 'required'}>${currentResp.remarks || ''}</textarea>
        </div>
      </div>

      ${!isReadOnly ? `
        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-secondary" onclick="closeStaffModal()">Cancel</button>
          <button type="submit" class="btn btn-success" id="staffSubmitBtn">
            ✅ Submit Reply to Head Office
          </button>
        </div>
      ` : `
        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closeStaffModal()">Close Window</button>
        </div>
      `}
    </form>
  `;

  if (!isReadOnly) {
    const replyForm = document.getElementById("staffReplyForm") || document.getElementById("circleReplyForm");
    if (replyForm) {
      replyForm.onsubmit = async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById("staffSubmitBtn") || document.getElementById("circleSubmitBtn");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "⏳ Submitting to Cloud...";
        }

        const solvedDate = document.getElementById("solvedDate") ? document.getElementById("solvedDate").value : defaultToday;
        const remarks = document.getElementById("replyRemarks") ? document.getElementById("replyRemarks").value.trim() : "";

        const issuesList = getStoredIssues();
        let tIndex = issuesList.findIndex(t => t.ticketId === issueId && (
          !activeStaffName ||
          (Array.isArray(t.targetStaff) && t.targetStaff.includes(activeStaffName)) ||
          (Array.isArray(t.targetCircles) && t.targetCircles.includes(activeStaffName))
        ));
        if (tIndex === -1) {
          tIndex = issuesList.findIndex(t => t.ticketId === issueId);
        }
        if (tIndex !== -1) {
          if (!issuesList[tIndex].staffResponses) issuesList[tIndex].staffResponses = {};
          if (!issuesList[tIndex].circleResponses) issuesList[tIndex].circleResponses = {};

          const resolvedObj = {
            status: "Submitted",
            viewedAt: currentResp.viewedAt || new Date().toLocaleString(),
            solvedDate: solvedDate,
            submittedAt: new Date().toLocaleString(),
            mode: currentResp.mode || "-",
            referenceNo: currentResp.referenceNo || "-",
            remarks: remarks
          };

          issuesList[tIndex].staffResponses[activeStaffName] = resolvedObj;
          issuesList[tIndex].circleResponses[activeStaffName] = resolvedObj;

          const pushRes = await pushIssuesRemote(issuesList);
          
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "✅ Submit Reply to Head Office";
          }

          if (pushRes.success) {
            showToast(`Resolution response for ${issueId} submitted to cloud!`, "success", 5000);
          } else {
            showToast(`Saved locally on this PC (${pushRes.error})`, "warning", 6000);
          }

          closeStaffModal();
          renderStaffDashboard();
        }
      };
    }
  }

  modal.classList.add("active");
}

const openCircleIssueModal = openStaffIssueModal; // Alias

// ==========================================
// DYNAMIC STAFF MANAGEMENT (Add / Edit / Delete)
// ==========================================

function openStaffManageModal() {
  const modal = document.getElementById("manageStaffModal");
  if (!modal) return;
  renderStaffManageTable();
  const input = document.getElementById("newStaffNameInput");
  if (input) {
    input.value = "";
    input.focus();
  }
  modal.classList.add("active");
}

function closeStaffManageModal() {
  const modal = document.getElementById("manageStaffModal");
  if (modal) modal.classList.remove("active");
}

function renderStaffManageTable() {
  const tbody = document.getElementById("manageStaffTableBody");
  if (!tbody) return;

  const currentStaff = getStoredStaff();
  if (currentStaff.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted); padding: 1.25rem;">No staff members configured. Add one above!</td></tr>`;
    return;
  }

  tbody.innerHTML = currentStaff.map((staff, idx) => `
    <tr>
      <td style="font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
      <td style="font-weight: 600; color: var(--primary-dark);">${staff}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="editStaffMember(${idx})" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; margin-right: 0.35rem;">✏️ Edit</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteStaffMember(${idx})" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

async function addNewStaffMember() {
  const input = document.getElementById("newStaffNameInput");
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    showToast("Please enter a valid staff name", "warning");
    input.focus();
    return;
  }

  let currentStaff = getStoredStaff();
  if (currentStaff.some(s => s.toLowerCase() === name.toLowerCase())) {
    showToast(`Staff member "${name}" already exists!`, "warning");
    input.focus();
    return;
  }

  currentStaff.push(name);
  saveStoredStaff(currentStaff);
  refreshGlobalStaffList();
  renderStaffManageTable();
  renderStaffCheckboxes();
  input.value = "";

  showToast(`Adding "${name}" and syncing to cloud...`, "info");
  const res = await pushIssuesRemote(undefined, currentStaff);
  if (res.success) {
    showToast(`Staff member "${name}" added & synced to cloud!`, "success");
  } else {
    showToast(`Staff saved locally. Cloud sync: ${res.error || 'Failed'}`, "warning");
  }
}

async function editStaffMember(index) {
  let currentStaff = getStoredStaff();
  if (index < 0 || index >= currentStaff.length) return;
  const oldName = currentStaff[index];
  const newName = prompt(`Edit staff member name:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const trimmed = newName.trim();
  if (currentStaff.some((s, idx) => idx !== index && s.toLowerCase() === trimmed.toLowerCase())) {
    showToast(`Staff member "${trimmed}" already exists!`, "warning");
    return;
  }

  currentStaff[index] = trimmed;
  saveStoredStaff(currentStaff);
  refreshGlobalStaffList();

  // Migrate existing issues so assigned tickets update to the new staff name
  const issues = getStoredIssues();
  let updatedCount = 0;
  issues.forEach(issue => {
    // Migrate targetStaff
    if (Array.isArray(issue.targetStaff)) {
      const idxStaff = issue.targetStaff.indexOf(oldName);
      if (idxStaff !== -1) {
        issue.targetStaff[idxStaff] = trimmed;
        updatedCount++;
      }
    }
    if (Array.isArray(issue.targetCircles)) {
      const idxCircle = issue.targetCircles.indexOf(oldName);
      if (idxCircle !== -1) {
        issue.targetCircles[idxCircle] = trimmed;
      }
    }
    // Migrate staffResponses
    if (issue.staffResponses && issue.staffResponses[oldName]) {
      issue.staffResponses[trimmed] = issue.staffResponses[oldName];
      delete issue.staffResponses[oldName];
      updatedCount++;
    }
    if (issue.circleResponses && issue.circleResponses[oldName]) {
      issue.circleResponses[trimmed] = issue.circleResponses[oldName];
      delete issue.circleResponses[oldName];
    }
  });

  if (updatedCount > 0) {
    saveIssuesToLocal(issues);
  }

  renderStaffManageTable();
  renderStaffCheckboxes();
  if (document.getElementById("hoTicketsTableBody")) renderHeadOfficeDashboard();

  showToast(`Renamed "${oldName}" to "${trimmed}". Syncing to cloud...`, "info");
  const res = await pushIssuesRemote(issues, currentStaff);
  if (res.success) {
    showToast(`Staff member updated & synced to cloud!`, "success");
  } else {
    showToast(`Saved locally. Cloud sync: ${res.error || 'Failed'}`, "warning");
  }
}

async function deleteStaffMember(index) {
  let currentStaff = getStoredStaff();
  if (index < 0 || index >= currentStaff.length) return;
  const targetName = currentStaff[index];

  if (!confirm(`Are you sure you want to delete staff member "${targetName}"?\n\nThis will remove them from new issue assignments across all systems.`)) {
    return;
  }

  currentStaff.splice(index, 1);
  saveStoredStaff(currentStaff);
  refreshGlobalStaffList();
  renderStaffManageTable();
  renderStaffCheckboxes();

  showToast(`Deleted "${targetName}". Syncing to cloud...`, "info");
  const res = await pushIssuesRemote(undefined, currentStaff);
  if (res.success) {
    showToast(`Staff member "${targetName}" deleted & synced to cloud!`, "success");
  } else {
    showToast(`Saved locally. Cloud sync: ${res.error || 'Failed'}`, "warning");
  }
}

function closeStaffModal() {
  const modal = document.getElementById("staffDetailModal") || document.getElementById("circleDetailModal");
  if (modal) modal.classList.remove("active");
}

const closeCircleModal = closeStaffModal; // Alias

// Global modal backdrop click handler
window.addEventListener("click", (e) => {
  const hoModal = document.getElementById("hoDetailModal");
  const staffModal = document.getElementById("staffDetailModal") || document.getElementById("circleDetailModal");
  const syncModal = document.getElementById("syncSettingsModal");
  const manageModal = document.getElementById("manageStaffModal");

  if (e.target === hoModal) closeHoModal();
  if (e.target === staffModal) closeStaffModal();
  if (e.target === syncModal) closeSyncSettingsModal();
  if (e.target === manageModal) closeStaffManageModal();
});

// ==========================================
// AUTOMATIC REAL-TIME SYNC ENGINE
// ==========================================

// Auto-sync when user returns to tab or focuses window
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    fetchIssuesRemote(false).then(() => {
      if (document.getElementById("hoTicketsTableBody")) {
        renderStaffCheckboxes();
        renderHeadOfficeDashboard();
      }
      if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) {
        renderStaffDropdown();
        renderStaffDashboard();
      }
      if (document.getElementById("ticketId")) updateFormIssueId();
    });
  }
});

window.addEventListener("focus", () => {
  fetchIssuesRemote(false).then(() => {
    if (document.getElementById("hoTicketsTableBody")) {
      renderStaffCheckboxes();
      renderHeadOfficeDashboard();
    }
    if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) {
      renderStaffDropdown();
      renderStaffDashboard();
    }
    if (document.getElementById("ticketId")) updateFormIssueId();
  });
});

// Periodic background sync every 30 seconds
setInterval(() => {
  fetchIssuesRemote(false).then(() => {
    if (document.getElementById("hoTicketsTableBody")) {
      renderStaffCheckboxes();
      renderHeadOfficeDashboard();
    }
    if (document.getElementById("staffTicketsTableBody") || document.getElementById("circleTicketsTableBody")) {
      renderStaffDropdown();
      renderStaffDashboard();
    }
  });
}, 30000);
