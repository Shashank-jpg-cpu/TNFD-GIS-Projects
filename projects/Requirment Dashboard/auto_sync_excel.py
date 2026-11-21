import os
import time
import sys

if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

from build_dashboard import build_dashboard
from sync_google_sheet import sync_from_google_sheet

def watch_excel(excel_path="Requirement IT (08.09.2026).xlsx"):
    if not os.path.exists(excel_path):
        xlsx_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~$')]
        if xlsx_files:
            excel_path = xlsx_files[0]
        else:
            print(f"Error: Excel file '{excel_path}' not found.")
            return

    print("==================================================================")
    print("  Tamil Nadu Forest Department - IT Requirement Real-Time Auto-Sync")
    print("==================================================================")
    print(f"Monitoring Excel:        {excel_path}")
    print("Monitoring Google Sheet: Live cloud sync")
    print("  - Edit and save in Excel (Ctrl+S) -> updates dashboard automatically!")
    print("Keep this window open while working. Press Ctrl+C to stop.")
    print("==================================================================\n")

    last_excel_mtime = os.path.getmtime(excel_path)
    last_excel_size = os.path.getsize(excel_path)

    while True:
        try:
            time.sleep(1)
            excel_changed = False

            if os.path.exists(excel_path):
                cur_excel_mtime = os.path.getmtime(excel_path)
                cur_excel_size = os.path.getsize(excel_path)
                if cur_excel_mtime != last_excel_mtime or cur_excel_size != last_excel_size:
                    excel_changed = True

            if excel_changed:
                time.sleep(0.5)
                print(f"[{time.strftime('%H:%M:%S')}] Change detected in Excel file! Syncing dashboard...")
                try:
                    build_dashboard(generate_pdf=False)
                    if os.path.exists(excel_path):
                        last_excel_mtime = os.path.getmtime(excel_path)
                        last_excel_size = os.path.getsize(excel_path)
                    print(f"[{time.strftime('%H:%M:%S')}] Sync complete! Refresh your browser (F5) to view changes.\n")
                except PermissionError:
                    print(f"[{time.strftime('%H:%M:%S')}] Waiting for file lock to release...")
                    time.sleep(1.5)
                    build_dashboard(generate_pdf=False)
                    if os.path.exists(excel_path):
                        last_excel_mtime = os.path.getmtime(excel_path)
                        last_excel_size = os.path.getsize(excel_path)
                    print(f"[{time.strftime('%H:%M:%S')}] Sync complete! Refresh your browser (F5).\n")
                except Exception as ex:
                    print(f"[{time.strftime('%H:%M:%S')}] Sync Error: {ex}\n")
        except KeyboardInterrupt:
            print("\nAuto-Sync stopped.")
            break
        except Exception as e:
            time.sleep(2)

if __name__ == '__main__':
    watch_excel()