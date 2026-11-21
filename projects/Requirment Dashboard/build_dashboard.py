import openpyxl
import json
import os
import subprocess
import zipfile
import time
import urllib.parse


def build_dashboard(generate_pdf=True):
    excel_path = "Requirement IT (08.09.2026).xlsx"
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb['Requirement ']

    # Define the 18 circles in order with their dedicated unique colors
    circle_colors = {
        'AAZP': '#2563EB',        # Royal Blue
        'ATR': '#059669',         # Emerald Green
        'Chennai': '#D97706',     # Amber Gold
        'Dharmapuri': '#DC2626',  # Crimson Red
        'Dindigul': '#7C3AED',    # Deep Violet
        'Erode': '#0D9488',       # Teal
        'Headquarters': '#4F46E5',# Indigo
        'MTR': '#16A34A',         # Forest Green
        'Research': '#EA580C',    # Vivid Orange
        'Salem': '#DB2777',       # Rose Pink
        'SMTR': '#0891B2',        # Ocean Cyan
        'KMTR': '#475569',        # Slate Charcoal
        'Trichy': '#9333EA',      # Electric Purple
        'Vellore': '#B45309',     # Warm Bronze
        'Villupuram': '#0284C7',  # Sky Blue
        'Working Plan': '#65A30D',# Lime Olive
        'TNFA': '#BE185D',        # Deep Magenta
        'TNFWCCB': '#0F766E'      # Pine Teal
    }

    circle_order = list(circle_colors.keys())

    # Initialize data structures
    dashboard_data = {}
    for c in circle_order:
        dashboard_data[c] = {
            'name': c,
            'color': circle_colors[c],
            'total_offices': 0,
            'desk_av': 0, 'desk_req': 0,
            'lap_av': 0, 'lap_req': 0,
            'print_av': 0, 'print_req': 0,
            'total_req': 0,
            'categories': {
                'Circle Office': {
                    'name': 'Circle Offices',
                    'count': 0,
                    'desk_av': 0, 'desk_req': 0,
                    'lap_av': 0, 'lap_req': 0,
                    'print_av': 0, 'print_req': 0,
                    'offices': []
                },
                'Division Office': {
                    'name': 'Division Offices',
                    'count': 0,
                    'desk_av': 0, 'desk_req': 0,
                    'lap_av': 0, 'lap_req': 0,
                    'print_av': 0, 'print_req': 0,
                    'offices': []
                },
                'Range Office': {
                    'name': 'Range Offices',
                    'count': 0,
                    'desk_av': 0, 'desk_req': 0,
                    'lap_av': 0, 'lap_req': 0,
                    'print_av': 0, 'print_req': 0,
                    'offices': []
                }
            }
        }

    # Iterate rows 3 to 501
    for r in range(3, 502):
        circle_val = ws.cell(r, 2).value
        if not circle_val:
            continue
        c_name = str(circle_val).strip()
        if c_name not in dashboard_data:
            continue

        cat_val = str(ws.cell(r, 6).value or '').strip()
        if cat_val not in ['Circle Office', 'Division Office', 'Range Office']:
            continue

        desk_av = int(ws.cell(r, 5).value or 0)
        desk_req = int(ws.cell(r, 7).value or 0)
        lap_av = int(ws.cell(r, 8).value or 0)
        lap_req = int(ws.cell(r, 9).value or 0)
        print_av = int(ws.cell(r, 10).value or 0)
        print_req = int(ws.cell(r, 11).value or 0)

        div_office = str(ws.cell(r, 3).value or '').strip()
        office_name = str(ws.cell(r, 4).value or '').strip()
        remarks = str(ws.cell(r, 12).value or '').strip()

        c_obj = dashboard_data[c_name]
        c_obj['total_offices'] += 1
        c_obj['desk_av'] += desk_av
        c_obj['desk_req'] += desk_req
        c_obj['lap_av'] += lap_av
        c_obj['lap_req'] += lap_req
        c_obj['print_av'] += print_av
        c_obj['print_req'] += print_req
        c_obj['total_req'] += (desk_req + lap_req + print_req)

        cat_obj = c_obj['categories'][cat_val]
        cat_obj['count'] += 1
        cat_obj['desk_av'] += desk_av
        cat_obj['desk_req'] += desk_req
        cat_obj['lap_av'] += lap_av
        cat_obj['lap_req'] += lap_req
        cat_obj['print_av'] += print_av
        cat_obj['print_req'] += print_req
        cat_obj['offices'].append({
            'name': office_name,
            'div': div_office,
            'desk_av': desk_av, 'desk_req': desk_req,
            'lap_av': lap_av, 'lap_req': lap_req,
            'print_av': print_av, 'print_req': print_req,
            'remarks': remarks
        })

    grand_stats = {
        'total_circles': len(circle_order),
        'total_offices': sum(c['total_offices'] for c in dashboard_data.values()),
        'desk_av': sum(c['desk_av'] for c in dashboard_data.values()),
        'desk_req': sum(c['desk_req'] for c in dashboard_data.values()),
        'lap_av': sum(c['lap_av'] for c in dashboard_data.values()),
        'lap_req': sum(c['lap_req'] for c in dashboard_data.values()),
        'print_av': sum(c['print_av'] for c in dashboard_data.values()),
        'print_req': sum(c['print_req'] for c in dashboard_data.values()),
    }
    grand_stats['total_fresh_req'] = grand_stats['desk_req'] + grand_stats['lap_req'] + grand_stats['print_req']

    print(f"Data parsed successfully: {grand_stats['total_circles']} circles, {grand_stats['total_offices']} offices.")

    json_data = json.dumps({
        'circles': dashboard_data,
        'circle_order': circle_order,
        'grand_stats': grand_stats
    }, ensure_ascii=False)

    html_content = get_html_template(json_data, grand_stats)

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_content)

    print("Updated index.html successfully!")

    if generate_pdf:
        # Generate pixel-perfect PDFs into PDFs/ folder
        generate_all_pdfs(circle_order)
    else:
        # Fast mode: update packages without re-rendering all PDFs
        update_zip_packages(circle_order)


def get_html_template(json_data, stats):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IT Requirment</title>
  <style>
    :root {{
      --bg-body: #f8fafc;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-light: #94a3b8;
      --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-full: 9999px;
      --primary: #2563eb;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-body);
      color: var(--text-main);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 60px;
    }}

    /* Top Navigation Bar */
    .top-header {{
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: var(--shadow-sm);
    }}

    .header-container {{
      max-width: 1440px;
      margin: 0 auto;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }}

    .brand-title {{
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .brand-badge {{
      font-size: 0.75rem;
      font-weight: 700;
      background: #eff6ff;
      color: #2563eb;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      border: 1px solid #bfdbfe;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}

    .header-kpi-group {{
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }}

    .kpi-pill {{
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #f1f5f9;
      border-radius: var(--radius-full);
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }}

    .kpi-pill span.value {{
      font-weight: 800;
      color: #0f172a;
    }}

    .switch-pill-group {{
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
    }}

    .mode-btn {{
      border: none;
      background: transparent;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }}

    .mode-btn.active {{
      background: #ffffff;
      color: var(--text-main);
      box-shadow: var(--shadow-sm);
    }}

    /* Main Container */
    .dashboard-body {{
      max-width: 1440px;
      margin: 20px auto 0;
      padding: 0 24px;
    }}

    /* Global Summary Metric Bar */
    .global-overview-banner {{
      background: #ffffff;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
      padding: 18px 22px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }}

    .global-overview-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }}

    .overview-stat-tile {{
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 12px 18px;
    }}

    .overview-stat-label {{
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}

    .overview-stat-val {{
      font-size: 1.6rem;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }}

    .overview-stat-sub {{
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
      margin-top: 2px;
    }}

    /* 18 Circles Navigation Pill Bar */
    .circles-nav-wrapper {{
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 16px 20px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }}

    .circles-nav-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 10px;
    }}

    .circles-nav-title {{
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .circles-nav-right {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .chart-display-toggle {{
      display: inline-flex;
      background: #f1f5f9;
      padding: 2px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-color);
    }}

    .chart-toggle-btn {{
      border: none;
      background: transparent;
      padding: 4px 12px;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }}

    .chart-toggle-btn.active {{
      background: #ffffff;
      color: #0f172a;
      box-shadow: var(--shadow-sm);
    }}

    .circles-flex-nav {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }}

    .circle-tab-btn {{
      appearance: none;
      border: 1px solid var(--border-color);
      background: #ffffff;
      padding: 8px 14px;
      border-radius: var(--radius-full);
      cursor: pointer;
      transition: all 0.18s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.825rem;
      font-weight: 600;
      color: #334155;
      text-align: left;
    }}

    .circle-tab-btn:hover {{
      border-color: #cbd5e1;
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }}

    .circle-tab-btn.active {{
      border-color: transparent;
      color: #ffffff !important;
      box-shadow: var(--shadow-md);
      font-weight: 700;
    }}

    .circle-color-dot {{
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15);
    }}

    .circle-tab-btn.active .circle-color-dot {{
      background: #ffffff !important;
      box-shadow: 0 0 4px rgba(0,0,0,0.3);
    }}

    .circle-tab-badge {{
      font-size: 0.72rem;
      padding: 1px 7px;
      border-radius: var(--radius-full);
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
    }}

    .circle-tab-btn.active .circle-tab-badge {{
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }}

    /* Circle Detail Focus Section */
    .circle-focus-view {{
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    /* Print Only Header */
    .print-only-header {{
      display: none;
    }}

    /* Circle Banner Card */
    .circle-banner-card {{
      background: #ffffff;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }}

    .banner-top-stripe {{
      height: 6px;
      width: 100%;
    }}

    .banner-inner {{
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }}

    .circle-heading-group {{
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    .circle-large-avatar {{
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 1.35rem;
      font-weight: 800;
      box-shadow: var(--shadow-sm);
    }}

    .circle-info-col h2 {{
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }}

    .circle-info-col p {{
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
    }}

    .circle-stat-cards {{
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }}

    .mini-stat-card {{
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 8px 14px;
      min-width: 105px;
      text-align: center;
    }}

    .mini-stat-label {{
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }}

    .mini-stat-value {{
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }}

    .mini-stat-sub {{
      font-size: 0.7rem;
      color: var(--text-light);
      font-weight: 600;
    }}

    /* Download PDF Button on Banner */
    .circle-actions-group {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .btn-download-pdf {{
      display: inline-flex;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius-md);
      font-size: 0.825rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s ease;
      box-shadow: var(--shadow-sm);
    }}

    .btn-download-pdf:hover {{
      background: #1e293b;
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }}

    .btn-action-sheet {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-md);
      border: 1px solid #0284c7;
      background: #0284c7;
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: var(--shadow-sm);
    }}

    .btn-action-sheet:hover {{
      background: #0369a1;
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }}

    .btn-open-sheet {{
      background: #059669;
      border-color: #059669;
    }}

    .btn-open-sheet:hover {{
      background: #047857;
    }}

    .btn-reset-sheet {{
      background: #475569;
      border-color: #475569;
    }}

    .btn-reset-sheet:hover {{
      background: #334155;
    }}

    @keyframes spinIcon {{
      from {{ transform: rotate(0deg); }}
      to {{ transform: rotate(360deg); }}
    }}

    .spin-active {{
      animation: spinIcon 1s linear infinite;
      display: inline-block;
    }}

    /* 3 Graphs Layout */
    .graphs-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }}

    @media (max-width: 1100px) {{
      .graphs-grid {{
        grid-template-columns: repeat(2, 1fr);
      }}
    }}

    @media (max-width: 768px) {{
      .graphs-grid {{
        grid-template-columns: 1fr;
      }}
    }}

    .graph-card {{
      background: #ffffff;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
      padding: 18px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }}

    .graph-card:hover {{
      box-shadow: var(--shadow-md);
    }}

    .graph-card-header {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
    }}

    .graph-title-group h3 {{
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
    }}

    .graph-title-group span.subtitle {{
      font-size: 0.78rem;
      color: var(--text-muted);
      font-weight: 500;
    }}

    .chart-container-box {{
      position: relative;
      height: 270px;
      width: 100%;
      margin: 4px 0 14px;
    }}

    .empty-state-notice {{
      height: 270px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: var(--text-light);
      background: #f8fafc;
      border-radius: var(--radius-md);
      border: 1px dashed #cbd5e1;
      padding: 20px;
    }}

    .empty-state-notice p {{
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-top: 6px;
    }}

    /* Card Bottom Mini Stats Table (Cleaned up: No duplicate "Desktop" label to avoid overlap) */
    .graph-breakdown-row {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: auto;
      background: #f8fafc;
      border-radius: var(--radius-md);
      padding: 8px 10px;
      border: 1px solid #f1f5f9;
    }}

    .breakdown-item {{
      text-align: center;
    }}

    .breakdown-nums {{
      font-size: 0.8rem;
      font-weight: 700;
      color: #0f172a;
    }}

    .breakdown-nums span.req {{
      color: #dc2626;
      font-weight: 800;
    }}

    .breakdown-nums span.av {{
      color: #059669;
      font-size: 0.75rem;
    }}

    /* Offices Accordion / Drilldown Section */
    .offices-drilldown-card {{
      background: #ffffff;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }}

    .drilldown-header {{
      padding: 14px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      cursor: pointer;
      background: #ffffff;
      user-select: none;
      transition: background 0.15s ease;
      flex-wrap: wrap;
    }}

    .drilldown-header:hover {{
      background: #f8fafc;
    }}

    .drilldown-title {{
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .drilldown-badge {{
      font-size: 0.75rem;
      font-weight: 700;
      background: #f1f5f9;
      color: #475569;
      padding: 3px 8px;
      border-radius: var(--radius-full);
    }}

    .drilldown-actions {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .table-search-input {{
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 6px 12px;
      font-size: 0.8rem;
      color: #0f172a;
      outline: none;
      width: 200px;
    }}

    .table-search-input:focus {{
      border-color: #2563eb;
    }}

    .table-container {{
      max-height: 440px;
      overflow-y: auto;
      border-top: 1px solid var(--border-color);
    }}

    table.data-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.825rem;
      text-align: left;
    }}

    table.data-table th {{
      position: sticky;
      top: 0;
      background: #f8fafc;
      padding: 10px 14px;
      font-weight: 700;
      color: #475569;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
      z-index: 10;
    }}

    table.data-table td {{
      padding: 9px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }}

    table.data-table tr:hover td {{
      background: #f8fafc;
    }}

    .badge-cat {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 0.725rem;
      font-weight: 700;
    }}

    .badge-cat-circle {{ background: #eff6ff; color: #1d4ed8; }}
    .badge-cat-division {{ background: #f0fdf4; color: #15803d; }}
    .badge-cat-range {{ background: #fefce8; color: #a16207; }}

    /* "All 18 Circles" View Layout */
    .all-circles-view {{
      display: none;
      flex-direction: column;
      gap: 28px;
    }}

    .circle-card-block {{
      background: #ffffff;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }}

    .circle-block-header {{
      padding: 14px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }}

    .circle-block-body {{
      padding: 18px;
    }}

    /* ========================================================= */
    /* PIXEL-PERFECT A4 LANDSCAPE PRINT & PDF STYLING           */
    /* All 3 graphs guaranteed to fit side-by-side without clip */
    /* ========================================================= */
    @media print {{
      @page {{
        size: A4 landscape;
        margin: 6mm 8mm;
      }}
      html, body {{
        background: #ffffff !important;
        color: #0f172a !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }}
      .top-header,
      .global-overview-banner,
      .circles-nav-wrapper,
      .view-mode-switch,
      .chart-display-toggle,
      .btn-download-pdf,
      .circle-actions-group,
      .drilldown-actions,
      #drilldownArrow,
      .all-circles-view,
      .graph-breakdown-row {{
        display: none !important;
      }}
      .print-only-header {{
        display: flex !important;
        align-items: baseline !important;
        justify-content: space-between !important;
        border-bottom: 2px solid #0f172a !important;
        padding-bottom: 4px !important;
        margin-bottom: 8px !important;
        width: 100% !important;
      }}
      .dashboard-body {{
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }}
      .circle-focus-view {{
        gap: 8px !important;
        width: 100% !important;
      }}
      .circle-banner-card {{
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        margin-bottom: 8px !important;
        width: 100% !important;
      }}
      .banner-top-stripe {{
        height: 4px !important;
      }}
      .banner-inner {{
        padding: 8px 14px !important;
      }}
      .circle-large-avatar {{
        width: 38px !important;
        height: 38px !important;
        font-size: 1rem !important;
        border-radius: 6px !important;
      }}
      .circle-info-col h2 {{
        font-size: 1.2rem !important;
        line-height: 1.2 !important;
      }}
      .circle-info-col p {{
        font-size: 0.75rem !important;
      }}
      .circle-stat-cards {{
        gap: 8px !important;
      }}
      .mini-stat-card {{
        padding: 4px 10px !important;
        min-width: 80px !important;
        border-radius: 6px !important;
      }}
      .mini-stat-label {{
        font-size: 0.65rem !important;
      }}
      .mini-stat-value {{
        font-size: 1.1rem !important;
        margin-top: 1px !important;
      }}
      .mini-stat-sub {{
        font-size: 0.65rem !important;
      }}
      .graphs-grid {{
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        align-items: stretch !important;
        width: 100% !important;
        gap: 8px !important;
        page-break-inside: avoid !important;
      }}
      .graph-card {{
        flex: 1 1 0 !important;
        width: 32.5% !important;
        max-width: 32.8% !important;
        min-width: 0 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 8px !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        padding: 8px 10px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }}
      .graph-card-header {{
        margin-bottom: 4px !important;
        padding-bottom: 4px !important;
      }}
      .graph-title-group h3 {{
        font-size: 0.95rem !important;
      }}
      .graph-title-group span.subtitle {{
        font-size: 0.72rem !important;
      }}
      .chart-container-box {{
        height: 220px !important;
        width: 100% !important;
        margin: 2px 0 0 !important;
      }}
      .chart-container-box canvas {{
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
      }}
      .empty-state-notice {{
        height: 220px !important;
      }}
      .offices-drilldown-card {{
        display: block !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 8px !important;
        box-shadow: none !important;
        margin-top: 10px !important;
        width: 100% !important;
        background: #ffffff !important;
      }}
      .drilldown-header {{
        padding: 8px 14px !important;
        background: #f8fafc !important;
        border-bottom: 2px solid #0f172a !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }}
      .drilldown-title {{
        font-size: 1rem !important;
        font-weight: 800 !important;
        color: #0f172a !important;
      }}
      .drilldown-badge {{
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        background: #e2e8f0 !important;
        color: #1e293b !important;
        padding: 2px 8px !important;
        border-radius: 9999px !important;
      }}
      .table-container,
      #drilldownTableContainer {{
        display: block !important;
        max-height: none !important;
        overflow: visible !important;
        height: auto !important;
      }}
      table.data-table {{
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8pt !important;
        line-height: 1.3 !important;
      }}
      table.data-table thead {{
        display: table-header-group !important;
      }}
      table.data-table th {{
        background: #f1f5f9 !important;
        color: #0f172a !important;
        font-size: 7.5pt !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.03em !important;
        padding: 6px 7px !important;
        border-bottom: 1.5px solid #94a3b8 !important;
        position: static !important;
        white-space: nowrap !important;
      }}
      table.data-table tr {{
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }}
      table.data-table tr:nth-child(even) td {{
        background: #f8fafc !important;
      }}
      table.data-table td {{
        padding: 4.5px 7px !important;
        border-bottom: 1px solid #e2e8f0 !important;
        color: #334155 !important;
        font-size: 7.5pt !important;
      }}
      .badge-cat {{
        font-size: 6.5pt !important;
        padding: 1px 5px !important;
      }}
    }}
  </style>
  <script src="chart.min.js"></script>
  <script src="xlsx.full.min.js"></script>
  <script>
    if (typeof Chart === 'undefined') {{
      document.write('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\\/script>');
    }}
  </script>
</head>
<body>

  <!-- Top Sticky Bar -->
  <header class="top-header">
    <div class="header-container">
      <div class="brand-title">
        IT Requirment
        <span class="brand-badge">18 Circles</span>
      </div>

      <div class="header-kpi-group">
        <div class="kpi-pill">
          Offices: <span class="value" id="kpi-offices">{stats['total_offices']}</span>
        </div>
        <div class="kpi-pill">
          Desktop Req: <span class="value" id="kpi-desk-req" style="color: #2563eb;">{stats['desk_req']}</span>
        </div>
        <div class="kpi-pill">
          Laptop Req: <span class="value" id="kpi-lap-req" style="color: #7c3aed;">{stats['lap_req']}</span>
        </div>
        <div class="kpi-pill">
          Printer Req: <span class="value" id="kpi-print-req" style="color: #059669;">{stats['print_req']}</span>
        </div>
        <div class="kpi-pill">
          Total Req: <span class="value" id="kpi-total-req" style="color: #dc2626;">{stats['total_fresh_req']}</span>
        </div>

        <button class="btn-action-sheet" id="btnSyncSheet" onclick="fetchLiveGoogleSheet(true)" title="Fetch live updates directly from Google Spreadsheet">
          <span id="syncIcon" style="display:inline-block;">🔄</span> Sync Sheet
        </button>
        <a href="https://docs.google.com/spreadsheets/d/1NPkI4mRBrN3u0QU8kKp269qT8UQu4Q6Rqc6zdzfi93U/edit?gid=156417651#gid=156417651" target="_blank" rel="noopener noreferrer" class="btn-action-sheet btn-open-sheet" title="Open live Google Spreadsheet in new tab">
          ↗️ Open Sheet
        </a>
        <button class="btn-action-sheet btn-reset-sheet" id="btnResetData" style="display:none;" onclick="resetToDefaultData()" title="Reset to original Excel data">
          ↩️ Reset
        </button>

        <div class="switch-pill-group">
          <button class="mode-btn active" id="btnFocusMode" onclick="switchView('focus')">
            Circle Focus
          </button>
          <button class="mode-btn" id="btnAllMode" onclick="switchView('all')">
            All 18 Circles
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="dashboard-body">

    <!-- Global Summary Metric Bar -->
    <section class="global-overview-banner">
      <div class="global-overview-grid">
        <div class="overview-stat-tile" style="border-left: 4px solid #2563eb;">
          <div class="overview-stat-label">Total Desktop Computers</div>
          <div class="overview-stat-val" id="ov-desk-val" style="color: #2563eb;">{stats['desk_req']}</div>
          <div class="overview-stat-sub" id="ov-desk-sub">Fresh Req &bull; {stats['desk_av']} Working Available</div>
        </div>
        <div class="overview-stat-tile" style="border-left: 4px solid #7c3aed;">
          <div class="overview-stat-label">Total Laptops</div>
          <div class="overview-stat-val" id="ov-lap-val" style="color: #7c3aed;">{stats['lap_req']}</div>
          <div class="overview-stat-sub" id="ov-lap-sub">Fresh Req &bull; {stats['lap_av']} Working Available</div>
        </div>
        <div class="overview-stat-tile" style="border-left: 4px solid #059669;">
          <div class="overview-stat-label">Total Printers (MFP)</div>
          <div class="overview-stat-val" id="ov-print-val" style="color: #059669;">{stats['print_req']}</div>
          <div class="overview-stat-sub" id="ov-print-sub">Fresh Req &bull; {stats['print_av']} Working Available</div>
        </div>
        <div class="overview-stat-tile" style="border-left: 4px solid #dc2626;">
          <div class="overview-stat-label">Total Fresh IT Demand</div>
          <div class="overview-stat-val" id="ov-tot-val" style="color: #dc2626;">{stats['total_fresh_req']}</div>
          <div class="overview-stat-sub" id="ov-tot-sub">Across all 18 Circles &amp; {stats['total_offices']} Offices</div>
        </div>
      </div>
    </section>

    <!-- 18 Circles Navigation Pill Bar -->
    <nav class="circles-nav-wrapper">
      <div class="circles-nav-header">
        <div class="circles-nav-title">
          <span>Select Circle (18 Total &bull; 1 Color 1 Circle)</span>
        </div>
        <div class="circles-nav-right">
          <!-- Graph Asset Mode Toggle: With Available vs Req Only -->
          <div class="chart-display-toggle">
            <button class="chart-toggle-btn active" id="btnModeBoth" onclick="setChartDataMode('both')">
              With Available (Both)
            </button>
            <button class="chart-toggle-btn" id="btnModeReqOnly" onclick="setChartDataMode('req_only')">
              Requirement Only
            </button>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Currently Viewing: <strong id="navActiveCircleName">AAZP</strong>
          </div>
        </div>
      </div>
      <div class="circles-flex-nav" id="circlesNavContainer">
        <!-- Rendered by JS -->
      </div>
    </nav>

    <!-- Print Only Header (Rendered cleanly on top of PDF/Print) -->
    <div class="print-only-header">
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em;">IT Requirment</h1>
      <h2 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0;" id="printHeadingDivisionName">AAZP Circle</h2>
    </div>

    <!-- View Mode 1: Circle Focus View -->
    <div id="circleFocusView" class="circle-focus-view">
      <!-- Injected by renderCircleFocus() -->
    </div>

    <!-- View Mode 2: All 18 Circles View -->
    <div id="allCirclesView" class="all-circles-view">
      <!-- Injected by renderAllCircles() -->
    </div>

  </main>

  <script>
    // Embedded Data
    const RAW_DATA = {json_data};
    let DATA = RAW_DATA;
    let CIRCLES = DATA.circles;
    let CIRCLE_ORDER = DATA.circle_order;
    let GRAND_STATS = DATA.grand_stats;

    const GOOGLE_SHEET_CONFIG = {{
      sheetId: '1NPkI4mRBrN3u0QU8kKp269qT8UQu4Q6Rqc6zdzfi93U',
      gid: '156417651',
      sheetName: 'Requirement ',
      exportUrl: 'https://docs.google.com/spreadsheets/d/1NPkI4mRBrN3u0QU8kKp269qT8UQu4Q6Rqc6zdzfi93U/export?format=xlsx',
      viewUrl: 'https://docs.google.com/spreadsheets/d/1NPkI4mRBrN3u0QU8kKp269qT8UQu4Q6Rqc6zdzfi93U/edit?gid=156417651#gid=156417651'
    }};

    // Parse URL search params & hash supporting URL encoding (e.g. #Working%20Plan or ?circle=Working+Plan)
    const urlParams = new URLSearchParams(window.location.search);
    const circleParam = urlParams.get('circle');
    let hashVal = '';
    try {{
      hashVal = decodeURIComponent(window.location.hash.replace(/^#/, '').replace(/\\+/g, ' ')).trim();
    }} catch (e) {{
      hashVal = window.location.hash.replace(/^#/, '').trim();
    }}

    let currentCircle = 'AAZP';
    if (circleParam && CIRCLES[circleParam]) {{
      currentCircle = circleParam;
    }} else if (hashVal && CIRCLES[hashVal]) {{
      currentCircle = hashVal;
    }}

    let currentMode = (circleParam === 'all' || hashVal === 'all') ? 'all' : 'focus';
    let chartDataMode = 'both'; // 'both' (with available) or 'req_only'
    if (urlParams.get('mode') === 'req_only') {{
      chartDataMode = 'req_only';
    }}
    const chartInstances = {{}};

    // Custom Chart.js Plugin to draw data values above bars
    const barValuesPlugin = {{
      id: 'barValuesPlugin',
      afterDatasetsDraw(chart) {{
        const {{ ctx }} = chart;
        chart.data.datasets.forEach((dataset, i) => {{
          const meta = chart.getDatasetMeta(i);
          if (!meta.hidden) {{
            meta.data.forEach((bar, index) => {{
              const val = dataset.data[index];
              if (val > 0) {{
                ctx.save();
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(val, bar.x, bar.y - 3);
                ctx.restore();
              }}
            }});
          }}
        }});
      }}
    }};

    // Floating Live Toast Notification Engine (Non-intrusive, no popups/modals)
    function showLiveToast(message, type = 'info', duration = 4500) {{
      let container = document.getElementById('liveToastContainer');
      if (!container) {{
        container = document.createElement('div');
        container.id = 'liveToastContainer';
        container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
        document.body.appendChild(container);
      }}
      const toast = document.createElement('div');
      toast.style.cssText = 'background:#0f172a; color:#f8fafc; border:1px solid #334155; padding:12px 18px; border-radius:10px; font-size:0.88rem; font-weight:600; box-shadow:0 10px 25px -5px rgba(0,0,0,0.5); display:flex; align-items:center; gap:10px; pointer-events:auto; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); transform:translateY(15px); opacity:0;';
      if (type === 'success') {{
        toast.style.background = '#064e3b';
        toast.style.borderColor = '#059669';
      }} else if (type === 'error') {{
        toast.style.background = '#7f1d1d';
        toast.style.borderColor = '#dc2626';
      }} else if (type === 'warning') {{
        toast.style.background = '#78350f';
        toast.style.borderColor = '#d97706';
      }}
      toast.innerHTML = message;
      container.appendChild(toast);
      requestAnimationFrame(() => {{
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
      }});
      setTimeout(() => {{
        toast.style.transform = 'translateY(15px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
      }}, duration);
    }}

    // GViz JSONP Engine (Matches proven technique in RFRL spread Sheet dashboard)
    function fetchGvizJsonp(sheetId, sheetOrGid) {{
      return new Promise((resolve, reject) => {{
        const callbackName = 'gvizCallback_' + Math.floor(Math.random() * 10000000);
        const script = document.createElement('script');
        const timeout = setTimeout(() => {{
          cleanup();
          reject(new Error(`Timeout fetching "${{sheetOrGid}}"`));
        }}, 10000);

        function cleanup() {{
          clearTimeout(timeout);
          if (script.parentNode) script.parentNode.removeChild(script);
          delete window[callbackName];
        }}

        window[callbackName] = function(data) {{
          cleanup();
          if (data && data.table) {{
            resolve(data.table);
          }} else {{
            reject(new Error(`Invalid data received for "${{sheetOrGid}}"`));
          }}
        }};

        script.onerror = function() {{
          cleanup();
          reject(new Error(`Network/access error loading "${{sheetOrGid}}"`));
        }};

        const isGid = /^\\d+$/.test(String(sheetOrGid).trim());
        const param = isGid ? `gid=${{sheetOrGid}}` : `sheet=${{encodeURIComponent(sheetOrGid)}}`;
        script.src = `https://docs.google.com/spreadsheets/d/${{sheetId}}/gviz/tq?${{param}}&tqx=responseHandler:${{callbackName}}&t=${{Date.now()}}`;
        document.head.appendChild(script);
      }});
    }}

    async function fetchSheetGvizCandidates(sheetId, candidates) {{
      for (const target of candidates) {{
        try {{
          const table = await fetchGvizJsonp(sheetId, target);
          if (table && table.rows && table.rows.length > 0) {{
            return table;
          }}
        }} catch (e) {{
          console.warn(`Candidate "${{target}}" error:`, e.message);
        }}
      }}
      throw new Error(`Could not load any candidate tabs: ${{candidates.join(', ')}}`);
    }}

    // Reconstruct Normalized Dashboard Object from 2D Rows
    function buildDashboardFromRows(rows) {{
      if (!rows || rows.length < 3) return null;
      const defaultCircleColors = {{
        'AAZP': '#2563EB', 'ATR': '#059669', 'Chennai': '#D97706', 'Dharmapuri': '#DC2626',
        'Dindigul': '#7C3AED', 'Erode': '#0D9488', 'Headquarters': '#4F46E5', 'MTR': '#16A34A',
        'Research': '#EA580C', 'Salem': '#DB2777', 'SMTR': '#0891B2', 'KMTR': '#475569',
        'Trichy': '#9333EA', 'Vellore': '#B45309', 'Villupuram': '#0284C7', 'Working Plan': '#65A30D',
        'TNFA': '#BE185D', 'TNFWCCB': '#0F766E'
      }};
      const extraPalette = ['#0284C7', '#7C3AED', '#059669', '#EA580C', '#E11D48', '#4F46E5', '#16A34A', '#D97706', '#9333EA'];

      const dashboardData = {{}};
      Object.keys(defaultCircleColors).forEach(c => {{
        dashboardData[c] = {{
          name: c,
          color: defaultCircleColors[c],
          total_offices: 0,
          desk_av: 0, desk_req: 0,
          lap_av: 0, lap_req: 0,
          print_av: 0, print_req: 0,
          total_req: 0,
          categories: {{
            'Circle Office': {{ name: 'Circle Offices', count: 0, desk_av: 0, desk_req: 0, lap_av: 0, lap_req: 0, print_av: 0, print_req: 0, offices: [] }},
            'Division Office': {{ name: 'Division Offices', count: 0, desk_av: 0, desk_req: 0, lap_av: 0, lap_req: 0, print_av: 0, print_req: 0, offices: [] }},
            'Range Office': {{ name: 'Range Offices', count: 0, desk_av: 0, desk_req: 0, lap_av: 0, lap_req: 0, print_av: 0, print_req: 0, offices: [] }}
          }}
        }};
      }});

      const parseNum = (v) => {{
        if (typeof v === 'number') return Math.max(0, Math.round(v));
        if (!v) return 0;
        const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        return isNaN(n) ? 0 : Math.max(0, n);
      }};

      let parsedCount = 0;
      for (let r = 0; r < rows.length; r++) {{
        const row = rows[r];
        if (!row || row.length < 4) continue;
        const cVal = String(row[1] || '').trim();
        if (!cVal || cVal.toLowerCase().includes('name of') || cVal.toLowerCase().includes('circle / hq') || cVal.toLowerCase().includes('sl. no')) continue;

        // Dynamically support any newly added circle from Google Sheet
        if (!dashboardData[cVal]) {{
          const color = defaultCircleColors[cVal] || extraPalette[Object.keys(dashboardData).length % extraPalette.length];
          dashboardData[cVal] = {{
            name: cVal,
            color: color,
            total_offices: 0,
            desk_av: 0, desk_req: 0,
            lap_av: 0, lap_req: 0,
            print_av: 0, print_req: 0,
            total_req: 0,
            categories: {{
              'Circle Office': {{ name: 'Circle Offices', count: 0, desk_av: 0, desk_req: 0, lap_av: 0, lap_req: 0, print_av: 0, print_req: 0, offices: [] }},
              'Division Office': {{ name: 'Division Offices', count: 0, desk_av: 0, desk_req: 0, lap_av: 0, lap_req: 0, print_av: 0, print_req: 0, offices: [] }},
              'Range Office': {{ name: 'Range Offices', count: 0, desk_av: 0, desk_req: 0, lap_av: 0, lap_req: 0, print_av: 0, print_req: 0, offices: [] }}
            }}
          }};
        }}

        let catVal = String(row[5] || '').trim();
        if (!catVal || !['Circle Office', 'Division Office', 'Range Office'].includes(catVal)) {{
          if (catVal.toLowerCase().includes('circle')) catVal = 'Circle Office';
          else if (catVal.toLowerCase().includes('division')) catVal = 'Division Office';
          else catVal = 'Range Office';
        }}

        const divOffice = String(row[2] || '').trim();
        const officeName = String(row[3] || '').trim();
        const deskAv = parseNum(row[4]);
        const deskReq = parseNum(row[6]);
        const lapAv = parseNum(row[7]);
        const lapReq = parseNum(row[8]);
        const printAv = parseNum(row[9]);
        const printReq = parseNum(row[10]);
        const remarks = String(row[11] || '').trim();

        const cObj = dashboardData[cVal];
        cObj.total_offices += 1;
        cObj.desk_av += deskAv;
        cObj.desk_req += deskReq;
        cObj.lap_av += lapAv;
        cObj.lap_req += lapReq;
        cObj.print_av += printAv;
        cObj.print_req += printReq;
        cObj.total_req += (deskReq + lapReq + printReq);

        const catObj = cObj.categories[catVal];
        catObj.count += 1;
        catObj.desk_av += deskAv;
        catObj.desk_req += deskReq;
        catObj.lap_av += lapAv;
        catObj.lap_req += lapReq;
        catObj.print_av += printAv;
        catObj.print_req += printReq;
        catObj.offices.push({{
          name: officeName,
          div: divOffice,
          desk_av: deskAv, desk_req: deskReq,
          lap_av: lapAv, lap_req: lapReq,
          print_av: printAv, print_req: printReq,
          remarks: remarks
        }});
        parsedCount++;
      }}

      if (parsedCount === 0) return null;

      const activeCircles = Object.keys(dashboardData).filter(c => dashboardData[c].total_offices > 0);
      const circleOrder = activeCircles.length > 0 ? activeCircles : Object.keys(dashboardData);

      const grandStats = {{
        total_circles: circleOrder.length,
        total_offices: parsedCount,
        desk_av: circleOrder.reduce((s, c) => s + dashboardData[c].desk_av, 0),
        desk_req: circleOrder.reduce((s, c) => s + dashboardData[c].desk_req, 0),
        lap_av: circleOrder.reduce((s, c) => s + dashboardData[c].lap_av, 0),
        lap_req: circleOrder.reduce((s, c) => s + dashboardData[c].lap_req, 0),
        print_av: circleOrder.reduce((s, c) => s + dashboardData[c].print_av, 0),
        print_req: circleOrder.reduce((s, c) => s + dashboardData[c].print_req, 0)
      }};
      grandStats.total_fresh_req = grandStats.desk_req + grandStats.lap_req + grandStats.print_req;

      return {{
        circles: dashboardData,
        circle_order: circleOrder,
        grand_stats: grandStats
      }};
    }}

    function processGvizTable(table) {{
      if (!table || !table.rows) return null;
      const rows = [];
      table.rows.forEach(r => {{
        if (!r || !r.c) return;
        const rowVals = r.c.map(cell => {{
          if (!cell) return '';
          if (cell.v !== null && cell.v !== undefined) return cell.v;
          if (cell.f !== null && cell.f !== undefined) return cell.f;
          return '';
        }});
        rows.push(rowVals);
      }});
      return buildDashboardFromRows(rows);
    }}

    function processExcelWorkbook(wb) {{
      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return null;
      let targetSheetName = wb.SheetNames.find(n => n.trim().toLowerCase().includes('requirement')) || wb.SheetNames[0];
      const ws = wb.Sheets[targetSheetName];
      if (!ws) return null;
      if (typeof XLSX === 'undefined') return null;
      const rows = XLSX.utils.sheet_to_json(ws, {{ header: 1, defval: '' }});
      return buildDashboardFromRows(rows);
    }}

    async function fetchLiveGoogleSheet(isManual = false) {{
      const syncIcon = document.getElementById('syncIcon');
      if (syncIcon) syncIcon.classList.add('spin-active');
      if (isManual) {{
        showLiveToast('<span style="display:inline-block;" class="spin-active">🔄</span> Connecting to live Google Sheet...', 'info', 3000);
      }}

      // Method 1: Try GViz JSONP (matching proven RFRL spread Sheet dashboard engine)
      try {{
        const candidateSheets = ['156417651', 'Requirement ', 'Requirement', 'Requirement IT', 'Sheet1'];
        const table = await fetchSheetGvizCandidates(GOOGLE_SHEET_CONFIG.sheetId, candidateSheets);
        const parsed = processGvizTable(table);
        if (parsed && parsed.grand_stats && parsed.grand_stats.total_offices > 0) {{
          applySyncedData(parsed, 'Google Spreadsheet');
          if (syncIcon) syncIcon.classList.remove('spin-active');
          return;
        }}
      }} catch (err) {{
        console.warn('GViz JSONP sync notice:', err.message);
      }}

      // Method 2: Fetch direct XLSX export via fetch and parse with SheetJS
      try {{
        const response = await fetch(GOOGLE_SHEET_CONFIG.exportUrl, {{ cache: 'no-store' }});
        if (response.ok) {{
          const buffer = await response.arrayBuffer();
          if (typeof XLSX !== 'undefined' && buffer && buffer.byteLength > 2000) {{
            const wb = XLSX.read(new Uint8Array(buffer), {{ type: 'array' }});
            const parsed = processExcelWorkbook(wb);
            if (parsed && parsed.grand_stats && parsed.grand_stats.total_offices > 0) {{
              applySyncedData(parsed, 'Live Google Sheet (Export)');
              if (syncIcon) syncIcon.classList.remove('spin-active');
              return;
            }}
          }}
        }}
      }} catch (err) {{
        console.warn('Direct XLSX fetch note:', err);
      }}

      if (syncIcon) syncIcon.classList.remove('spin-active');

      // Honest status notification without modals or popups
      if (isManual) {{
        showLiveToast('⚠️ Cannot connect to Google Sheet. Please check in Google Sheets: Click <strong>Share</strong> (top right) and set General access to <strong>"Anyone with the link" (Viewer)</strong>.', 'warning', 8000);
      }}
    }}

    function applySyncedData(parsed, sourceName) {{
      DATA = parsed;
      CIRCLES = DATA.circles;
      CIRCLE_ORDER = DATA.circle_order;
      GRAND_STATS = DATA.grand_stats;
      localStorage.setItem('IT_REQ_CUSTOM_DATA', JSON.stringify(parsed));
      updateUIWithData();
      const resetBtn = document.getElementById('btnResetData');
      if (resetBtn) resetBtn.style.display = 'inline-flex';
      showLiveToast(`⚡ Live Sheet Synced! ${{parsed.grand_stats.total_offices}} offices updated from ${{sourceName}}.`, 'success', 5000);
    }}

    function resetToDefaultData() {{
      if (confirm("Reset dashboard to original embedded Excel snapshot?")) {{
        localStorage.removeItem('IT_REQ_CUSTOM_DATA');
        DATA = RAW_DATA;
        CIRCLES = DATA.circles;
        CIRCLE_ORDER = DATA.circle_order;
        GRAND_STATS = DATA.grand_stats;
        updateUIWithData();
        const resetBtn = document.getElementById('btnResetData');
        if (resetBtn) resetBtn.style.display = 'none';
        showLiveToast('Reset to original embedded snapshot data.', 'info', 3500);
      }}
    }}

    function updateUIWithData() {{
      // 1. Update Header KPI Pill values
      const elOffices = document.getElementById('kpi-offices');
      if (elOffices) elOffices.textContent = GRAND_STATS.total_offices;
      const elDeskReq = document.getElementById('kpi-desk-req');
      if (elDeskReq) elDeskReq.textContent = GRAND_STATS.desk_req;
      const elLapReq = document.getElementById('kpi-lap-req');
      if (elLapReq) elLapReq.textContent = GRAND_STATS.lap_req;
      const elPrintReq = document.getElementById('kpi-print-req');
      if (elPrintReq) elPrintReq.textContent = GRAND_STATS.print_req;
      const elTotReq = document.getElementById('kpi-total-req');
      if (elTotReq) elTotReq.textContent = GRAND_STATS.total_fresh_req;

      // 2. Update Global Overview stat tiles
      const ovDeskVal = document.getElementById('ov-desk-val');
      if (ovDeskVal) ovDeskVal.textContent = GRAND_STATS.desk_req;
      const ovDeskSub = document.getElementById('ov-desk-sub');
      if (ovDeskSub) ovDeskSub.innerHTML = `Fresh Req &bull; ${{GRAND_STATS.desk_av}} Working Available`;

      const ovLapVal = document.getElementById('ov-lap-val');
      if (ovLapVal) ovLapVal.textContent = GRAND_STATS.lap_req;
      const ovLapSub = document.getElementById('ov-lap-sub');
      if (ovLapSub) ovLapSub.innerHTML = `Fresh Req &bull; ${{GRAND_STATS.lap_av}} Working Available`;

      const ovPrintVal = document.getElementById('ov-print-val');
      if (ovPrintVal) ovPrintVal.textContent = GRAND_STATS.print_req;
      const ovPrintSub = document.getElementById('ov-print-sub');
      if (ovPrintSub) ovPrintSub.innerHTML = `Fresh Req &bull; ${{GRAND_STATS.print_av}} Working Available`;

      const ovTotVal = document.getElementById('ov-tot-val');
      if (ovTotVal) ovTotVal.textContent = GRAND_STATS.total_fresh_req;
      const ovTotSub = document.getElementById('ov-tot-sub');
      if (ovTotSub) ovTotSub.innerHTML = `Across all ${{GRAND_STATS.total_circles || 18}} Circles &amp; ${{GRAND_STATS.total_offices}} Offices`;

      // 3. Re-render Circle Navigation Pills
      renderCirclesNav();

      // 4. Re-render Active View
      if (currentMode === 'all') {{
        renderAllCircles();
      }} else {{
        renderCircleFocus(currentCircle);
      }}
    }}

    // Initialize Dashboard
    document.addEventListener('DOMContentLoaded', () => {{
      // Restore cached live sync if available
      const cachedData = localStorage.getItem('IT_REQ_CUSTOM_DATA');
      if (cachedData) {{
        try {{
          const parsed = JSON.parse(cachedData);
          if (parsed && parsed.grand_stats && parsed.grand_stats.total_offices > 0) {{
            DATA = parsed;
            CIRCLES = DATA.circles;
            CIRCLE_ORDER = DATA.circle_order;
            GRAND_STATS = DATA.grand_stats;
            const resetBtn = document.getElementById('btnResetData');
            if (resetBtn) resetBtn.style.display = 'inline-flex';
          }}
        }} catch (e) {{
          localStorage.removeItem('IT_REQ_CUSTOM_DATA');
        }}
      }}

      document.getElementById('navActiveCircleName').textContent = currentCircle;
      document.getElementById('printHeadingDivisionName').textContent = `${{currentCircle}} Circle`;
      if (chartDataMode === 'req_only') {{
        document.getElementById('btnModeBoth').classList.remove('active');
        document.getElementById('btnModeReqOnly').classList.add('active');
      }}

      updateUIWithData();
    }});

    // Silent Drag-and-Drop XLSX listener without prompt
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {{
      e.preventDefault();
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) return;
      const reader = new FileReader();
      reader.onload = function(evt) {{
        try {{
          if (typeof XLSX === 'undefined') return;
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, {{ type: 'array' }});
          const parsed = processExcelWorkbook(wb);
          if (parsed && parsed.grand_stats && parsed.grand_stats.total_offices > 0) {{
            applySyncedData(parsed, `Dropped file (${{file.name}})`);
          }}
        }} catch (err) {{
          console.error('Drop parse error:', err);
        }}
      }};
      reader.readAsArrayBuffer(file);
    }});

    function setChartDataMode(mode) {{
      chartDataMode = mode;
      const btnBoth = document.getElementById('btnModeBoth');
      const btnReqOnly = document.getElementById('btnModeReqOnly');
      if (mode === 'both') {{
        btnBoth.classList.add('active');
        btnReqOnly.classList.remove('active');
      }} else {{
        btnBoth.classList.remove('active');
        btnReqOnly.classList.add('active');
      }}

      if (currentMode === 'all') {{
        renderAllCircles();
      }} else {{
        renderCircleFocus(currentCircle);
      }}
    }}

    function switchView(mode) {{
      currentMode = mode;
      const btnFocus = document.getElementById('btnFocusMode');
      const btnAll = document.getElementById('btnAllMode');
      const focusView = document.getElementById('circleFocusView');
      const allView = document.getElementById('allCirclesView');

      if (mode === 'focus') {{
        btnFocus.classList.add('active');
        btnAll.classList.remove('active');
        focusView.style.display = 'flex';
        allView.style.display = 'none';
        window.location.hash = currentCircle;
        renderCircleFocus(currentCircle);
      }} else {{
        btnFocus.classList.remove('active');
        btnAll.classList.add('active');
        focusView.style.display = 'none';
        allView.style.display = 'flex';
        window.location.hash = 'all';
        renderAllCircles();
      }}
    }}

    window.addEventListener('hashchange', () => {{
      let h = '';
      try {{
        h = decodeURIComponent(window.location.hash.replace(/^#/, '').replace(/\\+/g, ' ')).trim();
      }} catch (e) {{
        h = window.location.hash.replace(/^#/, '').trim();
      }}
      if (h === 'all') {{
        switchView('all');
      }} else if (h && CIRCLES[h] && h !== currentCircle) {{
        selectCircle(h);
      }}
    }});

    function selectCircle(circleName) {{
      currentCircle = circleName;
      window.location.hash = circleName;
      document.getElementById('navActiveCircleName').textContent = circleName;
      document.getElementById('printHeadingDivisionName').textContent = `${{circleName}} Circle`;
      updateNavActiveState();
      if (currentMode === 'all') {{
        switchView('focus');
      }} else {{
        renderCircleFocus(currentCircle);
      }}
      window.scrollTo({{ top: 190, behavior: 'smooth' }});
    }}

    function renderCirclesNav() {{
      const container = document.getElementById('circlesNavContainer');
      container.innerHTML = '';

      CIRCLE_ORDER.forEach((cName) => {{
        const c = CIRCLES[cName];
        const btn = document.createElement('button');
        btn.className = `circle-tab-btn ${{cName === currentCircle ? 'active' : ''}}`;
        btn.id = `nav-tab-${{cName}}`;
        btn.onclick = () => selectCircle(cName);

        if (cName === currentCircle) {{
          btn.style.backgroundColor = c.color;
          btn.style.borderColor = c.color;
        }} else {{
          btn.style.backgroundColor = '#ffffff';
        }}

        btn.innerHTML = `
          <span class="circle-color-dot" style="background-color: ${{c.color}};"></span>
          <span>${{cName}}</span>
          <span class="circle-tab-badge">${{c.total_req}}</span>
        `;
        container.appendChild(btn);
      }});
    }}

    function updateNavActiveState() {{
      CIRCLE_ORDER.forEach(cName => {{
        const btn = document.getElementById(`nav-tab-${{cName}}`);
        const c = CIRCLES[cName];
        if (btn) {{
          if (cName === currentCircle) {{
            btn.classList.add('active');
            btn.style.backgroundColor = c.color;
            btn.style.borderColor = c.color;
          }} else {{
            btn.classList.remove('active');
            btn.style.backgroundColor = '#ffffff';
            btn.style.borderColor = 'var(--border-color)';
          }}
        }}
      }});
    }}

    function cleanupCharts(prefix) {{
      Object.keys(chartInstances).forEach(key => {{
        if (!prefix || key.startsWith(prefix)) {{
          if (chartInstances[key]) {{
            chartInstances[key].destroy();
            delete chartInstances[key];
          }}
        }}
      }});
    }}

    // Download PDF for the given circle (triggers direct download of the pre-generated PDF)
    function downloadCirclePDF(circleName) {{
      const safeName = circleName.replace(/\\s+/g, '_');
      const filename = `IT_Requirment_${{safeName}}.pdf`;
      const pdfPath = `PDFs/${{filename}}`;

      const link = document.createElement('a');
      link.href = pdfPath;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }}

    // Render Single Circle Focus View
    function renderCircleFocus(cName) {{
      cleanupCharts('focus_');
      const c = CIRCLES[cName];
      const container = document.getElementById('circleFocusView');
      document.getElementById('printHeadingDivisionName').textContent = `${{cName}} Circle`;

      container.innerHTML = `
        <!-- Circle Banner -->
        <div class="circle-banner-card">
          <div class="banner-top-stripe" style="background: ${{c.color}};"></div>
          <div class="banner-inner">
            <div class="circle-heading-group">
              <div class="circle-large-avatar" style="background: ${{c.color}};">
                ${{cName.substring(0, 2).toUpperCase()}}
              </div>
              <div class="circle-info-col">
                <h2>${{cName}} Circle</h2>
                <p>IT Assets &amp; Fresh Requirements Breakdown &bull; Dedicated Color: <span style="color: ${{c.color}}; font-weight: 700;">${{c.color}}</span></p>
              </div>
            </div>

            <div class="circle-stat-cards">
              <div class="mini-stat-card" style="border-top: 3px solid ${{c.color}};">
                <div class="mini-stat-label">Total Offices</div>
                <div class="mini-stat-value">${{c.total_offices}}</div>
                <div class="mini-stat-sub">Across 3 Tiers</div>
              </div>
              <div class="mini-stat-card" style="border-top: 3px solid #2563eb;">
                <div class="mini-stat-label">Desktop Req</div>
                <div class="mini-stat-value" style="color: #2563eb;">${{c.desk_req}}</div>
                <div class="mini-stat-sub">${{c.desk_av}} Working</div>
              </div>
              <div class="mini-stat-card" style="border-top: 3px solid #7c3aed;">
                <div class="mini-stat-label">Laptop Req</div>
                <div class="mini-stat-value" style="color: #7c3aed;">${{c.lap_req}}</div>
                <div class="mini-stat-sub">${{c.lap_av}} Working</div>
              </div>
              <div class="mini-stat-card" style="border-top: 3px solid #059669;">
                <div class="mini-stat-label">Printer Req</div>
                <div class="mini-stat-value" style="color: #059669;">${{c.print_req}}</div>
                <div class="mini-stat-sub">${{c.print_av}} Working</div>
              </div>
              <div class="mini-stat-card" style="border-top: 3px solid #dc2626; background: #fef2f2;">
                <div class="mini-stat-label">Total Demand</div>
                <div class="mini-stat-value" style="color: #dc2626;">${{c.total_req}}</div>
                <div class="mini-stat-sub">Units Needed</div>
              </div>

              <!-- Download PDF Button -->
              <div class="circle-actions-group">
                <button class="btn-download-pdf" onclick="downloadCirclePDF('${{cName}}')" title="Download PDF for ${{cName}} Circle">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 3 Dedicated Graphs Grid -->
        <div class="graphs-grid">
          ${{renderCategoryGraphCard(c, 'Circle Office', 'focus_circle', 'Graph 1: Circle Offices')}}
          ${{renderCategoryGraphCard(c, 'Division Office', 'focus_division', 'Graph 2: Division Offices')}}
          ${{renderCategoryGraphCard(c, 'Range Office', 'focus_range', 'Graph 3: Range Offices')}}
        </div>

        <!-- Detailed Offices Table Section -->
        <div class="offices-drilldown-card">
          <div class="drilldown-header">
            <div class="drilldown-title" onclick="toggleDrilldown()" style="cursor:pointer; flex: 1;">
              <span>All Offices in ${{cName}} Circle</span>
              <span class="drilldown-badge" id="drilldownBadge">${{c.total_offices}} Offices</span>
              <span id="drilldownArrow" style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem; margin-left: 8px;">&minus; Collapse</span>
            </div>
            <div class="drilldown-actions">
              <input type="text" id="officeSearchInput" class="table-search-input" placeholder="Search offices in ${{cName}}..." oninput="filterOfficeTable()">
            </div>
          </div>
          <div class="table-container" id="drilldownTableContainer">
            ${{renderOfficesTable(c)}}
          </div>
        </div>
      `;

      // Instantiate Charts for this circle
      initCategoryChart(`focus_circle_${{cName}}`, c, 'Circle Office');
      initCategoryChart(`focus_division_${{cName}}`, c, 'Division Office');
      initCategoryChart(`focus_range_${{cName}}`, c, 'Range Office');
    }}

    function renderCategoryGraphCard(circle, catKey, prefix, displayTitle) {{
      const cat = circle.categories[catKey];
      const canvasId = `${{prefix}}_${{circle.name}}`;
      const hasOffices = cat && cat.count > 0;

      let contentHtml = '';
      if (!hasOffices) {{
        contentHtml = `
          <div class="empty-state-notice">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.75">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>No ${{catKey}}s in ${{circle.name}}</p>
            <span style="font-size: 0.75rem; color: #94a3b8;">0 IT Requirement</span>
          </div>
        `;
      }} else {{
        contentHtml = `
          <div class="chart-container-box">
            <canvas id="${{canvasId}}"></canvas>
          </div>
          <div class="graph-breakdown-row">
            <div class="breakdown-item">
              <div class="breakdown-nums">
                <span class="req">${{cat.desk_req}} Req</span> ${{chartDataMode === 'both' ? `&bull; <span class="av">${{cat.desk_av}} Avail</span>` : ''}}
              </div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-nums">
                <span class="req">${{cat.lap_req}} Req</span> ${{chartDataMode === 'both' ? `&bull; <span class="av">${{cat.lap_av}} Avail</span>` : ''}}
              </div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-nums">
                <span class="req">${{cat.print_req}} Req</span> ${{chartDataMode === 'both' ? `&bull; <span class="av">${{cat.print_av}} Avail</span>` : ''}}
              </div>
            </div>
          </div>
        `;
      }}

      // No Req: XX badge as requested
      return `
        <div class="graph-card" style="border-top: 4px solid ${{circle.color}};">
          <div class="graph-card-header">
            <div class="graph-title-group">
              <h3>${{displayTitle}}</h3>
              <span class="subtitle">${{catKey}} &bull; ${{hasOffices ? cat.count + ' Offices' : '0 Offices'}}</span>
            </div>
          </div>
          ${{contentHtml}}
        </div>
      `;
    }}

    function initCategoryChart(canvasId, circle, catKey) {{
      const cat = circle.categories[catKey];
      if (!cat || cat.count === 0) return;

      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const circleColor = circle.color;

      const datasets = [];
      if (chartDataMode === 'both') {{
        datasets.push({{
          label: 'Available (Working)',
          data: [cat.desk_av, cat.lap_av, cat.print_av],
          backgroundColor: '#94a3b8',
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.75,
          categoryPercentage: 0.7
        }});
      }}

      datasets.push({{
        label: 'Fresh Requirement',
        data: [cat.desk_req, cat.lap_req, cat.print_req],
        backgroundColor: circleColor,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: chartDataMode === 'both' ? 0.75 : 0.55,
        categoryPercentage: chartDataMode === 'both' ? 0.7 : 0.6
      }});

      chartInstances[canvasId] = new Chart(ctx, {{
        type: 'bar',
        data: {{
          labels: ['Desktop', 'Laptop', 'Printer'],
          datasets: datasets
        }},
        plugins: [barValuesPlugin],
        options: {{
          responsive: true,
          maintainAspectRatio: false,
          interaction: {{
            mode: 'index',
            intersect: false
          }},
          animation: {{
            duration: 0
          }},
          plugins: {{
            legend: {{
              display: chartDataMode === 'both',
              position: 'top',
              align: 'end',
              labels: {{
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                font: {{ size: 10, weight: '600' }}
              }}
            }},
            tooltip: {{
              backgroundColor: '#0f172a',
              titleFont: {{ size: 12, weight: 'bold' }},
              bodyFont: {{ size: 12 }},
              padding: 10,
              cornerRadius: 8,
              callbacks: {{
                afterBody: (tooltipItems) => {{
                  if (chartDataMode === 'both' && tooltipItems.length > 1) {{
                    const total = (tooltipItems[0].raw || 0) + (tooltipItems[1].raw || 0);
                    return `Total (Avail + Req): ${{total}} units`;
                  }}
                  return '';
                }}
              }}
            }}
          }},
          scales: {{
            x: {{
              grid: {{ display: false }},
              ticks: {{
                font: {{ size: 11, weight: '600' }},
                color: '#334155',
                padding: 4
              }}
            }},
            y: {{
              beginAtZero: true,
              grace: '15%',
              grid: {{ color: '#f1f5f9' }},
              ticks: {{
                precision: 0,
                font: {{ size: 9 }},
                color: '#64748b'
              }}
            }}
          }}
        }}
      }});
    }}

    function renderOfficesTable(circle) {{
      const allOffices = [];
      ['Circle Office', 'Division Office', 'Range Office'].forEach(catKey => {{
        const cat = circle.categories[catKey];
        if (cat && cat.offices) {{
          cat.offices.forEach(off => {{
            allOffices.push({{
              cat: catKey,
              ...off
            }});
          }});
        }}
      }});

      if (allOffices.length === 0) {{
        return '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No office records found.</div>';
      }}

      let rowsHtml = allOffices.map((off, idx) => {{
        let badgeClass = 'badge-cat-circle';
        if (off.cat === 'Division Office') badgeClass = 'badge-cat-division';
        if (off.cat === 'Range Office') badgeClass = 'badge-cat-range';

        return `
          <tr class="office-row" data-search="${{escapeHtml(off.name + ' ' + (off.div || '') + ' ' + off.cat).toLowerCase()}}">
            <td>${{idx + 1}}</td>
            <td><strong>${{escapeHtml(off.name)}}</strong></td>
            <td>${{escapeHtml(off.div || '-')}}</td>
            <td><span class="badge-cat ${{badgeClass}}">${{off.cat}}</span></td>
            <td>${{off.desk_av}}</td>
            <td style="color: #2563eb; font-weight: 700;">${{off.desk_req}}</td>
            <td>${{off.lap_av}}</td>
            <td style="color: #7c3aed; font-weight: 700;">${{off.lap_req}}</td>
            <td>${{off.print_av}}</td>
            <td style="color: #059669; font-weight: 700;">${{off.print_req}}</td>
            <td style="font-size: 0.75rem; color: #64748b;">${{escapeHtml(off.remarks || '-')}}</td>
          </tr>
        `;
      }}).join('');

      return `
        <table class="data-table" id="officesTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Office Name</th>
              <th>Circle / Division Office</th>
              <th>Category</th>
              <th>Desk Avail</th>
              <th>Desk Req</th>
              <th>Lap Avail</th>
              <th>Lap Req</th>
              <th>Print Avail</th>
              <th>Print Req</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${{rowsHtml}}
          </tbody>
        </table>
      `;
    }}

    function filterOfficeTable() {{
      const query = document.getElementById('officeSearchInput').value.toLowerCase().trim();
      const rows = document.querySelectorAll('#officesTable tbody tr.office-row');
      let visibleCount = 0;
      rows.forEach(r => {{
        const text = r.getAttribute('data-search') || '';
        if (text.includes(query)) {{
          r.style.display = '';
          visibleCount++;
        }} else {{
          r.style.display = 'none';
        }}
      }});
      document.getElementById('drilldownBadge').textContent = `${{visibleCount}} Offices`;
    }}

    function toggleDrilldown() {{
      const table = document.getElementById('drilldownTableContainer');
      const arrow = document.getElementById('drilldownArrow');
      if (table.style.display === 'none') {{
        table.style.display = 'block';
        arrow.innerHTML = '&minus; Collapse';
      }} else {{
        table.style.display = 'none';
        arrow.innerHTML = '&#43; Expand';
      }}
    }}

    // Render "All 18 Circles" View
    function renderAllCircles() {{
      cleanupCharts('all_');
      const container = document.getElementById('allCirclesView');
      container.innerHTML = '';

      CIRCLE_ORDER.forEach((cName, idx) => {{
        const c = CIRCLES[cName];
        const block = document.createElement('div');
        block.className = 'circle-card-block';
        block.innerHTML = `
          <div class="circle-block-header" style="border-left: 6px solid ${{c.color}};">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${{c.color}};"></span>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">${{idx + 1}}. ${{cName}} Circle</h2>
              <span class="brand-badge" style="background: ${{c.color}}15; color: ${{c.color}}; border-color: ${{c.color}}30;">
                ${{c.total_offices}} Offices
              </span>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="font-size: 0.825rem; font-weight: 600; color: #334155;">
                Reqs: <strong style="color: #2563eb;">${{c.desk_req}} Desk</strong> &bull;
                <strong style="color: #7c3aed;">${{c.lap_req}} Lap</strong> &bull;
                <strong style="color: #059669;">${{c.print_req}} Print</strong> &bull;
                <span style="color: #dc2626; font-weight: 800;">Total: ${{c.total_req}}</span>
              </span>
              <button onclick="downloadCirclePDF('${{cName}}')" style="padding: 6px 12px; background: #0f172a; color: #fff; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                📥 PDF
              </button>
              <button onclick="selectCircle('${{cName}}')" style="padding: 6px 12px; background: ${{c.color}}; color: #fff; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                Focus &rarr;
              </button>
            </div>
          </div>

          <div class="circle-block-body">
            <div class="graphs-grid">
              ${{renderCategoryGraphCard(c, 'Circle Office', 'all_circle', 'Graph 1: Circle Offices')}}
              ${{renderCategoryGraphCard(c, 'Division Office', 'all_division', 'Graph 2: Division Offices')}}
              ${{renderCategoryGraphCard(c, 'Range Office', 'all_range', 'Graph 3: Range Offices')}}
            </div>
          </div>
        `;
        container.appendChild(block);
      }});

      // Initialize Charts for all 18 circles
      CIRCLE_ORDER.forEach(cName => {{
        const c = CIRCLES[cName];
        initCategoryChart(`all_circle_${{cName}}`, c, 'Circle Office');
        initCategoryChart(`all_division_${{cName}}`, c, 'Division Office');
        initCategoryChart(`all_range_${{cName}}`, c, 'Range Office');
      }});
    }}

    function escapeHtml(text) {{
      if (!text) return '';
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }}
  </script>
</body>
</html>
"""


def generate_all_pdfs(circle_order):
    pdf_dir = "PDFs"
    os.makedirs(pdf_dir, exist_ok=True)

    browser = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    if not os.path.exists(browser):
        browser = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'

    if not os.path.exists(browser):
        print("Warning: Edge browser not found for PDF pre-generation.")
        return

    html_abs = os.path.abspath("index.html").replace("\\", "/")
    print(f"Generating 18 individual division/circle PDFs into '{pdf_dir}/'...")

    for idx, cName in enumerate(circle_order, 1):
        safe_name = cName.replace(" ", "_")
        pdf_file = os.path.abspath(os.path.join(pdf_dir, f"IT_Requirment_{safe_name}.pdf"))
        encoded_name = urllib.parse.quote(cName)
        url = f"file:///{html_abs}?circle={encoded_name}#{encoded_name}"

        # Using 1600x900 viewport to let Chart.js initialize cleanly before printing
        cmd = [
            browser,
            "--headless",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--window-size=1600,900",
            f"--print-to-pdf={pdf_file}",
            url
        ]
        try:
            subprocess.run(cmd, timeout=20, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            size = os.path.getsize(pdf_file) if os.path.exists(pdf_file) else 0
            print(f"  [{idx}/18] Generated {os.path.basename(pdf_file)} ({size} bytes)")
        except Exception as e:
            print(f"  [{idx}/18] Failed to generate {cName}: {e}")

    update_zip_packages(circle_order)


def update_zip_packages(circle_order):
    pdf_dir = "PDFs"
    # Create All_Divisions_PDFs.zip
    zip_path = os.path.join(pdf_dir, "All_Divisions_PDFs.zip")
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for cName in circle_order:
            safe_name = cName.replace(" ", "_")
            pdf_name = f"IT_Requirment_{safe_name}.pdf"
            p = os.path.join(pdf_dir, pdf_name)
            if os.path.exists(p):
                zf.write(p, arcname=pdf_name)
    print(f"Created bundle: {zip_path} ({os.path.getsize(zip_path)} bytes)")


if __name__ == "__main__":
    import sys
    gen_pdf = True
    if "--fast" in sys.argv or "--no-pdf" in sys.argv:
        gen_pdf = False
    build_dashboard(generate_pdf=gen_pdf)

