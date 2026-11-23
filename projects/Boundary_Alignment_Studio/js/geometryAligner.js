/**
 * Geometry Aligner Module - Fast Topological Boundary Conformance Engine
 * Slices target polygon boundary between Point A & Point B and injects exact reference boundary coordinates.
 */

const GeometryAligner = {
    distanceMeters: function(p1, p2) {
        if (!p1 || !p2) return Infinity;
        return turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' });
    },

    _intersectionCache: new Map(),

    clearCache: function() {
        this._intersectionCache.clear();
    },

    getRingKey: function(ring) {
        if (!ring || ring.length === 0) return "0";
        return `${ring.length}_${ring[0][0].toFixed(5)}_${ring[0][1].toFixed(5)}_${ring[ring.length - 1][0].toFixed(5)}`;
    },

    lineSegmentsIntersect: function(p0, p1, p2, p3) {
        const s1_x = p1[0] - p0[0], s1_y = p1[1] - p0[1];
        const s2_x = p3[0] - p2[0], s2_y = p3[1] - p2[1];
        const denom = (-s2_x * s1_y + s1_x * s2_y);
        if (Math.abs(denom) < 1e-14) return null;
        const s = (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) / denom;
        const t = ( s2_x * (p0[1] - p2[1]) - s2_y * (p0[0] - p2[0])) / denom;
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            return [p0[0] + (t * s1_x), p0[1] + (t * s1_y)];
        }
        return null;
    },

    snapToRing: function(ring, clickPt, maxDistMeters = 1000) {
        if (!ring || ring.length < 2) return null;

        const cX = clickPt[0], cY = clickPt[1];
        const cosLat = Math.cos(cY * Math.PI / 180);
        
        // Fast bbox reject in degrees
        const tolDeg = (maxDistMeters / 111320) * 1.5;
        const bMinX = cX - tolDeg, bMaxX = cX + tolDeg;
        const bMinY = cY - tolDeg, bMaxY = cY + tolDeg;

        let bestDistSq = tolDeg * tolDeg;
        let bestProj = null;
        let bestIdx = -1;
        let bestT = 0;

        for (let i = 0; i < ring.length - 1; i++) {
            const p0 = ring[i], p1 = ring[i + 1];
            if (bMaxX < Math.min(p0[0], p1[0]) || bMinX > Math.max(p0[0], p1[0]) ||
                bMaxY < Math.min(p0[1], p1[1]) || bMinY > Math.max(p0[1], p1[1])) {
                continue;
            }

            const dx = p1[0] - p0[0];
            const dy = p1[1] - p0[1];
            const lenSq = dx * dx + dy * dy;
            let t = 0;
            if (lenSq > 0) {
                t = ((cX - p0[0]) * dx + (cY - p0[1]) * dy) / lenSq;
            }
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const px = p0[0] + t * dx;
            const py = p0[1] + t * dy;

            const ddx = (cX - px) * cosLat;
            const ddy = cY - py;
            const dSq = ddx * ddx + ddy * ddy;
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestProj = [px, py];
                bestIdx = i;
                bestT = t;
            }
        }

        if (bestIdx === -1) return null;

        const distMeters = Math.sqrt(bestDistSq) * 111320;
        return {
            point: bestProj,
            location: bestIdx + bestT,
            distMeters: distMeters,
            index: bestIdx,
            t: bestT
        };
    },

    getIntersections: function(ring1, ring2) {
        if (!ring1 || ring1.length < 3 || !ring2 || ring2.length < 3) return [];
        
        const key = this.getRingKey(ring1) + "__" + this.getRingKey(ring2);
        if (this._intersectionCache.has(key)) {
            return this._intersectionCache.get(key);
        }

        // 1. Overall BBox check
        let minX1 = Infinity, maxX1 = -Infinity, minY1 = Infinity, maxY1 = -Infinity;
        for (let i = 0; i < ring1.length; i++) {
            const x = ring1[i][0], y = ring1[i][1];
            if (x < minX1) minX1 = x; if (x > maxX1) maxX1 = x;
            if (y < minY1) minY1 = y; if (y > maxY1) maxY1 = y;
        }

        let minX2 = Infinity, maxX2 = -Infinity, minY2 = Infinity, maxY2 = -Infinity;
        for (let i = 0; i < ring2.length; i++) {
            const x = ring2[i][0], y = ring2[i][1];
            if (x < minX2) minX2 = x; if (x > maxX2) maxX2 = x;
            if (y < minY2) minY2 = y; if (y > maxY2) maxY2 = y;
        }

        const oMinX = Math.max(minX1, minX2), oMaxX = Math.min(maxX1, maxX2);
        const oMinY = Math.max(minY1, minY2), oMaxY = Math.min(maxY1, maxY2);

        if (oMinX > oMaxX || oMinY > oMaxY) {
            this._intersectionCache.set(key, []);
            return [];
        }

        const margin = 0.001;
        const boxMinX = oMinX - margin, boxMaxX = oMaxX + margin;
        const boxMinY = oMinY - margin, boxMaxY = oMaxY + margin;

        const segs1 = [];
        for (let i = 0; i < ring1.length - 1; i++) {
            const p0 = ring1[i], p1 = ring1[i + 1];
            const sMinX = Math.min(p0[0], p1[0]), sMaxX = Math.max(p0[0], p1[0]);
            const sMinY = Math.min(p0[1], p1[1]), sMaxY = Math.max(p0[1], p1[1]);
            if (sMaxX >= boxMinX && sMinX <= boxMaxX && sMaxY >= boxMinY && sMinY <= boxMaxY) {
                segs1.push({ p0, p1, sMinX, sMaxX, sMinY, sMaxY });
            }
        }

        const segs2 = [];
        for (let j = 0; j < ring2.length - 1; j++) {
            const q0 = ring2[j], q1 = ring2[j + 1];
            const sMinX = Math.min(q0[0], q1[0]), sMaxX = Math.max(q0[0], q1[0]);
            const sMinY = Math.min(q0[1], q1[1]), sMaxY = Math.max(q0[1], q1[1]);
            if (sMaxX >= boxMinX && sMinX <= boxMaxX && sMaxY >= boxMinY && sMinY <= boxMaxY) {
                segs2.push({ q0, q1, sMinX, sMaxX, sMinY, sMaxY });
            }
        }

        const intersections = [];
        for (let a = 0; a < segs1.length; a++) {
            const s1 = segs1[a];
            for (let b = 0; b < segs2.length; b++) {
                const s2 = segs2[b];
                if (s1.sMaxX < s2.sMinX || s1.sMinX > s2.sMaxX ||
                    s1.sMaxY < s2.sMinY || s1.sMinY > s2.sMaxY) {
                    continue;
                }
                const inter = this.lineSegmentsIntersect(s1.p0, s1.p1, s2.q0, s2.q1);
                if (inter) {
                    const exists = intersections.some(p => {
                        const dx = (p[0] - inter[0]) * 111320;
                        const dy = (p[1] - inter[1]) * 111320;
                        return (dx * dx + dy * dy) < 1.0;
                    });
                    if (!exists) intersections.push(inter);
                }
            }
        }

        this._intersectionCache.set(key, intersections);
        return intersections;
    },

    snapToRingWithIntersection: function(ring, clickPt, otherRing = null, intersectionToleranceMeters = 40) {
        return this.snapToAnyBoundary(ring, otherRing, clickPt, intersectionToleranceMeters);
    },

    snapToAnyBoundary: function(targetRing, refRing, clickPt, toleranceMeters = 50, cachedIntersections = null) {
        if (!clickPt) return null;

        // 1. Check exact intersections between Target and Reference (if clicked directly within 35m)
        let closestInter = null;
        let minInterDist = Infinity;
        const inters = cachedIntersections || ((targetRing && refRing) ? this.getIntersections(targetRing, refRing) : []);
        if (inters && inters.length > 0) {
            for (let i = 0; i < inters.length; i++) {
                const ipt = inters[i];
                const d = this.distanceMeters(clickPt, ipt);
                if (d <= 35 && d < minInterDist) {
                    minInterDist = d;
                    closestInter = ipt;
                }
            }
        }

        // 2. Check snap to Target boundary (Red) using fast snap
        let snapT = null;
        if (targetRing && targetRing.length >= 2) {
            snapT = this.snapToRing(targetRing, clickPt, toleranceMeters * 2);
        }

        const distT = snapT ? snapT.distMeters : Infinity;

        // If user clicked directly on or very close to an intersection (< 35m), prioritize intersection
        if (closestInter && minInterDist <= distT + 5) {
            return {
                point: closestInter,
                type: 'intersection',
                label: 'Intersection (Shared Point) ✕',
                distMeters: minInterDist,
                color: '#38bdf8',
                isIntersection: true
            };
        }

        // Strict Requirement: User can ONLY snap to Target boundary (Red) or an Intersection.
        // Snapping directly to Reference boundary (Green) alone is strictly blocked!
        if (distT <= toleranceMeters) {
            return {
                point: snapT.point,
                location: snapT.location,
                distMeters: distT,
                index: snapT.index,
                type: 'target',
                label: 'Target Line (Red)',
                color: '#ef4444',
                isIntersection: false
            };
        }

        return null;
    },

    avgDistBetweenPaths: function(pathT, pathR) {
        if (!pathT || pathT.length < 2 || !pathR || pathR.length < 2) return Infinity;
        let sum = 0;
        const step = Math.max(1, Math.floor(pathT.length / 20));
        let count = 0;
        for (let i = 0; i < pathT.length; i += step) {
            const snap = this.snapToRing(pathR, pathT[i], 100000);
            if (snap) {
                sum += snap.distMeters;
                count++;
            }
        }
        return count > 0 ? sum / count : Infinity;
    },

    findNearIntersection: function(pt, intersections, maxDist = 70) {
        if (!pt || !intersections || intersections.length === 0) return null;
        let best = null, minD = Infinity;
        for (let i = 0; i < intersections.length; i++) {
            const d = this.distanceMeters(pt, intersections[i]);
            if (d <= maxDist && d < minD) {
                minD = d;
                best = intersections[i];
            }
        }
        return best;
    },

    getExteriorRing: function(feature, nearPoint = null) {
        if (!feature || !feature.geometry) return null;
        const geom = feature.geometry;

        if (geom.type === 'Polygon') {
            return {
                ring: geom.coordinates[0],
                isMulti: false,
                partIndex: 0
            };
        } else if (geom.type === 'MultiPolygon') {
            if (!nearPoint) {
                let maxLen = 0;
                let bestIdx = 0;
                geom.coordinates.forEach((poly, idx) => {
                    if (poly[0] && poly[0].length > maxLen) {
                        maxLen = poly[0].length;
                        bestIdx = idx;
                    }
                });
                return {
                    ring: geom.coordinates[bestIdx][0],
                    isMulti: true,
                    partIndex: bestIdx
                };
            }

            let bestIdx = 0;
            let minD = Infinity;
            geom.coordinates.forEach((poly, idx) => {
                if (poly[0] && poly[0].length > 2) {
                    const snap = this.snapToRing(poly[0], nearPoint);
                    if (snap && snap.distMeters < minD) {
                        minD = snap.distMeters;
                        bestIdx = idx;
                    }
                }
            });
            return {
                ring: geom.coordinates[bestIdx][0],
                isMulti: true,
                partIndex: bestIdx
            };
        } else if (geom.type === 'LineString') {
            return {
                ring: geom.coordinates,
                isMulti: false,
                partIndex: 0
            };
        } else if (geom.type === 'MultiLineString') {
            if (!nearPoint) {
                let maxLen = 0;
                let bestIdx = 0;
                geom.coordinates.forEach((line, idx) => {
                    if (line && line.length > maxLen) {
                        maxLen = line.length;
                        bestIdx = idx;
                    }
                });
                return {
                    ring: geom.coordinates[bestIdx],
                    isMulti: true,
                    partIndex: bestIdx
                };
            }

            let bestIdx = 0;
            let minD = Infinity;
            geom.coordinates.forEach((line, idx) => {
                if (line && line.length > 1) {
                    const snap = this.snapToRing(line, nearPoint);
                    if (snap && snap.distMeters < minD) {
                        minD = snap.distMeters;
                        bestIdx = idx;
                    }
                }
            });
            return {
                ring: geom.coordinates[bestIdx],
                isMulti: true,
                partIndex: bestIdx
            };
        }
        return null;
    },

    extractRingPath: function(ring, snapA, snapB, preferNearPoint = null) {
        const line = turf.lineString(ring);
        const totalLen = turf.length(line);

        const locA = snapA.location;
        const locB = snapB.location;

        const minLoc = Math.min(locA, locB);
        const maxLoc = Math.max(locA, locB);

        // Path 1: Direct slice between minLoc and maxLoc
        let path1 = [];
        try {
            if (maxLoc - minLoc > 0.00001) {
                path1 = turf.lineSliceAlong(line, minLoc, maxLoc).geometry.coordinates;
            } else {
                path1 = [snapA.point, snapB.point];
            }
        } catch (e) {
            path1 = [snapA.point, snapB.point];
        }

        // Path 2: Wrap-around slice (maxLoc -> end + start -> minLoc)
        let path2 = [];
        try {
            const wrap1 = turf.lineSliceAlong(line, maxLoc, totalLen).geometry.coordinates;
            const wrap2 = turf.lineSliceAlong(line, 0, minLoc).geometry.coordinates;
            path2 = wrap1.concat(wrap2.slice(1));
        } catch (e) {
            path2 = path1;
        }

        const orient = (p) => {
            if (p.length < 2) return p;
            const dStartA = this.distanceMeters(p[0], snapA.point);
            const dEndA = this.distanceMeters(p[p.length - 1], snapA.point);
            if (dEndA < dStartA) return p.slice().reverse();
            return p.slice();
        };

        const oriented1 = orient(path1);
        const oriented2 = orient(path2);

        if (preferNearPoint) {
            const mid1 = oriented1[Math.floor(oriented1.length / 2)];
            const mid2 = oriented2[Math.floor(oriented2.length / 2)];
            const d1 = this.distanceMeters(mid1, preferNearPoint);
            const d2 = this.distanceMeters(mid2, preferNearPoint);
            return d1 <= d2 ? oriented1 : oriented2;
        }

        const len1 = turf.length(turf.lineString(oriented1));
        const len2 = turf.length(turf.lineString(oriented2));
        return len1 <= len2 ? oriented1 : oriented2;
    },

    findSegmentIndexAndParam: function(ring, pt) {
        if (!ring || ring.length < 2) return { index: 0, t: 0, proj: pt, distMeters: 0 };
        const cX = pt[0], cY = pt[1];
        const cosLat = Math.cos(cY * Math.PI / 180);

        let bestIdx = 0;
        let bestDistSq = Infinity;
        let bestT = 0;
        let bestProj = pt;

        for (let i = 0; i < ring.length - 1; i++) {
            const p0 = ring[i];
            const p1 = ring[i + 1];
            const dx = p1[0] - p0[0];
            const dy = p1[1] - p0[1];
            const segLenSq = dx * dx + dy * dy;
            let t = 0;
            if (segLenSq > 0) {
                t = ((cX - p0[0]) * dx + (cY - p0[1]) * dy) / segLenSq;
            }
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const proj = [p0[0] + t * dx, p0[1] + t * dy];

            const ddx = (cX - proj[0]) * cosLat;
            const ddy = cY - proj[1];
            const dSq = ddx * ddx + ddy * ddy;
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestIdx = i;
                bestT = t;
                bestProj = proj;
            }
        }

        const distMeters = Math.sqrt(bestDistSq) * 111320;
        return { index: bestIdx, t: bestT, proj: bestProj, distMeters: distMeters };
    },

    sliceRingExact: function(ring, ptA, ptB) {
        const sA = this.findSegmentIndexAndParam(ring, ptA);
        const sB = this.findSegmentIndexAndParam(ring, ptB);

        const paramA = sA.index + sA.t;
        const paramB = sB.index + sB.t;

        const minParam = Math.min(paramA, paramB);
        const maxParam = Math.max(paramA, paramB);
        const pStart = paramA <= paramB ? sA.proj : sB.proj;
        const pEnd = paramA <= paramB ? sB.proj : sA.proj;

        // Path 1: minParam -> maxParam
        const path1 = [pStart];
        const startIdx = Math.floor(minParam);
        const endIdx = Math.floor(maxParam);

        for (let i = startIdx + 1; i <= endIdx; i++) {
            path1.push(ring[i]);
        }
        path1.push(pEnd);

        // Path 2: maxParam -> end, then start -> minParam
        const path2 = [pEnd];
        for (let i = endIdx + 1; i < ring.length - 1; i++) {
            path2.push(ring[i]);
        }
        for (let i = 0; i <= startIdx; i++) {
            path2.push(ring[i]);
        }
        path2.push(pStart);

        return { path1, path2, sA, sB };
    },

    replaceBoundarySegment: function(targetFeature, refFeature, ptA, ptB) {
        if (!targetFeature || !refFeature || !ptA || !ptB) {
            throw new Error("Target feature, Reference feature, Point A, and Point B are required.");
        }

        const midClick = [(ptA[0] + ptB[0]) / 2, (ptA[1] + ptB[1]) / 2];
        const targetRingInfo = this.getExteriorRing(targetFeature, midClick);
        const refRingInfo = this.getExteriorRing(refFeature, midClick);

        if (!targetRingInfo || !refRingInfo) {
            throw new Error("Could not extract polygon exterior rings for alignment.");
        }

        const targetRing = targetRingInfo.ring;
        const refRing = refRingInfo.ring;
        const intersections = this.getIntersections(targetRing, refRing);

        // Strict User Rule: Never override user points to a random intersection!
        // Only lock if the user clicked directly on or very close to an intersection (< 35m)
        let cleanPtA = ptA.slice();
        let cleanPtB = ptB.slice();

        const interA = this.findNearIntersection(cleanPtA, intersections, 35);
        if (interA) cleanPtA = interA;

        const interB = this.findNearIntersection(cleanPtB, intersections, 35);
        if (interB) cleanPtB = interB;

        // 1. Slice Target ring using exact topological linear projection between Point A & Point B
        const tSlices = this.sliceRingExact(targetRing, cleanPtA, cleanPtB);

        // 2. Slice Reference ring between closest points to Point A & Point B (shortest path on Reference)
        const rSlices = this.sliceRingExact(refRing, cleanPtA, cleanPtB);
        const lenR1 = turf.length(turf.lineString(rSlices.path1));
        const lenR2 = turf.length(turf.lineString(rSlices.path2));
        const chosenRefPath = lenR1 <= lenR2 ? rSlices.path1 : rSlices.path2;

        // Determine which Target slice corresponds to the Reference corridor!
        const d1 = this.avgDistBetweenPaths(tSlices.path1, chosenRefPath);
        const d2 = this.avgDistBetweenPaths(tSlices.path2, chosenRefPath);

        let replacedSegment, keepSegment;
        if (Math.abs(d1 - d2) > 2) {
            // Pick the Target path that runs along the Reference corridor!
            replacedSegment = d1 <= d2 ? tSlices.path1 : tSlices.path2;
            keepSegment = d1 <= d2 ? tSlices.path2 : tSlices.path1;
        } else {
            // Tie-break: shorter slice
            const lenT1 = turf.length(turf.lineString(tSlices.path1));
            const lenT2 = turf.length(turf.lineString(tSlices.path2));
            replacedSegment = lenT1 <= lenT2 ? tSlices.path1 : tSlices.path2;
            keepSegment = lenT1 <= lenT2 ? tSlices.path2 : tSlices.path1;
        }

        const snapA_T = { point: tSlices.sA.proj, index: tSlices.sA.index, distMeters: tSlices.sA.distMeters };
        const snapB_T = { point: tSlices.sB.proj, index: tSlices.sB.index, distMeters: tSlices.sB.distMeters };
        const snapA_R = { point: rSlices.sA.proj, index: rSlices.sA.index, distMeters: rSlices.sA.distMeters };
        const snapB_R = { point: rSlices.sB.proj, index: rSlices.sB.index, distMeters: rSlices.sB.distMeters };

        // 3. Connect keepSegment with chosenRefPath in seamless continuous loop
        const keepStart = keepSegment[0];
        const keepEnd = keepSegment[keepSegment.length - 1];

        const dNormal = this.distanceMeters(keepEnd, chosenRefPath[0]) + this.distanceMeters(chosenRefPath[chosenRefPath.length - 1], keepStart);
        const dReversed = this.distanceMeters(keepEnd, chosenRefPath[chosenRefPath.length - 1]) + this.distanceMeters(chosenRefPath[0], keepStart);

        let alignedRef = chosenRefPath.slice();
        if (dReversed < dNormal) {
            alignedRef.reverse();
        }

        // Seamless stitch: Target kept segment connects to Reference path directly from A to B
        let newRing = keepSegment.concat(alignedRef);
        newRing = this.cleanDuplicates(newRing);

        // Ensure closed ring with exact coordinate matching
        const first = newRing[0];
        const last = newRing[newRing.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            if (this.distanceMeters(first, last) < 1.0) {
                newRing[newRing.length - 1] = [first[0], first[1]];
            } else {
                newRing.push([first[0], first[1]]);
            }
        }

        // Automatic Bowtie / Self-Intersection Elimination Guard
        try {
            if (newRing.length >= 4) {
                const polyTest = turf.polygon([newRing]);
                const kinks = turf.kinks(polyTest);
                if (kinks && kinks.features && kinks.features.length > 0) {
                    const unkinked = turf.unkinkPolygon(polyTest);
                    if (unkinked && unkinked.features && unkinked.features.length > 0) {
                        let maxArea = -1;
                        let bestRing = newRing;
                        unkinked.features.forEach(f => {
                            const a = turf.area(f);
                            if (a > maxArea && f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) {
                                maxArea = a;
                                bestRing = f.geometry.coordinates[0];
                            }
                        });
                        newRing = this.cleanDuplicates(bestRing);
                        if (this.distanceMeters(newRing[0], newRing[newRing.length - 1]) > 0.0001) {
                            newRing.push(newRing[0]);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Bowtie safety guard check:", e);
        }

        const updatedFeature = JSON.parse(JSON.stringify(targetFeature));
        if (targetRingInfo.isMulti) {
            updatedFeature.geometry.coordinates[targetRingInfo.partIndex][0] = newRing;
        } else {
            updatedFeature.geometry.coordinates[0] = newRing;
        }

        return {
            updatedFeature: updatedFeature,
            replacedSegment: replacedSegment,
            insertedSegment: alignedRef,
            snapA_T: snapA_T,
            snapB_T: snapB_T,
            snapA_R: snapA_R,
            snapB_R: snapB_R,
            verticesReplaced: replacedSegment.length,
            verticesInserted: alignedRef.length
        };
    },

    getAlignmentSegments: function(targetFeature, refFeature, ptA, ptB) {
        try {
            return this.replaceBoundarySegment(targetFeature, refFeature, ptA, ptB);
        } catch (e) {
            return null;
        }
    },

    autoSnapByTolerance: function(targetFeature, refFeature, toleranceMeters = 500) {
        if (!targetFeature || !refFeature) return null;

        const targetRingInfo = this.getExteriorRing(targetFeature);
        const refRingInfo = this.getExteriorRing(refFeature);
        if (!targetRingInfo || !refRingInfo) return null;

        const targetRing = targetRingInfo.ring;
        const refRing = refRingInfo.ring;
        const refLine = turf.lineString(refRing);

        const closeIndices = [];
        for (let i = 0; i < targetRing.length - 1; i++) {
            const pt = targetRing[i];
            const snap = turf.nearestPointOnLine(refLine, turf.point(pt));
            const d = (snap.properties.dist || 0) * 1000;
            if (d <= toleranceMeters) {
                closeIndices.push({ index: i, point: pt, dist: d });
            }
        }

        if (closeIndices.length < 2) return null;

        const groups = [];
        let currentGroup = [closeIndices[0]];

        for (let j = 1; j < closeIndices.length; j++) {
            if (closeIndices[j].index === closeIndices[j - 1].index + 1) {
                currentGroup.push(closeIndices[j]);
            } else {
                if (currentGroup.length >= 2) groups.push(currentGroup);
                currentGroup = [closeIndices[j]];
            }
        }
        if (currentGroup.length >= 2) groups.push(currentGroup);
        if (groups.length === 0) return null;

        groups.sort((a, b) => b.length - a.length);
        const bestGroup = groups[0];

        const ptA = bestGroup[0].point;
        const ptB = bestGroup[bestGroup.length - 1].point;

        return this.replaceBoundarySegment(targetFeature, refFeature, ptA, ptB);
    },

    cleanDuplicates: function(coords) {
        const out = [];
        for (let i = 0; i < coords.length; i++) {
            if (i === 0 || this.distanceMeters(coords[i], coords[i - 1]) > 0.0001) {
                out.push(coords[i]);
            }
        }
        return out;
    },

    insertVertexAtSegment: function(ring, clickPt) {
        if (!ring || ring.length < 2 || !clickPt) return null;
        const snap = this.findSegmentIndexAndParam(ring, clickPt);
        if (!snap || snap.index === -1) return null;

        const newRing = ring.slice();
        const insertIdx = snap.index + 1;
        newRing.splice(insertIdx, 0, snap.proj);
        return {
            ring: newRing,
            index: insertIdx,
            point: snap.proj
        };
    },

    deleteVertexAtIndex: function(ring, index) {
        if (!ring || ring.length <= 3) return ring;
        const isClosed = (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
        if (isClosed && ring.length <= 4) return ring;

        const newRing = ring.slice();
        if (isClosed && (index === 0 || index === ring.length - 1)) {
            newRing.shift();
            newRing.pop();
            newRing.push(newRing[0]);
        } else {
            newRing.splice(index, 1);
        }
        return newRing;
    },

    autoSnapGaps: function(targetRing, guideRing, toleranceMeters = 25) {
        if (!targetRing || !guideRing || targetRing.length < 2 || guideRing.length < 2) {
            return { ring: targetRing, snappedCount: 0 };
        }

        const isClosed = (targetRing[0][0] === targetRing[targetRing.length - 1][0] && targetRing[0][1] === targetRing[targetRing.length - 1][1]);
        const newRing = [];
        let snappedCount = 0;

        for (let i = 0; i < targetRing.length; i++) {
            if (isClosed && i === targetRing.length - 1) {
                newRing.push(newRing[0]);
                break;
            }

            const pt = targetRing[i];
            const snap = this.snapToRing(guideRing, pt, toleranceMeters * 2);

            if (snap && snap.distMeters <= toleranceMeters) {
                newRing.push(snap.point);
                snappedCount++;
            } else {
                newRing.push(pt);
            }
        }

        const cleaned = this.cleanDuplicates(newRing);
        if (isClosed && cleaned.length >= 3) {
            if (cleaned[0][0] !== cleaned[cleaned.length - 1][0] || cleaned[0][1] !== cleaned[cleaned.length - 1][1]) {
                cleaned.push(cleaned[0]);
            }
        }

        return {
            ring: cleaned,
            snappedCount: snappedCount
        };
    },

    updateFeatureExteriorRing: function(feature, newRing, partIndex = 0) {
        if (!feature || !feature.geometry) return feature;
        const featCopy = JSON.parse(JSON.stringify(feature));
        const geom = featCopy.geometry;

        if (geom.type === 'Polygon') {
            geom.coordinates[0] = newRing;
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates[partIndex][0] = newRing;
        } else if (geom.type === 'LineString') {
            geom.coordinates = newRing;
        } else if (geom.type === 'MultiLineString') {
            geom.coordinates[partIndex] = newRing;
        }

        return featCopy;
    }
};

if (typeof window !== "undefined") {
    window.GeometryAligner = GeometryAligner;
}