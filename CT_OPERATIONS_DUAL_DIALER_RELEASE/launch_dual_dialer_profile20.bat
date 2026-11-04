@echo off
set CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe
set PROFILE_NAME=Profile 20

echo ===============================================================================
echo Launching Google Chrome Profile 20 (Authenticated Dual-Dialer Production Session)
echo ===============================================================================
echo Chrome Path: %CHROME_BIN%
echo Profile:     %PROFILE_NAME%
echo Tabs:        https://east-2.calltools.io/manager/campaigns
echo              https://east-3.calltools.io/manager/campaigns
echo ===============================================================================

start "" "%CHROME_BIN%" --profile-directory="%PROFILE_NAME%" "https://east-2.calltools.io/manager/campaigns" "https://east-3.calltools.io/manager/campaigns"

