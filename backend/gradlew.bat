@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
set GRADLE_VERSION=8.10.2
set DIST_DIR=%SCRIPT_DIR%\.gradle-dist
set GRADLE_DIR=%DIST_DIR%\gradle-%GRADLE_VERSION%
set ZIP_PATH=%DIST_DIR%\gradle-%GRADLE_VERSION%-bin.zip
set DIST_URL=https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip

if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

if not exist "%GRADLE_DIR%\bin\gradle.bat" (
  echo Downloading Gradle %GRADLE_VERSION%...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%DIST_URL%' -OutFile '%ZIP_PATH%'"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%DIST_DIR%' -Force"
)

call "%GRADLE_DIR%\bin\gradle.bat" -p "%SCRIPT_DIR%" %*
endlocal

