import os
import time
import sys

if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

from build_dashboard import build_dashboard
from sync_google_sheet import sync_from_google_sheet

def get_kml_dir_state(kml_dir="kmls"):
    if not os.path.exists(kml_dir):
        return (0, 0.0)
    files = []
    total_mtime = 0.0
    for root, _, f_list in os.walk(kml_dir):
        for f in f_list:
            if f.lower().endswith(('.kml', '.kmz')):
                fp = os.path.join(root, f)
                try:
                    total_mtime += os.path.getmtime(fp)
                    files.append(fp)
                except:
                    pass
    return (len(files), round(total_mtime, 3))

def watch_excel_and_kmls(excel_path="RF RL INDEX SHEET (as on 06.09.2026).xlsx", kml_dir="kmls"):
    if not os.path.exists(excel_path):
        xlsx_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~$')]
        if xlsx_files:
            excel_path = xlsx_files[0]
        else:
            print(f"Error: Excel file '{excel_path}' not found.")
            return

    os.makedirs(kml_dir, exist_ok=True)

    print("==================================================================")
    print("  Tamil Nadu Forest Department - RF & RL Real-Time Live Auto-Sync")
    print("==================================================================")
    print(f"Monitoring Excel:        {excel_path}")
    print(f"Monitoring KMLs:         {os.path.abspath(kml_dir)}")
    print("Monitoring Google Sheet: Live cloud sync")
    print("  - Edit and save in Excel (Ctrl+S) -> updates dashboard automatically!")
    print("  - Paste/change any .kml in 'kmls' folder -> syncs KML buttons instantly!")
    print("Keep this window open while working. Press Ctrl+C to stop.")
    print("==================================================================\n")

    last_excel_mtime = os.path.getmtime(excel_path)
    last_excel_size = os.path.getsize(excel_path)
    last_kml_state = get_kml_dir_state(kml_dir)
    last_sheet_check = time.time()

    while True:
        try:
            time.sleep(1)
            excel_changed = False
            kml_changed = False

            if os.path.exists(excel_path):
                cur_excel_mtime = os.path.getmtime(excel_path)
                cur_excel_size = os.path.getsize(excel_path)
                if cur_excel_mtime != last_excel_mtime or cur_excel_size != last_excel_size:
                    excel_changed = True

            cur_kml_state = get_kml_dir_state(kml_dir)
            if cur_kml_state != last_kml_state:
                kml_changed = True

            if excel_changed or kml_changed:
                time.sleep(0.5)
                reason = "Excel file" if excel_changed else "KMLs folder"
                if excel_changed and kml_changed:
                    reason = "Excel file & KMLs folder"
                print(f"[{time.strftime('%H:%M:%S')}] Change detected in {reason}! Syncing dashboard...")
                try:
                    build_dashboard()
                    if os.path.exists(excel_path):
                        last_excel_mtime = os.path.getmtime(excel_path)
                        last_excel_size = os.path.getsize(excel_path)
                    last_kml_state = cur_kml_state
                    print(f"[{time.strftime('%H:%M:%S')}] Sync complete! Refresh your browser (F5) to view changes.\n")
                except PermissionError:
                    print(f"[{time.strftime('%H:%M:%S')}] Waiting for file lock to release...")
                    time.sleep(1.5)
                    build_dashboard()
                    if os.path.exists(excel_path):
                        last_excel_mtime = os.path.getmtime(excel_path)
                        last_excel_size = os.path.getsize(excel_path)
                    last_kml_state = cur_kml_state
                    print(f"[{time.strftime('%H:%M:%S')}] Sync complete! Refresh your browser (F5).\n")
                except Exception as ex:
                    print(f"[{time.strftime('%H:%M:%S')}] Sync Error: {ex}\n")
        except KeyboardInterrupt:
            print("\nAuto-Sync stopped.")
            break
        except Exception as e:
            time.sleep(2)

if __name__ == '__main__':
    watch_excel_and_kmls()
