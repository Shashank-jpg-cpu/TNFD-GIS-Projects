/**
 * ==============================================================================
 * TAMIL NADU FOREST DEPARTMENT (TNFD)
 * Forest Asset & Administrative Boundary Studio — Application Controller
 * ==============================================================================
 */

const App = {
    state: {
        mapMode: 'division',          // 'division' | 'range'
        selectedDivisionId: '',
        divisionData: null,
        selectedRangeName: '',
        orientation: 'landscape',      // 'landscape' | 'portrait'
        autoOrientation: true,

        // Optional Map Layers
        showRanges: true,              // Division Mode optional layer
        showRF: true,                  // RF green shade optional layer
        showRL: true,                  // RL brown shade optional layer
        showRFLabels: false,
        showRLLabels: false,
        showRangeLabels: false,
        showAssetLabels: true,

        // Viewport Transform
        mapZoom: 1.0,
        panOffset: { x: 0, y: 0 },
        isPanning: false,
        lastPanPoint: { x: 0, y: 0 },

        // Forest Assets
        placedAssets: [],
        selectedAssetIndex: -1,
        isPlacingAsset: false,
        activeAssetType: 'apc',
        activeAssetLabel: '',
        isDraggingAsset: false,
        draggedAssetIndex: -1,

        // Custom Polygons
        customPolygons: [],
        isDrawingPolygon: false,
        activeDrawingPoints: [],
        activePolyColor: '#9333ea',
        activePolyName: 'Proposed Plantation Zone'
    },

    canvas: null,
    sheet: null,

    init: function() {
        this.canvas = document.getElementById('map-canvas');
        this.sheet = document.getElementById('a4-sheet');

        this.initAssetDropdown();
        this.populateDivisionDropdown();
        this.setupEventListeners();
        this.setupCanvasInteractions();

        // Default to first division (e.g. DHARMAPURI or ARIYALUR)
        const defaultDiv = (window.DIVISIONS_INDEX && window.DIVISIONS_INDEX.length > 0)
            ? (window.DIVISIONS_INDEX.find(d => d.name === 'DHARMAPURI') || window.DIVISIONS_INDEX[0]).id
            : 'ariyalur';

        this.selectDivision(defaultDiv);
        this.updateOrientationUI();
        this.render();
    },

    initAssetDropdown: function() {
        const select = document.getElementById('select-asset-type');
        if (!select) return;
        select.innerHTML = '';

        CartoRenderer.FOREST_ASSETS.forEach(asset => {
            const opt = document.createElement('option');
            opt.value = asset.id;
            opt.textContent = `${asset.icon}  ${asset.name}`;
            select.appendChild(opt);
        });

        // Set default label
        this.updateActiveAssetLabel();
    },

    updateActiveAssetLabel: function() {
        const select = document.getElementById('select-asset-type');
        const input = document.getElementById('input-asset-label');
        if (!select || !input) return;

        const assetId = select.value;
        const meta = CartoRenderer.getAssetMeta(assetId);
        this.state.activeAssetType = assetId;

        // Auto-suggest label
        const count = this.state.placedAssets.filter(a => a.assetId === assetId).length + 1;
        input.value = `${meta.name} #${count}`;
        this.state.activeAssetLabel = input.value;
    },

    populateDivisionDropdown: function() {
        const divSelect = document.getElementById('select-division');
        const rangeDivSelect = document.getElementById('select-range-division');
        if (!divSelect && !rangeDivSelect) return;

        const divs = window.DIVISIONS_INDEX || [];
        const sortedDivs = [...divs].sort((a, b) => a.name.localeCompare(b.name));

        const populate = (sel, placeholder) => {
            if (!sel) return;
            sel.innerHTML = `<option value="">-- ${placeholder} --</option>`;
            sortedDivs.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = `${d.name} (${d.counts.ranges} Ranges, ${d.counts.rf} RF)`;
                sel.appendChild(opt);
            });
        };

        populate(divSelect, "Choose Forest Division");
        populate(rangeDivSelect, "Choose Division First");
    },

    populateRangeDropdown: function(divId) {
        const rangeSelect = document.getElementById('select-range-item');
        if (!rangeSelect) return;

        const divData = (window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId]) || null;
        if (!divData || !divData.ranges || !divData.ranges.features) {
            rangeSelect.innerHTML = '<option value="">-- No Ranges Found --</option>';
            rangeSelect.disabled = true;
            return;
        }

        const ranges = divData.ranges.features
            .map(f => (f.properties && f.properties.name) || "")
            .filter(n => n.length > 0)
            .sort((a, b) => a.localeCompare(b));

        rangeSelect.innerHTML = '<option value="">-- Choose Range to Map --</option>';
        ranges.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            rangeSelect.appendChild(opt);
        });

        rangeSelect.disabled = false;
    },

    selectDivision: function(divId) {
        if (!divId) return;
        this.state.selectedDivisionId = divId;

        const data = (window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId]) || null;
        this.state.divisionData = data;

        // Auto-detect orientation from metadata if enabled
        if (this.state.autoOrientation && data && data.orientation) {
            this.state.orientation = data.orientation;
            this.updateOrientationUI();
        }

        // Reset view transforms
        this.resetMapView();

        // Update UI info
        this.updateDivisionStats();
        this.populateRangeDropdown(divId);

        // Update selects
        const divSel = document.getElementById('select-division');
        if (divSel && divSel.value !== divId) divSel.value = divId;

        const rDivSel = document.getElementById('select-range-division');
        if (rDivSel && rDivSel.value !== divId) rDivSel.value = divId;

        this.render();
    },

    selectRange: function(rangeName) {
        if (!rangeName) return;
        this.state.selectedRangeName = rangeName;
        this.resetMapView();
        this.updateRangeStats();
        this.render();
    },

    resetMapView: function() {
        this.state.mapZoom = 1.0;
        this.state.panOffset = { x: 0, y: 0 };
        this.updateZoomDisplay();
    },

    updateDivisionStats: function() {
        const data = this.state.divisionData;
        const box = document.getElementById('div-stats-box');
        if (!box) return;

        if (!data) {
            box.classList.add('hidden');
            return;
        }

        box.classList.remove('hidden');
        document.getElementById('stat-div-name').textContent = data.division || '';
        document.getElementById('stat-ranges').textContent = (data.counts && data.counts.ranges) || (data.ranges ? data.ranges.features.length : 0);
        document.getElementById('stat-rf').textContent = (data.counts && data.counts.rf) || (data.rf ? data.rf.features.length : 0);
        document.getElementById('stat-rl').textContent = (data.counts && data.counts.rl) || (data.rl ? data.rl.features.length : 0);
    },

    updateRangeStats: function() {
        const data = this.state.divisionData;
        const rName = this.state.selectedRangeName;
        const box = document.getElementById('range-stats-box');
        if (!box) return;

        if (!data || !rName) {
            box.classList.add('hidden');
            return;
        }

        box.classList.remove('hidden');
        document.getElementById('stat-range-name').textContent = rName;

        const rfCount = data.rf && data.rf.features
            ? data.rf.features.filter(f => f.properties && ((f.properties.range || f.properties.RANGE || '').trim().toLowerCase() === rName.trim().toLowerCase())).length
            : 0;

        const rlCount = data.rl && data.rl.features
            ? data.rl.features.filter(f => f.properties && ((f.properties.range || f.properties.RANGE || '').trim().toLowerCase() === rName.trim().toLowerCase())).length
            : 0;

        document.getElementById('stat-range-rf').textContent = rfCount;
        document.getElementById('stat-range-rl').textContent = rlCount;
    },

    updateOrientationUI: function() {
        const isPort = this.state.orientation === 'portrait';
        const btnLand = document.getElementById('btn-orient-land');
        const btnPort = document.getElementById('btn-orient-port');

        if (btnLand && btnPort) {
            if (isPort) {
                btnPort.className = "px-3 py-1 rounded bg-emerald-600 text-white font-bold text-xs transition";
                btnLand.className = "px-3 py-1 rounded text-slate-400 hover:text-white text-xs transition";
            } else {
                btnLand.className = "px-3 py-1 rounded bg-emerald-600 text-white font-bold text-xs transition";
                btnPort.className = "px-3 py-1 rounded text-slate-400 hover:text-white text-xs transition";
            }
        }

        // Adjust Canvas Sheet Dimensions (scaled preview for responsive display)
        if (this.sheet && this.canvas) {
            if (isPort) {
                this.sheet.style.width = '700px';
                this.sheet.style.height = '990px';
                this.canvas.width = 1400;
                this.canvas.height = 1980;
            } else {
                this.sheet.style.width = '990px';
                this.sheet.style.height = '700px';
                this.canvas.width = 1980;
                this.canvas.height = 1400;
            }
        }
    },

    updateZoomDisplay: function() {
        const span = document.getElementById('label-zoom-level');
        if (span) {
            span.textContent = `${Math.round(this.state.mapZoom * 100)}%`;
        }
    },

    setupEventListeners: function() {
        // Mode Switcher Tabs
        const btnModeDiv = document.getElementById('btn-mode-division');
        const btnModeRange = document.getElementById('btn-mode-range');
        const panelDiv = document.getElementById('panel-division-mode');
        const panelRange = document.getElementById('panel-range-mode');
        const grpRangesToggle = document.getElementById('group-toggle-ranges');

        btnModeDiv.addEventListener('click', () => {
            this.state.mapMode = 'division';
            btnModeDiv.className = "mode-tab active py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5";
            btnModeRange.className = "mode-tab py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5";
            panelDiv.classList.remove('hidden');
            panelRange.classList.add('hidden');
            if (grpRangesToggle) grpRangesToggle.classList.remove('hidden');
            document.getElementById('header-mode-badge').textContent = 'Division Map';
            this.render();
        });

        btnModeRange.addEventListener('click', () => {
            this.state.mapMode = 'range';
            btnModeRange.className = "mode-tab active py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5";
            btnModeDiv.className = "mode-tab py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5";
            panelRange.classList.remove('hidden');
            panelDiv.classList.add('hidden');
            if (grpRangesToggle) grpRangesToggle.classList.add('hidden');
            document.getElementById('header-mode-badge').textContent = 'Range Map';
            this.render();
        });

        // Division & Range Selectors
        document.getElementById('select-division').addEventListener('change', e => {
            this.selectDivision(e.target.value);
        });

        document.getElementById('select-range-division').addEventListener('change', e => {
            this.selectDivision(e.target.value);
        });

        document.getElementById('select-range-item').addEventListener('change', e => {
            this.selectRange(e.target.value);
        });

        // Layer Toggles
        const bindToggle = (id, prop) => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = this.state[prop];
                el.addEventListener('change', e => {
                    this.state[prop] = e.target.checked;
                    this.render();
                });
            }
        };

        bindToggle('toggle-ranges', 'showRanges');
        bindToggle('toggle-rf', 'showRF');
        bindToggle('toggle-rl', 'showRL');
        bindToggle('toggle-rf-names', 'showRFLabels');
        bindToggle('toggle-rl-names', 'showRLLabels');
        bindToggle('toggle-range-names', 'showRangeLabels');
        bindToggle('toggle-asset-names', 'showAssetLabels');

        // Orientation Buttons
        document.getElementById('btn-orient-land').addEventListener('click', () => {
            this.state.orientation = 'landscape';
            this.state.autoOrientation = false;
            this.updateOrientationUI();
            this.render();
        });

        document.getElementById('btn-orient-port').addEventListener('click', () => {
            this.state.orientation = 'portrait';
            this.state.autoOrientation = false;
            this.updateOrientationUI();
            this.render();
        });

        // Zoom & Pan Buttons
        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            this.state.mapZoom = Math.min(8.0, this.state.mapZoom * 1.25);
            this.updateZoomDisplay();
            this.render();
        });

        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            this.state.mapZoom = Math.max(0.3, this.state.mapZoom / 1.25);
            this.updateZoomDisplay();
            this.render();
        });

        document.getElementById('btn-zoom-reset').addEventListener('click', () => {
            this.resetMapView();
            this.render();
        });

        // Asset Management
        const assetSelect = document.getElementById('select-asset-type');
        assetSelect.addEventListener('change', () => {
            this.updateActiveAssetLabel();
        });

        document.getElementById('input-asset-label').addEventListener('input', e => {
            this.state.activeAssetLabel = e.target.value;
        });

        // "Place on Map" Button
        const btnPlace = document.getElementById('btn-place-asset');
        btnPlace.addEventListener('click', () => {
            this.state.isPlacingAsset = !this.state.isPlacingAsset;
            this.state.isDrawingPolygon = false;
            this.updateActionBanner();
        });

        // "Add at Center" Button
        document.getElementById('btn-add-asset-center').addEventListener('click', () => {
            this.addAssetAtCenter();
        });

        // Polygon Management
        const btnDrawPoly = document.getElementById('btn-draw-poly');
        btnDrawPoly.addEventListener('click', () => {
            this.state.isDrawingPolygon = !this.state.isDrawingPolygon;
            this.state.isPlacingAsset = false;
            if (this.state.isDrawingPolygon) {
                this.state.activeDrawingPoints = [];
            }
            this.updateActionBanner();
            this.render();
        });

        const btnFinishPoly = document.getElementById('btn-finish-poly');
        if (btnFinishPoly) {
            btnFinishPoly.addEventListener('click', () => {
                this.finishCurrentPolygon();
            });
        }

        const inputPolyName = document.getElementById('input-poly-name');
        if (inputPolyName) {
            inputPolyName.addEventListener('input', e => {
                this.state.activePolyName = e.target.value;
            });
        }

        const selectPolyColor = document.getElementById('select-poly-color');
        if (selectPolyColor) {
            selectPolyColor.addEventListener('change', e => {
                this.state.activePolyColor = e.target.value;
            });
        }

        // GeoJSON Polygon Upload
        const filePolyInput = document.getElementById('input-upload-geojson');
        if (filePolyInput) {
            filePolyInput.addEventListener('change', e => {
                this.handleGeoJSONUpload(e.target.files[0]);
            });
        }

        // Export Buttons
        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            const divName = (this.state.divisionData && this.state.divisionData.division) || "Forest";
            const fname = `TNFD_${divName}_${this.state.mapMode === 'range' ? this.state.selectedRangeName : 'Division'}_Asset_Map.pdf`;
            CartoRenderer.exportHighResPDF(this.state, fname);
        });

        document.getElementById('btn-export-jpg').addEventListener('click', () => {
            const divName = (this.state.divisionData && this.state.divisionData.division) || "Forest";
            const fname = `TNFD_${divName}_${this.state.mapMode === 'range' ? this.state.selectedRangeName : 'Division'}_Asset_Map.jpg`;
            CartoRenderer.exportHighResJPG(this.state, fname);
        });

        document.getElementById('btn-export-png').addEventListener('click', () => {
            const divName = (this.state.divisionData && this.state.divisionData.division) || "Forest";
            const fname = `TNFD_${divName}_${this.state.mapMode === 'range' ? this.state.selectedRangeName : 'Division'}_Asset_Map.png`;
            CartoRenderer.exportHighResPNG(this.state, fname);
        });

        // Mobile Sidebar Toggle
        const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
        const btnCloseSidebar = document.getElementById('btn-close-sidebar');
        const sidebarPanel = document.getElementById('sidebar-panel');
        const sidebarBackdrop = document.getElementById('sidebar-backdrop');

        if (btnToggleSidebar && sidebarPanel && sidebarBackdrop) {
            const toggleSidebar = open => {
                if (open) {
                    sidebarPanel.classList.remove('-translate-x-full');
                    sidebarBackdrop.classList.remove('hidden');
                } else {
                    sidebarPanel.classList.add('-translate-x-full');
                    sidebarBackdrop.classList.add('hidden');
                }
            };

            btnToggleSidebar.addEventListener('click', () => toggleSidebar(true));
            if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
            sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));
        }
    },

    updateActionBanner: function() {
        const banner = document.getElementById('action-hint-banner');
        const text = document.getElementById('action-hint-text');
        const btnFinish = document.getElementById('btn-finish-poly-action');
        const btnCancel = document.getElementById('btn-cancel-action');

        if (!banner || !text) return;

        if (this.state.isPlacingAsset) {
            banner.classList.remove('hidden');
            const meta = CartoRenderer.getAssetMeta(this.state.activeAssetType);
            text.innerHTML = `<span class="text-emerald-400 font-bold">${meta.icon} PLACING ASSET:</span> Click anywhere on the map to accurately place <strong>${this.state.activeAssetLabel || meta.name}</strong>. Zoom in for precision!`;
            if (btnFinish) btnFinish.classList.add('hidden');
            if (btnCancel) btnCancel.classList.remove('hidden');
            this.canvas.style.cursor = 'crosshair';
        } else if (this.state.isDrawingPolygon) {
            banner.classList.remove('hidden');
            const count = this.state.activeDrawingPoints.length;
            text.innerHTML = `<span class="text-purple-400 font-bold">✏️ DRAWING POLYGON (${count} pts):</span> Click on map to add vertices. Double-click or click 'Complete Polygon' to finish.`;
            if (btnFinish) btnFinish.classList.remove('hidden');
            if (btnCancel) btnCancel.classList.remove('hidden');
            this.canvas.style.cursor = 'crosshair';
        } else {
            banner.classList.add('hidden');
            this.canvas.style.cursor = 'grab';
        }

        if (btnCancel) {
            btnCancel.onclick = () => {
                this.state.isPlacingAsset = false;
                this.state.isDrawingPolygon = false;
                this.state.activeDrawingPoints = [];
                this.updateActionBanner();
                this.render();
            };
        }

        if (btnFinish) {
            btnFinish.onclick = () => {
                this.finishCurrentPolygon();
            };
        }
    },

    setupCanvasInteractions: function() {
        const canvas = this.canvas;
        if (!canvas) return;

        // Pointer / Mouse Down
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clickPx = (e.clientX - rect.left) * scaleX;
            const clickPy = (e.clientY - rect.top) * scaleY;

            // 1. If in Asset Placement Mode
            if (this.state.isPlacingAsset) {
                if (this.state._activeProjection) {
                    const geo = this.state._activeProjection.toGeo(clickPx, clickPy);
                    this.addAssetAtGeo(geo[0], geo[1]);
                    this.state.isPlacingAsset = false;
                    this.updateActionBanner();
                    this.render();
                }
                return;
            }

            // 2. If in Polygon Drawing Mode
            if (this.state.isDrawingPolygon) {
                if (this.state._activeProjection) {
                    const geo = this.state._activeProjection.toGeo(clickPx, clickPy);
                    this.state.activeDrawingPoints.push(geo);
                    this.updateActionBanner();
                    this.render();
                }
                return;
            }

            // 3. Check if clicking on an existing asset (for selection or dragging)
            const clickedAssetIdx = this.findAssetAtPixel(clickPx, clickPy);
            if (clickedAssetIdx >= 0) {
                const asset = this.state.placedAssets[clickedAssetIdx];
                if (asset && (asset.isCoordinateLocked || asset.addedBy === 'coordinates')) {
                    // Cannot move assets added by coordinates - only keep or delete!
                    return;
                }
                this.state.selectedAssetIndex = clickedAssetIdx;
                this.state.isDraggingAsset = true;
                this.state.draggedAssetIndex = clickedAssetIdx;
                this.updateAssetListUI();
                this.render();
                return;
            }

            // 4. Otherwise, start Map Pan
            this.state.isPanning = true;
            this.state.lastPanPoint = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        });

        // Mouse Move
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const movePx = (e.clientX - rect.left) * scaleX;
            const movePy = (e.clientY - rect.top) * scaleY;

            // Dragging an asset
            if (this.state.isDraggingAsset && this.state.draggedAssetIndex >= 0) {
                if (this.state._activeProjection) {
                    const geo = this.state._activeProjection.toGeo(movePx, movePy);
                    const asset = this.state.placedAssets[this.state.draggedAssetIndex];
                    if (asset) {
                        asset.lon = geo[0];
                        asset.lat = geo[1];
                        this.render();
                    }
                }
                return;
            }

            // Panning the map
            if (this.state.isPanning) {
                const dx = (e.clientX - this.state.lastPanPoint.x) * scaleX;
                const dy = (e.clientY - this.state.lastPanPoint.y) * scaleY;
                this.state.panOffset.x += dx;
                this.state.panOffset.y += dy;
                this.state.lastPanPoint = { x: e.clientX, y: e.clientY };
                this.render();
                return;
            }

            // Hover indicator for assets
            if (!this.state.isPlacingAsset && !this.state.isDrawingPolygon) {
                const hoverAssetIdx = this.findAssetAtPixel(movePx, movePy);
                if (hoverAssetIdx >= 0) {
                    const a = this.state.placedAssets[hoverAssetIdx];
                    canvas.style.cursor = (a && (a.isCoordinateLocked || a.addedBy === 'coordinates')) ? 'not-allowed' : 'pointer';
                } else {
                    canvas.style.cursor = 'grab';
                }
            }
        });

        // Mouse Up
        window.addEventListener('mouseup', () => {
            if (this.state.isPanning) {
                this.state.isPanning = false;
                if (!this.state.isPlacingAsset && !this.state.isDrawingPolygon) {
                    canvas.style.cursor = 'grab';
                }
            }
            if (this.state.isDraggingAsset) {
                this.state.isDraggingAsset = false;
                this.state.draggedAssetIndex = -1;
                this.updateAssetListUI();
            }
        });

        // Double Click to finish drawing polygon
        canvas.addEventListener('dblclick', () => {
            if (this.state.isDrawingPolygon) {
                this.finishCurrentPolygon();
            }
        });

        // Mouse Wheel Zoom
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
            this.state.mapZoom = Math.min(8.0, Math.max(0.3, this.state.mapZoom * zoomDelta));
            this.updateZoomDisplay();
            this.render();
        }, { passive: false });
    },

    findAssetAtPixel: function(px, py) {
        if (!this.state._activeProjection || !this.state.placedAssets) return -1;
        const toPixel = this.state._activeProjection.toPixel;
        const hitRadius = 20;

        for (let i = this.state.placedAssets.length - 1; i >= 0; i--) {
            const asset = this.state.placedAssets[i];
            if (asset.visible === false) continue;
            const pt = toPixel(asset.lon, asset.lat);
            const dist = Math.hypot(pt[0] - px, pt[1] - py);
            if (dist <= hitRadius) {
                return i;
            }
        }
        return -1;
    },

    addAssetAtGeo: function(lon, lat) {
        const meta = CartoRenderer.getAssetMeta(this.state.activeAssetType);
        const label = this.state.activeAssetLabel || meta.name;

        this.state.placedAssets.push({
            id: `asset_${Date.now()}`,
            assetId: this.state.activeAssetType,
            label: label,
            lon: lon,
            lat: lat,
            visible: true
        });

        this.state.selectedAssetIndex = this.state.placedAssets.length - 1;
        this.updateAssetListUI();
        this.updateActiveAssetLabel(); // Increment default label count
    },

    addAssetAtCenter: function() {
        if (!this.state._activeProjection) return;
        const box = this.state._activeProjection.mapBox;
        const centerPx = box.x + (box.w / 2);
        const centerPy = box.y + (box.h / 2);
        const geo = this.state._activeProjection.toGeo(centerPx, centerPy);

        this.addAssetAtGeo(geo[0], geo[1]);
        this.render();
    },

    updateAssetListUI: function() {
        const listEl = document.getElementById('placed-assets-list');
        const countBadge = document.getElementById('badge-asset-count');
        if (!listEl) return;

        if (countBadge) countBadge.textContent = this.state.placedAssets.length;

        if (this.state.placedAssets.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-4 text-slate-500 text-xs">
                    <i class="fa-solid fa-map-pin text-slate-600 text-lg mb-1 block"></i>
                    No assets placed on map yet.<br/>Choose an asset and click 'Place Asset on Map'.
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';
        this.state.placedAssets.forEach((asset, idx) => {
            const meta = CartoRenderer.getAssetMeta(asset.assetId);
            const isSelected = this.state.selectedAssetIndex === idx;

            const item = document.createElement('div');
            item.className = `flex items-center justify-between p-2 rounded-lg border text-xs transition ${
                isSelected ? 'bg-emerald-950/60 border-emerald-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`;

            item.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden cursor-pointer flex-1">
                    <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0" style="background:${meta.bg}; border: 1.5px solid ${meta.color};">${meta.icon}</span>
                    <div class="truncate">
                        <strong class="text-slate-200 block truncate">${asset.label}</strong>
                        <span class="text-[10px] text-slate-400 block">${meta.category} • ${asset.lat.toFixed(4)}, ${asset.lon.toFixed(4)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 ml-2">
                    <button class="btn-toggle-asset-vis p-1 text-slate-400 hover:text-slate-200" title="${asset.visible ? 'Hide Asset' : 'Show Asset'}">
                        <i class="fa-solid ${asset.visible ? 'fa-eye' : 'fa-eye-slash text-slate-600'}"></i>
                    </button>
                    <button class="btn-delete-asset p-1 text-red-400 hover:text-red-300" title="Delete Asset">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            // Selection
            item.querySelector('.flex-1').addEventListener('click', () => {
                this.state.selectedAssetIndex = idx;
                this.updateAssetListUI();
                this.render();
            });

            // Visibility toggle
            item.querySelector('.btn-toggle-asset-vis').addEventListener('click', e => {
                e.stopPropagation();
                asset.visible = !asset.visible;
                this.updateAssetListUI();
                this.render();
            });

            // Delete
            item.querySelector('.btn-delete-asset').addEventListener('click', e => {
                e.stopPropagation();
                this.state.placedAssets.splice(idx, 1);
                if (this.state.selectedAssetIndex === idx) this.state.selectedAssetIndex = -1;
                this.updateAssetListUI();
                this.render();
            });

            listEl.appendChild(item);
        });
    },

    finishCurrentPolygon: function() {
        if (!this.state.activeDrawingPoints || this.state.activeDrawingPoints.length < 3) {
            alert("A polygon must have at least 3 points! Click on the map to add more vertices.");
            return;
        }

        const poly = {
            id: `poly_${Date.now()}`,
            name: this.state.activePolyName || `Zone #${this.state.customPolygons.length + 1}`,
            color: this.state.activePolyColor || '#9333ea',
            coordinates: [...this.state.activeDrawingPoints],
            visible: true
        };

        this.state.customPolygons.push(poly);
        this.state.isDrawingPolygon = false;
        this.state.activeDrawingPoints = [];
        this.updateActionBanner();
        this.updatePolygonListUI();
        this.render();
    },

    updatePolygonListUI: function() {
        const listEl = document.getElementById('custom-polygons-list');
        const badge = document.getElementById('badge-poly-count');
        if (!listEl) return;

        if (badge) badge.textContent = this.state.customPolygons.length;

        if (this.state.customPolygons.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-3 text-slate-500 text-xs">
                    <i class="fa-solid fa-draw-polygon text-slate-600 text-base mb-1 block"></i>
                    No custom polygons created.<br/>Click 'Draw Polygon' to create a zone.
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';
        this.state.customPolygons.forEach((poly, idx) => {
            const item = document.createElement('div');
            item.className = "flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs";
            item.innerHTML = `
                <div class="flex items-center gap-2 truncate">
                    <span class="w-3.5 h-3.5 rounded shrink-0 border" style="background:${poly.color}40; border-color:${poly.color};"></span>
                    <strong class="text-slate-200 truncate">${poly.name}</strong>
                    <span class="text-[10px] text-slate-400">(${poly.coordinates.length} pts)</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 ml-2">
                    <button class="btn-toggle-poly p-1 text-slate-400 hover:text-slate-200">
                        <i class="fa-solid ${poly.visible !== false ? 'fa-eye' : 'fa-eye-slash text-slate-600'}"></i>
                    </button>
                    <button class="btn-del-poly p-1 text-red-400 hover:text-red-300">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            item.querySelector('.btn-toggle-poly').addEventListener('click', () => {
                poly.visible = poly.visible === false;
                this.updatePolygonListUI();
                this.render();
            });

            item.querySelector('.btn-del-poly').addEventListener('click', () => {
                this.state.customPolygons.splice(idx, 1);
                this.updatePolygonListUI();
                this.render();
            });

            listEl.appendChild(item);
        });
    },

    handleGeoJSONUpload: function(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const geojson = JSON.parse(e.target.result);
                let addedCount = 0;

                const extractCoords = geom => {
                    if (geom.type === 'Polygon') return geom.coordinates[0];
                    if (geom.type === 'MultiPolygon') return geom.coordinates[0][0];
                    return null;
                };

                const processFeat = (feat, name) => {
                    if (!feat.geometry) return;
                    const coords = extractCoords(feat.geometry);
                    if (coords && coords.length >= 3) {
                        this.state.customPolygons.push({
                            id: `poly_import_${Date.now()}_${addedCount}`,
                            name: name || (feat.properties && (feat.properties.name || feat.properties.NAME)) || `Imported Polygon ${addedCount + 1}`,
                            color: this.state.activePolyColor || '#0284c7',
                            coordinates: coords,
                            visible: true
                        });
                        addedCount++;
                    }
                };

                if (geojson.type === 'FeatureCollection' && geojson.features) {
                    geojson.features.forEach((f, i) => processFeat(f, `Imported Poly #${i + 1}`));
                } else if (geojson.type === 'Feature') {
                    processFeat(geojson, 'Imported Polygon');
                } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
                    processFeat({ geometry: geojson }, 'Imported Polygon');
                }

                alert(`Successfully imported ${addedCount} custom polygon(s) from GeoJSON!`);
                this.updatePolygonListUI();
                this.render();
            } catch (err) {
                alert(`Error reading GeoJSON: ${err.message}`);
            }
        };
        reader.readAsText(file);
    },

    render: function() {
        if (this.canvas) {
            CartoRenderer.render(this.canvas, this.state, false);
        }
    }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
