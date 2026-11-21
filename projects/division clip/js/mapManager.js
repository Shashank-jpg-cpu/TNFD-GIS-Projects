/**
 * Leaflet Map Manager Module
 * Controls base layers, administrative vector display, and raster overlays
 */

const MapManager = {
    map: null,
    adminLayer: null,
    rasterLayerOverlay: null,
    highlightLayer: null,
    currentBasemap: null,
    basemapLayers: {},

    init: function(mapElementId = "map") {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this.map = L.map(mapElementId, {
            center: [11.1271, 78.6569],
            zoom: 7,
            zoomControl: true,
            attributionControl: true
        });

        this.basemapLayers = {
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19
            }),
            osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }),
            terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'OpenTopoMap',
                maxZoom: 17
            }),
            carto_dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                maxZoom: 19
            }),
            carto_light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                maxZoom: 19
            })
        };

        this.setBasemap("satellite");
        return this.map;
    },

    setBasemap: function(type) {
        if (!this.map) return;
        if (this.currentBasemap) {
            this.map.removeLayer(this.currentBasemap);
        }
        this.currentBasemap = this.basemapLayers[type] || this.basemapLayers.satellite;
        this.currentBasemap.addTo(this.map);
        
        if (this.rasterLayerOverlay) this.rasterLayerOverlay.bringToBack();
        if (this.adminLayer) this.adminLayer.bringToFront();
    },

    displayAdminLayer: function(geojsonData, labelProperty = null) {
        if (!this.map || !geojsonData) return;

        if (this.adminLayer) {
            this.map.removeLayer(this.adminLayer);
            this.adminLayer = null;
        }

        const self = this;
        this.adminLayer = L.geoJSON(geojsonData, {
            style: function(feature) {
                return {
                    color: "#2563eb",
                    weight: 2,
                    opacity: 0.9,
                    fillColor: "#3b82f6",
                    fillOpacity: 0.12
                };
            },
            onEachFeature: function(feature, layer) {
                let divName = "Division";
                if (labelProperty && feature.properties && feature.properties[labelProperty] !== undefined) {
                    divName = feature.properties[labelProperty];
                } else if (feature.properties && feature.properties.DN_NAME) {
                    divName = feature.properties.DN_NAME;
                } else if (feature.properties && feature.properties._division_name) {
                    divName = feature.properties._division_name;
                }

                layer.bindTooltip(`
                    <div class="font-sans">
                        <div class="font-bold text-xs text-slate-900">${divName}</div>
                    </div>
                `, { sticky: true, className: "custom-leaflet-tooltip" });

                layer.on({
                    mouseover: function(e) {
                        const l = e.target;
                        l.setStyle({
                            weight: 3.5,
                            color: "#b91c1c",
                            fillOpacity: 0.25
                        });
                        l.bringToFront();
                    },
                    mouseout: function(e) {
                        self.adminLayer.resetStyle(e.target);
                    }
                });
            }
        }).addTo(this.map);

        try {
            const bounds = this.adminLayer.getBounds();
            if (bounds.isValid()) {
                this.map.invalidateSize();
                this.map.fitBounds(bounds, { padding: [20, 20] });
                setTimeout(() => {
                    if (self.map && bounds.isValid()) {
                        self.map.invalidateSize();
                        self.map.fitBounds(bounds, { padding: [20, 20] });
                    }
                }, 200);
            }
        } catch (e) {
            console.warn("Bounds fitting error:", e);
        }
    },

    displayRasterLayer: function(layer2Data, colormap = "forest_types", opacity = 1.0) {
        if (!this.map || !layer2Data) return;

        if (this.rasterLayerOverlay) {
            this.map.removeLayer(this.rasterLayerOverlay);
            this.rasterLayerOverlay = null;
        }

        // 1. Vector LULC layer rendering
        if (layer2Data.isLULC && layer2Data.geojson) {
            const classField = layer2Data.classColumn || "dscr3";
            this.rasterLayerOverlay = L.geoJSON(layer2Data.geojson, {
                style: function(feat) {
                    const cVal = feat.properties && feat.properties[classField] ? String(feat.properties[classField]).trim() : "";
                    const fillColor = SpatialClipper.getLulcColor(cVal, 0);
                    return {
                        fillColor: fillColor,
                        fillOpacity: 0.85,
                        color: "rgba(0,0,0,0.25)",
                        weight: 0.8,
                        opacity: 0.9
                    };
                },
                onEachFeature: function(feat, layer) {
                    const cVal = feat.properties && feat.properties[classField] ? String(feat.properties[classField]).trim() : "Unclassified";
                    layer.bindTooltip(`<b>${classField}:</b> ${cVal}`, { sticky: true });
                }
            }).addTo(this.map);

            if (this.adminLayer) this.adminLayer.bringToFront();
            return;
        }

        // 2. Standard Raster Layer rendering
        const canvas = SpatialClipper.renderRasterToCanvas(layer2Data);
        const dataUrl = canvas.toDataURL();

        const [minX, minY, maxX, maxY] = layer2Data.bbox || [76.228, 8.077, 80.342, 13.585];
        const southWest = L.latLng(minY, minX);
        const northEast = L.latLng(maxY, maxX);
        const imageBounds = L.latLngBounds(southWest, northEast);

        this.rasterLayerOverlay = L.imageOverlay(dataUrl, imageBounds, {
            opacity: 1.0,
            interactive: false,
            zIndex: 10
        }).addTo(this.map);

        if (this.adminLayer) {
            this.adminLayer.bringToFront();
        }

        if (!this.adminLayer) {
            this.map.fitBounds(imageBounds, { padding: [30, 30] });
        }
    },

    setRasterOpacity: function(opacity) {
        if (this.rasterLayerOverlay) {
            this.rasterLayerOverlay.setOpacity(opacity);
        }
    },

    highlightDivision: function(adminFeature) {
        if (!this.map || !adminFeature) return;

        this.clearHighlight();

        this.highlightLayer = L.geoJSON(adminFeature, {
            style: {
                color: "#b91c1c",
                weight: 4,
                opacity: 1.0,
                fillColor: "#b91c1c",
                fillOpacity: 0.12
            }
        }).addTo(this.map);

        try {
            const bounds = this.highlightLayer.getBounds();
            if (bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }
        } catch (e) {}
    },

    clearHighlight: function() {
        if (this.highlightLayer && this.map) {
            this.map.removeLayer(this.highlightLayer);
            this.highlightLayer = null;
        }
    }
};

window.MapManager = MapManager;
