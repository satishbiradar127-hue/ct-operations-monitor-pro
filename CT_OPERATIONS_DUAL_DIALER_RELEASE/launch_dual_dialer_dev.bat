@echo off
set CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe
set EAST2_DIST=%~dp0CT_Operations_Monitor_East2\dist
set EAST3_DIST=%~dp0CT_Operations_Monitor_East3\dist
set PROFILE_DIR=%~dp0DEV_CHROME_PROFILE

echo ===============================================================================
echo Launching Google Chrome with East-2 and East-3 Extensions (Sanctioned Dev Mode)
echo ===============================================================================
echo Chrome Path: %CHROME_BIN%
echo East-2 Dist: %EAST2_DIST%
echo East-3 Dist: %EAST3_DIST%
echo Profile Dir: %PROFILE_DIR%
echo ===============================================================================

start "" "%CHROME_BIN%" --load-extension="%EAST2_DIST%,%EAST3_DIST%" --user-data-dir="%PROFILE_DIR%" "https://east-2.calltools.io/manager/campaigns" "https://east-3.calltools.io/manager/campaigns"

