import openpyxl
import json
import os
import re
import shutil
import zipfile
from collections import defaultdict

def normalize_block_name(s):
    if not s:
        return ""
    s = s.lower()
    if s.endswith('.kml') or s.endswith('.kmz'):
        s = s.rsplit('.', 1)[0]
    s = s.replace('_', ' ').replace('-', ' ')
    s = re.sub(r'\b(rf|rl|reserve forest|reserved forest|reserve land|reserved land)\b', '', s)
    s = re.sub(r'[^a-z0-9\s]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def scan_kml_folder(kml_dir="kmls", all_blocks=None):
    manifest = {
        "blocks": {},       # exact block name -> { "path": "kmls/...", "filename": "..." }
        "normalized": {},   # normalized name -> "kmls/..."
        "total_kmls": 0,
        "files": []
    }
    
    if not os.path.exists(kml_dir):
        os.makedirs(kml_dir, exist_ok=True)
        return manifest

    exact_block_map = {}
    norm_block_map = {}
    if all_blocks:
        for b in all_blocks:
            b_name = b['name']
            exact_block_map[b_name.strip().lower()] = b_name
            norm_block_map[normalize_block_name(b_name)] = b_name

    for root, _, files in os.walk(kml_dir):
        for f in sorted(files):
            if f.lower().endswith(('.kml', '.kmz')):
                manifest["total_kmls"] += 1
                rel_path = os.path.relpath(os.path.join(root, f), '.').replace('\\', '/')
                manifest["files"].append({
                    "filename": f,
                    "path": rel_path
                })
                
                stem = os.path.splitext(f)[0]
                norm_stem = normalize_block_name(stem)
                manifest["normalized"][norm_stem] = rel_path
                
                # Check direct match with block names
                matched_block = None
                if stem.strip().lower() in exact_block_map:
                    matched_block = exact_block_map[stem.strip().lower()]
                elif norm_stem in norm_block_map:
                    matched_block = norm_block_map[norm_stem]
                else:
                    # Substring match if length > 4
                    for nb, actual in norm_block_map.items():
                        if len(norm_stem) > 4 and (norm_stem in nb or nb in norm_stem):
                            matched_block = actual
                            break
                            
                if matched_block:
                    manifest["blocks"][matched_block] = {
                        "path": rel_path,
                        "filename": f
                    }
                    print(f"  [KML Linked] '{f}' -> '{matched_block}'")
                else:
                    manifest["blocks"][stem] = {
                        "path": rel_path,
                        "filename": f
                    }
                    
    return manifest

def build_dashboard():
    excel_path = "RF RL INDEX SHEET (as on 06.09.2026).xlsx"
    if not os.path.exists(excel_path):
        xlsx_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~$')]
        if xlsx_files:
            excel_path = xlsx_files[0]
        else:
            raise FileNotFoundError("No Excel file found in current directory.")

    print(f"Loading Excel workbook: {excel_path}...")
    wb = openpyxl.load_workbook(excel_path, data_only=True)

    div_map = {
        ('Chennai', 'Tiruvallur'): 'Thiruvallur',
        ('KMTR', 'Kanyakumari'): 'Kanniyakumari',
        ('Tiruchirapalli', 'WL, Nagapattinam'): 'Nagapattinam'
    }

    circle_colors = {
        'AAZP': '#2563EB',         # Royal Blue
        'ATR': '#059669',          # Emerald Green
        'Chennai': '#D97706',      # Amber Gold
        'Dharmapuri': '#DC2626',   # Crimson Red
        'Dindigul': '#7C3AED',     # Deep Violet
        'KMTR': '#475569',         # Slate Charcoal
        'MTR': '#16A34A',          # Forest Green
        'Salem': '#DB2777',        # Rose Pink
        'SMTR': '#0891B2',         # Ocean Cyan
        'STR': '#0D9488',          # Teal
        'Tiruchirapalli': '#9333EA',# Electric Purple
        'Vellore': '#B45309',      # Warm Bronze
        'Villupuram': '#0284C7'    # Sky Blue
    }

    # Parse RF INDEX
    rf_sheet = wb['RF INDEX']
    rf_records = []
    div_rf = defaultdict(lambda: {'count': 0, 'notif_area': 0.0, 'ctrl_area': 0.0, 'blocks': []})

    for r in range(3, rf_sheet.max_row + 1):
        c = rf_sheet.cell(r, 2).value
        d = rf_sheet.cell(r, 3).value
        name = rf_sheet.cell(r, 4).value
        notif = rf_sheet.cell(r, 5).value
        ctrl = rf_sheet.cell(r, 6).value
        remarks = rf_sheet.cell(r, 7).value

        if not c or not d or not name:
            continue

        c_str = str(c).strip()
        d_str = str(d).strip()
        d_clean = div_map.get((c_str, d_str), d_str)
        name_str = str(name).strip().replace('\n', ' ')
        rem_str = str(remarks).strip().replace('\n', ' ') if remarks else ''

        try: notif_v = float(notif) if notif is not None else 0.0
        except: notif_v = 0.0
        try: ctrl_v = float(ctrl) if ctrl is not None else 0.0
        except: ctrl_v = 0.0

        rec = {
            'sno': r - 2,
            'type': 'RF',
            'circle': c_str,
            'division': d_clean,
            'name': name_str,
            'notif_area': round(notif_v, 3),
            'ctrl_area': round(ctrl_v, 3),
            'remarks': rem_str
        }
        rf_records.append(rec)
        div_rf[(c_str, d_clean)]['count'] += 1
        div_rf[(c_str, d_clean)]['notif_area'] += notif_v
        div_rf[(c_str, d_clean)]['ctrl_area'] += ctrl_v
        div_rf[(c_str, d_clean)]['blocks'].append(rec)

    # Parse RL INDEX
    rl_sheet = wb['RL INDEX']
    rl_records = []
    div_rl = defaultdict(lambda: {'count': 0, 'notif_area': 0.0, 'ctrl_area': 0.0, 'blocks': []})

    for r in range(3, rl_sheet.max_row + 1):
        c = rl_sheet.cell(r, 2).value
        d = rl_sheet.cell(r, 3).value
        name = rl_sheet.cell(r, 4).value
        notif = rl_sheet.cell(r, 5).value
        ctrl = rl_sheet.cell(r, 6).value
        remarks = rl_sheet.cell(r, 7).value

        if not c or not d or not name:
            continue

        c_str = str(c).strip()
        d_str = str(d).strip()
        d_clean = div_map.get((c_str, d_str), d_str)
        name_str = str(name).strip().replace('\n', ' ')
        rem_str = str(remarks).strip().replace('\n', ' ') if remarks else ''

        try: notif_v = float(notif) if notif is not None else 0.0
        except: notif_v = 0.0
        try: ctrl_v = float(ctrl) if ctrl is not None else 0.0
        except: ctrl_v = 0.0

        rec = {
            'sno': r - 2,
            'type': 'RL',
            'circle': c_str,
            'division': d_clean,
            'name': name_str,
            'notif_area': round(notif_v, 3),
            'ctrl_area': round(ctrl_v, 3),
            'remarks': rem_str
        }
        rl_records.append(rec)
        div_rl[(c_str, d_clean)]['count'] += 1
        div_rl[(c_str, d_clean)]['notif_area'] += notif_v
        div_rl[(c_str, d_clean)]['ctrl_area'] += ctrl_v
        div_rl[(c_str, d_clean)]['blocks'].append(rec)

    # All unique circles in order of appearance
    all_circles = []
    for r in rf_records + rl_records:
        if r['circle'] not in all_circles:
            all_circles.append(r['circle'])

    # Grand totals
    grand_rf_count = len(rf_records)
    grand_rf_ctrl = sum(r['ctrl_area'] for r in rf_records)
    grand_rf_notif = sum(r['notif_area'] for r in rf_records)

    grand_rl_count = len(rl_records)
    grand_rl_ctrl = sum(r['ctrl_area'] for r in rl_records)
    grand_rl_notif = sum(r['notif_area'] for r in rl_records)

    grand_total_blocks = grand_rf_count + grand_rl_count
    grand_total_ctrl = grand_rf_ctrl + grand_rl_ctrl
    grand_total_notif = grand_rf_notif + grand_rl_notif

    circles_dict = {}
    division_list = []

    for c in all_circles:
        c_div_names = []
        for (cir, div) in list(div_rf.keys()) + list(div_rl.keys()):
            if cir == c and div not in c_div_names:
                c_div_names.append(div)

        c_rf_count = sum(div_rf[(c, d)]['count'] for d in c_div_names)
        c_rf_ctrl = sum(div_rf[(c, d)]['ctrl_area'] for d in c_div_names)
        c_rf_notif = sum(div_rf[(c, d)]['notif_area'] for d in c_div_names)

        c_rl_count = sum(div_rl[(c, d)]['count'] for d in c_div_names)
        c_rl_ctrl = sum(div_rl[(c, d)]['ctrl_area'] for d in c_div_names)
        c_rl_notif = sum(div_rl[(c, d)]['notif_area'] for d in c_div_names)

        c_total_blocks = c_rf_count + c_rl_count
        c_total_ctrl = c_rf_ctrl + c_rl_ctrl
        c_total_notif = c_rf_notif + c_rl_notif

        c_divisions = []
        for d in c_div_names:
            rf_d = div_rf[(c, d)]
            rl_d = div_rl[(c, d)]
            d_total_blocks = rf_d['count'] + rl_d['count']
            d_total_ctrl = rf_d['ctrl_area'] + rl_d['ctrl_area']
            d_total_notif = rf_d['notif_area'] + rl_d['notif_area']

            d_obj = {
                'circle': c,
                'division': d,
                'rf_count': rf_d['count'],
                'rf_ctrl_area': round(rf_d['ctrl_area'], 3),
                'rf_notif_area': round(rf_d['notif_area'], 3),
                'rl_count': rl_d['count'],
                'rl_ctrl_area': round(rl_d['ctrl_area'], 3),
                'rl_notif_area': round(rl_d['notif_area'], 3),
                'total_blocks': d_total_blocks,
                'total_ctrl_area': round(d_total_ctrl, 3),
                'total_notif_area': round(d_total_notif, 3),
                'pct_circle_area': round((d_total_ctrl / c_total_ctrl * 100) if c_total_ctrl > 0 else 0, 2),
                'pct_state_area': round((d_total_ctrl / grand_total_ctrl * 100) if grand_total_ctrl > 0 else 0, 2),
                'rf_blocks': rf_d['blocks'],
                'rl_blocks': rl_d['blocks']
            }
            c_divisions.append(d_obj)
            division_list.append(d_obj)

        circles_dict[c] = {
            'name': c,
            'color': circle_colors.get(c, '#3b82f6'),
            'total_divisions': len(c_div_names),
            'rf_count': c_rf_count,
            'rf_ctrl_area': round(c_rf_ctrl, 3),
            'rf_notif_area': round(c_rf_notif, 3),
            'rl_count': c_rl_count,
            'rl_ctrl_area': round(c_rl_ctrl, 3),
            'rl_notif_area': round(c_rl_notif, 3),
            'total_blocks': c_total_blocks,
            'total_ctrl_area': round(c_total_ctrl, 3),
            'total_notif_area': round(c_total_notif, 3),
            'pct_state_area': round((c_total_ctrl / grand_total_ctrl * 100) if grand_total_ctrl > 0 else 0, 2),
            'divisions': c_divisions
        }

    grand_stats = {
        'total_circles': len(all_circles),
        'total_divisions': len(division_list),
        'rf_count': grand_rf_count,
        'rf_ctrl_area': round(grand_rf_ctrl, 3),
        'rf_notif_area': round(grand_rf_notif, 3),
        'rl_count': grand_rl_count,
        'rl_ctrl_area': round(grand_rl_ctrl, 3),
        'rl_notif_area': round(grand_rl_notif, 3),
        'total_blocks': grand_total_blocks,
        'total_ctrl_area': round(grand_total_ctrl, 3),
        'total_notif_area': round(grand_total_notif, 3),
        'rf_pct_area': round((grand_rf_ctrl / grand_total_ctrl * 100), 2),
        'rl_pct_area': round((grand_rl_ctrl / grand_total_ctrl * 100), 2),
    }

    all_blocks = rf_records + rl_records
    for i, b in enumerate(all_blocks, start=1):
        b['global_id'] = i

    # Scan KML folder
    kml_manifest = scan_kml_folder("kmls", all_blocks)

    data_payload = {
        'circles': circles_dict,
        'circle_order': all_circles,
        'divisions': division_list,
        'all_blocks': all_blocks,
        'grand_stats': grand_stats,
        'kml_manifest': kml_manifest
    }

    json_payload = json.dumps(data_payload, ensure_ascii=False)
    kml_json = json.dumps(kml_manifest, ensure_ascii=False, indent=2)

    # 1. Write data.js
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(f"window.DASHBOARD_DATA = {json_payload};")

    # 2. Write kml_manifest.js
    with open("kml_manifest.js", "w", encoding="utf-8") as f:
        f.write(f"window.KML_MANIFEST = {kml_json};")

    template_path = "template.html"
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template file not found: {template_path}")

    with open(template_path, "r", encoding="utf-8") as f:
        template_html = f.read()

    injected_html = template_html.replace("/*__DASHBOARD_DATA__*/", f"window.DATA = {json_payload};")

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(injected_html)

    print(f"Generated index.html, data.js & kml_manifest.js! (RF: {grand_rf_count}, RL: {grand_rl_count}, KMLs: {kml_manifest['total_kmls']})")
    create_bat_files()
    # ZIP creation removed as requested

def create_bat_files():
    bat_content = '''@echo off
title RF & RL Dashboard Launcher
echo ========================================================
echo Tamil Nadu Forest Department - RF & RL Dashboard
echo Syncing latest data from Excel & KMLs folder...
echo ========================================================
python build_dashboard.py
echo.
echo Opening Dashboard in your default web browser...
start index.html
'''
    with open("start_dashboard.bat", "w", encoding="utf-8") as f:
        f.write(bat_content)

    update_content = '''@echo off
title Update RF & RL Dashboard
echo ========================================================
echo Re-parsing Excel data, Syncing KMLs & Updating Dashboard...
echo ========================================================
python build_dashboard.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   Dashboard updated successfully!
    echo   Opening Dashboard in your web browser...
    echo ========================================================
    start index.html
) else (
    echo.
    echo Error updating dashboard. Please check Python installation.
    pause
)
'''
    with open("update_dashboard.bat", "w", encoding="utf-8") as f:
        f.write(update_content)

if __name__ == '__main__':
    build_dashboard()
