# Web Projects Scanner - Zero Python, Pure Windows Native
[CmdletBinding()]
param()

$BaseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$ProjectsDir = Join-Path $BaseDir "projects"
$JsFile = Join-Path $BaseDir "projects.js"
$JsonFile = Join-Path $BaseDir "projects.json"

if (-not (Test-Path $ProjectsDir)) {
    New-Item -ItemType Directory -Path $ProjectsDir -Force | Out-Null
}

function Format-Size($bytes) {
    if ($bytes -gt 1GB) { return "{0:N1} GB" -f ($bytes / 1GB) }
    if ($bytes -gt 1MB) { return "{0:N1} MB" -f ($bytes / 1MB) }
    if ($bytes -gt 1KB) { return "{0:N0} KB" -f ($bytes / 1KB) }
    return "$bytes B"
}

$dirs = Get-ChildItem -Path $ProjectsDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name
$projects = @()

Write-Host "Scanning: $ProjectsDir" -ForegroundColor Gray
Write-Host ""

foreach ($d in $dirs) {
    $name = $d.Name
    if ($name.StartsWith(".") -or $name -in @("__pycache__", "node_modules", ".system")) { continue }

    $folderPath = $d.FullName
    $entryFile = ""
    $title = $name

    # Check for index.html
    $indexPath = Join-Path $folderPath "index.html"
    if (Test-Path $indexPath) {
        $entryFile = "index.html"
        try {
            $head = Get-Content -Path $indexPath -TotalCount 50 -Encoding UTF8 -ErrorAction SilentlyContinue | Out-String
            if ($head -match '<title>(.*?)</title>') {
                $clean = $matches[1] -replace '<[^>]+>', ''
                $clean = $clean.Replace('&amp;', '&').Replace('&lt;', '<').Replace('&gt;', '>').Replace('&quot;', '"').Replace('&#39;', "'")
                if ($clean.Trim().Length -gt 1) { $title = $clean.Trim() }
            }
        } catch {}
    } else {
        $htmls = Get-ChildItem -Path $folderPath -Filter "*.html" -File -ErrorAction SilentlyContinue
        if ($htmls.Count -gt 0) {
            $entryFile = $htmls[0].Name
        } else {
            $bats = Get-ChildItem -Path $folderPath -Filter "*.bat" -File -ErrorAction SilentlyContinue
            if ($bats.Count -gt 0) { $entryFile = $bats[0].Name }
        }
    }

    # Detect logo
    $logo = $null
    foreach ($imgName in @("LOGO.jpeg", "logo.jpg", "logo.png", "icon.png")) {
        if (Test-Path (Join-Path $folderPath $imgName)) {
            $logo = "projects/$name/$imgName"
            break
        }
    }

    # Count files and size
    $files = Get-ChildItem -Path $folderPath -Recurse -File -ErrorAction SilentlyContinue
    $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
    if (-not $totalBytes) { $totalBytes = 0 }
    $fileCount = $files.Count
    $sizeStr = Format-Size $totalBytes

    # Detect tags
    $tags = @("Web App")
    $hasGis = $files | Where-Object { $_.Extension -in @(".kml", ".kmz", ".shp", ".img", ".tif", ".geojson") }
    $hasExcel = $files | Where-Object { $_.Extension -in @(".xlsx", ".xls", ".csv") }
    $hasChart = $files | Where-Object { $_.Name -like "*chart*" }
    $hasSync = $files | Where-Object { $_.Extension -in @(".py", ".bat") }

    if ($hasGis) { $tags += "GIS & Maps" }
    if ($hasExcel) { $tags += "Excel / Data" }
    if ($hasChart) { $tags += "Analytics" }
    if ($hasSync) { $tags += "Sync Tools" }

    $projObj = [PSCustomObject]@{
        id = $name
        name = $name
        title = $title
        entry = if ($entryFile) { "projects/$name/$entryFile" } else { "projects/$name" }
        hasIndex = [bool]$entryFile
        logo = $logo
        size = $sizeStr
        fileCount = $fileCount
        tags = $tags
    }

    $projects += $projObj

    $tagStr = ($tags | Where-Object { $_ -ne "Web App" }) -join ", "
    if (-not $tagStr) { $tagStr = "Web App" }
    Write-Host "  [+] $($projects.Count). $name" -ForegroundColor Green -NoNewline
    Write-Host " -> $title" -ForegroundColor White -NoNewline
    Write-Host " [$tagStr]" -ForegroundColor Yellow
}

Write-Host ""

# Generate JS and JSON output
$jsonStr = $projects | ConvertTo-Json -Depth 5
$jsStr = "window.ALL_PROJECTS = " + $jsonStr + ";"

[System.IO.File]::WriteAllText($JsFile, $jsStr, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($JsonFile, $jsonStr, [System.Text.Encoding]::UTF8)

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  SUCCESS: Detected $($projects.Count) projects!" -ForegroundColor Green
Write-Host "  Updated projects.js & projects.json" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
