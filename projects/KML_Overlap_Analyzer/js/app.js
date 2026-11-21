/**
 * Storage Manager for Persistent Sessions across Refreshes & Browser Restarts
 * Uses IndexedDB with LocalStorage fallback for high-capacity polygon storage
 */
const AppStorage = {
  DB_NAME: 'ForestDivisionGISDB',
  DB_VERSION: 1,
  STORE_NAME: 'workspace',

  openDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME);
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  },

  async save(data) {
    try {
      try {
        localStorage.setItem('FOREST_GIS_DATA', JSON.stringify(data));
      } catch (e) {}

      const db = await this.openDB();
      if (db) {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        store.put(data, 'current_session');
      }
    } catch (e) {
      console.error('Error saving session:', e);
    }
  },

  async load() {
    try {
      const db = await this.openDB();
      if (db) {
        const data = await new Promise((resolve) => {
          const tx = db.transaction(this.STORE_NAME, 'readonly');
          const store = tx.objectStore(this.STORE_NAME);
          const req = store.get('current_session');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          return data;
        }
      }

      const localStr = localStorage.getItem('FOREST_GIS_DATA');
      if (localStr) {
        const data = JSON.parse(localStr);
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.error('Error loading session:', e);
    }
    return null;
  },

  async clear() {
    try {
      localStorage.removeItem('FOREST_GIS_DATA');
      const db = await this.openDB();
      if (db) {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        store.delete('current_session');
      }
    } catch (e) {
      console.error('Error clearing session:', e);
    }
  }
};

/**
 * Main Application Controller
 * Coordinates KML Loading, Viewer, Overlap Analysis, Resolver, and Export workflows
 */

class DivisionKmlApp {
  constructor() {
    this.features = [];
    this.overlaps = [];
    this.rejectedOverlaps = [];
    this.activeTab = 'viewer';
    this.activeUnit = 'ha';
    this.filterCategory = 'ALL';
    this.searchQuery = '';
    this.divisionName = 'KML_Boundaries';
    this.overlapSortOrder = 'max-to-min'; // Default: Highest to lowest (Max to Min)
    this.viewerMap = null;
    this.overlapMap = null;
    this.resolver = null;

    this.init();
  }

  getRejectedFeatureIds() {
    const ids = new Set();
    (this.rejectedOverlaps || []).forEach(ro => {
      if (ro.rejectedTarget === 'A') {
        if (ro.featureAId) ids.add(ro.featureAId);
      } else if (ro.rejectedTarget === 'B') {
        if (ro.featureBId) ids.add(ro.featureBId);
      } else if (Array.isArray(ro.rejectedFeatureIds) && ro.rejectedFeatureIds.length > 0) {
        ro.rejectedFeatureIds.forEach(id => ids.add(id));
      } else {
        if (ro.featureAId) ids.add(ro.featureAId);
        if (ro.featureBId) ids.add(ro.featureBId);
      }
    });
    return ids;
  }

  async init() {
    // Initialize Maps
    this.editingFeatureId = null;
    this.viewerMap = new MapManager('viewer-map');
    this.overlapMap = new MapManager('overlap-map');
    this.resolver = new OverlapResolver(this);

    // Setup Event Listeners
    this.bindEvents();
    this.bindColorStudioEvents();

    // Check for user's previously saved KML session
    const saved = await AppStorage.load();
    if (saved && saved.features && saved.features.length > 0) {
      this.features = saved.features;
      if (saved.divisionName) this.divisionName = saved.divisionName;
      if (saved.activeUnit) this.activeUnit = saved.activeUnit;
      // Ensure each boundary retains or correctly resolves its RF / RL classification
      this.features.forEach(f => {
        if (!f.type) {
          f.type = KMLParser.detectType(f.name, f.description || '', f.sourceFile || f.fileName || '', f.folderName || '', f.extendedData || {});
        }
      });

      const divNameInput = document.getElementById('division-name-input');
      if (divNameInput) divNameInput.value = this.divisionName;
      const unitSelector = document.getElementById('unit-selector');
      if (unitSelector) unitSelector.value = this.activeUnit;

      this.onStateChanged();
      this.viewerMap.fitAll();
      this.showNotification(`Restored your ${this.features.length} saved KML boundaries`, "info");
    } else {
      // Clean, empty workspace on initial launch
      this.features = [];
      this.rejectedOverlaps = [];
      this.onStateChanged();
    }
  }

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Tab 1 Mobile View Mode Switcher
    const kmlTabBtnMap = document.getElementById('kml-tab-btn-map');
    const kmlTabBtnLayers = document.getElementById('kml-tab-btn-layers');

    const setKmlMobileView = (view) => {
      if (view === 'map') {
        document.body.classList.remove('kml-mobile-view-layers');
        document.body.classList.add('kml-mobile-view-map');
        if (kmlTabBtnMap) {
          kmlTabBtnMap.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow';
        }
        if (kmlTabBtnLayers) {
          kmlTabBtnLayers.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300';
        }
        this.viewerMap.invalidateSize();
      } else {
        document.body.classList.remove('kml-mobile-view-map');
        document.body.classList.add('kml-mobile-view-layers');
        if (kmlTabBtnLayers) {
          kmlTabBtnLayers.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow';
        }
        if (kmlTabBtnMap) {
          kmlTabBtnMap.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300';
        }
      }
    };

    if (kmlTabBtnMap) kmlTabBtnMap.addEventListener('click', () => setKmlMobileView('map'));
    if (kmlTabBtnLayers) kmlTabBtnLayers.addEventListener('click', () => setKmlMobileView('layers'));
    this.setKmlMobileView = setKmlMobileView;

    // Tab 2 Mobile View Mode Switcher
    const kmlOverlapTabBtnMap = document.getElementById('kml-overlap-tab-btn-map');
    const kmlOverlapTabBtnTable = document.getElementById('kml-overlap-tab-btn-table');

    const setKmlOverlapMobileView = (view) => {
      if (view === 'map') {
        document.body.classList.remove('kml-overlap-mobile-table');
        document.body.classList.add('kml-overlap-mobile-map');
        if (kmlOverlapTabBtnMap) {
          kmlOverlapTabBtnMap.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-rose-600 text-white shadow';
        }
        if (kmlOverlapTabBtnTable) {
          kmlOverlapTabBtnTable.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300';
        }
        this.overlapMap.invalidateSize();
      } else {
        document.body.classList.remove('kml-overlap-mobile-map');
        document.body.classList.add('kml-overlap-mobile-table');
        if (kmlOverlapTabBtnTable) {
          kmlOverlapTabBtnTable.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-rose-600 text-white shadow';
        }
        if (kmlOverlapTabBtnMap) {
          kmlOverlapTabBtnMap.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300';
        }
      }
    };

    if (kmlOverlapTabBtnMap) kmlOverlapTabBtnMap.addEventListener('click', () => setKmlOverlapMobileView('map'));
    if (kmlOverlapTabBtnTable) kmlOverlapTabBtnTable.addEventListener('click', () => setKmlOverlapMobileView('table'));
    this.setKmlOverlapMobileView = setKmlOverlapMobileView;

    // File Inputs & Browse Buttons
    const fileInput = document.getElementById('kml-file-input');
    const folderInput = document.getElementById('kml-folder-input');
    const btnBrowseFiles = document.getElementById('btn-browse-files');
    const btnBrowseFolder = document.getElementById('btn-browse-folder');

    if (btnBrowseFiles && fileInput) {
      btnBrowseFiles.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (btnBrowseFolder && folderInput) {
      btnBrowseFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        folderInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          await this.handleFileUpload(e.target.files, "files");
          fileInput.value = ''; // Reset input
        }
      });
    }

    if (folderInput) {
      folderInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const allFiles = Array.from(e.target.files);
          // Strictly recognize only .kml and .kmz files (ignoring remaining files)
          const kmlFiles = allFiles.filter(f => /\.(kml|kmz)$/i.test(f.name) || (/\.xml$/i.test(f.name) && !/\.qml|\.gml|\.shp\.xml/i.test(f.name)));
          if (kmlFiles.length === 0) {
            this.showNotification("No .kml or .kmz files found in the selected folder or its subfolders", "error");
            folderInput.value = '';
            return;
          }
          await this.handleFileUpload(kmlFiles, "folder");
          folderInput.value = ''; // Reset input
        }
      });
    }

    // Drag & Drop onto Dropzone (Recursively scans nested subfolders)
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dropzone-active');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dropzone-active');
        }, false);
      });

      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.dataTransfer;
        if (dt) {
          this.showNotification("Scanning dropped files and subfolders...", "info");
          const files = await KMLParser.extractFilesFromDataTransfer(dt);
          if (files.length === 0) {
            this.showNotification("No .kml or .kmz files found in the dropped item(s)", "error");
            return;
          }
          await this.handleFileUpload(files, "drag-drop");
        }
      });

      // Clicking dropzone opens modal choice
      dropzone.addEventListener('click', (e) => {
        if (e.target === dropzone || e.target.closest('#upload-dropzone')) {
          this.openReplaceChoiceModal(false);
        }
      });
    }

    // Replace Choice Modal Elements
    const replaceModal = document.getElementById('replace-choice-modal');
    const btnCloseReplace = document.getElementById('btn-close-replace-modal');
    const btnCancelReplace = document.getElementById('btn-cancel-replace-modal');
    const btnReplacePickFiles = document.getElementById('btn-replace-pick-files');
    const btnReplacePickFolder = document.getElementById('btn-replace-pick-folder');

    const closeReplaceModal = () => {
      if (replaceModal) replaceModal.classList.add('hidden');
    };

    if (btnCloseReplace) btnCloseReplace.addEventListener('click', closeReplaceModal);
    if (btnCancelReplace) btnCancelReplace.addEventListener('click', closeReplaceModal);
    if (replaceModal) {
      replaceModal.addEventListener('click', (e) => {
        if (e.target === replaceModal) closeReplaceModal();
      });
    }

    if (btnReplacePickFiles) {
      btnReplacePickFiles.addEventListener('click', async () => {
        closeReplaceModal();
        if (this._isReplacingOld) {
          this.features = [];
          this.rejectedOverlaps = [];
          await AppStorage.clear();
          this.onStateChanged();
        }
        if (fileInput) fileInput.click();
      });
    }

    if (btnReplacePickFolder) {
      btnReplacePickFolder.addEventListener('click', async () => {
        closeReplaceModal();
        if (this._isReplacingOld) {
          this.features = [];
          this.rejectedOverlaps = [];
          await AppStorage.clear();
          this.onStateChanged();
        }
        if (folderInput) folderInput.click();
      });
    }

    // Load Sample Button
    const btnSample = document.getElementById('btn-load-sample');
    if (btnSample) {
      btnSample.addEventListener('click', () => {
        this.loadSampleData();
        if (this.setKmlMobileView) this.setKmlMobileView('map');
        this.viewerMap.fitAll();
        this.showNotification("Loaded realistic sample Forest Division KML with overlaps", "info");
      });
    }

    // Clear All Buttons (Header & Sidebar)
    const handleClearAll = async () => {
      if (confirm("Are you sure you want to clear all loaded KML boundaries?")) {
        this.features = [];
        this.rejectedOverlaps = [];
        await AppStorage.clear();
        this.onStateChanged();
        this.showNotification("Cleared all old KML boundaries", "info");
      }
    };

    const btnClear = document.getElementById('btn-clear-all');
    if (btnClear) btnClear.addEventListener('click', handleClearAll);

    const btnClearSidebar = document.getElementById('btn-clear-sidebar');
    if (btnClearSidebar) btnClearSidebar.addEventListener('click', handleClearAll);

    // Replace All New Button
    const btnFreshUpload = document.getElementById('btn-fresh-upload');
    if (btnFreshUpload) {
      btnFreshUpload.addEventListener('click', () => {
        this.openReplaceChoiceModal(true);
      });
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-slate-700', 'text-white'));
        btn.classList.add('bg-slate-700', 'text-white');
        this.filterCategory = btn.dataset.filter;
        this.renderFeatureList();
      });
    });

    // Set All RF / All RL batch buttons
    const btnSetAllRf = document.getElementById('btn-set-all-rf');
    if (btnSetAllRf) {
      btnSetAllRf.addEventListener('click', () => {
        if (this.features.length === 0) return;
        this.features.forEach(f => f.type = 'RF');
        this.onStateChanged();
        this.showNotification("Set all loaded boundaries to Reserve Forest (RF)", "success");
      });
    }

    const btnSetAllRl = document.getElementById('btn-set-all-rl');
    if (btnSetAllRl) {
      btnSetAllRl.addEventListener('click', () => {
        if (this.features.length === 0) return;
        this.features.forEach(f => f.type = 'RL');
        this.onStateChanged();
        this.showNotification("Set all loaded boundaries to Reserve Land (RL)", "info");
      });
    }

    // Search input
    const searchInput = document.getElementById('search-features');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderFeatureList();
      });
    }

    // Unit Selector
    const unitSelector = document.getElementById('unit-selector');
    if (unitSelector) {
      unitSelector.addEventListener('change', (e) => {
        this.activeUnit = e.target.value;
        this.renderFeatureList();
        this.renderOverlapTable();
        this.updateStatsBar();
      });
    }

    // Overlap Area Sort Selector (Max to Min & Min to Max)
    const selectOverlapSort = document.getElementById('select-overlap-sort');
    if (selectOverlapSort) {
      selectOverlapSort.value = this.overlapSortOrder || 'max-to-min';
      selectOverlapSort.addEventListener('change', (e) => {
        this.overlapSortOrder = e.target.value;
        this.updateOverlapSortUI();
        this.renderOverlapTable();
      });
    }

    // Overlap Area Column Header Click Toggle
    const thOverlapArea = document.getElementById('th-overlap-area');
    if (thOverlapArea) {
      thOverlapArea.addEventListener('click', () => {
        this.overlapSortOrder = (this.overlapSortOrder === 'max-to-min') ? 'min-to-max' : 'max-to-min';
        this.updateOverlapSortUI();
        this.renderOverlapTable();
      });
    }

    // Base Layer Selectors
    const baseSelectorViewer = document.getElementById('viewer-basemap-select');
    if (baseSelectorViewer) {
      baseSelectorViewer.addEventListener('change', (e) => {
        this.viewerMap.setBaseLayer(e.target.value);
      });
    }

    const baseSelectorOverlap = document.getElementById('overlap-basemap-select');
    if (baseSelectorOverlap) {
      baseSelectorOverlap.addEventListener('change', (e) => {
        this.overlapMap.setBaseLayer(e.target.value);
      });
    }

    // Resolver Buttons
    const btnDeductA = document.getElementById('btn-deduct-feata');
    if (btnDeductA) {
      btnDeductA.addEventListener('click', () => this.resolver.deductFromFeatureA());
    }

    const btnDeductB = document.getElementById('btn-deduct-featb');
    if (btnDeductB) {
      btnDeductB.addEventListener('click', () => this.resolver.deductFromFeatureB());
    }

    const btnResetPair = document.getElementById('btn-reset-pair');
    if (btnResetPair) {
      btnResetPair.addEventListener('click', () => this.resolver.resetPair());
    }

    const btnApplyResolution = document.getElementById('btn-apply-resolution');
    if (btnApplyResolution) {
      btnApplyResolution.addEventListener('click', () => this.resolver.applyResolution());
    }

    // Export All Button (Exports ONLY clean boundaries, excluding rejected ones)
    const btnExportAll = document.getElementById('btn-export-all');
    if (btnExportAll) {
      btnExportAll.addEventListener('click', () => {
        const rejectedIds = this.getRejectedFeatureIds();
        const cleanFeatures = this.features.filter(f => !rejectedIds.has(f.id));
        if (cleanFeatures.length === 0) {
          this.showNotification("No clean boundaries to export", "error");
          return;
        }
        const exportName = this.divisionName || 'KML_Boundaries';
        KMLExporter.exportAllFeatures(cleanFeatures, exportName);
        this.showNotification(`Exported ${cleanFeatures.length} clean boundaries to KML!`, "success");
      });
    }

    const btnExportTabAll = document.getElementById('btn-export-tab-all');
    if (btnExportTabAll) {
      btnExportTabAll.addEventListener('click', () => {
        const rejectedIds = this.getRejectedFeatureIds();
        const cleanFeatures = this.features.filter(f => !rejectedIds.has(f.id));
        if (cleanFeatures.length === 0) {
          this.showNotification("No clean boundaries to export", "error");
          return;
        }
        const exportName = this.divisionName || 'KML_Boundaries';
        KMLExporter.exportAllFeatures(cleanFeatures, exportName);
        this.showNotification(`Exported ${cleanFeatures.length} clean boundaries to KML!`, "success");
      });
    }

    // File Name input
    const divNameInput = document.getElementById('division-name-input');
    if (divNameInput) {
      divNameInput.addEventListener('input', (e) => {
        this.divisionName = e.target.value || 'KML_Boundaries';
      });
    }

    // Toggle All Visibility
    const toggleAllCheckbox = document.getElementById('toggle-all-visibility');
    if (toggleAllCheckbox) {
      toggleAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        this.features.forEach(f => f.visible = isChecked);
        this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
        this.renderFeatureList();
      });
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update Tab Buttons UI
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active', 'border-emerald-500', 'text-emerald-400');
        btn.classList.remove('border-transparent', 'text-slate-400');
      } else {
        btn.classList.remove('active', 'border-emerald-500', 'text-emerald-400');
        btn.classList.add('border-transparent', 'text-slate-400');
      }
    });

    // Update Tab Panels UI
    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.id === `tab-panel-${tabName}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Handle Map Resizes
    if (tabName === 'viewer') {
      this.viewerMap.invalidateSize();
      this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
    } else if (tabName === 'overlaps') {
      this.overlapMap.invalidateSize();
      this.overlapMap.renderFeatures(this.features);
      this.overlapMap.renderOverlaps(this.overlaps, (ov) => this.openResolverForOverlap(ov));
      this.overlapMap.fitAll();
    } else if (tabName === 'resolver') {
      if (this.overlaps.length > 0 && !this.resolver.currentOverlap) {
        this.resolver.loadOverlap(this.overlaps[0]);
      } else if (this.resolver.currentOverlap) {
        this.resolver.loadOverlap(this.resolver.currentOverlap);
      }
    } else if (tabName === 'export') {
      this.renderExportTable();
    }
  }

  openReplaceChoiceModal(isReplacingOld = false) {
    this._isReplacingOld = isReplacingOld;
    const modal = document.getElementById('replace-choice-modal');
    if (modal) modal.classList.remove('hidden');
  }

  async handleFileUpload(files, source = "files") {
    try {
      const fileList = Array.from(files || []);
      // Strictly recognize only .kml and .kmz files (ignoring remaining files)
      const filteredFiles = fileList.filter(f => /\.(kml|kmz)$/i.test(f.name) || (/\.xml$/i.test(f.name) && !/\.qml|\.gml|\.shp\.xml/i.test(f.name)));

      if (filteredFiles.length === 0) {
        this.showNotification("No valid .kml or .kmz files found in the selection", "error");
        return;
      }

      const fileCount = filteredFiles.length;
      const subfolderSet = new Set(
        filteredFiles
          .map(f => {
            const p = (f.webkitRelativePath || f.relativePath || '').replace(/\\/g, '/');
            const parts = p.split('/');
            return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
          })
          .filter(Boolean)
      );
      const subfolderCount = subfolderSet.size;

      let startMsg = `Parsing ${fileCount} KML/KMZ file(s)...`;
      if (subfolderCount > 0) {
        startMsg = `Scanning ${subfolderCount} subfolder(s) & parsing ${fileCount} KML file(s)...`;
      }
      this.showNotification(startMsg, "info");

      const newFeatures = await KMLParser.parseMultipleFiles(filteredFiles);
      
      if (newFeatures.length === 0) {
        this.showNotification("No valid Polygon boundary placemarks found in the KML file(s)", "error");
        return;
      }

      this.features = [...this.features, ...newFeatures];
      this.onStateChanged();
      if (this.setKmlMobileView) this.setKmlMobileView('map');
      this.viewerMap.fitAll();
      
      if (subfolderCount > 0) {
        this.showNotification(`Loaded ${newFeatures.length} boundaries from ${fileCount} KML/KMZ files across ${subfolderCount} subfolder(s)!`, "success");
      } else {
        this.showNotification(`Successfully loaded ${newFeatures.length} boundary feature(s)!`, "success");
      }
    } catch (e) {
      console.error(e);
      this.showNotification(`Upload Error: ${e.message}`, "error");
    }
  }

  loadSampleData() {
    KMLParser.resetPalette();
    this.features = JSON.parse(JSON.stringify(window.SAMPLE_DIVISION_DATA));
    
    // Recalculate areas
    this.features.forEach(f => {
      const area = SpatialEngine.calculateArea(f);
      f.areaHa = area.ha;
      f.originalAreaHa = area.ha;
      f.areaObj = area;
    });

    this.onStateChanged();
    if (this.setKmlMobileView) this.setKmlMobileView('map');
    this.viewerMap.fitAll();
  }

  /**
   * Recalculate everything whenever features are updated
   */
  onStateChanged() {
    // Recompute areas with high decimal precision
    this.features.forEach(f => {
      const area = SpatialEngine.calculateArea(f.geometry || f);
      f.areaHa = area.ha;
      if (f.originalAreaHa === undefined || f.originalAreaHa === 0) f.originalAreaHa = area.ha;
      f.areaObj = area;
    });

    // Detect Overlaps
    this.overlaps = SpatialEngine.detectOverlaps(this.features);

    // Update Maps
    this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
    this.overlapMap.renderFeatures(this.features);
    this.overlapMap.renderOverlaps(this.overlaps, (ov) => this.openResolverForOverlap(ov));

    // Update Sidebar and UI
    this.renderFeatureList();
    this.renderOverlapTable();
    this.updateStatsBar();
    this.renderExportTable();

    // Auto-save user workspace permanently to LocalStorage & IndexedDB
    AppStorage.save({
      features: this.features,
      divisionName: this.divisionName,
      activeUnit: this.activeUnit,
      rejectedOverlaps: this.rejectedOverlaps
    });
  }

  updateStatsBar() {
    const totalCountEl = document.getElementById('stat-total-count');
    const rfCountEl = document.getElementById('stat-rf-count');
    const rlCountEl = document.getElementById('stat-rl-count');
    const totalAreaEl = document.getElementById('stat-total-area');
    const totalOverlapsEl = document.getElementById('stat-total-overlaps');
    const overlapAreaSumEl = document.getElementById('stat-overlap-area-sum');
    const overlapNavBadge = document.getElementById('overlap-nav-badge');

    const rfFeatures = this.features.filter(f => f.type === 'RF');
    const rlFeatures = this.features.filter(f => f.type === 'RL');
    
    const activeOverlaps = this.overlaps.filter(ov => !this.rejectedOverlaps || !this.rejectedOverlaps.some(ro => ro.id === ov.id));
    const sumAreaHa = this.features.reduce((sum, f) => sum + (f.areaHa || 0), 0);
    const sumOverlapHa = activeOverlaps.reduce((sum, ov) => sum + (ov.overlapArea.ha || 0), 0);

    if (totalCountEl) totalCountEl.innerText = this.features.length;
    if (rfCountEl) rfCountEl.innerText = rfFeatures.length;
    if (rlCountEl) rlCountEl.innerText = rlFeatures.length;

    if (totalAreaEl) {
      const formatted = SpatialEngine.formatArea({
        ha: sumAreaHa,
        acres: sumAreaHa * 2.47105,
        sqkm: sumAreaHa / 100,
        sqm: sumAreaHa * 10000
      }, this.activeUnit);
      totalAreaEl.innerText = formatted;
    }

    if (totalOverlapsEl) totalOverlapsEl.innerText = activeOverlaps.length;
    
    if (overlapAreaSumEl) {
      const formatted = SpatialEngine.formatArea({
        ha: sumOverlapHa,
        acres: sumOverlapHa * 2.47105,
        sqkm: sumOverlapHa / 100,
        sqm: sumOverlapHa * 10000
      }, this.activeUnit);
      overlapAreaSumEl.innerText = formatted;
    }

    if (overlapNavBadge) {
      overlapNavBadge.innerText = activeOverlaps.length;
      if (activeOverlaps.length > 0) {
        overlapNavBadge.className = "ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white animate-pulse";
      } else {
        overlapNavBadge.className = "ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-white";
        overlapNavBadge.innerText = "0 Clean";
      }
    }

    const mobilePolyCount = document.getElementById('mobile-poly-count');
    if (mobilePolyCount) mobilePolyCount.innerText = this.features.length;

    const mobileOverlapBadge = document.getElementById('mobile-overlap-badge');
    if (mobileOverlapBadge) mobileOverlapBadge.innerText = activeOverlaps.length;
  }

  renderFeatureList() {
    const listContainer = document.getElementById('feature-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (this.features.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-10 px-3 text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/40 space-y-3">
          <div class="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-emerald-400">
            <i class="fa-solid fa-cloud-arrow-up text-base"></i>
          </div>
          <div>
            <div class="font-bold text-slate-200 text-xs mb-1">Workspace Empty</div>
            <div class="text-[11px] text-slate-500">Upload KML/KMZ files or select a folder to scan recursively</div>
          </div>
          <div class="flex items-center justify-center gap-2 flex-wrap pt-1">
            <button id="btn-empty-files" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 shadow">
              <i class="fa-solid fa-file-lines text-xs"></i> Add Files
            </button>
            <button id="btn-empty-folder" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 shadow">
              <i class="fa-solid fa-folder-tree text-xs"></i> Add Folder
            </button>
            <button id="btn-empty-sample" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5">
              <i class="fa-solid fa-wand-magic-sparkles text-amber-400 text-xs"></i> Demo Sample
            </button>
          </div>
        </div>
      `;
      const btnEmptyFiles = listContainer.querySelector('#btn-empty-files');
      if (btnEmptyFiles) {
        btnEmptyFiles.addEventListener('click', () => {
          const fileInput = document.getElementById('kml-file-input');
          if (fileInput) fileInput.click();
        });
      }
      const btnEmptyFolder = listContainer.querySelector('#btn-empty-folder');
      if (btnEmptyFolder) {
        btnEmptyFolder.addEventListener('click', () => {
          const folderInput = document.getElementById('kml-folder-input');
          if (folderInput) folderInput.click();
        });
      }
      const btnEmptySample = listContainer.querySelector('#btn-empty-sample');
      if (btnEmptySample) {
        btnEmptySample.addEventListener('click', () => {
          this.loadSampleData();
          this.showNotification("Loaded demo sample dataset", "info");
        });
      }
      return;
    }

    const filtered = this.features.filter(f => {
      const matchesCategory = this.filterCategory === 'ALL' || f.type === this.filterCategory;
      const matchesSearch = !this.searchQuery || f.name.toLowerCase().includes(this.searchQuery);
      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-8 text-slate-400 text-xs">
          <i class="fa-solid fa-filter text-xl mb-2 opacity-50"></i>
          <div>No boundaries matching filter</div>
        </div>
      `;
      return;
    }

    filtered.forEach((feat, index) => {
      const card = document.createElement('div');
      card.className = "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 rounded-lg p-2.5 transition flex flex-col gap-2 relative group";
      card.dataset.id = feat.id;

      const areaFormatted = SpatialEngine.formatArea(feat.areaObj, this.activeUnit);
      const isOutline = feat.fillStyle === 'outline';

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <!-- Visibility Checkbox -->
            <input type="checkbox" class="feature-vis-cb rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer" ${feat.visible !== false ? 'checked' : ''} data-id="${feat.id}">
            
            <!-- Interactive Color Swatch (Opens Studio with Sliders) -->
            <button class="btn-open-studio w-5 h-5 rounded-full border border-white/50 flex-shrink-0 cursor-pointer shadow hover:scale-125 transition" style="background-color: ${feat.color};" data-id="${feat.id}" title="Click to open Drag Sliders & Color Studio"></button>

            <!-- Clickable Type Badge -->
            <button class="btn-toggle-type text-[10px] font-bold px-1.5 py-0.5 rounded ${feat.type === 'RF' ? 'badge-rf hover:opacity-90' : 'badge-rl hover:opacity-90'} flex-shrink-0 cursor-pointer shadow transition" data-id="${feat.id}" title="Click to switch between RF and RL">
              ${feat.type}
            </button>

            <!-- Editable Name -->
            <input type="text" class="feature-name-input bg-transparent hover:bg-slate-900/50 focus:bg-slate-900 border border-transparent hover:border-slate-600 focus:border-emerald-500 rounded px-1 text-xs font-semibold text-slate-100 truncate w-full outline-none" value="${feat.name}" data-id="${feat.id}" title="Click to rename">
          </div>

          <!-- Zoom Button -->
          <button class="btn-zoom-feature text-slate-400 hover:text-emerald-400 p-1 transition" title="Zoom to boundary" data-id="${feat.id}">
            <i class="fa-solid fa-crosshairs text-xs"></i>
          </button>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-700/50">
          <div class="flex items-center gap-1.5 flex-wrap">
            <!-- GIS Area -->
            <span class="font-mono text-emerald-400 font-bold" title="GIS Calculated Geodesic Area">
              ${areaFormatted}
            </span>

            <!-- Blank Field to Add Index Area (Double click or click to type) -->
            <div class="flex items-center gap-1 bg-slate-950/80 border border-slate-700 hover:border-cyan-500 focus-within:border-cyan-400 rounded px-1.5 py-0.5 transition shadow-inner" title="Click or double-click to type official Index notification area in Ha">
              <span class="text-[9px] text-cyan-400 font-bold uppercase tracking-tight">Index:</span>
              <input type="number" step="any" placeholder="0.000" class="feature-manual-area-input bg-transparent text-cyan-300 font-mono text-[11px] font-bold outline-none w-16 placeholder-slate-600 focus:text-white" value="${feat.manualAreaHa !== undefined && feat.manualAreaHa !== null ? feat.manualAreaHa : ''}" data-id="${feat.id}">
              <span class="text-[9px] text-slate-400 font-mono">Ha</span>
            </div>

            <!-- Live Difference Badge (Shows when Index area is entered) -->
            ${(() => {
              if (feat.manualAreaHa !== undefined && feat.manualAreaHa !== null && !isNaN(feat.manualAreaHa) && feat.manualAreaHa > 0) {
                const diff = (feat.areaHa || 0) - feat.manualAreaHa;
                const absDiff = Math.abs(diff);
                const pct = (absDiff / feat.manualAreaHa) * 100;
                const isMatch = absDiff <= 0.05;
                return `
                  <span class="text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${isMatch ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-800/80' : 'text-amber-400 bg-amber-950/80 border border-amber-800/80'}" title="Variance: GIS Area (${(feat.areaHa||0).toFixed(3)}) - Index (${feat.manualAreaHa.toFixed(3)}) = ${diff >= 0 ? '+' : ''}${diff.toFixed(3)} Ha (${pct.toFixed(2)}%)">
                    Diff: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} Ha (${pct.toFixed(1)}%)
                  </span>
                `;
              }
              return '';
            })()}

            <!-- Clean / Overlap Status Badge -->
            ${(() => {
              const rejectedIds = this.getRejectedFeatureIds();
              if (rejectedIds.has(feat.id)) {
                return `<span class="text-[10px] text-rose-400 bg-rose-950/70 border border-rose-700/70 px-1.5 py-0.2 rounded font-medium" title="This boundary has been moved to the Rejected / Disputed Folder"><i class="fa-solid fa-folder-minus mr-1"></i>In Rejected</span>`;
              }

              const status = this.getFeatureOverlapStatus(feat.id);
              if (status.isClean) {
                if (feat.isCorrected) {
                  return `<span class="text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-700/70 px-1.5 py-0.2 rounded font-medium">✓ Clean</span>`;
                } else {
                  return `<span class="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.2 rounded font-medium">✓ Clean</span>`;
                }
              } else {
                if (feat.isCorrected) {
                  return `<span class="text-[10px] text-amber-400 bg-amber-950/70 border border-amber-700/70 px-1.5 py-0.2 rounded font-medium" title="${status.count} overlaps remain (${status.totalAreaHa.toFixed(3)} Ha)">⏳ ${status.count} Left</span>`;
                } else {
                  return `<span class="text-[10px] text-rose-400 bg-rose-950/70 border border-rose-700/70 px-1.5 py-0.2 rounded font-medium" title="${status.count} overlaps (${status.totalAreaHa.toFixed(3)} Ha)">⚠️ ${status.count} Overlaps</span>`;
                }
              }
            })()}
          </div>

          <!-- Style Switcher (Solid vs No Brush Outline) -->
          <div class="flex items-center gap-1">
            <button class="btn-toggle-fill px-1.5 py-0.5 rounded text-[10px] font-medium border transition ${isOutline ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-emerald-950 text-emerald-300 border-emerald-700'}" data-id="${feat.id}" title="Toggle Solid Fill or No-Brush Outline">
              <i class="fa-solid ${isOutline ? 'fa-border-all' : 'fa-fill-drip'} mr-1"></i> ${isOutline ? 'Outline' : 'Solid'}
            </button>
            <button class="btn-delete-feature text-slate-500 hover:text-rose-400 p-1 transition" title="Remove" data-id="${feat.id}">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      `;

      listContainer.appendChild(card);
    });

    // Attach dynamic card listeners
    listContainer.querySelectorAll('.feature-manual-area-input').forEach(inp => {
      const saveManualArea = () => {
        const feat = this.features.find(f => f.id === inp.dataset.id);
        if (feat) {
          const raw = inp.value.trim();
          const val = parseFloat(raw);
          if (raw !== '' && !isNaN(val) && val >= 0) {
            feat.manualAreaHa = val;
          } else {
            delete feat.manualAreaHa;
          }
          this.onStateChanged();
        }
      };

      inp.addEventListener('change', saveManualArea);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inp.blur();
      });
      inp.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        inp.select();
      });
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('contextmenu', (e) => e.stopPropagation());
    });

    listContainer.querySelectorAll('.btn-toggle-type').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const feat = this.features.find(f => f.id === id);
        if (feat) {
          feat.type = feat.type === 'RF' ? 'RL' : 'RF';
          this.onStateChanged();
          this.showNotification(`Switched ${feat.name} to ${feat.type}`, "info");
        }
      });
    });

    listContainer.querySelectorAll('.feature-vis-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const feat = this.features.find(f => f.id === e.target.dataset.id);
        if (feat) {
          feat.visible = e.target.checked;
          this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
        }
      });
    });

    // Open Color & Slider Studio on swatch click
    listContainer.querySelectorAll('.btn-open-studio').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        this.openColorStudio(id);
      });
    });

    listContainer.querySelectorAll('.feature-name-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const feat = this.features.find(f => f.id === e.target.dataset.id);
        if (feat) {
          feat.name = e.target.value;
          this.onStateChanged();
        }
      });
    });

    listContainer.querySelectorAll('.btn-zoom-feature').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id || btn.closest('button').dataset.id;
        this.highlightFeature(id);
      });
    });

    listContainer.querySelectorAll('.btn-toggle-fill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id || btn.closest('button').dataset.id;
        const feat = this.features.find(f => f.id === id);
        if (feat) {
          feat.fillStyle = feat.fillStyle === 'outline' ? 'solid' : 'outline';
          this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
          this.renderFeatureList();
        }
      });
    });

    listContainer.querySelectorAll('.btn-delete-feature').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id || btn.closest('button').dataset.id;
        this.features = this.features.filter(f => f.id !== id);
        this.onStateChanged();
        this.showNotification("Removed boundary feature", "info");
      });
    });
  }

  highlightFeature(featureId) {
    this.viewerMap.zoomToFeature(featureId);
    // Highlight card in list
    document.querySelectorAll('#feature-list-container > div').forEach(c => {
      if (c.dataset.id === featureId) {
        c.classList.add('ring-2', 'ring-emerald-500');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove('ring-2', 'ring-emerald-500');
      }
    });
  }

  updateOverlapSortUI() {
    const isMaxToMin = (this.overlapSortOrder !== 'min-to-max');
    const select = document.getElementById('select-overlap-sort');
    if (select) select.value = isMaxToMin ? 'max-to-min' : 'min-to-max';

    const icon = document.getElementById('icon-sort-overlap-area');
    if (icon) {
      icon.className = isMaxToMin 
        ? 'fa-solid fa-arrow-down-wide-short text-emerald-400 text-xs group-hover:scale-110 transition' 
        : 'fa-solid fa-arrow-up-wide-short text-amber-400 text-xs group-hover:scale-110 transition';
    }
  }

  renderOverlapTable() {
    const tableBody = document.getElementById('overlap-table-body');
    const noOverlapMsg = document.getElementById('no-overlap-message');
    const overlapCountBadge = document.getElementById('overlap-count-badge');

    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    if (overlapCountBadge) {
      const rejectedCount = this.rejectedOverlaps ? this.rejectedOverlaps.length : 0;
      overlapCountBadge.innerText = `${this.overlaps.length} Overlap(s)${rejectedCount > 0 ? ` (${rejectedCount} in Rejected Folder)` : ''}`;
    }

    if (this.overlaps.length === 0) {
      if (noOverlapMsg) noOverlapMsg.classList.remove('hidden');
      return;
    }

    if (noOverlapMsg) noOverlapMsg.classList.add('hidden');

    // Filter/Sort overlaps by overlapArea (Default: Max to Min as requested)
    const sortedOverlaps = [...this.overlaps];
    const sortOrder = this.overlapSortOrder || 'max-to-min';

    sortedOverlaps.sort((a, b) => {
      const areaA = (a.overlapArea && typeof a.overlapArea.sqm === 'number') ? a.overlapArea.sqm : 0;
      const areaB = (b.overlapArea && typeof b.overlapArea.sqm === 'number') ? b.overlapArea.sqm : 0;
      if (sortOrder === 'min-to-max') {
        return areaA - areaB;
      }
      return areaB - areaA; // max-to-min (highest first)
    });

    sortedOverlaps.forEach((ov, index) => {
      const row = document.createElement('tr');
      const ro = this.rejectedOverlaps ? this.rejectedOverlaps.find(r => r.id === ov.id) : null;
      const isRejected = !!ro;
      row.className = `border-b border-slate-800 hover:bg-slate-800/50 transition cursor-pointer text-xs ${isRejected ? 'bg-rose-950/20' : ''}`;

      const formattedArea = SpatialEngine.formatArea(ov.overlapArea, this.activeUnit);

      let rejectBadgeHtml = '';
      if (isRejected) {
        let rejectText = 'In Rejected';
        if (ro.rejectedTarget === 'A') {
          rejectText = `In Rejected: ${ro.featureAName}`;
        } else if (ro.rejectedTarget === 'B') {
          rejectText = `In Rejected: ${ro.featureBName}`;
        } else {
          rejectText = `In Rejected: Both`;
        }
        rejectBadgeHtml = `<span class="px-2 py-1 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1 w-fit" title="${rejectText}"><i class="fa-solid fa-folder-minus"></i> ${rejectText} (${formattedArea})</span>`;
      } else {
        rejectBadgeHtml = `<span class="font-mono font-bold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-1 rounded">${formattedArea}</span>`;
      }

      row.innerHTML = `
        <td class="py-3 px-3">
          <span class="font-mono text-slate-400">#${index + 1}</span>
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full" style="background-color: ${ov.featureAColor}"></span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ov.featureAType === 'RF' ? 'badge-rf' : 'badge-rl'}">${ov.featureAType}</span>
            <span class="font-semibold text-slate-100">${ov.featureAName}</span>
          </div>
          <div class="text-[10px] text-slate-400 ml-5 mt-0.5">${ov.percentOfA}% of feature area</div>
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full" style="background-color: ${ov.featureBColor}"></span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ov.featureBType === 'RF' ? 'badge-rf' : 'badge-rl'}">${ov.featureBType}</span>
            <span class="font-semibold text-slate-100">${ov.featureBName}</span>
          </div>
          <div class="text-[10px] text-slate-400 ml-5 mt-0.5">${ov.percentOfB}% of feature area</div>
        </td>
        <td class="py-3 px-3">
          ${rejectBadgeHtml}
        </td>
        <td class="py-3 px-3 text-right">
          ${isRejected
            ? `<button class="btn-restore-ov-row px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition flex items-center gap-1 ml-auto"><i class="fa-solid fa-rotate-left"></i> Restore</button>`
            : `<button class="btn-resolve-pair px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs transition shadow flex items-center gap-1.5 ml-auto" data-index="${index}"><i class="fa-solid fa-scissors"></i> Resolve Overlap</button>`
          }
        </td>
      `;

      // Clicking row zooms to overlap on map
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-resolve-pair') && !e.target.closest('.btn-restore-ov-row')) {
          const bounds = SpatialEngine.getBounds(ov.geometry);
          if (bounds) this.overlapMap.zoomToBounds(bounds);
        }
      });

      const btnResolve = row.querySelector('.btn-resolve-pair');
      if (btnResolve) {
        btnResolve.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openResolverForOverlap(ov);
        });
      }

      const btnRestore = row.querySelector('.btn-restore-ov-row');
      if (btnRestore) {
        btnRestore.addEventListener('click', (e) => {
          e.stopPropagation();
          this.rejectedOverlaps = this.rejectedOverlaps.filter(ro => ro.id !== ov.id);
          this.onStateChanged();
          this.showNotification(`Restored ${ov.featureAName} ⚔️ ${ov.featureBName} to active resolver`, "info");
        });
      }

      tableBody.appendChild(row);
    });
  }

  openResolverForOverlap(overlapRecord) {
    this.switchTab('resolver');
    this.resolver.loadOverlap(overlapRecord);
  }

  getFeatureOverlapStatus(featureId) {
    const activeOverlaps = this.overlaps.filter(ov => {
      if (ov.featureAId !== featureId && ov.featureBId !== featureId) return false;
      if (this.rejectedOverlaps && this.rejectedOverlaps.some(ro => ro.id === ov.id)) return false;
      return true;
    });
    const count = activeOverlaps.length;
    const totalAreaHa = activeOverlaps.reduce((sum, ov) => sum + (ov.overlapArea.ha || 0), 0);
    return {
      isClean: count === 0,
      count: count,
      totalAreaHa: totalAreaHa,
      overlaps: activeOverlaps
    };
  }

  renderExportTable() {
    const exportList = document.getElementById('export-features-list');
    if (!exportList) return;

    exportList.innerHTML = '';

    const rejectedIds = this.getRejectedFeatureIds();
    const cleanFeatures = this.features.filter(f => !rejectedIds.has(f.id));
    const activeUnrejectedOverlaps = this.overlaps.filter(ov => !this.rejectedOverlaps || !this.rejectedOverlaps.some(ro => ro.id === ov.id));
    const overlappingFeatures = cleanFeatures.filter(f => !this.getFeatureOverlapStatus(f.id).isClean);

    // Update Division Health Banner in Tab 4
    const bannerEl = document.getElementById('export-health-banner');
    if (bannerEl) {
      if (activeUnrejectedOverlaps.length === 0) {
        bannerEl.className = "mb-5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between";
        bannerEl.innerHTML = `
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <h4 class="text-sm font-bold text-emerald-300">100% Clean Boundaries!</h4>
              <p class="text-xs text-slate-400">All ${cleanFeatures.length} boundaries have 0.000 Ha overlap. Ready for batch export.</p>
            </div>
          </div>
          <span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-bold font-mono">
            0 Overlaps Remaining
          </span>
        `;
      } else {
        const sumOverlapHa = activeUnrejectedOverlaps.reduce((s, ov) => s + ov.overlapArea.ha, 0);
        bannerEl.className = "mb-5 p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3";
        bannerEl.innerHTML = `
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl animate-pulse">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h4 class="text-sm font-bold text-rose-300">${activeUnrejectedOverlaps.length} Overlap(s) Remaining (${sumOverlapHa.toFixed(3)} Ha)</h4>
              <p class="text-xs text-slate-400">${overlappingFeatures.length} boundary feature(s) still have conflicts. Please resolve them in Tab 3 or move them to the Rejected Folder.</p>
            </div>
          </div>
          <button id="btn-goto-resolver-from-export" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow flex items-center gap-1.5 flex-shrink-0">
            <i class="fa-solid fa-scissors"></i> Resolve Overlaps in Tab 3
          </button>
        `;
        const btnGoResolver = bannerEl.querySelector('#btn-goto-resolver-from-export');
        if (btnGoResolver) {
          btnGoResolver.addEventListener('click', () => {
            this.switchTab('resolver');
          });
        }
      }
    }

    if (cleanFeatures.length === 0) {
      exportList.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No clean boundaries loaded.</td></tr>`;
      return;
    }

    cleanFeatures.forEach((feat, index) => {
      const row = document.createElement('tr');
      row.className = "border-b border-slate-800 hover:bg-slate-800/40 text-xs";

      const origArea = feat.originalAreaHa || feat.areaHa;
      const currentArea = feat.areaHa;
      const diff = (currentArea - origArea).toFixed(3);
      const isChanged = Math.abs(diff) > 0.001;

      const status = this.getFeatureOverlapStatus(feat.id);
      let statusHtml = '';
      let actionHtml = '';

      if (status.isClean) {
        if (feat.isCorrected) {
          statusHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 w-fit"><i class="fa-solid fa-circle-check"></i> Resolved (100% Clean)</span>`;
        } else {
          statusHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 w-fit"><i class="fa-solid fa-check"></i> Clean (No Overlap)</span>`;
        }
        actionHtml = `
          <button class="btn-export-single px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-xs transition flex items-center gap-1 ml-auto" data-id="${feat.id}">
            <i class="fa-solid fa-download"></i> KML
          </button>
        `;
      } else {
        if (feat.isCorrected) {
          statusHtml = `
            <div class="flex flex-col gap-0.5">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1 w-fit">
                <i class="fa-solid fa-clock"></i> Partially Resolved (${status.count} left)
              </span>
              <span class="text-[10px] text-amber-400/80 font-mono pl-1">${status.totalAreaHa.toFixed(3)} Ha conflict</span>
            </div>
          `;
        } else {
          statusHtml = `
            <div class="flex flex-col gap-0.5">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1 w-fit">
                <i class="fa-solid fa-triangle-exclamation animate-pulse"></i> ${status.count} Overlap(s) Remaining
              </span>
              <span class="text-[10px] text-rose-400/80 font-mono pl-1">${status.totalAreaHa.toFixed(3)} Ha conflict</span>
            </div>
          `;
        }
        actionHtml = `
          <button class="btn-resolve-from-table px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded text-xs font-semibold transition flex items-center gap-1 ml-auto" data-id="${feat.id}">
            <i class="fa-solid fa-scissors"></i> Resolve in Tab 3
          </button>
        `;
      }

      const hasManualArea = feat.manualAreaHa !== undefined && feat.manualAreaHa !== null && !isNaN(feat.manualAreaHa) && feat.manualAreaHa > 0;
      let varianceHtml = '<span class="text-slate-600 font-sans italic text-[11px]">—</span>';
      if (hasManualArea) {
        const diff = currentArea - feat.manualAreaHa;
        const absDiff = Math.abs(diff);
        const pct = (absDiff / feat.manualAreaHa) * 100;
        const isMatch = absDiff <= 0.05;
        varianceHtml = `
          <div class="flex items-center gap-1.5 font-mono">
            <span class="font-semibold ${isMatch ? 'text-emerald-400' : 'text-amber-400'}">
              ${diff >= 0 ? '+' : ''}${diff.toFixed(3)} Ha
            </span>
            <span class="text-[10px] text-slate-400">(${pct.toFixed(2)}%)</span>
          </div>
        `;
      }

      row.innerHTML = `
        <td class="py-3 px-4">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full" style="background-color: ${feat.color}"></span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${feat.type === 'RF' ? 'badge-rf' : 'badge-rl'}">${feat.type}</span>
            <span class="font-semibold text-slate-100">${feat.name}</span>
          </div>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-1 bg-slate-900 border border-slate-700 hover:border-cyan-500 focus-within:border-cyan-400 rounded px-2 py-1 w-28 shadow-inner" title="Click or double-click to type Index area in Ha">
            <input type="number" step="any" placeholder="0.000" class="export-manual-area-input bg-transparent text-cyan-300 font-mono text-xs font-bold outline-none w-full placeholder-slate-600 focus:text-white" value="${feat.manualAreaHa !== undefined && feat.manualAreaHa !== null ? feat.manualAreaHa : ''}" data-id="${feat.id}">
            <span class="text-[10px] text-slate-400 font-mono">Ha</span>
          </div>
        </td>
        <td class="py-3 px-4 font-mono font-semibold ${isChanged ? 'text-emerald-400' : 'text-slate-100'}">
          ${currentArea.toFixed(3)} Ha
        </td>
        <td class="py-3 px-4">
          ${varianceHtml}
        </td>
        <td class="py-3 px-4">
          ${statusHtml}
        </td>
        <td class="py-3 px-4 text-right">
          ${actionHtml}
        </td>
      `;

      const inpManual = row.querySelector('.export-manual-area-input');
      if (inpManual) {
        const saveExportManual = () => {
          const raw = inpManual.value.trim();
          const val = parseFloat(raw);
          if (raw !== '' && !isNaN(val) && val >= 0) {
            feat.manualAreaHa = val;
          } else {
            delete feat.manualAreaHa;
          }
          this.onStateChanged();
        };
        inpManual.addEventListener('change', saveExportManual);
        inpManual.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') inpManual.blur();
        });
        inpManual.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          inpManual.select();
        });
        inpManual.addEventListener('click', (e) => e.stopPropagation());
      }

      const btnExport = row.querySelector('.btn-export-single');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          KMLExporter.exportSingleFeature(feat);
          this.showNotification(`Exported ${feat.name} to KML`, "success");
        });
      }

      const btnResolve = row.querySelector('.btn-resolve-from-table');
      if (btnResolve) {
        btnResolve.addEventListener('click', () => {
          const targetOverlap = this.overlaps.find(ov => ov.featureAId === feat.id || ov.featureBId === feat.id);
          if (targetOverlap) {
            this.openResolverForOverlap(targetOverlap);
          } else {
            this.switchTab('resolver');
          }
        });
      }

      exportList.appendChild(row);
    });

    // Render Rejected / Disputed Boundaries Folder Section in Tab 4
    const rejectedSection = document.getElementById('rejected-folder-section');
    const rejectedList = document.getElementById('rejected-features-list');
    const rejectedBadge = document.getElementById('rejected-count-badge');
    const btnExportRejectedAll = document.getElementById('btn-export-rejected-all');

    if (rejectedSection && rejectedList) {
      if (this.rejectedOverlaps && this.rejectedOverlaps.length > 0) {
        rejectedSection.classList.remove('hidden');
        if (rejectedBadge) rejectedBadge.innerText = `${this.rejectedOverlaps.length} Conflict(s)`;
        rejectedList.innerHTML = '';

        this.rejectedOverlaps.forEach((ro) => {
          const featA = this.features.find(f => f.id === ro.featureAId);
          const featB = this.features.find(f => f.id === ro.featureBId);
          const rRow = document.createElement('tr');
          rRow.className = "border-b border-slate-800 hover:bg-slate-800/40 text-xs";

          let decisionHtml = '';
          if (ro.rejectedTarget === 'A') {
            decisionHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">Rejected: ${ro.featureAName}</span> <span class="text-[10px] text-emerald-400 ml-1 font-semibold">(Kept: ${ro.featureBName})</span>`;
          } else if (ro.rejectedTarget === 'B') {
            decisionHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">Rejected: ${ro.featureBName}</span> <span class="text-[10px] text-emerald-400 ml-1 font-semibold">(Kept: ${ro.featureAName})</span>`;
          } else {
            decisionHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">Both Boundaries Rejected</span>`;
          }

          rRow.innerHTML = `
            <td class="py-2.5 px-3">
              <div class="font-semibold text-slate-200">${ro.featureAName} <span class="text-rose-400">⚔️</span> ${ro.featureBName}</div>
              <div class="mt-1">${decisionHtml}</div>
            </td>
            <td class="py-2.5 px-3 font-mono text-slate-300">${ro.areaHaA ? ro.areaHaA.toFixed(3) : '0.000'} Ha</td>
            <td class="py-2.5 px-3 font-mono text-slate-300">${ro.areaHaB ? ro.areaHaB.toFixed(3) : '0.000'} Ha</td>
            <td class="py-2.5 px-3 font-mono text-rose-400 font-bold">${ro.overlapAreaHa ? ro.overlapAreaHa.toFixed(3) : '0.000'} Ha</td>
            <td class="py-2.5 px-3 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button class="btn-export-rejected-pair px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition" title="Export this item">
                  <i class="fa-solid fa-download mr-1"></i> Download KML
                </button>
                <button class="btn-restore-rejected-folder px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-xs transition" title="Restore to active resolver">
                  <i class="fa-solid fa-rotate-left mr-1"></i> Restore
                </button>
              </div>
            </td>
          `;

          // Single / Pair export
          rRow.querySelector('.btn-export-rejected-pair').addEventListener('click', () => {
            if (ro.rejectedTarget === 'A' && featA) {
              KMLExporter.exportSingleFeature(featA);
              this.showNotification(`Exported rejected boundary "${featA.name}" to KML`, "success");
            } else if (ro.rejectedTarget === 'B' && featB) {
              KMLExporter.exportSingleFeature(featB);
              this.showNotification(`Exported rejected boundary "${featB.name}" to KML`, "success");
            } else if (featA && featB) {
              KMLExporter.exportMultipleFeatures([featA, featB], `Rejected_${featA.name}_vs_${featB.name}`);
              this.showNotification(`Exported disputed pair to KML`, "success");
            }
          });

          // Restore from rejected
          rRow.querySelector('.btn-restore-rejected-folder').addEventListener('click', () => {
            this.rejectedOverlaps = this.rejectedOverlaps.filter(item => item.id !== ro.id);
            this.onStateChanged();
            this.showNotification(`Restored "${ro.featureAName} ⚔️ ${ro.featureBName}" to active resolver`, "info");
          });

          rejectedList.appendChild(rRow);
        });

        if (btnExportRejectedAll) {
          btnExportRejectedAll.onclick = () => {
            const rejectedFeatIds = this.getRejectedFeatureIds();
            const featsToExport = this.features.filter(f => rejectedFeatIds.has(f.id));
            if (featsToExport.length > 0) {
              const baseName = this.divisionName || 'KML_Boundaries';
              KMLExporter.exportMultipleFeatures(featsToExport, `${baseName}_Rejected`);
              this.showNotification(`Exported ${featsToExport.length} rejected boundaries to KML`, "success");
            }
          };
        }
      } else {
        rejectedSection.classList.add('hidden');
      }
    }
  }

  showNotification(message, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${
      type === 'success' ? 'bg-emerald-900 border border-emerald-500 text-emerald-100' :
      type === 'error' ? 'bg-rose-900 border border-rose-500 text-rose-100' :
      'bg-slate-900 border border-slate-600 text-slate-100'
    }`;

    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' :
                 type === 'error' ? 'fa-circle-exclamation text-rose-400' :
                 'fa-circle-info text-cyan-400';

    toast.innerHTML = `
      <i class="fa-solid ${icon} text-lg"></i>
      <div class="flex-1">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ==========================================
  // COLOR & STYLE STUDIO (DRAG & SLIDE ENGINE)
  // ==========================================

  openColorStudio(featureId) {
    this.editingFeatureId = featureId;
    const feat = this.features.find(f => f.id === featureId);
    if (!feat) return;

    const modal = document.getElementById('color-studio-modal');
    const titleEl = document.getElementById('studio-feature-title');
    const previewCircle = document.getElementById('studio-preview-circle');
    const hueSlider = document.getElementById('studio-hue-slider');
    const hueVal = document.getElementById('studio-hue-val');
    const opacitySlider = document.getElementById('studio-opacity-slider');
    const opacityVal = document.getElementById('studio-opacity-val');
    const strokeSlider = document.getElementById('studio-stroke-slider');
    const strokeVal = document.getElementById('studio-stroke-val');
    const hexInput = document.getElementById('studio-hex-input');
    const nativePicker = document.getElementById('studio-native-color');
    const swatchesGrid = document.getElementById('studio-swatches-grid');

    if (titleEl) {
      titleEl.innerHTML = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${feat.type === 'RF' ? 'badge-rf' : 'badge-rl'}">${feat.type}</span> ${feat.name}`;
    }

    const color = feat.color || '#22c55e';
    const opacity = feat.fillOpacity !== undefined ? Math.round(feat.fillOpacity * 100) : 45;
    const stroke = feat.strokeWidth || 2.5;
    const isSolid = feat.fillStyle !== 'outline';

    if (previewCircle) previewCircle.style.backgroundColor = color;
    if (hexInput) hexInput.value = color;
    if (nativePicker) nativePicker.value = color;
    if (opacitySlider) opacitySlider.value = opacity;
    if (opacityVal) opacityVal.innerText = `${opacity}%`;
    if (strokeSlider) strokeSlider.value = stroke;
    if (strokeVal) strokeVal.innerText = `${stroke} px`;

    // Calculate and set rainbow hue
    const hue = this.hexToHue(color);
    if (hueSlider) hueSlider.value = hue;
    if (hueVal) hueVal.innerText = `${hue}°`;

    this.updateStudioModeButtons(isSolid);

    // Populate 40+ Swatches Grid
    if (swatchesGrid) {
      swatchesGrid.innerHTML = '';
      KMLParser.PALETTE.forEach(palColor => {
        const swatch = document.createElement('button');
        swatch.className = `swatch-btn ${palColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}`;
        swatch.style.backgroundColor = palColor;
        swatch.title = palColor;
        swatch.addEventListener('click', () => {
          this.applyStudioColor(palColor);
          swatchesGrid.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
          swatch.classList.add('active');
        });
        swatchesGrid.appendChild(swatch);
      });
    }

    if (modal) modal.classList.remove('hidden');
  }

  updateStudioModeButtons(isSolid) {
    const btnSolid = document.getElementById('studio-btn-solid');
    const btnOutline = document.getElementById('studio-btn-outline');
    if (btnSolid && btnOutline) {
      if (isSolid) {
        btnSolid.className = "px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white shadow";
        btnOutline.className = "px-2.5 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white";
      } else {
        btnSolid.className = "px-2.5 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white";
        btnOutline.className = "px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white shadow";
      }
    }
  }

  applyStudioColor(newColor) {
    if (!this.editingFeatureId) return;
    const feat = this.features.find(f => f.id === this.editingFeatureId);
    if (!feat) return;

    feat.color = newColor;

    const previewCircle = document.getElementById('studio-preview-circle');
    const hexInput = document.getElementById('studio-hex-input');
    const nativePicker = document.getElementById('studio-native-color');
    const hueSlider = document.getElementById('studio-hue-slider');
    const hueVal = document.getElementById('studio-hue-val');

    if (previewCircle) previewCircle.style.backgroundColor = newColor;
    if (hexInput) hexInput.value = newColor;
    if (nativePicker) nativePicker.value = newColor;

    const hue = this.hexToHue(newColor);
    if (hueSlider) hueSlider.value = hue;
    if (hueVal) hueVal.innerText = `${hue}°`;

    // Live update map & feature list in real time
    this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
    this.overlapMap.renderFeatures(this.features);
    this.renderFeatureList();
  }

  bindColorStudioEvents() {
    const modal = document.getElementById('color-studio-modal');
    const btnClose = document.getElementById('btn-close-studio');
    const btnDone = document.getElementById('btn-studio-done');
    const hueSlider = document.getElementById('studio-hue-slider');
    const opacitySlider = document.getElementById('studio-opacity-slider');
    const strokeSlider = document.getElementById('studio-stroke-slider');
    const nativePicker = document.getElementById('studio-native-color');
    const hexInput = document.getElementById('studio-hex-input');
    const btnSolid = document.getElementById('studio-btn-solid');
    const btnOutline = document.getElementById('studio-btn-outline');

    const closeModal = () => {
      if (modal) modal.classList.add('hidden');
      this.editingFeatureId = null;
      this.onStateChanged();
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnDone) btnDone.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Rainbow Hue Slider Drag Event (Live Real-Time update on drag!)
    if (hueSlider) {
      hueSlider.addEventListener('input', (e) => {
        const hue = parseInt(e.target.value);
        const hueVal = document.getElementById('studio-hue-val');
        if (hueVal) hueVal.innerText = `${hue}°`;

        const hex = this.hslToHex(hue, 85, 48);
        this.applyStudioColor(hex);
      });
    }

    // Opacity Slider Drag Event (Live Real-Time update on drag!)
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        if (!this.editingFeatureId) return;
        const feat = this.features.find(f => f.id === this.editingFeatureId);
        if (!feat) return;

        const val = parseInt(e.target.value);
        const opacityVal = document.getElementById('studio-opacity-val');
        if (opacityVal) opacityVal.innerText = `${val}%`;

        feat.fillOpacity = val / 100;
        this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
      });
    }

    // Stroke Width Slider Drag Event (Live Real-Time update on drag!)
    if (strokeSlider) {
      strokeSlider.addEventListener('input', (e) => {
        if (!this.editingFeatureId) return;
        const feat = this.features.find(f => f.id === this.editingFeatureId);
        if (!feat) return;

        const val = parseFloat(e.target.value);
        const strokeVal = document.getElementById('studio-stroke-val');
        if (strokeVal) strokeVal.innerText = `${val} px`;

        feat.strokeWidth = val;
        this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
      });
    }

    // Solid Mode Button
    if (btnSolid) {
      btnSolid.addEventListener('click', () => {
        if (!this.editingFeatureId) return;
        const feat = this.features.find(f => f.id === this.editingFeatureId);
        if (feat) {
          feat.fillStyle = 'solid';
          this.updateStudioModeButtons(true);
          this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
          this.renderFeatureList();
        }
      });
    }

    // Outline Mode Button
    if (btnOutline) {
      btnOutline.addEventListener('click', () => {
        if (!this.editingFeatureId) return;
        const feat = this.features.find(f => f.id === this.editingFeatureId);
        if (feat) {
          feat.fillStyle = 'outline';
          this.updateStudioModeButtons(false);
          this.viewerMap.renderFeatures(this.features, (f) => this.highlightFeature(f.id));
          this.renderFeatureList();
        }
      });
    }

    // Native Color Picker & Hex Input
    if (nativePicker) {
      nativePicker.addEventListener('input', (e) => {
        this.applyStudioColor(e.target.value);
      });
    }
    if (hexInput) {
      hexInput.addEventListener('change', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
          this.applyStudioColor(val);
        }
      });
    }
  }

  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  hexToHue(hex) {
    if (!hex) return 140;
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (clean.length !== 6) return 140;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return Math.round(h * 360);
  }
}

// Instantiate App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DivisionKmlApp();
});
