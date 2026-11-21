/**
 * Meeting Schedule One-View Dashboard - Application Logic
 * Integrates live Google Sheet data, rolling 4-5 day shifting window,
 * past months archive navigation, and filled vs. left slot details.
 */

(function () {
  'use strict';

  // Google Sheet Configuration
  const SPREADSHEET_ID = '1DUEXt9cevmjP4uA-IRtM5m_6BpRjxtuOsn3UCWvmes4';
  
  // Base default configuration of known months (October 2026 active by default)
  const DEFAULT_MONTHS_CONFIG = [
    { id: 'nov2026', name: "November 2026", gid: '1931933414', isDefault: true, badge: 'Current' },
    { id: 'oct2026', name: "October 2026", gid: '1481814331', isDefault: false, badge: 'Past' },
    { id: 'sep2026', name: "September 2026", gid: '1457623712', isDefault: false, badge: 'Past' },
    { id: 'aug2026', name: "August 2026", gid: '661615910', isDefault: false, badge: 'Past' },
    { id: 'apr_jul2026', name: "April - July 2026", gid: '291201488', isDefault: false, badge: 'Past' },
    { id: 'mar2026', name: "March 2026", gid: '2100265920', isDefault: false, badge: 'Past' }
  ];

  function loadSavedMonths() {
    const now = new Date();
    const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const currentYear = String(now.getFullYear());

    let list = JSON.parse(JSON.stringify(DEFAULT_MONTHS_CONFIG));

    try {
      const saved = localStorage.getItem('meeting_dashboard_custom_months');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(sm => {
            const existingIdx = list.findIndex(m => (m.gid && sm.gid && m.gid === sm.gid) || m.id === sm.id);
            if (existingIdx !== -1) {
              list[existingIdx] = { ...sm, ...list[existingIdx] };
            } else {
              list.push(sm);
            }
          });
        }
      }
    } catch (e) {}

    // Ensure active/default badge strictly reflects current calendar month:
    let matchedCurrent = false;
    list.forEach(m => {
      const isCurr = m.name.toLowerCase().includes(currentMonthName) && m.name.includes(currentYear);
      if (isCurr) {
        m.isDefault = true;
        m.badge = 'Current';
        matchedCurrent = true;
      } else {
        m.isDefault = false;
        m.badge = 'Past';
      }
    });

    if (!matchedCurrent && list.length > 0) {
      list[0].isDefault = true;
      list[0].badge = 'Current';
    }

    return list;
  }

  function saveDiscoveredMonths() {
    try {
      localStorage.setItem('meeting_dashboard_custom_months', JSON.stringify(MONTHS_CONFIG));
    } catch (e) {}
  }

  function determineInitialActiveMonth() {
    const now = new Date();
    const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const currentYear = String(now.getFullYear());

    // 1. If we have a month matching the current real-world calendar month, ALWAYS prioritize it!
    const currentCalendarMonth = MONTHS_CONFIG.find(m => 
      m.name.toLowerCase().includes(currentMonthName) && m.name.includes(currentYear)
    );

    // 2. Check if user explicitly selected an archive month in this active browser session
    const sessionActive = sessionStorage.getItem('meeting_dashboard_active_month');
    if (sessionActive && MONTHS_CONFIG.some(m => m.id === sessionActive)) {
      return sessionActive;
    }

    // 3. If today is in the current calendar month, lock to current month!
    if (currentCalendarMonth) {
      localStorage.setItem('meeting_dashboard_active_month', currentCalendarMonth.id);
      return currentCalendarMonth.id;
    }

    // 4. Saved active from previous session (only if still valid)
    const savedActive = localStorage.getItem('meeting_dashboard_active_month');
    if (savedActive && MONTHS_CONFIG.some(m => m.id === savedActive)) {
      return savedActive;
    }

    // 5. Default month from config
    const def = MONTHS_CONFIG.find(m => m.isDefault);
    return def ? def.id : (MONTHS_CONFIG[0] ? MONTHS_CONFIG[0].id : 'nov2026');
  }

  let MONTHS_CONFIG = loadSavedMonths();

  const STANDARD_SLOTS = [
    '10-11 AM',
    '11 - 12 PM',
    '12 PM - 1 PM',
    'LUNCH',
    '2 PM - 3 PM',
    '3 PM - 4 PM',
    '4 PM - 5 PM',
    '5 PM - 6 PM',
    'BEYOND 6 PM'
  ];

  // Application State
  const state = {
    activeMonthId: determineInitialActiveMonth(),
    anchorDateStr: formatISODate(new Date()), // ISO YYYY-MM-DD
    windowDays: 4, // Default 4-day rolling window (today + 3 coming days)
    viewMode: 'cards', // 'cards' or 'table'
    statusFilter: 'all', // 'all', 'available', 'filled'
    wingFilter: 'all',
    searchQuery: '',
    monthsData: {},
    isLiveSyncing: false,
    lastSyncTime: null,
    isDarkMode: false
  };

  // DOM Elements cache
  let dom = {};

  function initDOM() {
    dom = {
      monthSelectDropdown: document.getElementById('monthSelectDropdown'),
      monthBtnGroup: document.getElementById('monthBtnGroup'),
      monthEndBanner: document.getElementById('monthEndBanner'),
      monthEndText: document.getElementById('monthEndText'),
      monthEndBtn: document.getElementById('monthEndBtn'),
      activeRangeText: document.getElementById('activeRangeText'),
      prevDayBtn: document.getElementById('prevDayBtn'),
      nextDayBtn: document.getElementById('nextDayBtn'),
      todayBtn: document.getElementById('todayBtn'),
      datePickerInput: document.getElementById('datePickerInput'),
      rangeToggleGroup: document.getElementById('rangeToggleGroup'),
      metricTotalSlots: document.getElementById('metricTotalSlots'),
      metricAvailableSlots: document.getElementById('metricAvailableSlots'),
      metricFilledSlots: document.getElementById('metricFilledSlots'),
      metricTodayStatus: document.getElementById('metricTodayStatus'),
      statusFilterGroup: document.getElementById('statusFilterGroup'),
      wingSelectFilter: document.getElementById('wingSelectFilter'),
      searchInput: document.getElementById('searchInput'),
      rollingBoard: document.getElementById('rollingBoard'),
      tableContainer: document.getElementById('tableContainer'),
      scheduleTableBody: document.getElementById('scheduleTableBody'),
      syncStatusText: document.getElementById('syncStatusText'),
      refreshBtn: document.getElementById('refreshBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      slotModal: document.getElementById('slotModal'),
      modalCloseBtn: document.getElementById('modalCloseBtn'),
      modalBody: document.getElementById('modalBody'),
      copySlotBtn: document.getElementById('copySlotBtn'),
      toastNotification: document.getElementById('toastNotification')
    };
  }

  // Helper date functions
  function parseISODate(isoStr) {
    const parts = isoStr.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function formatISODate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDisplayDate(dateObj) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }

  function formatShortDate(dateObj) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
  }

  function getDayName(dateObj) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dateObj.getDay()];
  }

  // Load preloaded bundled data
  function loadPreloadedData() {
    if (window.PRELOADED_SCHEDULE_DATA && window.PRELOADED_SCHEDULE_DATA.months) {
      state.monthsData = JSON.parse(JSON.stringify(window.PRELOADED_SCHEDULE_DATA.months));
      state.lastSyncTime = new Date();
      updateSyncBadge(true, "Bundled Cache Loaded");
    }
  }

  // Update sync status indicator
  function updateSyncBadge(isOk, message) {
    if (!dom.syncStatusText) return;
    if (message) {
      dom.syncStatusText.textContent = message;
    } else if (isOk) {
      const timeStr = state.lastSyncTime ? state.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live';
      dom.syncStatusText.textContent = `Live Synced (${timeStr})`;
    } else {
      dom.syncStatusText.textContent = `Offline (Using local data)`;
    }
  }

  // Robust CSV parser
  function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
    }
    return rows;
  }

  // Process standard sheet CSV rows
  function processSheetRows(rows) {
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 1 && rows[i][0].toUpperCase().includes('DATE')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return [];

    const headers = rows[headerIdx];
    const validSlotNames = headers.slice(3).filter(s => s && !s.startsWith('I do not have'));

    const days = [];
    let currentDay = null;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => c)) continue;

      const dateStr = (row[0] || '').trim();
      const dayStr = (row[1] || '').trim();
      const attrStr = (row[2] || '').trim().toLowerCase();

      // Check if this row is a new date (DD.MM.YYYY or similar)
      const dateMatch = dateStr.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
      if (dateMatch) {
        if (currentDay) {
          days.push(currentDay);
        }
        const d = dateMatch[1].padStart(2, '0');
        const m = dateMatch[2].padStart(2, '0');
        const y = dateMatch[3].length === 4 ? dateMatch[3] : '20' + dateMatch[3];
        const formattedDate = `${d}.${m}.${y}`;
        const isoDate = `${y}-${m}-${d}`;

        currentDay = {
          date: formattedDate,
          isoDate: isoDate,
          day: dayStr || getDayName(parseISODate(isoDate)),
          slots: {}
        };

        STANDARD_SLOTS.forEach(slot => {
          currentDay.slots[slot] = {
            time: slot,
            isFilled: false,
            isLunch: slot === 'LUNCH',
            wing: '',
            subject: '',
            reference: '',
            venue: ''
          };
        });
      }

      if (!currentDay) continue;

      let key = null;
      if (attrStr.includes('wing') || attrStr.includes('unit')) key = 'wing';
      else if (attrStr.includes('subject')) key = 'subject';
      else if (attrStr.includes('ref')) key = 'reference';
      else if (attrStr.includes('venue') || attrStr.includes('mode')) key = 'venue';

      if (key) {
        validSlotNames.forEach((slotName, sIdx) => {
          const colIdx = 3 + sIdx;
          if (colIdx < row.length) {
            const val = (row[colIdx] || '').trim();
            if (val) {
              let targetSlot = null;
              for (const std of STANDARD_SLOTS) {
                if (std.toLowerCase().replace(/\s/g, '') === slotName.toLowerCase().replace(/\s/g, '')) {
                  targetSlot = std;
                  break;
                }
              }
              if (!targetSlot) {
                targetSlot = slotName;
                if (!currentDay.slots[targetSlot]) {
                  currentDay.slots[targetSlot] = {
                    time: targetSlot,
                    isFilled: false,
                    isLunch: targetSlot.toLowerCase().includes('lunch'),
                    wing: '',
                    subject: '',
                    reference: '',
                    venue: ''
                  };
                }
              }
              currentDay.slots[targetSlot][key] = val;
              if ((key === 'wing' || key === 'subject') && val) {
                currentDay.slots[targetSlot].isFilled = true;
              }
            }
          }
        });
      }
    }

    if (currentDay) {
      days.push(currentDay);
    }

    // Finalize filled status
    days.forEach(d => {
      Object.values(d.slots).forEach(slot => {
        if (slot.wing || slot.subject) {
          slot.isFilled = true;
        }
        if (slot.isLunch) {
          slot.isFilled = false;
        }
      });
    });

    return days;
  }

  // Toast notification helper
  let toastTimer = null;
  function showToast(msg, duration = 3000) {
    if (!dom.toastNotification) return;
    dom.toastNotification.textContent = msg;
    dom.toastNotification.classList.add('active');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (dom.toastNotification) {
        dom.toastNotification.classList.remove('active');
      }
    }, duration);
  }

  // Live Google Sheet fetch via GViz JSONP
  // Completely bypasses browser CORS restrictions and 307 redirect blocks!
  function fetchSheetViaJSONP(gid) {
    return new Promise((resolve, reject) => {
      const callbackName = 'gviz_cb_' + Math.floor(Math.random() * 10000000);
      let isDone = false;

      const timeout = setTimeout(() => {
        if (!isDone) {
          cleanup();
          reject(new Error('Google Sheet request timed out'));
        }
      }, 12000);

      function cleanup() {
        isDone = true;
        clearTimeout(timeout);
        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
        const s = document.getElementById(callbackName);
        if (s && s.parentNode) {
          s.parentNode.removeChild(s);
        }
      }

      window[callbackName] = function (response) {
        if (isDone) return;
        cleanup();
        try {
          if (!response || !response.table) {
            reject(new Error('Invalid Google Sheet response structure'));
            return;
          }
          const rows = [];
          const gRows = response.table.rows || [];
          for (let i = 0; i < gRows.length; i++) {
            const cells = gRows[i].c || [];
            const rowVals = [];
            for (let j = 0; j < cells.length; j++) {
              const cell = cells[j];
              if (cell) {
                if (cell.f !== undefined && cell.f !== null) {
                  rowVals.push(String(cell.f).trim());
                } else if (cell.v !== undefined && cell.v !== null) {
                  rowVals.push(String(cell.v).trim());
                } else {
                  rowVals.push('');
                }
              } else {
                rowVals.push('');
              }
            }
            rows.push(rowVals);
          }
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };

      const script = document.createElement('script');
      script.id = callbackName;
      // Add cache buster timestamp to ensure fresh live data
      const gidParam = (gid !== undefined && gid !== null && String(gid).trim() !== '') ? `&gid=${gid}` : '';
      script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}${gidParam}&_t=${Date.now()}`;
      script.onerror = function () {
        if (isDone) return;
        cleanup();
        reject(new Error('Network error loading Google Sheet script'));
      };
      document.head.appendChild(script);
    });
  }

  // Fetch live Google Sheet tab
  async function fetchLiveTab(monthConfig) {
    try {
      let rows = null;
      try {
        // Primary: JSONP via script injection (guaranteed CORS-free on all browsers & file://)
        rows = await fetchSheetViaJSONP(monthConfig.gid);
      } catch (jsonpErr) {
        console.warn('JSONP fetch attempt failed, trying fetch fallback:', jsonpErr);
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${monthConfig.gid}&_t=${Date.now()}`;
        const response = await fetch(csvUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        rows = parseCSV(csvText);
      }

      if (!rows || rows.length === 0) return false;

      const parsedDays = processSheetRows(rows);
      if (parsedDays && parsedDays.length > 0) {
        if (!state.monthsData[monthConfig.id]) {
          state.monthsData[monthConfig.id] = { ...monthConfig, days: [] };
        }
        state.monthsData[monthConfig.id].days = parsedDays;
        return true;
      }
    } catch (err) {
      console.warn(`Could not fetch live data for ${monthConfig.name}:`, err);
    }
    return false;
  }

  // Render the month select dropdown dynamically with all discovered/configured months
  function renderMonthDropdown() {
    if (!dom.monthSelectDropdown) return;
    const currentVal = state.activeMonthId;
    dom.monthSelectDropdown.innerHTML = '';

    const now = new Date();
    const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const currentYear = String(now.getFullYear());

    MONTHS_CONFIG.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      const isCurrent = (m.id === state.activeMonthId) || 
                        (m.name.toLowerCase().includes(currentMonthName) && m.name.includes(currentYear));
      const icon = isCurrent ? '\uD83D\uDCC5' : '\uD83D\uDCC1';
      const suffix = isCurrent ? ' (Active)' : '';
      opt.textContent = `${icon} ${m.name}${suffix}`;
      dom.monthSelectDropdown.appendChild(opt);
    });

    const detectOpt = document.createElement('option');
    detectOpt.value = '__AUTO_DETECT__';
    detectOpt.textContent = '\uD83D\uDD04 Auto-Detect New Months from Sheet...';
    dom.monthSelectDropdown.appendChild(detectOpt);

    dom.monthSelectDropdown.value = currentVal;
  }

  // Automatic Google Sheet Discovery:
  // Uses CORS-free Google Visualization JSONP to inspect the live sheet!
  // Google Sheets guarantees that querying /gviz/tq without a gid returns the 1st tab (the newly created active month).
  async function discoverGoogleSheetsTabs(isManualUserAction = false) {
    if (isManualUserAction) {
      showToast("🔍 Checking Google Sheets for newly created months...", 3000);
    }

    try {
      // 1. Query the 1st active tab in Google Sheets via JSONP (100% CORS-free across all browsers & file:// protocol)
      const rows = await fetchSheetViaJSONP('');
      if (rows && rows.length > 1) {
        let detectedMonthName = '';
        const MONTH_NAMES = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];

        for (let i = 0; i < rows.length; i++) {
          const col0 = (rows[i][0] || '').trim();
          const dateMatch = col0.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
          if (dateMatch) {
            const monthNum = parseInt(dateMatch[2], 10);
            const year = dateMatch[3].length === 4 ? dateMatch[3] : '20' + dateMatch[3];
            if (monthNum >= 1 && monthNum <= 12) {
              detectedMonthName = MONTH_NAMES[monthNum - 1] + ' ' + year;
            }
            break;
          }
        }

        if (detectedMonthName) {
          const detectedId = detectedMonthName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const existingIdx = MONTHS_CONFIG.findIndex(m => m.id === detectedId || m.name.toLowerCase() === detectedMonthName.toLowerCase());
          const parsedDays = processSheetRows(rows);

          if (existingIdx === -1) {
            // NEW MONTH DETECTED! Automatically add at top of list
            const newConfig = {
              id: detectedId,
              name: detectedMonthName,
              gid: '',
              isDefault: true,
              badge: 'Current'
            };

            // Demote older months
            MONTHS_CONFIG.forEach(m => {
              m.isDefault = false;
              m.badge = 'Past';
            });

            MONTHS_CONFIG.unshift(newConfig);
            saveDiscoveredMonths();
            renderMonthDropdown();

            if (parsedDays && parsedDays.length > 0) {
              state.monthsData[detectedId] = { ...newConfig, days: parsedDays };
            }

            showToast(`🎉 Auto-detected new month from Google Sheets: "${detectedMonthName}"!`, 4500);
            switchMonth(detectedId);
            return true;
          } else {
            // Existing month: update its days live
            if (parsedDays && parsedDays.length > 0) {
              if (!state.monthsData[detectedId]) {
                state.monthsData[detectedId] = { ...MONTHS_CONFIG[existingIdx], days: [] };
              }
              state.monthsData[detectedId].days = parsedDays;
            }
            if (isManualUserAction) {
              showToast(`✅ Google Sheet is up to date: viewing ${MONTHS_CONFIG[existingIdx].name}.`, 3000);
            }
            return true;
          }
        }
      }
    } catch (err) {
      console.warn("JSONP live first-tab discovery note:", err);
    }

    if (isManualUserAction) {
      showToast("⚠️ Could not reach Google Sheets. Please check your internet connection.", 3500);
    }
    return false;
  }

  // Fetch live updates and anchor to system date on refresh
  async function refreshLiveData() {
    if (state.isLiveSyncing) return;
    state.isLiveSyncing = true;
    updateSyncBadge(true, "Syncing from Google Sheets...");
    showToast("\uD83D\uDD04 Connecting to live Google Sheet...", 2000);

    if (dom.refreshBtn) {
      dom.refreshBtn.classList.add('loading');
      dom.refreshBtn.disabled = true;
    }

    try {
      // 1. Auto-discover newly added month sheets (November, December, etc.)
      await discoverGoogleSheetsTabs(false);

      // 2. Refresh active month data
      const activeCfg = MONTHS_CONFIG.find(m => m.id === state.activeMonthId) || MONTHS_CONFIG[0];
      const success = await fetchLiveTab(activeCfg);
      if (success) {
        state.lastSyncTime = new Date();
        updateSyncBadge(true);
        populateWingFilter();

        const sysToday = getEffectiveTodayDate();
        state.anchorDateStr = sysToday;
        render();

        const count = state.monthsData[activeCfg.id]?.days?.length || 0;
        showToast(`? Live Google Sheet updated! (${activeCfg.name})`, 3000);
      } else {
        updateSyncBadge(false, "Offline / Local Mode");
        showToast("\u26A0\uFE0F Could not reach Google Sheets. Showing cached data.", 3000);
      }
    } finally {
      state.isLiveSyncing = false;
      if (dom.refreshBtn) {
        dom.refreshBtn.classList.remove('loading');
        dom.refreshBtn.disabled = false;
      }
    }
  }

  // Get active month's days
  function getActiveDays() {
    const m = state.monthsData[state.activeMonthId];
    return m ? m.days || [] : [];
  }

  // Generate rolling window of N days (Today + 4 or 5 days)
  function getRollingWindowDays() {
    const activeDays = getActiveDays();
    if (!activeDays.length) return [];

    const anchorDate = parseISODate(state.anchorDateStr);
    const windowDaysList = [];

    for (let offset = 0; offset < state.windowDays; offset++) {
      const targetDate = new Date(anchorDate);
      targetDate.setDate(anchorDate.getDate() + offset);
      const targetIso = formatISODate(targetDate);

      // Find in active month
      let dayData = activeDays.find(d => d.isoDate === targetIso);
      if (!dayData) {
        // Create an empty schedule placeholder day if not in sheet
        const dStr = String(targetDate.getDate()).padStart(2, '0');
        const mStr = String(targetDate.getMonth() + 1).padStart(2, '0');
        const yStr = targetDate.getFullYear();
        dayData = {
          date: `${dStr}.${mStr}.${yStr}`,
          isoDate: targetIso,
          day: getDayName(targetDate),
          isSynthetic: true,
          slots: {}
        };
        STANDARD_SLOTS.forEach(s => {
          dayData.slots[s] = {
            time: s,
            isFilled: false,
            isLunch: s === 'LUNCH',
            wing: '',
            subject: '',
            reference: '',
            venue: ''
          };
        });
      }
      windowDaysList.push({
        ...dayData,
        offsetIndex: offset,
        isToday: offset === 0,
        isTomorrow: offset === 1
      });
    }

    return windowDaysList;
  }

  // Check Month-End status and update banner
  function updateMonthEndAlert(windowDaysList) {
    if (!dom.monthEndBanner) return;

    if (!windowDaysList || windowDaysList.length === 0) {
      dom.monthEndBanner.style.display = 'none';
      return;
    }

    const anchorDate = parseISODate(state.anchorDateStr);
    const lastDayOfAnchorMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
    const currentDayNum = anchorDate.getDate();
    const daysUntilMonthEnd = lastDayOfAnchorMonth - currentDayNum;

    // If within 4 days of month end or on month end
    if (daysUntilMonthEnd <= 4) {
      dom.monthEndBanner.style.display = 'flex';
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[anchorDate.getMonth()];
      
      if (daysUntilMonthEnd === 0) {
        dom.monthEndText.innerHTML = `⚠️ <strong>Today is the Last Day of ${monthName} (${currentDayNum} ${monthName})!</strong> You can seamlessly view past months or upcoming month records using the month dropdown above.`;
      } else {
        dom.monthEndText.innerHTML = `⚠️ <strong>Approaching Month-End:</strong> Only <strong>${daysUntilMonthEnd} day${daysUntilMonthEnd > 1 ? 's' : ''}</strong> remaining in ${monthName}. Use the dropdown above to browse past and future month slots.`;
      }

      // If viewing September and month ends, suggest October / previous months
      if (dom.monthEndBtn) {
        dom.monthEndBtn.style.display = 'inline-flex';
        dom.monthEndBtn.onclick = () => {
          // Switch to another month or trigger view
          const nextIdx = (MONTHS_CONFIG.findIndex(m => m.id === state.activeMonthId) + 1) % MONTHS_CONFIG.length;
          switchMonth(MONTHS_CONFIG[nextIdx].id);
        };
      }
    } else {
      dom.monthEndBanner.style.display = 'none';
    }
  }

  // Wing / Department name normalizer
  // Unifies variations across casing, abbreviations, and suffixes:
  // - Admin Wing unifies: 'ADMIN WING', 'ADMIN Wing', 'Admin Wing', 'Admin wing', 'Admin'
  // - FCA Wing unifies: 'FCA', 'FCA Wing', 'FCA WIng', 'FCA WING'
  // - IT Wing unifies: 'IT', 'IT WING', 'IT Wing'
  // - Wildlife unifies: 'WL', 'WIL', 'WILDLIFE', 'WL Wing', 'Wildlife', 'Wildlife Wing'
  // - Planning & Budgeting unifies: 'P & B', 'P & B Wing', 'P&B', 'Planning & Budgeting'
  function normalizeWing(raw) {
    if (!raw) return '';
    let clean = String(raw).replace(/^\d+[\.\)]\s*/, '').trim();
    clean = clean.replace(/[,;:\-]+$/, '').trim();
    if (!clean) return '';

    const lower = clean.toLowerCase().replace(/\s+/g, ' ');

    // Admin Wing
    if (/^admin(\s*wing)?$/i.test(lower)) {
      return 'Admin Wing';
    }
    // FCA Wing (unifies FCA, FCA Wing, etc. - keeps FCA Wing as requested)
    if (/^fca(\s*wing)?$/i.test(lower)) {
      return 'FCA Wing';
    }
    // IT Wing (unifies IT, IT WING, IT Wing - keeps IT Wing as requested)
    if (/^it(\s*wing)?$/i.test(lower)) {
      return 'IT Wing';
    }
    // Wildlife (unifies WL, Wildlife, Wildlife Wing)
    if (/^(wl|wil|wildlife|wildllife)(\s*wing)?$/i.test(lower)) {
      return 'Wildlife';
    }
    // Planning & Budgeting (unifies P & B, P&B, Planning & Budgeting)
    if (/^(p\s*&\s*b(\s*wing)?|p&b|planning\s*(&|and)\s*budgeting(\s*wing)?)$/i.test(lower)) {
      return 'Planning & Budgeting';
    }
    // Technical Section (unifies TS, TS Section, Technical Section)
    if (/^(technical|techinical|ts)(\s*section)?$/i.test(lower)) {
      return 'Technical Section';
    }
    // Working Plan
    if (/^working\s*plan(\s*wing)?$/i.test(lower)) {
      return 'Working Plan';
    }
    // SF Wing (unifies SF Wing, SF Section)
    if (/^sf(\s*(wing|section))?$/i.test(lower)) {
      return 'SF Wing';
    }
    // Writ Section
    if (/^writ(\s*section)?$/i.test(lower)) {
      return 'Writ Section';
    }
    // Motor Vehicle
    if (/^(motor\s*vehicle|mv)$/i.test(lower)) {
      return 'Motor Vehicle';
    }
    // PCCF Wings
    if (lower.includes('pccf') && lower.includes('hoff')) {
      return 'PCCF (HoFF)';
    }
    if (lower.includes('pccf') && lower.includes('p&b')) {
      return 'PCCF (P&B)';
    }
    if (lower.includes('pccf') && lower.includes('cwlw')) {
      return 'PCCF (CWLW)';
    }
    if (/^gis(\s*wing)?$/i.test(lower)) {
      return 'GIS Wing';
    }
    if (/^tnswa$/i.test(lower)) {
      return 'TNSWA';
    }
    if (/^tbgpccr$/i.test(lower)) {
      return 'TBGPCCR';
    }
    if (/^tc\s*1$/i.test(lower)) {
      return 'TC1';
    }
    // Known uppercase acronyms
    if (/^(acs|gtm|moefcc|tantea|tnfwccb|tnsffcc)$/i.test(lower)) {
      return clean.toUpperCase();
    }
    // Sections like L Section, LL Section, RR Section, BB Section
    if (/^[a-z]{1,3}\s*section$/i.test(lower)) {
      const parts = clean.split(/\s+/);
      return `${parts[0].toUpperCase()} Section`;
    }

    // Default clean title case
    return clean.split(' ').map(w => {
      if (w.toUpperCase() === w && w.length <= 4) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  // Populate Wing/Unit filter dropdown dynamically with unified, deduplicated names
  function populateWingFilter() {
    if (!dom.wingSelectFilter) return;
    const activeDays = getActiveDays();
    const wingsSet = new Set();

    activeDays.forEach(d => {
      Object.values(d.slots).forEach(slot => {
        if (slot.wing) {
          // Extract wings and normalize each one
          const lines = slot.wing.split('\n');
          lines.forEach(l => {
            const norm = normalizeWing(l);
            if (norm && norm.length > 1 && norm.length < 40) {
              wingsSet.add(norm);
            }
          });
        }
      });
    });

    const currentVal = dom.wingSelectFilter.value || 'all';
    dom.wingSelectFilter.innerHTML = '<option value="all">All Wings / Departments</option>';
    
    Array.from(wingsSet).sort().forEach(wing => {
      const opt = document.createElement('option');
      opt.value = wing;
      opt.textContent = wing;
      if (wing === currentVal) opt.selected = true;
      dom.wingSelectFilter.appendChild(opt);
    });
  }

  // Filter slots based on state (status, wing, search query)
  function matchesFilter(slot, day) {
    if (slot.isLunch) return false;

    // Status filter
    if (state.statusFilter === 'available' && slot.isFilled) return false;
    if (state.statusFilter === 'filled' && !slot.isFilled) return false;

    // Wing filter: unified comparison across all variations
    if (state.wingFilter !== 'all') {
      if (!slot.isFilled) return false;
      const lines = (slot.wing || '').split('\n');
      const hasMatch = lines.some(l => normalizeWing(l) === state.wingFilter);
      if (!hasMatch) return false;
    }

    // Search query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const normWing = normalizeWing(slot.wing);
      const combined = `${slot.time} ${slot.wing} ${normWing} ${slot.subject} ${slot.reference} ${slot.venue} ${day.date} ${day.day}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    return true;
  }

  // Format multi-line meeting items cleanly
  function formatMeetingContent(text) {
    if (!text) return '';
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safeText.replace(/\n/g, '<br>');
  }

  // Split multiple meetings in a single slot (e.g. 1. ... 2. ...)
  function splitMultiMeetings(slot) {
    if (!slot.subject && !slot.wing) return [slot];

    const hasNumbers = /^\s*1[\.\)]/m.test(slot.subject) || /^\s*1[\.\)]/m.test(slot.wing);
    if (!hasNumbers) return [slot];

    // Split on numbered items
    const splitItems = (str) => {
      if (!str) return [];
      const parts = str.split(/(?:^|\n)\s*(\d+[\.\)])\s*/).filter(p => p.trim());
      const items = [];
      for (let i = 0; i < parts.length; i++) {
        if (/^\d+[\.\)]$/.test(parts[i].trim()) && i + 1 < parts.length) {
          items.push(parts[i + 1].trim());
          i++;
        } else if (parts[i].trim()) {
          items.push(parts[i].trim());
        }
      }
      return items.length ? items : [str];
    };

    const wings = splitItems(slot.wing);
    const subjects = splitItems(slot.subject);
    const refs = splitItems(slot.reference);
    const venues = splitItems(slot.venue);

    const maxCount = Math.max(wings.length, subjects.length, refs.length, venues.length, 1);
    const meetings = [];

    for (let i = 0; i < maxCount; i++) {
      meetings.push({
        time: slot.time,
        isFilled: true,
        wing: wings[i] || wings[0] || slot.wing,
        subject: subjects[i] || subjects[0] || slot.subject,
        reference: refs[i] || refs[0] || slot.reference,
        venue: venues[i] || venues[0] || slot.venue,
        itemIndex: i + 1,
        totalItems: maxCount
      });
    }

    return meetings;
  }

  // Render Metric Cards
  function renderMetrics(windowDaysList) {
    let totalSlots = 0;
    let availableSlots = 0;
    let filledSlots = 0;

    let todayAvailable = 0;
    let todayFilled = 0;

    windowDaysList.forEach((day, idx) => {
      Object.values(day.slots).forEach(slot => {
        if (slot.isLunch) return;
        totalSlots++;
        if (slot.isFilled) {
          filledSlots++;
          if (idx === 0) todayFilled++;
        } else {
          availableSlots++;
          if (idx === 0) todayAvailable++;
        }
      });
    });

    const availPercent = totalSlots > 0 ? Math.round((availableSlots / totalSlots) * 100) : 0;
    const filledPercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    if (dom.metricTotalSlots) {
      dom.metricTotalSlots.innerHTML = `${totalSlots} <span class="metric-sub">(${windowDaysList.length} Days)</span>`;
    }
    if (dom.metricAvailableSlots) {
      dom.metricAvailableSlots.innerHTML = `${availableSlots} <span class="metric-sub" style="color:var(--success)">(${availPercent}% Free)</span>`;
    }
    if (dom.metricFilledSlots) {
      dom.metricFilledSlots.innerHTML = `${filledSlots} <span class="metric-sub" style="color:var(--primary)">(${filledPercent}% Booked)</span>`;
    }
    if (dom.metricTodayStatus) {
      dom.metricTodayStatus.innerHTML = `${todayAvailable} Free <span class="metric-sub">(${todayFilled} Booked)</span>`;
    }
  }

  // Render Rolling Board (Columns of Days)
  function renderRollingBoard(windowDaysList) {
    if (!dom.rollingBoard) return;
    dom.rollingBoard.innerHTML = '';

    if (!windowDaysList || windowDaysList.length === 0) {
      dom.rollingBoard.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <h3>No slots found for this date range.</h3>
          <p style="color:var(--text-muted); margin-top: 8px;">Try clicking "Today" or switching to another month.</p>
        </div>
      `;
      return;
    }

    windowDaysList.forEach(day => {
      const col = document.createElement('div');
      col.className = `day-column ${day.isToday ? 'is-today' : ''}`;

      // Calculate daily metrics
      let dayFree = 0;
      let dayBooked = 0;
      Object.values(day.slots).forEach(s => {
        if (s.isLunch) return;
        if (s.isFilled) dayBooked++;
        else dayFree++;
      });

      // Day tag label
      let tagLabel = 'Upcoming';
      let tagClass = 'upcoming';
      if (day.isToday) {
        tagLabel = 'Today';
        tagClass = 'today';
      } else if (day.isTomorrow) {
        tagLabel = 'Tomorrow';
        tagClass = 'upcoming';
      } else if (day.offsetIndex > 1) {
        tagLabel = `Day +${day.offsetIndex}`;
        tagClass = 'upcoming';
      }

      // Column Header
      const header = document.createElement('div');
      header.className = 'day-column-header';
      header.innerHTML = `
        <div class="day-tag-row">
          <span class="day-badge ${tagClass}">${tagLabel}</span>
          <div class="day-mini-counts">
            <span class="count-free" title="Available Slots">🟢 ${dayFree} Free</span>
            <span class="count-booked" title="Booked Slots">🔴 ${dayBooked} Booked</span>
          </div>
        </div>
        <div class="day-date-title">${day.date}</div>
        <div class="day-weekday">${day.day || getDayName(parseISODate(day.isoDate))}</div>
      `;
      col.appendChild(header);

      // Stack of Slots
      const stack = document.createElement('div');
      stack.className = 'slots-stack';

      STANDARD_SLOTS.forEach(slotKey => {
        const slot = day.slots[slotKey] || {
          time: slotKey,
          isFilled: false,
          isLunch: slotKey === 'LUNCH',
          wing: '',
          subject: '',
          reference: '',
          venue: ''
        };

        // If slot is lunch break
        if (slot.isLunch) {
          if (state.statusFilter === 'all' && !state.searchQuery && state.wingFilter === 'all') {
            const lunchCard = document.createElement('div');
            lunchCard.className = 'slot-card lunch';
            lunchCard.innerHTML = `
              <div class="slot-header" style="margin-bottom:0;">
                <span class="slot-time" style="color:var(--text-muted);">🍽️ 1:00 PM - 2:00 PM (LUNCH BREAK)</span>
                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Intermission</span>
              </div>
            `;
            stack.appendChild(lunchCard);
          }
          return;
        }

        // Apply filters
        if (!matchesFilter(slot, day)) {
          return;
        }

        const slotCard = document.createElement('div');
        slotCard.className = `slot-card ${slot.isFilled ? 'filled' : 'available'}`;
        slotCard.onclick = () => openSlotModal(slot, day);

        if (slot.isFilled) {
          // Check if multi-meeting in this slot
          const subMeetings = splitMultiMeetings(slot);

          let subCardsHtml = '';
          subMeetings.forEach((m, mIdx) => {
            const multiTag = m.totalItems > 1 ? `<span style="font-size:0.7rem; background:rgba(37,99,235,0.2); padding:2px 6px; border-radius:4px; margin-left:4px;">Session ${m.itemIndex}/${m.totalItems}</span>` : '';
            subCardsHtml += `
              <div class="${mIdx > 0 ? 'sub-meeting-card' : ''}">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                  <span class="meeting-wing-badge">${formatMeetingContent(normalizeWing(m.wing) || 'Forest Dept')}</span>
                  ${multiTag}
                </div>
                <div class="meeting-subject" title="${m.subject}">${formatMeetingContent(m.subject || 'Meeting Scheduled')}</div>
                <div class="meeting-meta-row">
                  ${m.venue ? `<div class="meta-item"><span class="meta-icon">📍</span> <span>${formatMeetingContent(m.venue)}</span></div>` : ''}
                  ${m.reference ? `<div class="meta-item"><span class="meta-icon">📄</span> <span>${formatMeetingContent(m.reference)}</span></div>` : ''}
                </div>
              </div>
            `;
          });

          slotCard.innerHTML = `
            <div class="slot-header">
              <span class="slot-time">⏰ ${slot.time}</span>
              <span class="slot-status-pill booked">🔴 Booked</span>
            </div>
            ${subCardsHtml}
          `;
        } else {
          // Available / Left slot
          slotCard.innerHTML = `
            <div class="slot-header">
              <span class="slot-time">⏰ ${slot.time}</span>
              <span class="slot-status-pill free">🟢 Available</span>
            </div>
            <div class="available-box">
              <span class="available-text">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Vacant Slot
              </span>
              <span class="book-hint">Ready to schedule →</span>
            </div>
          `;
        }

        stack.appendChild(slotCard);
      });

      if (stack.children.length === 0) {
        stack.innerHTML = `
          <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.8rem;">
            No slots matching current filters.
          </div>
        `;
      }

      col.appendChild(stack);
      dom.rollingBoard.appendChild(col);
    });
  }

  // Render Full Month Table View
  function renderTableView(daysList) {
    if (!dom.scheduleTableBody) return;
    dom.scheduleTableBody.innerHTML = '';

    daysList.forEach(day => {
      STANDARD_SLOTS.forEach(slotKey => {
        const slot = day.slots[slotKey];
        if (!slot) return;
        if (!matchesFilter(slot, day)) return;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openSlotModal(slot, day);

        const statusBadge = slot.isLunch ? 
          '<span class="slot-status-pill" style="background:#fef3c7; color:#92400e;">🍽️ Lunch</span>' :
          (slot.isFilled ? '<span class="slot-status-pill booked">🔴 Booked</span>' : '<span class="slot-status-pill free">🟢 Available</span>');

        tr.innerHTML = `
          <td><strong>${day.date}</strong><br><span style="color:var(--text-muted); font-size:0.75rem;">${day.day}</span></td>
          <td><strong>${slot.time}</strong></td>
          <td>${statusBadge}</td>
          <td>${slot.wing ? `<span class="meeting-wing-badge">${normalizeWing(slot.wing)}</span>` : '<span style="color:var(--text-muted);">-</span>'}</td>
          <td><strong>${slot.subject || (slot.isFilled ? 'Meeting Scheduled' : '<span style="color:var(--success);">Vacant - Open for Booking</span>')}</strong></td>
          <td>${slot.venue || '<span style="color:var(--text-muted);">-</span>'}</td>
          <td>${slot.reference || '<span style="color:var(--text-muted);">-</span>'}</td>
        `;
        dom.scheduleTableBody.appendChild(tr);
      });
    });
  }

  // Main Render Function
  function render() {
    const windowDaysList = getRollingWindowDays();

    // Update active range header
    if (dom.activeRangeText && windowDaysList.length > 0) {
      const first = windowDaysList[0];
      const last = windowDaysList[windowDaysList.length - 1];
      dom.activeRangeText.textContent = `${first.date} (${first.day})  ⟶  ${last.date} (${last.day})`;
    }

    if (dom.datePickerInput) {
      dom.datePickerInput.value = state.anchorDateStr;
    }

    // Check Month-End alert
    updateMonthEndAlert(windowDaysList);

    // Update KPIs
    renderMetrics(windowDaysList);

    // Switch view mode
    if (state.viewMode === 'cards') {
      if (dom.rollingBoard) dom.rollingBoard.style.display = 'grid';
      if (dom.tableContainer) dom.tableContainer.style.display = 'none';
      renderRollingBoard(windowDaysList);
    } else {
      if (dom.rollingBoard) dom.rollingBoard.style.display = 'none';
      if (dom.tableContainer) dom.tableContainer.style.display = 'block';
      const allDays = getActiveDays();
      renderTableView(allDays);
    }
  }

  // Switch Active Month
  function switchMonth(monthId) {
    if (state.activeMonthId === monthId) return;
    state.activeMonthId = monthId;

    // Update month buttons UI (if present)
    document.querySelectorAll('.month-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.monthId === monthId);
    });

    // Update month dropdown UI
    if (dom.monthSelectDropdown) {
      dom.monthSelectDropdown.value = monthId;
    }

    // Check if the current view date exists in the new month
    const activeDays = getActiveDays();
    const dateExists = activeDays.some(d => d.isoDate === state.anchorDateStr);
    if (!dateExists && activeDays.length > 0) {
      state.anchorDateStr = activeDays[0].isoDate;
    }
    localStorage.setItem('meeting_dashboard_active_date', state.anchorDateStr);

    populateWingFilter();
    render();

    // Trigger background live refresh for this month
    const cfg = MONTHS_CONFIG.find(m => m.id === monthId);
    if (cfg) {
      fetchLiveTab(cfg).then(ok => {
        if (ok) {
          state.lastSyncTime = new Date();
          updateSyncBadge(true);
          populateWingFilter();
          render();
        }
      });
    }
  }

  // Shift Day (Today moves back, tomorrow becomes today, and coming days advance!)
  function shiftDay(direction) {
    const d = parseISODate(state.anchorDateStr);
    d.setDate(d.getDate() + direction);
    state.anchorDateStr = formatISODate(d);
    localStorage.setItem('meeting_dashboard_active_date', state.anchorDateStr);
    render();
  }

  // Get current system date as ISO string (YYYY-MM-DD)
  function getSystemDateIso() {
    return formatISODate(new Date());
  }

  // Get effective Today's date based directly on the system date
  function getEffectiveTodayDate() {
    const sysIso = getSystemDateIso();
    const activeDays = getActiveDays();

    // 1. If today's date exists directly in the active month's days, return today's system date!
    if (activeDays.some(d => d.isoDate === sysIso)) {
      return sysIso;
    }

    // 2. If the active month matches current calendar month and year, return system date!
    const activeCfg = MONTHS_CONFIG.find(m => m.id === state.activeMonthId);
    const now = new Date();
    const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const currentYear = String(now.getFullYear());
    if (activeCfg && activeCfg.name.toLowerCase().includes(currentMonthName) && activeCfg.name.includes(currentYear)) {
      return sysIso;
    }

    // 3. For archive or upcoming months: return closest date or first available date in that month
    if (activeDays.length > 0) {
      const futureOrToday = activeDays.find(d => d.isoDate >= sysIso);
      return futureOrToday ? futureOrToday.isoDate : activeDays[0].isoDate;
    }

    return sysIso;
  }

  // Reset to today
  function resetToToday() {
    state.anchorDateStr = getEffectiveTodayDate();
    localStorage.setItem('meeting_dashboard_active_date', state.anchorDateStr);
    render();
    showToast(`📅 View set to System Date (${state.anchorDateStr})`, 2500);
  }

  // Slot Detail Modal
  let activeModalSlotData = null;
  function openSlotModal(slot, day) {
    if (!dom.slotModal || !dom.modalBody) return;
    activeModalSlotData = { slot, day };

    const statusBadge = slot.isLunch ? 
      '<span class="slot-status-pill" style="background:#fef3c7; color:#92400e;">🍽️ Lunch Break</span>' :
      (slot.isFilled ? '<span class="slot-status-pill booked">🔴 Booked Slot</span>' : '<span class="slot-status-pill free">🟢 Available / Vacant Slot</span>');

    dom.modalBody.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Status & Schedule Time</span>
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-card-alt); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <strong style="font-size:1.05rem;">⏰ ${slot.time}</strong>
          ${statusBadge}
        </div>
      </div>

      <div class="detail-row">
        <span class="detail-label">Date & Day</span>
        <div class="detail-value">📅 ${day.date} (${day.day})</div>
      </div>

      ${slot.isFilled ? `
        <div class="detail-row">
          <span class="detail-label">Wing / Department</span>
          <div class="detail-value"><strong style="color:var(--primary);">${formatMeetingContent(normalizeWing(slot.wing) || 'Forest Department')}</strong></div>
        </div>

        <div class="detail-row">
          <span class="detail-label">Meeting Subject / Agenda</span>
          <div class="detail-value" style="font-size:1rem; font-weight:600;">${formatMeetingContent(slot.subject || 'Discussion Meeting')}</div>
        </div>

        <div class="detail-row">
          <span class="detail-label">Reference Number / Order</span>
          <div class="detail-value">${formatMeetingContent(slot.reference || 'Oral Communication / Telephonic Message')}</div>
        </div>

        <div class="detail-row">
          <span class="detail-label">Venue / Meeting Mode</span>
          <div class="detail-value">📍 ${formatMeetingContent(slot.venue || 'Mini Conference Hall / VC Mode')}</div>
        </div>
      ` : `
        <div style="background:var(--success-light); border:1px solid var(--success-border); border-radius:var(--radius-md); padding:18px; text-align:center;">
          <h4 style="color:var(--success-text); margin-bottom:6px; font-size:1.1rem;">Slot is Completely Available</h4>
          <p style="font-size:0.85rem; color:var(--text-muted);">This time slot on <strong>${day.date}</strong> (${slot.time}) is vacant and available for scheduling new review meetings, training programs, or VC sessions.</p>
        </div>
      `}
    `;

    dom.slotModal.classList.add('active');
  }

  function closeSlotModal() {
    if (dom.slotModal) dom.slotModal.classList.remove('active');
  }

  function copySlotInfo() {
    if (!activeModalSlotData) return;
    const { slot, day } = activeModalSlotData;
    const lines = [
      `TNFD Meeting Schedule Information`,
      `Date: ${day.date} (${day.day})`,
      `Time Slot: ${slot.time}`,
      `Status: ${slot.isFilled ? 'Booked' : 'Available / Free'}`
    ];
    if (slot.isFilled) {
      if (slot.wing) lines.push(`Wing/Unit: ${normalizeWing(slot.wing)}`);
      if (slot.subject) lines.push(`Subject: ${slot.subject}`);
      if (slot.reference) lines.push(`Reference: ${slot.reference}`);
      if (slot.venue) lines.push(`Venue/Mode: ${slot.venue}`);
    }
    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      const originalText = dom.copySlotBtn.textContent;
      dom.copySlotBtn.textContent = '✓ Copied to Clipboard!';
      setTimeout(() => {
        if (dom.copySlotBtn) dom.copySlotBtn.textContent = originalText;
      }, 2000);
    });
  }

  // Dark / Light Mode Toggle
  function setupTheme() {
    const saved = localStorage.getItem('meeting_dashboard_theme');
    if (saved === 'dark' || (!saved && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      state.isDarkMode = true;
    }
    if (dom.themeToggleBtn) {
      dom.themeToggleBtn.onclick = () => {
        state.isDarkMode = !state.isDarkMode;
        if (state.isDarkMode) {
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem('meeting_dashboard_theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
          localStorage.setItem('meeting_dashboard_theme', 'light');
        }
      };
    }
  }

  // Event Listeners setup
  function setupEvents() {
    // Month Dropdown (beside Full Month Table)
    if (dom.monthSelectDropdown) {
      dom.monthSelectDropdown.addEventListener('change', async e => {
        if (e.target.value === '__AUTO_DETECT__') {
          dom.monthSelectDropdown.value = state.activeMonthId;
          await discoverGoogleSheetsTabs(true);
          return;
        }
        switchMonth(e.target.value);
        localStorage.setItem('meeting_dashboard_active_month', e.target.value);
      });
    }

    // Month Buttons (legacy fallback)
    if (dom.monthBtnGroup) {
      dom.monthBtnGroup.addEventListener('click', e => {
        const btn = e.target.closest('.month-btn');
        if (btn && btn.dataset.monthId) {
          switchMonth(btn.dataset.monthId);
        }
      });
    }

    // Day shifting controls
    if (dom.prevDayBtn) dom.prevDayBtn.onclick = () => shiftDay(-1);
    if (dom.nextDayBtn) dom.nextDayBtn.onclick = () => shiftDay(1);
    if (dom.todayBtn) dom.todayBtn.onclick = () => resetToToday();

    // Date picker
    if (dom.datePickerInput) {
      dom.datePickerInput.onchange = (e) => {
        if (e.target.value) {
          state.anchorDateStr = e.target.value;
          localStorage.setItem('meeting_dashboard_active_date', state.anchorDateStr);
          render();
        }
      };
    }

    // Range View toggle (4 Days, 5 Days, Full Month)
    if (dom.rangeToggleGroup) {
      dom.rangeToggleGroup.addEventListener('click', e => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        dom.rangeToggleGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.range;
        if (mode === 'month-table') {
          state.viewMode = 'table';
        } else {
          state.viewMode = 'cards';
          state.windowDays = parseInt(mode, 10) || 4;
        }
        render();
      });
    }

    // Status Filter pills (All, Available, Filled)
    if (dom.statusFilterGroup) {
      dom.statusFilterGroup.addEventListener('click', e => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        dom.statusFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.statusFilter = btn.dataset.filter || 'all';
        render();
      });
    }

    // Wing Filter select
    if (dom.wingSelectFilter) {
      dom.wingSelectFilter.onchange = (e) => {
        state.wingFilter = e.target.value;
        render();
      };
    }

    // Search query input
    if (dom.searchInput) {
      dom.searchInput.oninput = (e) => {
        state.searchQuery = e.target.value.trim();
        render();
      };
    }

    // Refresh live data
    if (dom.refreshBtn) {
      dom.refreshBtn.onclick = () => refreshLiveData();
    }

    // Modal close
    if (dom.modalCloseBtn) dom.modalCloseBtn.onclick = closeSlotModal;
    if (dom.slotModal) {
      dom.slotModal.onclick = (e) => {
        if (e.target === dom.slotModal) closeSlotModal();
      };
    }
    if (dom.copySlotBtn) dom.copySlotBtn.onclick = copySlotInfo;

    // Keyboard navigation (Esc to close modal, Left/Right arrow to shift day)
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeSlotModal();
      } else if (!dom.slotModal.classList.contains('active') && !['INPUT', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key === 'ArrowLeft') shiftDay(-1);
        if (e.key === 'ArrowRight') shiftDay(1);
      }
    });

    // Auto-advance rolling window at midnight
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 10) {
        resetToToday();
      }
    }, 30000);
  }

  // Initialization
  function init() {
    initDOM();
    setupTheme();
    loadPreloadedData();

    // Determine initial active month (e.g. October 2026, or current calendar month)
    state.activeMonthId = determineInitialActiveMonth();

    renderMonthDropdown();
    setupEvents();
    populateWingFilter();

    // Always strictly anchor to current system date!
    state.anchorDateStr = getEffectiveTodayDate();
    localStorage.setItem('meeting_dashboard_active_date', state.anchorDateStr);
    render();

    // Auto-refresh live data immediately in background
    refreshLiveData();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
