# KML_Overlap_Analyzer

A fast, 100% client-side web application designed for Forestry and Revenue GIS specialists to inspect division boundaries, detect polygon overlaps on satellite imagery, resolve overlaps interactively, and export clean, zero-overlap KML files.

---

## 🚀 How to Run the Website

### Option 1: Direct Browser Open
Simply double-click or open `index.html` in **Google Chrome**, **Microsoft Edge**, **Firefox**, or **Brave**.

### Option 2: Run with a Local Web Server
If you prefer running via a local server (e.g. VS Code Live Server or Python):
```bash
# Using Python 3:
python -m http.server 8080
```
Then visit: `http://localhost:8080` in your web browser.

---

## ✨ Features & Capabilities

1. **📁 Multi-KML & Recursive Folder Upload**:
   - Drag & drop or select multiple `.kml` / `.kmz` files, or **select an entire folder**.
   - **Recursive subfolder scanner**: Automatically traverses down nested folders and subfolders at any depth to extract all KML/KMZ boundary files.
   - Automatically categorizes **Reserve Forest (RF)** and **Revenue Land (RL)** polygons.
   - Assigns unique, vibrant colors to each feature upon loading.

2. **🛰️ High-Resolution Satellite Maps**:
   - ESRI World Imagery, ESRI Clarity Satellite, Google Hybrid, and OpenStreetMap base layers.

3. **📊 Interactive Layer Management & Area Calculation**:
   - Visibility checkboxes to toggle individual or group boundaries.
   - Live geodesic area calculation in **Hectares (Ha)**, **Acres (Ac)**, **Sq. Km**, or **Square Metres**.
   - Inline placemark name editing.
   - **Solid Fill** vs **Outline Only (No Brush / Transparent)** toggles.
   - Custom color picker for each polygon.

4. **⚠️ Automated Overlap Detection**:
   - Automatically computes geometric intersections across all RF and RL polygons.
   - Visualizes overlapping zones with pulsing red striped warning indicators.
   - Displays exact overlap areas and percentage contributions in a dedicated conflict table.

5. **✂️ Side-by-Side Overlap Resolver**:
   - **Left Map**: Original boundary showing the conflicting overlap zone.
   - **Right Map**: Live preview of the corrected geometry with zero remaining overlap.
   - **Deduct from Feature 1**: Subtracts overlap portion from Polygon 1.
   - **Deduct from Feature 2**: Subtracts overlap portion from Polygon 2.
   - **Apply Correction**: Commits the clean geometry to the division dataset and recalculates all metrics.

6. **💾 Clean KML Export**:
   - Download individual cleaned KML placemarks.
   - Download the full division collection as a single clean KML file with updated styles and metadata for Google Earth / QGIS / ArcGIS.

7. **🔒 100% Client-Side Privacy**:
   - All spatial processing and file reading happens locally inside your browser. No files or spatial data are ever transmitted to any external server.
