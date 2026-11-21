/**
 * Cartographic Engine for Administrative & RF/RL Boundary Studio
 * Features:
 * - Circle Map (Circle overview / Divisions within circle)
 * - Division Map (Division boundary + Range, Beat, RF, RL)
 * - Range Map (Cascaded filter: Circle -> Division -> Range; maps pure Range boundary + Beat, RF, RL)
 * - Two-Line Header:
 *     Line 1: "TAMIL NADU FOREST DEPARTMENT" (Bigger, Rich Cartographic Brown #78350f)
 *     Line 2: "<NAME> CIRCLE MAP" / "<NAME> DIVISION MAP" / "<NAME> RANGE MAP" (Smaller, exactly centered below middle)
 *     Independent sizing options for Line 1 and Line 2
 * - Extended Resizing & Scaling (0.3x to 3.5x) for all map items
 * - Full Draggable interactive items & High-Resolution 300 DPI A4 PDF & PNG export
 */

const CartoStudio = {
    sealImage: null,
    
    // Normalized layout element positions and default scales
    elements: {
        map: { offsetX: 0.0, offsetY: 0.0, scale: 1.0 },
        title: { x: 0.5, y: 0.065, scaleDept: 1.35, scaleSub: 0.95, scale: 1.0, align: 'center' },
        northArrow: { x: 0.93, y: 0.095, size: 85, scale: 1.15 },
        seal: { x: 0.045, y: 0.945, scale: 1.25 },
        scaleBar: { x: 0.44, y: 0.950, totalKm: 12, scale: 1.20 },
        legend: { x: 0.60, y: 0.60, scale: 1.15 }
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
            { fill: "rgba(59, 130, 246, 0.32)", stroke: "#1d4ed8", hex: "#3b82f6" },
            { fill: "rgba(16, 185, 129, 0.32)", stroke: "#047857", hex: "#10b981" },
            { fill: "rgba(245, 158, 11, 0.32)", stroke: "#b45309", hex: "#f59e0b" },
            { fill: "rgba(139, 92, 246, 0.32)", stroke: "#6d28d9", hex: "#8b5cf6" },
            { fill: "rgba(236, 72, 153, 0.32)", stroke: "#be185d", hex: "#ec4899" },
            { fill: "rgba(20, 184, 166, 0.32)", stroke: "#0f766e", hex: "#14b8a6" },
            { fill: "rgba(249, 115, 22, 0.32)", stroke: "#c2410c", hex: "#f97316" },
            { fill: "rgba(99, 102, 241, 0.32)", stroke: "#4338ca", hex: "#6366f1" },
            { fill: "rgba(132, 204, 22, 0.32)", stroke: "#4d7c0f", hex: "#84cc16" },
            { fill: "rgba(168, 85, 247, 0.32)", stroke: "#7e22ce", hex: "#a855f7" },
            { fill: "rgba(234, 179, 8, 0.32)", stroke: "#a16207", hex: "#eab308" },
            { fill: "rgba(244, 63, 94, 0.32)", stroke: "#be123c", hex: "#f43f5e" }
        ],
        beats: [
            { fill: "rgba(6, 182, 212, 0.32)", stroke: "#0e7490", hex: "#06b6d4" },
            { fill: "rgba(168, 85, 247, 0.32)", stroke: "#7e22ce", hex: "#a855f7" },
            { fill: "rgba(245, 158, 11, 0.32)", stroke: "#b45309", hex: "#f59e0b" },
            { fill: "rgba(34, 197, 94, 0.32)", stroke: "#15803d", hex: "#22c55e" },
            { fill: "rgba(236, 72, 153, 0.32)", stroke: "#be185d", hex: "#ec4899" },
            { fill: "rgba(59, 130, 246, 0.32)", stroke: "#1d4ed8", hex: "#3b82f6" },
            { fill: "rgba(249, 115, 22, 0.32)", stroke: "#c2410c", hex: "#f97316" },
            { fill: "rgba(132, 204, 22, 0.32)", stroke: "#4d7c0f", hex: "#84cc16" },
            { fill: "rgba(20, 184, 166, 0.32)", stroke: "#0f766e", hex: "#14b8a6" },
            { fill: "rgba(234, 179, 8, 0.32)", stroke: "#a16207", hex: "#eab308" },
            { fill: "rgba(244, 63, 94, 0.32)", stroke: "#be123c", hex: "#f43f5e" },
            { fill: "rgba(99, 102, 241, 0.32)", stroke: "#4338ca", hex: "#6366f1" }
        ]
    },

    getDivisionColor: function(divName, index = 0) {
        return this.PALETTES.divisions[index % this.PALETTES.divisions.length];
    },

    getRangeColor: function(rangeName, index = 0, customMap = null) {
        if (customMap && customMap[rangeName]) return customMap[rangeName];
        return this.PALETTES.ranges[index % this.PALETTES.ranges.length];
    },

    getBeatColor: function(beatName, index = 0, customMap = null) {
        if (customMap && customMap[beatName]) return customMap[beatName];
        return this.PALETTES.beats[index % this.PALETTES.beats.length];
    },

    formatFeatureLabel: function(name, suffix) {
        if (!name) return suffix;
        let clean = String(name).trim().toUpperCase();
        clean = clean.replace(new RegExp(`\\b${suffix}$`, 'i'), '').trim();
        clean = clean.replace(/\bR\.F\.$/i, '').replace(/\bR\.L\.$/i, '').trim();
        return `${clean} ${suffix}`.trim();
    },

    cleanDivisionName: function(raw) {
        if (!raw) return "DIVISION";
        let s = String(raw).trim().toUpperCase();
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
        s = s.replace(/\bFOREST\s+RANGE\b/gi, '')
             .replace(/\bRANGE\b/gi, '')
             .replace(/\bMAP\b/gi, '')
             .replace(/\s+/g, ' ')
             .trim();
        return s || String(raw).trim().toUpperCase();
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

    dragState: {
        activeItem: null,
        isDragging: false,
        startX: 0,
        startY: 0
    },

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
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
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

        // Double Neatline Border (Official Cartographic Frame)
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
        if (mapMode === 'circle' && (studioState.circleData || studioState.divisionData)) hasData = true;
        if (mapMode === 'division' && studioState.divisionData) hasData = true;
        if (mapMode === 'range' && studioState.rangeFeature) hasData = true;

        if (!hasData) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = `italic ${Math.round(22 * baseRatio)}px 'Plus Jakarta Sans', sans-serif`;
            ctx.textAlign = "center";
            let msg = "Select an administrative layer from the left panel to load the A4 Map Layout";
            if (mapMode === 'circle') msg = "Select a Forest Circle from the left panel to load the Circle Map";
            else if (mapMode === 'range') msg = "Select a Circle, Division and Range from the left panel to load the Range Map";
            ctx.fillText(msg, w / 2, h / 2);
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
        } else if (mapMode === 'circle') {
            if (studioState.circleDivisionId && studioState.circleDivisionId !== '__all__' && studioState.divisionData) {
                activeBounds = studioState.divisionData.bounds;
            } else if (studioState.circleData && studioState.circleData.bounds) {
                activeBounds = studioState.circleData.bounds;
            }
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

        // Store Map Bounding Box for dragging
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

        // RENDER LAYERS ACCORDING TO MODE
        if (mapMode === 'range') {
            // RANGE MAP MODE
            const rFeat = studioState.rangeFeature;
            const rName = studioState.selectedRangeName;
            const parentDiv = studioState.divisionData;

            // 1. Range base polygon
            ctx.save();
            this.buildPolygonPath(ctx, rFeat.geometry, toPixel);
            ctx.fillStyle = "#f8fafc";
            ctx.fill();
            ctx.restore();

            // 2. Beats of this range (Optional) - Distinct colors supported (not only boundary!)
            if (studioState.showBeat && parentDiv && parentDiv.beats && parentDiv.beats.features) {
                const rangeBeats = parentDiv.beats.features.filter(b => b.properties && b.properties.range === rName);
                const useDistinctBeats = studioState.distinctBeatColors !== false;

                rangeBeats.forEach((beat, bIdx) => {
                    const bName = (beat.properties && beat.properties.name) || `BEAT ${bIdx + 1}`;
                    const bColor = this.getBeatColor(bName, bIdx, studioState.beatColors);

                    ctx.save();
                    this.buildPolygonPath(ctx, beat.geometry, toPixel);
                    if (useDistinctBeats) {
                        ctx.fillStyle = bColor.fill;
                        ctx.fill();
                        ctx.strokeStyle = bColor.stroke;
                        ctx.lineWidth = Math.max(2.0, 3.8 * baseRatio);
                    } else {
                        ctx.fillStyle = "rgba(8, 145, 178, 0.12)";
                        ctx.fill();
                        ctx.strokeStyle = "#0891b2";
                        ctx.lineWidth = Math.max(1.8, 3.2 * baseRatio);
                        ctx.setLineDash([5 * baseRatio, 3.5 * baseRatio]);
                    }
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // 3. RF of this range (Optional or if RF names enabled)
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
                    ctx.fillStyle = "rgba(22, 163, 74, 0.45)";
                    ctx.fill();
                    ctx.strokeStyle = "#15803d";
                    ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
                if (studioState.showRFNames) {
                    this.drawFeatureLabels(ctx, rangeRF, toPixel, baseRatio, "#14532d", "RF");
                }
            }

            // 4. RL of this range (Optional or if RL names enabled)
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
                    ctx.fillStyle = "rgba(234, 88, 12, 0.45)";
                    ctx.fill();
                    ctx.strokeStyle = "#c2410c";
                    ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
                if (studioState.showRLNames) {
                    this.drawFeatureLabels(ctx, rangeRL, toPixel, baseRatio, "#7c2d12", "RL");
                }
            }

            // 5. Outer Range Boundary Stroke (Prominent & Thick)
            ctx.save();
            this.buildPolygonPath(ctx, rFeat.geometry, toPixel);
            ctx.strokeStyle = "#1e3a8a";
            ctx.lineWidth = Math.max(2.8, 5.5 * baseRatio);
            ctx.stroke();
            ctx.restore();

        } else if (mapMode === 'circle' && (!studioState.circleDivisionId || studioState.circleDivisionId === '__all__')) {
            // ENTIRE CIRCLE MODE (Multi-Division Overview)
            const cirData = studioState.circleData;
            const divisions = cirData ? cirData.divisions : [];

            // 1. Division Polygons Fill with distinct palette colors
            divisions.forEach((divObj, idx) => {
                if (divObj.division_boundary) {
                    const dColor = this.getDivisionColor(divObj.division, idx);
                    ctx.save();
                    this.buildPolygonPath(ctx, divObj.division_boundary.geometry, toPixel);
                    ctx.fillStyle = dColor.fill;
                    ctx.fill();
                    ctx.strokeStyle = dColor.stroke;
                    ctx.lineWidth = Math.max(1.2, 2.4 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                }
            });

            // 2. Ranges (Optional)
            if (studioState.showRange) {
                let globalRIdx = 0;
                divisions.forEach(divObj => {
                    if (divObj.ranges && divObj.ranges.features) {
                        divObj.ranges.features.forEach(feat => {
                            const rName = feat.properties.name;
                            const rColor = this.getRangeColor(rName, globalRIdx++, studioState.rangeColors);
                            const useDistinct = studioState.distinctRangeColors !== false;
                            ctx.save();
                            this.buildPolygonPath(ctx, feat.geometry, toPixel);
                            ctx.fillStyle = useDistinct ? rColor.fill : "rgba(37, 99, 235, 0.14)";
                            ctx.fill();
                            ctx.strokeStyle = useDistinct ? rColor.stroke : "#2563eb";
                            ctx.lineWidth = Math.max(1.8, 3.4 * baseRatio);
                            ctx.stroke();
                            ctx.restore();
                        });
                    }
                });
            }

            // 3. Beats (Optional - boundary demarcation)
            if (studioState.showBeat) {
                divisions.forEach(divObj => {
                    if (divObj.beats && divObj.beats.features) {
                        divObj.beats.features.forEach(feat => {
                            ctx.save();
                            this.buildPolygonPath(ctx, feat.geometry, toPixel);
                            ctx.strokeStyle = "#0891b2";
                            ctx.lineWidth = Math.max(1.6, 2.8 * baseRatio);
                            ctx.setLineDash([5 * baseRatio, 3.5 * baseRatio]);
                            ctx.stroke();
                            ctx.restore();
                        });
                    }
                });
            }

            // 4. RF (Optional or if RF names enabled)
            if (studioState.showRF || studioState.showRFNames || studioState.legendShowRFNames) {
                divisions.forEach(divObj => {
                    if (divObj.rf && divObj.rf.features) {
                        divObj.rf.features.forEach(feat => {
                            ctx.save();
                            this.buildPolygonPath(ctx, feat.geometry, toPixel);
                            ctx.fillStyle = "rgba(22, 163, 74, 0.40)";
                            ctx.fill();
                            ctx.strokeStyle = "#15803d";
                            ctx.lineWidth = Math.max(0.6, 1.4 * baseRatio);
                            ctx.stroke();
                            ctx.restore();
                        });
                        if (studioState.showRFNames) {
                            this.drawFeatureLabels(ctx, divObj.rf.features, toPixel, baseRatio, "#14532d", "RF");
                        }
                    }
                });
            }

            // 5. RL (Optional or if RL names enabled)
            if (studioState.showRL || studioState.showRLNames || studioState.legendShowRLNames) {
                divisions.forEach(divObj => {
                    if (divObj.rl && divObj.rl.features) {
                        divObj.rl.features.forEach(feat => {
                            ctx.save();
                            this.buildPolygonPath(ctx, feat.geometry, toPixel);
                            ctx.fillStyle = "rgba(234, 88, 12, 0.40)";
                            ctx.fill();
                            ctx.strokeStyle = "#c2410c";
                            ctx.lineWidth = Math.max(0.6, 1.4 * baseRatio);
                            ctx.stroke();
                            ctx.restore();
                        });
                        if (studioState.showRLNames) {
                            this.drawFeatureLabels(ctx, divObj.rl.features, toPixel, baseRatio, "#7c2d12", "RL");
                        }
                    }
                });
            }

            // 6. Division Boundary Outlines
            divisions.forEach(divObj => {
                if (divObj.division_boundary) {
                    ctx.save();
                    this.buildPolygonPath(ctx, divObj.division_boundary.geometry, toPixel);
                    ctx.strokeStyle = "#7f1d1d";
                    ctx.lineWidth = Math.max(1.8, 3.6 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                }
            });

        } else {
            // SINGLE DIVISION MODE (either mode === 'division' or circle single division)
            const divData = studioState.divisionData;
            if (divData && divData.division_boundary) {
                // 1. Division Base Polygon Fill
                ctx.save();
                this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
                ctx.fillStyle = "#f8fafc";
                ctx.fill();
                ctx.restore();

                // 2. Ranges (Optional) - Distinct colors fill & stroke
                if (studioState.showRange && divData.ranges && divData.ranges.features) {
                    divData.ranges.features.forEach((feat, idx) => {
                        const rName = feat.properties.name;
                        const rColor = this.getRangeColor(rName, idx, studioState.rangeColors);
                        const useDistinct = studioState.distinctRangeColors !== false;

                        ctx.save();
                        this.buildPolygonPath(ctx, feat.geometry, toPixel);
                        ctx.fillStyle = useDistinct ? rColor.fill : "rgba(37, 99, 235, 0.16)";
                        ctx.fill();
                        ctx.strokeStyle = useDistinct ? rColor.stroke : "#1d4ed8";
                        ctx.lineWidth = Math.max(2.0, 3.8 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                }

                // 3. Beats (Optional) - Distinct colors supported
                if (studioState.showBeat && divData.beats && divData.beats.features) {
                    divData.beats.features.forEach((feat, idx) => {
                        const bName = feat.properties.name;
                        const bColor = this.getBeatColor(bName, idx, studioState.beatColors);
                        const useDistinct = studioState.distinctBeatColors !== false;

                        ctx.save();
                        this.buildPolygonPath(ctx, feat.geometry, toPixel);
                        if (useDistinct) {
                            ctx.fillStyle = bColor.fill;
                            ctx.fill();
                            ctx.strokeStyle = bColor.stroke;
                            ctx.lineWidth = Math.max(1.8, 3.2 * baseRatio);
                        } else {
                            ctx.fillStyle = "rgba(8, 145, 178, 0.10)";
                            ctx.fill();
                            ctx.strokeStyle = "#0891b2";
                            ctx.lineWidth = Math.max(1.8, 3.2 * baseRatio);
                            ctx.setLineDash([5 * baseRatio, 3.5 * baseRatio]);
                        }
                        ctx.stroke();
                        ctx.restore();
                    });
                }

                // 4. RF (Optional or if RF names enabled)
                if ((studioState.showRF || studioState.showRFNames || studioState.legendShowRFNames) && divData.rf && divData.rf.features) {
                    divData.rf.features.forEach(feat => {
                        ctx.save();
                        this.buildPolygonPath(ctx, feat.geometry, toPixel);
                        ctx.fillStyle = "rgba(22, 163, 74, 0.45)";
                        ctx.fill();
                        ctx.strokeStyle = "#15803d";
                        ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                    if (studioState.showRFNames) {
                        this.drawFeatureLabels(ctx, divData.rf.features, toPixel, baseRatio, "#14532d", "RF");
                    }
                }

                // 5. RL (Optional or if RL names enabled)
                if ((studioState.showRL || studioState.showRLNames || studioState.legendShowRLNames) && divData.rl && divData.rl.features) {
                    divData.rl.features.forEach(feat => {
                        ctx.save();
                        this.buildPolygonPath(ctx, feat.geometry, toPixel);
                        ctx.fillStyle = "rgba(234, 88, 12, 0.45)";
                        ctx.fill();
                        ctx.strokeStyle = "#c2410c";
                        ctx.lineWidth = Math.max(0.7, 1.6 * baseRatio);
                        ctx.stroke();
                        ctx.restore();
                    });
                    if (studioState.showRLNames) {
                        this.drawFeatureLabels(ctx, divData.rl.features, toPixel, baseRatio, "#7c2d12", "RL");
                    }
                }

                // 6. Outer Division Boundary Stroke
                ctx.save();
                this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
                ctx.strokeStyle = "#991b1b";
                ctx.lineWidth = Math.max(2.0, 4.2 * baseRatio);
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.restore(); // Exit Map clip

        // 3. TOP HEADER: TWO LINES
        // Line 1: "TAMIL NADU FOREST DEPARTMENT" - Bigger, Brown Color (#78350f)
        // Line 2: Division / Circle / Range Map Name - Smaller, Black/Dark, exactly centered below middle
        const titleEl = this.elements.title;
        let subTitleText = "";
        if (mapMode === 'range') {
            const rName = (studioState.selectedRangeName || "RANGE").toUpperCase().trim();
            const cleanRng = this.cleanRangeName(rName);
            subTitleText = `${cleanRng} RANGE MAP`;
        } else if (mapMode === 'circle') {
            const cName = (studioState.circleName || "CIRCLE").toUpperCase().trim();
            const cleanCir = this.cleanCircleName(cName);
            subTitleText = `${cleanCir} CIRCLE MAP`;
        } else {
            const rawDiv = (studioState.divisionName || (studioState.divisionData && studioState.divisionData.division) || "DIVISION").toUpperCase().trim();
            const cleanDiv = this.cleanDivisionName(rawDiv);
            subTitleText = `${cleanDiv} DIVISION MAP`;
        }

        const titlePxX = titleEl.x * w;
        const titlePxY = titleEl.y * h;
        const scaleDept = (titleEl.scaleDept !== undefined ? titleEl.scaleDept : 1.35) * (titleEl.scale || 1.0);
        const scaleSub = (titleEl.scaleSub !== undefined ? titleEl.scaleSub : 0.95) * (titleEl.scale || 1.0);

        // Line 1: TAMIL NADU FOREST DEPARTMENT (Bigger, Rich Brown #78350f)
        const deptFontSize = Math.max(12, Math.round(26 * baseRatio * scaleDept));
        const line1Y = titlePxY - Math.round(10 * baseRatio * scaleDept);
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#78350f"; // Rich Cartographic Forest Brown
        ctx.font = `bold ${deptFontSize}px 'Times New Roman', Times, serif`;
        this.drawTextWithSpacing(ctx, "TAMIL NADU FOREST DEPARTMENT", titlePxX, line1Y, 3.2 * baseRatio * scaleDept);
        ctx.restore();

        // Line 2: DIVISION / CIRCLE / RANGE MAP (Smaller, Exactly Centered Below Middle)
        const nameFontSize = Math.max(9, Math.round(18 * baseRatio * scaleSub));
        const line2Y = titlePxY + Math.round(22 * baseRatio * scaleDept);
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#1e293b";
        ctx.font = `bold ${nameFontSize}px 'Times New Roman', Times, serif`;
        this.drawTextWithSpacing(ctx, subTitleText, titlePxX, line2Y, 2.4 * baseRatio * scaleSub);
        ctx.restore();

        // Compute exact bbox for dragging title
        ctx.save();
        ctx.font = `bold ${deptFontSize}px 'Times New Roman', Times, serif`;
        const w1 = ctx.measureText("TAMIL NADU FOREST DEPARTMENT").width + (28 * 3.2 * baseRatio * scaleDept);
        ctx.font = `bold ${nameFontSize}px 'Times New Roman', Times, serif`;
        const w2 = ctx.measureText(subTitleText).width + (subTitleText.length * 2.4 * baseRatio * scaleSub);
        ctx.restore();

        const maxHeaderW = Math.max(w1, w2);
        const headerTotalH = (line2Y - line1Y) + nameFontSize + 14;

        titleEl._bbox = {
            x: titlePxX - (maxHeaderW / 2) - 16,
            y: line1Y - deptFontSize,
            w: maxHeaderW + 32,
            h: headerTotalH
        };

        // 4. Render Cartographic North Arrow (Border-Safe Position & Size)
        const naEl = this.elements.northArrow;
        const naPxX = naEl.x * w;
        const naPxY = naEl.y * h;
        const naScale = naEl.scale || 1.15;
        const naSize = Math.max(18, Math.round((naEl.size || 85) * baseRatio * naScale));
        this.drawNorthArrow(ctx, naPxX, naPxY, naSize);
        naEl._bbox = {
            x: naPxX - (naSize * 0.42),
            y: naPxY - (naSize * 0.62) - 14,
            w: naSize * 0.84,
            h: naSize * 1.35
        };

        // 5. Render Bottom-Left Department Seal & 3-Line GIS Cell
        const sealEl = this.elements.seal;
        const sealPxX = sealEl.x * w;
        const sealPxY = sealEl.y * h;
        const sealScale = sealEl.scale || 1.25;
        const sealBbox = this.drawOfficialDepartmentSeal(ctx, sealPxX, sealPxY, baseRatio * sealScale, heightRatio * sealScale);
        sealEl._bbox = sealBbox;

        // 6. Render Dynamic Boxed Legend
        const legendEl = this.elements.legend;
        const legendItems = [];

        if (mapMode === 'range') {
            const rName = (studioState.selectedRangeName || "RANGE").toUpperCase().trim();
            const parentDiv = studioState.divisionData;

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: `${rName} RANGE`,
                    color: "#1e3a8a",
                    fillColor: "#f8fafc"
                });
            }

            // Beats in Range mode: Show distinct names and colors
            if (studioState.showBeat && parentDiv && parentDiv.beats && parentDiv.beats.features) {
                const rangeBeats = parentDiv.beats.features.filter(b => b.properties && b.properties.range === studioState.selectedRangeName);
                if (studioState.legendShowBeatNames !== false) {
                    rangeBeats.forEach((beat, idx) => {
                        const bName = (beat.properties && beat.properties.name) || `BEAT ${idx + 1}`;
                        const bColor = this.getBeatColor(bName, idx, studioState.beatColors);
                        legendItems.push({
                            label: `${bName.toUpperCase()} BEAT`,
                            color: bColor.stroke,
                            fillColor: bColor.fill,
                            isBeat: studioState.distinctBeatColors === false
                        });
                    });
                } else {
                    legendItems.push({
                        label: `BEAT BOUNDARY (${rangeBeats.length})`,
                        color: "#0891b2",
                        fillColor: "rgba(8, 145, 178, 0.12)",
                        isBeat: true
                    });
                }
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
                                fillColor: "rgba(22, 163, 74, 0.45)"
                            });
                        }
                    });
                } else if (rangeRF.length > 0) {
                    legendItems.push({
                        label: `RESERVED FOREST [RF] (${rangeRF.length})`,
                        color: "#166534",
                        fillColor: "rgba(22, 163, 74, 0.45)"
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
                                color: "#c2410c",
                                fillColor: "rgba(234, 88, 12, 0.45)"
                            });
                        }
                    });
                } else if (rangeRL.length > 0) {
                    legendItems.push({
                        label: `RESERVED LAND [RL] (${rangeRL.length})`,
                        color: "#c2410c",
                        fillColor: "rgba(234, 88, 12, 0.45)"
                    });
                }
            }

        } else if (mapMode === 'circle' && (!studioState.circleDivisionId || studioState.circleDivisionId === '__all__')) {
            const cirData = studioState.circleData;
            const divisions = cirData ? cirData.divisions : [];

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: `${(studioState.circleName || 'CIRCLE').toUpperCase()} (${divisions.length} DIVISIONS)`,
                    color: "#7f1d1d",
                    isBoundary: true
                });
            }

            // Division names according to colors in circle map
            if (studioState.legendShowDivNames !== false) {
                divisions.forEach((divObj, idx) => {
                    const rawDiv = (divObj.division || `DIVISION ${idx + 1}`).toUpperCase().trim();
                    const cleanDiv = rawDiv.replace(/ DIVISION/gi, '').trim();
                    const dColor = this.getDivisionColor(cleanDiv, idx);
                    legendItems.push({
                        label: `${cleanDiv} DIVISION`,
                        color: dColor.stroke,
                        fillColor: dColor.fill
                    });
                });
            }

            // Range names according to colors in circle map (Optional)
            if (studioState.showRange) {
                if (studioState.legendShowRangeNames !== false) {
                    let globalRIdx = 0;
                    divisions.forEach(divObj => {
                        if (divObj.ranges && divObj.ranges.features) {
                            divObj.ranges.features.forEach(feat => {
                                const rName = feat.properties.name;
                                const rColor = this.getRangeColor(rName, globalRIdx++, studioState.rangeColors);
                                legendItems.push({
                                    label: `${rName.toUpperCase()} RANGE`,
                                    color: rColor.stroke,
                                    fillColor: rColor.fill
                                });
                            });
                        }
                    });
                } else {
                    let totalR = 0;
                    divisions.forEach(d => totalR += (d.ranges ? d.ranges.features.length : 0));
                    legendItems.push({
                        label: `RANGE BOUNDARY (${totalR})`,
                        color: "#2563eb",
                        fillColor: "rgba(37, 99, 235, 0.18)"
                    });
                }
            }

            // Explicitly NO beats in Circle map legend as instructed ("for circle map add names of divisions and ranges no beats")

            if ((studioState.showRF || studioState.legendShowRFNames) && studioState.legendShowRF !== false) {
                let totalRF = 0;
                divisions.forEach(d => totalRF += (d.rf ? d.rf.features.length : 0));
                if (studioState.legendShowRFNames && totalRF > 0) {
                    const seen = new Set();
                    divisions.forEach(d => {
                        if (d.rf && d.rf.features) {
                            d.rf.features.forEach(rf => {
                                const rawName = (rf.properties && (rf.properties.name || rf.properties.NAME || rf.properties.rf_name)) || "RF";
                                const label = this.formatFeatureLabel(rawName, "RF");
                                if (!seen.has(label)) {
                                    seen.add(label);
                                    legendItems.push({
                                        label: label,
                                        color: "#166534",
                                        fillColor: "rgba(22, 163, 74, 0.40)"
                                    });
                                }
                            });
                        }
                    });
                } else if (totalRF > 0) {
                    legendItems.push({
                        label: `RESERVED FOREST [RF] (${totalRF})`,
                        color: "#166534",
                        fillColor: "rgba(22, 163, 74, 0.45)"
                    });
                }
            }
            if ((studioState.showRL || studioState.legendShowRLNames) && studioState.legendShowRL !== false) {
                let totalRL = 0;
                divisions.forEach(d => totalRL += (d.rl ? d.rl.features.length : 0));
                if (studioState.legendShowRLNames && totalRL > 0) {
                    const seenRL = new Set();
                    divisions.forEach(d => {
                        if (d.rl && d.rl.features) {
                            d.rl.features.forEach(rl => {
                                const rawName = (rl.properties && (rl.properties.name || rl.properties.NAME || rl.properties.rl_name)) || "RL";
                                const label = this.formatFeatureLabel(rawName, "RL");
                                if (!seenRL.has(label)) {
                                    seenRL.add(label);
                                    legendItems.push({
                                        label: label,
                                        color: "#c2410c",
                                        fillColor: "rgba(234, 88, 12, 0.40)"
                                    });
                                }
                            });
                        }
                    });
                } else if (totalRL > 0) {
                    legendItems.push({
                        label: `RESERVED LAND [RL] (${totalRL})`,
                        color: "#c2410c",
                        fillColor: "rgba(234, 88, 12, 0.45)"
                    });
                }
            }

        } else {
            // DIVISION MAP MODE
            const divData = studioState.divisionData;
            const rawDiv = (studioState.divisionName || (divData && divData.division) || "FOREST").toUpperCase().trim();

            if (studioState.legendShowBoundary !== false) {
                legendItems.push({
                    label: `${this.cleanDivisionName(rawDiv)} DIVISION`,
                    color: "#991b1b",
                    isBoundary: true
                });
            }

            // Range names according to colors in division map
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

            // Beat names in division map (Optional)
            if (studioState.showBeat && divData && divData.beats && divData.beats.features) {
                if (studioState.legendShowBeatNames) {
                    divData.beats.features.forEach((feat, idx) => {
                        const bName = (feat.properties && feat.properties.name) || `BEAT ${idx + 1}`;
                        const bColor = this.getBeatColor(bName, idx, studioState.beatColors);
                        legendItems.push({
                            label: `${bName.toUpperCase()} BEAT`,
                            color: bColor.stroke,
                            fillColor: bColor.fill
                        });
                    });
                } else {
                    legendItems.push({
                        label: `BEAT BOUNDARY (${divData.beats.features.length})`,
                        color: "#0891b2",
                        fillColor: "rgba(8, 145, 178, 0.12)",
                        isBeat: true
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
                                fillColor: "rgba(22, 163, 74, 0.45)"
                            });
                        }
                    });
                } else if (divData.rf.features.length > 0) {
                    legendItems.push({
                        label: `RESERVED FOREST [RF] (${divData.rf.features.length})`,
                        color: "#166534",
                        fillColor: "rgba(22, 163, 74, 0.45)"
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
                                color: "#c2410c",
                                fillColor: "rgba(234, 88, 12, 0.45)"
                            });
                        }
                    });
                } else if (divData.rl.features.length > 0) {
                    legendItems.push({
                        label: `RESERVED LAND [RL] (${divData.rl.features.length})`,
                        color: "#c2410c",
                        fillColor: "rgba(234, 88, 12, 0.45)"
                    });
                }
            }
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
        const legendBbox = this.drawBoxedLegend(ctx, legendPxX, legendPxY, legendItems, baseRatio * legendScale, heightRatio * legendScale, legendBounds);
        legendEl._bbox = legendBbox;

        // 7. Render Metric Scale Bar
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

        // 8. Visual bounding ring if item is active/dragged on screen
        if (!isFullRes && this.dragState.activeItem && this.elements[this.dragState.activeItem]) {
            const active = this.elements[this.dragState.activeItem];
            if (active._bbox && this.dragState.activeItem !== 'map') {
                ctx.save();
                ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
                ctx.lineWidth = 2.0;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(active._bbox.x - 4, active._bbox.y - 4, active._bbox.w + 8, active._bbox.h + 8);
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
            ctx.font = `bold ${Math.round(sealSize * 0.24)}px serif`;
            ctx.textAlign = "center";
            ctx.fillText("TNFD", x + (sealSize / 2), sealY + (sealSize * 0.58));
            ctx.restore();
        }

        const textX = x + sealSize + Math.round(18 * baseRatio);
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";

        const fSize1 = Math.max(8, Math.round(16.5 * baseRatio));
        ctx.font = `bold ${fSize1}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "GIS CELL", textX, y - Math.round(50 * heightRatio), 1.2 * baseRatio);

        const fSize2 = Math.max(7, Math.round(14.5 * baseRatio));
        ctx.font = `bold ${fSize2}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "INFORMATION TECHNOLOGY WING", textX, y - Math.round(27 * heightRatio), 1.0 * baseRatio);

        const fSize3 = Math.max(6, Math.round(13.5 * baseRatio));
        ctx.font = `bold ${fSize3}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "STATE FOREST HEADQUARTERS, CHENNAI", textX, y - Math.round(7 * heightRatio), 0.8 * baseRatio);

        return {
            x: x,
            y: sealY,
            w: sealSize + Math.round(410 * baseRatio),
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
        ctx.font = `bold ${scaleFontSize}px Arial, sans-serif`;
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
        ctx.font = `bold ${letterSize}px 'Times New Roman', serif`;
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

        // Center spine: strictly from tip down to the inner notch (no bottom line protruding)
        ctx.beginPath();
        ctx.moveTo(0, tipY);
        ctx.lineTo(0, notchY);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.8, size * 0.025);
        ctx.stroke();

        ctx.restore();
    },

    drawBoxedLegend: function(ctx, x, y, items, baseRatio = 1.0, heightRatio = 1.0, bounds = null) {
        if (!items || items.length === 0) return { x, y, w: 10, h: 10 };

        const numCols = items.length > 27 ? 4 : (items.length > 16 ? 3 : (items.length > 6 ? 2 : 1));
        const itemsPerCol = Math.ceil(items.length / numCols);
        const baseFontSize = Math.max(6.5, Math.round((numCols === 1 ? 11.5 : (numCols === 2 ? 9.8 : (numCols === 3 ? 8.6 : 7.6))) * baseRatio));
        const rowH = Math.max(12, Math.round((numCols >= 4 ? 18 : 22) * heightRatio));

        const patchW = Math.round((numCols >= 4 ? 16 : 20) * baseRatio);
        const patchH = Math.round((numCols >= 4 ? 10 : 12) * heightRatio);
        const patchGap = Math.round(6 * baseRatio);
        const padX = Math.round(12 * baseRatio);
        const colGap = Math.round((numCols >= 4 ? 10 : 14) * baseRatio);

        // Measure longest label to determine column width
        ctx.font = `bold ${baseFontSize}px Arial, sans-serif`;
        let maxLabelW = 0;
        items.forEach(it => {
            const lw = ctx.measureText(it.label).width;
            if (lw > maxLabelW) maxLabelW = lw;
        });

        // Determine column width based on longest item
        let colWidth;
        const neededColW = Math.ceil(maxLabelW + patchW + patchGap + Math.round(10 * baseRatio));
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

        // Clamp position within neatline bounds so right column or bottom row NEVER clips out
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

        // Title
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        const titleFontSize = Math.max(10, Math.round(18 * baseRatio));
        ctx.font = `bold ${titleFontSize}px 'Times New Roman', Times, serif`;
        this.drawTextWithSpacing(ctx, "LEGEND", drawX + (legendW / 2), drawY + Math.round(22 * heightRatio), 2.0 * baseRatio);

        // Divider
        ctx.beginPath();
        ctx.moveTo(drawX + 10, drawY + Math.round(30 * heightRatio));
        ctx.lineTo(drawX + legendW - 10, drawY + Math.round(30 * heightRatio));
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Items
        const startY = drawY + headerH + Math.round(12 * heightRatio);
        const maxTextW = colWidth - patchW - patchGap - 2;

        items.forEach((item, index) => {
            const colIdx = Math.floor(index / itemsPerCol);
            const rowInCol = index % itemsPerCol;

            const colLeft = drawX + padX + colIdx * (colWidth + colGap);
            const curY = startY + (rowInCol * rowH);
            const patchX = colLeft;
            const patchY = curY - patchH + Math.round(2 * heightRatio);

            ctx.save();
            if (item.fillColor) {
                ctx.fillStyle = item.fillColor;
                ctx.fillRect(patchX, patchY, patchW, patchH);
            }
            ctx.strokeStyle = item.color || "#000000";
            ctx.lineWidth = Math.max(1.2, 2.0 * baseRatio);
            if (item.isBeat) ctx.setLineDash([4 * baseRatio, 2.5 * baseRatio]);
            ctx.strokeRect(patchX, patchY, patchW, patchH);
            ctx.restore();

            // Auto-reduce font size per-item so FULL NAME fits completely with NO truncation
            let itemFSize = baseFontSize;
            ctx.font = `bold ${itemFSize}px Arial, sans-serif`;
            while (ctx.measureText(item.label).width > maxTextW && itemFSize > 6.0) {
                itemFSize -= 0.3;
                ctx.font = `bold ${itemFSize.toFixed(1)}px Arial, sans-serif`;
            }

            ctx.fillStyle = "#0f172a";
            ctx.textAlign = "left";
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
            
            let exportName = "Admin_Map";
            if (studioState.mapMode === 'range') exportName = `${studioState.selectedRangeName || 'Range'}_Range_Map`;
            else if (studioState.mapMode === 'circle') exportName = `${studioState.circleName || 'Circle'}_Circle_Map`;
            else exportName = `${studioState.divisionName || 'Division'}_Division_Map`;

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

        let exportName = "Admin_Map";
        if (studioState.mapMode === 'range') exportName = `${studioState.selectedRangeName || 'Range'}_Range_Map`;
        else if (studioState.mapMode === 'circle') exportName = `${studioState.circleName || 'Circle'}_Circle_Map`;
        else exportName = `${studioState.divisionName || 'Division'}_Division_Map`;

        const filename = `${this.sanitizeFilename(exportName)}.png`;
        const dataUrl = canvas.toDataURL('image/png');
        this.saveFile(dataUrl, filename, 'image/png');
    },

    sanitizeFilename: function(name) {
        return (name || "Map").replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_');
    }
};

window.CartoStudio = CartoStudio;
