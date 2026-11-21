/**
 * ==============================================================================
 * TAMIL NADU FOREST DEPARTMENT (TNFD)
 * Forest Asset & Administrative Boundary Studio — Cartographic Renderer
 * ==============================================================================
 */

const CartoRenderer = {
    sealImage: null,

    initSealImage: function() {
        if (this.sealImage) return;
        if (typeof window !== "undefined" && window.TAMIL_NADU_SEAL_URI) {
            this.sealImage = new Image();
            this.sealImage.src = window.TAMIL_NADU_SEAL_URI;
        }
    },

    // Standard Forest Assets Registry
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

    RANGE_PALETTES: [
        { fill: "rgba(59, 130, 246, 0.25)", stroke: "#1d4ed8", hex: "#3b82f6" },
        { fill: "rgba(16, 185, 129, 0.25)", stroke: "#047857", hex: "#10b981" },
        { fill: "rgba(245, 158, 11, 0.25)", stroke: "#b45309", hex: "#f59e0b" },
        { fill: "rgba(139, 92, 246, 0.25)", stroke: "#6d28d9", hex: "#8b5cf6" },
        { fill: "rgba(236, 72, 153, 0.25)", stroke: "#be185d", hex: "#ec4899" },
        { fill: "rgba(20, 184, 166, 0.25)", stroke: "#0f766e", hex: "#14b8a6" },
        { fill: "rgba(249, 115, 22, 0.25)", stroke: "#c2410c", hex: "#f97316" },
        { fill: "rgba(99, 102, 241, 0.25)", stroke: "#4338ca", hex: "#6366f1" },
        { fill: "rgba(132, 204, 22, 0.25)", stroke: "#4d7c0f", hex: "#84cc16" },
        { fill: "rgba(168, 85, 247, 0.25)", stroke: "#7e22ce", hex: "#a855f7" }
    ],

    getAssetMeta: function(assetId) {
        return this.FOREST_ASSETS.find(a => a.id === assetId) || {
            id: assetId,
            name: assetId,
            icon: '📍',
            color: '#15803d',
            bg: '#dcfce7',
            category: 'General'
        };
    },

    buildPolygonPath: function(ctx, geometry, toPixel) {
        if (!geometry || !geometry.coordinates) return;
        const type = geometry.type;
        const coords = geometry.coordinates;

        ctx.beginPath();
        if (type === "Polygon") {
            for (let ring of coords) {
                for (let i = 0; i < ring.length; i++) {
                    const pt = toPixel(ring[i][0], ring[i][1]);
                    if (i === 0) ctx.moveTo(pt[0], pt[1]);
                    else ctx.lineTo(pt[0], pt[1]);
                }
                ctx.closePath();
            }
        } else if (type === "MultiPolygon") {
            for (let poly of coords) {
                for (let ring of poly) {
                    for (let i = 0; i < ring.length; i++) {
                        const pt = toPixel(ring[i][0], ring[i][1]);
                        if (i === 0) ctx.moveTo(pt[0], pt[1]);
                        else ctx.lineTo(pt[0], pt[1]);
                    }
                    ctx.closePath();
                }
            }
        }
    },

    getGeoBounds: function(geometry) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        function walk(coords) {
            if (typeof coords[0] === 'number') {
                const x = coords[0], y = coords[1];
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            } else {
                for (let c of coords) walk(c);
            }
        }
        if (geometry && geometry.coordinates) walk(geometry.coordinates);
        return [minX, minY, maxX, maxY];
    },

    getFeatureCenter: function(geometry) {
        const bounds = this.getGeoBounds(geometry);
        return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
    },

    /**
     * Core Render Function
     * Renders entire cartographic map to target HTML Canvas
     */
    render: function(canvas, state, isExport = false) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        this.initSealImage();

        const w = canvas.width;
        const h = canvas.height;
        const isPortrait = state.orientation === 'portrait';
        const baseRatio = isExport ? (w / 1400) : (w / 1000);

        ctx.clearRect(0, 0, w, h);

        // White canvas background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        // Safe margins
        const margin = Math.round(18 * baseRatio);
        const innerGap = Math.round(5 * baseRatio);

        // Header space & Footer space
        const headerSpace = Math.round(72 * baseRatio);
        const footerSpace = Math.round(62 * baseRatio);

        // Outer neatline
        ctx.strokeStyle = "#1b4332";
        ctx.lineWidth = Math.max(1.8, Math.round(3.0 * baseRatio));
        ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

        // Inner neatline
        ctx.strokeStyle = "#2d6a4f";
        ctx.lineWidth = Math.max(0.8, Math.round(1.2 * baseRatio));
        ctx.strokeRect(margin + innerGap, margin + innerGap, w - (margin + innerGap) * 2, h - (margin + innerGap) * 2);

        // Check if division is selected
        const divData = state.divisionData;
        if (!divData) {
            ctx.fillStyle = "#64748b";
            ctx.font = `600 ${Math.round(18 * baseRatio)}px 'Plus Jakarta Sans', Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText("Select a Forest Division to display cartographic map", w / 2, h / 2);
            return;
        }

        // Compute Base Geographic Extent
        let targetBounds = divData.bounds || [77, 8, 80, 13];
        let currentTargetGeom = null;

        if (state.mapMode === 'range' && state.selectedRangeName && divData.ranges && divData.ranges.features) {
            const rFeat = divData.ranges.features.find(f => (f.properties && f.properties.name) === state.selectedRangeName);
            if (rFeat && rFeat.geometry) {
                targetBounds = this.getGeoBounds(rFeat.geometry);
                currentTargetGeom = rFeat.geometry;
            }
        } else if (divData.division_boundary && divData.division_boundary.geometry) {
            targetBounds = this.getGeoBounds(divData.division_boundary.geometry);
            currentTargetGeom = divData.division_boundary.geometry;
        }

        const [minLon, minLat, maxLon, maxLat] = targetBounds;
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;

        const mapX = margin + innerGap + 2;
        const mapY = margin + headerSpace;
        const mapW = w - mapX * 2;
        const mapH = h - mapY - footerSpace - margin;

        const lonSpan = Math.max(0.001, maxLon - minLon);
        const latSpan = Math.max(0.001, maxLat - minLat);

        const cosLat = Math.cos((centerLat * Math.PI) / 180);
        const scaleX = mapW / (lonSpan * cosLat);
        const scaleY = mapH / latSpan;
        const fitScale = Math.min(scaleX * 0.88, scaleY * 0.90);
        const currentScale = fitScale * (state.mapZoom || 1.0);

        const fittedLonSpan = (mapW / currentScale) / cosLat;
        const fittedLatSpan = mapH / currentScale;

        const panX = state.panOffset ? state.panOffset.x : 0;
        const panY = state.panOffset ? state.panOffset.y : 0;

        const mapMinX = centerLon - (fittedLonSpan / 2);
        const mapMaxX = centerLon + (fittedLonSpan / 2);
        const mapMinY = centerLat - (fittedLatSpan / 2);
        const mapMaxY = centerLat + (fittedLatSpan / 2);

        function toPixel(lon, lat) {
            const px = mapX + panX + ((lon - mapMinX) / (mapMaxX - mapMinX)) * mapW;
            const py = (mapY + mapH) + panY - ((lat - mapMinY) / (mapMaxY - mapMinY)) * mapH;
            return [px, py];
        }

        function toGeo(px, py) {
            const lon = mapMinX + ((px - mapX - panX) / mapW) * (mapMaxX - mapMinX);
            const lat = mapMinY + (((mapY + mapH) + panY - py) / mapH) * (mapMaxY - mapMinY);
            return [lon, lat];
        }

        // Store active projection on state for click interactions
        state._activeProjection = {
            toPixel: toPixel,
            toGeo: toGeo,
            mapBox: { x: mapX, y: mapY, w: mapW, h: mapH }
        };

        // Clip drawing area strictly inside neatline
        ctx.save();
        ctx.beginPath();
        ctx.rect(margin + innerGap + 1, margin + innerGap + 1, w - ((margin + innerGap + 1) * 2), h - ((margin + innerGap + 1) * 2));
        ctx.clip();

        // ----------------------------------------------------------------------
        // 1. BASE GEOMETRY LAYERS
        // ----------------------------------------------------------------------
        if (state.mapMode === 'division') {
            // DIVISION MAP
            // Division Base Outline
            if (divData.division_boundary && divData.division_boundary.geometry) {
                ctx.save();
                this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.strokeStyle = "#1b4332";
                ctx.lineWidth = Math.max(1.8, Math.round(2.6 * baseRatio));
                ctx.stroke();
                ctx.restore();
            }

            // Optional 1: Range Boundaries
            if (state.showRanges && divData.ranges && divData.ranges.features) {
                divData.ranges.features.forEach((rng, rIdx) => {
                    const pal = this.RANGE_PALETTES[rIdx % this.RANGE_PALETTES.length];
                    ctx.save();
                    this.buildPolygonPath(ctx, rng.geometry, toPixel);
                    ctx.fillStyle = pal.fill;
                    ctx.fill();
                    ctx.strokeStyle = pal.stroke;
                    ctx.lineWidth = Math.max(1.2, Math.round(1.8 * baseRatio));
                    ctx.setLineDash([4 * baseRatio, 3 * baseRatio]);
                    ctx.stroke();
                    ctx.restore();

                    // Optional Range Name Label
                    if (state.showRangeLabels && rng.geometry) {
                        const center = this.getFeatureCenter(rng.geometry);
                        const pt = toPixel(center[0], center[1]);
                        const rName = (rng.properties && rng.properties.name) || "";
                        if (rName) {
                            ctx.save();
                            ctx.font = `bold ${Math.max(9, Math.round(11 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
                            ctx.lineWidth = 3;
                            ctx.strokeText(rName, pt[0], pt[1]);
                            ctx.fillStyle = "#1e3a8a";
                            ctx.fillText(rName, pt[0], pt[1]);
                            ctx.restore();
                        }
                    }
                });
            }

            // Optional 2: Reserved Forest (RF) (Green Shade)
            if (state.showRF && divData.rf && divData.rf.features) {
                divData.rf.features.forEach(rf => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rf.geometry, toPixel);
                    ctx.fillStyle = "rgba(46, 125, 50, 0.40)"; // Professional Green shade
                    ctx.fill();
                    ctx.strokeStyle = "#2e7d32";
                    ctx.lineWidth = Math.max(0.6, Math.round(1.0 * baseRatio));
                    ctx.stroke();
                    ctx.restore();
                });
                if (state.showRFLabels) {
                    this.drawPolygonLabels(ctx, divData.rf.features, toPixel, baseRatio, "#1b4332", "RF");
                }
            }

            // Optional 3: Reserved Land (RL) (Brown Shade)
            if (state.showRL && divData.rl && divData.rl.features) {
                divData.rl.features.forEach(rl => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rl.geometry, toPixel);
                    ctx.fillStyle = "rgba(141, 85, 36, 0.40)"; // Professional Brown shade
                    ctx.fill();
                    ctx.strokeStyle = "#8d5524";
                    ctx.lineWidth = Math.max(0.6, Math.round(1.0 * baseRatio));
                    ctx.stroke();
                    ctx.restore();
                });
                if (state.showRLLabels) {
                    this.drawPolygonLabels(ctx, divData.rl.features, toPixel, baseRatio, "#7c2d12", "RL");
                }
            }

        } else if (state.mapMode === 'range') {
            // RANGE MAP
            const rName = state.selectedRangeName;
            const rFeat = divData.ranges && divData.ranges.features
                ? divData.ranges.features.find(f => (f.properties && f.properties.name) === rName)
                : null;

            if (rFeat && rFeat.geometry) {
                ctx.save();
                this.buildPolygonPath(ctx, rFeat.geometry, toPixel);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.strokeStyle = "#1b4332";
                ctx.lineWidth = Math.max(2.0, Math.round(3.0 * baseRatio));
                ctx.stroke();
                ctx.restore();
            }

            // Optional 1: Reserved Forest (RF) (Green Shade) inside this range
            if (state.showRF && divData.rf && divData.rf.features) {
                const rangeRF = divData.rf.features.filter(rf => {
                    if (!rf.properties) return false;
                    const rProp = (rf.properties.range || rf.properties.RANGE || "").trim().toLowerCase();
                    const selR = (rName || "").trim().toLowerCase();
                    return rProp === selR;
                });
                rangeRF.forEach(rf => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rf.geometry, toPixel);
                    ctx.fillStyle = "rgba(46, 125, 50, 0.40)";
                    ctx.fill();
                    ctx.strokeStyle = "#2e7d32";
                    ctx.lineWidth = Math.max(0.6, Math.round(1.0 * baseRatio));
                    ctx.stroke();
                    ctx.restore();
                });
                if (state.showRFLabels) {
                    this.drawPolygonLabels(ctx, rangeRF, toPixel, baseRatio, "#1b4332", "RF");
                }
            }

            // Optional 2: Reserved Land (RL) (Brown Shade) inside this range
            if (state.showRL && divData.rl && divData.rl.features) {
                const rangeRL = divData.rl.features.filter(rl => {
                    if (!rl.properties) return false;
                    const rProp = (rl.properties.range || rl.properties.RANGE || "").trim().toLowerCase();
                    const selR = (rName || "").trim().toLowerCase();
                    return rProp === selR;
                });
                rangeRL.forEach(rl => {
                    ctx.save();
                    this.buildPolygonPath(ctx, rl.geometry, toPixel);
                    ctx.fillStyle = "rgba(141, 85, 36, 0.40)";
                    ctx.fill();
                    ctx.strokeStyle = "#8d5524";
                    ctx.lineWidth = Math.max(0.6, Math.round(1.0 * baseRatio));
                    ctx.stroke();
                    ctx.restore();
                });
                if (state.showRLLabels) {
                    this.drawPolygonLabels(ctx, rangeRL, toPixel, baseRatio, "#7c2d12", "RL");
                }
            }
        }

        // ----------------------------------------------------------------------
        // 2. CUSTOM USER POLYGONS
        // ----------------------------------------------------------------------
        if (state.customPolygons && state.customPolygons.length > 0) {
            state.customPolygons.forEach((poly, pIdx) => {
                if (poly.visible === false || !poly.coordinates || poly.coordinates.length < 3) return;
                ctx.save();
                ctx.beginPath();
                poly.coordinates.forEach((coord, cIdx) => {
                    const pt = toPixel(coord[0], coord[1]);
                    if (cIdx === 0) ctx.moveTo(pt[0], pt[1]);
                    else ctx.lineTo(pt[0], pt[1]);
                });
                ctx.closePath();

                const hexCol = poly.color || '#9333ea';
                ctx.fillStyle = poly.fillColor || `${hexCol}33`; // 20% alpha
                ctx.fill();
                ctx.strokeStyle = hexCol;
                ctx.lineWidth = Math.max(1.5, Math.round(2.2 * baseRatio));
                ctx.setLineDash([6 * baseRatio, 3 * baseRatio]);
                ctx.stroke();
                ctx.restore();

                // Draw Polygon Label
                if (poly.name) {
                    let avgLon = 0, avgLat = 0;
                    poly.coordinates.forEach(c => { avgLon += c[0]; avgLat += c[1]; });
                    avgLon /= poly.coordinates.length;
                    avgLat /= poly.coordinates.length;
                    const centerPt = toPixel(avgLon, avgLat);

                    ctx.save();
                    ctx.font = `bold ${Math.max(10, Math.round(12 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
                    ctx.lineWidth = 3.5;
                    ctx.strokeText(poly.name, centerPt[0], centerPt[1]);
                    ctx.fillStyle = hexCol;
                    ctx.fillText(poly.name, centerPt[0], centerPt[1]);
                    ctx.restore();
                }
            });
        }

        // Active Drawing Polygon Rubber-band preview
        if (state.activeDrawingPoints && state.activeDrawingPoints.length > 0) {
            ctx.save();
            ctx.beginPath();
            state.activeDrawingPoints.forEach((ptGeo, i) => {
                const pt = toPixel(ptGeo[0], ptGeo[1]);
                if (i === 0) ctx.moveTo(pt[0], pt[1]);
                else ctx.lineTo(pt[0], pt[1]);
            });
            ctx.strokeStyle = "#e11d48";
            ctx.lineWidth = Math.max(2, Math.round(2.5 * baseRatio));
            ctx.setLineDash([4 * baseRatio, 3 * baseRatio]);
            ctx.stroke();

            // Point markers
            state.activeDrawingPoints.forEach((ptGeo, i) => {
                const pt = toPixel(ptGeo[0], ptGeo[1]);
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], Math.round(5 * baseRatio), 0, Math.PI * 2);
                ctx.fillStyle = i === 0 ? "#16a34a" : "#e11d48";
                ctx.fill();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
            });
            ctx.restore();
        }

        // ----------------------------------------------------------------------
        // 3. FOREST ASSETS (SYMBOL + NORMAL BLACK FONT NAME)
        // ----------------------------------------------------------------------
        if (state.placedAssets && state.placedAssets.length > 0) {
            state.placedAssets.forEach((asset, aIdx) => {
                if (asset.visible === false) return;
                const pt = toPixel(asset.lon, asset.lat);
                const meta = this.getAssetMeta(asset.assetId);
                const badgeRadius = Math.max(12, Math.round(15 * baseRatio));

                ctx.save();
                // Outer glow / shadow
                ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
                ctx.shadowBlur = 6 * baseRatio;
                ctx.shadowOffsetY = 2 * baseRatio;

                // Circle badge background
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], badgeRadius, 0, Math.PI * 2);
                ctx.fillStyle = meta.bg || "#ffffff";
                ctx.fill();

                // Circle border
                ctx.shadowColor = "transparent";
                ctx.strokeStyle = meta.color || "#15803d";
                ctx.lineWidth = Math.max(1.8, Math.round(2.2 * baseRatio));
                ctx.stroke();

                // Inner Symbol Icon
                ctx.font = `${Math.max(11, Math.round(14 * baseRatio))}px 'Segoe UI Emoji', Arial, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(meta.icon || '📍', pt[0], pt[1] + (baseRatio * 0.5));
                ctx.restore();

                // Asset Name in Normal Black Font
                const labelText = asset.label || meta.name;
                if (labelText && state.showAssetLabels !== false) {
                    ctx.save();
                    const fontSize = Math.max(10, Math.round(11.5 * baseRatio));
                    ctx.font = `600 ${fontSize}px 'Plus Jakarta Sans', Arial, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";

                    const labelY = pt[1] + badgeRadius + Math.round(3 * baseRatio);

                    // White halo for 100% legibility on green RF/brown RL
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
                    ctx.lineWidth = Math.max(3.0, 4.0 * baseRatio);
                    ctx.lineJoin = "round";
                    ctx.strokeText(labelText, pt[0], labelY);

                    // Normal black font text as requested
                    ctx.fillStyle = "#111111";
                    ctx.fillText(labelText, pt[0], labelY);
                    ctx.restore();
                }

                // Selection ring if currently selected
                if (state.selectedAssetIndex === aIdx) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(pt[0], pt[1], badgeRadius + Math.round(5 * baseRatio), 0, Math.PI * 2);
                    ctx.strokeStyle = "#e11d48";
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([4 * baseRatio, 2 * baseRatio]);
                    ctx.stroke();
                    ctx.restore();
                }
            });
        }

        ctx.restore(); // Restore clip region

        // ----------------------------------------------------------------------
        // 4. MAP DECORATIONS: HEADER, SEAL, NORTH ARROW, SCALE BAR, LEGEND
        // ----------------------------------------------------------------------
        this.drawHeaderBanner(ctx, w, margin, headerSpace, baseRatio, state);
        this.drawOfficialSeal(ctx, margin + innerGap + Math.round(10 * baseRatio), h - footerSpace + Math.round(6 * baseRatio), baseRatio);
        this.drawNorthArrow(ctx, w - margin - innerGap - Math.round(48 * baseRatio), margin + innerGap + Math.round(55 * baseRatio), baseRatio);
        this.drawScaleBar(ctx, w / 2, h - margin - innerGap - Math.round(20 * baseRatio), currentScale, cosLat, baseRatio);
        this.drawMapLegend(ctx, w, h, margin, innerGap, baseRatio, state);
    },

    /**
     * Draw RF / RL Polygon Labels
     */
    drawPolygonLabels: function(ctx, features, toPixel, baseRatio, color, prefix) {
        if (!features) return;
        ctx.save();
        ctx.font = `bold ${Math.max(8, Math.round(9.5 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        features.forEach(f => {
            const name = (f.properties && (f.properties.name || f.properties.RF_NAME || f.properties.RL_NAME)) || "";
            if (!name || !f.geometry) return;
            const center = this.getFeatureCenter(f.geometry);
            const pt = toPixel(center[0], center[1]);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 2.8;
            ctx.strokeText(name, pt[0], pt[1]);
            ctx.fillStyle = color;
            ctx.fillText(name, pt[0], pt[1]);
        });
        ctx.restore();
    },

    /**
     * Draw Department Header Banner
     */
    drawHeaderBanner: function(ctx, w, margin, headerSpace, baseRatio, state) {
        const divName = (state.divisionData && state.divisionData.division) ? state.divisionData.division.toUpperCase() : "FOREST";
        const rangeName = state.selectedRangeName ? state.selectedRangeName.toUpperCase() : "";

        ctx.save();
        const headerY = margin + Math.round(18 * baseRatio);

        // Line 1: TAMIL NADU FOREST DEPARTMENT
        ctx.textAlign = "center";
        ctx.fillStyle = "#1b4332";
        ctx.font = `800 ${Math.max(14, Math.round(20 * baseRatio))}px 'Plus Jakarta Sans', Georgia, serif`;
        ctx.fillText("TAMIL NADU FOREST DEPARTMENT", w / 2, headerY);

        // Line 2: Division or Range Map Subtitle
        let subTitle = `${divName} DIVISION MAP`;
        if (state.mapMode === 'range' && rangeName) {
            subTitle = `${rangeName} RANGE MAP (${divName} DIVISION)`;
        }

        ctx.fillStyle = "#2d6a4f";
        ctx.font = `700 ${Math.max(11, Math.round(14 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.fillText(subTitle, w / 2, headerY + Math.round(24 * baseRatio));

        // Subtle divider line
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const lineW = Math.min(w * 0.75, Math.round(480 * baseRatio));
        ctx.moveTo((w / 2) - (lineW / 2), headerY + Math.round(36 * baseRatio));
        ctx.lineTo((w / 2) + (lineW / 2), headerY + Math.round(36 * baseRatio));
        ctx.stroke();

        ctx.restore();
    },

    /**
     * Draw Official Tamil Nadu Seal
     */
    drawOfficialSeal: function(ctx, x, y, baseRatio) {
        ctx.save();
        const sealSize = Math.max(28, Math.round(48 * baseRatio));

        if (this.sealImage && this.sealImage.complete && this.sealImage.naturalWidth > 0) {
            ctx.drawImage(this.sealImage, x, y - Math.round(6 * baseRatio), sealSize, sealSize);
        } else if (typeof window !== "undefined" && window.TAMIL_NADU_SEAL_URI) {
            const img = new Image();
            img.src = window.TAMIL_NADU_SEAL_URI;
            if (img.complete) {
                ctx.drawImage(img, x, y - Math.round(6 * baseRatio), sealSize, sealSize);
            }
        }

        const textX = x + sealSize + Math.round(10 * baseRatio);
        ctx.textAlign = "left";
        ctx.fillStyle = "#1b4332";
        ctx.font = `bold ${Math.max(8, Math.round(10 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.fillText("GOVERNMENT OF TAMIL NADU", textX, y + Math.round(12 * baseRatio));

        ctx.fillStyle = "#64748b";
        ctx.font = `500 ${Math.max(7, Math.round(8.5 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.fillText("GIS Cell — Forest Headquarters, Chennai", textX, y + Math.round(26 * baseRatio));

        ctx.restore();
    },

    /**
     * Draw Cartographic North Arrow
     */
    drawNorthArrow: function(ctx, cx, cy, baseRatio) {
        ctx.save();
        const size = Math.max(24, Math.round(38 * baseRatio));

        ctx.translate(cx, cy);

        // North Pointer
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size * 0.3, size * 0.4);
        ctx.lineTo(0, size * 0.2);
        ctx.closePath();
        ctx.fillStyle = "#1b4332";
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(-size * 0.3, size * 0.4);
        ctx.lineTo(0, size * 0.2);
        ctx.closePath();
        ctx.fillStyle = "#e2e8f0";
        ctx.fill();
        ctx.strokeStyle = "#1b4332";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 'N' label
        ctx.fillStyle = "#1b4332";
        ctx.font = `800 ${Math.max(10, Math.round(14 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("N", 0, -size * 0.55);

        ctx.restore();
    },

    /**
     * Draw Metric Scale Bar
     */
    drawScaleBar: function(ctx, cx, cy, currentScale, cosLat, baseRatio) {
        ctx.save();
        // 1 degree latitude ~= 111,320 meters
        const metersPerPixel = (111320 * cosLat) / currentScale;

        // Choose round km interval
        const targetPixelWidth = 140 * baseRatio;
        const rawMeters = targetPixelWidth * metersPerPixel;
        let km = Math.round(rawMeters / 1000);
        if (km <= 0) km = 1;
        else if (km > 10) km = Math.round(km / 5) * 5;
        else if (km > 5) km = Math.round(km / 2) * 2;

        const barWidthPx = (km * 1000) / metersPerPixel;
        const barHeight = Math.max(4, Math.round(6 * baseRatio));
        const startX = cx - (barWidthPx / 2);

        // Alternate black and white segments
        const segCount = 4;
        const segW = barWidthPx / segCount;
        for (let i = 0; i < segCount; i++) {
            ctx.fillStyle = i % 2 === 0 ? "#1b4332" : "#ffffff";
            ctx.fillRect(startX + i * segW, cy, segW, barHeight);
            ctx.strokeStyle = "#1b4332";
            ctx.lineWidth = 1;
            ctx.strokeRect(startX + i * segW, cy, segW, barHeight);
        }

        // Ticks & Labels
        ctx.fillStyle = "#334155";
        ctx.font = `600 ${Math.max(8, Math.round(9.5 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        ctx.fillText("0", startX, cy - 2);
        ctx.fillText(`${(km / 2).toFixed(km % 2 === 0 ? 0 : 1)}`, startX + (barWidthPx / 2), cy - 2);
        ctx.fillText(`${km} km`, startX + barWidthPx, cy - 2);

        ctx.restore();
    },

    /**
     * Draw Dynamic Boxed Map Legend at Bottom Right
     */
    drawMapLegend: function(ctx, w, h, margin, innerGap, baseRatio, state) {
        ctx.save();
        const legItems = [];

        // 1. Division Boundary
        legItems.push({ type: 'line', label: 'Division Boundary', color: '#1b4332', width: 3 });

        // 2. Range Boundary (if on in division mode, or in range mode)
        if (state.mapMode === 'division' && state.showRanges) {
            legItems.push({ type: 'dash', label: 'Range Boundaries', color: '#1d4ed8' });
        } else if (state.mapMode === 'range') {
            legItems.push({ type: 'fill_border', label: 'Range Boundary', fill: '#f8fafc', stroke: '#1b4332' });
        }

        // 3. Reserved Forest (RF)
        if (state.showRF) {
            legItems.push({ type: 'shade', label: 'Reserved Forest (RF)', color: '#2e7d32', fill: 'rgba(46, 125, 50, 0.40)' });
        }

        // 4. Reserved Land (RL)
        if (state.showRL) {
            legItems.push({ type: 'shade', label: 'Reserved Land (RL)', color: '#8d5524', fill: 'rgba(141, 85, 36, 0.40)' });
        }

        // 5. Placed Forest Assets
        if (state.placedAssets && state.placedAssets.length > 0) {
            const seenAssetIds = new Set();
            state.placedAssets.forEach(a => {
                if (!seenAssetIds.has(a.assetId)) {
                    seenAssetIds.add(a.assetId);
                    const meta = this.getAssetMeta(a.assetId);
                    legItems.push({
                        type: 'asset',
                        label: meta.name,
                        icon: meta.icon,
                        color: meta.color,
                        bg: meta.bg
                    });
                }
            });
        }

        // 6. Custom Polygons
        if (state.customPolygons && state.customPolygons.length > 0) {
            state.customPolygons.forEach(p => {
                if (p.visible !== false) {
                    legItems.push({
                        type: 'custom_poly',
                        label: p.name || 'Custom Polygon',
                        color: p.color || '#9333ea'
                    });
                }
            });
        }

        // Calculate Legend Dimensions
        const rowH = Math.max(16, Math.round(20 * baseRatio));
        const legW = Math.max(160, Math.round(230 * baseRatio));
        const headerH = Math.max(20, Math.round(26 * baseRatio));
        const legH = headerH + (legItems.length * rowH) + Math.round(8 * baseRatio);

        // Position: Bottom Right corner with safe padding
        const legX = w - margin - innerGap - legW - Math.round(14 * baseRatio);
        const legY = h - margin - innerGap - legH - Math.round(14 * baseRatio);

        // Legend Background Box
        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.fillRect(legX, legY, legW, legH);
        ctx.strokeStyle = "#1b4332";
        ctx.lineWidth = Math.max(1.2, Math.round(1.6 * baseRatio));
        ctx.strokeRect(legX, legY, legW, legH);

        // Legend Header Bar
        ctx.fillStyle = "#1b4332";
        ctx.fillRect(legX, legY, legW, headerH);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(9, Math.round(11 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("MAP LEGEND", legX + Math.round(10 * baseRatio), legY + (headerH / 2));

        // Legend Entries
        let curY = legY + headerH + Math.round(10 * baseRatio);
        ctx.font = `600 ${Math.max(8.5, Math.round(10 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;

        legItems.forEach(item => {
            const iconX = legX + Math.round(12 * baseRatio);
            const textX = legX + Math.round(38 * baseRatio);

            if (item.type === 'line') {
                ctx.beginPath();
                ctx.moveTo(iconX, curY);
                ctx.lineTo(iconX + Math.round(18 * baseRatio), curY);
                ctx.strokeStyle = item.color;
                ctx.lineWidth = item.width || 2;
                ctx.stroke();
            } else if (item.type === 'dash') {
                ctx.beginPath();
                ctx.moveTo(iconX, curY);
                ctx.lineTo(iconX + Math.round(18 * baseRatio), curY);
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (item.type === 'shade') {
                const bw = Math.round(18 * baseRatio);
                const bh = Math.round(10 * baseRatio);
                ctx.fillStyle = item.fill;
                ctx.fillRect(iconX, curY - (bh / 2), bw, bh);
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 1;
                ctx.strokeRect(iconX, curY - (bh / 2), bw, bh);
            } else if (item.type === 'asset') {
                const rad = Math.round(7 * baseRatio);
                ctx.beginPath();
                ctx.arc(iconX + rad, curY, rad, 0, Math.PI * 2);
                ctx.fillStyle = item.bg || "#ffffff";
                ctx.fill();
                ctx.strokeStyle = item.color || "#15803d";
                ctx.lineWidth = 1.2;
                ctx.stroke();

                ctx.font = `${Math.max(8, Math.round(9 * baseRatio))}px 'Segoe UI Emoji', Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(item.icon, iconX + rad, curY + 0.5);
                ctx.font = `600 ${Math.max(8.5, Math.round(10 * baseRatio))}px 'Plus Jakarta Sans', Arial, sans-serif`;
                ctx.textAlign = "left";
            } else if (item.type === 'custom_poly') {
                const bw = Math.round(18 * baseRatio);
                const bh = Math.round(10 * baseRatio);
                ctx.fillStyle = `${item.color}33`;
                ctx.fillRect(iconX, curY - (bh / 2), bw, bh);
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 2]);
                ctx.strokeRect(iconX, curY - (bh / 2), bw, bh);
                ctx.setLineDash([]);
            }

            // Normal black font label
            ctx.fillStyle = "#1e293b";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(item.label, textX, curY);

            curY += rowH;
        });

        ctx.restore();
    },

    /**
     * High-Resolution 300 DPI A4 PDF Export using jsPDF
     */
    exportHighResPDF: function(state, filename) {
        const isPortrait = state.orientation === 'portrait';
        // A4 300 DPI dimensions: 2480 x 3508
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = isPortrait ? 2480 : 3508;
        exportCanvas.height = isPortrait ? 3508 : 2480;

        // Render full quality
        this.render(exportCanvas, state, true);

        const imgData = exportCanvas.toDataURL('image/jpeg', 0.95);

        if (typeof window !== "undefined" && window.jspdf && window.jspdf.jsPDF) {
            const pdf = new window.jspdf.jsPDF({
                orientation: isPortrait ? 'portrait' : 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
            const pdfW = isPortrait ? 210 : 297;
            const pdfH = isPortrait ? 297 : 210;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
            pdf.save(filename || 'TNFD_Forest_Asset_Map.pdf');
        } else {
            console.error("jsPDF library not loaded");
            alert("Error: jsPDF library not found. Please ensure libs/jspdf.umd.min.js is present.");
        }
    },

    /**
     * High-Resolution JPG Export
     */
    exportHighResJPG: function(state, filename) {
        const isPortrait = state.orientation === 'portrait';
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = isPortrait ? 2480 : 3508;
        exportCanvas.height = isPortrait ? 3508 : 2480;

        this.render(exportCanvas, state, true);

        exportCanvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = filename || 'TNFD_Forest_Asset_Map.jpg';
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/jpeg', 0.95);
    },

    /**
     * High-Resolution PNG Export
     */
    exportHighResPNG: function(state, filename) {
        const isPortrait = state.orientation === 'portrait';
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = isPortrait ? 2480 : 3508;
        exportCanvas.height = isPortrait ? 3508 : 2480;

        this.render(exportCanvas, state, true);

        exportCanvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = filename || 'TNFD_Forest_Asset_Map.png';
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }
};

window.CartoRenderer = CartoRenderer;
