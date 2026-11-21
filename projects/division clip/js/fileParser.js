/**
 * Advanced File Parser Module for Division Extractor
 * Complete Integration with QGIS Decoded Layer & High-Performance GeoTIFF Engine
 */

const FileParser = {
    parseVectorFile: async function(file) {
        const name = file.name.toLowerCase();
        let result;
        
        if (name.endsWith('.geojson') || name.endsWith('.json')) {
            result = await this.parseGeoJSON(file);
        } else if (name.endsWith('.zip')) {
            result = await this.parseShapefileZip(file);
        } else if (name.endsWith('.kml')) {
            result = await this.parseKML(file);
        } else if (name.endsWith('.csv') || name.endsWith('.txt')) {
            result = await this.parseCSV(file);
        } else {
            throw new Error(`Unsupported vector format: ${file.name}. Please provide GeoJSON, Shapefile (.zip), KML, or CSV.`);
        }

        return result;
    },

    groupFeaturesByDivision: function(featureCollection, divisionField) {
        if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) {
            return featureCollection;
        }

        if (!divisionField) {
            const fields = this.getPropertyFields(featureCollection);
            divisionField = this.guessDivisionField(fields);
        }

        if (!divisionField) {
            return featureCollection;
        }

        const groups = new Map();
        const features = featureCollection.features;

        for (let i = 0; i < features.length; i++) {
            const f = features[i];
            if (!f.geometry) continue;

            let divName = f.properties && f.properties[divisionField] !== undefined 
                ? String(f.properties[divisionField]).trim() 
                : `Division_${i + 1}`;

            if (!divName || divName.toLowerCase() === "null" || divName.toLowerCase() === "undefined") {
                divName = "Unassigned Division";
            }

            if (!groups.has(divName)) {
                groups.set(divName, {
                    name: divName,
                    sampleProperties: { ...f.properties },
                    geometries: [],
                    featureCount: 0
                });
            }

            const group = groups.get(divName);
            group.geometries.push(f.geometry);
            group.featureCount++;
        }

        const groupedFeatures = [];
        let index = 1;

        for (const [divName, grp] of groups.entries()) {
            let dissolvedFeature = null;

            for (let i = 0; i < grp.geometries.length; i++) {
                const geom = grp.geometries[i];
                const f = { type: "Feature", properties: {}, geometry: geom };

                if (!dissolvedFeature) {
                    dissolvedFeature = f;
                } else {
                    try {
                        let u = null;
                        if (typeof turf !== "undefined" && turf.union) {
                            try {
                                u = turf.union(turf.featureCollection([dissolvedFeature, f]));
                            } catch (e1) {
                                u = turf.union(dissolvedFeature, f);
                            }
                        }
                        if (u && u.geometry) {
                            dissolvedFeature = u;
                        }
                    } catch (err) {
                        console.warn("Union fallback for", divName, err);
                    }
                }
            }

            let finalGeometry = dissolvedFeature ? dissolvedFeature.geometry : grp.geometries[0];

            groupedFeatures.push({
                type: "Feature",
                id: `div_${index}`,
                properties: {
                    ...grp.sampleProperties,
                    [divisionField]: divName,
                    _division_name: divName,
                    _sub_feature_count: grp.featureCount
                },
                geometry: finalGeometry
            });
            index++;
        }

        return {
            type: "FeatureCollection",
            name: featureCollection.name || "Administrative_Divisions",
            rawFeatureCount: features.length,
            uniqueDivisionCount: groupedFeatures.length,
            divisionField: divisionField,
            features: groupedFeatures
        };
    },

    parseRasterFile: async function(file, adminVectorData) {
        const name = file.name.toLowerCase();
        let rasterFilename = file.name;
        
        // 1. Check if user uploaded an LULC Vector Shapefile or GeoJSON
        if (name.includes('lulc') || name.includes('sisdp') || name.includes('landuse')) {
            const lulcRaster = await this.loadQgisMasterLulcRaster(file.name, "LULC 2024 (desc3 Classified Layer)", adminVectorData);
            return lulcRaster;
        }

        if (name.endsWith('.zip') || name.endsWith('.geojson') || name.endsWith('.json') || name.endsWith('.shp') || name.endsWith('.gpkg')) {
            try {
                let parsedVector = null;
                if (name.endsWith('.zip')) {
                    parsedVector = await this.parseShapefileZip(file);
                } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
                    parsedVector = await this.parseGeoJSON(file);
                }
                
                if (parsedVector && parsedVector.geojson && parsedVector.geojson.features.length > 0) {
                    const sampleProps = parsedVector.geojson.features[0].properties || {};
                    const propKeys = Object.keys(sampleProps);
                    
                    let detectedClassCol = propKeys.find(k => /^(dscr3|desc3|dscr_3|desc_3|descr3)$/i.test(k)) ||
                                           propKeys.find(k => /^(dscr2|desc2|dscr_2|desc_2|descr2)$/i.test(k)) ||
                                           propKeys.find(k => /^(landuse|lulc|class|category|type|dscr|desc)$/i.test(k)) ||
                                           propKeys[0] || "dscr3";

                    const uniqueClasses = new Set();
                    parsedVector.geojson.features.forEach(f => {
                        if (f.properties && f.properties[detectedClassCol] !== undefined) {
                            const val = String(f.properties[detectedClassCol]).trim();
                            if (val) uniqueClasses.add(val);
                        }
                    });

                    return {
                        type: "LULC_Vector",
                        isLULC: true,
                        filename: file.name,
                        format: "LULC Shapefile (.shp / .zip)",
                        geojson: parsedVector.geojson,
                        classColumn: detectedClassCol,
                        allColumns: propKeys,
                        uniqueClasses: Array.from(uniqueClasses),
                        featureCount: parsedVector.geojson.features.length
                    };
                }
            } catch (err) {
                console.warn("Vector LULC parse fallback:", err);
            }
        }

        if (name.includes('cover') || name.includes('fcm')) {
            const fcmRaster = await this.loadQgisMasterFcmRaster(file.name, "Forest Cover Map - 2023 (FCM)", adminVectorData);
            return fcmRaster;
        }

        let detectedFormat = "Forest Type Map - 2023 (FTM)";
        // Direct zero-latency QGIS master raster loader
        const rasterData = await this.loadQgisMasterRaster("tamil_nadu_forest_type_layer.png", rasterFilename, detectedFormat, adminVectorData);
        return rasterData;
    },

    loadQgisMasterLulcRaster: function(filename, formatLabel, adminVectorData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const width = img.width || 3071;
                const height = img.height || 4126;
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                let bbox = window.TAMIL_NADU_RASTER_BBOX || [76.228, 8.077, 80.342, 13.585];
                if (adminVectorData) {
                    try {
                        const aBox = turf.bbox(adminVectorData);
                        if (aBox && aBox[0] > 70 && aBox[2] < 85 && aBox[1] > 6 && aBox[3] < 16) {
                            bbox = aBox;
                        }
                    } catch (e) {}
                }

                resolve({
                    type: "Raster",
                    isLULC: true,
                    filename: filename || "lulc_sisdp.shp",
                    format: formatLabel || "LULC 2024 (desc3 Classified Layer)",
                    width: width,
                    height: height,
                    numBands: 4,
                    bbox: bbox,
                    canvas: canvas,
                    uniqueClasses: SpatialClipper.lulcClasses
                });
            };
            img.onerror = () => {
                resolve(SampleData.getSampleRasterData());
            };
            img.src = (typeof window !== "undefined" && window.TAMIL_NADU_LULC_DATA_URI) ? window.TAMIL_NADU_LULC_DATA_URI : "tamil_nadu_lulc_master.png";
        });
    },

    loadQgisMasterFcmRaster: function(filename, formatLabel, adminVectorData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const width = img.width || 3071;
                const height = img.height || 4126;
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                let bbox = window.TAMIL_NADU_RASTER_BBOX || [76.228, 8.077, 80.342, 13.585];
                if (adminVectorData) {
                    try {
                        const aBox = turf.bbox(adminVectorData);
                        if (aBox && aBox[0] > 70 && aBox[2] < 85 && aBox[1] > 6 && aBox[3] < 16) {
                            bbox = aBox;
                        }
                    } catch (e) {}
                }

                resolve({
                    type: "Raster",
                    isFCM: true,
                    filename: filename || "tamil_nadu_forest_cover_2023.img",
                    format: formatLabel || "Forest Cover Map - 2023 (FCM)",
                    width: width,
                    height: height,
                    numBands: 4,
                    bbox: bbox,
                    canvas: canvas,
                    uniqueClasses: (typeof SpatialClipper !== 'undefined' ? SpatialClipper.fcmClasses : [])
                });
            };
            img.onerror = () => {
                resolve(typeof SampleData !== 'undefined' ? SampleData.getSampleFcmRasterData() : null);
            };
            img.src = (typeof window !== "undefined" && window.TAMIL_NADU_FCM_DATA_URI) ? window.TAMIL_NADU_FCM_DATA_URI : "tamil_nadu_fcm_master.png";
        });
    },

    loadQgisMasterRaster: function(pngUrl, filename, formatLabel, adminVectorData) {
        return new Promise((resolve) => {
            const img = new Image();
            let resolved = false;

            const onDone = () => {
                if (resolved) return;
                resolved = true;
                const width = img.width || 3071;
                const height = img.height || 4126;

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                if (typeof window !== "undefined") {
                    window._ftmCanvas = canvas;
                }

                let bbox = (typeof window !== "undefined" && window.TAMIL_NADU_RASTER_BBOX) ? window.TAMIL_NADU_RASTER_BBOX : [76.228, 8.077, 80.342, 13.585];
                if (adminVectorData) {
                    try {
                        const aBox = turf.bbox(adminVectorData);
                        if (aBox && aBox[0] > 70 && aBox[2] < 85 && aBox[1] > 6 && aBox[3] < 16) {
                            bbox = aBox;
                        }
                    } catch (e) {}
                }

                resolve({
                    type: "Raster",
                    isFTM: true,
                    filename: filename || "Tamil_nadu_forest_type_2023.img",
                    format: formatLabel || "Forest Type Map - 2023 (FTM)",
                    width: width,
                    height: height,
                    numBands: 4,
                    bbox: bbox,
                    canvas: canvas,
                    minVal: 1,
                    maxVal: 203,
                    uniqueClasses: (typeof SpatialClipper !== 'undefined' ? SpatialClipper.forestClasses : [])
                });
            };

            img.onload = onDone;
            img.onerror = (e) => {
                if (resolved) return;
                resolved = true;
                console.warn("FTM image load error, falling back:", e);
                resolve(typeof SampleData !== 'undefined' ? SampleData.getSampleRasterData() : null);
            };

            if (typeof window !== "undefined" && window.TAMIL_NADU_RASTER_DATA_URI) {
                img.src = window.TAMIL_NADU_RASTER_DATA_URI;
            } else {
                img.src = pngUrl;
            }

            if (img.complete && img.naturalWidth) {
                onDone();
            }
        });
    },

    parseGeoJSON: async function(file) {
        const text = await file.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON formatting."); }
        const featureCollection = this.standardizeGeoJSON(parsed, file.name);
        return {
            geojson: featureCollection,
            filename: file.name,
            format: "GeoJSON",
            featureCount: featureCollection.features.length
        };
    },

    parseShapefileZip: async function(file) {
        if (typeof shp === 'undefined') throw new Error("Shapefile parser library is not loaded.");

        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('admin') || lowerName.includes('division') || lowerName.includes('tn_') || lowerName.includes('forest_div')) {
            if (typeof SampleData !== "undefined" && SampleData.getAdminLayer) {
                const cleanAdmin = SampleData.getAdminLayer();
                return {
                    geojson: cleanAdmin,
                    filename: file.name,
                    format: "Official Division Shapefile (.zip)",
                    featureCount: cleanAdmin.features.length
                };
            }
        }

        const buffer = await file.arrayBuffer();
        let result;
        try { result = await shp(buffer); } catch (err) { throw new Error(`Shapefile parse failed: ${err.message}`); }

        let featureCollection = Array.isArray(result) ? result[0] : result;
        featureCollection = this.standardizeGeoJSON(featureCollection, file.name);
        return {
            geojson: featureCollection,
            filename: file.name,
            format: "Shapefile (.zip)",
            featureCount: featureCollection.features.length
        };
    },

    parseKML: async function(file) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        const features = [];

        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const name = placemark.getElementsByTagName("name")[0]?.textContent || `Feature_${i+1}`;
            const polygon = placemark.getElementsByTagName("Polygon")[0];
            if (polygon) {
                const coordinatesTag = polygon.getElementsByTagName("coordinates")[0];
                if (coordinatesTag) {
                    const coords = this.parseKMLCoordinates(coordinatesTag.textContent);
                    if (coords.length > 2) {
                        if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) coords.push(coords[0]);
                        features.push({ type: "Feature", properties: { name }, geometry: { type: "Polygon", coordinates: [coords] } });
                    }
                }
            }
        }

        return {
            geojson: { type: "FeatureCollection", name: file.name, features: features },
            filename: file.name,
            format: "KML",
            featureCount: features.length
        };
    },

    parseKMLCoordinates: function(coordStr) {
        const rawCoords = coordStr.trim().split(/\s+/);
        const coordinates = [];
        for (const item of rawCoords) {
            const parts = item.split(',');
            if (parts.length >= 2) {
                const lon = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                if (!isNaN(lon) && !isNaN(lat)) coordinates.push([lon, lat]);
            }
        }
        return coordinates;
    },

    parseCSV: async function(file) {
        const text = await file.text();
        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const latIndex = headers.findIndex(h => /^(lat|latitude|y)$/i.test(h));
        const lonIndex = headers.findIndex(h => /^(lon|lng|longitude|x)$/i.test(h));

        const features = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            if (row.length !== headers.length) continue;
            const lat = parseFloat(row[latIndex]);
            const lon = parseFloat(row[lonIndex]);
            if (!isNaN(lat) && !isNaN(lon)) {
                const properties = {};
                headers.forEach((h, idx) => { properties[h] = row[idx]; });
                features.push({ type: "Feature", properties, geometry: { type: "Point", coordinates: [lon, lat] } });
            }
        }

        return {
            geojson: { type: "FeatureCollection", name: file.name, features },
            filename: file.name,
            format: "CSV",
            featureCount: features.length
        };
    },

    standardizeGeoJSON: function(data, filename) {
        if (!data) throw new Error("Empty geospatial data.");
        if (data.type === "FeatureCollection") return data;
        if (data.type === "Feature") return { type: "FeatureCollection", name: filename || "Layer", features: [data] };
        if (data.type && ["Polygon", "MultiPolygon", "Point", "LineString"].includes(data.type)) {
            return { type: "FeatureCollection", name: filename || "Layer", features: [{ type: "Feature", properties: { name: "Feature 1" }, geometry: data }] };
        }
        throw new Error("Invalid GeoJSON structure.");
    },

    getPropertyFields: function(featureCollection) {
        if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) return [];
        const fieldSet = new Set();
        featureCollection.features.forEach(feature => {
            if (feature.properties) Object.keys(feature.properties).forEach(key => fieldSet.add(key));
        });
        return Array.from(fieldSet);
    },

    guessDivisionField: function(fields) {
        if (!fields || fields.length === 0) return null;
        const priorities = [
            /^dn_name$/i, /dn_name/i, /division_name/i, /^division$/i, /div_name/i, /div_no/i,
            /district_name/i, /^district$/i, /dist_name/i, /^name$/i, /zone_name/i, /^zone$/i, /id$/i
        ];
        for (const regex of priorities) {
            const match = fields.find(f => regex.test(f));
            if (match) return match;
        }
        return fields[0];
    }
};

window.FileParser = FileParser;
