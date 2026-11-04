$chromeBin = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$east2Dist = Join-Path $PSScriptRoot "CT_Operations_Monitor_East2\dist"
$east3Dist = Join-Path $PSScriptRoot "CT_Operations_Monitor_East3\dist"
$profileDir = Join-Path $PSScriptRoot "DEV_CHROME_PROFILE"

Write-Host "==============================================================================="
Write-Host "Launching Google Chrome with East-2 and East-3 Extensions (Sanctioned Dev Mode)"
Write-Host "==============================================================================="
Write-Host "Chrome Path: $chromeBin"
Write-Host "East-2 Dist: $east2Dist"
Write-Host "East-3 Dist: $east3Dist"
Write-Host "Profile Dir: $profileDir"
Write-Host "==============================================================================="

$argList = @(
    "--load-extension=`"$east2Dist,$east3Dist`"",
    "--user-data-dir=`"$profileDir`"",
    "https://east-2.calltools.io/manager/campaigns",
    "https://east-3.calltools.io/manager/campaigns"
)

Start-Process -FilePath $chromeBin -ArgumentList $argList

