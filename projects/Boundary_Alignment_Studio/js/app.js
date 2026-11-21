/**
 * Boundary Alignment Studio - Main Application Controller
 * Features:
 * - Prominent Interchange / Swap button
 * - Persistence across page refresh (localStorage)
 * - Modern ON / OFF toggle switch buttons in Step 3 (no tick boxes)
 * - Adjusted layers default to OFF so user can toggle ON to inspect
 * - Multiple Adjusted Layers support: Interchanging and editing preserves old adjusted layers and creates new ones
 * - 100% Lag-free & hang-free
 */

const App = {
    map: null,
    baseLayers: {},
    currentBaseLayer: null,
    currentBasemapKey: 'googleHybrid',

    // Storage Key
    STORAGE_KEY: 'tnfd_boundary_alignment_session_v2',

    // Core Layer State
    refData: null,
    refName: "Reference Layer",
    refVisible: true,
    refColor: "#10b981",

    targetData: null,
    targetName: "Target Layer",
    targetVisible: true,
    targetColor: "#ef4444",

    // Track role changes to know when to start a new adjusted layer
    hasInterchangedSinceLastEdit: false,

    // Adjusted Layers List: Array of { id, name, color, visible, data, sourceTargetName }
    adjustedLayers: [],

    // Leaflet Layer Groups
    layerGroups: {
        ref: null,
        target: null,
        preview: null,
        snap: null,
        adjustedMap: {} // id -> L.layerGroup
    },

    // Precision Loupe HUD Mini-Map
    loupeMap: null,
    loupeBaseLayer: null,
    loupeRefGroup: null,
    loupeTargetGroup: null,
    loupeCursorGroup: null,

    // Point Picking & Precision Snapping
    activeTool: 'none',
    pointA: null,
    pointB: null,
    hoverValidTargetPoint: null,
    hoverNearestRefPoint: null,

    init: async function() {
        this.initMap();
        this.initLayerGroups();
        this.initEventListeners();

        // Restore state across page refreshes (localStorage + IndexedDB)
        const restored = await this.loadFromStorage();
        if (restored) {
            this.renderRefLayer();
            this.renderTargetLayer();
            this.renderAllAdjustedLayers();
            this.updateStep3UI();
            this.fitBoundsIfReady();
            this.showToast("Restored your previous boundary session (saved across refresh).", "info");
        } else {
            this.updateStep3UI();
        }
    },

    initMap: function() {
        this.map = L.map('map', {
            center: [10.05, 77.58],
            zoom: 11,
            zoomControl: false,
            attributionControl: false,
            preferCanvas: true
        });
        this.canvasRenderer = L.canvas({ padding: 0.5, tolerance: 10 });

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // 100% Free, High-Resolution Basemaps (No API Keys required, No Watermarks, Never Blocked)
        this.baseLayers = {
            'googleHybrid': L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 22 }),
            'googleSatellite': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 22 }),
            'googleRoadmap': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 22 }),
            'googleTerrain': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { maxZoom: 22 }),
            'esriSatellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 18, maxZoom: 22 }),
            'esriTopo': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 18, maxZoom: 22 }),
            'esriStreet': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 18, maxZoom: 22 }),
            'osmStandard': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 22 })
        };

        // Restore saved basemap choice from localStorage across refresh
        let savedBasemap = localStorage.getItem('boundary_alignment_basemap') || 'googleHybrid';
        if (savedBasemap === 'esriDark' || savedBasemap === 'esriLight' || savedBasemap === 'cartoPositron' || !this.baseLayers[savedBasemap]) {
            savedBasemap = 'googleHybrid';
            try { localStorage.setItem('boundary_alignment_basemap', 'googleHybrid'); } catch (e) {}
        }
        this.currentBasemapKey = savedBasemap;
        this.currentBaseLayer = this.baseLayers[this.currentBasemapKey];
        this.currentBaseLayer.addTo(this.map);

        // Sync dropdown if DOM already has it
        const select = document.getElementById('select-basemap');
        if (select) {
            select.value = this.currentBasemapKey;
        }

        this.map.on('click', (e) => this.onMapClick(e));
        this.map.on('mousemove', (e) => this.onMapMouseMove(e));
    },

    initLayerGroups: function() {
        this.layerGroups.ref = L.layerGroup().addTo(this.map);
        this.layerGroups.target = L.layerGroup().addTo(this.map);
        this.layerGroups.preview = L.layerGroup().addTo(this.map);
        this.layerGroups.snap = L.layerGroup().addTo(this.map);
        this.layerGroups.intersections = L.layerGroup().addTo(this.map);
    },

    setBasemap: function(key) {
        if (!this.baseLayers[key]) {
            key = 'googleHybrid';
        }
        if (this.currentBaseLayer) this.map.removeLayer(this.currentBaseLayer);
        this.currentBasemapKey = key;
        this.currentBaseLayer = this.baseLayers[key];
        this.currentBaseLayer.addTo(this.map);

        // Persist basemap choice independently in localStorage
        try {
            localStorage.setItem('boundary_alignment_basemap', key);
        } catch (e) {
            console.warn("Could not save basemap to localStorage", e);
        }

        // Sync dropdown element
        const select = document.getElementById('select-basemap');
        if (select && select.value !== key) {
            select.value = key;
        }

        // Sync loupe basemap
        if (this.loupeMap) {
            if (this.loupeBaseLayer) this.loupeMap.removeLayer(this.loupeBaseLayer);
            this.loupeBaseLayer = L.tileLayer(this.baseLayers[key]._url, {
                maxZoom: 22,
                maxNativeZoom: this.baseLayers[key].options.maxNativeZoom || 20
            }).addTo(this.loupeMap);
        }
    },

    // =========================================================================
    // PERSISTENCE (LocalStorage + IndexedDB across refresh)
    // =========================================================================
    openDB: function() {
        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(null);
            try {
                const req = indexedDB.open('BoundaryStudioDB', 1);
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('sessions')) {
                        db.createObjectStore('sessions');
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },

    saveToIndexedDB: async function(state) {
        try {
            const db = await this.openDB();
            if (!db) return;
            const tx = db.transaction('sessions', 'readwrite');
            const store = tx.objectStore('sessions');
            store.put(state, 'current_session');
        } catch (e) {
            console.warn("IndexedDB save error", e);
        }
    },

    loadFromIndexedDB: async function() {
        try {
            const db = await this.openDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction('sessions', 'readonly');
                const store = tx.objectStore('sessions');
                const req = store.get('current_session');
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    },

    saveToStorage: function() {
        // Prevent saving if no files are loaded
        if (!this.refData && !this.targetData && (!this.adjustedLayers || this.adjustedLayers.length === 0)) {
            return;
        }

        const state = {
            refData: this.refData,
            refName: this.refName,
            refVisible: this.refVisible,
            refColor: this.refColor,

            targetData: this.targetData,
            targetName: this.targetName,
            targetVisible: this.targetVisible,
            targetColor: this.targetColor,

            hasInterchangedSinceLastEdit: this.hasInterchangedSinceLastEdit,
            adjustedLayers: this.adjustedLayers
        };

        // 1. Try saving to localStorage only if payload is < 2.5 MB to avoid freezing main thread on state boundaries
        try {
            const jsonStr = JSON.stringify(state);
            if (jsonStr.length < 2500000) {
                localStorage.setItem(this.STORAGE_KEY, jsonStr);
            } else {
                localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (e) {
            console.warn("localStorage quota exceeded or skipped for large dataset; saved via IndexedDB...", e);
        }

        // 2. Always save to IndexedDB (asynchronous, non-blocking, handles 500MB+)
        this.saveToIndexedDB(state);
    },

    loadFromStorage: async function() {
        let state = null;

        // 1. Check localStorage first
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                state = JSON.parse(raw);
            }
        } catch (e) {
            console.warn("localStorage parse error, will try IndexedDB", e);
        }

        // 2. If nothing in localStorage or incomplete, check IndexedDB
        if (!state || (!state.refData && !state.targetData)) {
            const idbState = await this.loadFromIndexedDB();
            if (idbState && (idbState.refData || idbState.targetData)) {
                state = idbState;
            }
        }

        if (!state) return false;

        if (state.refData) this.refData = FileHandler.standardizeGeoJSON(state.refData, state.refName || "Reference");
        if (state.refName) this.refName = state.refName;
        if (typeof state.refVisible === 'boolean') this.refVisible = state.refVisible;
        if (state.refColor) this.refColor = state.refColor;

        if (state.targetData) this.targetData = FileHandler.standardizeGeoJSON(state.targetData, state.targetName || "Target");
        if (state.targetName) this.targetName = state.targetName;
        if (typeof state.targetVisible === 'boolean') this.targetVisible = state.targetVisible;
        if (state.targetColor) this.targetColor = state.targetColor;

        this.hasInterchangedSinceLastEdit = !!state.hasInterchangedSinceLastEdit;

        if (Array.isArray(state.adjustedLayers)) {
            this.adjustedLayers = state.adjustedLayers.map(layer => {
                if (layer.data) {
                    layer.data = FileHandler.standardizeGeoJSON(layer.data, layer.name);
                }
                return layer;
            });
        }

        this.updateHeaderBadges();
        return !!(this.refData || this.targetData);
    },

    clearAllData: async function() {
        if (!confirm("Start fresh? This will remove loaded layers and all adjustments.")) return;

        localStorage.removeItem(this.STORAGE_KEY);
        try {
            const db = await this.openDB();
            if (db) {
                const tx = db.transaction('sessions', 'readwrite');
                tx.objectStore('sessions').delete('current_session');
            }
        } catch (e) {}

        this.refData = null;
        this.refName = "Reference Layer";
        this.targetData = null;
        this.targetName = "Target Layer";
        this.adjustedLayers = [];
        this.hasInterchangedSinceLastEdit = false;

        this.layerGroups.ref.clearLayers();
        this.layerGroups.target.clearLayers();
        this.layerGroups.preview.clearLayers();

        Object.values(this.layerGroups.adjustedMap).forEach(lg => {
            this.map.removeLayer(lg);
        });
        this.layerGroups.adjustedMap = {};

        this.clearPoints();
        this.updateHeaderBadges();
        this.updateStep3UI();
        this.showToast("All layers cleared. You can load new files now.", "info");
    },

    // =========================================================================
    // LAYER INGESTION & ROLES
    // =========================================================================
    setReferenceData: function(fc, name) {
        this.refData = fc;
        this.refName = name || "Reference Layer";
        this.refVisible = true;

        GeometryAligner.clearCache();
        this.computeIntersections();

        this.updateHeaderBadges();
        this.renderRefLayer();
        this.updateStep3UI();
        this.fitBoundsIfReady();
        this.saveToStorage();
        this.showToast(`Reference layer "${this.refName}" loaded.`, 'success');
    },

    setTargetData: function(fc, name) {
        this.targetData = JSON.parse(JSON.stringify(fc));
        this.targetName = name || "Target Layer";
        this.targetVisible = true;

        GeometryAligner.clearCache();
        this.computeIntersections();

        this.updateHeaderBadges();
        this.renderTargetLayer();
        this.updateStep3UI();
        this.fitBoundsIfReady();
        this.saveToStorage();
        this.showToast(`Target layer "${this.targetName}" loaded.`, 'success');
    },

    updateHeaderBadges: function() {
        const refEl = document.getElementById('badge-ref-info');
        if (refEl) {
            refEl.textContent = this.refData 
                ? `${this.refName} (${this.refData.features.length} features)`
                : "No file loaded yet";
        }

        const targetEl = document.getElementById('badge-target-info');
        if (targetEl) {
            targetEl.textContent = this.targetData 
                ? `${this.targetName} (${this.targetData.features.length} features)`
                : "No file loaded yet";
        }
    },

    fitBoundsIfReady: function() {
        const fc = this.targetData || this.refData;
        if (fc && fc.features && fc.features.length > 0) {
            try {
                const bbox = turf.bbox(fc);
                this.map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [50, 50] });
            } catch (e) {}
        }
    },

    // =========================================================================
    // INTERCHANGE / SWAP ROLES
    // =========================================================================
    swapRoles: function() {
        if (!this.refData || !this.targetData) {
            this.showToast("Please load both Reference and Target layers before swapping.", "warning");
            return;
        }

        // Swap Reference and Target in memory
        const tempFC = this.refData;
        const tempName = this.refName;

        this.refData = this.targetData;
        this.refName = this.targetName;

        this.targetData = tempFC;
        this.targetName = tempName;

        // Mark that user has interchanged roles!
        // Next adjustment will create a new separate 2nd Adjusted Layer instead of modifying layer 1!
        this.hasInterchangedSinceLastEdit = true;

        GeometryAligner.clearCache();
        this.computeIntersections();

        this.updateHeaderBadges();
        this.renderRefLayer();
        this.renderTargetLayer();
        this.updateStep3UI();
        this.clearPoints();
        this.saveToStorage();

        this.showToast(`⇄ Interchanged! Now "${this.refName}" is Reference (Green), and "${this.targetName}" is Target (Red).`, "info");
    },

    // =========================================================================
    // RENDERING: REFERENCE & TARGET
    // =========================================================================
    renderRefLayer: function() {
        this.layerGroups.ref.clearLayers();
        if (!this.refData || !this.refVisible) return;

        const l = L.geoJSON(this.refData, {
            renderer: this.canvasRenderer,
            style: {
                color: this.refColor,
                weight: 4,
                opacity: 0.95,
                fillColor: this.refColor,
                fillOpacity: 0.05,
                lineCap: 'round',
                lineJoin: 'round'
            },
            onEachFeature: (f, layer) => {
                const name = f.properties && (f.properties.name || f.properties.NAME || "Reference Boundary");
                layer.bindTooltip(`<strong>${name}</strong><br><span style="color:${this.refColor};font-weight:bold;">Reference (Master Line)</span>`);
            }
        });
        this.layerGroups.ref.addLayer(l);
        this.syncLoupeLayers();
        this.renderIntersections();
    },

    renderTargetLayer: function() {
        this.layerGroups.target.clearLayers();
        if (!this.targetData || !this.targetVisible) {
            this.renderIntersections();
            return;
        }

        const l = L.geoJSON(this.targetData, {
            renderer: this.canvasRenderer,
            style: {
                color: this.targetColor,
                weight: 3.5,
                opacity: 0.85,
                dashArray: '5, 5',
                fillColor: this.targetColor,
                fillOpacity: 0.03,
                lineCap: 'round',
                lineJoin: 'round'
            },
            onEachFeature: (f, layer) => {
                const name = f.properties && (f.properties.name || f.properties.NAME || "Target Boundary");
                layer.bindTooltip(`<strong>${name}</strong><br><span style="color:${this.targetColor};font-weight:bold;">Original Target (Old Line)</span>`);
            }
        });
        this.layerGroups.target.addLayer(l);
        this.syncLoupeLayers();
        this.renderIntersections();
    },

    computeIntersections: function() {
        if (!this.refData || !this.targetData) {
            this.cachedIntersections = [];
            return;
        }

        try {
            const inters = [];
            const tFeatures = this.targetData.features || [];
            const rFeatures = this.refData.features || [];

            tFeatures.forEach(tf => {
                const tRingInfo = GeometryAligner.getExteriorRing(tf);
                if (!tRingInfo || !tRingInfo.ring) return;
                rFeatures.forEach(rf => {
                    const rRingInfo = GeometryAligner.getExteriorRing(rf);
                    if (!rRingInfo || !rRingInfo.ring) return;
                    const found = GeometryAligner.getIntersections(tRingInfo.ring, rRingInfo.ring);
                    found.forEach(ipt => {
                        if (!inters.some(p => GeometryAligner.distanceMeters(p, ipt) < 1.0)) {
                            inters.push(ipt);
                        }
                    });
                });
            });
            this.cachedIntersections = inters;
        } catch (e) {
            console.warn("Intersection compute error:", e);
            this.cachedIntersections = [];
        }
    },

    renderIntersections: function() {
        if (!this.layerGroups.intersections) return;
        this.layerGroups.intersections.clearLayers();
        if (!this.refData || !this.targetData || !this.refVisible || !this.targetVisible) return;

        if (!this.cachedIntersections) {
            this.computeIntersections();
        }

        const inters = this.cachedIntersections || [];
        const isDense = inters.length > 50;

        inters.forEach((ipt, idx) => {
            if (isDense) {
                // High-performance canvas circle marker for dense intersections (state boundaries)
                const marker = L.circleMarker([ipt[1], ipt[0]], {
                    renderer: this.canvasRenderer,
                    radius: 5,
                    color: '#38bdf8',
                    weight: 2,
                    fillColor: '#0284c7',
                    fillOpacity: 0.95
                });
                marker.bindTooltip(`<strong>Intersection ✕</strong><br><span style="color:#38bdf8;font-size:11px;">Click to lock Point ${this.activeTool === 'pickB' ? 'B' : 'A'} (0.0 m exact)</span>`);
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.handleIntersectionClick(ipt);
                });
                this.layerGroups.intersections.addLayer(marker);
            } else {
                const icon = L.divIcon({
                    className: 'intersection-node',
                    html: `<div style="background:#0284c7;color:#ffffff;font-weight:900;font-size:11px;border:2px solid #38bdf8;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(56,189,248,0.8);cursor:pointer;" title="Boundary Intersection (Click to lock as Point A / B)">✕</div>`,
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                const marker = L.marker([ipt[1], ipt[0]], { icon: icon, zIndexOffset: 1000 });
                marker.bindTooltip(`<strong>Intersection ✕</strong><br><span style="color:#38bdf8;font-size:11px;">Click to lock Point ${this.activeTool === 'pickB' ? 'B' : 'A'} (0.0 m exact)</span>`);
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.handleIntersectionClick(ipt);
                });
                this.layerGroups.intersections.addLayer(marker);
            }
        });
    },

    handleIntersectionClick: function(ipt) {
        if (this.activeTool === 'pickA') {
            this.setPointA(ipt);
            this.setTool('pickB');
            this.showToast("✓ Point A locked to exact Intersection (0.0 m)! Now pick Point B.", "info");
        } else if (this.activeTool === 'pickB') {
            this.setPointB(ipt);
            this.setTool('none');
            this.showToast("✓ Point B locked to exact Intersection (0.0 m)! Ready to align.", "success");
        } else {
            if (!this.pointA) {
                this.setPointA(ipt);
                this.setTool('pickB');
                this.showToast("✓ Point A locked to Intersection! Now click next intersection or line for Point B.", "info");
            } else if (!this.pointB) {
                this.setPointB(ipt);
                this.setTool('none');
                this.showToast("✓ Point B locked to Intersection! Ready to align.", "success");
            } else {
                this.setPointA(ipt);
                this.setTool('pickB');
                this.showToast("✓ Point A reset to Intersection! Now pick Point B.", "info");
            }
        }
    },

    // =========================================================================
    // RENDERING: ADJUSTED LAYERS (1, 2, ...)
    // =========================================================================
    renderAdjustedLayer: function(layerObj) {
        if (!this.layerGroups.adjustedMap[layerObj.id]) {
            this.layerGroups.adjustedMap[layerObj.id] = L.layerGroup().addTo(this.map);
        }
        const lg = this.layerGroups.adjustedMap[layerObj.id];
        lg.clearLayers();

        if (!layerObj.visible || !layerObj.data) return;

        const l = L.geoJSON(layerObj.data, {
            renderer: this.canvasRenderer,
            style: {
                color: layerObj.color,
                weight: 4,
                opacity: 0.95,
                fillColor: layerObj.color,
                fillOpacity: 0.12,
                lineCap: 'round',
                lineJoin: 'round'
            },
            onEachFeature: (f, layer) => {
                const name = f.properties && (f.properties.name || f.properties.NAME || layerObj.name);
                layer.bindTooltip(`<strong>${name}</strong><br><span style="color:${layerObj.color};font-weight:bold;">${layerObj.name} (100% Coincident)</span>`);
            }
        });
        lg.addLayer(l);
    },

    renderAllAdjustedLayers: function() {
        this.adjustedLayers.forEach(l => this.renderAdjustedLayer(l));
    },

    // =========================================================================
    // PRECISION LOUPE HUD (TOP-RIGHT ZOOM VIEWPORT)
    // =========================================================================
    initLoupeMap: function() {
        const loupeEl = document.getElementById('loupe-map');
        if (!loupeEl || this.loupeMap) return;

        try {
            this.loupeMap = L.map('loupe-map', {
                center: [10.05, 77.58],
                zoom: 19,
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                touchZoom: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false
            });

            this.loupeBaseLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 22 }).addTo(this.loupeMap);
            this.loupeRefGroup = L.layerGroup().addTo(this.loupeMap);
            this.loupeTargetGroup = L.layerGroup().addTo(this.loupeMap);
            this.loupeCursorGroup = L.layerGroup().addTo(this.loupeMap);
            this.syncLoupeLayers();
        } catch (e) {
            console.warn("Loupe init warning:", e);
        }
    },

    syncLoupeLayers: function() {
        if (!this.loupeMap) return;
        if (this.loupeRefGroup) {
            this.loupeRefGroup.clearLayers();
            if (this.refData && this.refVisible) {
                this.loupeRefGroup.addLayer(L.geoJSON(this.refData, {
                    style: { color: this.refColor, weight: 4, opacity: 0.95 }
                }));
            }
        }
        if (this.loupeTargetGroup) {
            this.loupeTargetGroup.clearLayers();
            if (this.targetData && this.targetVisible) {
                this.loupeTargetGroup.addLayer(L.geoJSON(this.targetData, {
                    style: { color: this.targetColor, weight: 3.5, opacity: 0.9, dashArray: '4, 4' }
                }));
            }
        }
    },

    updateLoupeHUD: function(centerPt, isSnapped, distMeters, label, color) {
        const hud = document.getElementById('precision-loupe-hud');
        if (!hud) return;

        if (!this.loupeMap) {
            this.initLoupeMap();
        }

        if (this.loupeMap && centerPt) {
            const currentMainZoom = this.map ? this.map.getZoom() : 16;
            const loupeZoom = Math.min(21, Math.max(currentMainZoom + 3, 19));
            this.loupeMap.setView([centerPt[1], centerPt[0]], loupeZoom, { animate: false });
            this.loupeMap.invalidateSize();
        }

        const coordsEl = document.getElementById('loupe-coords');
        const distEl = document.getElementById('loupe-distance');
        const statusEl = document.getElementById('loupe-snap-status');

        if (coordsEl && centerPt) {
            coordsEl.textContent = `${centerPt[1].toFixed(5)}, ${centerPt[0].toFixed(5)}`;
        }

        if (statusEl) {
            if (isSnapped) {
                statusEl.textContent = label || "Snapped";
                if (label && label.includes('Intersection')) {
                    statusEl.className = "text-[9.5px] font-bold px-2 py-0.5 rounded bg-cyan-500/25 text-cyan-300 border border-cyan-400/40";
                } else if (label && label.includes('Reference')) {
                    statusEl.className = "text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-400/40";
                } else {
                    statusEl.className = "text-[9.5px] font-bold px-2 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-400/40";
                }
            } else {
                statusEl.textContent = "Seeking Boundary / Intersection...";
                statusEl.className = "text-[9.5px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30";
            }
        }

        if (distEl) {
            if (isSnapped) {
                distEl.textContent = `0.0 m (Locked)`;
                distEl.className = "text-emerald-400 font-bold shrink-0";
            } else {
                distEl.textContent = `${distMeters.toFixed(1)} m away`;
                distEl.className = "text-amber-400 font-bold shrink-0";
            }
        }
    },

    // =========================================================================
    // POINT PICKING (ALLOWS INTERSECTION, TARGET RED, AND REFERENCE GREEN)
    // =========================================================================
    setTool: function(tool) {
        this.activeTool = tool;

        document.getElementById('btn-pick-a')?.classList.toggle('ring-2', tool === 'pickA');
        document.getElementById('btn-pick-a')?.classList.toggle('ring-amber-400', tool === 'pickA');
        document.getElementById('btn-pick-b')?.classList.toggle('ring-2', tool === 'pickB');
        document.getElementById('btn-pick-b')?.classList.toggle('ring-amber-400', tool === 'pickB');

        const mapEl = document.getElementById('map');
        const hud = document.getElementById('precision-loupe-hud');

        if (tool === 'pickA' || tool === 'pickB') {
            mapEl.style.cursor = 'crosshair';
            hud?.classList.add('active');
            this.initLoupeMap();
            this.syncLoupeLayers();
            const targetLetter = tool === 'pickA' ? 'A' : 'B';
            this.showToast(`Click on the Target line (Red) or an Intersection (✕) to place Point ${targetLetter}.`, "info");

            // On mobile, auto-collapse sidebar so full map is visible for picking
            if (window.innerWidth < 768) {
                this.toggleSidebar(false);
            }
        } else {
            mapEl.style.cursor = '';
            hud?.classList.remove('active');
            this.hoverValidTargetPoint = null;
            this.hoverNearestRefPoint = null;
            if (this.layerGroups.snap) this.layerGroups.snap.clearLayers();
        }
    },

    getClosestRing: function(fc, pt) {
        if (!fc || !fc.features || fc.features.length === 0) return null;
        let bestRing = null;
        let minD = Infinity;
        for (let i = 0; i < fc.features.length; i++) {
            const rInfo = GeometryAligner.getExteriorRing(fc.features[i], pt);
            if (rInfo && rInfo.ring) {
                const snap = GeometryAligner.snapToRing(rInfo.ring, pt, 2000);
                if (snap && snap.distMeters < minD) {
                    minD = snap.distMeters;
                    bestRing = rInfo.ring;
                }
            }
        }
        return bestRing;
    },

    onMapMouseMove: function(e) {
        if (this.activeTool !== 'pickA' && this.activeTool !== 'pickB') {
            if (this.layerGroups.snap) this.layerGroups.snap.clearLayers();
            return;
        }

        const lng = e.latlng.lng;
        const lat = e.latlng.lat;

        // Drop redundant mouse events while frame is rendering
        if (this._mouseMoveRaf) return;

        this._mouseMoveRaf = requestAnimationFrame(() => {
            this._mouseMoveRaf = null;
            this.handleMouseMoveThrottled(lng, lat);
        });
    },

    handleMouseMoveThrottled: function(lng, lat) {
        const cursorPt = [lng, lat];

        // Exterior rings for target and reference across all features
        const tRing = this.getClosestRing(this.targetData, cursorPt);
        const rRing = this.getClosestRing(this.refData, cursorPt);

        // Snap strictly to Intersection (✕) or Target line (Red). Reference line alone is restricted!
        const snap = GeometryAligner.snapToAnyBoundary(tRing, rRing, cursorPt, 50, this.cachedIntersections);

        const mapEl = document.getElementById('map');

        if (snap) {
            this.hoverValidTargetPoint = snap.point;
            mapEl.style.cursor = 'crosshair';

            this.renderSnapIndicator(snap.point, snap.color, snap.label, this.activeTool === 'pickA' ? 'A' : 'B');
            this.updateLoupeHUD(snap.point, true, snap.distMeters, snap.label, snap.color);
        } else {
            this.hoverValidTargetPoint = null;
            mapEl.style.cursor = (this.activeTool === 'pickA' || this.activeTool === 'pickB') ? 'not-allowed' : 'default';
            if (this.layerGroups.snap) this.layerGroups.snap.clearLayers();
            this.updateLoupeHUD(cursorPt, false, 99.9, null, null);
        }
    },

    renderSnapIndicator: function(pt, color, label, letter) {
        if (!this.layerGroups.snap) return;
        this.layerGroups.snap.clearLayers();

        // 1. Draw 50-meter precision circle ring on the map
        const snapCircle = L.circle([pt[1], pt[0]], {
            radius: 50,
            color: color || '#38bdf8',
            weight: 1.5,
            dashArray: '3, 4',
            fillColor: color || '#38bdf8',
            fillOpacity: 0.08,
            interactive: false
        });
        this.layerGroups.snap.addLayer(snapCircle);

        // 2. Hairline uncolored crosshair marker directly on the snap point
        const crosshairSvg = `
            <div class="precision-crosshair-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" style="filter: drop-shadow(0 0 2px rgba(0,0,0,0.9));">
                    <circle cx="11" cy="11" r="3" fill="none" stroke="${color || '#ffffff'}" stroke-width="1.5"/>
                    <line x1="11" y1="0" x2="11" y2="7" stroke="${color || '#ffffff'}" stroke-width="1.5"/>
                    <line x1="11" y1="15" x2="11" y2="22" stroke="${color || '#ffffff'}" stroke-width="1.5"/>
                    <line x1="0" y1="11" x2="7" y2="11" stroke="${color || '#ffffff'}" stroke-width="1.5"/>
                    <line x1="15" y1="11" x2="22" y2="11" stroke="${color || '#ffffff'}" stroke-width="1.5"/>
                </svg>
            </div>`;

        const crosshairIcon = L.divIcon({
            className: 'custom-crosshair-marker',
            html: crosshairSvg,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        const snapMarker = L.marker([pt[1], pt[0]], { icon: crosshairIcon, interactive: false });
        this.layerGroups.snap.addLayer(snapMarker);
    },

    onMapClick: function(e) {
        if (this.activeTool !== 'pickA' && this.activeTool !== 'pickB') return;

        let pickedPoint = this.hoverValidTargetPoint;

        // If not pre-cached on hover, calculate directly from click coordinate
        if (!pickedPoint) {
            const cursorPt = [e.latlng.lng, e.latlng.lat];
            const tRing = this.getClosestRing(this.targetData, cursorPt);
            const rRing = this.getClosestRing(this.refData, cursorPt);
            const snap = GeometryAligner.snapToAnyBoundary(tRing, rRing, cursorPt, 50, this.cachedIntersections);
            if (snap) {
                pickedPoint = snap.point;
            }
        }

        if (!pickedPoint) {
            this.showToast("Please click on the Target line (Red) or at an Intersection (✕). Reference line alone is restricted.", "warning");
            return;
        }

        if (this.activeTool === 'pickA') {
            this.setPointA(pickedPoint);
            this.showToast("✓ Point A set! Now click Point B on the target line or intersection.", "info");
            this.setTool('pickB'); // Auto switch to B
        } else if (this.activeTool === 'pickB') {
            this.setPointB(pickedPoint);
            this.showToast("✓ Point B set! Ready to align.", "success");
            this.setTool('none');
            // If on mobile, expand the sidebar drawer back so user can tap 'Make Red Follow Green'
            if (window.innerWidth < 768) {
                this.toggleSidebar(true);
            }
        }
    },

    setPointA: function(pointOnTarget) {
        if (!this.targetData || !this.refData) {
            this.showToast("Please load both layers first.", "warning");
            return;
        }

        this.pointA = pointOnTarget;

        document.getElementById('text-point-a').textContent = `Point A: ${this.pointA[1].toFixed(4)}, ${this.pointA[0].toFixed(4)}`;
        document.getElementById('card-point-a')?.classList.add('border-emerald-500');

        this.updatePreviewMarkers();
        this.checkCanAlign();
    },

    setPointB: function(pointOnTarget) {
        if (!this.targetData || !this.refData) return;

        this.pointB = pointOnTarget;

        document.getElementById('text-point-b').textContent = `Point B: ${this.pointB[1].toFixed(4)}, ${this.pointB[0].toFixed(4)}`;
        document.getElementById('card-point-b')?.classList.add('border-rose-500');

        this.updatePreviewMarkers();
        this.checkCanAlign();
    },

    clearPointA: function() {
        this.pointA = null;
        document.getElementById('text-point-a').textContent = "Point A: Not Set";
        document.getElementById('card-point-a')?.classList.remove('border-emerald-500');
        this.updatePreviewMarkers();
        this.checkCanAlign();
        this.showToast("Point A removed. Click 'Pick Point A' to set again.", "info");
    },

    clearPointB: function() {
        this.pointB = null;
        document.getElementById('text-point-b').textContent = "Point B: Not Set";
        document.getElementById('card-point-b')?.classList.remove('border-rose-500');
        this.updatePreviewMarkers();
        this.checkCanAlign();
        this.showToast("Point B removed. Click 'Pick Point B' to set again.", "info");
    },

    clearPoints: function() {
        this.pointA = null;
        this.pointB = null;
        this.setTool('none');

        document.getElementById('text-point-a').textContent = "Point A: Not Set";
        document.getElementById('text-point-b').textContent = "Point B: Not Set";
        document.getElementById('card-point-a')?.classList.remove('border-emerald-500');
        document.getElementById('card-point-b')?.classList.remove('border-rose-500');

        this.checkCanAlign();
        this.layerGroups.preview.clearLayers();
        if (this.layerGroups.snap) this.layerGroups.snap.clearLayers();
        this.showToast("Both points removed.", "info");
    },

    checkCanAlign: function() {
        const btnAlign = document.getElementById('btn-apply-align');
        if (!btnAlign) return;
        const canAlign = !!(this.pointA && this.pointB);
        btnAlign.disabled = !canAlign;
        if (canAlign) {
            btnAlign.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btnAlign.classList.add('opacity-50', 'cursor-not-allowed');
        }
    },

    updatePreviewMarkers: function() {
        this.layerGroups.preview.clearLayers();

        // Marker for Point A directly on Target (Red line)
        if (this.pointA) {
            const iconA = L.divIcon({
                className: 'custom-pin',
                html: '<div style="background:#10b981;color:#fff;font-weight:900;font-size:12px;border:2.5px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.7);">A</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            L.marker([this.pointA[1], this.pointA[0]], { icon: iconA }).addTo(this.layerGroups.preview);
        }

        // Marker for Point B directly on Target (Red line)
        if (this.pointB) {
            const iconB = L.divIcon({
                className: 'custom-pin',
                html: '<div style="background:#ef4444;color:#fff;font-weight:900;font-size:12px;border:2.5px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.7);">B</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            L.marker([this.pointB[1], this.pointB[0]], { icon: iconB }).addTo(this.layerGroups.preview);
        }

        // LIVE CUT PREVIEW: If both A and B are set, highlight the exact segments!
        if (this.pointA && this.pointB && this.targetData && this.refData) {
            try {
                let targetFeat = this.targetData.features[0];
                let minT = Infinity;
                (this.targetData.features || []).forEach(f => {
                    const r = GeometryAligner.getExteriorRing(f, this.pointA);
                    if (r && r.ring) {
                        const s = GeometryAligner.snapToRing(r.ring, this.pointA);
                        if (s && s.distMeters < minT) { minT = s.distMeters; targetFeat = f; }
                    }
                });

                let refFeat = this.refData.features[0];
                let minR = Infinity;
                (this.refData.features || []).forEach(f => {
                    const r = GeometryAligner.getExteriorRing(f, this.pointA);
                    if (r && r.ring) {
                        const s = GeometryAligner.snapToRing(r.ring, this.pointA);
                        if (s && s.distMeters < minR) { minR = s.distMeters; refFeat = f; }
                    }
                });

                const previewData = GeometryAligner.getAlignmentSegments(
                    targetFeat,
                    refFeat,
                    this.pointA,
                    this.pointB
                );

                if (previewData && previewData.replacedSegment && previewData.insertedSegment) {
                    // Replaced Segment on Target (Yellow highlight)
                    L.polyline(previewData.replacedSegment.map(p => [p[1], p[0]]), {
                        renderer: this.canvasRenderer,
                        color: '#facc15',
                        weight: 6,
                        opacity: 0.65,
                        dashArray: '8, 8'
                    }).bindTooltip("Target Section Being Replaced (Cut)").addTo(this.layerGroups.preview);

                    // Inserted Segment from Reference (Cyan highlight)
                    L.polyline(previewData.insertedSegment.map(p => [p[1], p[0]]), {
                        renderer: this.canvasRenderer,
                        color: '#38bdf8',
                        weight: 4,
                        opacity: 0.95
                    }).bindTooltip("Reference Boundary Following Exactly (Stitched)").addTo(this.layerGroups.preview);
                }
            } catch (e) {
                console.warn("Cut preview could not be computed:", e);
            }
        }
    },

    // =========================================================================
    // 1-CLICK ACTION: MAKE RED FOLLOW GREEN 100%
    // Creates a new Adjusted Layer if interchanged; keeps it OFF initially
    // =========================================================================
    applyPointToPointAlign: function() {
        if (!this.pointA || !this.pointB) {
            this.showToast("Set both Point A and Point B on map first.", "warning");
            return;
        }

        if (!this.targetData || !this.refData) return;

        // Choose source feature: if there's already an active adjusted layer for this target, use its geometry, else targetData
        let sourceFC = this.targetData;
        const existingForThisTarget = this.adjustedLayers.find(l => l.sourceTargetName === this.targetName);

        // If user edited before without swapping roles, continue editing that layer
        // BUT if user interchanged roles (hasInterchangedSinceLastEdit = true), start a BRAND NEW layer!
        let targetLayerObj = null;

        if (!this.hasInterchangedSinceLastEdit && existingForThisTarget) {
            targetLayerObj = existingForThisTarget;
            sourceFC = targetLayerObj.data;
        }

        // Clean and deduplicate sourceFC & refData
        sourceFC = FileHandler.standardizeGeoJSON(sourceFC, this.targetName);
        this.refData = FileHandler.standardizeGeoJSON(this.refData, this.refName);

        // Find the feature in sourceFC closest to pointA
        let targetIdx = 0;
        let minTargetDist = Infinity;
        sourceFC.features.forEach((feat, idx) => {
            const ringInfo = GeometryAligner.getExteriorRing(feat, this.pointA);
            if (ringInfo && ringInfo.ring) {
                const snap = GeometryAligner.snapToRing(ringInfo.ring, this.pointA);
                if (snap && snap.distMeters < minTargetDist) {
                    minTargetDist = snap.distMeters;
                    targetIdx = idx;
                }
            }
        });

        // Find the feature in refData closest to pointA
        let refIdx = 0;
        let minRefDist = Infinity;
        this.refData.features.forEach((feat, idx) => {
            const ringInfo = GeometryAligner.getExteriorRing(feat, this.pointA);
            if (ringInfo && ringInfo.ring) {
                const snap = GeometryAligner.snapToRing(ringInfo.ring, this.pointA);
                if (snap && snap.distMeters < minRefDist) {
                    minRefDist = snap.distMeters;
                    refIdx = idx;
                }
            }
        });

        const targetFeat = sourceFC.features[targetIdx];
        const refFeat = this.refData.features[refIdx];

        try {
            const result = GeometryAligner.replaceBoundarySegment(targetFeat, refFeat, this.pointA, this.pointB);

            // If only 1 feature exists, only output the aligned feature
            let updatedFeatures;
            if (sourceFC.features.length <= 1) {
                updatedFeatures = [result.updatedFeature];
            } else {
                updatedFeatures = sourceFC.features.map((f, i) => i === targetIdx ? result.updatedFeature : JSON.parse(JSON.stringify(f)));
            }

            const updatedFC = {
                type: "FeatureCollection",
                name: `Adjusted_${this.targetName}`,
                features: updatedFeatures
            };

            const defaultPalette = ['#0284c7', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6'];

            if (!targetLayerObj) {
                // CREATE A NEW ADJUSTED LAYER (Keeps old ones intact!)
                const layerIndex = this.adjustedLayers.length + 1;
                const chosenColor = defaultPalette[(layerIndex - 1) % defaultPalette.length];

                targetLayerObj = {
                    id: 'adj_' + Date.now(),
                    name: `Adjusted Layer #${layerIndex} (${this.targetName})`,
                    color: chosenColor,
                    // USER CONSTRAINT: "keep blue off when updated then user can on and see"
                    visible: false,
                    sourceTargetName: this.targetName,
                    data: updatedFC
                };
                this.adjustedLayers.push(targetLayerObj);
            } else {
                targetLayerObj.data = updatedFC;
                // If user re-edited, also keep it off or let user turn it on
                targetLayerObj.visible = false;
            }

            // Reset interchange flag until next interchange
            this.hasInterchangedSinceLastEdit = false;

            this.renderAdjustedLayer(targetLayerObj);
            this.updateStep3UI();
            this.clearPoints();
            this.saveToStorage();

            this.showToast(`✓ Snapped! "${targetLayerObj.name}" created (Kept OFF by default). Turn it ON in Step 3 to inspect!`, "success");

        } catch (err) {
            console.error("Alignment error:", err);
            this.showToast("Alignment failed: " + err.message, "error");
        }
    },

    // =========================================================================
    // STEP 3: DYNAMIC ON/OFF SWITCH UI (NO TICK BOXES)
    // =========================================================================
    updateStep3UI: function() {
        const container = document.getElementById('step3-layers-container');
        if (!container) return;

        let html = '';

        // 1. Reference Layer Switch (Green)
        html += `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${this.refColor};"></span>
                    <div class="min-w-0">
                        <span class="font-bold text-slate-200 block text-xs truncate">Reference (Master)</span>
                        <span class="text-[10px] text-slate-400 block truncate">${this.refData ? this.refName : 'Not loaded'}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <input type="color" value="${this.refColor}" onchange="App.changeLayerColor('ref', this.value)" class="w-5 h-5 rounded cursor-pointer p-0 bg-transparent border-0" title="Change Color">
                    <button type="button" onclick="App.toggleRefVisibility()" class="toggle-btn ${this.refVisible ? 'is-on' : 'is-off'}" style="${this.refVisible ? 'border-color:' + this.refColor + '; background:' + this.refColor + '20;' : ''}">
                        <span class="toggle-pill" style="${this.refVisible ? 'background:' + this.refColor + ';' : ''}">
                            <span class="toggle-dot" style="${this.refVisible ? 'transform:translateX(14px);' : ''}"></span>
                        </span>
                        <span class="toggle-label" style="${this.refVisible ? 'color:' + this.refColor + ';' : 'color:#94a3b8;'}">${this.refVisible ? 'ON' : 'OFF'}</span>
                    </button>
                </div>
            </div>
        `;

        // 2. Original Target Layer Switch (Red)
        html += `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${this.targetColor};"></span>
                    <div class="min-w-0">
                        <span class="font-bold text-slate-200 block text-xs truncate">Original Target (Old)</span>
                        <span class="text-[10px] text-slate-400 block truncate">${this.targetData ? this.targetName : 'Not loaded'}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <input type="color" value="${this.targetColor}" onchange="App.changeLayerColor('target', this.value)" class="w-5 h-5 rounded cursor-pointer p-0 bg-transparent border-0" title="Change Color">
                    <button type="button" onclick="App.toggleTargetVisibility()" class="toggle-btn ${this.targetVisible ? 'is-on' : 'is-off'}" style="${this.targetVisible ? 'border-color:' + this.targetColor + '; background:' + this.targetColor + '20;' : ''}">
                        <span class="toggle-pill" style="${this.targetVisible ? 'background:' + this.targetColor + ';' : ''}">
                            <span class="toggle-dot" style="${this.targetVisible ? 'transform:translateX(14px);' : ''}"></span>
                        </span>
                        <span class="toggle-label" style="${this.targetVisible ? 'color:' + this.targetColor + ';' : 'color:#94a3b8;'}">${this.targetVisible ? 'ON' : 'OFF'}</span>
                    </button>
                </div>
            </div>
        `;

        // 3. Adjusted Layers (Blue, Cyan, Purple, etc.)
        if (this.adjustedLayers.length === 0) {
            html += `
                <div class="p-2.5 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-center text-slate-500 text-[11px]">
                    No adjusted layers created yet.<br>Pick Points A & B above and click Adjust!
                </div>
            `;
        } else {
            this.adjustedLayers.forEach((adj, idx) => {
                const isOn = adj.visible;
                html += `
                    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${adj.color};"></span>
                            <div class="min-w-0">
                                <span class="font-bold text-slate-100 block text-xs truncate">${adj.name}</span>
                                <span class="text-[10px] block truncate" style="color:${adj.color};">100% Coincident</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <input type="color" value="${adj.color}" onchange="App.changeAdjustedColor('${adj.id}', this.value)" class="w-5 h-5 rounded cursor-pointer p-0 bg-transparent border-0" title="Change Color">
                            <button type="button" onclick="App.toggleAdjustedVisibility('${adj.id}')" class="toggle-btn ${isOn ? 'is-on' : 'is-off'}" style="${isOn ? 'border-color:' + adj.color + '; background:' + adj.color + '20;' : ''}">
                                <span class="toggle-pill" style="${isOn ? 'background:' + adj.color + ';' : ''}">
                                    <span class="toggle-dot" style="${isOn ? 'transform:translateX(14px);' : ''}"></span>
                                </span>
                                <span class="toggle-label" style="${isOn ? 'color:' + adj.color + ';' : 'color:#94a3b8;'}">${isOn ? 'ON' : 'OFF'}</span>
                            </button>
                            <button type="button" onclick="App.deleteAdjustedLayer('${adj.id}')" class="w-6 h-6 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 flex items-center justify-center text-[10px] transition" title="Delete this adjusted version">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    },

    toggleRefVisibility: function() {
        this.refVisible = !this.refVisible;
        this.renderRefLayer();
        this.updateStep3UI();
        this.saveToStorage();
    },

    toggleTargetVisibility: function() {
        this.targetVisible = !this.targetVisible;
        this.renderTargetLayer();
        this.updateStep3UI();
        this.saveToStorage();
    },

    toggleAdjustedVisibility: function(id) {
        const item = this.adjustedLayers.find(l => l.id === id);
        if (!item) return;

        item.visible = !item.visible;
        this.renderAdjustedLayer(item);
        this.updateStep3UI();
        this.saveToStorage();
    },

    changeLayerColor: function(layerKey, color) {
        if (layerKey === 'ref') {
            this.refColor = color;
            this.renderRefLayer();
        } else if (layerKey === 'target') {
            this.targetColor = color;
            this.renderTargetLayer();
        }
        this.updateStep3UI();
        this.saveToStorage();
    },

    changeAdjustedColor: function(id, color) {
        const item = this.adjustedLayers.find(l => l.id === id);
        if (!item) return;
        item.color = color;
        this.renderAdjustedLayer(item);
        this.updateStep3UI();
        this.saveToStorage();
    },

    deleteAdjustedLayer: function(id) {
        if (!confirm("Delete this adjusted layer?")) return;

        const lg = this.layerGroups.adjustedMap[id];
        if (lg) {
            this.map.removeLayer(lg);
            delete this.layerGroups.adjustedMap[id];
        }

        this.adjustedLayers = this.adjustedLayers.filter(l => l.id !== id);
        this.updateStep3UI();
        this.saveToStorage();
        this.showToast("Adjusted layer deleted.", "info");
    },

    // =========================================================================
    // MOBILE / DESKTOP SIDEBAR TOGGLE (GO IN & OUT)
    // =========================================================================
    toggleSidebar: function(forceState) {
        const sidebar = document.getElementById('workflow-sidebar');
        const floatingBtn = document.getElementById('btn-floating-open-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sidebar) return;

        const isCurrentlyOpen = !sidebar.classList.contains('-translate-x-[120%]') && !sidebar.classList.contains('hidden');
        const shouldOpen = (forceState !== undefined) ? forceState : !isCurrentlyOpen;

        if (shouldOpen) {
            sidebar.classList.remove('-translate-x-[120%]', 'opacity-0', 'pointer-events-none');
            sidebar.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
            if (floatingBtn) floatingBtn.classList.add('hidden');
            if (backdrop && window.innerWidth < 768) backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-[120%]', 'opacity-0', 'pointer-events-none');
            sidebar.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
            if (floatingBtn) floatingBtn.classList.remove('hidden');
            if (backdrop) backdrop.classList.add('hidden');
        }

        setTimeout(() => {
            if (this.map) this.map.invalidateSize();
        }, 320);
    },

    // =========================================================================
    // EXPORT
    // =========================================================================
    openExportModal: function() {
        if (this.adjustedLayers.length === 0) {
            this.showToast("No adjusted layer available to export. Adjust a boundary first!", "warning");
            return;
        }

        const modal = document.getElementById('modal-export');
        const selectLayer = document.getElementById('select-export-layer');

        if (selectLayer) {
            selectLayer.innerHTML = '';
            this.adjustedLayers.forEach((adj, idx) => {
                const opt = document.createElement('option');
                opt.value = adj.id;
                opt.textContent = `${adj.name}`;
                selectLayer.appendChild(opt);
            });
        }

        modal?.classList.remove('hidden');
    },

    closeExportModal: function() {
        document.getElementById('modal-export')?.classList.add('hidden');
    },

    executeExport: async function() {
        const selectLayer = document.getElementById('select-export-layer');
        const inputName = document.getElementById('input-export-filename');
        const formatSelect = document.querySelector('input[name="export-format"]:checked');

        const layerId = selectLayer ? selectLayer.value : (this.adjustedLayers[0] && this.adjustedLayers[0].id);
        const layerObj = this.adjustedLayers.find(l => l.id === layerId) || this.adjustedLayers[0];

        if (!layerObj) {
            this.showToast("No adjusted layer selected to export.", "error");
            return;
        }

        const filename = (inputName && inputName.value.trim()) ? inputName.value.trim() : layerObj.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        const format = formatSelect ? formatSelect.value : "kml";

        this.closeExportModal();
        this.showToast(`Exporting ${format.toUpperCase()} for "${filename}"...`, "info");

        try {
            await FileHandler.exportDataset(layerObj.data, format, filename);
            this.showToast(`Downloaded: ${filename}.${format === 'shp' ? 'zip' : format}`, "success");
        } catch (err) {
            console.error("Export error:", err);
            this.showToast("Export failed: " + err.message, "error");
        }
    },

    // =========================================================================
    // TOAST NOTIFICATIONS
    // =========================================================================
    showToast: function(msg, type = 'info') {
        const el = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        if (!el || !txt) return;

        txt.textContent = msg;
        el.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold transition-all duration-300 ${
            type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-300' :
            type === 'warning' ? 'bg-amber-950 border-amber-500 text-amber-300' :
            type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-300' :
            'bg-slate-900 border-slate-700 text-slate-200'
        }`;

        el.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
        clearTimeout(this._tTimer);
        this._tTimer = setTimeout(() => {
            el.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
        }, 3500);
    },

    initEventListeners: function() {
        document.getElementById('select-basemap')?.addEventListener('change', (e) => this.setBasemap(e.target.value));

        // File Uploads
        document.getElementById('input-file-ref')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                this.showToast(`Loading Reference file ${file.name}...`, "info");
                const parsed = await FileHandler.parseFile(file);
                this.setReferenceData(parsed.geojson, file.name);
            } catch (err) {
                this.showToast("Error loading file: " + err.message, "error");
            }
        });

        document.getElementById('input-file-target')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                this.showToast(`Loading Target file ${file.name}...`, "info");
                const parsed = await FileHandler.parseFile(file);
                this.setTargetData(parsed.geojson, file.name);
            } catch (err) {
                this.showToast("Error loading file: " + err.message, "error");
            }
        });
    }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
