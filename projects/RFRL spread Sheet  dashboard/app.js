/**
 * RF & RL GIS Index Live Dashboard
 * Real-time Google Sheet synchronization, interactive KPI cards, Chart.js analytics & data grid
 */

// Global App State
const state = {
    activeSheet: 'RF', // 'RF' | 'RL' | 'COMBINED'
    data: {
        rf: [],
        rl: []
    },
    activeFilter: null, // null | 'ADDED' | 'REJECTED' | 'ACTION_REQUIRED' | 'HUGE_DIFF' | 'OVERLAP' | 'LAB_CORRECTED' | string (verifier)
    searchQuery: '',
    circleFilter: 'ALL',
    divisionFilter: 'ALL',
    statusFilter: 'ALL',
    overlapFilter: 'ALL',
    sortColumn: 'slNo',
    sortDirection: 'asc',
    currentPage: 1,
    pageSize: 25,
    
    // Live Auto-Sync Configuration (Hourly by default)
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1r0rRxR5_5MG7Yt4p1x8Q1gusoA3DAbh4pyy6KWTxaEw/edit?gid=1204036234#gid=1204036234',
    liveSyncInterval: 3600, // 3600 seconds = 1 Hour
    isLiveSyncing: true,
    lastSyncTime: null,
    syncTimer: null,
    countdownTimer: null,
    secondsUntilNextSync: 3600,
    dataFingerprint: '',
    isFetching: false,
    
    // Chart instances
    charts: {
        status: null,
        reasons: null,
        verifiers: null,
        areaComp: null
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load initial default snapshot if available
    if (window.DEFAULT_DATA) {
        state.data.rf = window.DEFAULT_DATA.rf || [];
        state.data.rl = window.DEFAULT_DATA.rl || [];
        state.lastSyncTime = new Date();
        state.dataFingerprint = generateFingerprint(state.data);
    }
    
    // 2. Initialize UI elements & Event Listeners
    initUIEventListeners();
    
    // 3. Render Dashboard with initial state
    renderAll();
    
    // 4. Start Live Continuous Polling from Google Sheets
    startLiveSync();
    
    // 5. Initial immediate fetch
    fetchLiveGoogleSheet(false);
});

/**
 * Event Listeners Registration
 */
function initUIEventListeners() {
    // Sheet Switcher Tabs
    document.querySelectorAll('.sheet-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const sheet = e.currentTarget.dataset.sheet;
            setActiveSheet(sheet);
        });
    });

    // KPI Filter Cards (One-Click Drilldown)
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            toggleKPIFilter(filter);
        });
    });

    // Search Input with debounce
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value.trim().toLowerCase();
            state.currentPage = 1;
            renderTable();
        }, 200));
    }

    // Dropdown Filters
    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            state.statusFilter = e.target.value;
            state.currentPage = 1;
            renderTable();
        });
    }

    const circleSelect = document.getElementById('filterCircle');
    if (circleSelect) {
        circleSelect.addEventListener('change', (e) => {
            state.circleFilter = e.target.value;
            state.currentPage = 1;
            renderTable();
        });
    }

    const divisionSelect = document.getElementById('filterDivision');
    if (divisionSelect) {
        divisionSelect.addEventListener('change', (e) => {
            state.divisionFilter = e.target.value;
            state.currentPage = 1;
            renderTable();
        });
    }

    const overlapSelect = document.getElementById('filterOverlap');
    if (overlapSelect) {
        overlapSelect.addEventListener('change', (e) => {
            state.overlapFilter = e.target.value;
            state.currentPage = 1;
            renderTable();
        });
    }

    // Page Size Selector
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            state.pageSize = e.target.value === 'ALL' ? 9999 : parseInt(e.target.value);
            state.currentPage = 1;
            renderTable();
        });
    }

    // Clear Filters Button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // Live Sync Manual Trigger Button
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', () => {
            fetchLiveGoogleSheet(true);
        });
    }

    // Live Sync Pause / Resume Button
    const toggleSyncBtn = document.getElementById('toggleSyncBtn');
    if (toggleSyncBtn) {
        toggleSyncBtn.addEventListener('click', () => {
            state.isLiveSyncing = !state.isLiveSyncing;
            updateLiveSyncUI();
            if (state.isLiveSyncing) {
                fetchLiveGoogleSheet(false);
            }
        });
    }

    // Sync Interval Selector
    const syncIntervalSelect = document.getElementById('syncIntervalSelect');
    if (syncIntervalSelect) {
        syncIntervalSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (val === 0) {
                state.isLiveSyncing = false;
            } else {
                state.isLiveSyncing = true;
                state.liveSyncInterval = val;
                state.secondsUntilNextSync = val;
            }
            updateLiveSyncUI();
            restartLiveSyncTimer();
        });
    }

    // Spreadsheet URL Config Bar
    const sheetUrlInput = document.getElementById('sheetUrlInput');
    const updateSheetUrlBtn = document.getElementById('updateSheetUrlBtn');
    if (updateSheetUrlBtn && sheetUrlInput) {
        updateSheetUrlBtn.addEventListener('click', () => {
            const url = sheetUrlInput.value.trim();
            if (url) {
                state.sheetUrl = url;
                fetchLiveGoogleSheet(true);
                showToast('Connecting to spreadsheet...', 'info');
            }
        });
    }

    // File Upload Handler (Excel/CSV drag-and-drop or file pick)
    const fileUploadInput = document.getElementById('fileUploadInput');
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', handleFileUpload);
    }

    // Export Buttons
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Modal Close
    const closeModalBtn = document.getElementById('closeModalBtn');
    const recordModal = document.getElementById('recordModal');
    if (closeModalBtn && recordModal) {
        closeModalBtn.addEventListener('click', () => {
            recordModal.classList.add('hidden');
        });
        recordModal.addEventListener('click', (e) => {
            if (e.target === recordModal) {
                recordModal.classList.add('hidden');
            }
        });
    }
}

/**
 * Sheet Switcher (RF <-> RL <-> COMBINED)
 */
function setActiveSheet(sheetName) {
    if (state.activeSheet === sheetName) return;
    state.activeSheet = sheetName;
    state.currentPage = 1;
    state.activeFilter = null; // reset filter on sheet switch
    
    // Update Tab UI styles
    document.querySelectorAll('.sheet-tab').forEach(tab => {
        if (tab.dataset.sheet === sheetName) {
            tab.classList.add('active', 'text-white');
            tab.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
        } else {
            tab.classList.remove('active', 'text-white');
            tab.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
        }
    });

    // Subtitle badge
    const activeSheetBadge = document.getElementById('activeSheetBadge');
    if (activeSheetBadge) {
        if (sheetName === 'RF') {
            activeSheetBadge.textContent = '🌲 Reserved Forest (RF Index)';
            activeSheetBadge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60';
        } else if (sheetName === 'RL') {
            activeSheetBadge.textContent = '📋 Revenue Land (RL Index)';
            activeSheetBadge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-blue-950 text-blue-300 border border-blue-700/60';
        } else {
            activeSheetBadge.textContent = '📊 Combined Overview (RF + RL)';
            activeSheetBadge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-purple-950 text-purple-300 border border-purple-700/60';
        }
    }

    renderAll();
}

/**
 * Toggle KPI Filter Card
 */
function toggleKPIFilter(filterName) {
    if (state.activeFilter === filterName) {
        state.activeFilter = null;
    } else {
        state.activeFilter = filterName;
    }
    state.currentPage = 1;
    updateKPICardActiveStyles();
    renderTable();
}

function clearAllFilters() {
    state.activeFilter = null;
    state.searchQuery = '';
    state.circleFilter = 'ALL';
    state.divisionFilter = 'ALL';
    state.statusFilter = 'ALL';
    state.overlapFilter = 'ALL';
    state.currentPage = 1;
    
    // Reset form elements
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) searchInput.value = '';
    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) statusSelect.value = 'ALL';
    const circleSelect = document.getElementById('filterCircle');
    if (circleSelect) circleSelect.value = 'ALL';
    const divisionSelect = document.getElementById('filterDivision');
    if (divisionSelect) divisionSelect.value = 'ALL';
    const overlapSelect = document.getElementById('filterOverlap');
    if (overlapSelect) overlapSelect.value = 'ALL';

    updateKPICardActiveStyles();
    renderTable();
    showToast('Filters cleared', 'info');
}

/**
 * Get current dataset based on active sheet
 */
function getCurrentDataset() {
    if (state.activeSheet === 'RF') {
        return state.data.rf;
    } else if (state.activeSheet === 'RL') {
        return state.data.rl;
    } else {
        return [...state.data.rf, ...state.data.rl];
    }
}

/**
 * Filter and Sort Dataset
 */
function getFilteredDataset() {
    const rawData = getCurrentDataset();
    
    return rawData.filter(item => {
        // 1. KPI Card Quick Filter
        if (state.activeFilter) {
            const remarksUpper = (item.remarks || '').toUpperCase();
            const reasonUpper = (item.reason || '').toUpperCase();
            const overlapUpper = (item.overlap || '').toUpperCase();
            const actionUpper = (item.actionRequired || '').toUpperCase();
            const verifier = (item.verifiedBy || '').toUpperCase();

            if (state.activeFilter === 'ADDED' && !remarksUpper.includes('ADDED TO DATABASE')) {
                return false;
            }
            if (state.activeFilter === 'REJECTED' && !remarksUpper.includes('REJECTED')) {
                return false;
            }
            if (state.activeFilter === 'ACTION_REQUIRED' && (!actionUpper || actionUpper === '-' || actionUpper === 'NONE')) {
                return false;
            }
            if (state.activeFilter === 'HUGE_DIFF') {
                const nArea = parseFloat(item.notifiedArea) || 0;
                const pArea = parseFloat(item.polygonArea) || 0;
                if (nArea <= 0 || pArea <= 0) return false;
                const pctDiff = Math.abs(pArea - nArea) / nArea;
                if (pctDiff <= 0.20) return false; // Only > 20% difference
            }
            if (state.activeFilter === 'OVERLAP') {
                if (!overlapUpper || overlapUpper === 'NO' || overlapUpper === '-') return false;
            }
            if (state.activeFilter === 'LAB_CORRECTED') {
                if (!overlapUpper.includes('CORRECTED') && !overlapUpper.includes('GIS LAB')) return false;
            }
            if (state.activeFilter.startsWith('VERIFIER_')) {
                const targetVerifier = state.activeFilter.replace('VERIFIER_', '');
                if (!verifier.includes(targetVerifier)) return false;
            }
        }

        // 2. Search Query Filter
        if (state.searchQuery) {
            const q = state.searchQuery;
            const searchStr = `${item.slNo} ${item.circle} ${item.division} ${item.name} ${item.revisedName} ${item.remarks} ${item.verifiedBy} ${item.reason} ${item.actionRequired} ${item.overlap}`.toLowerCase();
            if (!searchStr.includes(q)) return false;
        }

        // 3. Dropdown Status Filter
        if (state.statusFilter !== 'ALL') {
            const remarksUpper = (item.remarks || '').toUpperCase();
            if (state.statusFilter === 'ADDED' && !remarksUpper.includes('ADDED TO DATABASE')) return false;
            if (state.statusFilter === 'REJECTED' && !remarksUpper.includes('REJECTED')) return false;
            if (state.statusFilter === 'PENDING' && (remarksUpper.includes('ADDED TO DATABASE') || remarksUpper.includes('REJECTED'))) return false;
        }

        // 4. Circle Filter
        if (state.circleFilter !== 'ALL' && item.circle !== state.circleFilter) {
            return false;
        }

        // 5. Division Filter
        if (state.divisionFilter !== 'ALL' && item.division !== state.divisionFilter) {
            return false;
        }

        // 6. Overlap Filter
        if (state.overlapFilter !== 'ALL') {
            const overlapUpper = (item.overlap || '').toUpperCase();
            if (state.overlapFilter === 'NO' && (overlapUpper !== 'NO' && overlapUpper !== '')) return false;
            if (state.overlapFilter === 'YES' && (!overlapUpper.includes('YES') || overlapUpper.includes('CORRECTED'))) return false;
            if (state.overlapFilter === 'CORRECTED' && !overlapUpper.includes('CORRECTED')) return false;
        }

        return true;
    }).sort((a, b) => {
        let valA = a[state.sortColumn] || '';
        let valB = b[state.sortColumn] || '';
        
        // Numeric sort if applicable
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB) && state.sortColumn !== 'name') {
            return state.sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        
        // String sort
        return state.sortDirection === 'asc' 
            ? String(valA).localeCompare(String(valB)) 
            : String(valB).localeCompare(String(valA));
    });
}

/**
 * Render All Components
 */
function renderAll() {
    updateSheetCounts();
    renderKPICards();
    populateFilterDropdowns();
    renderTable();
    renderCharts();
}

/**
 * Update Tab Count Badges
 */
function updateSheetCounts() {
    const rfCount = state.data.rf.length;
    const rlCount = state.data.rl.length;
    const totalCount = rfCount + rlCount;

    const rfBadge = document.getElementById('rfCountBadge');
    if (rfBadge) rfBadge.textContent = rfCount;

    const rlBadge = document.getElementById('rlCountBadge');
    if (rlBadge) rlBadge.textContent = rlCount;

    const combinedBadge = document.getElementById('combinedCountBadge');
    if (combinedBadge) combinedBadge.textContent = totalCount;
}

/**
 * Calculate and Render KPI Cards
 */
function renderKPICards() {
    const dataset = getCurrentDataset();
    const total = dataset.length;

    let addedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let actionReqCount = 0;
    let hugeDiffCount = 0;
    let overlapCount = 0;
    let labCorrectedCount = 0;

    let totalNotifiedArea = 0;
    let totalPolygonArea = 0;
    let addedArea = 0;
    let rejectedArea = 0;

    const verifiers = {};

    dataset.forEach(item => {
        const nArea = parseFloat(item.notifiedArea) || 0;
        const pArea = parseFloat(item.polygonArea) || 0;
        totalNotifiedArea += nArea;
        totalPolygonArea += pArea;

        const remarksUpper = (item.remarks || '').toUpperCase();
        const reasonUpper = (item.reason || '').toUpperCase();
        const overlapUpper = (item.overlap || '').toUpperCase();
        const actionUpper = (item.actionRequired || '').toUpperCase();
        const verifier = (item.verifiedBy || '').trim();

        // Verifier count
        if (verifier && verifier !== '-') {
            verifiers[verifier] = (verifiers[verifier] || 0) + 1;
        }

        // Remarks classification
        if (remarksUpper.includes('ADDED TO DATABASE')) {
            addedCount++;
            addedArea += nArea;
        } else if (remarksUpper.includes('REJECTED')) {
            rejectedCount++;
            rejectedArea += nArea;
        } else {
            pendingCount++;
        }

        // Action required
        if (actionUpper && actionUpper !== '-' && actionUpper !== 'NONE') {
            actionReqCount++;
        }

        // Huge Area difference (strictly > 20% discrepancy)
        const pctDiff = (nArea > 0 && pArea > 0) ? (Math.abs(pArea - nArea) / nArea) : 0;
        if (pctDiff > 0.20) {
            hugeDiffCount++;
        }

        // Overlap
        if (overlapUpper && overlapUpper !== 'NO' && overlapUpper !== '-') {
            overlapCount++;
            if (overlapUpper.includes('CORRECTED') || overlapUpper.includes('GIS LAB')) {
                labCorrectedCount++;
            }
        }
    });

    const addedPct = total > 0 ? ((addedCount / total) * 100).toFixed(1) : 0;
    const rejectedPct = total > 0 ? ((rejectedCount / total) * 100).toFixed(1) : 0;

    // Update DOM KPI elements
    setElementText('kpiTotalCount', total);
    setElementText('kpiTotalNotifiedArea', formatArea(totalNotifiedArea));
    setElementText('kpiTotalPolygonArea', formatArea(totalPolygonArea));

    setElementText('kpiAddedCount', addedCount);
    setElementText('kpiAddedPct', `${addedPct}%`);
    setElementText('kpiAddedArea', formatArea(addedArea));

    setElementText('kpiRejectedCount', rejectedCount);
    setElementText('kpiRejectedPct', `${rejectedPct}%`);
    setElementText('kpiRejectedArea', formatArea(rejectedArea));

    setElementText('kpiActionReqCount', actionReqCount);
    setElementText('kpiHugeDiffCount', hugeDiffCount);
    setElementText('kpiOverlapCount', overlapCount);
    setElementText('kpiLabCorrectedCount', `${labCorrectedCount} Lab Corrected`);

    // Verifier List snippet in KPI card
    const verifierListEl = document.getElementById('kpiVerifierList');
    if (verifierListEl) {
        const entries = Object.entries(verifiers).sort((a, b) => b[1] - a[1]);
        if (entries.length > 0) {
            verifierListEl.innerHTML = entries.map(([v, count]) => `
                <div class="flex items-center justify-between text-xs py-0.5">
                    <span class="text-slate-300 truncate max-w-[140px]" title="${escapeHtml(v)}">${escapeHtml(v)}</span>
                    <span class="font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">${count}</span>
                </div>
            `).join('');
        } else {
            verifierListEl.innerHTML = '<span class="text-xs text-slate-500">No verifier data recorded</span>';
        }
    }

    updateKPICardActiveStyles();
}

function updateKPICardActiveStyles() {
    document.querySelectorAll('.kpi-card').forEach(card => {
        const filter = card.dataset.filter;
        if (state.activeFilter && (state.activeFilter === filter || (filter === 'ALL' && state.activeFilter === null))) {
            card.classList.add('active-filter');
        } else {
            card.classList.remove('active-filter');
        }
    });

    // Active Filter Indicator Bar
    const activeFilterBar = document.getElementById('activeFilterBar');
    const activeFilterText = document.getElementById('activeFilterText');
    if (activeFilterBar && activeFilterText) {
        if (state.activeFilter) {
            activeFilterBar.classList.remove('hidden');
            let label = state.activeFilter;
            if (label === 'ADDED') label = '✅ KML Added to Database';
            if (label === 'REJECTED') label = '❌ KML Rejected';
            if (label === 'ACTION_REQUIRED') label = '⚠️ Further Action Required';
            if (label === 'HUGE_DIFF') label = '📐 Huge Area Difference (> 20%)';
            if (label === 'OVERLAP') label = '🔀 Overlap Issues';
            if (label === 'LAB_CORRECTED') label = '🟣 Overlap Corrected in GIS Lab';
            activeFilterText.textContent = `Active Quick Filter: ${label}`;
        } else {
            activeFilterBar.classList.add('hidden');
        }
    }
}

/**
 * Populate Circle and Division filter options
 */
function populateFilterDropdowns() {
    const dataset = getCurrentDataset();
    const circles = new Set();
    const divisions = new Set();

    dataset.forEach(item => {
        if (item.circle && item.circle.trim()) circles.add(item.circle.trim());
        if (item.division && item.division.trim()) divisions.add(item.division.trim());
    });

    const circleSelect = document.getElementById('filterCircle');
    if (circleSelect) {
        const currentVal = circleSelect.value;
        circleSelect.innerHTML = '<option value="ALL">All Circles</option>' + 
            Array.from(circles).sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        circleSelect.value = circles.has(currentVal) ? currentVal : 'ALL';
    }

    const divisionSelect = document.getElementById('filterDivision');
    if (divisionSelect) {
        const currentVal = divisionSelect.value;
        divisionSelect.innerHTML = '<option value="ALL">All Divisions</option>' + 
            Array.from(divisions).sort().map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
        divisionSelect.value = divisions.has(currentVal) ? currentVal : 'ALL';
    }
}

/**
 * Render Interactive Data Table
 */
function renderTable() {
    const filtered = getFilteredDataset();
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / state.pageSize) || 1;
    
    if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
    }

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, totalCount);
    const pageItems = filtered.slice(startIndex, endIndex);

    const tbody = document.getElementById('tableBody');
    const tableInfo = document.getElementById('tableInfo');
    
    if (tableInfo) {
        tableInfo.textContent = totalCount > 0 
            ? `Showing ${startIndex + 1} to ${endIndex} of ${totalCount} records`
            : 'No matching records found';
    }

    if (!tbody) return;

    if (pageItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="px-6 py-12 text-center text-slate-400">
                    <div class="flex flex-col items-center justify-center space-y-3">
                        <i data-lucide="inbox" class="w-10 h-10 text-slate-500"></i>
                        <p class="text-base font-medium">No records match your selected filters</p>
                        <button onclick="clearAllFilters()" class="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/80 rounded-lg border border-emerald-700/60 hover:bg-emerald-900 transition">
                            Clear All Filters
                        </button>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        renderPagination(totalPages);
        return;
    }

    tbody.innerHTML = pageItems.map((row, idx) => {
        const nArea = parseFloat(row.notifiedArea) || 0;
        const pArea = parseFloat(row.polygonArea) || 0;
        const diffArea = pArea > 0 ? (pArea - nArea).toFixed(2) : '-';
        const pctDiff = nArea > 0 && pArea > 0 ? (((pArea - nArea) / nArea) * 100).toFixed(1) : null;
        
        // Status badge
        const remarks = (row.remarks || '').trim();
        let statusBadge = '';
        if (remarks.toUpperCase().includes('ADDED TO DATABASE')) {
            statusBadge = `<span class="badge-added px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Added to Database
            </span>`;
        } else if (remarks.toUpperCase().includes('REJECTED')) {
            statusBadge = `<span class="badge-rejected px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>KML Rejected
            </span>`;
        } else {
            statusBadge = `<span class="badge-pending px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>${escapeHtml(remarks || 'Pending Review')}
            </span>`;
        }

        // Overlap badge
        const overlap = (row.overlap || '').trim();
        let overlapBadge = `<span class="text-xs text-slate-400">No</span>`;
        if (overlap.toUpperCase().includes('CORRECTED') || overlap.toUpperCase().includes('GIS LAB')) {
            overlapBadge = `<span class="badge-lab-corrected px-2 py-0.5 rounded text-xs font-medium">Lab Corrected</span>`;
        } else if (overlap.toUpperCase().includes('YES')) {
            overlapBadge = `<span class="badge-overlap px-2 py-0.5 rounded text-xs font-medium">Overlap</span>`;
        }

        // Reason badge
        const reason = (row.reason || '').trim();
        const reasonBadge = reason && reason !== '-' 
            ? `<span class="text-xs text-rose-300 font-medium bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">${escapeHtml(reason)}</span>`
            : `<span class="text-slate-500 text-xs">-</span>`;

        // Action badge
        const action = (row.actionRequired || '').trim();
        const actionBadge = action && action !== '-'
            ? `<span class="text-xs text-amber-300 font-medium bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">${escapeHtml(action)}</span>`
            : `<span class="text-slate-500 text-xs">-</span>`;

        // Area diff color
        let areaDiffHtml = `<span class="text-slate-400 text-xs">-</span>`;
        if (pctDiff !== null) {
            const isHuge = Math.abs(parseFloat(pctDiff)) > 20;
            const diffClass = isHuge ? 'text-rose-400 font-semibold' : 'text-slate-300';
            areaDiffHtml = `
                <div class="text-xs ${diffClass}">
                    ${pArea.toFixed(2)} Ha
                    <span class="text-[10px] block opacity-75">(${pctDiff > 0 ? '+' : ''}${pctDiff}%)</span>
                </div>
            `;
        }

        return `
            <tr class="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors cursor-pointer group" onclick="openRecordModal('${escapeHtml(row.slNo)}', '${escapeHtml(row.sheetType || state.activeSheet)}')">
                <td class="px-4 py-3 text-xs font-semibold text-slate-400">#${escapeHtml(row.slNo)}</td>
                <td class="px-4 py-3">
                    <div class="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        ${escapeHtml(row.name)}
                    </div>
                    <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>${escapeHtml(row.division || 'Megamalai')}</span>
                        <span class="text-slate-600">•</span>
                        <span>${escapeHtml(row.circle || 'SMTR')}</span>
                        ${state.activeSheet === 'COMBINED' ? `<span class="px-1.5 py-0.2 rounded text-[10px] ${row.sheetType === 'RF' ? 'bg-emerald-950 text-emerald-300' : 'bg-blue-950 text-blue-300'} font-bold">${row.sheetType}</span>` : ''}
                    </div>
                </td>
                <td class="px-4 py-3 text-xs text-right font-medium text-slate-200">
                    ${row.notifiedArea ? `${parseFloat(row.notifiedArea).toFixed(2)} Ha` : '-'}
                </td>
                <td class="px-4 py-3 text-xs text-right">
                    ${areaDiffHtml}
                </td>
                <td class="px-4 py-3 text-center text-xs">
                    <span class="px-2 py-0.5 rounded text-[11px] ${row.closedPolygon && row.closedPolygon.toLowerCase().includes('yes') ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'text-slate-500'}">
                        ${escapeHtml(row.closedPolygon || '-')}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    ${overlapBadge}
                </td>
                <td class="px-4 py-3 text-left">
                    ${statusBadge}
                </td>
                <td class="px-4 py-3 text-left max-w-[180px] truncate" title="${escapeHtml(reason)}">
                    ${reasonBadge}
                </td>
                <td class="px-4 py-3 text-left max-w-[180px] truncate" title="${escapeHtml(action)}">
                    ${actionBadge}
                </td>
                <td class="px-4 py-3 text-xs text-slate-300">
                    ${escapeHtml(row.verifiedBy || '-')}
                </td>
                <td class="px-4 py-3 text-center">
                    <button class="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded-lg transition" title="Inspect Record">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
    renderPagination(totalPages);
}

/**
 * Render Pagination Controls
 */
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let pagesHtml = '';
    const cur = state.currentPage;

    // Previous Button
    pagesHtml += `
        <button onclick="goToPage(${cur - 1})" ${cur === 1 ? 'disabled' : ''} class="px-2.5 py-1 text-xs rounded border border-slate-700 bg-slate-800/60 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition">
            Prev
        </button>
    `;

    // Numeric Pages (Show nearby pages)
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= cur - 1 && p <= cur + 1)) {
            pagesHtml += `
                <button onclick="goToPage(${p})" class="px-2.5 py-1 text-xs font-semibold rounded border ${p === cur ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700'} transition">
                    ${p}
                </button>
            `;
        } else if (p === cur - 2 || p === cur + 2) {
            pagesHtml += `<span class="px-1 text-xs text-slate-500">...</span>`;
        }
    }

    // Next Button
    pagesHtml += `
        <button onclick="goToPage(${cur + 1})" ${cur === totalPages ? 'disabled' : ''} class="px-2.5 py-1 text-xs rounded border border-slate-700 bg-slate-800/60 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition">
            Next
        </button>
    `;

    paginationContainer.innerHTML = pagesHtml;
}

function goToPage(page) {
    const filtered = getFilteredDataset();
    const totalPages = Math.ceil(filtered.length / state.pageSize) || 1;
    if (page >= 1 && page <= totalPages) {
        state.currentPage = page;
        renderTable();
    }
}

/**
 * Render Charts with Chart.js
 */
function renderCharts() {
    const dataset = getCurrentDataset();

    // 1. Status Donut Chart
    let added = 0;
    let rejected = 0;
    let pending = 0;

    const reasonsMap = {};
    const verifiersMap = {};

    dataset.forEach(item => {
        const remarks = (item.remarks || '').toUpperCase();
        if (remarks.includes('ADDED TO DATABASE')) {
            added++;
        } else if (remarks.includes('REJECTED')) {
            rejected++;
        } else {
            pending++;
        }

        // Reasons
        const reason = (item.reason || '').trim();
        if (reason && reason !== '-') {
            // Split comma separated reasons
            const parts = reason.split(',').map(s => s.trim());
            parts.forEach(p => {
                if (p && p !== '-') {
                    reasonsMap[p] = (reasonsMap[p] || 0) + 1;
                }
            });
        }

        // Verifier
        const verifier = (item.verifiedBy || '').trim();
        if (verifier && verifier !== '-') {
            if (!verifiersMap[verifier]) {
                verifiersMap[verifier] = { added: 0, rejected: 0 };
            }
            if (remarks.includes('ADDED TO DATABASE')) {
                verifiersMap[verifier].added++;
            } else if (remarks.includes('REJECTED')) {
                verifiersMap[verifier].rejected++;
            }
        }
    });

    // Chart 1: Status Donut Chart
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        if (state.charts.status) state.charts.status.destroy();
        state.charts.status = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Added to Database', 'KML Rejected', 'Pending / In-Progress'],
                datasets: [{
                    data: [added, rejected, pending],
                    backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
                    borderWidth: 2,
                    borderColor: '#0f172a'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#cbd5e1', font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.raw;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '70%',
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        if (index === 0) toggleKPIFilter('ADDED');
                        else if (index === 1) toggleKPIFilter('REJECTED');
                    }
                }
            }
        });
    }

    // Chart 2: Rejection Reasons Horizontal Bar Chart
    const reasonsCtx = document.getElementById('reasonsChart');
    if (reasonsCtx) {
        if (state.charts.reasons) state.charts.reasons.destroy();
        const sortedReasons = Object.entries(reasonsMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
        state.charts.reasons = new Chart(reasonsCtx, {
            type: 'bar',
            data: {
                labels: sortedReasons.map(r => r[0]),
                datasets: [{
                    label: 'Count',
                    data: sortedReasons.map(r => r[1]),
                    backgroundColor: 'rgba(244, 63, 94, 0.75)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.raw} records flagged`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', stepSize: 1 },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' }
                    },
                    y: {
                        ticks: { color: '#cbd5e1', font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Chart 3: Verifier Performance Bar Chart
    const verifiersCtx = document.getElementById('verifiersChart');
    if (verifiersCtx) {
        if (state.charts.verifiers) state.charts.verifiers.destroy();
        const verifierNames = Object.keys(verifiersMap);
        state.charts.verifiers = new Chart(verifiersCtx, {
            type: 'bar',
            data: {
                labels: verifierNames,
                datasets: [
                    {
                        label: 'Approved (Added)',
                        data: verifierNames.map(v => verifiersMap[v].added),
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    },
                    {
                        label: 'Rejected',
                        data: verifierNames.map(v => verifiersMap[v].rejected),
                        backgroundColor: '#f43f5e',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#cbd5e1', font: { size: 11 } }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#cbd5e1', font: { size: 11 } },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', stepSize: 2 },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' }
                    }
                }
            }
        });
    }
}

/**
 * Google Sheets Live Continuous Fetch Engine
 * Supports standard fetch() and JSONP dynamic script injection for 100% CORS-free execution
 * across all machines and protocols (including file:/// when unzipped and opened directly).
 */
async function fetchLiveGoogleSheet(isManual = false) {
    if (state.isFetching) return;
    state.isFetching = true;

    const syncStatusIcon = document.getElementById('syncStatusIcon');
    if (syncStatusIcon) syncStatusIcon.classList.add('animate-spin');

    const sheetId = extractSheetId(state.sheetUrl);
    if (!sheetId) {
        state.isFetching = false;
        if (syncStatusIcon) syncStatusIcon.classList.remove('animate-spin');
        showToast('Invalid Google Sheet URL', 'error');
        return;
    }

    try {
        let parsedRf = [];
        let parsedRl = [];

        // Try standard fetch first (for HTTP/HTTPS web servers)
        try {
            const t = Date.now();
            const rfUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=RF&t=${t}`;
            const rlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=RL&t=${t}`;

            const [rfRes, rlRes] = await Promise.all([
                fetch(rfUrl, { cache: 'no-store' }),
                fetch(rlUrl, { cache: 'no-store' })
            ]);

            if (rfRes.ok && rlRes.ok) {
                const rfCsv = await rfRes.text();
                const rlCsv = await rlRes.text();
                parsedRf = parseCsvToRecords(rfCsv, 'RF');
                parsedRl = parseCsvToRecords(rlCsv, 'RL');
            } else {
                throw new Error('Fetch failed, falling back to JSONP');
            }
        } catch (fetchErr) {
            // Fetch blocked by CORS or file:/// protocol -> use JSONP script tag injection
            console.log('Using JSONP engine for Google Sheets live data...');
            const [rfJson, rlJson] = await Promise.all([
                fetchGvizJsonp(sheetId, 'RF'),
                fetchGvizJsonp(sheetId, 'RL')
            ]);
            parsedRf = parseGvizTableToRecords(rfJson, 'RF');
            parsedRl = parseGvizTableToRecords(rlJson, 'RL');
        }

        if (parsedRf.length > 0 || parsedRl.length > 0) {
            const newFingerprint = generateFingerprint({ rf: parsedRf, rl: parsedRl });
            const hasChanged = state.dataFingerprint && state.dataFingerprint !== newFingerprint;

            state.data.rf = parsedRf;
            state.data.rl = parsedRl;
            state.dataFingerprint = newFingerprint;
            state.lastSyncTime = new Date();

            renderAll();

            if (hasChanged) {
                triggerUpdateHighlight();
                showToast(`⚡ Live Sheet Updated! Latest edits synced from Google Sheets.`, 'success');
            } else if (isManual) {
                showToast('✅ Synced with Google Sheets (No new changes)', 'info');
            }
        }
    } catch (err) {
        console.warn('Google Sheet live fetch error:', err);
        if (isManual) {
            showToast(`Live fetch notice: ${err.message}. Using active local snapshot.`, 'warning');
        }
    } finally {
        state.isFetching = false;
        if (syncStatusIcon) syncStatusIcon.classList.remove('animate-spin');
        updateLiveSyncUI();
    }
}

/**
 * Fetch Google Sheet via JSONP (Bypasses all CORS and file:/// restrictions)
 */
function fetchGvizJsonp(sheetId, sheetName) {
    return new Promise((resolve, reject) => {
        const callbackName = 'gvizCallback_' + Math.floor(Math.random() * 10000000);
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout fetching sheet ${sheetName}`));
        }, 10000);

        function cleanup() {
            clearTimeout(timeout);
            if (script.parentNode) script.parentNode.removeChild(script);
            delete window[callbackName];
        }

        window[callbackName] = function(data) {
            cleanup();
            if (data && data.table) {
                resolve(data.table);
            } else {
                reject(new Error(`Invalid data received for ${sheetName}`));
            }
        };

        script.onerror = function() {
            cleanup();
            reject(new Error(`Network error loading ${sheetName}`));
        };

        const encodedSheet = encodeURIComponent(sheetName);
        script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodedSheet}&tqx=responseHandler:${callbackName}&t=${Date.now()}`;
        document.head.appendChild(script);
    });
}

/**
 * Parse GViz JSON table into normalized records
 */
function parseGvizTableToRecords(table, sheetType) {
    if (!table || !table.rows) return [];
    const records = [];

    table.rows.forEach(row => {
        if (!row.c) return;
        const c = row.c;
        const slNoVal = c[0] ? (c[0].f || String(c[0].v || '')).trim() : '';

        // Ignore header rows or non-numeric serial numbers
        if (/^\d+(\.0)?$/.test(slNoVal) || /^\d+$/.test(slNoVal)) {
            const cleanSlNo = slNoVal.replace(/\.0$/, '');
            records.push({
                slNo: cleanSlNo,
                circle: getCellValue(c[1]),
                division: getCellValue(c[2]),
                name: getCellValue(c[3]),
                notifiedArea: getCellValue(c[4]),
                controlArea: getCellValue(c[5]),
                revisedName: getCellValue(c[6]),
                revisedArea: getCellValue(c[7]),
                kmlReceived: getCellValue(c[8]),
                closedPolygon: getCellValue(c[9]),
                polygonArea: getCellValue(c[10]),
                overlap: getCellValue(c[11]),
                remarks: getCellValue(c[12]),
                verifiedBy: getCellValue(c[13]),
                reason: getCellValue(c[14]),
                actionRequired: getCellValue(c[15]),
                sheetType: sheetType
            });
        }
    });

    return records;
}

function getCellValue(cell) {
    if (!cell) return '';
    if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
    if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
    return '';
}

/**
 * Parse CSV to structured record objects
 */
function parseCsvToRecords(csvText, sheetType) {
    if (!csvText) return [];
    
    // Use PapaParse for robust RFC4180 parsing
    const results = Papa.parse(csvText, {
        skipEmptyLines: true
    });

    const rows = results.data || [];
    const records = [];

    for (let i = 0; i < rows.length; i++) {
        const fields = rows[i];
        if (!fields || fields.length < 4) continue;

        const firstCol = String(fields[0]).trim();
        // Identify data rows by serial number pattern
        if (/^\d+$/.test(firstCol)) {
            records.push({
                slNo: firstCol,
                circle: fields[1] ? String(fields[1]).trim() : '',
                division: fields[2] ? String(fields[2]).trim() : '',
                name: fields[3] ? String(fields[3]).trim() : '',
                notifiedArea: fields[4] ? String(fields[4]).trim() : '',
                controlArea: fields[5] ? String(fields[5]).trim() : '',
                revisedName: fields[6] ? String(fields[6]).trim() : '',
                revisedArea: fields[7] ? String(fields[7]).trim() : '',
                kmlReceived: fields[8] ? String(fields[8]).trim() : '',
                closedPolygon: fields[9] ? String(fields[9]).trim() : '',
                polygonArea: fields[10] ? String(fields[10]).trim() : '',
                overlap: fields[11] ? String(fields[11]).trim() : '',
                remarks: fields[12] ? String(fields[12]).trim() : '',
                verifiedBy: fields[13] ? String(fields[13]).trim() : '',
                reason: fields[14] ? String(fields[14]).trim() : '',
                actionRequired: fields[15] ? String(fields[15]).trim() : '',
                sheetType: sheetType
            });
        }
    }

    return records;
}

/**
 * Handle Local Excel / CSV File Upload
 */
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const rfSheet = workbook.Sheets['RF'] || workbook.Sheets['RF INDEX'] || workbook.Sheets[workbook.SheetNames[0]];
            const rlSheet = workbook.Sheets['RL'] || workbook.Sheets['RL INDEX'] || (workbook.SheetNames.length > 1 ? workbook.Sheets[workbook.SheetNames[1]] : null);

            if (rfSheet) {
                const rfCsv = XLSX.utils.sheet_to_csv(rfSheet);
                state.data.rf = parseCsvToRecords(rfCsv, 'RF');
            }
            if (rlSheet) {
                const rlCsv = XLSX.utils.sheet_to_csv(rlSheet);
                state.data.rl = parseCsvToRecords(rlCsv, 'RL');
            }

            state.lastSyncTime = new Date();
            renderAll();
            showToast(`Loaded ${file.name} successfully!`, 'success');
        };
        reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.csv')) {
        reader.onload = (evt) => {
            const csv = evt.target.result;
            const records = parseCsvToRecords(csv, state.activeSheet);
            if (state.activeSheet === 'RF') state.data.rf = records;
            else state.data.rl = records;

            state.lastSyncTime = new Date();
            renderAll();
            showToast(`Loaded CSV (${records.length} records) into ${state.activeSheet} sheet!`, 'success');
        };
        reader.readAsText(file);
    }
}

/**
 * Live Continuous Polling Timer
 */
function startLiveSync() {
    state.secondsUntilNextSync = state.liveSyncInterval;
    
    // Countdown tick every second
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
        if (!state.isLiveSyncing) return;
        
        state.secondsUntilNextSync--;
        updateCountdownUI();

        if (state.secondsUntilNextSync <= 0) {
            state.secondsUntilNextSync = state.liveSyncInterval;
            fetchLiveGoogleSheet(false);
        }
    }, 1000);
}

function restartLiveSyncTimer() {
    state.secondsUntilNextSync = state.liveSyncInterval;
    updateCountdownUI();
}

function updateLiveSyncUI() {
    const liveStatusText = document.getElementById('liveStatusText');
    const liveBeacon = document.getElementById('liveBeacon');
    const lastSyncEl = document.getElementById('lastSyncTime');

    if (liveStatusText && liveBeacon) {
        if (state.isLiveSyncing) {
            liveStatusText.textContent = 'LIVE SYNC ACTIVE';
            liveStatusText.className = 'text-emerald-400 font-bold tracking-wider text-[11px]';
            liveBeacon.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 live-beacon';
        } else {
            liveStatusText.textContent = 'SYNC PAUSED';
            liveStatusText.className = 'text-amber-400 font-bold tracking-wider text-[11px]';
            liveBeacon.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
        }
    }

    if (lastSyncEl && state.lastSyncTime) {
        lastSyncEl.textContent = `Last check: ${state.lastSyncTime.toLocaleTimeString()}`;
    }
}

function updateCountdownUI() {
    const countdownEl = document.getElementById('syncCountdown');
    if (countdownEl) {
        if (!state.isLiveSyncing) {
            countdownEl.textContent = 'Paused';
            return;
        }
        const sec = state.secondsUntilNextSync;
        if (sec <= 0) {
            countdownEl.textContent = 'Syncing...';
        } else if (sec >= 3600) {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            countdownEl.textContent = `${h}h ${m}m`;
        } else if (sec >= 60) {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            countdownEl.textContent = `${m}m ${s < 10 ? '0' : ''}${s}s`;
        } else {
            countdownEl.textContent = `${sec}s`;
        }
    }
}

function triggerUpdateHighlight() {
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        tableContainer.classList.add('data-updated-flash');
        setTimeout(() => tableContainer.classList.remove('data-updated-flash'), 1500);
    }
}

/**
 * Record Inspection Modal
 */
window.openRecordModal = function(slNo, sheetType) {
    const targetType = sheetType || state.activeSheet;
    const dataset = targetType === 'RF' ? state.data.rf : state.data.rl;
    const row = dataset.find(r => String(r.slNo) === String(slNo));

    if (!row) return;

    const modal = document.getElementById('recordModal');
    const modalContent = document.getElementById('modalDetails');
    if (!modal || !modalContent) return;

    const nArea = parseFloat(row.notifiedArea) || 0;
    const pArea = parseFloat(row.polygonArea) || 0;
    const diff = pArea > 0 ? (pArea - nArea).toFixed(2) : 'N/A';
    const pct = nArea > 0 && pArea > 0 ? (((pArea - nArea) / nArea) * 100).toFixed(1) : 'N/A';

    modalContent.innerHTML = `
        <div class="space-y-6">
            <!-- Header Banner -->
            <div class="flex items-start justify-between border-b border-slate-700/80 pb-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 text-xs font-bold rounded ${row.sheetType === 'RF' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-blue-950 text-blue-300 border border-blue-700'}">
                            ${row.sheetType || 'RF'} Record #${escapeHtml(row.slNo)}
                        </span>
                        <span class="text-xs text-slate-400 font-medium">${escapeHtml(row.circle)} Circle / ${escapeHtml(row.division)} Division</span>
                    </div>
                    <h2 class="text-xl font-bold text-white mt-1">${escapeHtml(row.name)}</h2>
                    ${row.revisedName && row.revisedName !== row.name ? `<p class="text-xs text-amber-300 mt-0.5">Revised Sheet Name: ${escapeHtml(row.revisedName)}</p>` : ''}
                </div>
                <div>
                    ${(row.remarks || '').toUpperCase().includes('ADDED') 
                        ? `<span class="badge-added px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>Added to Database</span>`
                        : `<span class="badge-rejected px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md"><span class="w-2 h-2 rounded-full bg-rose-400"></span>KML Rejected</span>`}
                </div>
            </div>

            <!-- Area Comparison Metrics -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                    <span class="text-[11px] text-slate-400 font-medium block">Notified Area</span>
                    <span class="text-base font-bold text-white">${nArea > 0 ? `${nArea.toFixed(2)} Ha` : '-'}</span>
                </div>
                <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                    <span class="text-[11px] text-slate-400 font-medium block">Division Control Area</span>
                    <span class="text-base font-bold text-slate-200">${row.controlArea ? `${parseFloat(row.controlArea).toFixed(2)} Ha` : '-'}</span>
                </div>
                <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                    <span class="text-[11px] text-slate-400 font-medium block">KML Polygon Area</span>
                    <span class="text-base font-bold text-emerald-300">${pArea > 0 ? `${pArea.toFixed(2)} Ha` : '-'}</span>
                </div>
                <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                    <span class="text-[11px] text-slate-400 font-medium block">Area Discrepancy</span>
                    <span class="text-base font-bold ${Math.abs(parseFloat(pct)) > 20 ? 'text-rose-400' : 'text-slate-300'}">
                        ${diff !== 'N/A' ? `${diff > 0 ? '+' : ''}${diff} Ha (${pct}%)` : '-'}
                    </span>
                </div>
            </div>

            <!-- GIS Attributes & Flags -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div class="space-y-2.5">
                    <div class="flex justify-between text-xs py-1 border-b border-slate-800">
                        <span class="text-slate-400">Revised KML Received:</span>
                        <span class="font-semibold text-white">${escapeHtml(row.kmlReceived || 'No')}</span>
                    </div>
                    <div class="flex justify-between text-xs py-1 border-b border-slate-800">
                        <span class="text-slate-400">Closed Polygon Geometry:</span>
                        <span class="font-semibold text-white">${escapeHtml(row.closedPolygon || 'No')}</span>
                    </div>
                    <div class="flex justify-between text-xs py-1">
                        <span class="text-slate-400">Overlap Status:</span>
                        <span class="font-semibold text-white">${escapeHtml(row.overlap || 'No')}</span>
                    </div>
                </div>
                <div class="space-y-2.5">
                    <div class="flex justify-between text-xs py-1 border-b border-slate-800">
                        <span class="text-slate-400">Verified By:</span>
                        <span class="font-semibold text-emerald-400">${escapeHtml(row.verifiedBy || 'Pending')}</span>
                    </div>
                    <div class="flex justify-between text-xs py-1 border-b border-slate-800">
                        <span class="text-slate-400">Rejection / Flag Reason:</span>
                        <span class="font-semibold text-rose-300">${escapeHtml(row.reason || 'None')}</span>
                    </div>
                    <div class="flex justify-between text-xs py-1">
                        <span class="text-slate-400">Further Action Required:</span>
                        <span class="font-semibold text-amber-300">${escapeHtml(row.actionRequired || 'None')}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    lucide.createIcons();
};

/**
 * Export to Excel (.xlsx) using SheetJS
 */
function exportToExcel() {
    const dataset = getFilteredDataset();
    if (dataset.length === 0) {
        showToast('No records to export', 'warning');
        return;
    }

    const headers = [
        'Sl.No.', 'Circle', 'Division', 'Name', 'Notified Area (Ha)', 'Division Control Area (Ha)',
        'Revised Name', 'Revised Area (Ha)', 'KML Received', 'Closed Polygon', 'Polygon Area (Ha)',
        'Overlap', 'Remarks', 'Verified By', 'Reason', 'Further Action Required'
    ];

    const rows = dataset.map(item => [
        item.slNo, item.circle, item.division, item.name, item.notifiedArea, item.controlArea,
        item.revisedName, item.revisedArea, item.kmlReceived, item.closedPolygon, item.polygonArea,
        item.overlap, item.remarks, item.verifiedBy, item.reason, item.actionRequired
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${state.activeSheet}_Data`);

    const filename = `${state.activeSheet}_GIS_Verification_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${dataset.length} records to ${filename}!`, 'success');
}

/**
 * Export to CSV
 */
function exportToCSV() {
    const dataset = getFilteredDataset();
    if (dataset.length === 0) {
        showToast('No records to export', 'warning');
        return;
    }

    const csv = Papa.unparse(dataset);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${state.activeSheet}_GIS_Data_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast(`Exported CSV successfully!`, 'success');
}

/**
 * Toast Alert System
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toastAlert');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;

    if (type === 'success') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-950/95 text-emerald-200 border border-emerald-500 shadow-2xl shadow-emerald-950/50 backdrop-blur-md transition-all duration-300 translate-y-0 opacity-100';
        if (toastIcon) toastIcon.setAttribute('data-lucide', 'check-circle-2');
    } else if (type === 'error') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-950/95 text-rose-200 border border-rose-500 shadow-2xl shadow-rose-950/50 backdrop-blur-md transition-all duration-300 translate-y-0 opacity-100';
        if (toastIcon) toastIcon.setAttribute('data-lucide', 'alert-octagon');
    } else if (type === 'warning') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-950/95 text-amber-200 border border-amber-500 shadow-2xl shadow-amber-950/50 backdrop-blur-md transition-all duration-300 translate-y-0 opacity-100';
        if (toastIcon) toastIcon.setAttribute('data-lucide', 'alert-triangle');
    } else {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/95 text-slate-200 border border-slate-600 shadow-2xl shadow-slate-950/50 backdrop-blur-md transition-all duration-300 translate-y-0 opacity-100';
        if (toastIcon) toastIcon.setAttribute('data-lucide', 'info');
    }

    lucide.createIcons();

    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4');
    }, 3500);
}

/**
 * Utility Functions
 */
function extractSheetId(url) {
    if (!url) return null;
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function generateFingerprint(dataObj) {
    const str = JSON.stringify(dataObj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

function formatArea(val) {
    if (!val || isNaN(val)) return '0.00 Ha';
    return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ha`;
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
