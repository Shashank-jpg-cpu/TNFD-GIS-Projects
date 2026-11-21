/**
 * Spatial Clipper & Division Extractor Engine
 * Supports both Forest Type Maps (Raster) and LULC Datasets (Vector / Raster)
 * with Dynamic Class-based Color Classification (e.g. desc3 column)
 */

const SpatialClipper = {
    // Official FSI / Tamil Nadu Forest Type Classes (All-Green Forest Gradients, Blue Water, White Non-Forest)
    forestClasses: [
        // Forest Types -> ALL GREEN Gradients
        { id: 1,  code: "1A/C4",     name: "1A/C4 WEST COAST TROPICAL EVERGREEN FOREST", color: "#00441b", r: 0,   g: 68,  b: 27  },
        { id: 2,  code: "2A/C2",     name: "2A/C2 WEST COAST SEMI-EVERGREEN FOREST", color: "#006d2c", r: 0,   g: 109, b: 44  },
        { id: 3,  code: "2/E3",      name: "2/E3 MOIST BAMBOO BRAKES", color: "#0d9488", r: 13,  g: 148, b: 136 },
        { id: 4,  code: "3B/C2",     name: "3B/C2 SOUTHERN MOIST MIXED DECIDUOUS FOREST", color: "#238b45", r: 35,  g: 139, b: 69  },
        { id: 5,  code: "3B/C2/2S1", name: "3B/C2/2S1 SOUTHERN SECONDARY MOIST MIXED DECIDUOUS FOREST", color: "#41ab5d", r: 65,  g: 171, b: 93  },
        { id: 8,  code: "5/2S1",     name: "5/2S1 SECONDARY DRY DECIDUOUS FOREST", color: "#78c679", r: 120, g: 198, b: 121 },
        { id: 9,  code: "5/DS1",     name: "5/DS1 DRY DECIDUOUS SCRUB", color: "#a1d99b", r: 161, g: 217, b: 155 },
        { id: 10, code: "5/DS2",     name: "5/DS2 DRY SAVANNAH FOREST", color: "#c7e9c0", r: 199, g: 233, b: 192 },
        { id: 11, code: "5/DS4",     name: "5/DS4 DRY GRASSLAND", color: "#edf8e9", r: 237, g: 248, b: 233 },
        { id: 12, code: "5A/C1b",    name: "5A/C1b DRY TEAK FOREST", color: "#005824", r: 0,   g: 88,  b: 36  },
        { id: 13, code: "5A/C3",     name: "5A/C3 SOUTHERN DRY MIXED DECIDUOUS FOREST", color: "#31a354", r: 49,  g: 163, b: 84  },
        { id: 14, code: "6A/C1",     name: "6A/C1 SOUTHERN THORN FOREST", color: "#4ade80", r: 74,  g: 222, b: 128 },
        { id: 15, code: "6A/C2",     name: "6A/C2 CARNATIC UMBERLLA THORN FOREST", color: "#86efac", r: 134, g: 239, b: 172 },
        { id: 16, code: "6A/DS1",    name: "6A/DS1 SOUTHERN THORN SCRUB", color: "#a3e635", r: 163, g: 230, b: 53  },
        { id: 17, code: "6A/DS2",    name: "6A/DS2 SOUTHERN EUPHORBIA SCRUB", color: "#65a30d", r: 101, g: 163, b: 13  },
        { id: 18, code: "8A/C1",     name: "8A/C1 NILGIRI SUBTROPICAL HILL FOREST", color: "#1b7837", r: 27,  g: 120, b: 55  },
        { id: 19, code: "8A/DS1",    name: "8A/DS1 SOUTH INDIAN SUB-TROPICAL HILL SAVANNAH (WOODLAND)", color: "#5aae61", r: 90,  g: 174, b: 97  },
        { id: 20, code: "11A/C1",    name: "11A/C1 SOUTHERN MONTANE WET TEMPERATE FOREST", color: "#00441b", r: 0,   g: 68,  b: 27  },
        { id: 21, code: "11A/C1/DS1",name: "11A/C1/DS1 SOUTHERN MONTANE WET SCRUB", color: "#a6dba0", r: 166, g: 219, b: 160 },
        { id: 22, code: "11A/C1/DS2",name: "11A/C1/DS2 SOUTHERN MONTANE WET GRASSLAND", color: "#d9f0d3", r: 217, g: 240, b: 211 },
        { id: 201, code: "TOF",      name: "TOF/PLANTATION", color: "#10b981", r: 16,  g: 185, b: 129 },

        // Water & Riparian -> BLUE Gradients
        { id: 6,  code: "4E/RS1",    name: "4E/RS1 RIPARIAN FRINGING FOREST", color: "#0ea5e9", r: 14,  g: 165, b: 233 },
        { id: 7,  code: "5/1S1",     name: "5/1S1 DRY TROPICAL RIVERAIN FOREST", color: "#38bdf8", r: 56,  g: 189, b: 248 },
        { id: 202, code: "WATER",    name: "WATER", color: "#1e40af", r: 30,  g: 64,  b: 175 },

        // Non-Forest -> Clean Pure WHITE
        { id: 203, code: "NON_FOR",  name: "NON-FOREST", color: "#ffffff", r: 255, g: 255, b: 255 }
    ],

    // Official FSI Forest Cover Classes (FCM - 6 Classes)
    fcmClasses: [
        { id: 6, code: "VDF", name: "VERY DENSE FOREST", color: "#006100", r: 0, g: 97, b: 0 },
        { id: 5, code: "MDF", name: "MODERATELY DENSE FOREST", color: "#00ff00", r: 0, g: 255, b: 0 },
        { id: 4, code: "OF",  name: "OPEN FOREST", color: "#ffff00", r: 255, g: 255, b: 0 },
        { id: 3, code: "SCRUB", name: "SCRUB", color: "#ff0000", r: 255, g: 0, b: 0 },
        { id: 2, code: "NON_FOR", name: "NON-FOREST", color: "#ffffff", r: 255, g: 255, b: 255 },
        { id: 1, code: "WATER", name: "WATER BODY", color: "#009ede", r: 0, g: 158, b: 222 }
    ],

    // Complete Official LULC Classes (Green Forest, Yellow Agri/Plantation, Blue Water, Brown Dry/Rock, Red Built-up)
    lulcClasses: [
        // 1. Big Forests -> GREEN Gradients
        { id: 1,  name: "Forest", color: "#006d2c" },
        { id: 2,  name: "Forest plantation", color: "#15803d" },
        { id: 3,  name: "Mangrove / Swamp area", color: "#047857" },

        // 2. Small Plantation, Agriculture, Crops, Grassland -> YELLOW Gradients
        { id: 4,  name: "Crop land", color: "#eab308" },
        { id: 5,  name: "Agriculture plantation", color: "#ca8a04" },
        { id: 6,  name: "Grassland & Grazing land", color: "#fde047" },
        { id: 7,  name: "Shifting cultivation - Current", color: "#d97706" },

        // 3. Water, Lakes, Ponds, Reservoirs, Rivers, Canals -> BLUE Gradients
        { id: 8,  name: "Reservoir / Tanks", color: "#2563eb" },
        { id: 9,  name: "Lakes / Ponds", color: "#0284c7" },
        { id: 10, name: "River / Stream / Drain", color: "#0ea5e9" },
        { id: 11, name: "Canal", color: "#06b6d4" },
        { id: 12, name: "Aquaculture / pisciculture", color: "#38bdf8" },
        { id: 13, name: "Waterlogged", color: "#0369a1" },

        // 4. Dry Land, Full Dry Area, Scrub, Rocks, Sand, Salt, Roads -> BROWN Gradients
        { id: 14, name: "Scrub land Dense", color: "#b45309" },
        { id: 15, name: "Scrub land Open", color: "#d97706" },
        { id: 16, name: "Barren rocky", color: "#78350f" },
        { id: 17, name: "Gullied / ravenous", color: "#713f12" },
        { id: 18, name: "Salt affected", color: "#a16207" },
        { id: 19, name: "Sandy areas", color: "#ca8a04" },
        { id: 20, name: "Transportation", color: "#451a03" },

        // 5. Built-up, Village, Settlements, Urban, Hamlets -> RED Gradients
        { id: 21, name: "Built up (Urban)", color: "#b91c1c" },
        { id: 22, name: "Core urban", color: "#991b1b" },
        { id: 23, name: "Built up (Rural)", color: "#dc2626" },
        { id: 24, name: "Village", color: "#ef4444" },
        { id: 25, name: "Hamlets and dispersed household", color: "#fb7185" },
        { id: 26, name: "Mining / industrial", color: "#c2410c" },
        { id: 27, name: "Mixed settlement", color: "#be123c" },
        { id: 28, name: "Peri urban", color: "#e11d48" }
    ],

    // Official LULC Color Palette Dictionary
    lulcDefaultPalette: {
        // Big Forests -> GREEN
        "forest": "#006d2c",
        "forest plantation": "#15803d",
        "mangrove / swamp area": "#047857",

        // Small Plantation, Agriculture, Crops, Grassland -> YELLOW
        "crop land": "#eab308",
        "agriculture plantation": "#ca8a04",
        "grassland & grazing land": "#fde047",
        "shifting cultivation - current": "#d97706",
        "plantation": "#ca8a04",

        // Water, Lakes, Ponds, Reservoirs, Rivers, Canals -> BLUE
        "reservoir / tanks": "#2563eb",
        "lakes / ponds": "#0284c7",
        "river / stream / drain": "#0ea5e9",
        "canal": "#06b6d4",
        "aquaculture / pisciculture": "#38bdf8",
        "waterlogged": "#0369a1",
        "water": "#2563eb",

        // Dry Land, Scrub, Rocks, Sand, Salt, Roads -> BROWN
        "scrub land dense": "#b45309",
        "scrub land open": "#d97706",
        "barren rocky": "#78350f",
        "gullied / ravenous": "#713f12",
        "salt affected": "#a16207",
        "sandy areas": "#ca8a04",
        "transportation": "#451a03",
        "wasteland": "#b45309",

        // Built-up, Village, Settlements, Urban, Hamlets -> RED
        "built up (rural)": "#dc2626",
        "built up (urban)": "#b91c1c",
        "core urban": "#991b1b",
        "village": "#ef4444",
        "hamlets and dispersed household": "#fb7185",
        "hamlets and dispersed household)": "#fb7185",
        "mining / industrial": "#c2410c",
        "mixed settlement": "#be123c",
        "peri urban": "#e11d48"
    },

    // Dynamic color generator for any unmapped LULC categories
    getLulcColor: function(className, index) {
        if (!className) return "#94a3b8";
        const clean = String(className).toLowerCase().trim();
        if (this.lulcDefaultPalette[clean]) {
            return this.lulcDefaultPalette[clean];
        }
        // Intelligent semantic categorization fallback
        if (/forest|plant|tree|crop|agri|grass|green/i.test(clean)) return "#22c55e";
        if (/built|urban|village|settle|house|hamlet|town/i.test(clean)) return "#ef4444";
        if (/water|lake|pond|river|tank|canal|sea|ocean/i.test(clean)) return "#2563eb";
        if (/road|rail|rock|sand|salt|gull|barren|trans/i.test(clean)) return "#78350f";
        return "#94a3b8";
    },

    renderRasterToCanvas: function(rasterData) {
        if (rasterData && rasterData.canvas) {
            return rasterData.canvas;
        }

        const width = (rasterData && rasterData.width) || 3071;
        const height = (rasterData && rasterData.height) || 4126;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (rasterData && rasterData.isFCM && typeof window !== 'undefined' && window._fcmCanvas) {
            ctx.drawImage(window._fcmCanvas, 0, 0);
            if (rasterData) rasterData.canvas = canvas;
            return canvas;
        }
        if (rasterData && rasterData.isLULC && typeof window !== 'undefined' && window._lulcCanvas) {
            ctx.drawImage(window._lulcCanvas, 0, 0);
            if (rasterData) rasterData.canvas = canvas;
            return canvas;
        }
        if (typeof window !== 'undefined' && window._ftmCanvas) {
            ctx.drawImage(window._ftmCanvas, 0, 0);
            if (rasterData) rasterData.canvas = canvas;
            return canvas;
        }

        let targetDataUri = null;
        if (typeof window !== 'undefined') {
            if (rasterData && rasterData.isFCM && window.TAMIL_NADU_FCM_DATA_URI) {
                targetDataUri = window.TAMIL_NADU_FCM_DATA_URI;
            } else if (rasterData && rasterData.isLULC && window.TAMIL_NADU_LULC_DATA_URI) {
                targetDataUri = window.TAMIL_NADU_LULC_DATA_URI;
            } else if (window.TAMIL_NADU_RASTER_DATA_URI) {
                targetDataUri = window.TAMIL_NADU_RASTER_DATA_URI;
            }
        }

        if (targetDataUri) {
            const img = new Image();
            img.src = targetDataUri;
            if (img.complete && img.naturalWidth) {
                ctx.drawImage(img, 0, 0);
                if (rasterData) rasterData.canvas = canvas;
                return canvas;
            }
        }

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        if (rasterData && rasterData.rasters && rasterData.rasters[0]) {
            const band = rasterData.rasters[0];
            const numPixels = width * height;
            for (let i = 0; i < numPixels; i++) {
                const val = band[i];
                const idx = i * 4;
                if (val === 0 || val <= -9999) {
                    data[idx + 3] = 0;
                } else if (val === 203 || val === 65 || val === 64) {
                    data[idx] = 235; data[idx+1] = 238; data[idx+2] = 240; data[idx+3] = 255;
                } else {
                    data[idx] = 35; data[idx+1] = 139; data[idx+2] = 69; data[idx+3] = 255;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas;
    },

    extractAllDivisions: function(adminLayer, layer2Data, nameField, colormap, onProgress) {
        if (!adminLayer || !adminLayer.features || adminLayer.features.length === 0) {
            throw new Error("Administrative Boundary Layer (Layer 1) has no features.");
        }
        if (!layer2Data) {
            throw new Error("Secondary Layer (Layer 2) is missing or not loaded.");
        }

        const isLULC = layer2Data.isLULC || layer2Data.type === "LULC_Vector" || (layer2Data.filename && /lulc|sisdp|landuse/i.test(layer2Data.filename));
        const isFCM = layer2Data.isFCM || (layer2Data.filename && /cover|fcm/i.test(layer2Data.filename));
        const isFTM = !isLULC && !isFCM;
        const baseRasterCanvas = this.renderRasterToCanvas(layer2Data);
        const totalDivisions = adminLayer.features.length;
        const results = [];

        for (let i = 0; i < totalDivisions; i++) {
            const adminFeature = adminLayer.features[i];
            
            let divName = `Division ${i + 1}`;
            if (nameField && adminFeature.properties && adminFeature.properties[nameField] !== undefined) {
                divName = String(adminFeature.properties[nameField]).trim();
            } else if (adminFeature.properties && adminFeature.properties.DN_NAME) {
                divName = String(adminFeature.properties.DN_NAME).trim();
            } else if (adminFeature.properties && adminFeature.properties._division_name) {
                divName = String(adminFeature.properties._division_name).trim();
            }

            let formattedTitle = isLULC ? `${divName.replace(/ DIVISION/gi, '').trim()} Division LULC` : (isFCM ? `${ExportManager.formatDivisionTitle(divName)} Forest Cover` : ExportManager.formatDivisionTitle(divName));

            let bbox = [0, 0, 0, 0];
            let areaSqKm = 0;
            let center = [0, 0];
            let isPortrait = false;

            try {
                bbox = turf.bbox(adminFeature);
                const areaSqM = turf.area(adminFeature);
                areaSqKm = (areaSqM / 1000000).toFixed(2);
                center = turf.center(adminFeature).geometry.coordinates;

                const lonSpan = bbox[2] - bbox[0];
                const latSpan = bbox[3] - bbox[1];
                const cosLat = Math.cos((center[1] * Math.PI) / 180);
                isPortrait = latSpan > (lonSpan * cosLat * 1.05);
            } catch (e) {}

            // Determine present classes and compute area in hectares for this division
            let baseClasses = isLULC ? this.lulcClasses : (isFCM ? this.fcmClasses : this.forestClasses);
            let clippedLulcFeatures = [];
            let totalDivisionAreaHa = (adminFeature.properties && adminFeature.properties._total_area_ha) || (turf.area(adminFeature) / 10000);
            
            let presentClasses = null;
            if (isLULC) {
                if (adminFeature.properties && adminFeature.properties._lulc_class_areas && adminFeature.properties._lulc_class_areas.length > 0) {
                    presentClasses = JSON.parse(JSON.stringify(adminFeature.properties._lulc_class_areas));
                }
            } else if (isFCM) {
                if (adminFeature.properties && adminFeature.properties._fcm_class_areas && adminFeature.properties._fcm_class_areas.length > 0) {
                    presentClasses = JSON.parse(JSON.stringify(adminFeature.properties._fcm_class_areas));
                }
            } else {
                if (adminFeature.properties && (adminFeature.properties._ftm_class_areas || adminFeature.properties._class_areas)) {
                    presentClasses = JSON.parse(JSON.stringify(adminFeature.properties._ftm_class_areas || adminFeature.properties._class_areas));
                }
            }

            if (!presentClasses || presentClasses.length === 0) {
                let areaStats = this.computeClassAreas(adminFeature, baseRasterCanvas, layer2Data.bbox, baseClasses);
                presentClasses = areaStats.classes.filter(c => c.areaHa > 0);
                if (!adminFeature.properties || !adminFeature.properties._total_area_ha) {
                    totalDivisionAreaHa = areaStats.totalAreaHa;
                }
            }

            if (isLULC && layer2Data.geojson) {
                const divBbox = bbox;
                const classSet = new Set();
                const classField = layer2Data.classColumn || "dscr3";

                layer2Data.geojson.features.forEach((feat, fIdx) => {
                    try {
                        const featBbox = turf.bbox(feat);
                        if (featBbox[0] <= divBbox[2] && featBbox[2] >= divBbox[0] &&
                            featBbox[1] <= divBbox[3] && featBbox[3] >= divBbox[1]) {
                            
                            const cVal = feat.properties && feat.properties[classField] ? String(feat.properties[classField]).trim() : "Unclassified";
                            if (cVal) {
                                classSet.add(cVal);
                                clippedLulcFeatures.push({
                                    ...feat,
                                    _lulc_class: cVal,
                                    _color: SpatialClipper.getLulcColor(cVal, fIdx)
                                });
                            }
                        }
                    } catch (err) {}
                });

                if (classSet.size > 0) {
                    presentClasses = Array.from(classSet).map((cName, idx) => ({
                        id: idx + 1,
                        name: cName,
                        color: SpatialClipper.getLulcColor(cName, idx),
                        areaHa: (totalDivisionAreaHa / classSet.size)
                    }));
                }
            }

            const divisionData = {
                id: `div_${i + 1}_${Date.now()}`,
                index: i + 1,
                name: formattedTitle,
                rawName: divName,
                isLULC: isLULC,
                isFCM: isFCM,
                isFTM: isFTM,
                adminFeature: adminFeature,
                rasterData: layer2Data,
                baseRasterCanvas: baseRasterCanvas,
                lulcFeatures: clippedLulcFeatures,
                presentClasses: presentClasses,
                totalAreaHa: totalDivisionAreaHa,
                stats: {
                    bbox: bbox,
                    areaSqKm: areaSqKm,
                    totalAreaHa: totalDivisionAreaHa,
                    center: center,
                    isPortrait: isPortrait,
                    uniqueClassesCount: presentClasses.length,
                    forestTypeCount: presentClasses.filter(c => c.id !== 0 && (c.areaHa === undefined || c.areaHa > 0)).length,
                    subFeatureCount: (adminFeature.properties && adminFeature.properties._sub_feature_count) || 1
                }
            };

            results.push(divisionData);

            if (onProgress && typeof onProgress === 'function') {
                const percent = Math.round(((i + 1) / totalDivisions) * 100);
                onProgress(percent, i + 1, totalDivisions, divName);
            }
        }

        return results;
    },

    computeClassAreas: function(adminFeature, baseRasterCanvas, rasterBbox, classesList) {
        let totalAreaHa = 0;
        try {
            totalAreaHa = turf.area(adminFeature) / 10000;
        } catch (e) {}

        if (!baseRasterCanvas || !classesList || classesList.length === 0) {
            return {
                totalAreaHa: totalAreaHa,
                classes: (classesList || []).map(c => ({ ...c, areaHa: 0 }))
            };
        }

        try {
            const [rMinLon, rMinLat, rMaxLon, rMaxLat] = rasterBbox || [76.228, 8.077, 80.342, 13.585];
            const divBbox = turf.bbox(adminFeature);
            const w = baseRasterCanvas.width;
            const h = baseRasterCanvas.height;

            const x1 = Math.max(0, Math.floor(((divBbox[0] - rMinLon) / (rMaxLon - rMinLon)) * w));
            const x2 = Math.min(w, Math.ceil(((divBbox[2] - rMinLon) / (rMaxLon - rMinLon)) * w));
            const y1 = Math.max(0, Math.floor(((rMaxLat - divBbox[3]) / (rMaxLat - rMinLat)) * h));
            const y2 = Math.min(h, Math.ceil(((rMaxLat - divBbox[1]) / (rMaxLat - rMinLat)) * h));

            const cropW = Math.max(1, x2 - x1);
            const cropH = Math.max(1, y2 - y1);

            const offCanvas = document.createElement("canvas");
            offCanvas.width = cropW;
            offCanvas.height = cropH;
            const offCtx = offCanvas.getContext("2d");

            function toLocalPx(lon, lat) {
                const px = (((lon - rMinLon) / (rMaxLon - rMinLon)) * w) - x1;
                const py = (((rMaxLat - lat) / (rMaxLat - rMinLat)) * h) - y1;
                return [px, py];
            }

            offCtx.save();
            SpatialClipper.buildPolygonPath(offCtx, adminFeature.geometry, toLocalPx);
            offCtx.clip();
            offCtx.drawImage(baseRasterCanvas, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
            offCtx.restore();

            const imgData = offCtx.getImageData(0, 0, cropW, cropH).data;
            const colorCounts = new Map();
            let totalInsidePixels = 0;

            for (let idx = 0; idx < imgData.length; idx += 4) {
                const a = imgData[idx + 3];
                if (a > 30) {
                    const r = imgData[idx];
                    const g = imgData[idx + 1];
                    const b = imgData[idx + 2];
                    const key = `${r},${g},${b}`;
                    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
                    totalInsidePixels++;
                }
            }

            const computedClasses = classesList.map(c => {
                let count = 0;
                let targetR = c.r;
                let targetG = c.g;
                let targetB = c.b;

                if (targetR === undefined && c.color && c.color.startsWith("#")) {
                    targetR = parseInt(c.color.slice(1, 3), 16);
                    targetG = parseInt(c.color.slice(3, 5), 16);
                    targetB = parseInt(c.color.slice(5, 7), 16);
                }

                for (const [key, cnt] of colorCounts.entries()) {
                    const [r, g, b] = key.split(',').map(Number);
                    const dist = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
                    if (dist <= 20) {
                        count += cnt;
                    }
                }

                const areaHa = totalInsidePixels > 0 ? (count / totalInsidePixels) * totalAreaHa : 0;
                return {
                    ...c,
                    areaHa: areaHa
                };
            });

            return {
                totalAreaHa: totalAreaHa,
                classes: computedClasses
            };
        } catch (err) {
            console.warn("Class area computation fallback:", err);
            return {
                totalAreaHa: totalAreaHa,
                classes: (classesList || []).map(c => ({ ...c, areaHa: 0 }))
            };
        }
    }
};

window.SpatialClipper = SpatialClipper;
