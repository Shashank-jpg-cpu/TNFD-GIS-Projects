/**
 * Client-Side KML & KMZ Parser
 * Parses standard OGC KML 2.2 files, extracts Placemarks, Polygons, Styles, and Attributes
 * Accurately classifies into Reserve Forest (RF) and Revenue Land (RL)
 */

const KMLParser = {
  // Expanded 40+ vibrant distinct color palette for auto-assignment
  PALETTE: [
    "#22c55e", // Emerald Green
    "#06b6d4", // Cyan
    "#3b82f6", // Royal Blue
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#f59e0b", // Amber
    "#10b981", // Teal
    "#ef4444", // Red
    "#6366f1", // Indigo
    "#14b8a6", // Mint
    "#f97316", // Orange
    "#84cc16", // Lime
    "#a855f7", // Purple
    "#0ea5e9", // Sky Blue
    "#eab308", // Golden Yellow
    "#d946ef", // Fuchsia
    "#f43f5e", // Rose
    "#059669", // Dark Emerald
    "#0284c7", // Deep Ocean
    "#7c3aed", // Deep Violet
    "#db2777", // Deep Pink
    "#d97706", // Ochre
    "#4f46e5", // Electric Indigo
    "#0d9488", // Deep Teal
    "#ea580c", // Burnt Orange
    "#65a30d", // Olive Lime
    "#9333ea", // Bright Purple
    "#2563eb", // Dodger Blue
    "#ca8a04", // Mustard
    "#c026d3", // Magenta
    "#e11d48", // Crimson
    "#15803d", // Forest Green
    "#0369a1", // Cobalt
    "#6d28d9", // Dark Purple
    "#be185d", // Ruby
    "#b45309", // Bronze
    "#4338ca", // Midnight Indigo
    "#0f766e", // Pine Teal
    "#c2410c", // Rust
    "#4d7c0f", // Jungle Green
    "#7e22ce", // Royal Purple
    "#1d4ed8", // Sapphire
    "#a16207"  // Gold Amber
  ],

  paletteIndex: 0,

  getNextColor() {
    const color = this.PALETTE[this.paletteIndex % this.PALETTE.length];
    this.paletteIndex++;
    return color;
  },

  resetPalette() {
    this.paletteIndex = 0;
  },

  /**
   * Convert KML AABBGGRR color format to standard #RRGGBB hex
   */
  kmlColorToHex(kmlColor) {
    if (!kmlColor || kmlColor.length < 6) return null;
    const clean = kmlColor.trim();
    if (clean.length === 8) {
      const bb = clean.substring(2, 4);
      const gg = clean.substring(4, 6);
      const rr = clean.substring(6, 8);
      return `#${rr}${gg}${bb}`;
    } else if (clean.length === 6) {
      const bb = clean.substring(0, 2);
      const gg = clean.substring(2, 4);
      const rr = clean.substring(4, 6);
      return `#${rr}${gg}${bb}`;
    }
    return null;
  },

  /**
   * Check if a text token explicitly represents RF (Reserve Forest)
   */
  hasRfToken(str) {
    if (!str) return false;
    const s = str.toString().trim();
    if (!s) return false;
    // Delimiter/boundary check for RF (e.g. "RF", "RF_1", "Gandamanur_RF", "RF-Bit-2", "RF 1", "(RF)", "[RF]", "RF.kml")
    if (/(^|[\s_\-([/\\.])RF([\s_\-)\]/\\.\d]|$)/i.test(s)) return true;
    const clean = s.toLowerCase().replace(/[\s_\-]+/g, ' ');
    if (
      clean.includes('reserve forest') ||
      clean.includes('reserved forest') ||
      clean.includes('r f') ||
      clean.includes('rf kml') ||
      clean.includes('rf files') ||
      clean.includes('rf boundaries') ||
      clean.includes('rf boundary')
    ) {
      return true;
    }
    return false;
  },

  /**
   * Check if a text token explicitly represents RL (Reserve Land / Revenue Land)
   */
  hasRlToken(str) {
    if (!str) return false;
    const s = str.toString().trim();
    if (!s) return false;
    // Delimiter/boundary check for RL (e.g. "RL", "RL_1", "Myladumparai_RL", "RL-Bit-2", "RL 1", "(RL)", "[RL]", "RL.kml")
    if (/(^|[\s_\-([/\\.])RL([\s_\-)\]/\\.\d]|$)/i.test(s)) return true;
    const clean = s.toLowerCase().replace(/[\s_\-]+/g, ' ');
    if (
      clean.includes('reserve land') ||
      clean.includes('reserved land') ||
      clean.includes('revenue land') ||
      clean.includes('r l') ||
      clean.includes('rl kml') ||
      clean.includes('rl files') ||
      clean.includes('rl boundaries') ||
      clean.includes('rl boundary') ||
      clean.includes('campa land') ||
      clean.includes('campa')
    ) {
      return true;
    }
    return false;
  },

  /**
   * Detect whether a placemark is RF (Reserve Forest) or RL (Reserve Land)
   * Evaluates folder names, file names, placemark names, attributes, and descriptions hierarchically.
   */
  detectType(name, description = "", fileName = "", folderName = "", extendedData = {}) {
    // 1. Check Placemark Name
    const nameHasRf = this.hasRfToken(name);
    const nameHasRl = this.hasRlToken(name);
    if (nameHasRf && !nameHasRl) return 'RF';
    if (nameHasRl && !nameHasRf) return 'RL';

    // 2. Check File Name (base file name without path)
    const normalizedPath = (fileName || "").replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/').filter(p => p.trim().length > 0);
    const rawFileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : fileName;
    const fileHasRf = this.hasRfToken(rawFileName);
    const fileHasRl = this.hasRlToken(rawFileName);
    if (fileHasRf && !fileHasRl) return 'RF';
    if (fileHasRl && !fileHasRf) return 'RL';

    // 3. Check Folder Names in Path & XML Folder / Document Name
    // Check from the closest folder up to root
    const foldersToCheck = [];
    if (folderName) foldersToCheck.push(folderName);
    if (pathParts.length > 1) {
      for (let i = pathParts.length - 2; i >= 0; i--) {
        foldersToCheck.push(pathParts[i]);
      }
    }

    for (const fld of foldersToCheck) {
      const fldHasRf = this.hasRfToken(fld);
      const fldHasRl = this.hasRlToken(fld);
      if (fldHasRf && !fldHasRl) return 'RF';
      if (fldHasRl && !fldHasRf) return 'RL';
    }

    // 4. Check ExtendedData Attributes
    if (extendedData && typeof extendedData === 'object') {
      for (const [k, v] of Object.entries(extendedData)) {
        if (typeof v === 'string') {
          const vHasRf = this.hasRfToken(v);
          const vHasRl = this.hasRlToken(v);
          if (vHasRf && !vHasRl) return 'RF';
          if (vHasRl && !vHasRf) return 'RL';
        }
      }
    }

    // 5. Check Description text
    if (description) {
      const descHasRf = this.hasRfToken(description);
      const descHasRl = this.hasRlToken(description);
      if (descHasRf && !descHasRl) return 'RF';
      if (descHasRl && !descHasRf) return 'RL';
    }

    // Default fallback for division boundaries
    return 'RF';
  },

  /**
   * Parse coordinate text string into array of [lng, lat]
   * Robust to newlines, extra spaces, tabs, and 3D altitude values
   */
  parseCoordinates(coordStr) {
    if (!coordStr) return [];
    const points = [];
    
    // Replace all linebreaks and tabs with spaces
    const cleanStr = coordStr.replace(/[\r\n\t]+/g, ' ').trim();
    const tuples = cleanStr.split(/\s+/);
    
    for (const tuple of tuples) {
      if (!tuple) continue;
      const parts = tuple.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          // Avoid consecutive identical points
          if (points.length === 0 || (Math.abs(points[points.length - 1][0] - lng) > 1e-9 || Math.abs(points[points.length - 1][1] - lat) > 1e-9)) {
            points.push([lng, lat]);
          }
        }
      }
    }

    // Ensure polygon ring has at least 3 points and is properly closed
    if (points.length >= 3) {
      const first = points[0];
      const last = points[points.length - 1];
      if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
        points.push([first[0], first[1]]);
      }
    }

    return points;
  },

  /**
   * Parse single Polygon node into GeoJSON geometry
   */
  /**
   * Parse single Polygon node into GeoJSON geometry
   */
  parsePolygonNode(polygonNode) {
    const rings = [];
    
    // Outer boundary
    const outerNode = polygonNode.getElementsByTagName('outerBoundaryIs')[0] || polygonNode.getElementsByTagName('outerboundaryis')[0];
    if (outerNode) {
      const coordNode = outerNode.getElementsByTagName('coordinates')[0];
      if (coordNode) {
        const outerRing = this.parseCoordinates(coordNode.textContent);
        if (outerRing.length >= 4) {
          rings.push(outerRing);
        }
      }
    }

    // Inner boundaries (holes)
    const innerNodes = polygonNode.getElementsByTagName('innerBoundaryIs').length > 0
      ? polygonNode.getElementsByTagName('innerBoundaryIs')
      : polygonNode.getElementsByTagName('innerboundaryis');

    for (let i = 0; i < innerNodes.length; i++) {
      const coordNode = innerNodes[i].getElementsByTagName('coordinates')[0];
      if (coordNode) {
        const innerRing = this.parseCoordinates(coordNode.textContent);
        if (innerRing.length >= 4) {
          rings.push(innerRing);
        }
      }
    }

    if (rings.length === 0) return null;
    return {
      type: "Polygon",
      coordinates: rings
    };
  },

  /**
   * Sanitize KML XML to fix missing namespace declarations (like xmlns:xsi, xmlns:gx, xmlns:kml)
   * that cause strict DOMParser failures on valid KML files.
   */
  sanitizeKmlXml(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') return "";
    let clean = xmlText;

    // Remove byte order mark (BOM) if present
    if (clean.charCodeAt(0) === 0xFEFF) {
      clean = clean.slice(1);
    }

    // Fix xsi: prefix without declaration
    if ((/xsi:/i.test(clean) || /schemaLocation/i.test(clean)) && !/xmlns:xsi/i.test(clean)) {
      clean = clean.replace(/<kml\b([^>]*)>/i, '<kml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" $1>');
    }

    // Fix gx: prefix without declaration
    if (/gx:/i.test(clean) && !/xmlns:gx/i.test(clean)) {
      clean = clean.replace(/<kml\b([^>]*)>/i, '<kml xmlns:gx="http://www.google.com/kml/ext/2.2" $1>');
    }

    // Fix kml: prefix without declaration
    if (/kml:/i.test(clean) && !/xmlns:kml/i.test(clean)) {
      clean = clean.replace(/<kml\b([^>]*)>/i, '<kml xmlns:kml="http://www.opengis.net/kml/2.2" $1>');
    }

    // Ensure default xmlns if missing
    if (!/xmlns\s*=/i.test(clean)) {
      clean = clean.replace(/<kml\b([^>]*)>/i, '<kml xmlns="http://www.opengis.net/kml/2.2" $1>');
    }

    return clean;
  },

  /**
   * Safe DOM parser that tries text/xml with sanitization, and falls back to text/html for lenient parsing
   */
  parseXmlDoc(kmlText) {
    if (!kmlText || typeof kmlText !== 'string') return null;
    if (typeof DOMParser === 'undefined') return null;
    const parser = new DOMParser();
    const sanitized = this.sanitizeKmlXml(kmlText);

    try {
      let doc = parser.parseFromString(sanitized, "text/xml");
      let errNode = doc.getElementsByTagName("parsererror")[0];
      if (!errNode) return doc;

      // If parsererror occurred, try stripping schemaLocation and problematic namespace attributes
      let aggressiveClean = sanitized
        .replace(/\b[a-zA-Z0-9_-]+:schemaLocation\s*=\s*"[^"]*"/gi, '')
        .replace(/\b[a-zA-Z0-9_-]+:schemaLocation\s*=\s*'[^']*'/gi, '')
        .replace(/\bschemaLocation\s*=\s*"[^"]*"/gi, '')
        .replace(/\bschemaLocation\s*=\s*'[^']*'/gi, '');

      doc = parser.parseFromString(aggressiveClean, "text/xml");
      errNode = doc.getElementsByTagName("parsererror")[0];
      if (!errNode) return doc;

      // Fallback to text/html lenient parsing
      return parser.parseFromString(sanitized, "text/html");
    } catch (e) {
      try {
        return parser.parseFromString(sanitized, "text/html");
      } catch (err2) {
        return null;
      }
    }
  },

  /**
   * Parse KML string content
   * @param {string} kmlText - Raw KML XML string
   * @param {string} fileName - Original file name for context
   * @returns {Array} List of extracted feature objects
   */
  parseKML(kmlText, fileName = "Uploaded File") {
    const features = [];
    try {
      const xmlDoc = this.parseXmlDoc(kmlText);
      if (!xmlDoc) return [];

      let placemarks = xmlDoc.getElementsByTagName("Placemark");
      if (!placemarks || placemarks.length === 0) {
        placemarks = xmlDoc.getElementsByTagName("placemark");
      }
      if (!placemarks || placemarks.length === 0) {
        return [];
      }

      // Document name fallback
      let docName = "";
      const docNodes = xmlDoc.getElementsByTagName("Document").length > 0
        ? xmlDoc.getElementsByTagName("Document")
        : xmlDoc.getElementsByTagName("document");
      if (docNodes && docNodes.length > 0) {
        const dName = docNodes[0].getElementsByTagName("name")[0];
        if (dName && dName.textContent) docName = dName.textContent.trim();
      }

      // Extract base name and parent folders if available from relative path
      const normalizedPath = (fileName || "").replace(/\\/g, '/');
      const pathParts = normalizedPath.split('/').filter(p => p.trim().length > 0);
      const rawFileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : fileName;
      const cleanFileName = rawFileName.replace(/\.(kml|xml|kmz)$/i, '').trim();
      const parentFolderFromPath = pathParts.length > 1 ? pathParts[pathParts.length - 2] : "";

      for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];

        // Description
        const descNode = pm.getElementsByTagName("description")[0] || pm.getElementsByTagName("Description")[0];
        const description = descNode ? descNode.textContent.trim() : "";

        // Extended Data & Attributes
        const extendedData = {};
        const simpleDataNodes = pm.getElementsByTagName("SimpleData");
        for (let s = 0; s < simpleDataNodes.length; s++) {
          const nameAttr = simpleDataNodes[s].getAttribute("name");
          if (nameAttr) {
            extendedData[nameAttr] = simpleDataNodes[s].textContent.trim();
          }
        }

        const dataNodes = pm.getElementsByTagName("Data");
        for (let d = 0; d < dataNodes.length; d++) {
          const nameAttr = dataNodes[d].getAttribute("name");
          const valNode = dataNodes[d].getElementsByTagName("value")[0];
          if (nameAttr && valNode) {
            extendedData[nameAttr] = valNode.textContent.trim();
          }
        }

        // Check parent folder name
        let folderName = "";
        let parent = pm.parentElement;
        while (parent) {
          if (/^(Folder|Document|folder|document)$/i.test(parent.tagName)) {
            const fName = parent.getElementsByTagName("name")[0];
            if (fName && fName.textContent) {
              folderName = fName.textContent.trim();
              break;
            }
          }
          parent = parent.parentElement;
        }
        if (!folderName && parentFolderFromPath) {
          folderName = parentFolderFromPath;
        }

        // Determine clean, descriptive Placemark Name
        const nameNode = pm.getElementsByTagName("name")[0];
        const rawName = nameNode ? nameNode.textContent.trim() : "";

        // Check if raw name is purely a number (e.g. FID "1", "2") or generic placeholder
        const isGenericNumber = !rawName || /^\d+$/.test(rawName) || /^(polygon|placemark|untitled|layer|shape)/i.test(rawName);

        // Check ExtendedData for descriptive name attribute
        let attrName = "";
        for (const [key, val] of Object.entries(extendedData)) {
          if (/(name|forest|rf|rl|block|range|comp|survey|bit|desc)/i.test(key) && val && !/^\d+$/.test(val)) {
            attrName = val;
            break;
          }
        }

        let resolvedName = rawName;
        if (isGenericNumber) {
          if (attrName) {
            resolvedName = rawName ? `${attrName} [Bit ${rawName}]` : attrName;
          } else if (cleanFileName && !/^\d+$/.test(cleanFileName)) {
            resolvedName = rawName ? `${cleanFileName} [Bit ${rawName}]` : (placemarks.length > 1 ? `${cleanFileName} - Part ${i + 1}` : cleanFileName);
          } else if (folderName && !/^\d+$/.test(folderName)) {
            resolvedName = rawName ? `${folderName} [Bit ${rawName}]` : folderName;
          } else if (docName && !/^\d+$/.test(docName)) {
            resolvedName = rawName ? `${docName} [Bit ${rawName}]` : docName;
          } else {
            resolvedName = `Boundary Bit ${rawName || i + 1}`;
          }
        } else {
          resolvedName = rawName;
        }

        const name = resolvedName;

        // Detect Polygon / MultiGeometry
        let polygonNodes = pm.getElementsByTagName("Polygon");
        if (!polygonNodes || polygonNodes.length === 0) {
          polygonNodes = pm.getElementsByTagName("polygon");
        }

        let geometry = null;

        if (polygonNodes.length === 1) {
          geometry = this.parsePolygonNode(polygonNodes[0]);
        } else if (polygonNodes.length > 1) {
          const polyCoords = [];
          for (let p = 0; p < polygonNodes.length; p++) {
            const polyGeom = this.parsePolygonNode(polygonNodes[p]);
            if (polyGeom && polyGeom.coordinates.length > 0) {
              polyCoords.push(polyGeom.coordinates);
            }
          }
          if (polyCoords.length > 0) {
            geometry = {
              type: "MultiPolygon",
              coordinates: polyCoords
            };
          }
        }

        if (!geometry) continue;

        // Extract inline style color if available
        let assignedColor = null;
        const polyStyleNode = pm.getElementsByTagName("PolyStyle")[0] || pm.getElementsByTagName("polystyle")[0];
        if (polyStyleNode) {
          const colorNode = polyStyleNode.getElementsByTagName("color")[0];
          if (colorNode) {
            assignedColor = this.kmlColorToHex(colorNode.textContent);
          }
        }

        const featureType = this.detectType(name, description, fileName, folderName, extendedData);
        const color = assignedColor || this.getNextColor();

        // Compute area with high precision
        let areaObj = { ha: 0, acres: 0, sqkm: 0, sqm: 0 };
        if (window.SpatialEngine) {
          areaObj = window.SpatialEngine.calculateArea(geometry);
        }

        const featureObj = {
          id: `feat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: name,
          type: featureType, // 'RF' | 'RL'
          color: color,
          fillStyle: "solid", // 'solid' | 'outline'
          fillOpacity: 0.45,
          strokeWidth: 2,
          geometry: geometry,
          description: description,
          folderName: folderName,
          extendedData: extendedData,
          sourceFile: fileName,
          areaHa: areaObj.ha,
          originalAreaHa: areaObj.ha,
          areaObj: areaObj
        };

        features.push(featureObj);
      }
    } catch (err) {
      console.warn(`Error parsing KML in file "${fileName}":`, err);
    }

    return features;
  },

  /**
   * Recursively extract all .kml and .kmz files from DataTransfer (drag & drop)
   * Supporting arbitrary folder and subfolder depth via FileSystem Entry API
   * Ignores any non-KML files (like shapefiles, PDFs, images, docs)
   * @param {DataTransfer} dataTransfer
   * @returns {Promise<Array<File>>} List of File objects
   */
  async extractFilesFromDataTransfer(dataTransfer) {
    const files = [];
    const isKmlOrKmz = (name) => /\.(kml|kmz)$/i.test(name || '') || (/\.xml$/i.test(name || '') && !/\.qml|\.gml|\.shp\.xml/i.test(name || ''));

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      const entries = [];
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) entries.push(entry);
        } else if (item.getAsFile) {
          const f = item.getAsFile();
          if (f && isKmlOrKmz(f.name)) files.push(f);
        }
      }

      if (entries.length > 0) {
        async function readAllEntriesFromReader(dirReader) {
          const dirEntries = [];
          const readBatch = () => new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));
          let batch;
          do {
            batch = await readBatch();
            for (let j = 0; j < batch.length; j++) {
              dirEntries.push(batch[j]);
            }
          } while (batch && batch.length > 0);
          return dirEntries;
        }

        async function traverseEntry(entry, currentPath = "") {
          if (entry.isFile) {
            return new Promise((resolve) => {
              entry.file((file) => {
                if (isKmlOrKmz(file.name)) {
                  try {
                    Object.defineProperty(file, 'webkitRelativePath', {
                      value: currentPath + file.name,
                      writable: true,
                      configurable: true
                    });
                  } catch (e) {
                    file.relativePath = currentPath + file.name;
                  }
                  files.push(file);
                }
                resolve();
              }, (err) => {
                console.warn("Could not read file entry:", err);
                resolve();
              });
            });
          } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            try {
              const childEntries = await readAllEntriesFromReader(dirReader);
              const promises = childEntries.map(child => traverseEntry(child, `${currentPath}${entry.name}/`));
              await Promise.all(promises);
            } catch (err) {
              console.warn("Could not read directory entries:", err);
            }
          }
        }

        const traversePromises = entries.map(entry => traverseEntry(entry));
        await Promise.all(traversePromises);
        return files;
      }
    }

    // Fallback to standard files list
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const f = dataTransfer.files[i];
        if (isKmlOrKmz(f.name)) {
          files.push(f);
        }
      }
    }

    return files;
  },

  /**
   * Read multiple files from HTML FileList or Array of Files
   * Resiliently parses all valid KML / KMZ files and smoothly ignores remaining files
   * @param {FileList|Array} files
   * @returns {Promise<Array>} List of parsed features
   */
  async parseMultipleFiles(files) {
    const allFeatures = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.webkitRelativePath || file.relativePath || file.name;
      const lowerName = (file.name || '').toLowerCase();

      // Only recognize KML and KMZ files (and XML if not GIS metadata), ignore remaining files
      const isKml = lowerName.endsWith('.kml');
      const isKmz = lowerName.endsWith('.kmz');
      const isXml = lowerName.endsWith('.xml') && !lowerName.endsWith('.shp.xml') && !lowerName.endsWith('.qml');

      if (!isKml && !isKmz && !isXml) {
        continue; // Smoothly skip non-KML files
      }

      try {
        if (isKml || isXml) {
          const text = await file.text();
          // Skip non-KML XML files smoothly
          if (isXml && !/<kml|<Placemark|<Document|<Folder/i.test(text)) {
            continue;
          }
          const features = this.parseKML(text, fileName);
          if (Array.isArray(features) && features.length > 0) {
            allFeatures.push(...features);
          }
        } else if (isKmz) {
          if (window.JSZip) {
            try {
              const zip = await JSZip.loadAsync(file);
              const kmlFiles = Object.values(zip.files).filter(f => !f.dir && f.name.toLowerCase().endsWith('.kml'));
              for (const kFile of kmlFiles) {
                try {
                  const kmlText = await kFile.async("string");
                  const innerFeatures = this.parseKML(kmlText, fileName);
                  if (Array.isArray(innerFeatures) && innerFeatures.length > 0) {
                    allFeatures.push(...innerFeatures);
                  }
                } catch (kErr) {
                  console.warn(`Could not parse inner KML in KMZ ${fileName}:`, kErr);
                }
              }
            } catch (e) {
              console.warn(`Skipping unreadable or corrupt KMZ file: ${fileName}`, e);
            }
          } else {
            console.warn("KMZ file detected. JSZip required.");
          }
        }
      } catch (err) {
        console.warn(`Skipping unreadable file: ${fileName}`, err);
      }
    }

    return allFeatures;
  }
};

window.KMLParser = KMLParser;
