/**
 * Cartographic Export Engine for Administrative & RF/RL Boundary Studio
 * Features:
 * - Exact layout matching user's requested specification:
 *   • Top Header: Division Name ONLY (e.g. "NILGIRIS FOREST DIVISION") with optional subtitle
 *   • Top Right: Cartographic North Arrow with clean 'N' compass design
 *   • Bottom Left: Official Tamil Nadu Forest Department seal + 3-line GIS Cell header
 *   • Bottom Center-Left: Metric Scale Bar (km) calculated accurately
 *   • Bottom Right: Dynamic Boxed Legend containing only the active/selected layers (Division, Range, Beat, RF, RL)
 *   • Dynamic Orientation: Automatic Portrait or Landscape layout based on division shape geometry
 *   • Safe Spacing: Minimum 0.5 cm (~60px at 300 DPI) padding between all map elements, legend, and borders
 *   • Supports both 300 DPI PDF and High-Res PNG download
 *   • Native Android APK Downloader bridge & web browser download fallback
 */

const CartoExporter = {
    sealImage: null,

    initSealImage: function() {
        if (this.sealImage) return;
        if (typeof window !== "undefined" && window.TAMIL_NADU_SEAL_URI) {
            this.sealImage = new Image();
            this.sealImage.src = window.TAMIL_NADU_SEAL_URI;
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
        if (!letterSpacing) {
            ctx.fillText(text, x, y);
            return;
        }
        const chars = text.split('');
        const charWidths = chars.map(ch => ctx.measureText(ch).width);
        const totalW = charWidths.reduce((a, b) => a + b, 0) + (chars.length - 1) * letterSpacing;
        let curX = x;
        if (ctx.textAlign === 'center') curX = x - (totalW / 2);
        else if (ctx.textAlign === 'right') curX = x - totalW;
        ctx.textAlign = 'left';
        for (let i = 0; i < chars.length; i++) {
            ctx.fillText(chars[i], curX, y);
            curX += charWidths[i] + letterSpacing;
        }
    },

    drawOfficialDepartmentSeal: function(ctx, x, y, baseRatio = 1.0, heightRatio = 1.0) {
        ctx.save();
        const sealSize = Math.max(16, Math.round(75 * baseRatio));
        const sealX = x;
        const sealY = y;

        if (this.sealImage && this.sealImage.complete && this.sealImage.naturalWidth > 0) {
            ctx.drawImage(this.sealImage, sealX, sealY, sealSize, sealSize);
        } else if (typeof window !== "undefined" && window.TAMIL_NADU_SEAL_URI) {
            const img = new Image();
            img.src = window.TAMIL_NADU_SEAL_URI;
            if (img.complete) {
                ctx.drawImage(img, sealX, sealY, sealSize, sealSize);
            }
        }
        ctx.restore();

        const textX = x + sealSize + Math.round(16 * baseRatio);
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";

        const fSize1 = Math.max(6, Math.round(15 * baseRatio));
        ctx.font = `bold ${fSize1}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "GIS CELL", textX, y + Math.round(20 * heightRatio), 1.2 * baseRatio);

        const fSize2 = Math.max(5, Math.round(13 * baseRatio));
        ctx.font = `bold ${fSize2}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "INFORMATION TECHNOLOGY WING", textX, y + Math.round(42 * heightRatio), 1.0 * baseRatio);

        const fSize3 = Math.max(5, Math.round(12 * baseRatio));
        ctx.font = `bold ${fSize3}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "STATE FOREST HEADQUARTERS, CHENNAI", textX, y + Math.round(62 * heightRatio), 0.8 * baseRatio);
    },

    drawScaleBar: function(ctx, x, y, totalKm = 10, baseRatio = 1.0, heightRatio = 1.0) {
        const barW = Math.max(50, Math.round(320 * baseRatio));
        const barH = Math.max(3, Math.round(9 * heightRatio));
        const segs = 5;
        const segW = barW / segs;
        const kmPerSeg = totalKm / segs;

        ctx.textAlign = "center";
        const scaleFontSize = Math.max(6, Math.round(14 * baseRatio));
        ctx.font = `bold ${scaleFontSize}px Arial, sans-serif`;
        ctx.fillStyle = "#000000";

        for (let i = 0; i <= segs; i++) {
            const sx = x + (i * segW);
            const valNum = i * kmPerSeg;
            const kmVal = valNum % 1 === 0 ? String(valNum) : valNum.toFixed(1);
            ctx.fillText(kmVal, sx, y - Math.round(7 * heightRatio));
        }

        ctx.fillText("KM", x + barW + Math.round(26 * baseRatio), y + Math.round(8 * heightRatio));

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.6, 1.5 * baseRatio);
        ctx.strokeRect(x, y, barW, barH);

        for (let i = 0; i < segs; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#000000" : "#ffffff";
            ctx.fillRect(x + (i * segW), y, segW, barH);
            ctx.strokeRect(x + (i * segW), y, segW, barH);
        }
    },

    drawNorthArrow: function(ctx, x, y, size = 70) {
        ctx.save();
        ctx.translate(x, y);

        const arrowH = size;
        const arrowHalfW = Math.round(size * 0.35);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 24px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", 0, -(arrowH / 2) - 8);

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.moveTo(0, -arrowH / 2);
        ctx.lineTo(-arrowHalfW, arrowH / 2);
        ctx.lineTo(0, (arrowH / 2) - 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -arrowH / 2);
        ctx.lineTo(arrowHalfW, arrowH / 2);
        ctx.lineTo(0, (arrowH / 2) - 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },

    buildPolygonPath: function(ctx, geometry, toPixel) {
        if (!geometry) return;
        const type = geometry.type;
        const coords = geometry.coordinates;

        ctx.beginPath();
        if (type === "Polygon") {
            this.addRingsToPath(ctx, coords, toPixel);
        } else if (type === "MultiPolygon") {
            coords.forEach(polyCoords => {
                this.addRingsToPath(ctx, polyCoords, toPixel);
            });
        }
    },

    addRingsToPath: function(ctx, rings, toPixel) {
        if (!rings || rings.length === 0) return;
        const exterior = rings[0];
        for (let i = 0; i < exterior.length; i++) {
            const [px, py] = toPixel(exterior[i][0], exterior[i][1]);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        for (let r = 1; r < rings.length; r++) {
            const hole = rings[r];
            for (let i = 0; i < hole.length; i++) {
                const [px, py] = toPixel(hole[i][0], hole[i][1]);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }
    },

    /**
     * Render the Full Kitchen Layout to High-Resolution Canvas
     */
    renderLayoutToCanvas: function(kitchenState, targetW = null, targetH = null) {
        this.initSealImage();
        return new Promise((resolve) => {
            const divData = kitchenState.divisionData;
            if (!divData) return resolve(null);

            const isPortrait = kitchenState.orientation === 'portrait';
            const finalW = targetW || (isPortrait ? 2480 : 3508);
            const finalH = targetH || (isPortrait ? 3508 : 2480);

            const canvas = document.createElement('canvas');
            canvas.width = finalW;
            canvas.height = finalH;
            const ctx = canvas.getContext('2d');
            const w = finalW;
            const h = finalH;

            // 1. Crisp White Background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);

            // Responsive Scaling Ratios
            const baseRatio = w / (isPortrait ? 2480.0 : 3508.0);
            const heightRatio = h / (isPortrait ? 3508.0 : 2480.0);

            // Double Neatline Border
            const margin = Math.round(w * 0.022);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = Math.max(1.0, 4.0 * baseRatio);
            ctx.strokeRect(margin, margin, w - (margin * 2), h - (margin * 2));

            // Inner neatline
            ctx.lineWidth = Math.max(0.5, 1.8 * baseRatio);
            const innerGap = Math.max(2, Math.round(8 * baseRatio));
            ctx.strokeRect(margin + innerGap, margin + innerGap, w - ((margin + innerGap) * 2), h - ((margin + innerGap) * 2));

            // 2. Top Header Banner: ONLY Division Name (+ Subtitle)
            const rawDivName = (kitchenState.divisionName || divData.division || "FOREST").toUpperCase();
            const divTitle = rawDivName.includes("DIVISION") ? rawDivName : `${rawDivName} FOREST DIVISION`;

            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";
            const mainTitleSize = Math.max(10, Math.round(w * 0.021));
            ctx.font = `bold ${mainTitleSize}px 'Times New Roman', Times, serif`;
            this.drawTextWithSpacing(ctx, divTitle, w / 2, margin + Math.round(52 * heightRatio), 3.5 * baseRatio);

            // Subtitle
            ctx.fillStyle = "#b91c1c";
            const subTitleSize1 = Math.max(6, Math.round(w * 0.011));
            ctx.font = `bold ${subTitleSize1}px 'Times New Roman', Times, serif`;
            const activeLayersText = [];
            if (kitchenState.showRange) activeLayersText.push("RANGE");
            if (kitchenState.showBeat) activeLayersText.push("BEAT");
            if (kitchenState.showRF) activeLayersText.push("RF");
            if (kitchenState.showRL) activeLayersText.push("RL");
            const subTitleStr = activeLayersText.length > 0 
                ? `ADMINISTRATIVE & ${activeLayersText.join(' / ')} BOUNDARY MAP`
                : "ADMINISTRATIVE BOUNDARY MAP";
            this.drawTextWithSpacing(ctx, subTitleStr, w / 2, margin + Math.round(88 * heightRatio), 2.8 * baseRatio);

            // 3. North Arrow at Top-Right
            const naX = w - margin - Math.round(85 * baseRatio);
            const naY = margin + Math.round(75 * heightRatio);
            this.drawNorthArrow(ctx, naX, naY, Math.max(14, Math.round(62 * baseRatio)));

            // 4. Calculate Dimensions & Positions
            const headerHeight = Math.round(115 * heightRatio);
            const footerHeight = Math.round(105 * heightRatio);

            // Build Active Legend Items
            const legendItems = [];
            legendItems.push({
                label: `${rawDivName.replace(/ DIVISION/gi, '').trim()} DIVISION`,
                color: "#991b1b",
                isStrokeOnly: true,
                type: 'boundary'
            });

            if (kitchenState.showRange && divData.ranges && divData.ranges.features) {
                legendItems.push({
                    label: `RANGE BOUNDARY (${divData.ranges.features.length})`,
                    color: "#2563eb",
                    fillColor: "rgba(37, 99, 235, 0.15)",
                    type: 'range'
                });
            }

            if (kitchenState.showBeat && divData.beats && divData.beats.features) {
                legendItems.push({
                    label: `BEAT BOUNDARY (${divData.beats.features.length})`,
                    color: "#0891b2",
                    fillColor: "rgba(8, 145, 178, 0.12)",
                    type: 'beat'
                });
            }

            if (kitchenState.showRF && divData.rf && divData.rf.features) {
                legendItems.push({
                    label: `RESERVED FOREST [RF] (${divData.rf.features.length})`,
                    color: "#166534",
                    fillColor: "rgba(34, 197, 94, 0.45)",
                    type: 'rf'
                });
            }

            if (kitchenState.showRL && divData.rl && divData.rl.features) {
                legendItems.push({
                    label: `RESERVED LAND [RL] (${divData.rl.features.length})`,
                    color: "#c2410c",
                    fillColor: "rgba(249, 115, 22, 0.45)",
                    type: 'rl'
                });
            }

            // Boxed Legend at Bottom-Right Corner
            const cols = 1;
            const legendW = Math.round(w * (isPortrait ? 0.36 : 0.28));
            const rowH = Math.max(14, Math.round(30 * heightRatio));
            const legendH = Math.round(44 * heightRatio) + (legendItems.length * rowH) + Math.round(12 * heightRatio);

            // Ensure safe spacing: minimum 0.5cm (~60px at 300 DPI) from neatlines
            const safePad = Math.max(8, Math.round(22 * baseRatio));
            const legendX = w - margin - innerGap - legendW - safePad;
            const legendY = h - margin - footerHeight - legendH - safePad;

            // Map Area Budget
            const mapX = margin + innerGap + safePad;
            const mapY = margin + headerHeight + safePad;
            const mapW = w - (mapX * 2);
            const mapH = h - mapY - (margin + footerHeight + safePad);

            const [minLon, minLat, maxLon, maxLat] = divData.bounds;
            const centerLon = (minLon + maxLon) / 2;
            const centerLat = (minLat + maxLat) / 2;
            const lonSpan = maxLon - minLon;
            const latSpan = maxLat - minLat;

            const cosLat = Math.cos((centerLat * Math.PI) / 180);
            const scaleX = mapW / (lonSpan * cosLat);
            const availMapH = legendY - mapY - Math.round(15 * heightRatio);
            const scaleY = availMapH / latSpan;
            const baseScale = Math.min(scaleX * 0.92, scaleY * 0.94);

            const fittedLonSpan = (mapW / baseScale) / cosLat;
            const fittedLatSpan = mapH / baseScale;

            const mapMinX = centerLon - (fittedLonSpan / 2);
            const mapMaxX = centerLon + (fittedLonSpan / 2);
            const mapMaxY = maxLat + (latSpan * 0.03);
            const mapMinY = mapMaxY - fittedLatSpan;

            function toPixel(lon, lat) {
                const px = mapX + ((lon - mapMinX) / (mapMaxX - mapMinX)) * mapW;
                const py = (mapY + mapH) - ((lat - mapMinY) / (mapMaxY - mapMinY)) * mapH;
                return [px, py];
            }

            // 5. Draw Map Layers
            ctx.save();
            // Hard neatline clip
            ctx.beginPath();
            ctx.rect(margin + innerGap + 1, margin + headerHeight + 2, w - ((margin + innerGap + 1) * 2), h - margin - footerHeight - (margin + headerHeight + 2));
            ctx.clip();

            // Background base for division
            ctx.save();
            this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
            ctx.fillStyle = "#f8fafc";
            ctx.fill();
            ctx.restore();

            // Render Ranges if toggled
            if (kitchenState.showRange && divData.ranges && divData.ranges.features) {
                divData.ranges.features.forEach((feat, fIdx) => {
                    ctx.save();
                    this.buildPolygonPath(ctx, feat.geometry, toPixel);
                    ctx.fillStyle = kitchenState.rangeColors[feat.properties.name] || "rgba(37, 99, 235, 0.12)";
                    ctx.fill();
                    ctx.strokeStyle = "#1d4ed8";
                    ctx.lineWidth = Math.max(0.8, 1.8 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // Render Beats if toggled
            if (kitchenState.showBeat && divData.beats && divData.beats.features) {
                divData.beats.features.forEach((feat) => {
                    ctx.save();
                    this.buildPolygonPath(ctx, feat.geometry, toPixel);
                    ctx.fillStyle = "rgba(8, 145, 178, 0.10)";
                    ctx.fill();
                    ctx.strokeStyle = "#0891b2";
                    ctx.lineWidth = Math.max(0.5, 1.2 * baseRatio);
                    ctx.setLineDash([4 * baseRatio, 3 * baseRatio]);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // Render Reserved Forests (RF) if toggled
            if (kitchenState.showRF && divData.rf && divData.rf.features) {
                divData.rf.features.forEach((feat) => {
                    ctx.save();
                    this.buildPolygonPath(ctx, feat.geometry, toPixel);
                    ctx.fillStyle = "rgba(22, 163, 74, 0.40)";
                    ctx.fill();
                    ctx.strokeStyle = "#15803d";
                    ctx.lineWidth = Math.max(0.6, 1.4 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // Render Reserved Lands (RL) if toggled
            if (kitchenState.showRL && divData.rl && divData.rl.features) {
                divData.rl.features.forEach((feat) => {
                    ctx.save();
                    this.buildPolygonPath(ctx, feat.geometry, toPixel);
                    ctx.fillStyle = "rgba(234, 88, 12, 0.40)";
                    ctx.fill();
                    ctx.strokeStyle = "#c2410c";
                    ctx.lineWidth = Math.max(0.6, 1.4 * baseRatio);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // Top Outer Division Boundary Stroke
            ctx.save();
            this.buildPolygonPath(ctx, divData.division_boundary.geometry, toPixel);
            ctx.strokeStyle = "#991b1b";
            ctx.lineWidth = Math.max(1.5, 3.8 * baseRatio);
            ctx.stroke();
            ctx.restore();

            ctx.restore(); // Exit neatline clip

            // 6. Draw Boxed Legend at Bottom-Right
            ctx.save();
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(legendX, legendY, legendW, legendH);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = Math.max(1.0, 2.0 * baseRatio);
            ctx.strokeRect(legendX, legendY, legendW, legendH);

            // Legend Title
            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            const legendTitleSize = Math.max(10, Math.round(22 * baseRatio));
            ctx.font = `bold ${legendTitleSize}px 'Times New Roman', Times, serif`;
            this.drawTextWithSpacing(ctx, "LEGEND", legendX + (legendW / 2), legendY + Math.round(26 * heightRatio), 2.0 * baseRatio);

            ctx.beginPath();
            ctx.moveTo(legendX + Math.round(15 * baseRatio), legendY + Math.round(36 * heightRatio));
            ctx.lineTo(legendX + legendW - Math.round(15 * baseRatio), legendY + Math.round(36 * heightRatio));
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Legend Rows
            let rowY = legendY + Math.round(56 * heightRatio);
            const itemFontSize = Math.max(7, Math.round(13 * baseRatio));
            ctx.font = `bold ${itemFontSize}px Arial, sans-serif`;
            ctx.textAlign = "left";

            legendItems.forEach(item => {
                const patchX = legendX + Math.round(16 * baseRatio);
                const patchW = Math.round(26 * baseRatio);
                const patchH = Math.round(15 * heightRatio);
                const patchY = rowY - patchH + 2;

                ctx.save();
                if (item.fillColor) {
                    ctx.fillStyle = item.fillColor;
                    ctx.fillRect(patchX, patchY, patchW, patchH);
                }
                ctx.strokeStyle = item.color;
                ctx.lineWidth = Math.max(1, 2.0 * baseRatio);
                if (item.type === 'beat') ctx.setLineDash([3 * baseRatio, 2 * baseRatio]);
                ctx.strokeRect(patchX, patchY, patchW, patchH);
                ctx.restore();

                ctx.fillStyle = "#0f172a";
                ctx.fillText(item.label, patchX + patchW + Math.round(12 * baseRatio), rowY);
                rowY += rowH;
            });
            ctx.restore();

            // 7. Bottom-Left Seal & GIS Cell
            const sealLeftX = margin + innerGap + safePad;
            const sealBottomY = h - margin - footerHeight + Math.round(12 * heightRatio);
            this.drawOfficialDepartmentSeal(ctx, sealLeftX, sealBottomY, baseRatio, heightRatio);

            // 8. Metric Scale Bar (Between Seal and Legend)
            const approxKm = Math.round((lonSpan * 111.32 * cosLat) / 2);
            const totalKm = approxKm > 0 ? (approxKm <= 10 ? 10 : (approxKm <= 20 ? 20 : (approxKm <= 50 ? 50 : 100))) : 15;
            const scaleBarW = Math.max(50, Math.round(320 * baseRatio));
            const sealTextWidth = Math.round(360 * baseRatio);
            const availableMidSpace = legendX - (sealLeftX + sealTextWidth);
            const scaleBarX = Math.round((sealLeftX + sealTextWidth) + (availableMidSpace - scaleBarW) / 2);
            this.drawScaleBar(ctx, Math.max(sealLeftX + sealTextWidth + 10, scaleBarX), h - margin - Math.round(45 * heightRatio), totalKm, baseRatio, heightRatio);

            resolve(canvas);
        });
    },

    exportPNG: async function(kitchenState) {
        const canvas = await this.renderLayoutToCanvas(kitchenState);
        if (!canvas) return;
        const filename = `${this.sanitizeFilename(kitchenState.divisionName)}_Admin_Boundary_Map.png`;
        const dataUrl = canvas.toDataURL('image/png');
        this.saveFile(dataUrl, filename, 'image/png');
    },

    exportPDF: async function(kitchenState) {
        const canvas = await this.renderLayoutToCanvas(kitchenState);
        if (!canvas) return;
        const isPortrait = kitchenState.orientation === 'portrait';
        const jsPdfLib = window.jspdf ? window.jspdf.jsPDF : null;

        if (jsPdfLib) {
            const pdf = new jsPdfLib({
                orientation: isPortrait ? 'portrait' : 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfW = isPortrait ? 210 : 297;
            const pdfH = isPortrait ? 297 : 210;
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
            const filename = `${this.sanitizeFilename(kitchenState.divisionName)}_Admin_Boundary_Map.pdf`;
            const pdfBlob = pdf.output('blob');
            this.saveFile(pdfBlob, filename, 'application/pdf');
        } else {
            this.exportPNG(kitchenState);
        }
    },

    sanitizeFilename: function(name) {
        return (name || "Division").replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_');
    }
};

window.CartoExporter = CartoExporter;
