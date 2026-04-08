param(
    [string]$BridgeBaseUrl = "http://localhost:8000",
    [string]$BackendBaseUrl = "http://localhost:8080",
    [int]$ChallengeId = 2
)

$ErrorActionPreference = "Stop"

function Invoke-JsonGet {
    param(
        [string]$Url,
        [string]$Label
    )

    Write-Host ""
    Write-Host "== $Label =="
    $response = Invoke-WebRequest -UseBasicParsing $Url
    $content = $response.Content
    Write-Host $content
    return $content
}

Write-Host "Verifying MediaPipe bridge + Spring backend stack..."
Write-Host "Bridge:  $BridgeBaseUrl"
Write-Host "Backend: $BackendBaseUrl"
Write-Host "Challenge: $ChallengeId"

Invoke-JsonGet -Url "$BridgeBaseUrl/health" -Label "Bridge Health" | Out-Null
Invoke-JsonGet -Url "$BackendBaseUrl/api/health" -Label "Backend API Health" | Out-Null
Invoke-JsonGet -Url "$BackendBaseUrl/actuator/health" -Label "Backend Actuator Health" | Out-Null
Invoke-JsonGet -Url "$BackendBaseUrl/api/challenges" -Label "Challenges" | Out-Null
Invoke-JsonGet -Url "$BackendBaseUrl/api/challenges/$ChallengeId/motion-session" -Label "Motion Session" | Out-Null

Write-Host ""
Write-Host "Verification requests completed."
