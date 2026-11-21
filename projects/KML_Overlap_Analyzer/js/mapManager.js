/**
 * Map Manager for Leaflet instances, Satellite tile layers, and dynamic GeoJSON rendering
 */

class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = Object.assign({
      center: [17.32, 78.36],
      zoom: 12,
      attributionControl: false
    }, options);

    this.map = null;
    this.tileLayers = {};
    this.currentTileLayer = null;
    this.featureLayerGroup = null;
    this.overlapLayerGroup = null;
    this.labelLayerGroup = null;
    this.polygonLayersMap = new Map(); // featureId -> L.GeoJSON / L.Polygon

    this.init();
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.map = L.map(this.containerId, {
      center: this.options.center,
      zoom: this.options.zoom,
      zoomControl: true
    });

    // Base Tile Layers
    this.tileLayers = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'ESRI World Imagery'
      }),
      satelliteClarity: L.tileLayer('https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'ESRI Clarity Satellite'
      }),
      googleHybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: 'Google Hybrid'
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }),
      cartoDark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: 'CartoDB Dark'
      })
    };

    // Default to Satellite
    this.tileLayers.satellite.addTo(this.map);
    this.currentTileLayer = this.tileLayers.satellite;

    // Feature Layer Groups
    this.featureLayerGroup = L.featureGroup().addTo(this.map);
    this.overlapLayerGroup = L.featureGroup().addTo(this.map);
    this.labelLayerGroup = L.featureGroup().addTo(this.map);

    // Scale control
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(this.map);
  }

  setBaseLayer(layerName) {
    if (!this.tileLayers[layerName] || !this.map) return;
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }
    this.currentTileLayer = this.tileLayers[layerName];
    this.map.addLayer(this.currentTileLayer);
  }

  /**
   * Render all RF and RL boundary features on the map
   */
  renderFeatures(features, onFeatureClick = null) {
    if (!this.featureLayerGroup) return;
    this.featureLayerGroup.clearLayers();
    this.labelLayerGroup.clearLayers();
    this.polygonLayersMap.clear();

    if (!features || features.length === 0) return;

    features.forEach(feat => {
      if (!feat.geometry) return;
      if (feat.visible === false) return;

      const isSolid = feat.fillStyle !== 'outline';
      const fillOpacity = isSolid ? (feat.fillOpacity !== undefined ? feat.fillOpacity : 0.45) : 0.0;

      const style = {
        color: feat.color || '#22c55e',
        weight: feat.strokeWidth || 2.5,
        opacity: 0.95,
        fillColor: feat.color || '#22c55e',
        fillOpacity: fillOpacity,
        dashArray: feat.type === 'RL' ? '5, 5' : null
      };

      const geoJsonLayer = L.geoJSON(feat.geometry, {
        style: style,
        onEachFeature: (f, layer) => {
          // Tooltip on hover
          const areaFormatted = feat.areaHa !== undefined ? `${feat.areaHa.toFixed(2)} Ha` : '';
          const tooltipContent = `
            <div class="font-sans text-xs">
              <span class="font-bold text-white px-1.5 py-0.5 rounded ${feat.type === 'RF' ? 'bg-emerald-600' : 'bg-amber-600'}">${feat.type}</span>
              <strong class="ml-1 text-slate-100">${feat.name}</strong>
              ${areaFormatted ? `<div class="mt-1 text-slate-300">Area: <span class="font-semibold text-white">${areaFormatted}</span></div>` : ''}
            </div>
          `;
          layer.bindTooltip(tooltipContent, {
            sticky: true,
            className: 'custom-map-tooltip',
            direction: 'top'
          });

          // Popup on click
          const popupContent = `
            <div class="p-2 font-sans">
              <div class="flex items-center space-x-2">
                <span class="px-2 py-0.5 text-xs font-bold rounded text-white ${feat.type === 'RF' ? 'bg-emerald-600' : 'bg-amber-600'}">${feat.type}</span>
                <h4 class="font-bold text-sm text-slate-800">${feat.name}</h4>
              </div>
              <div class="mt-2 text-xs space-y-1 text-slate-600">
                <div><strong>Calculated Area:</strong> <span class="text-emerald-700 font-semibold">${feat.areaHa ? feat.areaHa.toFixed(3) : 0} Ha</span> (${(feat.areaHa * 2.471).toFixed(2)} Ac)</div>
                ${feat.sourceFile ? `<div><strong>Source:</strong> ${feat.sourceFile}</div>` : ''}
                <div><strong>Status:</strong> ${feat.isCorrected ? '<span class="text-green-600 font-bold">✓ Overlap Resolved</span>' : '<span class="text-slate-500">Original</span>'}</div>
              </div>
            </div>
          `;
          layer.bindPopup(popupContent);

          // Interaction
          layer.on({
            mouseover: (e) => {
              const l = e.target;
              l.setStyle({ weight: (feat.strokeWidth || 2.5) + 2, opacity: 1 });
            },
            mouseout: (e) => {
              const l = e.target;
              l.setStyle(style);
            },
            click: () => {
              if (onFeatureClick) onFeatureClick(feat);
            }
          });
        }
      });

      this.featureLayerGroup.addLayer(geoJsonLayer);
      this.polygonLayersMap.set(feat.id, geoJsonLayer);
    });
  }

  /**
   * Render overlap warning zones
   */
  renderOverlaps(overlaps, onOverlapClick = null) {
    if (!this.overlapLayerGroup) return;
    this.overlapLayerGroup.clearLayers();

    if (!overlaps || overlaps.length === 0) return;

    overlaps.forEach((ov, index) => {
      const overlapStyle = {
        color: '#ef4444', // Warning Red
        weight: 3,
        opacity: 1,
        fillColor: '#dc2626',
        fillOpacity: 0.75,
        dashArray: '4, 4',
        className: 'overlap-pulse-animation'
      };

      const geoJsonLayer = L.geoJSON(ov.geometry, {
        style: overlapStyle,
        onEachFeature: (f, layer) => {
          const areaHa = ov.overlapArea.ha.toFixed(3);
          const tooltipContent = `
            <div class="font-sans text-xs">
              <span class="font-bold text-red-100 bg-red-700 px-1.5 py-0.5 rounded">⚠️ OVERLAP CONFLICT</span>
              <div class="mt-1 text-slate-100 font-semibold">${ov.featureAName} ⚔️ ${ov.featureBName}</div>
              <div class="text-red-300 font-bold mt-0.5">Overlap Area: ${areaHa} Ha</div>
            </div>
          `;
          layer.bindTooltip(tooltipContent, { sticky: true, className: 'custom-overlap-tooltip' });

          layer.on('click', () => {
            if (onOverlapClick) onOverlapClick(ov);
          });
        }
      });

      this.overlapLayerGroup.addLayer(geoJsonLayer);
    });
  }

  zoomToFeature(featureId) {
    const layer = this.polygonLayersMap.get(featureId);
    if (layer && this.map) {
      this.map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
      layer.openPopup();
    }
  }

  zoomToBounds(bounds) {
    if (bounds && this.map) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }

  fitAll() {
    if (this.featureLayerGroup && this.featureLayerGroup.getLayers().length > 0) {
      if (this.map) {
        this.map.invalidateSize();
        const bounds = this.featureLayerGroup.getBounds();
        if (bounds && bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [25, 25] });
          setTimeout(() => {
            if (this.map && bounds.isValid()) {
              this.map.invalidateSize();
              this.map.fitBounds(bounds, { padding: [25, 25] });
            }
          }, 200);
        }
      }
    }
  }

  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 180);
    }
  }
}

window.MapManager = MapManager;
