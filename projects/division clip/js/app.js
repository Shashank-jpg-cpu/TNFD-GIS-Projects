/**
 * Main Application Controller for Division Extractor & QGIS-Matching Raster Clip Web App
 */

document.addEventListener("DOMContentLoaded", function() {
    // Application State
    const AppState = {
        currentStep: 1,
        rawAdminData: null,
        adminData: null,
        adminFilename: "",
        divisionField: "DN_NAME",
        rasterData: null,
        rasterFilename: "",
        rasterColormap: "forest_types",
        rasterOpacity: 0.92,
        extractedDivisions: [],
        selectedDivision: null,
        isProcessing: false
    };

    // Initialize Leaflet Map
    MapManager.init("map");

    // UI Elements
    const elements = {
        step1Indicator: document.getElementById("step1-indicator"),
        step2Indicator: document.getElementById("step2-indicator"),
        step3Indicator: document.getElementById("step3-indicator"),
        step4Indicator: document.getElementById("step4-indicator"),

        step1Panel: document.getElementById("step1-panel"),
        step2Panel: document.getElementById("step2-panel"),
        step3Panel: document.getElementById("step3-panel"),
        step4Panel: document.getElementById("step4-panel"),

        adminFileInput: document.getElementById("admin-file-input"),
        adminDropzone: document.getElementById("admin-dropzone"),
        adminFileStatus: document.getElementById("admin-file-status"),
        adminFilenameDisplay: document.getElementById("admin-filename-display"),
        adminFieldSelect: document.getElementById("admin-field-select"),
        adminFieldContainer: document.getElementById("admin-field-container"),
        adminDivisionCountHint: document.getElementById("admin-division-count-hint"),
        btnLoadAdminSample: document.getElementById("btn-load-admin-sample"),
        btnProceedToStep2: document.getElementById("btn-proceed-step2"),

        secondaryFileInput: document.getElementById("secondary-file-input"),
        secondaryDropzone: document.getElementById("secondary-dropzone"),
        secondaryFileStatus: document.getElementById("secondary-file-status"),
        secondaryFilenameDisplay: document.getElementById("secondary-filename-display"),
        btnLoadSecondarySample: document.getElementById("btn-load-secondary-sample"),
        btnLoadLulcSample: document.getElementById("btn-load-lulc-sample"),
        btnLoadFcmSample: document.getElementById("btn-load-fcm-sample"),
        btnDownloadSampleImg: document.getElementById("btn-download-sample-img"),
        rasterColormapSelect: document.getElementById("raster-colormap-select"),
        rasterOpacitySlider: document.getElementById("raster-opacity-slider"),
        rasterOpacityVal: document.getElementById("raster-opacity-val"),
        btnProceedToStep3: document.getElementById("btn-proceed-step3"),

        btnExtractDivisions: document.getElementById("btn-extract-divisions"),
        btnExtractLabel: document.getElementById("btn-extract-label"),
        extractProgressContainer: document.getElementById("extract-progress-container"),
        extractProgressBar: document.getElementById("extract-progress-bar"),
        extractProgressText: document.getElementById("extract-progress-text"),

        divisionsGrid: document.getElementById("divisions-grid"),
        divisionCountBadge: document.getElementById("division-count-badge"),
        btnDownloadAllZip: document.getElementById("btn-download-all-zip"),
        btnResetWorkflow: document.getElementById("btn-reset-workflow"),
        searchInput: document.getElementById("division-search-input"),

        basemapSelect: document.getElementById("basemap-select"),

        modalInspector: document.getElementById("modal-inspector"),
        modalClose: document.getElementById("modal-close"),
        modalTitle: document.getElementById("modal-title"),
        modalStats: document.getElementById("modal-stats"),
        modalMapCanvasContainer: document.getElementById("modal-map-container"),
        modalFeaturesTable: document.getElementById("modal-features-table"),
        modalBtnJpg: document.getElementById("modal-btn-jpg"),
        modalBtnPdf: document.getElementById("modal-btn-pdf"),

        toastContainer: document.getElementById("toast-container"),
        btnQuickDemoAll: document.getElementById("btn-quick-demo-all")
    };

    /* ==========================================================================
       0. MOBILE VIEW & COLLAPSIBLE GALLERY CONTROLS
       ========================================================================== */
    const tabBtnMap = document.getElementById("tab-btn-map");
    const tabBtnSteps = document.getElementById("tab-btn-steps");
    const mobileStepBadge = document.getElementById("mobile-step-badge");

    function setMobileView(view) {
        if (view === "map") {
            document.body.classList.remove("mobile-view-steps");
            document.body.classList.add("mobile-view-map");
            if (tabBtnMap) {
                tabBtnMap.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow";
            }
            if (tabBtnSteps) {
                tabBtnSteps.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300";
            }
            setTimeout(() => {
                if (MapManager.map) MapManager.map.invalidateSize();
            }, 180);
        } else {
            document.body.classList.remove("mobile-view-map");
            document.body.classList.add("mobile-view-steps");
            if (tabBtnSteps) {
                tabBtnSteps.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow";
            }
            if (tabBtnMap) {
                tabBtnMap.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300";
            }
        }
    }

    if (tabBtnMap) tabBtnMap.addEventListener("click", () => setMobileView("map"));
    if (tabBtnSteps) tabBtnSteps.addEventListener("click", () => setMobileView("steps"));

    const galleryContainer = document.getElementById("extracted-gallery-container");
    const galleryHeaderBar = document.getElementById("gallery-header-bar");
    const btnToggleGallery = document.getElementById("btn-toggle-gallery");
    const galleryToggleText = document.getElementById("gallery-toggle-text");
    const galleryToggleIcon = document.getElementById("gallery-toggle-icon");

    function toggleGallery(forceExpand = null) {
        if (!galleryContainer) return;
        const shouldExpand = forceExpand !== null ? forceExpand : galleryContainer.classList.contains("gallery-collapsed");
        if (shouldExpand) {
            galleryContainer.classList.remove("gallery-collapsed");
            galleryContainer.classList.add("gallery-expanded");
            if (galleryToggleText) galleryToggleText.textContent = "▼ Minimize";
            if (galleryToggleIcon) {
                galleryToggleIcon.classList.remove("fa-chevron-up");
                galleryToggleIcon.classList.add("fa-chevron-down");
            }
        } else {
            galleryContainer.classList.remove("gallery-expanded");
            galleryContainer.classList.add("gallery-collapsed");
            if (galleryToggleText) galleryToggleText.textContent = "▲ Raise Up";
            if (galleryToggleIcon) {
                galleryToggleIcon.classList.remove("fa-chevron-down");
                galleryToggleIcon.classList.add("fa-chevron-up");
            }
        }
        setTimeout(() => {
            if (MapManager.map) MapManager.map.invalidateSize();
        }, 320);
    }

    if (galleryHeaderBar) {
        galleryHeaderBar.addEventListener("click", () => toggleGallery());
    }
    if (btnToggleGallery) {
        btnToggleGallery.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleGallery();
        });
    }

    /* ==========================================================================
       1. EVENT LISTENERS
       ========================================================================== */

    if (elements.basemapSelect) {
        elements.basemapSelect.addEventListener("change", function(e) {
            MapManager.setBasemap(e.target.value);
        });
    }

    setupDropzone(elements.adminDropzone, elements.adminFileInput, handleAdminFile);
    elements.adminFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleAdminFile(e.target.files[0]);
    });

    elements.btnLoadAdminSample.addEventListener("click", () => {
        const sampleAdmin = SampleData.getAdminLayer();
        loadAdminGeoJSON(sampleAdmin, "Division_Shape_File.zip");
        showToast("Loaded Tamil Nadu Administrative Divisions (46 Divisions)", "success");
        setMobileView("map");
    });

    elements.adminFieldSelect.addEventListener("change", (e) => {
        AppState.divisionField = e.target.value;
        if (AppState.rawAdminData) {
            applyDivisionGrouping();
        }
    });

    elements.btnProceedToStep2.addEventListener("click", () => {
        goToStep(2);
    });

    setupDropzone(elements.secondaryDropzone, elements.secondaryFileInput, handleRasterFile);
    elements.secondaryFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleRasterFile(e.target.files[0]);
    });

    elements.btnLoadSecondarySample.addEventListener("click", async () => {
        showToast("Loading Tamil Nadu Forest Type 2023 (FTM)...", "info");
        const ftmData = await FileParser.loadQgisMasterRaster("tamil_nadu_forest_type_layer.png", "Tamil_nadu_forest_type_2023.img", "Forest Type Map - 2023 (FTM)", AppState.adminData);
        loadRasterData(ftmData, "Tamil_nadu_forest_type_2023.img");
        showToast("Loaded Tamil Nadu Forest Type 2023 Raster Layer", "success");
    });

    if (elements.btnLoadFcmSample) {
        elements.btnLoadFcmSample.addEventListener("click", async () => {
            showToast("Loading Tamil Nadu Forest Cover 2023 (FCM)...", "info");
            const fcmData = await FileParser.loadQgisMasterFcmRaster("tamil_nadu_forest_cover_2023.img", "Forest Cover Map - 2023 (FCM)", AppState.adminData);
            loadRasterData(fcmData, "tamil_nadu_forest_cover_2023.img");
            showToast("Loaded Tamil Nadu Forest Cover 2023 (6 Classes)!", "success");
        });
    }

    if (elements.btnLoadLulcSample) {
        elements.btnLoadLulcSample.addEventListener("click", async () => {
            showToast("Loading LULC 2024 (desc3 Classified Layer)...", "info");
            const lulcData = await FileParser.loadQgisMasterLulcRaster("lulc_sisdp.shp", "LULC 2024 (desc3 Classified Layer)", AppState.adminData);
            loadRasterData(lulcData, "LULC_SISDP_2024.shp");
            showToast("Loaded LULC 2024 with all desc3 classification categories!", "success");
        });
    }

    if (elements.btnDownloadSampleImg) {
        elements.btnDownloadSampleImg.addEventListener("click", () => {
            showToast("Generating sample Disc Image File (.img)...", "info");
            const blob = SampleData.generateSampleImgBlob();
            saveAs(blob, "elevation_sample_dataset.img");
            showToast("Sample .img downloaded!", "success");
        });
    }

    if (elements.rasterOpacitySlider) {
        elements.rasterOpacitySlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            AppState.rasterOpacity = val / 100;
            elements.rasterOpacityVal.textContent = `${val}%`;
            MapManager.setRasterOpacity(AppState.rasterOpacity);
        });
    }

    elements.btnProceedToStep3.addEventListener("click", () => {
        goToStep(3);
    });

    elements.btnExtractDivisions.addEventListener("click", runDivisionExtraction);

    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterDivisionCards(query);
        });
    }

    elements.btnDownloadAllZip.addEventListener("click", async () => {
        if (AppState.extractedDivisions.length === 0) return;
        try {
            showToast("Packaging all 46 division maps, PDF reports, and raster clips into ZIP...", "info");
            elements.btnDownloadAllZip.disabled = true;
            elements.btnDownloadAllZip.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating ZIP...`;

            await ExportManager.downloadAllAsZip(AppState.extractedDivisions, (percent, curr, total, name) => {
                elements.btnDownloadAllZip.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Packing ${curr}/${total} (${percent}%)`;
            });

            showToast("All division maps ZIP successfully downloaded!", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to generate ZIP: " + err.message, "error");
        } finally {
            elements.btnDownloadAllZip.disabled = false;
            elements.btnDownloadAllZip.innerHTML = `<i class="fa-solid fa-file-zipper mr-2"></i> Download All as ZIP (PDF, JPG & Rasters)`;
        }
    });

    elements.btnResetWorkflow.addEventListener("click", resetApp);

    elements.modalClose.addEventListener("click", closeModal);
    elements.modalInspector.addEventListener("click", (e) => {
        if (e.target === elements.modalInspector) closeModal();
    });

    elements.modalBtnJpg.addEventListener("click", () => {
        if (AppState.selectedDivision) {
            ExportManager.downloadDivisionJPG(AppState.selectedDivision);
            showToast(`Downloading JPG map for ${AppState.selectedDivision.name}`, "success");
        }
    });

    elements.modalBtnPdf.addEventListener("click", () => {
        if (AppState.selectedDivision) {
            ExportManager.downloadDivisionPDF(AppState.selectedDivision);
            showToast(`Downloading PDF report for ${AppState.selectedDivision.name}`, "success");
        }
    });

    if (elements.btnQuickDemoAll) {
        elements.btnQuickDemoAll.addEventListener("click", async () => {
            resetApp();
            showToast("Loading Full Workflow (46 Divisions + Tamil Nadu Forest Types)...", "info");
            
            const sampleAdmin = SampleData.getAdminLayer();
            loadAdminGeoJSON(sampleAdmin, "Division_Shape_File.zip");

            const sampleRaster = await FileParser.loadQgisMasterRaster("tamil_nadu_forest_type_layer.png", "Tamil_nadu_forest_type_2023.img", "Forest Type Map - 2023 (FTM)", AppState.adminData);
            loadRasterData(sampleRaster, "Tamil_nadu_forest_type_2023.img");

            goToStep(3);
            setTimeout(() => {
                runDivisionExtraction();
            }, 600);
        });
    }

    /* ==========================================================================
       2. FILE HANDLERS
       ========================================================================== */

    async function handleAdminFile(file) {
        try {
            showToast(`Parsing ${file.name}...`, "info");
            const parsed = await FileParser.parseVectorFile(file);
            loadAdminGeoJSON(parsed.geojson, parsed.filename);
        } catch (err) {
            console.error(err);
            showToast(err.message || "Failed to parse admin layer file", "error");
        }
    }

    function loadAdminGeoJSON(geojson, filename) {
        AppState.rawAdminData = geojson;
        AppState.adminFilename = filename;

        const fields = FileParser.getPropertyFields(geojson);
        const guessedField = FileParser.guessDivisionField(fields) || "DN_NAME";
        AppState.divisionField = guessedField;

        elements.adminFieldSelect.innerHTML = "";
        if (fields.length > 0) {
            fields.forEach(f => {
                const opt = document.createElement("option");
                opt.value = f;
                opt.textContent = f;
                if (f.toUpperCase() === "DN_NAME" || f === guessedField) opt.selected = true;
                elements.adminFieldSelect.appendChild(opt);
            });
            elements.adminFieldContainer.classList.remove("hidden-custom");
        } else {
            elements.adminFieldContainer.classList.add("hidden-custom");
        }

        applyDivisionGrouping();

        elements.adminFilenameDisplay.textContent = filename;
        elements.adminFileStatus.classList.remove("hidden-custom");
        elements.btnProceedToStep2.disabled = false;
        elements.btnProceedToStep2.classList.remove("opacity-50", "cursor-not-allowed");
    }

    function applyDivisionGrouping() {
        if (!AppState.rawAdminData) return;

        const grouped = FileParser.groupFeaturesByDivision(AppState.rawAdminData, AppState.divisionField);
        AppState.adminData = grouped;

        const uniqueCount = grouped.features.length;

        if (elements.adminDivisionCountHint) {
            elements.adminDivisionCountHint.innerHTML = `
                <i class="fa-solid fa-layer-group text-emerald-600 mr-1"></i>
                <span class="text-emerald-700 font-bold">${uniqueCount} Official Divisions Detected</span>
            `;
        }

        if (elements.btnExtractLabel) {
            elements.btnExtractLabel.textContent = `Extract ${uniqueCount} Divisions (2 on 1 Layer)`;
        }

        MapManager.displayAdminLayer(grouped, AppState.divisionField);
        showToast(`Loaded ${uniqueCount} Divisions!`, "success");
    }

    async function handleRasterFile(file) {
        try {
            showToast(`Reading Disc Image / Raster file ${file.name}...`, "info");
            const parsedRaster = await FileParser.parseRasterFile(file, AppState.adminData);
            loadRasterData(parsedRaster, parsedRaster.filename);
            showToast(`Successfully loaded ${parsedRaster.format} matching QGIS!`, "success");
        } catch (err) {
            console.error(err);
            showToast(err.message || "Failed to parse Disc Image / raster file", "error");
        }
    }

    function loadRasterData(rasterData, filename) {
        AppState.rasterData = rasterData;
        AppState.rasterFilename = filename;

        MapManager.displayRasterLayer(rasterData, AppState.rasterColormap, AppState.rasterOpacity);

        elements.secondaryFilenameDisplay.textContent = `${filename} (${rasterData.format || 'Disc Image File'} - ${rasterData.width}x${rasterData.height} px)`;
        elements.secondaryFileStatus.classList.remove("hidden-custom");
        elements.btnProceedToStep3.disabled = false;
        elements.btnProceedToStep3.classList.remove("opacity-50", "cursor-not-allowed");
    }

    /* ==========================================================================
       3. SPATIAL EXTRACTION WORKFLOW
       ========================================================================== */

    function runDivisionExtraction() {
        if (!AppState.adminData) {
            showToast("Please upload Administrative Layer (Layer 1) first.", "warning");
            return;
        }
        if (!AppState.rasterData) {
            showToast("Please upload Disc Image File / Raster (Layer 2). Both layers are compulsory!", "warning");
            return;
        }

        const divCount = AppState.adminData.features.length;
        AppState.isProcessing = true;
        elements.btnExtractDivisions.disabled = true;
        elements.btnExtractDivisions.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Extracting ${divCount} Divisions...`;
        elements.extractProgressContainer.classList.remove("hidden-custom");
        elements.extractProgressBar.style.width = "0%";
        elements.extractProgressText.textContent = `Clipping Forest Type maps for ${divCount} divisions...`;

        setTimeout(() => {
            try {
                const results = SpatialClipper.extractAllDivisions(
                    AppState.adminData,
                    AppState.rasterData,
                    AppState.divisionField,
                    AppState.rasterColormap,
                    (percent, current, total, divName) => {
                        elements.extractProgressBar.style.width = `${percent}%`;
                        elements.extractProgressText.textContent = `Clipping division ${current} of ${total}: ${divName}`;
                    }
                );

                AppState.extractedDivisions = results;

                setTimeout(() => {
                    renderDivisionCards(results);
                    goToStep(4);
                    showToast(`Successfully extracted all ${results.length} division map sheets!`, "success");
                    AppState.isProcessing = false;
                    elements.btnExtractDivisions.disabled = false;
                    elements.btnExtractDivisions.innerHTML = `<i class="fa-solid fa-scissors mr-2"></i> Extract ${results.length} Divisions (2 on 1 Layer)`;
                }, 400);

            } catch (err) {
                console.error(err);
                showToast("Extraction failed: " + err.message, "error");
                AppState.isProcessing = false;
                elements.btnExtractDivisions.disabled = false;
                elements.btnExtractDivisions.innerHTML = `<i class="fa-solid fa-scissors mr-2"></i> Extract All Divisions (2 on 1 Layer)`;
            }
        }, 100);
    }

    /* ==========================================================================
       4. RESULTS GALLERY & INSPECTOR
       ========================================================================== */

    function renderDivisionCards(divisions) {
        elements.divisionsGrid.innerHTML = "";
        elements.divisionCountBadge.textContent = `${divisions.length} Divisions`;
        toggleGallery(true);

        divisions.forEach((div, index) => {
            const card = document.createElement("div");
            card.className = "division-card bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:border-emerald-400";
            card.dataset.name = div.name.toLowerCase();

            card.innerHTML = `
                <div class="p-3 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
                    <div class="flex-1 min-w-0 pr-2">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">
                                #${div.index}
                            </span>
                            <h3 class="font-bold text-slate-800 text-xs truncate" title="${div.name}">
                                ${div.name}
                            </h3>
                        </div>
                        <p class="text-[11px] text-slate-500">
                            <i class="fa-solid fa-chart-area mr-1 text-slate-400"></i> ${div.stats.areaSqKm} km²
                        </p>
                    </div>
                    <button class="btn-inspect text-slate-400 hover:text-blue-600 transition-colors p-1" title="Inspect on Map">
                        <i class="fa-solid fa-magnifying-glass-plus text-sm"></i>
                    </button>
                </div>

                <div class="card-thumbnail-container relative bg-slate-100 h-32 flex items-center justify-center overflow-hidden cursor-pointer">
                    <div class="text-xs text-slate-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-spinner fa-spin"></i> Rendering map preview...
                    </div>
                </div>

                <div class="px-3 py-2 bg-white border-b border-slate-100 grid grid-cols-2 gap-1.5 text-center text-xs">
                    <div class="bg-emerald-50 text-emerald-800 rounded py-1 px-1">
                        <div class="font-bold text-xs">${div.stats.forestTypeCount} Types</div>
                        <div class="text-[10px] text-emerald-600">Forest Classes</div>
                    </div>
                    <div class="bg-blue-50 text-blue-800 rounded py-1 px-1">
                        <div class="font-bold text-xs">${div.stats.subFeatureCount} Polygons</div>
                        <div class="text-[10px] text-blue-600">Admin Units</div>
                    </div>
                </div>

                <div class="p-2.5 bg-white mt-auto grid grid-cols-2 gap-1.5">
                    <button class="btn-card-jpg flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1 px-2 rounded-lg text-xs transition-colors">
                        <i class="fa-regular fa-image text-blue-600"></i> JPG Map
                    </button>
                    <button class="btn-card-pdf flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-1 px-2 rounded-lg text-xs transition-colors">
                        <i class="fa-regular fa-file-pdf text-red-600"></i> PDF Map
                    </button>
                </div>
            `;

            const isPortrait = div.stats && div.stats.isPortrait;
            const thumbW = isPortrait ? 240 : 360;
            const thumbH = isPortrait ? 340 : 240;
            const thumbContainer = card.querySelector(".card-thumbnail-container");
            ExportManager.renderDivisionToCanvas(div, thumbW, thumbH).then(canvas => {
                canvas.className = "w-full h-full object-cover";
                thumbContainer.innerHTML = "";
                thumbContainer.appendChild(canvas);
            });

            card.querySelector(".btn-inspect").addEventListener("click", (e) => {
                e.stopPropagation();
                openModalInspector(div);
            });
            thumbContainer.addEventListener("click", () => {
                openModalInspector(div);
            });
            card.querySelector(".btn-card-jpg").addEventListener("click", (e) => {
                e.stopPropagation();
                ExportManager.downloadDivisionJPG(div);
                showToast(`Downloading JPG map for ${div.name}`, "success");
            });
            card.querySelector(".btn-card-pdf").addEventListener("click", (e) => {
                e.stopPropagation();
                ExportManager.downloadDivisionPDF(div);
                showToast(`Downloading PDF report for ${div.name}`, "success");
            });

            elements.divisionsGrid.appendChild(card);
        });
    }

    function filterDivisionCards(query) {
        const cards = elements.divisionsGrid.querySelectorAll(".division-card");
        cards.forEach(card => {
            const name = card.dataset.name || "";
            if (name.includes(query)) card.style.display = "flex";
            else card.style.display = "none";
        });
    }

    async function openModalInspector(division) {
        AppState.selectedDivision = division;

        elements.modalTitle.textContent = division.name;
        elements.modalStats.innerHTML = `
            <span><i class="fa-solid fa-layer-group text-blue-400 mr-1"></i> Index: <b>#${division.index}</b></span>
            <span><i class="fa-solid fa-chart-area text-indigo-400 mr-1"></i> Area: <b>${division.stats.areaSqKm} km²</b></span>
            <span><i class="fa-solid fa-tree text-emerald-400 mr-1"></i> Forest Types: <b>${division.stats.forestTypeCount} classes</b></span>
        `;

        MapManager.highlightDivision(division.adminFeature);

        const isPortrait = division.stats && division.stats.isPortrait;
        const modalW = isPortrait ? 840 : 1200;
        const modalH = isPortrait ? 1188 : 840;
        const canvas = await ExportManager.renderDivisionToCanvas(division, modalW, modalH);
        canvas.className = "w-full h-auto rounded-lg shadow-sm border border-slate-200";
        elements.modalMapCanvasContainer.innerHTML = "";
        elements.modalMapCanvasContainer.appendChild(canvas);

        populateModalMetadataTable(division);
        elements.modalInspector.classList.remove("hidden-custom");
    }

    function populateModalMetadataTable(division) {
        const layerSrc = (division.rasterData && division.rasterData.filename) || (division.isLULC ? "tamil_nadu_lulc_int.tif" : (division.isFCM ? "tamil_nadu_forest_cover_2023.img" : "Tamil_nadu_forest_type_2023.img"));
        const classCountLabel = division.isLULC ? "Active LULC Classes" : (division.isFCM ? "Active Cover Classes" : "Active Forest Classes");
        elements.modalFeaturesTable.innerHTML = `
            <tr class="border-b border-slate-100 bg-slate-50"><td class="py-2 px-3 font-semibold text-slate-600 w-48">Division Name</td><td class="py-2 px-3 text-slate-800 font-bold">${division.name}</td></tr>
            <tr class="border-b border-slate-100"><td class="py-2 px-3 font-semibold text-slate-600">Administrative Area</td><td class="py-2 px-3 text-slate-800 font-bold">${division.stats.areaSqKm} km²</td></tr>
            <tr class="border-b border-slate-100 bg-slate-50"><td class="py-2 px-3 font-semibold text-slate-600">Layer 2 File Source</td><td class="py-2 px-3 text-slate-800 font-semibold text-emerald-700">${layerSrc}</td></tr>
            <tr class="border-b border-slate-100"><td class="py-2 px-3 font-semibold text-slate-600">${classCountLabel}</td><td class="py-2 px-3 text-slate-800">${division.stats.forestTypeCount} Classes</td></tr>
            <tr class="border-b border-slate-100 bg-slate-50"><td class="py-2 px-3 font-semibold text-slate-600">Output Standard</td><td class="py-2 px-3 text-slate-800 font-semibold text-blue-700">Tamil Nadu Forest Department</td></tr>
            <tr><td class="py-2 px-3 font-semibold text-slate-600">Bounding Box Extent</td><td class="py-2 px-3 text-slate-600">[${division.stats.bbox.map(n => n.toFixed(4)).join(', ')}]</td></tr>
        `;
    }

    function closeModal() {
        elements.modalInspector.classList.add("hidden-custom");
        AppState.selectedDivision = null;
        MapManager.clearHighlight();
    }

    /* ==========================================================================
       5. STEP NAVIGATION
       ========================================================================== */

    function goToStep(stepNumber) {
        AppState.currentStep = stepNumber;
        if (mobileStepBadge) mobileStepBadge.textContent = stepNumber + "/4";

        updateStepIndicator(elements.step1Indicator, stepNumber, 1);
        updateStepIndicator(elements.step2Indicator, stepNumber, 2);
        updateStepIndicator(elements.step3Indicator, stepNumber, 3);
        updateStepIndicator(elements.step4Indicator, stepNumber, 4);

        elements.step1Panel.classList.toggle("hidden-custom", stepNumber !== 1);
        elements.step2Panel.classList.toggle("hidden-custom", stepNumber !== 2);
        elements.step3Panel.classList.toggle("hidden-custom", stepNumber !== 3);
        elements.step4Panel.classList.toggle("hidden-custom", stepNumber !== 4);
    }

    function updateStepIndicator(indicator, currentStep, stepNum) {
        indicator.classList.remove("active", "completed", "disabled");
        if (currentStep === stepNum) indicator.classList.add("active");
        else if (currentStep > stepNum) indicator.classList.add("completed");
        else indicator.classList.add("disabled");
    }

    function resetApp() {
        AppState.currentStep = 1;
        AppState.rawAdminData = null;
        AppState.adminData = null;
        AppState.adminFilename = "";
        AppState.rasterData = null;
        AppState.rasterFilename = "";
        AppState.extractedDivisions = [];
        AppState.selectedDivision = null;

        elements.adminFileInput.value = "";
        elements.secondaryFileInput.value = "";
        elements.adminFileStatus.classList.add("hidden-custom");
        elements.secondaryFileStatus.classList.add("hidden-custom");
        elements.adminFieldContainer.classList.add("hidden-custom");
        elements.extractProgressContainer.classList.add("hidden-custom");
        elements.btnProceedToStep2.disabled = true;
        elements.btnProceedToStep2.classList.add("opacity-50", "cursor-not-allowed");
        elements.btnProceedToStep3.disabled = true;
        elements.btnProceedToStep3.classList.add("opacity-50", "cursor-not-allowed");
        elements.divisionsGrid.innerHTML = "";

        MapManager.init("map");
        goToStep(1);
        showToast("Workflow reset to start.", "info");
    }

    function setupDropzone(dropzone, fileInput, onFileDrop) {
        dropzone.addEventListener("click", () => fileInput.click());

        ["dragenter", "dragover"].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault(); e.stopPropagation();
                dropzone.classList.add("dragover");
            });
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault(); e.stopPropagation();
                dropzone.classList.remove("dragover");
            });
        });

        dropzone.addEventListener("drop", (e) => {
            if (e.dataTransfer.files.length > 0) {
                onFileDrop(e.dataTransfer.files[0]);
            }
        });
    }

    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        const bgColors = {
            info: "bg-slate-900 text-white",
            success: "bg-emerald-600 text-white",
            warning: "bg-amber-600 text-white",
            error: "bg-red-600 text-white"
        };
        const icons = {
            info: "fa-circle-info",
            success: "fa-circle-check",
            warning: "fa-triangle-exclamation",
            error: "fa-circle-xmark"
        };

        toast.className = `toast flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${bgColors[type] || bgColors.info} mb-2.5`;
        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.info} text-base"></i>
            <span class="flex-1">${message}</span>
        `;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
});
