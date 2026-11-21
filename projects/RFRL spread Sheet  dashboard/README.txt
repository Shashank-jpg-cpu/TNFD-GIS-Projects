========================================================================
   RF & RL GIS VERIFICATION DASHBOARD (FORESTRY / GIS)
========================================================================

HOW TO USE:
1. Simply double-click "index.html" to open the dashboard in any web browser (Google Chrome, Microsoft Edge, Firefox, Brave, etc.).
2. No software installation, Python, Node.js, or local servers are required!

FEATURES:
- Live Google Sheets Real-Time Auto-Sync (Hourly by Default):
  Connected directly to the Megamalai RF & RL Google Spreadsheet.
  Automatically refreshes hourly (or custom intervals: 30m, 15m, 5m, 1m, 10s, Manual).
  Any edit made in the Google Sheet is automatically detected and updated live.
- 1-Click Sheet Switcher:
  Switch between "RF Sheet (Reserved Forest)", "RL Sheet (Revenue Land)", and "Combined Overview".
- Clickable KPI Filter Cards:
  Click on "Added to Database", "KML Rejected", "Action Required", "Huge Area Difference (> 20%)", etc. to instantly filter the table.
- Huge Area Difference Indicator (> 20%):
  Specifically tracks and flags forest/land blocks where Polygon Area vs Notified Area exceeds 20% variance.
- Interactive Visual Analytics:
  Approval charts, rejection reason breakdown, and verifier workload stats.
- Export Options:
  Download filtered data to Excel (.xlsx) or CSV anytime with one click.

FILES IN THIS FOLDER:
- index.html       : Main Dashboard Application
- styles.css       : Custom GIS Styling and Layout
- app.js           : Real-Time Sync & Interactive Engine
- sample-data.js   : Initial Embedded Snapshot Data
========================================================================
