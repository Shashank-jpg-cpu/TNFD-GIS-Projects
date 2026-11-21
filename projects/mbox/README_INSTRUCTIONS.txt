================================================================================
  TAMIL NADU FOREST DEPARTMENT - FLASH REPORTS GIS DASHBOARD
================================================================================

This package contains the complete standalone interactive GIS Incident Map Dashboard
for Flash Reports parsed from Tamil Nadu Forest Department emails & original PDF attachments.

--------------------------------------------------------------------------------
HOW TO OPEN AND USE THE DASHBOARD
--------------------------------------------------------------------------------
1. Simply double-click "index.html".
2. It opens instantly in your default web browser (Chrome, Edge, Firefox).
3. No Python, no server, and no setup required!

--------------------------------------------------------------------------------
FEATURES & CAPABILITIES
--------------------------------------------------------------------------------
- Real Mail PDF Downloads:
  Clicking "Download PDF" on any incident card or map popup directly downloads
  the authentic original PDF report attachment received with the email (stored in pdfs/).
  If an incident did not have a PDF in the email, no PDF download option is displayed.

- Interactive GIS Map:
  Explore incidents across Tamil Nadu forest divisions (Sathyamangalam, Hasanur,
  Nilgiris, Hosur, Coimbatore, Pollachi, Gudalur, Erode, etc.) with Street Map
  and Satellite Imagery basemaps.

- Color-Coded Incident Markers:
  * Red (pulsing): Human Death
  * Amber: Human Injury
  * Purple (pulsing): Animal Death (e.g. wild elephants)
  * Cyan: Animal Injury
  * Badges: [GPS] for exact GPS coordinates, [FIX] for central division fallback.

- Advanced Filtering & Search:
  * Live search by keyword, division, or person name.
  * Filter by Incident Category and Division / Range.
  * Date range filtering (From Date - To Date).

- Import & Manual Entry:
  * Import additional Flash Report mail or PDF files.
  * Add custom manual incident records with custom coordinates.
================================================================================
