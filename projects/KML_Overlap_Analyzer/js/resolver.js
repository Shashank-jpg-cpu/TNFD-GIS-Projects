/**
 * Custom Vertex Editor for Interactive Boundary Reshaping
 * Renders draggable coordinate nodes and insertable midpoints on satellite map
 */
class VertexEditor {
  constructor(map, onGeometryChange) {
    this.map = map;
    this.onGeometryChange = onGeometryChange;
    this.featureA = null;
    this.featureB = null;
    this.targetMode = 'A'; // 'A' | 'B' | 'both'
    this.markerGroup = L.featureGroup().addTo(this.map);
    this.midpointGroup = L.featureGroup().addTo(this.map);
    this.isActive = false;
  }

  enable(featureA, featureB, targetMode = 'A') {
    this.isActive = true;
    this.featureA = featureA;
    this.featureB = featureB;
    this.targetMode = targetMode;
    this.render();
  }

  disable() {
    this.isActive = false;
    this.markerGroup.clearLayers();
    this.midpointGroup.clearLayers();
  }

  setTargetMode(targetMode) {
    this.targetMode = targetMode;
    this.render();
  }

  updateFeatures(featureA, featureB) {
    this.featureA = featureA;
    this.featureB = featureB;
    if (this.isActive) {
      this.render();
    }
  }

  render() {
    this.markerGroup.clearLayers();
    this.midpointGroup.clearLayers();
    if (!this.isActive) return;

    if (this.targetMode === 'A' || this.targetMode === 'both') {
      if (this.featureA && this.featureA.geometry) {
        this.renderFeatureVertices(this.featureA, 'A', '#06b6d4');
      }
    }

    if (this.targetMode === 'B' || this.targetMode === 'both') {
      if (this.featureB && this.featureB.geometry) {
        this.renderFeatureVertices(this.featureB, 'B', '#f59e0b');
      }
    }
  }

  renderFeatureVertices(feature, featKey, color) {
    const geom = feature.geometry;
    if (!geom) return;

    const processRing = (ringCoords, ringIdx) => {
      if (!Array.isArray(ringCoords) || ringCoords.length < 3) return;
      const len = ringCoords.length > 1 ? ringCoords.length - 1 : ringCoords.length;

      for (let i = 0; i < len; i++) {
        const pt = ringCoords[i];
        const latLng = L.latLng(pt[1], pt[0]);

        const icon = L.divIcon({
          className: 'custom-vertex-handle',
          html: `<div class="custom-vertex-handle-dot" style="border-color: ${color};" title="Node ${i + 1} (${feature.name}) - Drag to move, Shift+Click to delete"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const marker = L.marker(latLng, {
          draggable: true,
          icon: icon,
          zIndexOffset: 1000
        });

        marker.on('drag', (e) => {
          const newPos = e.target.getLatLng();
          ringCoords[i] = [newPos.lng, newPos.lat];

          // If first point, keep last point identical to maintain closed polygon ring
          if (i === 0) {
            ringCoords[ringCoords.length - 1] = [newPos.lng, newPos.lat];
          }

          feature.isCorrected = true;
          this.onGeometryChange(featKey, feature, false);
        });

        marker.on('dragend', () => {
          this.render(); // Re-center midpoints
          this.onGeometryChange(featKey, feature, true);
        });

        // Shift+Click / Alt+Click on point to delete node
        marker.on('click', (e) => {
          if (e.originalEvent && (e.originalEvent.shiftKey || e.originalEvent.altKey)) {
            if (ringCoords.length > 4) { // Maintain at least 3 distinct vertices + 1 closing
              ringCoords.splice(i, 1);
              if (i === 0) {
                ringCoords[ringCoords.length - 1] = ringCoords[0];
              }
              feature.isCorrected = true;
              this.render();
              this.onGeometryChange(featKey, feature, true);
            }
          }
        });

        this.markerGroup.addLayer(marker);

        // Add Midpoint handle on edge between vertex i and i+1
        const nextIdx = (i + 1) % len;
        const nextPt = ringCoords[nextIdx];
        const midLatLng = L.latLng((pt[1] + nextPt[1]) / 2, (pt[0] + nextPt[0]) / 2);

        const midIcon = L.divIcon({
          className: 'custom-midpoint-handle',
          html: `<div class="custom-midpoint-handle-dot" style="background-color: ${color};" title="Click to insert point on boundary line"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });

        const midMarker = L.marker(midLatLng, {
          icon: midIcon,
          zIndexOffset: 500
        });

        midMarker.on('click', () => {
          // Insert new coordinate at i + 1
          ringCoords.splice(i + 1, 0, [midLatLng.lng, midLatLng.lat]);
          feature.isCorrected = true;
          this.render();
          this.onGeometryChange(featKey, feature, true);
        });

        this.midpointGroup.addLayer(midMarker);
      }
    };

    if (geom.type === 'Polygon') {
      geom.coordinates.forEach((ring, rIdx) => processRing(ring, rIdx));
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach((poly) => {
        poly.forEach((ring, rIdx) => processRing(ring, rIdx));
      });
    }
  }
}

/**
 * Side-by-Side Overlap Resolver Controller
 * Synchronizes dual maps and provides geometric conflict resolution, manual vertex editing & rejection quarantine
 */
class OverlapResolver {
  constructor(app) {
    this.app = app;
    this.leftMap = null;
    this.rightMap = null;
    this.currentOverlap = null;
    this.resolvedFeatureA = null;
    this.resolvedFeatureB = null;
    this.remainingOverlapArea = 0;
    this.isManualEditActive = false;
    this.manualEditTarget = 'A'; // 'A' | 'B' | 'both'

    this.leftFeatureGroup = null;
    this.leftOverlapGroup = null;
    this.rightFeatureGroup = null;
    this.rightOverlapGroup = null;
    this.vertexEditor = null;

    this.initMaps();
    this.bindButtons();
  }

  initMaps() {
    const leftContainer = document.getElementById('resolver-left-map');
    const rightContainer = document.getElementById('resolver-right-map');
    if (!leftContainer || !rightContainer) return;

    // Left Map (Original & Overlap)
    this.leftMap = L.map('resolver-left-map', {
      center: [17.32, 78.36],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'ESRI Satellite'
    }).addTo(this.leftMap);

    this.leftFeatureGroup = L.featureGroup().addTo(this.leftMap);
    this.leftOverlapGroup = L.featureGroup().addTo(this.leftMap);

    // Right Map (Corrected Zero-Overlap Preview & Manual Vertex Editor)
    this.rightMap = L.map('resolver-right-map', {
      center: [17.32, 78.36],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'ESRI Satellite'
    }).addTo(this.rightMap);

    this.rightFeatureGroup = L.featureGroup().addTo(this.rightMap);
    this.rightOverlapGroup = L.featureGroup().addTo(this.rightMap);

    // Initialize custom vertex editor on Right Map
    this.vertexEditor = new VertexEditor(this.rightMap, (featKey, feature, isEnd) => {
      this.onVertexMoved(featKey, feature, isEnd);
    });

    // Synchronize map panning & zooming between Left and Right
    let isSyncingLeft = false;
    let isSyncingRight = false;

    this.leftMap.on('move', () => {
      if (!isSyncingLeft) {
        isSyncingRight = true;
        this.rightMap.setView(this.leftMap.getCenter(), this.leftMap.getZoom(), { animate: false });
        isSyncingRight = false;
      }
    });

    this.rightMap.on('move', () => {
      if (!isSyncingRight) {
        isSyncingLeft = true;
        this.leftMap.setView(this.rightMap.getCenter(), this.rightMap.getZoom(), { animate: false });
        isSyncingLeft = false;
      }
    });
  }

  bindButtons() {
    // Deduct A
    const btnDeductA = document.getElementById('btn-deduct-feata');
    if (btnDeductA) btnDeductA.addEventListener('click', () => this.deductFromFeatureA());

    // Deduct B
    const btnDeductB = document.getElementById('btn-deduct-featb');
    if (btnDeductB) btnDeductB.addEventListener('click', () => this.deductFromFeatureB());

    // Toggle Manual Vertex Drag
    const btnVertexEdit = document.getElementById('btn-toggle-vertex-edit');
    if (btnVertexEdit) btnVertexEdit.addEventListener('click', () => this.toggleVertexEdit());

    // Manual Drag Target Switchers
    const btnTargetA = document.getElementById('btn-edit-target-a');
    const btnTargetB = document.getElementById('btn-edit-target-b');
    const btnTargetBoth = document.getElementById('btn-edit-target-both');

    if (btnTargetA) btnTargetA.addEventListener('click', () => this.setManualEditTarget('A'));
    if (btnTargetB) btnTargetB.addEventListener('click', () => this.setManualEditTarget('B'));
    if (btnTargetBoth) btnTargetBoth.addEventListener('click', () => this.setManualEditTarget('both'));

    // Move to Rejected Folder
    const btnMoveRejected = document.getElementById('btn-move-to-rejected');
    if (btnMoveRejected) btnMoveRejected.addEventListener('click', () => this.moveToRejected());

    // Move to Rejected Modal Buttons
    const btnCloseRejectModal = document.getElementById('btn-close-move-rejected-modal');
    if (btnCloseRejectModal) btnCloseRejectModal.addEventListener('click', () => this.closeMoveToRejectedModal());

    const btnCancelRejectModal = document.getElementById('btn-cancel-move-rejected');
    if (btnCancelRejectModal) btnCancelRejectModal.addEventListener('click', () => this.closeMoveToRejectedModal());

    const btnConfirmRejectModal = document.getElementById('btn-confirm-move-rejected');
    if (btnConfirmRejectModal) btnConfirmRejectModal.addEventListener('click', () => this.confirmMoveToRejected());

    const rejectModal = document.getElementById('move-rejected-modal');
    if (rejectModal) {
      rejectModal.addEventListener('click', (e) => {
        if (e.target === rejectModal) this.closeMoveToRejectedModal();
      });
    }

    // Reset Pair
    const btnReset = document.getElementById('btn-reset-pair');
    if (btnReset) btnReset.addEventListener('click', () => this.resetPair());

    // Save & Apply
    const btnApply = document.getElementById('btn-apply-resolution');
    if (btnApply) btnApply.addEventListener('click', () => this.applyResolution());
  }

  /**
   * Toggle manual vertex editing mode
   */
  toggleVertexEdit() {
    this.isManualEditActive = !this.isManualEditActive;
    const btn = document.getElementById('btn-toggle-vertex-edit');
    const label = document.getElementById('btn-vertex-edit-label');
    const selectorBar = document.getElementById('manual-edit-selector-bar');
    const tip = document.getElementById('manual-drag-tip');

    if (this.isManualEditActive) {
      if (btn) {
        btn.classList.remove('bg-slate-800', 'text-cyan-300');
        btn.classList.add('bg-cyan-600', 'text-white', 'border-cyan-400');
      }
      if (label) label.innerText = "Exit Manual Edit";
      if (selectorBar) selectorBar.classList.remove('hidden');
      if (tip) tip.classList.remove('hidden');

      if (this.vertexEditor) {
        this.vertexEditor.enable(this.resolvedFeatureA, this.resolvedFeatureB, this.manualEditTarget);
      }
      this.app.showNotification("Manual Editing active: drag points on the right map to reshape boundaries", "info");
    } else {
      if (btn) {
        btn.classList.remove('bg-cyan-600', 'text-white', 'border-cyan-400');
        btn.classList.add('bg-slate-800', 'text-cyan-300');
      }
      if (label) label.innerText = "Manual Editing";
      if (selectorBar) selectorBar.classList.add('hidden');
      if (tip) tip.classList.add('hidden');

      if (this.vertexEditor) {
        this.vertexEditor.disable();
      }
    }
  }

  setManualEditTarget(target) {
    this.manualEditTarget = target;
    const btnA = document.getElementById('btn-edit-target-a');
    const btnB = document.getElementById('btn-edit-target-b');
    const btnBoth = document.getElementById('btn-edit-target-both');

    [btnA, btnB, btnBoth].forEach(b => {
      if (b) {
        b.classList.remove('bg-cyan-600', 'text-white');
        b.classList.add('bg-slate-800', 'text-slate-300');
      }
    });

    if (target === 'A' && btnA) {
      btnA.classList.remove('bg-slate-800', 'text-slate-300');
      btnA.classList.add('bg-cyan-600', 'text-white');
    } else if (target === 'B' && btnB) {
      btnB.classList.remove('bg-slate-800', 'text-slate-300');
      btnB.classList.add('bg-cyan-600', 'text-white');
    } else if (target === 'both' && btnBoth) {
      btnBoth.classList.remove('bg-slate-800', 'text-slate-300');
      btnBoth.classList.add('bg-cyan-600', 'text-white');
    }

    if (this.vertexEditor && this.isManualEditActive) {
      this.vertexEditor.setTargetMode(target);
    }
  }

  /**
   * Callback when a vertex is dragged or modified in manual mode
   */
  onVertexMoved(featKey, feature, isEnd = false) {
    // Recalculate area for the modified feature
    const newArea = SpatialEngine.calculateArea(feature.geometry);
    feature.areaHa = newArea.ha;
    feature.areaObj = newArea;
    feature.isCorrected = true;

    if (featKey === 'A') {
      this.resolvedFeatureA = feature;
    } else if (featKey === 'B') {
      this.resolvedFeatureB = feature;
    }

    // Re-render polygons on Right Map
    this.renderRightMapPolygonsOnly();
    this.updateUI();

    if (isEnd) {
      this.app.showNotification(`Updated boundary for ${feature.name}. New Area: ${feature.areaHa.toFixed(3)} Ha`, "info");
    }
  }

  renderRightMapPolygonsOnly() {
    if (!this.rightFeatureGroup || !this.resolvedFeatureA || !this.resolvedFeatureB) return;
    this.rightFeatureGroup.clearLayers();
    this.rightOverlapGroup.clearLayers();

    // Render A
    if (this.resolvedFeatureA.geometry) {
      const isSolid = this.resolvedFeatureA.fillStyle !== 'outline';
      L.geoJSON(this.resolvedFeatureA.geometry, {
        style: {
          color: this.resolvedFeatureA.color,
          weight: 3,
          fillColor: this.resolvedFeatureA.color,
          fillOpacity: isSolid ? 0.45 : 0
        }
      }).bindTooltip(`<strong>${this.resolvedFeatureA.name}</strong><br/>Area: ${this.resolvedFeatureA.areaHa.toFixed(2)} Ha`, { sticky: true })
        .addTo(this.rightFeatureGroup);
    }

    // Render B
    if (this.resolvedFeatureB.geometry) {
      const isSolid = this.resolvedFeatureB.fillStyle !== 'outline';
      L.geoJSON(this.resolvedFeatureB.geometry, {
        style: {
          color: this.resolvedFeatureB.color,
          weight: 3,
          fillColor: this.resolvedFeatureB.color,
          fillOpacity: isSolid ? 0.45 : 0,
          dashArray: this.resolvedFeatureB.type === 'RL' ? '5,5' : null
        }
      }).bindTooltip(`<strong>${this.resolvedFeatureB.name}</strong><br/>Area: ${this.resolvedFeatureB.areaHa.toFixed(2)} Ha`, { sticky: true })
        .addTo(this.rightFeatureGroup);
    }

    // Check overlap remaining between resolved A and resolved B
    const testOverlaps = SpatialEngine.detectOverlaps([this.resolvedFeatureA, this.resolvedFeatureB]);
    if (testOverlaps.length > 0) {
      this.remainingOverlapArea = testOverlaps[0].overlapArea.ha;
      L.geoJSON(testOverlaps[0].geometry, {
        style: { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.6 }
      }).addTo(this.rightOverlapGroup);
    } else {
      this.remainingOverlapArea = 0;
    }
  }

  /**
   * Action: Open the Move to Rejected selection modal
   */
  moveToRejected() {
    this.openMoveToRejectedModal();
  }

  openMoveToRejectedModal() {
    if (!this.currentOverlap || !this.resolvedFeatureA || !this.resolvedFeatureB) return;

    const modal = document.getElementById('move-rejected-modal');
    if (!modal) return;

    const featA = this.resolvedFeatureA;
    const featB = this.resolvedFeatureB;

    // Set Feature A details
    const swatchA = document.getElementById('reject-modal-swatch-a');
    if (swatchA) swatchA.style.backgroundColor = featA.color || '#22c55e';
    const nameA = document.getElementById('reject-modal-name-a');
    if (nameA) {
      nameA.innerHTML = `<span class="px-1 py-0.2 rounded text-[9px] font-bold ${featA.type === 'RF' ? 'badge-rf' : 'badge-rl'} mr-1">${featA.type}</span>${featA.name}`;
    }
    const areaA = document.getElementById('reject-modal-area-a');
    if (areaA) areaA.innerText = `${featA.areaHa ? featA.areaHa.toFixed(3) : '0.000'} Ha`;

    // Set Feature B details
    const swatchB = document.getElementById('reject-modal-swatch-b');
    if (swatchB) swatchB.style.backgroundColor = featB.color || '#f59e0b';
    const nameB = document.getElementById('reject-modal-name-b');
    if (nameB) {
      nameB.innerHTML = `<span class="px-1 py-0.2 rounded text-[9px] font-bold ${featB.type === 'RF' ? 'badge-rf' : 'badge-rl'} mr-1">${featB.type}</span>${featB.name}`;
    }
    const areaB = document.getElementById('reject-modal-area-b');
    if (areaB) areaB.innerText = `${featB.areaHa ? featB.areaHa.toFixed(3) : '0.000'} Ha`;

    // Set Overlap area
    const overlapAreaEl = document.getElementById('reject-modal-overlap-area');
    if (overlapAreaEl) overlapAreaEl.innerText = `${this.currentOverlap.overlapArea.ha.toFixed(3)} Ha`;

    // Set Choice A labels
    const labelA = document.getElementById('reject-label-choice-a');
    if (labelA) {
      labelA.innerHTML = `<i class="fa-solid fa-folder-minus text-emerald-400"></i><span>Move <strong>${featA.name}</strong> Only to Rejected</span>`;
    }
    const descA = document.getElementById('reject-desc-choice-a');
    if (descA) {
      descA.innerHTML = `Isolate <strong>${featA.name}</strong> to Rejected Folder. Keep <strong>${featB.name}</strong> in Clean Boundaries.`;
    }

    // Set Choice B labels
    const labelB = document.getElementById('reject-label-choice-b');
    if (labelB) {
      labelB.innerHTML = `<i class="fa-solid fa-folder-minus text-amber-400"></i><span>Move <strong>${featB.name}</strong> Only to Rejected</span>`;
    }
    const descB = document.getElementById('reject-desc-choice-b');
    if (descB) {
      descB.innerHTML = `Isolate <strong>${featB.name}</strong> to Rejected Folder. Keep <strong>${featA.name}</strong> in Clean Boundaries.`;
    }

    // Set Choice Both labels
    const descBoth = document.getElementById('reject-desc-choice-both');
    if (descBoth) {
      descBoth.innerHTML = `Isolate both <strong>${featA.name}</strong> and <strong>${featB.name}</strong> into the Rejected Folder.`;
    }

    // Reset radio selection to 'A' by default
    const firstRadio = modal.querySelector('input[name="reject-target-choice"][value="A"]');
    if (firstRadio) firstRadio.checked = true;

    modal.classList.remove('hidden');
  }

  closeMoveToRejectedModal() {
    const modal = document.getElementById('move-rejected-modal');
    if (modal) modal.classList.add('hidden');
  }

  /**
   * Action: Confirm moving chosen feature(s) to Rejected Folder
   */
  confirmMoveToRejected() {
    if (!this.currentOverlap || !this.resolvedFeatureA || !this.resolvedFeatureB) return;

    const selectedChoice = document.querySelector('input[name="reject-target-choice"]:checked')?.value || 'A';
    const overlapId = this.currentOverlap.id;
    if (!this.app.rejectedOverlaps) this.app.rejectedOverlaps = [];

    // Remove any existing entry for this overlap id
    this.app.rejectedOverlaps = this.app.rejectedOverlaps.filter(ro => ro.id !== overlapId);

    const featA = this.resolvedFeatureA;
    const featB = this.resolvedFeatureB;

    let notificationMsg = '';

    if (selectedChoice === 'A') {
      this.app.rejectedOverlaps.push({
        id: overlapId,
        featureAId: featA.id,
        featureBId: featB.id,
        featureAName: featA.name,
        featureBName: featB.name,
        featureAType: featA.type,
        featureBType: featB.type,
        areaHaA: featA.areaHa,
        areaHaB: featB.areaHa,
        overlapAreaHa: this.currentOverlap.overlapArea.ha,
        rejectedTarget: 'A',
        rejectedFeatureIds: [featA.id],
        rejectedFeatureNames: [featA.name],
        keptFeatureIds: [featB.id],
        keptFeatureNames: [featB.name],
        timestamp: new Date().toISOString()
      });
      notificationMsg = `Moved "${featA.name}" to Rejected Folder (kept "${featB.name}" in Clean Boundaries)`;
    } else if (selectedChoice === 'B') {
      this.app.rejectedOverlaps.push({
        id: overlapId,
        featureAId: featA.id,
        featureBId: featB.id,
        featureAName: featA.name,
        featureBName: featB.name,
        featureAType: featA.type,
        featureBType: featB.type,
        areaHaA: featA.areaHa,
        areaHaB: featB.areaHa,
        overlapAreaHa: this.currentOverlap.overlapArea.ha,
        rejectedTarget: 'B',
        rejectedFeatureIds: [featB.id],
        rejectedFeatureNames: [featB.name],
        keptFeatureIds: [featA.id],
        keptFeatureNames: [featA.name],
        timestamp: new Date().toISOString()
      });
      notificationMsg = `Moved "${featB.name}" to Rejected Folder (kept "${featA.name}" in Clean Boundaries)`;
    } else {
      // 'both'
      this.app.rejectedOverlaps.push({
        id: overlapId,
        featureAId: featA.id,
        featureBId: featB.id,
        featureAName: featA.name,
        featureBName: featB.name,
        featureAType: featA.type,
        featureBType: featB.type,
        areaHaA: featA.areaHa,
        areaHaB: featB.areaHa,
        overlapAreaHa: this.currentOverlap.overlapArea.ha,
        rejectedTarget: 'both',
        rejectedFeatureIds: [featA.id, featB.id],
        rejectedFeatureNames: [featA.name, featB.name],
        keptFeatureIds: [],
        keptFeatureNames: [],
        timestamp: new Date().toISOString()
      });
      notificationMsg = `Moved both "${featA.name}" and "${featB.name}" to Rejected Folder`;
    }

    this.closeMoveToRejectedModal();
    this.app.showNotification(notificationMsg, "info");

    // Refresh app state
    this.app.onStateChanged();

    // Advance to next active unrejected overlap
    const nextOverlap = this.app.overlaps.find(ov => !this.app.rejectedOverlaps.some(ro => ro.id === ov.id));
    if (nextOverlap) {
      this.loadOverlap(nextOverlap);
    } else {
      this.loadOverlap(null);
    }
  }

  /**
   * Load an overlap pair for side-by-side resolution
   * @param {Object} overlapRecord
   */
  loadOverlap(overlapRecord) {
    if (!overlapRecord) {
      this.currentOverlap = null;
      this.resolvedFeatureA = null;
      this.resolvedFeatureB = null;
      if (this.leftFeatureGroup) this.leftFeatureGroup.clearLayers();
      if (this.leftOverlapGroup) this.leftOverlapGroup.clearLayers();
      if (this.rightFeatureGroup) this.rightFeatureGroup.clearLayers();
      if (this.rightOverlapGroup) this.rightOverlapGroup.clearLayers();
      if (this.vertexEditor) this.vertexEditor.disable();
      this.updateUI();
      return;
    }

    this.currentOverlap = overlapRecord;
    
    // Fetch latest live features from app state (ensures chained modifications are preserved!)
    const featA = this.app.features.find(f => f.id === overlapRecord.featureAId);
    const featB = this.app.features.find(f => f.id === overlapRecord.featureBId);

    if (!featA || !featB) {
      return;
    }

    // Clone features for working draft
    this.resolvedFeatureA = JSON.parse(JSON.stringify(featA));
    this.resolvedFeatureB = JSON.parse(JSON.stringify(featB));

    this.renderLeftMap();
    this.renderRightMap();
    this.updateUI();

    // Update vertex editor if currently active
    if (this.vertexEditor && this.isManualEditActive) {
      this.vertexEditor.enable(this.resolvedFeatureA, this.resolvedFeatureB, this.manualEditTarget);
    }

    // Fit both maps to bounds
    const bounds = SpatialEngine.getBounds([featA, featB]);
    if (bounds) {
      this.leftMap.fitBounds(bounds, { padding: [30, 30] });
      this.rightMap.fitBounds(bounds, { padding: [30, 30] });
    }

    // Invalidate sizes after tab switch
    setTimeout(() => {
      this.leftMap.invalidateSize();
      this.rightMap.invalidateSize();
    }, 200);
  }

  /**
   * Render original features and overlap highlight on Left Map
   */
  renderLeftMap() {
    if (!this.leftFeatureGroup || !this.currentOverlap) return;
    this.leftFeatureGroup.clearLayers();
    this.leftOverlapGroup.clearLayers();

    const featA = this.app.features.find(f => f.id === this.currentOverlap.featureAId);
    const featB = this.app.features.find(f => f.id === this.currentOverlap.featureBId);

    if (!featA || !featB) return;

    // Feature A
    const layerA = L.geoJSON(featA.geometry, {
      style: {
        color: featA.color,
        weight: 3,
        fillColor: featA.color,
        fillOpacity: featA.fillStyle === 'outline' ? 0 : 0.4
      }
    }).bindTooltip(`<strong>${featA.name}</strong><br/>Area: ${featA.areaHa.toFixed(2)} Ha`, { sticky: true });
    this.leftFeatureGroup.addLayer(layerA);

    // Feature B
    const layerB = L.geoJSON(featB.geometry, {
      style: {
        color: featB.color,
        weight: 3,
        fillColor: featB.color,
        fillOpacity: featB.fillStyle === 'outline' ? 0 : 0.4,
        dashArray: featB.type === 'RL' ? '5,5' : null
      }
    }).bindTooltip(`<strong>${featB.name}</strong><br/>Area: ${featB.areaHa.toFixed(2)} Ha`, { sticky: true });
    this.leftFeatureGroup.addLayer(layerB);

    // Overlap layer
    const overlapLayer = L.geoJSON(this.currentOverlap.geometry, {
      style: {
        color: '#ef4444',
        weight: 2,
        fillColor: '#dc2626',
        fillOpacity: 0.8,
        dashArray: '3,3'
      }
    }).bindTooltip(`⚠️ <strong>OVERLAP ZONE</strong><br/>${this.currentOverlap.overlapArea.ha.toFixed(3)} Ha`, { sticky: true });
    this.leftOverlapGroup.addLayer(overlapLayer);
  }

  /**
   * Render corrected preview on Right Map
   */
  renderRightMap() {
    this.renderRightMapPolygonsOnly();

    // Update vertex editor if enabled
    if (this.vertexEditor && this.isManualEditActive) {
      this.vertexEditor.updateFeatures(this.resolvedFeatureA, this.resolvedFeatureB);
    }
  }

  /**
   * Action: Deduct Overlap from Feature A (Feature B takes precedence)
   */
  deductFromFeatureA() {
    if (!this.resolvedFeatureA || !this.resolvedFeatureB) return;
    
    // Feature A = Feature A - Feature B
    const newGeomA = SpatialEngine.clipDifference(this.resolvedFeatureA.geometry, this.resolvedFeatureB.geometry);
    
    if (newGeomA) {
      this.resolvedFeatureA.geometry = newGeomA;
      this.resolvedFeatureA.isCorrected = true;
      const newArea = SpatialEngine.calculateArea(this.resolvedFeatureA);
      this.resolvedFeatureA.areaHa = newArea.ha;
      this.resolvedFeatureA.areaObj = newArea;

      this.renderRightMap();
      this.updateUI();
      this.app.showNotification(`Deducted overlap from ${this.resolvedFeatureA.name}. Pair remaining overlap: ${this.remainingOverlapArea.toFixed(3)} Ha`, "success");
    } else {
      this.app.showNotification("Could not perform geometry difference for Feature A", "error");
    }
  }

  /**
   * Action: Deduct Overlap from Feature B (Feature A takes precedence)
   */
  deductFromFeatureB() {
    if (!this.resolvedFeatureA || !this.resolvedFeatureB) return;

    // Feature B = Feature B - Feature A
    const newGeomB = SpatialEngine.clipDifference(this.resolvedFeatureB.geometry, this.resolvedFeatureA.geometry);

    if (newGeomB) {
      this.resolvedFeatureB.geometry = newGeomB;
      this.resolvedFeatureB.isCorrected = true;
      const newArea = SpatialEngine.calculateArea(this.resolvedFeatureB);
      this.resolvedFeatureB.areaHa = newArea.ha;
      this.resolvedFeatureB.areaObj = newArea;

      this.renderRightMap();
      this.updateUI();
      this.app.showNotification(`Deducted overlap from ${this.resolvedFeatureB.name}. Pair remaining overlap: ${this.remainingOverlapArea.toFixed(3)} Ha`, "success");
    } else {
      this.app.showNotification("Could not perform geometry difference for Feature B", "error");
    }
  }

  /**
   * Reset changes for current pair
   */
  resetPair() {
    if (!this.currentOverlap) return;
    const featA = this.app.features.find(f => f.id === this.currentOverlap.featureAId);
    const featB = this.app.features.find(f => f.id === this.currentOverlap.featureBId);
    if (featA && featB) {
      this.resolvedFeatureA = JSON.parse(JSON.stringify(featA));
      this.resolvedFeatureB = JSON.parse(JSON.stringify(featB));
      this.renderRightMap();
      this.updateUI();
      this.app.showNotification("Reset pair edits to current saved boundaries", "info");
    }
  }

  /**
   * Apply resolution permanently to global application state and chain to next overlap
   */
  applyResolution() {
    if (!this.resolvedFeatureA || !this.resolvedFeatureB) return;

    // Update global state with the newly clipped geometry
    const idxA = this.app.features.findIndex(f => f.id === this.resolvedFeatureA.id);
    if (idxA !== -1) {
      this.app.features[idxA] = JSON.parse(JSON.stringify(this.resolvedFeatureA));
    }

    const idxB = this.app.features.findIndex(f => f.id === this.resolvedFeatureB.id);
    if (idxB !== -1) {
      this.app.features[idxB] = JSON.parse(JSON.stringify(this.resolvedFeatureB));
    }

    // Trigger full app recalculation (recalculates all overlaps with updated geometries)
    this.app.onStateChanged();

    // Check how many active unrejected overlaps remain across the division
    const remainingOverlaps = this.app.overlaps.filter(ov => !this.app.rejectedOverlaps || !this.app.rejectedOverlaps.some(ro => ro.id === ov.id));
    const remainingCount = remainingOverlaps.length;

    if (remainingCount > 0) {
      this.app.showNotification(`Applied correction! ${remainingCount} overlap(s) remaining in division.`, "success");
      // Automatically load the next remaining overlap
      this.loadOverlap(remainingOverlaps[0]);
    } else {
      this.app.showNotification("🎉 All active overlaps in division have been 100% resolved!", "success");
      this.loadOverlap(null);
    }
  }

  /**
   * Update side panel texts, badges, and status
   */
  updateUI() {
    const pairTitleEl = document.getElementById('resolver-pair-title');
    const featANameEl = document.getElementById('resolver-feata-name');
    const featBNameEl = document.getElementById('resolver-featb-name');
    const featAAreaEl = document.getElementById('resolver-feata-area');
    const featBAreaEl = document.getElementById('resolver-featb-area');
    const overlapAreaEl = document.getElementById('resolver-overlap-area');
    const remainingBadgeEl = document.getElementById('resolver-remaining-badge');
    const btnDeductA = document.getElementById('btn-deduct-feata');
    const btnDeductB = document.getElementById('btn-deduct-featb');
    const btnApply = document.getElementById('btn-apply-resolution');
    const btnMoveRejected = document.getElementById('btn-move-to-rejected');
    const btnVertexEdit = document.getElementById('btn-toggle-vertex-edit');

    if (!this.currentOverlap || !this.resolvedFeatureA || !this.resolvedFeatureB) {
      if (pairTitleEl) {
        if (this.app.overlaps.length === 0 && this.app.features.length > 0) {
          pairTitleEl.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle-check mr-1.5"></i> All Overlaps in Division Successfully Resolved (0.000 Ha Remaining)!</span>`;
        } else {
          pairTitleEl.innerText = "No Overlap Selected";
        }
      }
      if (btnDeductA) btnDeductA.disabled = true;
      if (btnDeductB) btnDeductB.disabled = true;
      if (btnApply) btnApply.disabled = true;
      if (btnMoveRejected) btnMoveRejected.disabled = true;
      if (btnVertexEdit) btnVertexEdit.disabled = true;
      if (overlapAreaEl) overlapAreaEl.innerText = "0.000 Ha";
      if (remainingBadgeEl) {
        remainingBadgeEl.className = "px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center";
        remainingBadgeEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> 0.000 Ha (Clean Zero Overlap)`;
      }
      return;
    }

    if (btnDeductA) btnDeductA.disabled = false;
    if (btnDeductB) btnDeductB.disabled = false;
    if (btnApply) btnApply.disabled = false;
    if (btnMoveRejected) btnMoveRejected.disabled = false;
    if (btnVertexEdit) btnVertexEdit.disabled = false;

    const remainingOverlaps = this.app.overlaps.filter(ov => !this.app.rejectedOverlaps || !this.app.rejectedOverlaps.some(ro => ro.id === ov.id));
    const totalRemainingDivOverlaps = remainingOverlaps.length;

    if (pairTitleEl) {
      pairTitleEl.innerHTML = `<span>${this.resolvedFeatureA.name}</span> <span class="text-rose-400 mx-1">⚔️</span> <span>${this.resolvedFeatureB.name}</span> <span class="text-xs text-slate-400 ml-2 font-normal">(${totalRemainingDivOverlaps} conflict pair${totalRemainingDivOverlaps > 1 ? 's' : ''} left in division)</span>`;
    }
    if (featANameEl) featANameEl.innerText = this.resolvedFeatureA.name;
    if (featBNameEl) featBNameEl.innerText = this.resolvedFeatureB.name;

    if (btnDeductA) btnDeductA.innerHTML = `<i class="fa-solid fa-scissors mr-1.5"></i> Deduct from: <strong>${this.resolvedFeatureA.name}</strong>`;
    if (btnDeductB) btnDeductB.innerHTML = `<i class="fa-solid fa-scissors mr-1.5"></i> Deduct from: <strong>${this.resolvedFeatureB.name}</strong>`;

    if (featAAreaEl) {
      const origA = this.resolvedFeatureA.originalAreaHa || this.resolvedFeatureA.areaHa;
      const diffA = (this.resolvedFeatureA.areaHa - origA).toFixed(3);
      const diffStr = diffA < 0 ? `<span class="text-rose-400 font-normal">(${diffA} Ha)</span>` : '';
      featAAreaEl.innerHTML = `${this.resolvedFeatureA.areaHa.toFixed(3)} Ha ${diffStr}`;
    }

    if (featBAreaEl) {
      const origB = this.resolvedFeatureB.originalAreaHa || this.resolvedFeatureB.areaHa;
      const diffB = (this.resolvedFeatureB.areaHa - origB).toFixed(3);
      const diffStr = diffB < 0 ? `<span class="text-rose-400 font-normal">(${diffB} Ha)</span>` : '';
      featBAreaEl.innerHTML = `${this.resolvedFeatureB.areaHa.toFixed(3)} Ha ${diffStr}`;
    }

    if (overlapAreaEl) {
      overlapAreaEl.innerText = `${this.currentOverlap.overlapArea.ha.toFixed(3)} Ha (${(this.currentOverlap.overlapArea.acres).toFixed(3)} Ac)`;
    }

    if (remainingBadgeEl) {
      if (this.remainingOverlapArea === 0) {
        remainingBadgeEl.className = "px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center shadow";
        remainingBadgeEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> This Pair Overlap Cleared (0.000 Ha)`;
      } else {
        remainingBadgeEl.className = "px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-xs font-bold flex items-center";
        remainingBadgeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${this.remainingOverlapArea.toFixed(3)} Ha Overlap Remaining in Pair`;
      }
    }
  }
}

window.OverlapResolver = OverlapResolver;
