# Tamil Nadu Forest Department — Meeting Schedule & Slot Availability Dashboard

An executive, responsive One-View Meeting Room and Conference Hall Schedule Dashboard connected live to the Google Spreadsheet:
https://docs.google.com/spreadsheets/d/1DUEXt9cevmjP4uA-IRtM5m_6BpRjxtuOsn3UCWvmes4/edit?gid=1457623712#gid=1457623712

---

## 🌟 Key Features

1. **One-View Rolling 4–5 Day Schedule**:
   - Displays Today and the coming 4–5 days side by side.
   - **Automatic Daily Shifting**: Anchored directly to the computer's system date (`new Date()`). Each day at midnight, the calendar advances forward automatically.
   - **Shifter Controls**: Includes `Prev Day (-1)`, `Today`, `Next Day (+1)`, and a native Date Picker.
   - View toggle: Switch between **4 Days**, **5 Days (Default)**, and **Full Month Table View**.

2. **Past Months Archive Buttons**:
   - Instant access buttons for all months from the Google Sheet:
     - **September 2026** (Active)
     - **August 2026** (Archive)
     - **April to July 2026** (Archive)
     - **March 2026** (Archive)

3. **Month-End Smart Detection**:
   - When viewing dates near or at month-end, displays an alert with a direct **"Switch Month View →"** action button.

4. **Detailed Breakdown of Slots (Filled vs Available / Left)**:
   - **🟢 Available / Left Slots**: Highlighted in emerald green with a prominent `🟢 AVAILABLE` badge, displaying the time slot ready for booking.
   - **🔵 Filled / Booked Slots**: Highlighted in indigo/slate with a `🔵 BOOKED` badge, detailing:
     - **Wing / Department** (clean, normalized names)
     - **Meeting Subject / Agenda**
     - **Reference ID / Communication**
     - **Venue / Mode** (Mini Conference Hall, VC mode, Physical mode, HoFF Chamber)
     - Automatically breaks multi-session slots (e.g. Session 1 and Session 2) into clean sub-cards.
   - **Slot Detail Modal**: Click any slot to view expanded details and copy meeting info to clipboard.

5. **Unified Department Taxonomy**:
   - Standardized department names (`Admin Wing`, `FCA Wing`, `IT Wing`, `Wildlife`, `Planning & Budgeting`, `Technical Section`, etc.), removing case variations and duplicates from the filter dropdown.

6. **Live Google Sheet Sync (CORS-Free GViz JSONP)**:
   - Fetches live updates directly from Google Sheets without CORS restrictions.
   - Includes cache-busting timestamp (`_t=Date.now()`) to ensure the latest edits reflect immediately upon clicking **"Refresh Live"**.
   - Includes bundled offline cache (`preloaded_data.js`) for instant loading anywhere.

---

## 🚀 How to Run on Any Computer

This dashboard is 100% standalone and portable. No installation or complex setup is required!

### Method 1: Double-Click (Recommended)
1. Extract the `.zip` archive.
2. Double-click **`index.html`** to open it in any modern browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari, Brave, etc.).
3. The dashboard will load instantly and connect live to Google Sheets!

### Method 2: Local HTTP Server (Optional)
If running in an organization or intranet web server:
```bash
# Python 3
python -m http.server 8080

# Or Node.js
npx serve
```
Then open `http://localhost:8080` in your web browser.

---

## 📁 Package Contents

| File | Description |
|---|---|
| `index.html` | Standalone Single-Page Application |
| `styles.css` | Executive styling, slot card designs, dark/light theme, print styles |
| `app.js` | Core application logic (live sync, rolling window, day shifting, wing normalization) |
| `preloaded_data.js` | Bundled 151-day dataset cache across all 4 sheet tabs |
| `sheet_data.csv` | Original raw spreadsheet backup |
| `README.md` | Documentation and instructions |
