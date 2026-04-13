param(
    [ValidateSet("mysql")]
    [string]$Profile = "mysql",
    [string]$BridgeEndpoint = "http://localhost:8000",
    [string]$AnalyzePath = "/api/v1/analyze",
    [int]$TimeoutMillis = 5000
)

$ErrorActionPreference = "Stop"

$env:SPRING_PROFILES_ACTIVE = $Profile
$env:APP_MOTION_ANALYSIS_PROVIDER = "mediapipe"
$env:APP_MOTION_MEDIAPIPE_STUB_ENABLED = "false"
$env:APP_MOTION_MEDIAPIPE_ENDPOINT = $BridgeEndpoint
$env:APP_MOTION_MEDIAPIPE_ANALYZE_PATH = $AnalyzePath
$env:APP_MOTION_MEDIAPIPE_TIMEOUT_MILLIS = "$TimeoutMillis"

Write-Host "Starting backend with MediaPipe HTTP bridge mode (MySQL only)..."
Write-Host "Profile: $Profile"
Write-Host "Bridge endpoint: $BridgeEndpoint$AnalyzePath"

& ".\gradlew.bat" bootRun
