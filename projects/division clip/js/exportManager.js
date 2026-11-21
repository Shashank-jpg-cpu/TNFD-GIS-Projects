/**
 * Export Manager Module - Fixed Layout 300 DPI Cartographic Engine
 * Top-Right North Arrow & Bottom-Right Legend with Scaled-Down Map Polygon
 */

const ExportManager = {
    sealImage: null,

    initSealImage: function() {
        if (this.sealImage) return;
        if (typeof window !== "undefined" && window.TAMIL_NADU_SEAL_URI) {
            this.sealImage = new Image();
            this.sealImage.src = window.TAMIL_NADU_SEAL_URI;
        }
    },

    /**
     * Native Android Downloader or Browser FileSaver Helper
     */
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
        if (typeof saveAs !== "undefined" && blobOrDataUrl instanceof Blob) {
            saveAs(blobOrDataUrl, filename);
        } else {
            const link = document.createElement('a');
            link.download = filename;
            link.href = typeof blobOrDataUrl === 'string' ? blobOrDataUrl : URL.createObjectURL(blobOrDataUrl);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            if (typeof blobOrDataUrl !== 'string') {
                setTimeout(() => URL.revokeObjectURL(link.href), 10000);
            }
        }
    },

    /**
     * Download High-Resolution JPG Map
     */
    downloadDivisionJPG: async function(division) {
        try {
            this.initSealImage();
            const isPortrait = division.stats && division.stats.isPortrait;
            const canvasW = isPortrait ? 2480 : 3508;
            const canvasH = isPortrait ? 3508 : 2480;

            const canvas = await this.renderDivisionToCanvas(division, canvasW, canvasH);
            const mapType = division.isLULC ? "LULC_Map" : (division.isFCM ? "Forest_Cover_Map" : "Forest_Type_Map");
            const filename = `${ExportManager.sanitizeFilename(division.name)}_${mapType}.jpg`;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
            this.saveFile(dataUrl, filename, 'image/jpeg');
        } catch (err) {
            console.error("JPG export error:", err);
            alert("JPG export error: " + err.message);
        }
    },

    /**
     * Download Formatted A4 PDF Report
     */
    downloadDivisionPDF: async function(division) {
        try {
            this.initSealImage();
            const jspdfModule = window.jspdf || (typeof jsPDF !== "undefined" ? { jsPDF: window.jsPDF } : null);
            const jsPDF = jspdfModule ? jspdfModule.jsPDF : null;
            
            if (!jsPDF) {
                console.error("jsPDF library not loaded");
                alert("jsPDF library not loaded. Please try downloading JPG.");
                return;
            }

            const isPortrait = division.stats && division.stats.isPortrait;
            const doc = new jsPDF({
                orientation: isPortrait ? 'portrait' : 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const canvasW = isPortrait ? 2480 : 3508;
            const canvasH = isPortrait ? 3508 : 2480;

            const canvas = await this.renderDivisionToCanvas(division, canvasW, canvasH);
            const mapImgData = canvas.toDataURL('image/jpeg', 0.95);
            const mapType = division.isLULC ? "LULC_Map" : (division.isFCM ? "Forest_Cover_Map" : "Forest_Type_Map");
            const filename = `${ExportManager.sanitizeFilename(division.name)}_${mapType}.pdf`;

            doc.addImage(mapImgData, 'JPEG', 4, 4, pageWidth - 8, pageHeight - 8);

            if (typeof window !== "undefined" && window.AndroidBlobDownloader) {
                const pdfDataUri = doc.output('datauristring');
                window.AndroidBlobDownloader.getBase64FromBlobData(pdfDataUri, filename, 'application/pdf');
            } else {
                doc.save(filename);
            }
        } catch (err) {
            console.error("PDF export error:", err);
            alert("PDF export error: " + err.message);
        }
    },

    /**
     * Download QGIS Editable Package (.geojson boundary + .qpt layout template)
     */
    downloadQGISEditable: function(division) {
        try {
            const safeName = ExportManager.sanitizeFilename(division.name);
            const qptXml = this.generateQGISLayoutTemplate(division);
            const filename = `${safeName}_QGIS_Layout.qpt`;
            const qptBlob = new Blob([qptXml], { type: "application/x-qgis-project" });
            if (typeof saveAs !== "undefined") {
                saveAs(qptBlob, filename);
            } else {
                const link = document.createElement('a');
                link.download = filename;
                link.href = URL.createObjectURL(qptBlob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(link.href), 10000);
            }
        } catch (err) {
            console.error("QGIS export error:", err);
            alert("QGIS layout export error: " + err.message);
        }
    },

    /**
     * Generate Full Compliant QGIS 3.x XML Print Layout Template (.qpt)
     * Automatically formats for Portrait A4 (210 x 297 mm) or Landscape A4 (297 x 210 mm)
     */
    generateQGISLayoutTemplate: function(division) {
        const titleStr = this.formatDivisionTitle(division.rawName || division.name);
        const [minX, minY, maxX, maxY] = division.stats.bbox || (typeof turf !== "undefined" && division.adminFeature ? turf.bbox(division.adminFeature) : [76.228, 8.077, 80.342, 13.585]);
        const isPortrait = division.stats && division.stats.isPortrait;

        // Add 5% padding
        const dx = (maxX - minX) * 0.05;
        const dy = (maxY - minY) * 0.05;
        const xmin = minX - dx;
        const xmax = maxX + dx;
        const ymin = minY - dy;
        const ymax = maxY + dy;

        let pw, ph, title_x, title_y, title_w, title_h, na_x, na_y, map_x, map_y, map_w, map_h, leg_x, leg_y, leg_w, leg_h, scale_x, scale_y, dept_x, dept_y;

        if (isPortrait) {
            pw = 210; ph = 297;
            title_x = 10; title_y = 8; title_w = 190; title_h = 18;
            na_x = 182; na_y = 8;
            
            map_x = 10; map_y = 28;
            map_w = 190; map_h = 230; // 28 + 230 = 258mm (fits strictly inside 297mm page)
            
            leg_w = 100; leg_h = 50;
            leg_x = 100; leg_y = 206; // Bottom right of map
            
            scale_x = 75; scale_y = 268;
            dept_x = 10; dept_y = 264;
        } else {
            pw = 297; ph = 210;
            title_x = 15; title_y = 8; title_w = 267; title_h = 16;
            na_x = 268; na_y = 8;
            
            map_x = 10; map_y = 26;
            map_w = 277; map_h = 145; // 26 + 145 = 171mm (fits strictly inside 210mm page)
            
            leg_w = 112; leg_h = 52;
            leg_x = 172; leg_y = 116; // Bottom right inside map
            
            scale_x = 110; scale_y = 180;
            dept_x = 12; dept_y = 178;
        }

        return `<!DOCTYPE qgis-print-layout>
<Layout units="mm" name="${titleStr}" printResolution="300" worldFileMap="">
 <Snapper snapToGuides="1" snapToItems="1" snapToGrid="0" tolerance="5"/>
 <PageCollection>
  <symbol name="" type="fill" alpha="1" clip_to_extent="1" force_rhr="0">
   <data_defined_properties>
    <Option type="Map">
     <Option name="name" type="QString" value=""/>
     <Option name="properties"/>
     <Option name="type" type="QString" value="collection"/>
    </Option>
   </data_defined_properties>
   <layer pass="0" class="SimpleFill" enabled="1" locked="0">
    <Option type="Map">
     <Option name="color" type="QString" value="255,255,255,255"/>
     <Option name="style" type="QString" value="solid"/>
    </Option>
   </layer>
  </symbol>
  <LayoutItem type="65638" position="0,0,mm" size="${pw},${ph},mm" page="1" frame="false" id="" opacity="1" positionOnPage="0,0,mm" outlineWidthM="0.3,mm" referencePoint="0" blendMode="0" templateUuid="{11111111-1111-1111-1111-111111111111}" zValue="0">
  </LayoutItem>
 </PageCollection>

 <!-- Header Title Banner -->
 <LayoutItem type="65641" position="${title_x},${title_y},mm" size="${title_w},${title_h},mm" page="1" frame="false" id="Title" opacity="1" positionOnPage="${title_x},${title_y},mm" referencePoint="0" blendMode="0" templateUuid="{33333333-3333-3333-3333-333333333333}" zValue="5" halign="4" valign="128" marginX="0" marginY="0" labelText="${titleStr}&#10;FOREST TYPE MAP - 2023&#10;(BASED ON FSI - ISFR)">
  <FontDescription font="Times New Roman" size="13" bold="1" italic="0"/>
 </LayoutItem>

 <!-- North Arrow (Top Right) -->
 <LayoutItem type="65640" position="${na_x},${na_y},mm" size="18,18,mm" page="1" frame="false" id="NorthArrow" opacity="1" positionOnPage="${na_x},${na_y},mm" referencePoint="0" blendMode="0" templateUuid="{44444444-4444-4444-4444-444444444444}" zValue="6" picturePath="arrows/NorthArrow_02.svg" mode="0" resizeMode="0">
 </LayoutItem>

 <!-- Map Viewport with Clean Outer Neatline Border & EPSG:4326 Extent -->
 <LayoutItem type="65639" position="${map_x},${map_y},mm" size="${map_w},${map_h},mm" page="1" frame="true" id="Map 1" opacity="1" positionOnPage="${map_x},${map_y},mm" outlineWidthM="0.6,mm" referencePoint="0" blendMode="0" templateUuid="{55555555-5555-5555-5555-555555555555}" zValue="2" mapFlags="0" followPreset="false" keepLayerSet="false" drawCanvasItems="true">
  <Extent xmin="${xmin}" ymin="${ymin}" xmax="${xmax}" ymax="${ymax}"/>
  <spatialRefSys>
   <wkt>GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],ID["EPSG",4326]]</wkt>
   <proj4>+proj=longlat +datum=WGS84 +no_defs</proj4>
   <srsid>3452</srsid>
   <srid>4326</srid>
   <authid>EPSG:4326</authid>
   <description>WGS 84</description>
   <projectionacronym>longlat</projectionacronym>
   <ellipsoidacronym>EPSG:7030</ellipsoidacronym>
   <geographicflag>true</geographicflag>
  </spatialRefSys>
 </LayoutItem>

 <!-- Legend Box (Fixed Bottom Right with White Opaque Background) -->
 <LayoutItem type="65642" position="${leg_x},${leg_y},mm" size="${leg_w},${leg_h},mm" page="1" frame="true" id="Legend" opacity="1" positionOnPage="${leg_x},${leg_y},mm" outlineWidthM="0.4,mm" referencePoint="0" blendMode="0" templateUuid="{66666666-6666-6666-6666-666666666666}" zValue="7" title="LEGEND" columnCount="2" splitLayer="0" equalColumnWidth="1" map_uuid="{55555555-5555-5555-5555-555555555555}">
  <symbol name="" type="fill" alpha="1" clip_to_extent="1" force_rhr="0">
   <layer pass="0" class="SimpleFill" enabled="1" locked="0">
    <Option type="Map">
     <Option name="color" type="QString" value="255,255,255,255"/>
     <Option name="style" type="QString" value="solid"/>
    </Option>
   </layer>
  </symbol>
 </LayoutItem>

 <!-- Metric Scale Bar (0 to 12 KM) -->
 <LayoutItem type="65646" position="${scale_x},${scale_y},mm" size="65,10,mm" page="1" frame="false" id="ScaleBar" opacity="1" positionOnPage="${scale_x},${scale_y},mm" referencePoint="0" blendMode="0" templateUuid="{77777777-7777-7777-7777-777777777777}" zValue="8" numSegments="6" numSegmentsLeft="0" numUnitsPerSegment="2" unitType="km" segmentMillimeters="8" map_uuid="{55555555-5555-5555-5555-555555555555}">
 </LayoutItem>

 <!-- Official Department Footer (Bottom Left) -->
 <LayoutItem type="65641" position="${dept_x},${dept_y},mm" size="75,14,mm" page="1" frame="false" id="Department" opacity="1" positionOnPage="${dept_x},${dept_y},mm" referencePoint="0" blendMode="0" templateUuid="{88888888-8888-8888-8888-888888888888}" zValue="9" halign="1" valign="128" marginX="0" marginY="0" labelText="GIS CELL&#10;INFORMATION TECHNOLOGY WING&#10;STATE FOREST HEADQUARTERS&#10;CHENNAI - 600 032">
  <FontDescription font="Times New Roman" size="7" bold="1" italic="0"/>
 </LayoutItem>

</Layout>`;
    },

    /**
     * Download All 46 Divisions as a packaged ZIP archive with PDF, JPG, GeoJSON & QGIS Templates
     */
    downloadAllAsZip: async function(divisionsList, onProgress) {
        this.initSealImage();
        if (!divisionsList || divisionsList.length === 0) {
            throw new Error("No extracted divisions to export.");
        }

        const zip = new JSZip();
        const jpgFolder = zip.folder("JPG_Forest_Maps");
        const pdfFolder = zip.folder("PDF_Forest_Reports");
        const qgisFolder = zip.folder("QGIS_Editable_Layouts_QPT");
        const boundaryFolder = zip.folder("Division_Boundaries_GeoJSON");

        const total = divisionsList.length;

        for (let i = 0; i < total; i++) {
            const division = divisionsList[i];
            const safeName = ExportManager.sanitizeFilename(division.name);

            // 1. 300 DPI Print Canvas (JPG)
            const isPortrait = division.stats && division.stats.isPortrait;
            const canvasW = isPortrait ? 2480 : 3508;
            const canvasH = isPortrait ? 3508 : 2480;

            const canvas = await this.renderDivisionToCanvas(division, canvasW, canvasH);
            const jpgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
            jpgFolder.file(`${safeName}_Forest_Type_Map.jpg`, jpgBlob);

            // 2. Official PDF Report
            const pdfBlob = await this.generatePDFBlob(division);
            pdfFolder.file(`${safeName}_Forest_Type_Map.pdf`, pdfBlob);

            // 3. QGIS Layout Template (.qpt)
            const qptXml = this.generateQGISLayoutTemplate(division);
            qgisFolder.file(`${safeName}_Layout.qpt`, qptXml);

            // 4. Boundary GeoJSON
            const geojson = {
                type: "FeatureCollection",
                name: `${safeName}_Boundary`,
                features: [division.adminFeature]
            };
            boundaryFolder.file(`${safeName}.geojson`, JSON.stringify(geojson, null, 2));

            if (onProgress && typeof onProgress === 'function') {
                const percent = Math.round(((i + 1) / total) * 100);
                onProgress(percent, i + 1, total, division.name);
            }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        this.saveFile(zipBlob, `Tamil_Nadu_Forest_Divisions_Maps_2023.zip`, 'application/zip');
    },

    generatePDFBlob: async function(division) {
        const { jsPDF } = window.jspdf;
        const isPortrait = division.stats && division.stats.isPortrait;

        const doc = new jsPDF({
            orientation: isPortrait ? 'portrait' : 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const canvasW = isPortrait ? 2480 : 3508;
        const canvasH = isPortrait ? 3508 : 2480;

        const canvas = await this.renderDivisionToCanvas(division, canvasW, canvasH);
        const mapImgData = canvas.toDataURL('image/jpeg', 0.98);

        doc.addImage(mapImgData, 'JPEG', 4, 4, pageWidth - 8, pageHeight - 8);
        return doc.output('blob');
    },

    formatDivisionTitle: function(rawName) {
        if (!rawName) return "FOREST DIVISION";
        let clean = String(rawName).trim().toUpperCase();

        clean = clean.replace(/_/g, ' ').replace(/\s+/g, ' ');

        if (clean.endsWith(" DIVISION")) {
            const base = clean.substring(0, clean.length - 9).trim();
            return `${base} FOREST DIVISION`;
        } else if (clean.endsWith(" FOREST DIVISION")) {
            return clean;
        } else {
            return `${clean} FOREST DIVISION`;
        }
    },

    cleanForestTypeName: function(rawName) {
        if (!rawName) return "";
        let clean = String(rawName).trim();
        clean = clean.replace(/UMBERLLA/gi, 'UMBRELLA');
        clean = clean.replace(/TOF\/PLANTATION/gi, 'TOF / PLANTATION');
        return clean.trim() || rawName;
    },

    drawTextWithSpacing: function(ctx, text, x, y, letterSpacing) {
        if (!letterSpacing || letterSpacing <= 0) {
            ctx.fillText(text, x, y);
            return;
        }
        const characters = String(text).split("");
        let totalWidth = 0;
        const charWidths = characters.map(c => {
            const w = ctx.measureText(c).width;
            totalWidth += w;
            return w;
        });
        totalWidth += (characters.length - 1) * letterSpacing;

        let startX = x;
        if (ctx.textAlign === "center") {
            startX = x - (totalWidth / 2);
        } else if (ctx.textAlign === "right") {
            startX = x - totalWidth;
        }

        const prevAlign = ctx.textAlign;
        ctx.textAlign = "left";
        let curX = startX;
        for (let i = 0; i < characters.length; i++) {
            ctx.fillText(characters[i], curX, y);
            curX += charWidths[i] + letterSpacing;
        }
        ctx.textAlign = prevAlign;
    },

    /**
     * Render Division Map with Reduced Map Size, Fixed Top-Right North Arrow, and Fixed Bottom-Right Legend
     */
    renderDivisionToCanvas: function(division, width = null, height = null) {
        this.initSealImage();
        return new Promise((resolve) => {
            const isPortrait = (division.stats && division.stats.isPortrait) !== undefined ? division.stats.isPortrait : (width ? width < height : false);
            const finalW = width || (isPortrait ? 2480 : 3508);
            const finalH = height || (isPortrait ? 3508 : 2480);

            const canvas = document.createElement('canvas');
            canvas.width = finalW;
            canvas.height = finalH;
            const ctx = canvas.getContext('2d');
            const w = finalW;
            const h = finalH;

            // 1. Crisp White Background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);

            // 2. Responsive Scaling Ratios (Shape-Aware)
            const baseRatio = w / (isPortrait ? 2480.0 : 3508.0);
            const heightRatio = h / (isPortrait ? 3508.0 : 2480.0);

            // Double Neatline Border
            const margin = Math.round(w * 0.022); // ~55px at 3508
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = Math.max(1.0, 4.0 * baseRatio);
            ctx.strokeRect(margin, margin, w - (margin * 2), h - (margin * 2));

            // Inner neatline
            ctx.lineWidth = Math.max(0.5, 1.8 * baseRatio);
            const innerGap = Math.max(2, Math.round(8 * baseRatio));
            ctx.strokeRect(margin + innerGap, margin + innerGap, w - ((margin + innerGap) * 2), h - ((margin + innerGap) * 2));

            // 3. Top Header Banner
            const titleStr = division.isLULC ? `${(division.rawName || division.name).replace(/ DIVISION/gi, '').trim()} Division LULC` : this.formatDivisionTitle(division.rawName || division.name);

            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";
            const mainTitleSize = Math.max(7, Math.round(w * 0.019));
            ctx.font = `bold ${mainTitleSize}px 'Times New Roman', Times, serif`;
            this.drawTextWithSpacing(ctx, titleStr, w / 2, margin + Math.round(58 * heightRatio), 4.0 * baseRatio);

            // Subtitles
            ctx.fillStyle = "#b91c1c";
            const subTitleSize1 = Math.max(5, Math.round(w * 0.0115));
            ctx.font = `bold ${subTitleSize1}px 'Times New Roman', Times, serif`;
            const subtitle1 = division.isLULC ? "LAND USE / LAND COVER MAP - 2024" : (division.isFCM ? "FOREST COVER MAP - 2023" : "FOREST TYPE MAP - 2023");
            this.drawTextWithSpacing(ctx, subtitle1, w / 2, margin + Math.round(96 * heightRatio), 3.2 * baseRatio);

            ctx.fillStyle = "#000000";
            const subTitleSize2 = Math.max(4, Math.round(w * 0.0095));
            ctx.font = `bold ${subTitleSize2}px 'Times New Roman', Times, serif`;
            const subtitle2 = division.isLULC ? "(BASED ON SISDP - TNGIS)" : "(BASED ON FSI - ISFR)";
            this.drawTextWithSpacing(ctx, subtitle2, w / 2, margin + Math.round(124 * heightRatio), 2.5 * baseRatio);

            // 4. North Arrow FIXED AT TOP RIGHT ONLY (Scaled)
            const naX = w - margin - Math.round(90 * baseRatio);
            const naY = margin + Math.round(80 * heightRatio);
            this.drawNorthArrow(ctx, naX, naY, Math.max(14, Math.round(65 * baseRatio)));

            // 5. Layout Vertical Budgeting & Clean Symmetrical Map Frame
            const headerHeight = Math.round(135 * heightRatio);
            const footerHeight = Math.round(110 * heightRatio);

            const isLULC = division.isLULC;
            const isFCM = division.isFCM;
            const rawClasses = division.presentClasses || (isLULC ? SpatialClipper.lulcClasses : (isFCM ? SpatialClipper.fcmClasses : SpatialClipper.forestClasses));
            const classes = rawClasses.filter(c => c.id !== 0 && (c.areaHa === undefined || c.areaHa > 0));
            const subTitle = isLULC ? `${(division.rawName || division.name).toLowerCase().replace(/ division/gi, '')}_complete` : "";
            const totalLegendItemCount = classes.length + 1;
            
            // Legend Box positioned in Bottom-Right Corner (Large, Highly Readable)
            const cols = totalLegendItemCount > 14 ? 3 : 2;
            const legendW = Math.round(w * (isPortrait ? (cols === 3 ? 0.68 : 0.52) : (cols === 3 ? 0.58 : 0.44)));
            const numRows = Math.ceil(totalLegendItemCount / cols);
            const rowH = Math.max(12, Math.round((cols === 3 ? 28 : 36) * heightRatio));
            const legendH = Math.round(54 * heightRatio) + (numRows * rowH) + Math.round(16 * heightRatio);

            const legendX = w - margin - innerGap - legendW - Math.max(2, Math.round(8 * baseRatio));
            const legendY = h - margin - footerHeight - legendH - Math.max(2, Math.round(4 * baseRatio));

            const mapX = margin + innerGap + Math.max(2, Math.round(8 * baseRatio));
            const mapY = margin + headerHeight + Math.max(2, Math.round(4 * baseRatio));
            const mapW = w - (mapX * 2);
            const mapH = h - mapY - (margin + footerHeight + Math.max(2, Math.round(4 * baseRatio)));

            const bbox = division.stats.bbox || turf.bbox(division.adminFeature);
            const [minLon, minLat, maxLon, maxLat] = bbox;
            const centerLon = (minLon + maxLon) / 2;
            const centerLat = (minLat + maxLat) / 2;
            const lonSpan = maxLon - minLon;
            const latSpan = maxLat - minLat;

            const cosLat = Math.cos((centerLat * Math.PI) / 180);
            const scaleX = mapW / (lonSpan * cosLat);
            const availMapH = legendY - mapY - Math.round(15 * heightRatio);
            const scaleY = availMapH / latSpan;
            const baseScale = Math.min(scaleX * 0.94, scaleY * 0.96);

            // Extract coordinates for collision check
            const divisionCoords = [];
            function extractGeomCoords(geom) {
                if (!geom) return;
                function recurse(c) {
                    if (typeof c[0] === 'number') {
                        divisionCoords.push(c);
                    } else {
                        for (let i = 0; i < c.length; i++) recurse(c[i]);
                    }
                }
                recurse(geom.coordinates);
            }
            extractGeomCoords(division.adminFeature.geometry);

            let mapMinX = minLon;
            let mapMaxX = maxLon;
            let mapMinY = minLat;
            let mapMaxY = maxLat;

            if (w < 600) {
                // Fast path for gallery cards (< 1ms per card)
                const pad = 1.08;
                let fLon, fLat;
                const geoAspect = (lonSpan * cosLat) / latSpan;
                const mapAspect = mapW / mapH;
                if (geoAspect > mapAspect) {
                    fLon = lonSpan * pad;
                    fLat = (fLon / cosLat) / mapAspect;
                } else {
                    fLat = latSpan * pad;
                    fLon = (fLat * mapAspect) * cosLat;
                }
                mapMinX = centerLon - (fLon / 2);
                mapMaxX = centerLon + (fLon / 2);
                mapMinY = centerLat - (fLat / 2);
                mapMaxY = centerLat + (fLat / 2);
            } else {
                const step = Math.max(1, Math.floor(divisionCoords.length / 150));
                const sampledCoords = [];
                for (let i = 0; i < divisionCoords.length; i += step) {
                    sampledCoords.push(divisionCoords[i]);
                }

                for (const sf of [1.0, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70]) {
                    const scale = baseScale * sf;
                    const fittedLonSpan = (mapW / scale) / cosLat;
                    const fittedLatSpan = mapH / scale;

                    const tMinX = centerLon - (fittedLonSpan / 2);
                    const tMaxX = centerLon + (fittedLonSpan / 2);
                    const tMaxY = maxLat + (latSpan * 0.025);
                    const tMinY = tMaxY - fittedLatSpan;

                    let collision = false;
                    for (let i = 0; i < sampledCoords.length; i++) {
                        const lon = sampledCoords[i][0];
                        const lat = sampledCoords[i][1];
                        const px = mapX + ((lon - tMinX) / (tMaxX - tMinX)) * mapW;
                        const py = (mapY + mapH) - ((lat - tMinY) / (tMaxY - tMinY)) * mapH;

                        if (px >= (legendX - 8) && py >= (legendY - 8)) {
                            collision = true;
                            break;
                        }
                    }

                    if (!collision) {
                        mapMinX = tMinX;
                        mapMaxX = tMaxX;
                        mapMinY = tMinY;
                        mapMaxY = tMaxY;
                        break;
                    }
                }
            }

            function toPixel(lon, lat) {
                const px = mapX + ((lon - mapMinX) / (mapMaxX - mapMinX)) * mapW;
                const py = (mapY + mapH) - ((lat - mapMinY) / (mapMaxY - mapMinY)) * mapH;
                return [px, py];
            }

            // 6. HARD NEATLINE CLIP: Guarantees zero pixel can ever escape outer neatline
            ctx.save();
            ctx.beginPath();
            ctx.rect(margin + innerGap + 1, margin + headerHeight + 2, w - ((margin + innerGap + 1) * 2), h - margin - footerHeight - (margin + headerHeight + 2));
            ctx.clip();

            // CLIPPING ENGINE: Fill division interior
            ctx.save();
            this.buildPolygonPath(ctx, division.adminFeature.geometry, toPixel);
            ctx.fillStyle = division.isLULC ? "#ebeef0" : "#ffffff"; // Clean base
            ctx.fill();
            ctx.clip(); // Mask strictly to division boundary polygon!

            if (division.isLULC && division.lulcFeatures && division.lulcFeatures.length > 0) {
                // Render vector LULC polygons
                division.lulcFeatures.forEach(feat => {
                    if (feat.geometry) {
                        ctx.save();
                        this.buildPolygonPath(ctx, feat.geometry, toPixel);
                        ctx.fillStyle = feat._color || "#94a3b8";
                        ctx.fill();
                        ctx.strokeStyle = "rgba(0,0,0,0.15)";
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                        ctx.restore();
                    }
                });
            } else if (division.baseRasterCanvas) {
                // Draw master raster layer onto division
                const [rMinLon, rMinLat, rMaxLon, rMaxLat] = (division.rasterData && division.rasterData.bbox) || [76.228, 8.077, 80.342, 13.585];
                const [rx1, ry1] = toPixel(rMinLon, rMaxLat);
                const [rx2, ry2] = toPixel(rMaxLon, rMinLat);
                const rWidth = rx2 - rx1;
                const rHeight = ry2 - ry1;
                ctx.drawImage(division.baseRasterCanvas, rx1, ry1, rWidth, rHeight);
            }
            ctx.restore();

            // 7. Draw DIVISION BOUNDARY in Bold RED Outline
            ctx.save();
            ctx.strokeStyle = "#b91c1c";
            ctx.lineWidth = 4.2;
            this.drawPolygonStroke(ctx, division.adminFeature.geometry, toPixel);
            ctx.restore();

            ctx.restore(); // Restore hard neatline clip

            // 8. CLEAN BOTTOM-RIGHT BOXED LEGEND (Matching Official Reference Map)
            this.drawBottomRightBoxedLegend(ctx, division, w, h, margin, innerGap, footerHeight, legendX, legendY, legendW, legendH);

            // 9. Bottom-Left Official Tamil Nadu State Seal & 3-Line Department Text
            this.drawOfficialDepartmentSeal(ctx, margin + Math.round(25 * baseRatio), h - margin - footerHeight + Math.round(15 * heightRatio), baseRatio, heightRatio);

            // 10. Metric Scale Bar strictly from 0 to 12 KM (Centered between Seal and Legend)
            const scaleBarW = Math.max(50, Math.round(340 * baseRatio));
            const scaleBarX = Math.round((margin + Math.round(380 * baseRatio) + legendX - scaleBarW) / 2);
            this.drawScaleBar(ctx, scaleBarX, h - margin - Math.round(45 * heightRatio), 12, baseRatio, heightRatio);

            resolve(canvas);
        });
    },

    /**
     * Draw Clean Boxed Legend Matching Official Reference Map (media_1788417818878.png)
     */
    drawBottomRightBoxedLegend: function(ctx, division, totalWidth, totalHeight, margin, innerGap, footerHeight, legendX, legendY, legendW, legendH) {
        const isLULC = division.isLULC;
        const isFCM = division.isFCM;
        let rawClasses = division.presentClasses;
        if (!rawClasses || rawClasses.length === 0) {
            rawClasses = isLULC ? SpatialClipper.lulcClasses : (isFCM ? SpatialClipper.fcmClasses : SpatialClipper.forestClasses);
        }
        const classes = rawClasses.filter(c => c.id !== 0 && (c.areaHa === undefined || c.areaHa > 0));
        let subTitle = isLULC ? `${(division.rawName || division.name).toLowerCase().replace(/ division/gi, '')}_complete` : "";
        const divBoundaryLabel = isLULC ? `${(division.rawName || division.name).toLowerCase().replace(/ division/gi, '')}division` : "DIVISION BOUNDARY";

        let allLegendItems = [];
        if (!isLULC) {
            allLegendItems.push({ isBoundary: true, name: divBoundaryLabel, color: "#b91c1c" });
            allLegendItems.push(...classes);
        } else {
            allLegendItems.push(...classes);
            allLegendItems.push({ isBoundary: true, name: divBoundaryLabel, color: "#b91c1c" });
        }

        const isPortrait = totalWidth < totalHeight;
        const baseRatio = totalWidth / (isPortrait ? 2480.0 : 3508.0);
        const heightRatio = totalHeight / (isPortrait ? 3508.0 : 2480.0);

        if (totalWidth < 600) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillRect(legendX, legendY, legendW, legendH);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.strokeRect(legendX, legendY, legendW, legendH);
            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            ctx.font = "bold 9px Arial";
            ctx.fillText("LEGEND", legendX + (legendW / 2), legendY + 12);
            return;
        }

        // Solid White Background with Black Border
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(legendX, legendY, legendW, legendH);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1.0, 2.0 * baseRatio);
        ctx.strokeRect(legendX, legendY, legendW, legendH);

        // Header "LEGEND"
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        const titleFontSize = Math.max(12, Math.round(26 * baseRatio));
        ctx.font = `bold ${titleFontSize}px 'Times New Roman', Times, serif`;
        this.drawTextWithSpacing(ctx, "LEGEND", legendX + (legendW / 2), legendY + Math.round(28 * heightRatio), 3.0);

        if (subTitle) {
            ctx.fillStyle = "#334155";
            ctx.textAlign = "left";
            const subTitleFontSize = Math.max(9, Math.round(14 * baseRatio));
            ctx.font = `italic bold ${subTitleFontSize}px Arial, sans-serif`;
            ctx.fillText(subTitle, legendX + Math.round(18 * baseRatio), legendY + Math.round(48 * heightRatio));
        }

        const startY = legendY + Math.round((subTitle ? 60 : 46) * heightRatio);
        const cols = allLegendItems.length > 14 ? 3 : 2;
        const colW = (legendW - Math.round(36 * baseRatio)) / cols;
        const numRows = Math.ceil(allLegendItems.length / cols);
        const rowH = Math.max(12, Math.round((cols === 3 ? 28 : 36) * heightRatio));

        const swatchW = Math.max(14, Math.round((cols === 3 ? 34 : 44) * baseRatio));
        const swatchH = Math.max(8, Math.round((cols === 3 ? 14 : 18) * heightRatio));
        const maxTextW = colW - swatchW - Math.round(12 * baseRatio);

        const totalDivHa = division.totalAreaHa || (division.stats && division.stats.totalAreaHa) || (typeof turf !== "undefined" && division.adminFeature ? (turf.area(division.adminFeature) / 10000) : 0);

        ctx.textAlign = "left";

        allLegendItems.forEach((item, index) => {
            const colIdx = index % cols;
            const rowIdx = Math.floor(index / cols);

            const itemX = legendX + Math.round(16 * baseRatio) + (colIdx * colW);
            const itemY = startY + (rowIdx * rowH) + Math.round(16 * heightRatio);

            const swatchX = itemX;
            const swatchY = itemY - Math.round(14 * heightRatio);

            if (item.isBoundary) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(swatchX, swatchY, swatchW, swatchH);
                ctx.strokeStyle = "#b91c1c";
                ctx.lineWidth = Math.max(1.2, 2.4 * baseRatio);
                ctx.strokeRect(swatchX, swatchY, swatchW, swatchH);
            } else {
                ctx.fillStyle = item.color;
                ctx.fillRect(swatchX, swatchY, swatchW, swatchH);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = Math.max(0.6, 1.0 * baseRatio);
                ctx.strokeRect(swatchX, swatchY, swatchW, swatchH);
            }

            ctx.fillStyle = "#000000";
            ctx.textAlign = "left";
            const textX = swatchX + swatchW + Math.round(12 * baseRatio);
            
            let haValue = 0;
            if (item.isBoundary) {
                haValue = totalDivHa;
            } else if (item.areaHa !== undefined) {
                haValue = item.areaHa;
            }

            const haFormatted = haValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const cleanedName = this.cleanForestTypeName(item.name);
            const displayName = `${cleanedName} - ${haFormatted} ha`;

            // Auto-fit font size to strictly stay within maxTextW and NEVER collide into column 2
            let fontSize = Math.max(9, Math.round(16.0 * baseRatio));
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            while (ctx.measureText(displayName).width > maxTextW && fontSize > 8) {
                fontSize -= 0.5;
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            }

            ctx.fillText(displayName, textX, itemY);
        });
    },

    /**
     * Draw Official Department Emblem (Real TN Seal) & 3-Line Text Beside Logo
     */
    drawOfficialDepartmentSeal: function(ctx, x, y, baseRatio = 1.0, heightRatio = 1.0) {
        ctx.save();

        const sealSize = Math.max(16, Math.round(80 * baseRatio));
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

        const textX = x + sealSize + Math.round(18 * baseRatio);
        ctx.textAlign = "left";

        ctx.fillStyle = "#000000";
        const fSize1 = Math.max(6, Math.round(16 * baseRatio));
        ctx.font = `bold ${fSize1}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "GIS CELL", textX, y + Math.round(22 * heightRatio), 1.2 * baseRatio);

        const fSize2 = Math.max(5, Math.round(15 * baseRatio));
        ctx.font = `bold ${fSize2}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "INFORMATION TECHNOLOGY WING", textX, y + Math.round(44 * heightRatio), 1.0 * baseRatio);

        const fSize3 = Math.max(5, Math.round(14 * baseRatio));
        ctx.font = `bold ${fSize3}px 'Times New Roman', serif`;
        this.drawTextWithSpacing(ctx, "STATE FOREST HEADQUARTERS, CHENNAI", textX, y + Math.round(66 * heightRatio), 0.8 * baseRatio);
    },

    /**
     * Draw Metric Scale Bar matching official standard
     */
    drawScaleBar: function(ctx, x, y, totalKm = 12, baseRatio = 1.0, heightRatio = 1.0) {
        const barW = Math.max(50, Math.round(380 * baseRatio));
        const barH = Math.max(3, Math.round(10 * heightRatio));
        const segs = 6;
        const segW = barW / segs;
        const kmPerSeg = totalKm / segs;

        ctx.textAlign = "center";
        const scaleFontSize = Math.max(6, Math.round(15 * baseRatio));
        ctx.font = `bold ${scaleFontSize}px Arial, sans-serif`;
        ctx.fillStyle = "#000000";

        for (let i = 0; i <= segs; i++) {
            const sx = x + (i * segW);
            const valNum = i * kmPerSeg;
            const kmVal = valNum % 1 === 0 ? String(valNum) : valNum.toFixed(1);
            ctx.fillText(kmVal, sx, y - Math.round(8 * heightRatio));
        }

        ctx.fillText("KM", x + barW + Math.round(28 * baseRatio), y + Math.round(9 * heightRatio));

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(0.6, 1.5 * baseRatio);
        ctx.strokeRect(x, y, barW, barH);

        for (let i = 0; i < segs; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#000000" : "#ffffff";
            ctx.fillRect(x + (i * segW), y, segW, barH);
        }
    },

    /**
     * Draw Sleek, Bigger North Arrow with 'N' on top matching user sample
     */
    drawNorthArrow: function(ctx, x, y, size = 75) {
        ctx.save();
        ctx.translate(x, y);

        const arrowH = size;
        const arrowHalfW = Math.round(size * 0.35);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 26px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", 0, -(arrowH / 2) - 8);

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.moveTo(0, -arrowH / 2);
        ctx.lineTo(-arrowHalfW, arrowH / 2);
        ctx.lineTo(0, (arrowH / 2) - 15);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(0, -arrowH / 2);
        ctx.lineTo(arrowHalfW, arrowH / 2);
        ctx.lineTo(0, (arrowH / 2) - 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -arrowH / 2);
        ctx.lineTo(-arrowHalfW, arrowH / 2);
        ctx.lineTo(0, (arrowH / 2) - 15);
        ctx.closePath();
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

    drawPolygonStroke: function(ctx, geometry, toPixel) {
        this.buildPolygonPath(ctx, geometry, toPixel);
        ctx.stroke();
    },

    sanitizeFilename: function(name) {
        return (name || "Division").replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_');
    }
};

window.ExportManager = ExportManager;
