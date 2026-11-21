/**
 * File Handler Module - Import & Export for Shapefile (.zip), KML, and GeoJSON
 */

const FileHandler = {
    PRJ_WGS84: 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',

    /**
     * Parse any vector file (.zip Shapefile, .kml, .geojson, .json)
     */
    parseFile: async function(file) {
        const name = file.name.toLowerCase();
        let geojson = null;
        let format = "Unknown";

        if (name.endsWith('.zip')) {
            geojson = await this.parseShapefileZip(file);
            format = "Shapefile (.zip)";
        } else if (name.endsWith('.kmz')) {
            geojson = await this.parseKMZ(file);
            format = "Google Earth KMZ";
        } else if (name.endsWith('.kml')) {
            geojson = await this.parseKML(file);
            format = "Google Earth KML";
        } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
            geojson = await this.parseGeoJSON(file);
            format = "GeoJSON";
        } else {
            throw new Error(`Unsupported file type: ${file.name}. Please upload ESRI Shapefile (.zip), KML (.kml), KMZ (.kmz), or GeoJSON (.geojson).`);
        }

        geojson = this.standardizeGeoJSON(geojson, file.name);

        return {
            filename: file.name,
            format: format,
            geojson: geojson,
            featureCount: geojson.features.length,
            nameField: this.detectNameField(geojson)
        };
    },

    parseGeoJSON: async function(file) {
        const text = await file.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Invalid JSON syntax in file: " + e.message);
        }
    },

    parseShapefileZip: async function(file) {
        if (typeof shp === 'undefined') {
            throw new Error("Shapefile parser library (shpjs) is not loaded.");
        }
        const buffer = await file.arrayBuffer();
        let res;
        try {
            res = await shp(buffer);
        } catch (e) {
            throw new Error("Shapefile extraction failed: " + e.message);
        }
        if (Array.isArray(res)) return res[0];
        return res;
    },

    parseKMZ: async function(file) {
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library is not loaded. Cannot unzip KMZ archive.");
        }
        let zipContent;
        try {
            const buffer = await file.arrayBuffer();
            const zip = new JSZip();
            zipContent = await zip.loadAsync(buffer);
        } catch (e) {
            throw new Error("Failed to read KMZ file archive: " + e.message);
        }

        // Search for .kml file inside KMZ (commonly doc.kml or any .kml file)
        let kmlEntry = null;
        const fileNames = Object.keys(zipContent.files);
        for (const fname of fileNames) {
            if (fname.toLowerCase().endsWith('.kml')) {
                // Prefer doc.kml if multiple exist
                if (!kmlEntry || fname.toLowerCase().endsWith('doc.kml')) {
                    kmlEntry = zipContent.files[fname];
                }
            }
        }

        if (!kmlEntry) {
            throw new Error("No KML boundary file found inside the uploaded KMZ archive.");
        }

        const kmlText = await kmlEntry.async("string");
        return this.parseKMLString(kmlText);
    },

    parseKML: async function(file) {
        const text = await file.text();
        return this.parseKMLString(text);
    },

    parseKMLString: function(text) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const placemarks = xml.getElementsByTagName("Placemark");
        const features = [];

        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const nameEl = pm.getElementsByTagName("name")[0];
            const name = nameEl ? nameEl.textContent.trim() : `Placemark_${i + 1}`;

            // Check multi-geometry first!
            const multi = pm.getElementsByTagName("MultiGeometry")[0];
            if (multi) {
                const polys = multi.getElementsByTagName("Polygon");
                const multiCoords = [];
                for (let p = 0; p < polys.length; p++) {
                    const outer = polys[p].getElementsByTagName("outerBoundaryIs")[0] || polys[p];
                    const coordsEl = outer.getElementsByTagName("coordinates")[0];
                    if (coordsEl) {
                        const coords = this.parseKMLCoords(coordsEl.textContent);
                        if (coords.length >= 3) multiCoords.push([coords]);
                    }
                }
                if (multiCoords.length > 0) {
                    features.push({
                        type: "Feature",
                        properties: { name: name },
                        geometry: {
                            type: "MultiPolygon",
                            coordinates: multiCoords
                        }
                    });
                }
                // Do NOT process standalone Polygon to avoid duplicate features!
                continue;
            }

            // Check single polygon
            const poly = pm.getElementsByTagName("Polygon")[0];
            if (poly) {
                const outer = poly.getElementsByTagName("outerBoundaryIs")[0] || poly;
                const coordsEl = outer.getElementsByTagName("coordinates")[0];
                if (coordsEl) {
                    const coords = this.parseKMLCoords(coordsEl.textContent);
                    if (coords.length >= 3) {
                        features.push({
                            type: "Feature",
                            properties: { name: name },
                            geometry: {
                                type: "Polygon",
                                coordinates: [coords]
                            }
                        });
                    }
                }
            }
        }

        if (features.length === 0) {
            throw new Error("No polygon boundaries found in the provided KML/KMZ file.");
        }

        return {
            type: "FeatureCollection",
            features: features
        };
    },

    parseKMLCoords: function(raw) {
        const coords = [];
        const tuples = raw.trim().split(/\s+/);
        tuples.forEach(t => {
            const parts = t.split(',').map(Number);
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                coords.push([parts[0], parts[1]]);
            }
        });
        if (coords.length > 2) {
            // Close if needed
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push([first[0], first[1]]);
            }
        }
        return coords;
    },

    standardizeGeoJSON: function(data, fallbackName = "layer") {
        if (!data) return { type: "FeatureCollection", features: [] };
        if (data.type === "Feature") {
            return { type: "FeatureCollection", name: fallbackName, features: [data] };
        }
        if (data.type === "Polygon" || data.type === "MultiPolygon") {
            return {
                type: "FeatureCollection",
                name: fallbackName,
                features: [{ type: "Feature", properties: { name: fallbackName }, geometry: data }]
            };
        }
        if (data.type === "FeatureCollection") {
            // Filter to polygons
            const valid = (data.features || []).filter(f => f && f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
            
            // Deduplicate: if two features have identical ring coordinates (e.g. Polygon & MultiPolygon from same Placemark)
            const unique = [];
            for (const f of valid) {
                const geom = f.geometry;
                const isDup = unique.some(u => {
                    const uGeom = u.geometry;
                    const ringF = (geom.type === 'Polygon' ? geom.coordinates[0] : (geom.coordinates[0] ? geom.coordinates[0][0] : null));
                    const ringU = (uGeom.type === 'Polygon' ? uGeom.coordinates[0] : (uGeom.coordinates[0] ? uGeom.coordinates[0][0] : null));
                    if (ringF && ringU && ringF.length === ringU.length) {
                        return ringF[0][0] === ringU[0][0] && ringF[0][1] === ringU[0][1] &&
                               ringF[Math.floor(ringF.length / 2)][0] === ringU[Math.floor(ringU.length / 2)][0];
                    }
                    return false;
                });
                if (!isDup) unique.push(f);
            }

            return {
                type: "FeatureCollection",
                name: data.name || fallbackName,
                features: unique.length > 0 ? unique : valid
            };
        }
        return { type: "FeatureCollection", features: [] };
    },

    detectNameField: function(fc) {
        if (!fc || !fc.features || fc.features.length === 0) return "name";
        const props = fc.features[0].properties || {};
        const keys = Object.keys(props);
        const candidates = ['name', 'NAME', 'division', 'DIVISION', 'district', 'DISTRICT', 'DIST_NAME', 'DIV_NAME', 'DN_NAME', 'title'];
        for (const c of candidates) {
            if (keys.includes(c)) return c;
        }
        return keys[0] || "name";
    },

    /**
     * Export GeoJSON to Shapefile (.zip), KML (.kml), or GeoJSON (.geojson)
     */
    exportDataset: async function(geoJSON, format, filename = "Aligned_Boundary") {
        const cleanBaseName = filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");

        if (format === 'shp') {
            await this.downloadShapefileZip(geoJSON, cleanBaseName);
        } else if (format === 'kmz') {
            await this.downloadKMZ(geoJSON, cleanBaseName);
        } else if (format === 'kml') {
            this.downloadKML(geoJSON, cleanBaseName);
        } else {
            this.downloadGeoJSON(geoJSON, cleanBaseName);
        }
    },

    downloadGeoJSON: function(geoJSON, filename) {
        const jsonStr = JSON.stringify(geoJSON, null, 2);
        const blob = new Blob([jsonStr], { type: "application/geo+json" });
        this.triggerDownload(blob, `${filename}.geojson`);
    },

    downloadKML: function(geoJSON, filename) {
        const kmlStr = this.generateKML(geoJSON, filename);
        const blob = new Blob([kmlStr], { type: "application/vnd.google-earth.kml+xml" });
        this.triggerDownload(blob, `${filename}.kml`);
    },

    downloadKMZ: async function(geoJSON, filename) {
        if (typeof JSZip === 'undefined') {
            this.downloadKML(geoJSON, filename);
            return;
        }
        try {
            const kmlStr = this.generateKML(geoJSON, filename);
            const zip = new JSZip();
            zip.file("doc.kml", kmlStr);
            const blob = await zip.generateAsync({ type: "blob" });
            this.triggerDownload(blob, `${filename}.kmz`);
        } catch (e) {
            console.warn("KMZ generation failed, falling back to KML:", e);
            this.downloadKML(geoJSON, filename);
        }
    },

    generateKML: function(geoJSON, title) {
        const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const features = geoJSON.features || [];

        let placemarks = "";
        features.forEach((f, idx) => {
            const props = f.properties || {};
            const name = props.name || props.NAME || props.division || props.district || `Feature_${idx + 1}`;
            const geom = f.geometry;
            if (!geom) return;

            let geomXml = "";
            const coordsToKml = (ring) => ring.map(c => `${c[0]},${c[1]},0`).join(' ');

            if (geom.type === 'Polygon') {
                geomXml = `
                    <Polygon>
                        <outerBoundaryIs>
                            <LinearRing>
                                <coordinates>${coordsToKml(geom.coordinates[0])}</coordinates>
                            </LinearRing>
                        </outerBoundaryIs>
                    </Polygon>`;
            } else if (geom.type === 'MultiPolygon') {
                geomXml = `<MultiGeometry>` + geom.coordinates.map(poly => `
                    <Polygon>
                        <outerBoundaryIs>
                            <LinearRing>
                                <coordinates>${coordsToKml(poly[0])}</coordinates>
                            </LinearRing>
                        </outerBoundaryIs>
                    </Polygon>`).join('') + `</MultiGeometry>`;
            }

            // Extended Data
            let extXml = "<ExtendedData>";
            Object.entries(props).forEach(([k, v]) => {
                extXml += `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`;
            });
            extXml += "</ExtendedData>";

            placemarks += `
                <Placemark>
                    <name>${esc(name)}</name>
                    <styleUrl>#alignedStyle</styleUrl>
                    ${extXml}
                    ${geomXml}
                </Placemark>`;
        });

        return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(title)}</name>
    <Style id="alignedStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3.5</width>
      </LineStyle>
      <PolyStyle>
        <color>2200ff00</color>
      </PolyStyle>
    </Style>
    ${placemarks}
  </Document>
</kml>`;
    },

    downloadShapefileZip: async function(geoJSON, filename) {
        if (typeof shpwrite === 'undefined') {
            throw new Error("Shapefile generator library (shpwrite) is not loaded.");
        }

        try {
            // Clean properties for DBF format (truncate keys to max 10 chars, convert nulls)
            const cleanFC = {
                type: "FeatureCollection",
                features: (geoJSON.features || []).map(f => {
                    const cleanProps = {};
                    if (f.properties) {
                        Object.entries(f.properties).forEach(([k, v]) => {
                            const cleanKey = k.slice(0, 10).replace(/[^a-zA-Z0-9_]/g, "");
                            cleanProps[cleanKey] = (v === null || v === undefined) ? "" : String(v).slice(0, 254);
                        });
                    }
                    return {
                        type: "Feature",
                        properties: cleanProps,
                        geometry: f.geometry
                    };
                })
            };

            const options = {
                folder: filename,
                types: {
                    polygon: filename
                }
            };

            // shpwrite.zip returns JSZip or string
            const zipObj = shpwrite.zip(cleanFC, options);

            // Add standard WGS84 .prj file inside zip
            if (zipObj && typeof zipObj.file === 'function') {
                zipObj.file(`${filename}/${filename}.prj`, this.PRJ_WGS84);
                zipObj.file(`${filename}.prj`, this.PRJ_WGS84);
                const blob = await zipObj.generateAsync({ type: "blob" });
                this.triggerDownload(blob, `${filename}.zip`);
                return;
            }

            // Fallback: direct download using shpwrite.download
            shpwrite.download(cleanFC, options);
        } catch (err) {
            console.error("Shapefile export error:", err);
            // Fallback: Offer GeoJSON if Shapefile binary packaging encountered an edge-case
            alert(`Shapefile generator encountered an issue: ${err.message}. Downloading as GeoJSON instead.`);
            this.downloadGeoJSON(geoJSON, filename);
        }
    },

    triggerDownload: function(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 15000);
    }
};

if (typeof window !== "undefined") {
    window.FileHandler = FileHandler;
}
