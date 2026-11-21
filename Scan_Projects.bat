@echo off
title Web Projects Hub - Scan Projects
color 0b
cd /d "%~dp0"

echo =====================================================================
echo                Scanning 'projects' Directory...
echo =====================================================================
echo.

if exist "%~dp0scan.ps1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scan.ps1"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$BaseDir = (Get-Location).Path; $ProjectsDir = Join-Path $BaseDir 'projects'; $projs = @(); foreach ($d in (Get-ChildItem -Path $ProjectsDir -Directory | Sort-Object Name)) { if ($d.Name.StartsWith('.')) { continue }; $name = $d.Name; $folderPath = $d.FullName; $entryFile = if (Test-Path (Join-Path $folderPath 'index.html')) { 'index.html' } else { (Get-ChildItem -Path $folderPath -Filter '*.html' -File | Select-Object -First 1).Name }; $title = $name; if ($entryFile -and (Test-Path (Join-Path $folderPath $entryFile))) { try { $content = Get-Content (Join-Path $folderPath $entryFile) -TotalCount 50 -Encoding UTF8 -ErrorAction SilentlyContinue | Out-String; if ($content -match '<title>(.*?)</title>') { $t = $matches[1] -replace '<[^>]+>', ''; if ($t.Trim().Length -gt 1) { $title = $t.Trim() } } } catch {} }; $logo = $null; foreach ($img in @('LOGO.jpeg','logo.jpg','logo.png','icon.png')) { if (Test-Path (Join-Path $folderPath $img)) { $logo = 'projects/' + $name + '/' + $img; break } }; $files = Get-ChildItem -Path $folderPath -Recurse -File -ErrorAction SilentlyContinue; $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum; if (-not $totalBytes) { $totalBytes = 0 }; $sizeStr = if ($totalBytes -gt 1GB) { '{0:N1} GB' -f ($totalBytes/1GB) } elseif ($totalBytes -gt 1MB) { '{0:N1} MB' -f ($totalBytes/1MB) } elseif ($totalBytes -gt 1KB) { '{0:N0} KB' -f ($totalBytes/1KB) } else { \"$totalBytes B\" }; $tags = @('Web App'); if ($files | Where-Object { $_.Extension -in @('.kml','.kmz','.shp','.img','.tif','.geojson') }) { $tags += 'GIS & Maps' }; if ($files | Where-Object { $_.Extension -in @('.xlsx','.xls','.csv') }) { $tags += 'Excel / Data' }; if ($files | Where-Object { $_.Name -like '*chart*' }) { $tags += 'Analytics' }; if ($files | Where-Object { $_.Extension -in @('.py','.bat') }) { $tags += 'Sync Tools' }; $projs += [PSCustomObject]@{ id = $name; name = $name; title = $title; entry = if ($entryFile) { 'projects/' + $name + '/' + $entryFile } else { 'projects/' + $name }; logo = $logo; size = $sizeStr; fileCount = $files.Count; tags = $tags }; Write-Host ('  [+] ' + $name + ' -> ' + $title) -ForegroundColor Green }; $json = $projs | ConvertTo-Json -Depth 5; $jsContent = 'window.ALL_PROJECTS = ' + $json + ';'; [System.IO.File]::WriteAllText((Join-Path $BaseDir 'projects.js'), $jsContent, [System.Text.Encoding]::UTF8); [System.IO.File]::WriteAllText((Join-Path $BaseDir 'projects.json'), $json, [System.Text.Encoding]::UTF8); Write-Host ''; Write-Host ('[SUCCESS] Found ' + $projs.Count + ' projects! Updated projects.js and projects.json.') -ForegroundColor Cyan;"
)

echo.
echo =====================================================================
echo [DONE] Refresh index.html in your browser to see your projects!
echo =====================================================================
echo.
pause
