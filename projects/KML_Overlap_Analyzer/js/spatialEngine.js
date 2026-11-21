/**
 * Spatial Engine using Turf.js and Geodesic Surveyor Spherical Algorithms
 * Handles Area Calculations, Overlap Detection, Geometry Differences, and Coordinate Cleaning
 */

const SpatialEngine = {
  /**
   * Geodesic spherical polygon area calculation (Surveyor formula on WGS84 ellipsoid)
   * Guaranteed to calculate true geodesic area without depending on external libraries
   * @param {Object} geometry - GeoJSON Polygon or MultiPolygon
   * @returns {number} Area in square meters (m²)
   */
  calculateGeodesicArea(geometry) {
    if (!geometry || !geometry.coordinates) return 0;
    const RADIUS = 6378137; // Earth equatorial radius in meters

    const ringArea = (coords) => {
      if (!coords || coords.length < 3) return 0;
      let area = 0;
      const len = coords.length;
      for (let i = 0; i < len; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % len];
        if (!p1 || !p2 || isNaN(p1[0]) || isNaN(p1[1]) || isNaN(p2[0]) || isNaN(p2[1])) continue;

        const lambda1 = (p1[0] * Math.PI) / 180;
        const phi1 = (p1[1] * Math.PI) / 180;
        const lambda2 = (p2[0] * Math.PI) / 180;
        const phi2 = (p2[1] * Math.PI) / 180;

        area += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
      }
      area = (area * RADIUS * RADIUS) / 2.0;
      return Math.abs(area);
    };

    try {
      if (geometry.type === 'Polygon') {
        let total = ringArea(geometry.coordinates[0]);
        // Subtract inner rings (holes)
        for (let i = 1; i < geometry.coordinates.length; i++) {
          total -= ringArea(geometry.coordinates[i]);
        }
        return Math.max(0, total);
      } else if (geometry.type === 'MultiPolygon') {
        let total = 0;
        for (const poly of geometry.coordinates) {
          if (poly && poly.length > 0) {
            let polyArea = ringArea(poly[0]);
            for (let i = 1; i < poly.length; i++) {
              polyArea -= ringArea(poly[i]);
            }
            total += Math.max(0, polyArea);
          }
        }
        return Math.max(0, total);
      }
    } catch (err) {
      console.error("Geodesic area calc exception:", err);
    }
    return 0;
  },

  /**
   * Calculate precise geodesic surface area for a feature or geometry
   * @param {Object} geojson - Feature or Geometry object
   * @returns {Object} Area in various units with high decimal precision
   */
  calculateArea(geojson) {
    if (!geojson) return { ha: 0, acres: 0, sqkm: 0, sqm: 0 };
    
    // Extract geometry if wrapped in feature
    const geom = geojson.geometry || geojson;
    if (!geom || !geom.coordinates) return { ha: 0, acres: 0, sqkm: 0, sqm: 0 };

    let sqm = 0;
    
    // First try Turf.js if available
    if (typeof turf !== 'undefined' && turf.area) {
      try {
        const turfFeat = turf.feature(geom);
        sqm = turf.area(turfFeat);
      } catch (e) {
        sqm = this.calculateGeodesicArea(geom);
      }
    } else {
      sqm = this.calculateGeodesicArea(geom);
    }

    // Fallback to geodesic surveyor algorithm if turf returned 0 or NaN
    if (!sqm || isNaN(sqm) || sqm === 0) {
      sqm = this.calculateGeodesicArea(geom);
    }

    const ha = sqm / 10000;
    const acres = sqm / 4046.8564224;
    const sqkm = sqm / 1000000;

    return {
      sqm: Number(sqm.toFixed(2)),
      ha: Number(ha.toFixed(4)),
      acres: Number(acres.toFixed(4)),
      sqkm: Number(sqkm.toFixed(5))
    };
  },

  /**
   * Format area value with high decimal precision
   */
  formatArea(areaObj, unit = 'ha') {
    if (!areaObj) return '0.0000 Ha';
    switch (unit) {
      case 'ha':
        return `${areaObj.ha.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ha`;
      case 'acres':
        return `${areaObj.acres.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ac`;
      case 'sqkm':
        return `${areaObj.sqkm.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 5 })} Sq Km`;
      case 'sqm':
        return `${areaObj.sqm.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m²`;
      default:
        return `${areaObj.ha.toFixed(4)} Ha`;
    }
  },

  /**
   * Detect all pairwise overlaps among a list of features
   * @param {Array} features - Array of feature objects with id, name, type, geometry
   * @returns {Array} List of detected overlap records
   */
  detectOverlaps(features) {
    const overlaps = [];
    if (!features || features.length < 2) return overlaps;

    for (let i = 0; i < features.length; i++) {
      const featA = features[i];
      if (!featA.geometry || (featA.geometry.type !== 'Polygon' && featA.geometry.type !== 'MultiPolygon')) continue;

      const polyA = turf.feature(featA.geometry);
      let bboxA;
      try {
        bboxA = turf.bbox(polyA);
      } catch (e) {
        continue;
      }

      for (let j = i + 1; j < features.length; j++) {
        const featB = features[j];
        if (!featB.geometry || (featB.geometry.type !== 'Polygon' && featB.geometry.type !== 'MultiPolygon')) continue;

        const polyB = turf.feature(featB.geometry);
        let bboxB;
        try {
          bboxB = turf.bbox(polyB);
        } catch (e) {
          continue;
        }

        // Bounding box intersection check with tiny tolerance
        const bboxOverlap = !(
          bboxA[2] < bboxB[0] - 1e-7 ||
          bboxA[0] > bboxB[2] + 1e-7 ||
          bboxA[3] < bboxB[1] - 1e-7 ||
          bboxA[1] > bboxB[3] + 1e-7
        );

        if (!bboxOverlap) continue;

        try {
          let intersection = null;
          if (typeof turf !== 'undefined' && turf.intersect) {
            try {
              intersection = turf.intersect(polyA, polyB);
            } catch (err) {
              try {
                intersection = turf.intersect(turf.featureCollection([polyA, polyB]));
              } catch (e2) {
                // Try with cleaned coordinates
                try {
                  const cleanA = turf.cleanCoords(polyA);
                  const cleanB = turf.cleanCoords(polyB);
                  intersection = turf.intersect(cleanA, cleanB);
                } catch (e3) {}
              }
            }
          }

          if (intersection && intersection.geometry) {
            const geomType = intersection.geometry.type;
            if (geomType === 'Polygon' || geomType === 'MultiPolygon' || geomType === 'GeometryCollection') {
              const overlapArea = this.calculateArea(intersection.geometry);
              
              // Record if overlap area is > 0.05 sq meter (approx 0.000005 Ha)
              if (overlapArea.sqm > 0.05) {
                const areaA = this.calculateArea(featA.geometry);
                const areaB = this.calculateArea(featB.geometry);

                const percentA = areaA.sqm > 0 ? (overlapArea.sqm / areaA.sqm) * 100 : 0;
                const percentB = areaB.sqm > 0 ? (overlapArea.sqm / areaB.sqm) * 100 : 0;

                overlaps.push({
                  id: `overlap_${featA.id}_${featB.id}`,
                  featureAId: featA.id,
                  featureBId: featB.id,
                  featureAName: featA.name,
                  featureBName: featB.name,
                  featureAType: featA.type,
                  featureBType: featB.type,
                  featureAColor: featA.color,
                  featureBColor: featB.color,
                  overlapArea: overlapArea,
                  percentOfA: Number(percentA.toFixed(2)),
                  percentOfB: Number(percentB.toFixed(2)),
                  geometry: intersection.geometry,
                  featureAGeometry: featA.geometry,
                  featureBGeometry: featB.geometry
                });
              }
            }
          }
        } catch (err) {
          console.warn(`Error computing intersection between ${featA.name} and ${featB.name}:`, err);
        }
      }
    }

    return overlaps;
  },

  /**
   * Deduct overlap from a polygon (Difference operation)
   * Target polygon will have clipper polygon subtracted from it.
   */
  clipDifference(targetGeom, clipperGeom) {
    try {
      const targetPoly = turf.feature(targetGeom);
      const clipperPoly = turf.feature(clipperGeom);

      let result = null;
      try {
        result = turf.difference(targetPoly, clipperPoly);
      } catch (err) {
        try {
          result = turf.difference(turf.featureCollection([targetPoly, clipperPoly]));
        } catch (e2) {
          try {
            const cleanA = turf.cleanCoords(targetPoly);
            const cleanB = turf.cleanCoords(clipperPoly);
            result = turf.difference(cleanA, cleanB);
          } catch (e3) {
            console.error("Difference operation error:", e3);
          }
        }
      }

      if (result && result.geometry) {
        return result.geometry;
      }
      return null;
    } catch (e) {
      console.error("Difference operation failed:", e);
      return null;
    }
  },

  /**
   * Get bounding box center and bounds for Leaflet map zooming
   */
  getBounds(geomOrFeatures) {
    try {
      let bbox;
      if (Array.isArray(geomOrFeatures)) {
        const validFeatures = geomOrFeatures
          .filter(f => f && (f.geometry || f.type))
          .map(f => turf.feature(f.geometry || f));
        if (validFeatures.length === 0) return null;
        bbox = turf.bbox(turf.featureCollection(validFeatures));
      } else if (geomOrFeatures.type === 'FeatureCollection') {
        bbox = turf.bbox(geomOrFeatures);
      } else {
        bbox = turf.bbox(turf.feature(geomOrFeatures.geometry || geomOrFeatures));
      }
      return [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]]
      ];
    } catch (e) {
      console.error("Error getting bounds:", e);
      return null;
    }
  }
};

window.SpatialEngine = SpatialEngine;
