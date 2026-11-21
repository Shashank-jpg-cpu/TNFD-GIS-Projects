$portalDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$zipPath = Join-Path $portalDir "portal_update.zip"
$versionFile = Join-Path $portalDir "version.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       TNFD GIS PORTAL - UPDATE BUNDLE GENERATOR          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Update version number
$currentVer = 1
if (Test-Path $versionFile) {
    try {
        $json = Get-Content $versionFile -Raw | ConvertFrom-Json
        $currentVer = [int]$json.version
    } catch {}
}
$nextVer = $currentVer + 1
Write-Host "[*] Incrementing version from v$currentVer to v$nextVer..." -ForegroundColor Yellow

$versionData = [ordered]@{
    version = $nextVer
    title = ("Portal Update v{0} - {1}" -f $nextVer, (Get-Date).ToString("yyyy-MM-dd HH:mm"))
    bundleUrl = "portal_update.zip"
    updatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}
$versionData | ConvertTo-Json -Depth 4 | Set-Content -Path $versionFile -Encoding UTF8

# 2. Remove old zip if present
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# 3. Create fresh zip excluding heavy or redundant files
Write-Host "[*] Packaging web files into portal_update.zip..." -ForegroundColor Yellow
$filesToZip = Get-ChildItem -Path $portalDir -Exclude "portal_update.zip", "*.zip", "*.apk", "lulc_sisdp.shp", ".git", ".vercel" -Recurse | Where-Object {
    $_.FullName -notmatch '\\\.git($|\\)' -and
    $_.FullName -notmatch 'lulc_sisdp\.shp' -and
    $_.FullName -notmatch '\.apk$' -and
    $_.FullName -notmatch '\\\.vercel($|\\)'
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

$baseLen = $portalDir.TrimEnd('\').Length + 1
foreach ($file in $filesToZip) {
    if (-not $file.PSIsContainer) {
        $relPath = $file.FullName.Substring($baseLen).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
}
$zip.Dispose()

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("SUCCESS! portal_update.zip created ({0:N2} MB) for v{1}" -f $zipSize, $nextVer) -ForegroundColor Green
Write-Host "version.json and portal_update.zip are ready!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
