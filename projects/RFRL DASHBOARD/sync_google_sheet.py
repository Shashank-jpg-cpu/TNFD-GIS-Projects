import os
import sys
import ssl
import shutil
import urllib.request
import urllib.error
from build_dashboard import build_dashboard

SHEET_ID = "1TSFqiIep7ORNg24h3vqC0l9KDAyH1NOjFAKCObblygk"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
TARGET_EXCEL = "RF RL INDEX SHEET (as on 06.09.2026).xlsx"

def sync_from_google_sheet():
    print("==================================================================")
    print("  Tamil Nadu Forest Department - RF and RL Google Sheet Live Syncer")
    print("==================================================================")
    print(f"Connecting to Google Spreadsheet: {SHEET_ID}...")

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        EXPORT_URL,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = resp.read()
            if len(data) > 2000 and data[:4] == b'PK\x03\x04':
                if os.path.exists(TARGET_EXCEL):
                    shutil.copy2(TARGET_EXCEL, TARGET_EXCEL + ".bak")
                with open(TARGET_EXCEL, "wb") as f:
                    f.write(data)
                print(f"[SUCCESS] Downloaded latest spreadsheet ({len(data)} bytes)!")
                print("Rebuilding dashboard with newly updated data...")
                build_dashboard()
                print("\n[COMPLETE] Dashboard successfully updated from live Google Sheet!")
                return True
            else:
                print("[WARNING] Downloaded response is not a valid Excel file.")
                if b'accounts.google.com' in data or b'ServiceLogin' in data:
                    print("\n[!] The Google Sheet is currently set to 'Restricted' by Google.")
                    print("    To enable live syncing:")
                    print("    1. Open: https://docs.google.com/spreadsheets/d/" + SHEET_ID)
                    print("    2. Click 'Share' (top-right)")
                    print("    3. Change 'General access' from 'Restricted' to 'Anyone with the link' (Viewer)")
                    print("    4. Click 'Done' and run this sync again!")
                return False
    except urllib.error.HTTPError as e:
        print(f"[!] HTTP Error {e.code}: {e.reason}")
        if e.code in (401, 403, 302):
            print("\n[!] The Google Sheet requires access permissions.")
            print("    Please ensure 'General access' in Google Sheets is set to 'Anyone with the link' (Viewer).")
        return False
    except Exception as e:
        print(f"[!] Connection Error: {e}")
        return False

if __name__ == '__main__':
    success = sync_from_google_sheet()
    if not success:
        print("\nNote: Existing local verified dataset was preserved.")
    print("==================================================================")
