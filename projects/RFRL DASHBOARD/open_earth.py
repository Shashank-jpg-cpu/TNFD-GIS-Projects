import sys
import os
import urllib.parse
import subprocess
import winreg

workspace_dir = os.path.dirname(os.path.abspath(__file__))
earth_exe = r"C:\Program Files\Google\Google Earth Pro\client\googleearth.exe"
earth_cwd = os.path.dirname(earth_exe) if os.path.exists(earth_exe) else None
bat_path = os.path.join(workspace_dir, "open_earth.bat")

def ensure_protocol_registered():
    try:
        key_path = r"Software\Classes\earth"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, None, 0, winreg.REG_SZ, "URL:Earth Protocol")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
            
        cmd_path = r"Software\Classes\earth\shell\open\command"
        cmd_val = f'"{bat_path}" "%1"'
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, cmd_path) as key:
            winreg.SetValueEx(key, None, 0, winreg.REG_SZ, cmd_val)
    except Exception as e:
        print(f"Registry registration note: {e}", file=sys.stderr)

# Ensure protocol is always pointing to the active location
ensure_protocol_registered()

if len(sys.argv) > 1:
    raw = sys.argv[1]
    
    # Remove any earth: or earth:// prefix
    while raw.lower().startswith("earth:"):
        raw = raw[6:]
    raw = raw.lstrip('/')
    
    # Decode URL
    path = urllib.parse.unquote(raw).strip().strip('"')
    
    # Handle Windows absolute paths where drive letter might be after leading slash
    if len(path) > 2 and path[1] == ':' and (path[0].isalpha()):
        target = os.path.normpath(path)
    elif not os.path.isabs(path):
        target = os.path.normpath(os.path.join(workspace_dir, path))
    else:
        target = os.path.normpath(path)
        
    # Check existence
    if not os.path.exists(target):
        alt = os.path.normpath(os.path.join(workspace_dir, "kmls", os.path.basename(path)))
        if os.path.exists(alt):
            target = alt

    if os.path.exists(target):
        if os.path.exists(earth_exe):
            subprocess.Popen([earth_exe, target], cwd=earth_cwd)
        else:
            os.startfile(target)
    else:
        # Launch Google Earth Pro directly
        if os.path.exists(earth_exe):
            subprocess.Popen([earth_exe], cwd=earth_cwd)
else:
    if os.path.exists(earth_exe):
        subprocess.Popen([earth_exe], cwd=earth_cwd)
