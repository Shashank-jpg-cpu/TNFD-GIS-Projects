/**
 * Cartographic Engine for TNFD Forest Asset & Administrative Boundary Studio
 * Modeled exactly on Administrative Boundary Studio with full interactive cartography:
 * - Movable & Resizable Elements: Map, Title (Two-line), North Arrow, Seal & GIS Cell, Scale Bar, Legend, and Forest Assets
 * - Independent 0.3x - 3.5x size scaling sliders for all items
 * - Division Map & Range Map modes with optional Range boundaries, RF (green shade #2e7d32), and RL (brown shade #8d5524)
 * - 21 Authentic TNFD Forest Assets with colored symbol badges + normal black font (#111111) labels with white halo
 * - Dynamic inclusion of all placed assets & custom polygons in the boxed legend
 * - Interactive dragging of elements & placed assets on the canvas
 * - High-Resolution 300 DPI A4 PDF & PNG export (Landscape & Portrait)
 */

const CartoStudio = {
    sealImage: null,
    MAP_FONT: "'Rockwell', 'Rockwell Nova', 'Rokkitt', 'Arvo', serif",
    lastLegendItems: [],
    _imageCache: {},
    CUSTOM_ASSETS: [],

    addCustomAsset: function(asset) {
        if (!this.CUSTOM_ASSETS) this.CUSTOM_ASSETS = [];
        this.CUSTOM_ASSETS.push(asset);
    },

    deleteCustomAsset: function(assetId) {
        if (!this.CUSTOM_ASSETS) return false;
        const idx = this.CUSTOM_ASSETS.findIndex(a => a.id === assetId);
        if (idx !== -1) {
            this.CUSTOM_ASSETS.splice(idx, 1);
            return true;
        }
        return false;
    },

    getImage: function(url) {
        if (!url) return null;
        if (!this._imageCache[url]) {
            const img = new Image();
            img.src = url;
            this._imageCache[url] = img;
        }
        return this._imageCache[url];
    },
    sealImage: null,
    
    // Normalized layout element positions and default scales (identical to admin_boundary_studio)
    elements: {
        map: { offsetX: 0.0, offsetY: 0.0, scale: 1.0 },
        title: { x: 0.5, y: 0.065, scaleDept: 1.35, scaleSub: 0.95, scale: 1.0, align: 'center' },
        northArrow: { x: 0.93, y: 0.095, size: 85, scale: 1.15 },
        seal: { x: 0.045, y: 0.945, scale: 1.25 },
        scaleBar: { x: 0.44, y: 0.950, totalKm: 12, scale: 1.20 },
        legend: { x: 0.60, y: 0.60, scale: 1.15 },
        assets: { scale: 1.0 }
    },

    // 21 Authentic Forest Department Assets Registry
    FOREST_ASSETS: [
        { id: 'apc', name: 'Anti-Poaching Camp (APC)', icon: '⛺', color: '#15803d', bg: '#dcfce7', category: 'Protection' },
        { id: 'fire_tower', name: 'Fire Watch Tower', icon: '🗼', color: '#b91c1c', bg: '#fee2e2', category: 'Protection' },
        { id: 'watch_tower', name: 'Watch Tower / View Point', icon: '🔭', color: '#1d4ed8', bg: '#dbeafe', category: 'Monitoring' },
        { id: 'checkpost', name: 'Forest Checkpost', icon: '🚧', color: '#c2410c', bg: '#ffedd5', category: 'Protection' },
        { id: 'rfo_office', name: 'Range Forest Office (RFO)', icon: '🏛️', color: '#047857', bg: '#ccfbf1', category: 'Administration' },
        { id: 'beat_office', name: 'Forest Beat Station', icon: '🏠', color: '#0f766e', bg: '#e0f2fe', category: 'Administration' },
        { id: 'water_body', name: 'Water Body / Forest Lake / Tank', icon: '🏞️', color: '#0284c7', bg: '#bae6fd', category: 'Water Resources' },
        { id: 'water_hole', name: 'Animal Water Hole / Trough', icon: '💧', color: '#0ea5e9', bg: '#e0f2fe', category: 'Wildlife' },
        { id: 'check_dam', name: 'Check Dam / Percolation Pond', icon: '🌊', color: '#0c4a6e', bg: '#e0f2fe', category: 'Soil & Water' },
        { id: 'salt_lick', name: 'Salt Lick Location', icon: '🧂', color: '#b45309', bg: '#fef3c7', category: 'Wildlife' },
        { id: 'solar_borewell', name: 'Solar Powered Borewell', icon: '☀️', color: '#d97706', bg: '#fef9c3', category: 'Infrastructure' },
        { id: 'nursery', name: 'Forest Nursery', icon: '🌱', color: '#65a30d', bg: '#ecfccb', category: 'Plantation' },
        { id: 'timber_depot', name: 'Timber / Forest Depot', icon: '🪵', color: '#854d0e', bg: '#fef08a', category: 'Operations' },
        { id: 'ecotourism', name: 'Ecotourism / Interpretation Centre', icon: 'ℹ️', color: '#7e22ce', bg: '#f3e8ff', category: 'Tourism' },
        { id: 'tribal_village', name: 'Tribal Settlement / VFC Village', icon: '🛖', color: '#9a3412', bg: '#fed7aa', category: 'Community' },
        { id: 'rescue_centre', name: 'Animal Rescue Centre', icon: '🐾', color: '#dc2626', bg: '#ffe4e6', category: 'Wildlife' },
        { id: 'elephant_trench', name: 'Elephant Trench (CPT) Point', icon: '🐘', color: '#475569', bg: '#f1f5f9', category: 'Protection' },
        { id: 'solar_fence', name: 'Solar Power Fence Point', icon: '⚡', color: '#b45309', bg: '#fef3c7', category: 'Protection' },
        { id: 'weather_station', name: 'Weather Monitoring Station (AWS)', icon: '⛅', color: '#0369a1', bg: '#bae6fd', category: 'Monitoring' },
        { id: 'patrol_camp', name: 'Patrol Camp Shed', icon: '🏕️', color: '#166534', bg: '#bbf7d0', category: 'Protection' },
        { id: 'camera_trap', name: 'Wildlife Camera Trap', icon: '📷', color: '#334155', bg: '#cbd5e1', category: 'Monitoring' }
    ],

    getAssetMeta: function(assetId) {
        const found = this.FOREST_ASSETS.find(a => a.id === assetId) || (this.CUSTOM_ASSETS && this.CUSTOM_ASSETS.find(a => a.id === assetId));
        return found || this.FOREST_ASSETS[0];
    },

    PALETTES: {
        divisions: [
            { fill: "rgba(254, 240, 138, 0.50)", stroke: "#b45309", hex: "#fef08a" },
            { fill: "rgba(187, 247, 208, 0.50)", stroke: "#15803d", hex: "#bbf7d0" },
            { fill: "rgba(191, 219, 254, 0.50)", stroke: "#1d4ed8", hex: "#bfdbfe" },
            { fill: "rgba(254, 215, 170, 0.50)", stroke: "#c2410c", hex: "#fed7aa" },
            { fill: "rgba(233, 213, 255, 0.50)", stroke: "#7e22ce", hex: "#e9d5ff" },
            { fill: "rgba(204, 251, 241, 0.50)", stroke: "#0f766e", hex: "#ccfbf1" },
            { fill: "rgba(254, 202, 202, 0.50)", stroke: "#b91c1c", hex: "#fecaca" },
            { fill: "rgba(224, 231, 255, 0.50)", stroke: "#4338ca", hex: "#e0e7ff" }
        ],
        ranges: [
            { fill: "rgba(59, 130, 246, 0.28)", stroke: "#1d4ed8", hex: "#3b82f6" },
            { fill: "rgba(16, 185, 129, 0.28)", stroke: "#047857", hex: "#10b981" },
            { fill: "rgba(245, 158, 11, 0.28)", stroke: "#b45309", hex: "#f59e0b" },
            { fill: "rgba(139, 92, 246, 0.28)", stroke: "#6d28d9", hex: "#8b5cf6" },
            { fill: "rgba(236, 72, 153, 0.28)", stroke: "#be185d", hex: "#ec4899" },
            { fill: "rgba(20, 184, 166, 0.28)", stroke: "#0f766e", hex: "#14b8a6" },
            { fill: "rgba(249, 115, 22, 0.28)", stroke: "#c2410c", hex: "#f97316" },
            { fill: "rgba(99, 102, 241, 0.28)", stroke: "#4338ca", hex: "#6366f1" },
            { fill: "rgba(132, 204, 22, 0.28)", stroke: "#4d7c0f", hex: "#84cc16" },
            { fill: "rgba(168, 85, 247, 0.28)", stroke: "#7e22ce", hex: "#a855f7" },
            { fill: "rgba(234, 179, 8, 0.28)", stroke: "#a16207", hex: "#eab308" },
            { fill: "rgba(244, 63, 94, 0.28)", stroke: "#be123c", hex: "#f43f5e" }
        ]
    },

    getDivisionColor: function(divName, index = 0) {
        return this.PALETTES.divisions[index % this.PALETTES.divisions.length];
    },

    getRangeColor: function(rangeName, index = 0, customMap = null) {
        if (customMap && customMap[rangeName]) return customMap[rangeName];
        return this.PALETTES.ranges[index % this.PALETTES.ranges.length];
    },

    formatFeatureLabel: function(name, suffix) {
        if (!name) return suffix;
        let clean = String(name).trim().toUpperCase();
        clean = clean.replace(new RegExp(`\\b${suffix}$`, 'i'), '').trim();
        clean = clean.replace(/\bR\.F\.$/i, '').replace(/\bR\.L\.$/i, '').trim();
        return `${clean} ${suffix}`.trim();
    },

    cleanCircleName: function(raw) {
        if (!raw) return "CIRCLE";
        let s = String(raw).trim().toUpperCase();
        s = s.replace(/\bFOREST\s+CIRCLE\b/gi, '')
             .replace(/\bCIRCLE\b/gi, '')
             .replace(/\bMAP\b/gi, '')
             .replace(/\s+/g, ' ')
             .trim();
        return s || String(raw).trim().toUpperCase();
    },

    cleanDivisionName: function(raw) {
        if (!raw) return "DIVISION";
        let s = String(raw).trim().toUpperCase();
        // Remove only whole words 'FOREST DIVISION', 'DIVISION', or 'MAP'
        s = s.replace(/\bFOREST\s+DIVISION\b/gi, '')
             .replace(/\bDIVISION\b/gi, '')
             .replace(/\bMAP\b/gi, '')
             .replace(/\s+/g, ' ')
             .trim();
        return s || String(raw).trim().toUpperCase();
    },

    cleanRangeName: function(raw) {
        if (!raw) return "RANGE";
        let s = String(raw).trim().toUpperCase();
        // Remove only whole words 'FOREST RANGE', 'RANGE', or 'MAP'
        s = s.replace(/\bFOREST\s+RANGE\b/gi, '')
             .replace(/\bRANGE\b/gi, '')
             .replace(/\bMAP\b/gi, '')
             .replace(/\s+/g, ' ')
             .trim();
        return s || String(raw).trim().toUpperCase();
    },

    dragState: {
        activeItem: null,
        isDragging: false,
        startX: 0,
        startY: 0
    },

    // Current transformation functions available after render
    toPixel: null,
    toGeo: null,

    init: function() {
        if (!this.sealImage) {
            this.sealImage = new Image();
            if (typeof window !== "undefined" && window.TAMIL_NADU_SEAL_URI) {
                this.sealImage.src = window.TAMIL_NADU_SEAL_URI;
            } else {
                this.sealImage.src = "LOGO.jpeg";
            }
        }
    },

    saveFile: function(blobOrDataUrl, filename, mimeType) {
        if (typeof window !== "undefined" && window.AndroidBlobDownloader) {
            if (typeof blobOrDataUrl === "string") {
                window.AndroidBlobDownloader.getBase64FromBlobData(blobOrDataUrl, filename, mimeType);
                return;
            } else if (blobOrDataUrl instanceof Blob) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    window.AndroidBlobDownloader.getBase64FromBlobData(reader.result, filename, mimeType);
                };
                reader.readAsDataURL(blobOrDataUrl);
                return;
            }
        }
        if (typeof blobOrDataUrl === "string") {
            const link = document.createElement('a');
            link.download = filename;
            link.href = blobOrDataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (blobOrDataUrl instanceof Blob) {
            const url = URL.createObjectURL(blobOrDataUrl);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    },

    drawTextWithSpacing: function(ctx, text, x, y, letterSpacing = 0) {
        ctx.save();
        if (!letterSpacing) {
            ctx.fillText(text, x, y);
            ctx.restore();
            return;
        }
        const chars = text.split('');
        const charWidths = chars.map(ch => ctx.measureText(ch).width);
        const textCharsW = charWidths.reduce((a, b) => a + b, 0);
        const totalW = textCharsW + (chars.length - 1) * letterSpacing;

        let curX = x;
        if (ctx.textAlign === 'center') {
            curX = x - (totalW / 2);
        } else if (ctx.textAlign === 'right') {
            curX = x - totalW;
        }
        ctx.textAlign = 'left';
        for (let i = 0; i < chars.length; i++) {
            ctx.fillText(chars[i], curX, y);
            curX += charWidths[i] + letterSpacing;
        }
        ctx.restore();
    },

    buildPolygonPath: function(ctx, geometry, toPixel) {
        if (!geometry || !geometry.coordinates) return;
        const geomType = geometry.type;
        const coords = geometry.coordinates;

        ctx.beginPath();
        if (geomType === "Polygon") {
            coords.forEach((ring) => {
                ring.forEach(([lon, lat], i) => {
                    const [px, py] = toPixel(lon, lat);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.closePath();
            });
        } else if (geomType === "MultiPolygon") {
            coords.forEach((poly) => {
                poly.forEach((ring) => {
                    ring.forEach(([lon, lat], i) => {
                        const [px, py] = toPixel(lon, lat);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.closePath();
                });
            });
        }
    },

    getGeoJSONBounds: function(geometry) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        function walk(coords) {
            if (typeof coords[0] === 'number') {
                const x = coords[0], y = coords[1];
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            } else {
                for (let i = 0; i < coords.length; i++) walk(coords[i]);
            }
        }
        if (geometry && geometry.coordinates) {
            walk(geometry.coordinates);
        }
        if (minX === Infinity) return [78.0, 10.0, 80.0, 12.0];
        return [minX, minY, maxX, maxY];
    },

    calculateStateBounds: function(studioState) {
        // Frame the full State of Tamil Nadu so the outer state boundary is always visible,
        // and user-selected divisions/ranges appear clearly inside
        return [76.15, 8.02, 80.40, 13.62];
    },

    calculateCircleBounds: function(studioState) {
        const cId = studioState.selectedCircleId;
        if (cId && typeof window !== "undefined" && window.TN_CIRCLE_BOUNDARIES && window.TN_CIRCLE_BOUNDARIES[cId] && window.TN_CIRCLE_BOUNDARIES[cId].bounds) {
            return window.TN_CIRCLE_BOUNDARIES[cId].bounds;
        }
        if (cId && typeof window !== "undefined" && window.CIRCLES_INDEX) {
            const c = window.CIRCLES_INDEX.find(x => x.id === cId);
            if (c && c.bounds) return c.bounds;
        }
        return [76.15, 8.02, 80.40, 13.62];
    },

    getFeatureCenter: function(geometry) {
        if (!geometry || !geometry.coordinates) return null;
        const geomType = geometry.type;
        let ring = null;
        if (geomType === "Polygon" && geometry.coordinates.length > 0) {
            ring = geometry.coordinates[0];
        } else if (geomType === "MultiPolygon" && geometry.coordinates.length > 0) {
            let maxLen = 0;
            geometry.coordinates.forEach(poly => {
                if (poly && poly[0] && poly[0].length > maxLen) {
                    maxLen = poly[0].length;
                    ring = poly[0];
                }
            });
        }
        if (!ring || ring.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < ring.length; i++) {
            const pt = ring[i];
            if (pt[0] < minX) minX = pt[0];
            if (pt[1] < minY) minY = pt[1];
            if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] > maxY) maxY = pt[1];
        }
        return [(minX + maxX) / 2, (minY + maxY) / 2];
    },

    drawFeatureLabels: function(ctx, features, toPixel, baseRatio, textColor, typeSuffix) {
        if (!features || !features.length) return;
        ctx.save();
        const fontSize = Math.max(8.5, Math.round(11 * baseRatio));
        ctx.font = `bold ${fontSize}px ${this.MAP_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;

        features.forEach(feat => {
            const center = this.getFeatureCenter(feat.geometry);
            if (!center) return;
            const [px, py] = toPixel(center[0], center[1]);
            const rawName = (feat.properties && feat.properties.name) ? feat.properties.name.trim() : "";
            if (!rawName) return;

            let labelText = rawName.toUpperCase();
            if (typeSuffix && !labelText.endsWith(typeSuffix)) {
                labelText = `${labelText} ${typeSuffix}`;
            }

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = Math.max(2.5, Math.round(4.0 * baseRatio));
            ctx.strokeText(labelText, px, py);

            ctx.fillStyle = textColor;
            ctx.fillText(labelText, px, py);
        });
        ctx.restore();
    },

    renderToCanvas: function(canvas, studioState, isFullRes = false) {
        this.init();
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const isPortrait = studioState.orientation === 'portrait';

        const baseRatio = w / (isPortrait ? 2480.0 : 3508.0);
        const heightRatio = h / (isPortrait ? 3508.0 : 2480.0);

        // 1. Crisp Pure White Background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        // Double Neatline Border (Official Cartographic Frame matching admin_boundary_studio)
        const margin = Math.round(w * 0.022);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1.0, 4.0 * baseRatio);
        ctx.strokeRect(margin, margin, w - (margin * 2), h - (margin * 2));

        const innerGap = Math.max(2, Math.round(7 * baseRatio));
        ctx.lineWidth = Math.max(0.5, 1.8 * baseRatio);
        ctx.strokeRect(margin + innerGap, margin + innerGap, w - ((margin + innerGap) * 2), h - ((margin + innerGap) * 2));

        const mapMode = studioState.mapMode || 'division';

        // Check if active data is ready
        let hasData = false;
        if (mapMode === 'division' && studioState.divisionData) hasData = true;
        if (mapMode === 'range' && studioState.rangeFeature) hasData = true;
        if (mapMode === 'state') {
            hasData = true;
        }
        if (mapMode === 'circle' && studioState.selectedCircleId) {
            hasData = true;
        }

        if (!hasData) {
            ctx.fillStyle = "#475569";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold " + Math.round(22 * baseRatio) + "px " + this.MAP_FONT;
            let msg = (mapMode === 'circle')
                ? "Choose a Forest Circle from the left panel to load the Circle Map"
                : (mapMode === 'state'
                    ? "Tick one or more Divisions or Ranges from the left panel to display on the State Map"
                    : "Select a Forest Division or Range from the left panel to load the Map Sheet");
            ctx.fillText(msg, w / 2, h / 2 - Math.round(14 * baseRatio));

            ctx.font = "normal " + Math.round(14 * baseRatio) + "px " + this.MAP_FONT;
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(mapMode === 'state'
                ? "Multi-selection State administrative & asset cartographic map"
                : "Official cartographic boundary map with forest assets & polygon styling", w / 2, h / 2 + Math.round(16 * baseRatio));
            return;
        }

        // 2. Map Projection & Transform (with user pan and zoom)
        const headerSpace = Math.round(112 * heightRatio);
        const footerSpace = Math.round(95 * heightRatio);
        const mapX = margin + innerGap + Math.round(15 * baseRatio);
        const mapY = margin + headerSpace;
        const mapW = w - (mapX * 2);
        const mapH = h - mapY - footerSpace - margin;

        const mapEl = this.elements.map;
        const mapScaleFactor = mapEl.scale || 1.0;
        const mapPanPxX = (mapEl.offsetX || 0) * mapW;
        const mapPanPxY = (mapEl.offsetY || 0) * mapH;

        // Determine active bounding box
        let activeBounds = [78.0, 10.0, 80.0, 12.0];
        if (mapMode === 'range' && studioState.rangeBounds) {
            activeBounds = studioState.rangeBounds;
        } else if (mapMode === 'state') {
            activeBounds = this.calculateStateBounds(studioState);
        } else if (mapMode === 'circle') {
            activeBounds = this.calculateCircleBounds(studioState);
        } else if (studioState.divisionData && studioState.divisionData.bounds) {
            activeBounds = studioState.divisionData.bounds;
        }

        const [minLon, minLat, maxLon, maxLat] = activeBounds;
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;
        const lonSpan = Math.max(0.001, maxLon - minLon);
        const latSpan = Math.max(0.001, maxLat - minLat);

        const cosLat = Math.cos((centerLat * Math.PI) / 180);
        const scaleX = mapW / (lonSpan * cosLat);
        const scaleY = mapH / latSpan;
        const baseScale = Math.min(scaleX * 0.88, scaleY * 0.90) * mapScaleFactor;

        const fittedLonSpan = (mapW / baseScale) / cosLat;
        const fittedLatSpan = mapH / baseScale;

        const mapMinX = centerLon - (fittedLonSpan / 2);
        const mapMaxX = centerLon + (fittedLonSpan / 2);
        const mapMinY = centerLat - (fittedLatSpan / 2);
        const mapMaxY = centerLat + (fittedLatSpan / 2);

        function toPixel(lon, lat) {
            const px = mapX + mapPanPxX + ((lon - mapMinX) / (mapMaxX - mapMinX)) * mapW;
            const py = (mapY + mapH) + mapPanPxY - ((lat - mapMinY) / (mapMaxY - mapMinY)) * mapH;
            return [px, py];
        }

        function toGeo(px, py) {
            const normX = (px - mapX - mapPanPxX) / mapW;
            const normY = ((mapY + mapH) + mapPanPxY - py) / mapH;
            const lon = mapMinX + normX * (mapMaxX - mapMinX);
            const lat = mapMinY + normY * (mapMaxY - mapMinY);
            return [lon, lat];
        }

        this.toPixel = toPixel;
        this.toGeo = toGeo;

        // Store Map Bounding Box for dragging / panning
        mapEl._bbox = {
            x: margin + innerGap + 2,
            y: margin + headerSpace,
            w: w - ((margin + innerGap + 2) * 2),
            h: h - mapY - footerSpace - margin
        };

        // Clip Map area strictly inside neatline
        ctx.save();
        ctx.beginPath();
        ctx.rect(margin + innerGap + 1, margin + innerGap + 1, w - ((margin + innerGap + 1) * 2), h - ((margin + innerGap + 1) * 2));
        ctx.clip();

        // 3. RENDER LAYERS ACCORDING TO MODE
        if (mapMode === 'state') {
            // STATE MAP MODE: Outer Tamil Nadu State Boundary + Selected Division & Range boundaries inside
            const stateBoundary = (typeof window !== "undefined" && window.TN_STATE_BOUNDARY) || null;
            const stateGeom = stateBoundary ? (stateBoundary.geometry || stateBoundary) : null;

            // 1. Base Fill for Tamil Nadu State (clean blank background, unselected divisions NOT drawn)
            if (stateGeom) {
                ctx.save();
                this.buildPolygonPath(ctx, stateGeom, toPixel);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.restore();
            }

            // 2. Outer Tamil Nadu State Boundary (User-Controlled Color & Thickness)
            if (stateGeom) {
                const stateColor = studioState.stateBoundaryColor || "#000000";
                const userWidth = (studioState.stateBoundaryWidth !== undefined) ? Number(studioState.stateBoundaryWidth) : 4.5;
                ctx.save();
                this.buildPolygonPath(ctx, stateGeom, toPixel);
                ctx.strokeStyle = stateColor;
                ctx.lineWidth = Math.max(1.0, userWidth * baseRatio);
                ctx.stroke();
                ctx.restore();
            }

            // 3. Highlight Selected Division Boundaries inside the state
            const selDivs = studioState.stateSelectedDivisions || [];
            const divLabelFeatures = [];
            const useDistinctColors = studioState.stateDistinctColors !== false;

            selDivs.forEach((divId, idx) => {
                const divData = (typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId]) || null;
                if (!divData) return;

                const divColor = useDistinctColors
                    ? this.getDivisionColor(divId, idx)
                    : { fill: "rgba(239, 68, 68, 0.22)", stroke: "#991b1b" };

                if (divData.division_boundary && divData.division_boundary.geometry) {
                    ctx.save();
                    this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
                    ctx.fillStyle = divColor.fill;
                    ctx.fill();
                    ctx.strokeStyle = divColor.stroke;
                    ctx.lineWidth = Math.max(2.4, 4.2 * baseRatio);
                    ctx.stroke();
                    ctx.restore();

                    divLabelFeatures.push({
                        geometry: divData.division_boundary.geometry,
                        properties: { name: divData.division || divId },
                        color: divColor.stroke
                    });
                }

                // Optional RF of selected divisions
                if ((studioState.showRF || studioState.showRFNames || studioState.legendShowRFNames) && divData.rf && divData.rf.features) {
                    divData.rf.features.forEach(rf => {
                        ctx.save();
                        this.buildPolygonPath(ctx, rf.geometry, toPixel);
                        ctx.fillStyle = "rgba(46, 125, 50, 0.45)"; // Forest Green
                        ctx.fill();
                        ctx.strokeStyle = "#1b5e20";
                        ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                    if (studioState.showRFNames) {
                        this.drawFeatureLabels(ctx, divData.rf.features, toPixel, baseRatio, "#14532d", "RF");
                    }
                }

                // Optional RL of selected divisions
                if ((studioState.showRL || studioState.showRLNames || studioState.legendShowRLNames) && divData.rl && divData.rl.features) {
                    divData.rl.features.forEach(rl => {
                        ctx.save();
                        this.buildPolygonPath(ctx, rl.geometry, toPixel);
                        ctx.fillStyle = "rgba(141, 85, 36, 0.45)"; // Rich Brown
                        ctx.fill();
                        ctx.strokeStyle = "#5d3210";
                        ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                    if (studioState.showRLNames) {
                        this.drawFeatureLabels(ctx, divData.rl.features, toPixel, baseRatio, "#7c2d12", "RL");
                    }
                }
            });

            // 4. Highlight Selected Range Boundaries inside the state
            const selRanges = studioState.stateSelectedRanges || [];
            const rangeLabelFeatures = [];

            selRanges.forEach((rItem, idx) => {
                const divData = (typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[rItem.divId]) || null;
                if (!divData || !divData.ranges || !divData.ranges.features) return;

                const feat = divData.ranges.features.find(f => {
                    const p = f.properties || {};
                    const name = (p.name || p.RANGE || '').trim().toLowerCase();
                    return name === (rItem.rangeName || '').trim().toLowerCase();
                });

                if (feat && feat.geometry) {
                    const rColor = useDistinctColors
                        ? this.getRangeColor(rItem.rangeName, idx)
                        : { fill: "rgba(37, 99, 235, 0.28)", stroke: "#1d4ed8" };

                    ctx.save();
                    this.buildPolygonPath(ctx, feat.geometry, toPixel);
                    ctx.fillStyle = rColor.fill;
                    ctx.fill();
                    ctx.strokeStyle = rColor.stroke;
                    ctx.lineWidth = Math.max(1.8, 3.2 * baseRatio);
                    ctx.stroke();
                    ctx.restore();

                    rangeLabelFeatures.push({
                        geometry: feat.geometry,
                        properties: { name: rItem.rangeName },
                        color: rColor.stroke
                    });
                }
            });

            // 5. Draw Division and Range Labels if enabled
            if (studioState.stateShowNames !== false) {
                if (divLabelFeatures.length > 0) {
                    this.drawFeatureLabels(ctx, divLabelFeatures, toPixel, baseRatio, "#0f172a", "DIV");
                }
                if (rangeLabelFeatures.length > 0) {
                    this.drawFeatureLabels(ctx, rangeLabelFeatures, toPixel, baseRatio, "#1e3a8a", "RANGE");
                }
            }
        } else if (mapMode === 'circle') {
            // CIRCLE MAP MODE: Outer Forest Circle Boundary + Selected Division & Range boundaries inside
            const cId = studioState.selectedCircleId;
            const circleData = (typeof window !== "undefined" && window.TN_CIRCLE_BOUNDARIES && window.TN_CIRCLE_BOUNDARIES[cId]) || null;
            const circleGeom = circleData ? circleData.geometry : null;

            // 1. Base Fill for Circle
            if (circleGeom) {
                ctx.save();
                this.buildPolygonPath(ctx, circleGeom, toPixel);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.restore();
            }

            // 2. Highlight Selected Division Boundaries inside the circle
            const selDivs = studioState.circleSelectedDivisions || [];
            const divLabelFeatures = [];
            const useDistinctColors = studioState.circleDistinctColors !== false;

            selDivs.forEach((divId, idx) => {
                const divData = (typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId]) || null;
                if (!divData) return;

                const divColor = useDistinctColors
                    ? this.getDivisionColor(divId, idx)
                    : { fill: "rgba(239, 68, 68, 0.22)", stroke: "#991b1b" };

                if (divData.division_boundary && divData.division_boundary.geometry) {
                    ctx.save();
                    this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
                    ctx.fillStyle = divColor.fill;
                    ctx.fill();
                    ctx.strokeStyle = divColor.stroke;
                    ctx.lineWidth = Math.max(2.4, 4.2 * baseRatio);
                    ctx.stroke();
                    ctx.restore();

                    divLabelFeatures.push({
                        geometry: divData.division_boundary.geometry,
                        properties: { name: divData.division || divId },
                        color: divColor.stroke
                    });
                }

                // Optional RF of selected divisions
                if ((studioState.showRF || studioState.showRFNames || studioState.legendShowRFNames) && divData.rf && divData.rf.features) {
                    divData.rf.features.forEach(rf => {
                        ctx.save();
                        this.buildPolygonPath(ctx, rf.geometry, toPixel);
                        ctx.fillStyle = "rgba(46, 125, 50, 0.45)";
                        ctx.fill();
                        ctx.strokeStyle = "#1b5e20";
                        ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                    if (studioState.showRFNames) {
                        this.drawFeatureLabels(ctx, divData.rf.features, toPixel, baseRatio, "#14532d", "RF");
                    }
                }

                // Optional RL of selected divisions
                if ((studioState.showRL || studioState.showRLNames || studioState.legendShowRLNames) && divData.rl && divData.rl.features) {
                    divData.rl.features.forEach(rl => {
                        ctx.save();
                        this.buildPolygonPath(ctx, rl.geometry, toPixel);
                        ctx.fillStyle = "rgba(141, 85, 36, 0.45)";
                        ctx.fill();
                        ctx.strokeStyle = "#5d3210";
                        ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                    if (studioState.showRLNames) {
                        this.drawFeatureLabels(ctx, divData.rl.features, toPixel, baseRatio, "#7c2d12", "RL");
                    }
                }
            });

            // 3. Highlight Selected Range Boundaries inside the circle
            const selRanges = studioState.circleSelectedRanges || [];
            const rangeLabelFeatures = [];

            selRanges.forEach((rItem, idx) => {
                const divData = (typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[rItem.divId]) || null;
                if (!divData || !divData.ranges || !divData.ranges.features) return;

                const feat = divData.ranges.features.find(f => {
                    const p = f.properties || {};
                    const name = (p.name || p.RANGE || '').trim().toLowerCase();
                    return name === (rItem.rangeName || '').trim().toLowerCase();
                });

                if (feat && feat.geometry) {
                    const rColor = useDistinctColors
                        ? this.getRangeColor(rItem.rangeName, idx)
                        : { fill: "rgba(37, 99, 235, 0.28)", stroke: "#1d4ed8" };

                    ctx.save();
                    this.buildPolygonPath(ctx, feat.geometry, toPixel);
                    ctx.fillStyle = rColor.fill;
                    ctx.fill();
                    ctx.strokeStyle = rColor.stroke;
                    ctx.lineWidth = Math.max(1.8, 3.2 * baseRatio);
                    ctx.stroke();
                    ctx.restore();

                    rangeLabelFeatures.push({
                        geometry: feat.geometry,
                        properties: { name: rItem.rangeName },
                        color: rColor.stroke
                    });
                }
            });

            // 4. Draw Division and Range Labels if enabled
            if (studioState.circleShowNames !== false) {
                if (divLabelFeatures.length > 0) {
                    this.drawFeatureLabels(ctx, divLabelFeatures, toPixel, baseRatio, "#0f172a", "DIV");
                }
                if (rangeLabelFeatures.length > 0) {
                    this.drawFeatureLabels(ctx, rangeLabelFeatures, toPixel, baseRatio, "#1e3a8a", "RANGE");
                }
            }

            // 5. Outer Forest Circle Boundary (Rendered on top for crispness)
            if (circleGeom) {
                const circleColor = studioState.circleBoundaryColor || "#000000";
                const userWidth = (studioState.circleBoundaryWidth !== undefined) ? Number(studioState.circleBoundaryWidth) : 4.5;
                ctx.save();
                this.buildPolygonPath(ctx, circleGeom, toPixel);
                ctx.strokeStyle = circleColor;
                ctx.lineWidth = Math.max(1.0, userWidth * baseRatio);
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.stroke();
                ctx.restore();
            }
        } else if (mapMode === 'range') {
            // RANGE MAP MODE: Isolates only selected range, no background outside clutter
            const rFeat = studioState.rangeFeature;
            const rName = studioState.selectedRangeName;
            const parentDiv = studioState.divisionData;

            // Range base polygon
            ctx.save();
            this.buildPolygonPath(ctx, rFeat.geometry, toPixel);
            ctx.fillStyle = "#f8fafc";
            ctx.fill();
            ctx.strokeStyle = "#1e3a8a";
            ctx.lineWidth = Math.max(2.5, 4.2 * baseRatio);
            ctx.stroke();
            ctx.restore();

            // RF of this range (Optional green shade #2e7d32)
            if ((studioState.showRF || studioState.showRFNames || studioState.legendShowRFNames) && parentDiv && parentDiv.rf && parentDiv.rf.features) {
                const rangeRF = parentDiv.rf.features.filter(rf => {
                    if (!rf.properties) return false;
                    const rProp = (rf.properties.range || rf.properties.RANGE || "").trim().toLowerCase();
                    const selR = (rName || "").trim().toLowerCase();
                    return rProp === selR;
                });
                rangeRF.forEach(rf => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rf.geometry, toPixel);
                    ctx.fillStyle = "rgba(46, 125, 50, 0.45)"; // Forest Green
                    ctx.fill();
                    ctx.strokeStyle = "#1b5e20";
                    ctx.lineWidth = Math.max(0.8, 1.8 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
                if (studioState.showRFNames) {
                    this.drawFeatureLabels(ctx, rangeRF, toPixel, baseRatio, "#14532d", "RF");
                }
            }

            // RL of this range (Optional brown shade #8d5524)
            if ((studioState.showRL || studioState.showRLNames || studioState.legendShowRLNames) && parentDiv && parentDiv.rl && parentDiv.rl.features) {
                const rangeRL = parentDiv.rl.features.filter(rl => {
                    if (!rl.properties) return false;
                    const rProp = (rl.properties.range || rl.properties.RANGE || "").trim().toLowerCase();
                    const selR = (rName || "").trim().toLowerCase();
                    return rProp === selR;
                });
                rangeRL.forEach(rl => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rl.geometry, toPixel);
                    ctx.fillStyle = "rgba(141, 85, 36, 0.45)"; // Rich RL Brown
                    ctx.fill();
                    ctx.strokeStyle = "#5d3210";
                    ctx.lineWidth = Math.max(0.8, 1.8 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
                if (studioState.showRLNames) {
                    this.drawFeatureLabels(ctx, rangeRL, toPixel, baseRatio, "#7c2d12", "RL");
                }
            }

        } else {
            // DIVISION MAP MODE: Clean division map with optional ranges, RF, and RL
            const divData = studioState.divisionData;

            // Division Base Boundary
            if (divData.division_boundary) {
                ctx.save();
                this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
                ctx.fillStyle = "#fafafa";
                ctx.fill();
                ctx.strokeStyle = "#991b1b"; // Bold Division Crimson Outline
                ctx.lineWidth = Math.max(2.8, 4.5 * baseRatio);
                ctx.stroke();
                ctx.restore();
            }

            // Optional Ranges
            if (studioState.showRange && divData.ranges && divData.ranges.features) {
                const useDistinct = studioState.distinctRangeColors !== false;
                divData.ranges.features.forEach((range, idx) => {
                    const rName = (range.properties && range.properties.name) || `RANGE ${idx + 1}`;
                    const rColor = this.getRangeColor(rName, idx, studioState.rangeColors);

                    ctx.save();
                    this.buildPolygonPath(ctx, range.geometry, toPixel);
                    if (useDistinct) {
                        ctx.fillStyle = rColor.fill;
                        ctx.fill();
                        ctx.strokeStyle = rColor.stroke;
                        ctx.lineWidth = Math.max(1.8, 3.2 * baseRatio);
                    } else {
                        ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
                        ctx.fill();
                        ctx.strokeStyle = "#2563eb";
                        ctx.lineWidth = Math.max(1.5, 2.8 * baseRatio);
                    }
                    ctx.stroke();
                    ctx.restore();
                });

                if (studioState.showRangeNames) {
                    this.drawFeatureLabels(ctx, divData.ranges.features, toPixel, baseRatio, "#1e3a8a", "RANGE");
                }
            }

            // Optional RF (Reserved Forest - Green shade #2e7d32)
            if ((studioState.showRF || studioState.showRFNames || studioState.legendShowRFNames) && divData.rf && divData.rf.features) {
                divData.rf.features.forEach(rf => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rf.geometry, toPixel);
                    ctx.fillStyle = "rgba(46, 125, 50, 0.45)";
                    ctx.fill();
                    ctx.strokeStyle = "#1b5e20";
                    ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });

                if (studioState.showRFNames) {
                    this.drawFeatureLabels(ctx, divData.rf.features, toPixel, baseRatio, "#14532d", "RF");
                }
            }

            // Optional RL (Reserved Land - Brown shade #8d5524)
            if ((studioState.showRL || studioState.showRLNames || studioState.legendShowRLNames) && divData.rl && divData.rl.features) {
                divData.rl.features.forEach(rl => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rl.geometry, toPixel);
                    ctx.fillStyle = "rgba(141, 85, 36, 0.45)";
                    ctx.fill();
                    ctx.strokeStyle = "#5d3210";
                    ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });

                if (studioState.showRLNames) {
                    this.drawFeatureLabels(ctx, divData.rl.features, toPixel, baseRatio, "#7c2d12", "RL");
                }
            }
        }

        // 4. RENDER CUSTOM USER POLYGONS (Movable, custom colors, labels, and hit-testing)
        if (studioState.customPolygons && studioState.customPolygons.length > 0) {
            studioState.customPolygons.forEach(poly => {
                if (!poly.points || poly.points.length < 3) return;
                ctx.save();
                ctx.beginPath();
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                poly.points.forEach(([lon, lat], idx) => {
                    const [px, py] = toPixel(lon, lat);
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;
                    if (idx === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.closePath();
                ctx.fillStyle = poly.fillColor || "rgba(2, 132, 199, 0.30)";
                ctx.fill();
                ctx.strokeStyle = poly.color || "#0284c7";
                ctx.lineWidth = Math.max(2.0, 3.5 * baseRatio);
                ctx.setLineDash([6 * baseRatio, 3 * baseRatio]);
                ctx.stroke();

                poly._bbox = {
                    x: minX - 8,
                    y: minY - 8,
                    w: maxX - minX + 16,
                    h: maxY - minY + 16
                };

                if (poly.name) {
                    const centerLon = poly.points.reduce((s, p) => s + p[0], 0) / poly.points.length;
                    const centerLat = poly.points.reduce((s, p) => s + p[1], 0) / poly.points.length;
                    const [cpx, cpy] = toPixel(centerLon, centerLat);
                    ctx.font = `bold ${Math.max(10, Math.round(14 * baseRatio))}px ${this.MAP_FONT}`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = Math.max(3.2, 5.0 * baseRatio);
                    ctx.strokeText(poly.name.toUpperCase(), cpx, cpy);
                    ctx.fillStyle = "#0f172a";
                    ctx.fillText(poly.name.toUpperCase(), cpx, cpy);
                }
                ctx.restore();
            });
        }

        // 5. RENDER PLACED FOREST ASSETS (Custom Images / Badges + Toggleable Name, default image only)
        if (studioState.placedAssets && studioState.placedAssets.length > 0) {
            const assetScale = (this.elements.assets && this.elements.assets.scale) ? this.elements.assets.scale : 1.0;
            const badgeRadius = Math.max(12, Math.round(18 * baseRatio * assetScale));
            const labelFontSize = Math.max(9, Math.round(13 * baseRatio * assetScale));

            studioState.placedAssets.forEach((asset, aIdx) => {
                const [px, py] = toPixel(asset.lon, asset.lat);

                // Check custom uploaded image
                let customImgEl = null;
                if (asset.imageUrl) {
                    customImgEl = this.getImage(asset.imageUrl);
                }

                // Badge Shadow
                ctx.save();
                ctx.shadowColor = "rgba(0,0,0,0.35)";
                ctx.shadowBlur = 6 * baseRatio;
                ctx.shadowOffsetY = 2 * baseRatio;

                // Circular Badge Background
                ctx.beginPath();
                ctx.arc(px, py, badgeRadius, 0, Math.PI * 2);
                ctx.fillStyle = asset.bg || "#ffffff";
                ctx.fill();

                // Circular Badge Border
                ctx.strokeStyle = asset.color || "#166534";
                ctx.lineWidth = Math.max(2.0, 3.0 * baseRatio * assetScale);
                ctx.stroke();
                ctx.restore();

                // Draw Image or Icon inside Badge
                if (customImgEl && customImgEl.complete && customImgEl.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(px, py, badgeRadius - (2 * baseRatio), 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(customImgEl, px - (badgeRadius - 2 * baseRatio), py - (badgeRadius - 2 * baseRatio), (badgeRadius - 2 * baseRatio) * 2, (badgeRadius - 2 * baseRatio) * 2);
                    ctx.restore();
                } else if (asset.isTextOnly) {
                    ctx.save();
                    ctx.font = `${Math.round(badgeRadius * 1.0)}px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(asset.icon || "🏷️", px, py + 1);
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.font = `${Math.round(badgeRadius * 1.15)}px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(asset.icon || "📍", px, py + 1);
                    ctx.restore();
                }

                // NAME DISPLAY ON MAP: DEFAULT IS OFF (ONLY IMAGE).
                // User can turn on name for any individual asset or all assets.
                const showLabelOnMap = (studioState.showAllAssetNamesOnMap === true) || (asset.showNameOnMap === true);

                let labelW = 0;
                if (showLabelOnMap) {
                    const labelText = (asset.label || asset.name || "ASSET").toUpperCase();
                    ctx.save();
                    ctx.font = `bold ${labelFontSize}px ${this.MAP_FONT}`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    const labelY = py + badgeRadius + Math.round(3 * baseRatio);

                    // Thick protective white halo for maximum contrast over dark RF & RL
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
                    ctx.lineWidth = Math.max(3.2, 4.6 * baseRatio);
                    ctx.lineJoin = "round";
                    ctx.miterLimit = 2;
                    ctx.strokeText(labelText, px, labelY);

                    // Exact Normal Black Font
                    ctx.fillStyle = "#111111";
                    ctx.fillText(labelText, px, labelY);
                    labelW = ctx.measureText(labelText).width;
                    ctx.restore();
                }

                // Store bounding box for dragging the asset directly on canvas
                const totalW = Math.max(badgeRadius * 2, showLabelOnMap ? labelW + 14 : badgeRadius * 2);
                const totalH = (badgeRadius * 2) + (showLabelOnMap ? labelFontSize + 8 : 4);
                asset._bbox = {
                    x: px - totalW / 2,
                    y: py - badgeRadius,
                    w: totalW,
                    h: totalH,
                    px: px,
                    py: py
                };
            });
        }

        // 5B. RENDER STANDALONE CUSTOM TEXT ANNOTATIONS
        if (studioState.customTexts && studioState.customTexts.length > 0) {
            studioState.customTexts.forEach((ct, ctIdx) => {
                const [px, py] = toPixel(ct.lon, ct.lat);
                const textScale = (this.elements.assets && this.elements.assets.scale) ? this.elements.assets.scale : 1.0;
                // Physical pt to 300 DPI master canvas pixel multiplier (so 22pt is bold, prominent and clearly readable)
                const ptScale = 3.6;
                const fontSize = Math.max(16, Math.round((parseFloat(ct.fontSize) || 18) * ptScale * baseRatio * textScale));

                ctx.save();
                ctx.font = `bold ${fontSize}px ${this.MAP_FONT}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const textStr = ct.text || "Annotation";

                // Prominent protective white halo
                ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
                ctx.lineWidth = Math.max(4.5, 6.5 * baseRatio);
                ctx.lineJoin = "round";
                ctx.strokeText(textStr, px, py);

                ctx.fillStyle = ct.color || "#111111";
                ctx.fillText(textStr, px, py);

                const tw = ctx.measureText(textStr).width;
                ctx.restore();

                // Generous hitbox for easy clicking and moving
                const padX = Math.max(12, Math.round(16 * baseRatio));
                const padY = Math.max(10, Math.round(14 * baseRatio));
                ct._bbox = {
                    x: px - (tw / 2) - padX,
                    y: py - (fontSize / 2) - padY,
                    w: tw + (padX * 2),
                    h: fontSize + (padY * 2),
                    px: px,
                    py: py
                };
            });
        }

        // Active Drawing / Coordinate Polygon preview
        if (studioState.drawingPoints && studioState.drawingPoints.length > 0) {
            ctx.save();
            const pts = studioState.drawingPoints;
            
            // Draw connecting lines and preview fill if >= 3
            if (pts.length > 1) {
                ctx.beginPath();
                pts.forEach(([lon, lat], i) => {
                    const [px, py] = toPixel(lon, lat);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                if (pts.length >= 3) {
                    ctx.closePath();
                    ctx.fillStyle = studioState.polyPresetFill || "rgba(2, 132, 199, 0.25)";
                    ctx.fill();
                }
                ctx.strokeStyle = studioState.polyPresetColor || "#e11d48";
                ctx.lineWidth = Math.max(2.0, 3.5 * baseRatio);
                ctx.setLineDash([6 * baseRatio, 4 * baseRatio]);
                ctx.stroke();
            }

            // Draw vertex handles with sequence numbering P1, P2, P3...
            pts.forEach(([lon, lat], idx) => {
                const [px, py] = toPixel(lon, lat);
                // Outer ring
                ctx.beginPath();
                ctx.arc(px, py, Math.max(5, 7 * baseRatio), 0, Math.PI * 2);
                ctx.fillStyle = "#e11d48";
                ctx.fill();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = Math.max(1.5, 2.0 * baseRatio);
                ctx.stroke();

                // Point Number Tag (P1, P2...) with white halo
                const tag = `P${idx + 1}`;
                const tagFontSize = Math.max(10, Math.round(13 * baseRatio));
                ctx.font = `bold ${tagFontSize}px ${this.MAP_FONT}`;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = Math.max(2.5, 3.5 * baseRatio);
                ctx.strokeText(tag, px + 9 * baseRatio, py);
                ctx.fillStyle = "#991b1b";
                ctx.fillText(tag, px + 9 * baseRatio, py);
            });
            ctx.restore();
        }

        ctx.restore(); // Restore neatline clip

        // 6. RENDER DYNAMIC TITLE (Line 1: Division/Range Forest Division/Range in 18pt bold black, Line 2: Editable Subtitle in 16pt bold browny red)
        const titleEl = this.elements.title;
        let mainTitleText = "";
        let subTitleText = (studioState.subtitleText !== undefined && studioState.subtitleText !== null && studioState.subtitleText.trim() !== "") 
            ? studioState.subtitleText.trim() 
            : "ASSET & ADMINISTRATIVE MAP";

        if (mapMode === 'range') {
            const rName = (studioState.selectedRangeName || "RANGE").toUpperCase().trim();
            const cleanRng = this.cleanRangeName(rName);
            mainTitleText = `${cleanRng} FOREST RANGE`;
        } else if (mapMode === 'state') {
            const selDivs = studioState.stateSelectedDivisions || [];
            const selRanges = studioState.stateSelectedRanges || [];
            if (selDivs.length === 1 && selRanges.length === 0) {
                const divId = selDivs[0];
                const dData = typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId];
                const cleanDiv = this.cleanDivisionName((dData && dData.division) || divId);
                mainTitleText = `${cleanDiv} FOREST DIVISION`;
            } else {
                mainTitleText = "TAMIL NADU FOREST DEPARTMENT";
            }
        } else if (mapMode === 'circle') {
            const rawCircle = studioState.circleName || "CIRCLE";
            const cleanCircle = this.cleanCircleName(rawCircle);
            mainTitleText = `${cleanCircle} FOREST CIRCLE`;
        } else {
            const rawDiv = (studioState.divisionName || (studioState.divisionData && studioState.divisionData.division) || "DIVISION").toUpperCase().trim();
            const cleanDiv = this.cleanDivisionName(rawDiv);
            mainTitleText = `${cleanDiv} FOREST DIVISION`;
        }

        const titlePxX = titleEl.x * w;
        const titlePxY = titleEl.y * h;
        const scaleDept = (titleEl.scaleDept !== undefined ? titleEl.scaleDept : 1.35) * (titleEl.scale || 1.0);
        const scaleSub = (titleEl.scaleSub !== undefined ? titleEl.scaleSub : 0.95) * (titleEl.scale || 1.0);

        // Line 1: [DIVISION/RANGE] FOREST DIVISION/RANGE (Fixed font size 18pt bold black color #000000)
        const line1FontSize = Math.max(16, Math.round(38 * baseRatio * scaleDept));
        const line1Y = titlePxY - Math.round(10 * baseRatio * scaleDept);
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${line1FontSize}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, mainTitleText, titlePxX, line1Y, 2.2 * baseRatio * scaleDept);
        ctx.restore();

        // Line 2: User-Editable Heading (Fixed font size 16pt bold browny red color #8B1E1E)
        const line2FontSize = Math.max(14, Math.round(32 * baseRatio * scaleSub));
        const line2Y = titlePxY + Math.round(24 * baseRatio * scaleDept);
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#8B1E1E";
        ctx.font = `bold ${line2FontSize}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, subTitleText, titlePxX, line2Y, 1.8 * baseRatio * scaleSub);
        ctx.restore();

        // Compute exact bbox for dragging title
        ctx.save();
        ctx.font = `bold ${line1FontSize}px ${this.MAP_FONT}`;
        const w1 = ctx.measureText(mainTitleText).width + (mainTitleText.length * 2.2 * baseRatio * scaleDept);
        ctx.font = `bold ${line2FontSize}px ${this.MAP_FONT}`;
        const w2 = ctx.measureText(subTitleText).width + (subTitleText.length * 1.8 * baseRatio * scaleSub);
        ctx.restore();

        const maxHeaderW = Math.max(w1, w2);
        const headerTotalH = (line2Y - line1Y) + line2FontSize + 14;

        titleEl._bbox = {
            x: titlePxX - (maxHeaderW / 2) - 16,
            y: line1Y - line1FontSize,
            w: maxHeaderW + 32,
            h: headerTotalH
        };

        // 7. Render Cartographic North Arrow (Border-Safe Position & Size)
        const naEl = this.elements.northArrow;
        const naPxX = naEl.x * w;
        const naPxY = naEl.y * h;
        const naScale = naEl.scale || 1.15;
        const naSize = Math.max(18, Math.round((naEl.size || 85) * baseRatio * naScale));
        this.drawNorthArrow(ctx, naPxX, naPxY, naSize);
        naEl._bbox = {
            x: naPxX - (naSize * 0.42),
            y: naPxY - (naSize * 0.50),
            w: naSize * 0.84,
            h: naSize * 1.18
        };

        // 8. Render Bottom-Left Department Seal & 3-Line GIS Cell
        const sealEl = this.elements.seal;
        const sealPxX = sealEl.x * w;
        const sealPxY = sealEl.y * h;
        const sealScale = sealEl.scale || 1.25;
        const sealBbox = this.drawOfficialDepartmentSeal(ctx, sealPxX, sealPxY, baseRatio * sealScale, heightRatio * sealScale);
        sealEl._bbox = sealBbox;

        // 9. RENDER DYNAMIC BOXED LEGEND
        const legendEl = this.elements.legend;
        const legendItems = [];

        if (mapMode === 'state') {
            const selDivs = studioState.stateSelectedDivisions || [];
            const selRanges = studioState.stateSelectedRanges || [];
            const useDistinct = studioState.stateDistinctColors !== false;

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: "TAMIL NADU STATE BOUNDARY",
                    color: studioState.stateBoundaryColor || "#000000",
                    fillColor: "#ffffff"
                });
            }

            if (selDivs.length > 0) {
                if (useDistinct) {
                    selDivs.forEach((divId, idx) => {
                        const dData = (typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId]) || null;
                        const cleanDiv = this.cleanDivisionName((dData && dData.division) || divId);
                        const color = this.getDivisionColor(divId, idx);
                        legendItems.push({
                            label: `${cleanDiv} DIVISION`,
                            color: color.stroke,
                            fillColor: color.fill
                        });
                    });
                } else {
                    legendItems.push({
                        label: `SELECTED DIVISIONS (${selDivs.length})`,
                        color: "#991b1b",
                        fillColor: "rgba(239, 68, 68, 0.22)"
                    });
                }
            }

            if (selRanges.length > 0) {
                if (useDistinct) {
                    selRanges.forEach((rItem, idx) => {
                        const cleanRng = this.cleanRangeName(rItem.rangeName);
                        const color = this.getRangeColor(rItem.rangeName, idx);
                        legendItems.push({
                            label: `${cleanRng} RANGE`,
                            color: color.stroke,
                            fillColor: color.fill
                        });
                    });
                } else {
                    legendItems.push({
                        label: `SELECTED RANGES (${selRanges.length})`,
                        color: "#1d4ed8",
                        fillColor: "rgba(37, 99, 235, 0.28)"
                    });
                }
            }

            if (studioState.showRF && selDivs.length > 0) {
                legendItems.push({
                    label: "RESERVED FOREST [RF]",
                    color: "#166534",
                    fillColor: "rgba(46, 125, 50, 0.45)"
                });
            }

            if (studioState.showRL && selDivs.length > 0) {
                legendItems.push({
                    label: "RESERVED LAND [RL]",
                    color: "#5d3210",
                    fillColor: "rgba(141, 85, 36, 0.45)"
                });
            }
        } else if (mapMode === 'circle') {
            const rawCircle = studioState.circleName || "CIRCLE";
            const cleanCircle = this.cleanCircleName(rawCircle);
            const selDivs = studioState.circleSelectedDivisions || [];
            const selRanges = studioState.circleSelectedRanges || [];
            const useDistinct = studioState.circleDistinctColors !== false;

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: `${cleanCircle} CIRCLE BOUNDARY`,
                    color: studioState.circleBoundaryColor || "#000000",
                    fillColor: "#ffffff"
                });
            }

            if (selDivs.length > 0) {
                if (useDistinct) {
                    selDivs.forEach((divId, idx) => {
                        const dData = (typeof window !== "undefined" && window.DIVISIONS_DATA && window.DIVISIONS_DATA[divId]) || null;
                        const cleanDiv = this.cleanDivisionName((dData && dData.division) || divId);
                        const color = this.getDivisionColor(divId, idx);
                        legendItems.push({
                            label: `${cleanDiv} DIVISION`,
                            color: color.stroke,
                            fillColor: color.fill
                        });
                    });
                } else {
                    legendItems.push({
                        label: `SELECTED DIVISIONS (${selDivs.length})`,
                        color: "#991b1b",
                        fillColor: "rgba(239, 68, 68, 0.22)"
                    });
                }
            }

            if (selRanges.length > 0) {
                if (useDistinct) {
                    selRanges.forEach((rItem, idx) => {
                        const cleanRng = this.cleanRangeName(rItem.rangeName);
                        const color = this.getRangeColor(rItem.rangeName, idx);
                        legendItems.push({
                            label: `${cleanRng} RANGE`,
                            color: color.stroke,
                            fillColor: color.fill
                        });
                    });
                } else {
                    legendItems.push({
                        label: `SELECTED RANGES (${selRanges.length})`,
                        color: "#1d4ed8",
                        fillColor: "rgba(37, 99, 235, 0.28)"
                    });
                }
            }

            if (studioState.showRF && selDivs.length > 0) {
                legendItems.push({
                    label: "RESERVED FOREST [RF]",
                    color: "#166534",
                    fillColor: "rgba(46, 125, 50, 0.45)"
                });
            }

            if (studioState.showRL && selDivs.length > 0) {
                legendItems.push({
                    label: "RESERVED LAND [RL]",
                    color: "#5d3210",
                    fillColor: "rgba(141, 85, 36, 0.45)"
                });
            }
        } else if (mapMode === 'range') {
            const rName = (studioState.selectedRangeName || "RANGE").toUpperCase().trim();
            const parentDiv = studioState.divisionData;

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: `${this.cleanRangeName(rName)} RANGE`,
                    color: "#1e3a8a",
                    fillColor: "#f8fafc"
                });
            }

            if ((studioState.showRF || studioState.legendShowRFNames) && studioState.legendShowRF !== false && parentDiv && parentDiv.rf && parentDiv.rf.features) {
                const rangeRF = parentDiv.rf.features.filter(rf => {
                    if (!rf.properties) return false;
                    const rProp = (rf.properties.range || rf.properties.RANGE || "").trim().toLowerCase();
                    const selR = (studioState.selectedRangeName || "").trim().toLowerCase();
                    return rProp === selR;
                });
                if (studioState.legendShowRFNames && rangeRF.length > 0) {
                    const seen = new Set();
                    rangeRF.forEach(rf => {
                        const rawName = (rf.properties && (rf.properties.name || rf.properties.NAME || rf.properties.rf_name)) || "RF";
                        const label = this.formatFeatureLabel(rawName, "RF");
                        if (!seen.has(label)) {
                            seen.add(label);
                            legendItems.push({
                                label: label,
                                color: "#166534",
                                fillColor: "rgba(46, 125, 50, 0.45)"
                            });
                        }
                    });
                } else if (rangeRF.length > 0) {
                    legendItems.push({
                        label: `RESERVED FOREST [RF] (${rangeRF.length})`,
                        color: "#166534",
                        fillColor: "rgba(46, 125, 50, 0.45)"
                    });
                }
            }

            if ((studioState.showRL || studioState.legendShowRLNames) && studioState.legendShowRL !== false && parentDiv && parentDiv.rl && parentDiv.rl.features) {
                const rangeRL = parentDiv.rl.features.filter(rl => {
                    if (!rl.properties) return false;
                    const rProp = (rl.properties.range || rl.properties.RANGE || "").trim().toLowerCase();
                    const selR = (studioState.selectedRangeName || "").trim().toLowerCase();
                    return rProp === selR;
                });
                if (studioState.legendShowRLNames && rangeRL.length > 0) {
                    const seenRL = new Set();
                    rangeRL.forEach(rl => {
                        const rawName = (rl.properties && (rl.properties.name || rl.properties.NAME || rl.properties.rl_name)) || "RL";
                        const label = this.formatFeatureLabel(rawName, "RL");
                        if (!seenRL.has(label)) {
                            seenRL.add(label);
                            legendItems.push({
                                label: label,
                                color: "#8d5524",
                                fillColor: "rgba(141, 85, 36, 0.45)"
                            });
                        }
                    });
                } else if (rangeRL.length > 0) {
                    legendItems.push({
                        label: `RESERVED LAND [RL] (${rangeRL.length})`,
                        color: "#8d5524",
                        fillColor: "rgba(141, 85, 36, 0.45)"
                    });
                }
            }

        } else {
            // DIVISION MAP MODE LEGEND
            const divData = studioState.divisionData;
            const rawDiv = (studioState.divisionName || (divData && divData.division) || "FOREST").toUpperCase().trim();

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: `${this.cleanDivisionName(rawDiv)} DIVISION`,
                    color: "#991b1b",
                    isBoundary: true
                });
            }

            if (studioState.showRange && divData && divData.ranges && divData.ranges.features) {
                if (studioState.legendShowRangeNames !== false) {
                    divData.ranges.features.forEach((feat, idx) => {
                        const rName = feat.properties.name;
                        const rColor = this.getRangeColor(rName, idx, studioState.rangeColors);
                        legendItems.push({
                            label: `${rName.toUpperCase()} RANGE`,
                            color: rColor.stroke,
                            fillColor: rColor.fill
                        });
                    });
                } else {
                    legendItems.push({
                        label: `RANGE BOUNDARY (${divData.ranges.features.length})`,
                        color: "#2563eb",
                        fillColor: "rgba(37, 99, 235, 0.18)"
                    });
                }
            }

            if ((studioState.showRF || studioState.legendShowRFNames) && studioState.legendShowRF !== false && divData && divData.rf && divData.rf.features) {
                if (studioState.legendShowRFNames && divData.rf.features.length > 0) {
                    const seen = new Set();
                    divData.rf.features.forEach(rf => {
                        const rawName = (rf.properties && (rf.properties.name || rf.properties.NAME || rf.properties.rf_name)) || "RF";
                        const label = this.formatFeatureLabel(rawName, "RF");
                        if (!seen.has(label)) {
                            seen.add(label);
                            legendItems.push({
                                label: label,
                                color: "#166534",
                                fillColor: "rgba(46, 125, 50, 0.45)"
                            });
                        }
                    });
                } else if (divData.rf.features.length > 0) {
                    legendItems.push({
                        label: `RESERVED FOREST [RF] (${divData.rf.features.length})`,
                        color: "#166534",
                        fillColor: "rgba(46, 125, 50, 0.45)"
                    });
                }
            }

            if ((studioState.showRL || studioState.legendShowRLNames) && studioState.legendShowRL !== false && divData && divData.rl && divData.rl.features) {
                if (studioState.legendShowRLNames && divData.rl.features.length > 0) {
                    const seenRL = new Set();
                    divData.rl.features.forEach(rl => {
                        const rawName = (rl.properties && (rl.properties.name || rl.properties.NAME || rl.properties.rl_name)) || "RL";
                        const label = this.formatFeatureLabel(rawName, "RL");
                        if (!seenRL.has(label)) {
                            seenRL.add(label);
                            legendItems.push({
                                label: label,
                                color: "#8d5524",
                                fillColor: "rgba(141, 85, 36, 0.45)"
                            });
                        }
                    });
                } else if (divData.rl.features.length > 0) {
                    legendItems.push({
                        label: `RESERVED LAND [RL] (${divData.rl.features.length})`,
                        color: "#8d5524",
                        fillColor: "rgba(141, 85, 36, 0.45)"
                    });
                }
            }
        }

        // Add Custom Polygons to Legend
        if (studioState.customPolygons && studioState.customPolygons.length > 0) {
            studioState.customPolygons.forEach(p => {
                legendItems.push({
                    label: p.name.toUpperCase(),
                    color: p.color || "#0284c7",
                    fillColor: p.fillColor || "rgba(2, 132, 199, 0.30)",
                    isCustomPoly: true
                });
            });
        }

        // Add Placed Forest Assets to Legend (ALWAYS both Image/Icon + Name in legend!)
        if (studioState.placedAssets && studioState.placedAssets.length > 0) {
            const seenAssetKeys = new Set();
            studioState.placedAssets.forEach(a => {
                const label = (a.label || a.name || "ASSET").toUpperCase();
                if (!seenAssetKeys.has(label)) {
                    seenAssetKeys.add(label);
                    legendItems.push({
                        label: label,
                        originalLabel: label,
                        color: a.color || "#166534",
                        fillColor: a.bg || "#dcfce7",
                        icon: a.icon || "📍",
                        imageUrl: a.imageUrl || null,
                        isTextOnly: !!a.isTextOnly,
                        isAsset: true
                    });
                }
            });
        }

        // Add Custom Text Annotations into Legend Items
        if (studioState.customTexts && studioState.customTexts.length > 0) {
            const seenCustomTexts = new Set();
            studioState.customTexts.forEach(ct => {
                const textStr = (ct.text || "ANNOTATION").trim();
                const key = textStr.toUpperCase();
                if (textStr && !seenCustomTexts.has(key)) {
                    seenCustomTexts.add(key);
                    legendItems.push({
                        label: textStr,
                        originalLabel: textStr,
                        color: ct.color || "#111111",
                        fillColor: "#ffffff",
                        icon: "🏷️",
                        isTextOnly: true,
                        isAsset: true,
                        isCustomText: true
                    });
                }
            });
        }

        const legendPxX = legendEl.x * w;
        const legendPxY = legendEl.y * h;
        const legendScale = legendEl.scale || 1.15;
        const legendBounds = {
            minLeft: margin + innerGap + 6,
            maxRight: w - (margin + innerGap + 6),
            minTop: margin + innerGap + 6,
            maxBottom: h - (margin + innerGap + 6)
        };
        // Apply user legend overrides (allows editing and changing any name in legend)
        if (studioState.legendOverrides) {
            legendItems.forEach(item => {
                const orig = item.originalLabel || item.label;
                item.originalLabel = orig;
                if (studioState.legendOverrides[orig] !== undefined) {
                    item.label = studioState.legendOverrides[orig];
                }
            });
        }
        this.lastLegendItems = legendItems.map(it => {
            const orig = (it.originalLabel || it.label || "").trim();
            const isHidden = !!(studioState.legendExcludedItems && studioState.legendExcludedItems[orig]);
            return {
                label: it.label,
                originalLabel: orig,
                color: it.color,
                fillColor: it.fillColor,
                isAsset: !!it.isAsset,
                icon: it.icon,
                imageUrl: it.imageUrl,
                isTextOnly: !!it.isTextOnly,
                isCustomPoly: !!it.isCustomPoly,
                isHiddenFromLegend: isHidden
            };
        });

        // Filter out items deleted/hidden from the boxed legend (they stay 100% on map sheet!)
        const visibleLegendItems = this.lastLegendItems.filter(it => !it.isHiddenFromLegend);
        const legendBbox = this.drawBoxedLegend(ctx, legendPxX, legendPxY, visibleLegendItems, baseRatio * legendScale, heightRatio * legendScale, legendBounds);
        legendEl._bbox = legendBbox;

        // 10. RENDER METRIC SCALE BAR
        const scaleEl = this.elements.scaleBar;
        const scalePxX = scaleEl.x * w;
        const scalePxY = scaleEl.y * h;
        const scaleScale = scaleEl.scale || 1.20;

        let approxKm = 10;
        if (lonSpan) {
            const visibleKm = lonSpan * 111.0 * cosLat;
            approxKm = Math.round(visibleKm * 0.22);
            if (approxKm < 1) approxKm = 1;
            else if (approxKm > 10) approxKm = Math.round(approxKm / 5) * 5;
        }

        const scaleBbox = this.drawScaleBar(ctx, scalePxX, scalePxY, approxKm, baseRatio * scaleScale, heightRatio * scaleScale);
        scaleEl._bbox = scaleBbox;

        // 11. ACTIVE ITEM SELECTION DASHED RING ON SCREEN
        if (!isFullRes && this.dragState.activeItem) {
            let activeBbox = null;
            if ((this.dragState.activeItem === 'asset' || this.dragState.activeItem === 'customText' || this.dragState.activeItem === 'customPoly') && this.dragState.activeAsset) {
                activeBbox = this.dragState.activeAsset._bbox;
            } else if (this.elements[this.dragState.activeItem]) {
                activeBbox = this.elements[this.dragState.activeItem]._bbox;
            }

            if (activeBbox && this.dragState.activeItem !== 'map') {
                ctx.save();
                ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
                ctx.lineWidth = 2.0;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(activeBbox.x - 4, activeBbox.y - 4, activeBbox.w + 8, activeBbox.h + 8);
                ctx.restore();
            }
        }
    },

    drawOfficialDepartmentSeal: function(ctx, x, y, baseRatio = 1.0, heightRatio = 1.0) {
        const sealSize = Math.max(36, Math.round(82 * baseRatio));
        const sealY = y - sealSize;

        if (this.sealImage && this.sealImage.complete && this.sealImage.naturalWidth > 0) {
            ctx.drawImage(this.sealImage, x, sealY, sealSize, sealSize);
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + (sealSize / 2), sealY + (sealSize / 2), sealSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = "#166534";
            ctx.fill();
            ctx.strokeStyle = "#ca8a04";
            ctx.lineWidth = Math.max(1, 2.5 * baseRatio);
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.round(sealSize * 0.24)}px ${this.MAP_FONT}`;
            ctx.textAlign = "center";
            ctx.fillText("TNFD", x + (sealSize / 2), sealY + (sealSize * 0.58));
            ctx.restore();
        }

        const textX = x + sealSize + Math.round(18 * baseRatio);
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";

        // 4 Lines:
        // Line 1: GIS CELL
        // Line 2: INFORMATION TECHNOLOGY WING
        // Line 3: STATE FOREST HEADQUARTERS
        // Line 4: CHENNAI - 600 032
        const fSize1 = Math.max(8, Math.round(15 * baseRatio));
        ctx.font = `bold ${fSize1}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, "GIS CELL", textX, y - Math.round(52 * heightRatio), 1.1 * baseRatio);

        const fSize2 = Math.max(7, Math.round(13.5 * baseRatio));
        ctx.font = `bold ${fSize2}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, "INFORMATION TECHNOLOGY WING", textX, y - Math.round(35 * heightRatio), 0.9 * baseRatio);

        const fSize3 = Math.max(6.5, Math.round(12.5 * baseRatio));
        ctx.font = `bold ${fSize3}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, "STATE FOREST HEADQUARTERS", textX, y - Math.round(18 * heightRatio), 0.8 * baseRatio);

        const fSize4 = Math.max(6.5, Math.round(12.5 * baseRatio));
        ctx.font = `bold ${fSize4}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, "CHENNAI - 600 032", textX, y - Math.round(1 * heightRatio), 0.8 * baseRatio);

        return {
            x: x,
            y: sealY,
            w: sealSize + Math.round(390 * baseRatio),
            h: sealSize
        };
    },

    drawScaleBar: function(ctx, x, y, totalKm = 10, baseRatio = 1.0, heightRatio = 1.0) {
        const barW = Math.max(70, Math.round(360 * baseRatio));
        const barH = Math.max(5, Math.round(11.5 * heightRatio));
        const segs = 5;
        const segW = barW / segs;
        const kmPerSeg = totalKm / segs;

        ctx.textAlign = "center";
        const scaleFontSize = Math.max(8, Math.round(15 * baseRatio));
        ctx.font = `bold ${scaleFontSize}px ${this.MAP_FONT}`;
        ctx.fillStyle = "#000000";

        for (let i = 0; i <= segs; i++) {
            const sx = x + (i * segW);
            const valNum = i * kmPerSeg;
            const kmVal = valNum % 1 === 0 ? String(valNum) : valNum.toFixed(1);
            ctx.fillText(kmVal, sx, y - Math.round(7 * heightRatio));
        }

        ctx.fillText("KM", x + barW + Math.round(28 * baseRatio), y + Math.round(9 * heightRatio));

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.8, 1.8 * baseRatio);
        ctx.strokeRect(x, y, barW, barH);

        for (let i = 0; i < segs; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#000000" : "#ffffff";
            ctx.fillRect(x + (i * segW), y, segW, barH);
            ctx.strokeRect(x + (i * segW), y, segW, barH);
        }

        return {
            x: x,
            y: y - 22,
            w: barW + 55,
            h: barH + 28
        };
    },

    drawNorthArrow: function(ctx, x, y, size = 80) {
        ctx.save();
        ctx.translate(x, y);

        const arrowH = size;
        const arrowW = size * 0.48;

        const letterSize = Math.max(12, Math.round(size * 0.32));
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${letterSize}px ${this.MAP_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("N", 0, -(arrowH / 2) - 4);

        const tipY = -(arrowH / 2);
        const notchY = (arrowH / 2) * 0.35;
        const wingY = (arrowH / 2) * 0.65;

        // Left half (black)
        ctx.beginPath();
        ctx.moveTo(0, tipY);
        ctx.lineTo(-arrowW / 2, wingY);
        ctx.lineTo(0, notchY);
        ctx.closePath();
        ctx.fillStyle = "#000000";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.8, size * 0.025);
        ctx.stroke();

        // Right half (white)
        ctx.beginPath();
        ctx.moveTo(0, tipY);
        ctx.lineTo(arrowW / 2, wingY);
        ctx.lineTo(0, notchY);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.8, size * 0.025);
        ctx.stroke();

        // Center spine
        ctx.beginPath();
        ctx.moveTo(0, tipY);
        ctx.lineTo(0, notchY);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.8, size * 0.025);
        ctx.stroke();

        ctx.restore();
    },

    drawNaturalAreaPatch: function(ctx, x, y, w, h, fillColor, strokeColor, isDashed, baseRatio = 1.0) {
        ctx.save();
        ctx.beginPath();
        
        // Authentic ArcGIS Desktop "Natural Area" Legend Patch Shape
        // Symmetrical organic dumbbell / bone shape with smooth rounded lobes on left and right, narrowed waist in middle
        const x0 = x, y0 = y, w0 = w, h0 = h;
        
        // Start top-left lobe
        ctx.moveTo(x0 + w0 * 0.22, y0 + h0 * 0.16);
        // Top dip towards center waist
        ctx.bezierCurveTo(x0 + w0 * 0.34, y0 + h0 * 0.18, x0 + w0 * 0.40, y0 + h0 * 0.34, x0 + w0 * 0.50, y0 + h0 * 0.34);
        // From waist to top-right lobe
        ctx.bezierCurveTo(x0 + w0 * 0.60, y0 + h0 * 0.34, x0 + w0 * 0.66, y0 + h0 * 0.18, x0 + w0 * 0.78, y0 + h0 * 0.16);
        // Right lobe rounded end cap
        ctx.bezierCurveTo(x0 + w0 * 0.94, y0 + h0 * 0.14, x0 + w0 * 0.99, y0 + h0 * 0.38, x0 + w0 * 0.96, y0 + h0 * 0.52);
        ctx.bezierCurveTo(x0 + w0 * 0.99, y0 + h0 * 0.76, x0 + w0 * 0.92, y0 + h0 * 0.86, x0 + w0 * 0.78, y0 + h0 * 0.84);
        // Bottom dip towards waist
        ctx.bezierCurveTo(x0 + w0 * 0.66, y0 + h0 * 0.82, x0 + w0 * 0.60, y0 + h0 * 0.66, x0 + w0 * 0.50, y0 + h0 * 0.66);
        // From waist to bottom-left lobe
        ctx.bezierCurveTo(x0 + w0 * 0.40, y0 + h0 * 0.66, x0 + w0 * 0.34, y0 + h0 * 0.82, x0 + w0 * 0.22, y0 + h0 * 0.84);
        // Left lobe rounded end cap
        ctx.bezierCurveTo(x0 + w0 * 0.08, y0 + h0 * 0.86, x0 + w0 * 0.01, y0 + h0 * 0.74, x0 + w0 * 0.04, y0 + h0 * 0.52);
        ctx.bezierCurveTo(x0 + w0 * 0.01, y0 + h0 * 0.30, x0 + w0 * 0.08, y0 + h0 * 0.14, x0 + w0 * 0.22, y0 + h0 * 0.16);
        ctx.closePath();

        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        } else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
            ctx.fill();
        }

        ctx.strokeStyle = strokeColor || "#000000";
        ctx.lineWidth = Math.max(1.2, 1.8 * baseRatio);
        if (isDashed) {
            ctx.setLineDash([3 * baseRatio, 2 * baseRatio]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.restore();
    },

    drawOrganicPolygonSwatch: function(ctx, x, y, w, h, fillColor, strokeColor, isDashed, baseRatio = 1.0) {
        return this.drawNaturalAreaPatch(ctx, x, y, w, h, fillColor, strokeColor, isDashed, baseRatio);
    },

    drawBoxedLegend: function(ctx, x, y, items, baseRatio = 1.0, heightRatio = 1.0, bounds = null) {
        if (!items || items.length === 0) return { x, y, w: 10, h: 10 };

        const numCols = items.length > 27 ? 4 : (items.length > 16 ? 3 : (items.length > 6 ? 2 : 1));
        const itemsPerCol = Math.ceil(items.length / numCols);
        const baseFontSize = Math.max(6.5, Math.round((numCols === 1 ? 11.5 : (numCols === 2 ? 9.8 : (numCols === 3 ? 8.6 : 7.6))) * baseRatio));
        const rowH = Math.max(14, Math.round((numCols >= 4 ? 20 : 24) * heightRatio));

        const patchW = Math.round((numCols >= 4 ? 22 : 26) * baseRatio);
        const patchH = Math.round((numCols >= 4 ? 13 : 15) * heightRatio);
        const patchGap = Math.round(7 * baseRatio);
        const padX = Math.round(12 * baseRatio);
        const colGap = Math.round((numCols >= 4 ? 10 : 14) * baseRatio);

        // Measure longest label to determine column width
        ctx.font = `normal ${baseFontSize}px ${this.MAP_FONT}`;
        let maxLabelW = 0;
        items.forEach(it => {
            const lw = ctx.measureText(it.label).width;
            if (lw > maxLabelW) maxLabelW = lw;
        });

        const neededColW = Math.ceil(maxLabelW + patchW + patchGap + Math.round(10 * baseRatio));
        let colWidth;
        if (numCols === 1) {
            colWidth = Math.max(Math.round(250 * baseRatio), Math.min(Math.round(440 * baseRatio), neededColW));
        } else if (numCols === 2) {
            colWidth = Math.max(Math.round(185 * baseRatio), Math.min(Math.round(310 * baseRatio), neededColW));
        } else if (numCols === 3) {
            colWidth = Math.max(Math.round(145 * baseRatio), Math.min(Math.round(230 * baseRatio), neededColW));
        } else {
            colWidth = Math.max(Math.round(120 * baseRatio), Math.min(Math.round(185 * baseRatio), neededColW));
        }

        const legendW = (colWidth * numCols) + (colGap * (numCols - 1)) + (padX * 2);
        const headerH = Math.round(38 * heightRatio);
        const legendH = headerH + (itemsPerCol * rowH) + Math.round(12 * heightRatio);

        let drawX = x;
        let drawY = y;
        if (bounds) {
            if (drawX + legendW > bounds.maxRight) {
                drawX = Math.max(bounds.minLeft, bounds.maxRight - legendW);
            }
            if (drawY + legendH > bounds.maxBottom) {
                drawY = Math.max(bounds.minTop, bounds.maxBottom - legendH);
            }
            if (drawX < bounds.minLeft) drawX = bounds.minLeft;
            if (drawY < bounds.minTop) drawY = bounds.minTop;
        }

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1.0, 1.8 * baseRatio);
        ctx.fillRect(drawX, drawY, legendW, legendH);
        ctx.strokeRect(drawX, drawY, legendW, legendH);

        // Legend Header Title: 10 bold black
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        const titleFontSize = Math.max(10, Math.round(13.3 * baseRatio)); // 10pt = ~13.3px
        ctx.font = `bold ${titleFontSize}px ${this.MAP_FONT}`;
        this.drawTextWithSpacing(ctx, "LEGEND", drawX + (legendW / 2), drawY + Math.round(20 * heightRatio), 1.8 * baseRatio);

        // Divider
        ctx.beginPath();
        ctx.moveTo(drawX + 10, drawY + Math.round(28 * heightRatio));
        ctx.lineTo(drawX + legendW - 10, drawY + Math.round(28 * heightRatio));
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Legend Items
        const startY = drawY + headerH + Math.round(8 * heightRatio);
        const maxTextW = colWidth - patchW - patchGap - 2;

        items.forEach((item, index) => {
            const colIdx = Math.floor(index / itemsPerCol);
            const rowInCol = index % itemsPerCol;

            const colLeft = drawX + padX + colIdx * (colWidth + colGap);
            const curY = startY + (rowInCol * rowH);
            const patchX = colLeft;
            const patchY = curY - patchH + Math.round(2 * heightRatio);

            ctx.save();
            if (item.isAsset) {
                // Asset circular badge with icon or custom image
                const badgeR = Math.min(patchW, patchH) * 0.75;
                const bcx = patchX + (patchW / 2);
                const bcy = patchY + (patchH / 2);

                ctx.beginPath();
                ctx.arc(bcx, bcy, badgeR, 0, Math.PI * 2);
                ctx.fillStyle = item.fillColor || "#ffffff";
                ctx.fill();
                ctx.strokeStyle = item.color || "#166534";
                ctx.lineWidth = Math.max(1.2, 1.8 * baseRatio);
                ctx.stroke();

                let customImg = null;
                if (item.imageUrl) customImg = this.getImage(item.imageUrl);

                if (customImg && customImg.complete && customImg.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(bcx, bcy, badgeR - (1.5 * baseRatio), 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(customImg, bcx - (badgeR - 1.5 * baseRatio), bcy - (badgeR - 1.5 * baseRatio), (badgeR - 1.5 * baseRatio) * 2, (badgeR - 1.5 * baseRatio) * 2);
                    ctx.restore();
                } else if (item.isTextOnly) {
                    ctx.font = `${Math.round(badgeR * 1.0)}px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(item.icon || "🏷️", bcx, bcy + 0.5);
                } else {
                    ctx.font = `${Math.round(badgeR * 1.1)}px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(item.icon || "📍", bcx, bcy + 0.5);
                }
            } else {
                // Polygon / boundary: EXACT ARCGIS "NATURAL AREA" PATCH SHAPE
                this.drawNaturalAreaPatch(ctx, patchX, patchY, patchW, patchH, item.fillColor, item.color, item.isCustomPoly, baseRatio);
            }
            ctx.restore();

            // Label text in 10 NOT BOLD (regular/normal) Rockwell font
            let itemFSize = Math.max(8, Math.round(13.3 * baseRatio)); // 10pt = ~13.3px
            ctx.font = `normal ${itemFSize}px ${this.MAP_FONT}`;
            while (ctx.measureText(item.label).width > maxTextW && itemFSize > 6.0) {
                itemFSize -= 0.3;
                ctx.font = `normal ${itemFSize.toFixed(1)}px ${this.MAP_FONT}`;
            }

            ctx.fillStyle = "#111111"; // Exact normal font, not bold
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(item.label, patchX + patchW + patchGap, curY);
        });

        ctx.restore();
        return { x: drawX, y: drawY, w: legendW, h: legendH };
    },

    exportHighResPDF: function(studioState) {
        const isPortrait = studioState.orientation === 'portrait';
        const finalW = isPortrait ? 2480 : 3508;
        const finalH = isPortrait ? 3508 : 2480;

        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;

        this.renderToCanvas(canvas, studioState, true);

        const jsPdfLib = window.jspdf ? window.jspdf.jsPDF : null;
        if (jsPdfLib) {
            const pdf = new jsPdfLib({
                orientation: isPortrait ? 'portrait' : 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfW = isPortrait ? 210 : 297;
            const pdfH = isPortrait ? 297 : 210;
            const imgData = canvas.toDataURL('image/jpeg', 0.96);
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
            
            let exportName = "Forest_Map";
            if (studioState.mapMode === 'range') exportName = `${this.cleanRangeName(studioState.selectedRangeName || 'Range')}_Range_Asset_Map`;
            else if (studioState.mapMode === 'state') exportName = `TNFD_State_Asset_Map`;
    else if (studioState.mapMode === 'circle') exportName = `${this.cleanCircleName(studioState.circleName || 'Circle')}_Circle_Asset_Map`;
        else if (studioState.mapMode === 'circle') exportName = `${this.cleanCircleName(studioState.circleName || 'Circle')}_Circle_Asset_Map`;
            else exportName = `${this.cleanDivisionName(studioState.divisionName || 'Division')}_Division_Asset_Map`;

            const filename = `${this.sanitizeFilename(exportName)}.pdf`;
            const pdfBlob = pdf.output('blob');
            this.saveFile(pdfBlob, filename, 'application/pdf');
        } else {
            this.exportHighResPNG(studioState);
        }
    },

    exportHighResPNG: function(studioState) {
        const isPortrait = studioState.orientation === 'portrait';
        const finalW = isPortrait ? 2480 : 3508;
        const finalH = isPortrait ? 3508 : 2480;

        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;

        this.renderToCanvas(canvas, studioState, true);

        let exportName = "Forest_Map";
        if (studioState.mapMode === 'range') exportName = `${this.cleanRangeName(studioState.selectedRangeName || 'Range')}_Range_Asset_Map`;
        else if (studioState.mapMode === 'state') exportName = `TNFD_State_Asset_Map`;
        else exportName = `${this.cleanDivisionName(studioState.divisionName || 'Division')}_Division_Asset_Map`;

        const filename = `${this.sanitizeFilename(exportName)}.png`;
        const dataUrl = canvas.toDataURL('image/png');
        this.saveFile(dataUrl, filename, 'image/png');
    },

    sanitizeFilename: function(name) {
        return (name || "Map").replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_');
    }
};

window.CartoStudio = CartoStudio;
