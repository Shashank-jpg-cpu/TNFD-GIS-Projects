/**
 * KML Exporter
 * Serializes GeoJSON polygons and attributes into standard Google Earth KML 2.2 format
 */

const KMLExporter = {
  /**
   * Convert Hex color (#RRGGBB) to KML color format (AABBGGRR)
   * @param {string} hexColor - e.g. '#22c55e'
   * @param {number} opacity - 0 to 1
   */
  hexToKmlColor(hexColor, opacity = 0.5) {
    if (!hexColor) return "7f00ff00"; // default semi-transparent green
    let cleanHex = hexColor.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    
    // Alpha in hex (00 to ff)
    const alphaInt = Math.round(opacity * 255);
    const a = alphaInt.toString(16).padStart(2, '0');

    // KML format is AABBGGRR
    return `${a}${b}${g}${r}`;
  },

  /**
   * Convert coordinate array into KML coordinate string
   * @param {Array} coords - Array of [lng, lat]
   */
  coordinatesToKml(coords) {
    return coords.map(pt => `${pt[0]},${pt[1]},0`).join(' ');
  },

  /**
   * Generate Polygon XML block
   */
  generatePolygonKml(geometry) {
    if (!geometry) return '';
    
    if (geometry.type === 'Polygon') {
      const outerRing = geometry.coordinates[0];
      let kml = `
        <Polygon>
          <extrude>1</extrude>
          <altitudeMode>clampToGround</altitudeMode>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${this.coordinatesToKml(outerRing)}</coordinates>
            </LinearRing>
          </outerBoundaryIs>`;
      
      // Inner rings (holes)
      for (let i = 1; i < geometry.coordinates.length; i++) {
        kml += `
          <innerBoundaryIs>
            <LinearRing>
              <coordinates>${this.coordinatesToKml(geometry.coordinates[i])}</coordinates>
            </LinearRing>
          </innerBoundaryIs>`;
      }
      kml += `
        </Polygon>`;
      return kml;
    } else if (geometry.type === 'MultiPolygon') {
      let kml = `
        <MultiGeometry>`;
      for (const polyCoords of geometry.coordinates) {
        const outerRing = polyCoords[0];
        kml += `
          <Polygon>
            <extrude>1</extrude>
            <altitudeMode>clampToGround</altitudeMode>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>${this.coordinatesToKml(outerRing)}</coordinates>
              </LinearRing>
            </outerBoundaryIs>`;
        for (let i = 1; i < polyCoords.length; i++) {
          kml += `
            <innerBoundaryIs>
              <LinearRing>
                <coordinates>${this.coordinatesToKml(polyCoords[i])}</coordinates>
              </LinearRing>
            </innerBoundaryIs>`;
        }
        kml += `
          </Polygon>`;
      }
      kml += `
        </MultiGeometry>`;
      return kml;
    }
    return '';
  },

  /**
   * Generate Placemark XML
   */
  generatePlacemarkKml(feature, styleId) {
    const areaHa = feature.areaHa !== undefined ? feature.areaHa.toFixed(3) : '0.000';
    const areaAcres = feature.areaObj ? feature.areaObj.acres.toFixed(3) : (feature.areaHa * 2.47105).toFixed(3);
    const category = feature.type === 'RF' ? 'Reserve Forest (RF)' : 'Reserve Land (RL)';

    return `
    <Placemark>
      <name><![CDATA[${feature.name}]]></name>
      <description><![CDATA[
        <b>Type:</b> ${category}<br/>
        <b>Calculated Area:</b> ${areaHa} Ha (${areaAcres} Acres)<br/>
        <b>Status:</b> ${feature.isCorrected ? 'Overlap Corrected' : 'Original'}<br/>
        ${feature.description ? `<p>${feature.description}</p>` : ''}
      ]]></description>
      <styleUrl>#${styleId}</styleUrl>
      <ExtendedData>
        <Data name="Category"><value>${feature.type}</value></Data>
        <Data name="Area_Hectares"><value>${areaHa}</value></Data>
        <Data name="Area_Acres"><value>${areaAcres}</value></Data>
        <Data name="Color"><value>${feature.color}</value></Data>
        <Data name="Corrected_Boundary"><value>${feature.isCorrected ? 'Yes' : 'No'}</value></Data>
      </ExtendedData>
      ${this.generatePolygonKml(feature.geometry)}
    </Placemark>`;
  },

  /**
   * Build complete KML document from features array
   * @param {Array} features
   * @param {string} documentName
   */
  buildKmlDocument(features, documentName = "Division_RF_RL_Map") {
    let stylesKml = '';
    let placemarksKml = '';

    features.forEach((feat, index) => {
      const styleId = `style_${feat.id || index}`;
      const strokeColor = this.hexToKmlColor(feat.color, 1.0);
      const fillColor = feat.fillStyle === 'outline' 
        ? "00000000" // Fully transparent
        : this.hexToKmlColor(feat.color, feat.fillOpacity || 0.45);
      
      stylesKml += `
    <Style id="${styleId}">
      <LineStyle>
        <color>${strokeColor}</color>
        <width>${feat.strokeWidth || 2}</width>
      </LineStyle>
      <PolyStyle>
        <color>${fillColor}</color>
        <fill>${feat.fillStyle === 'outline' ? 0 : 1}</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>`;

      placemarksKml += this.generatePlacemarkKml(feat, styleId);
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name><![CDATA[${documentName}]]></name>
    <description><![CDATA[Division RF & RL Clean Boundaries - Exported with Zero Overlaps]]></description>
    ${stylesKml}
    ${placemarksKml}
  </Document>
</kml>`;
  },

  /**
   * Trigger file download in browser
   * @param {string} content - KML XML String
   * @param {string} filename - Filename with .kml
   */
  downloadFile(content, filename = "KML_Boundaries.kml") {
    const mime = "application/vnd.google-earth.kml+xml";
    if (typeof window !== "undefined" && window.AndroidBlobDownloader) {
      try {
        const base64 = btoa(unescape(encodeURIComponent(content)));
        window.AndroidBlobDownloader.getBase64FromBlobData("data:" + mime + ";base64," + base64, filename, mime);
        return;
      } catch (e) {
        console.warn("Base64 conversion fallback:", e);
      }
    }
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Export single feature as KML
   */
  exportSingleFeature(feature) {
    const safeName = (feature.name || 'boundary').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}.kml`;
    const kml = this.buildKmlDocument([feature], feature.name);
    this.downloadFile(kml, filename);
  },

  /**
   * Export multiple features as single KML file
   */
  exportMultipleFeatures(features, documentName = "Boundaries_Export") {
    const safeName = documentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}.kml`;
    const kml = this.buildKmlDocument(features, documentName);
    this.downloadFile(kml, filename);
  },

  /**
   * Export all features as single KML
   */
  exportAllFeatures(features, documentName = "KML_Boundaries") {
    const safeName = (documentName || 'KML_Boundaries').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}.kml`;
    const kml = this.buildKmlDocument(features, safeName);
    this.downloadFile(kml, filename);
  }
};

window.KMLExporter = KMLExporter;
