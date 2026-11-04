$ErrorActionPreference = "Stop"

$root = "C:\Users\Orange Carrot\Downloads\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\CT_OPERATIONS_DUAL_DIALER_RELEASE"
$releaseDir = Join-Path $root "RELEASE_PACKAGES"

if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}

$dialers = @("East2", "East3")

foreach ($d in $dialers) {
    $dirName = "CT_Operations_Monitor_$d"
    $sourceDir = Join-Path $root $dirName
    $zipName = "$dirName.zip"
    $zipVersionedName = "${dirName}_v11.3.0.zip"
    $destZip = Join-Path $releaseDir $zipName
    $destZipVersioned = Join-Path $releaseDir $zipVersionedName

    if (Test-Path $destZip) {
        Remove-Item -Path $destZip -Force
    }
    if (Test-Path $destZipVersioned) {
        Remove-Item -Path $destZipVersioned -Force
    }

    Write-Host "Packaging $dirName into $destZip..."
    Push-Location $sourceDir
    try {
        $itemsToZip = Get-ChildItem -Path . | Where-Object { $_.Name -notin @(".git", "node_modules") }
        Compress-Archive -Path $itemsToZip -DestinationPath $destZip -CompressionLevel Optimal -Force
        Copy-Item -Path $destZip -Destination $destZipVersioned -Force
    } finally {
        Pop-Location
    }
}

# Calculate Checksums
$shaFile = Join-Path $releaseDir "SHA256SUMS.txt"
$e2Zip = Join-Path $releaseDir "CT_Operations_Monitor_East2.zip"
$e3Zip = Join-Path $releaseDir "CT_Operations_Monitor_East3.zip"

$e2Hash = (Get-FileHash -Path $e2Zip -Algorithm SHA256).Hash.ToLower()
$e3Hash = (Get-FileHash -Path $e3Zip -Algorithm SHA256).Hash.ToLower()

$lines = @(
    "$e2Hash  CT_Operations_Monitor_East2.zip",
    "$e3Hash  CT_Operations_Monitor_East3.zip"
)

Set-Content -Path $shaFile -Value $lines -Encoding utf8

Write-Host "`nRelease Packages Created Successfully:"
Write-Host "East-2 SHA256: $e2Hash"
Write-Host "East-3 SHA256: $e3Hash"

