param(
    [string]$BridgeBaseUrl = "http://localhost:8000",
    [string]$BackendBaseUrl = "http://localhost:8080",
    [int]$ChallengeId = 2,
    [string]$ReferenceVideoPath,
    [string]$AttemptVideoPath,
    [string]$ProvisionTitle = "Bridge Verification Challenge",
    [string]$AttemptNotes = "Temporary verification attempt created by verify-mediapipe-stack.ps1",
    [switch]$ForceProvisionChallenge,
    [switch]$ForceUploadAttempt
)

$ErrorActionPreference = "Stop"

function Convert-ResponseContentToText {
    param($Content)

    if ($Content -is [byte[]]) {
        return [System.Text.Encoding]::UTF8.GetString($Content)
    }

    return [string]$Content
}

function Invoke-JsonGet {
    param(
        [string]$Url,
        [string]$Label
    )

    Write-Host ""
    Write-Host "== $Label =="
    $response = Invoke-WebRequest -UseBasicParsing $Url
    $content = Convert-ResponseContentToText $response.Content
    Write-Host $content
    return $content
}

function Get-VideoContentType {
    param(
        [string]$Path
    )

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($extension) {
        ".mp4" { return "video/mp4" }
        ".mov" { return "video/quicktime" }
        ".webm" { return "video/webm" }
        ".avi" { return "video/x-msvideo" }
        default { return "application/octet-stream" }
    }
}

function Invoke-CurlJson {
    param(
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    $response = & curl.exe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
    if ([string]::IsNullOrWhiteSpace($response)) {
        throw "$FailureMessage Empty response body."
    }
    return [string]$response
}

function New-VerificationChallenge {
    param(
        [string]$VideoPath
    )

    if (-not (Test-Path $VideoPath)) {
        throw "Reference video path was not found: $VideoPath"
    }

    $videoFileName = [System.IO.Path]::GetFileName($VideoPath)
    $contentType = Get-VideoContentType -Path $VideoPath

    Write-Host ""
    Write-Host "Provisioning a verification challenge from $videoFileName ..."

    $createResponse = Invoke-CurlJson -Arguments @(
        "-s",
        "-X",
        "POST",
        "$BackendBaseUrl/api/challenges",
        "-F",
        "title=$ProvisionTitle",
        "-F",
        "description=Temporary verification challenge created by verify-mediapipe-stack.ps1",
        "-F",
        "category=Smoke Test",
        "-F",
        "difficulty=Normal",
        "-F",
        "durationSec=20",
        "-F",
        "referenceVideo=@${VideoPath};type=$contentType"
    ) -FailureMessage "Challenge provisioning failed."

    $createdChallenge = $createResponse | ConvertFrom-Json
    if (-not $createdChallenge.id) {
        throw "Challenge provisioning did not return a challenge id."
    }

    Write-Host "Provisioned challenge id: $($createdChallenge.id)"
    Write-Host ""
    Write-Host "== Provisioned Reference Analysis =="
    $analysisResponse = Invoke-CurlJson -Arguments @(
        "-s",
        "-X",
        "POST",
        "$BackendBaseUrl/api/challenges/$($createdChallenge.id)/analyze-reference"
    ) -FailureMessage "Provisioned reference analysis failed."
    Write-Host $analysisResponse

    return [int]$createdChallenge.id
}

function Submit-VerificationAttempt {
    param(
        [int]$ResolvedChallengeId,
        [string]$VideoPath
    )

    if (-not (Test-Path $VideoPath)) {
        throw "Attempt video path was not found: $VideoPath"
    }

    $videoFileName = [System.IO.Path]::GetFileName($VideoPath)
    $contentType = Get-VideoContentType -Path $VideoPath

    Write-Host ""
    Write-Host "== Verification Attempt Upload =="
    Write-Host "Uploading attempt video $videoFileName for challenge $ResolvedChallengeId ..."

    $attemptResponse = Invoke-CurlJson -Arguments @(
        "-s",
        "-X",
        "POST",
        "$BackendBaseUrl/api/attempts/video",
        "-F",
        "challengeId=$ResolvedChallengeId",
        "-F",
        "notes=$AttemptNotes",
        "-F",
        "attemptVideo=@${VideoPath};type=$contentType"
    ) -FailureMessage "Attempt upload verification failed."

    Write-Host $attemptResponse

    $attempt = $attemptResponse | ConvertFrom-Json
    if (-not $attempt.attemptId) {
        throw "Attempt upload verification did not return an attempt id."
    }
    if ($attempt.analyzerName -ne "mediapipe-fastapi-pose-v1") {
        throw "Attempt upload verification returned unexpected analyzer '$($attempt.analyzerName)'."
    }
    if (-not $attempt.scoreAvailable -and [string]::IsNullOrWhiteSpace($attempt.pendingTrackingId)) {
        throw "Attempt upload verification returned neither a score nor a pending tracking id."
    }

    if (-not [string]::IsNullOrWhiteSpace($attempt.pendingTrackingId)) {
        Invoke-JsonGet -Url "$BackendBaseUrl/api/attempts/video-processing-progress/$($attempt.pendingTrackingId)" -Label "Attempt Processing Progress" | Out-Null
    }

    $attemptDetailJson = Invoke-JsonGet -Url "$BackendBaseUrl/api/attempts/$($attempt.attemptId)" -Label "Attempt Detail"
    $attemptDetail = $attemptDetailJson | ConvertFrom-Json

    if ($attemptDetail.id -ne $attempt.attemptId) {
        throw "Attempt detail verification returned a different attempt id."
    }
    if ($attemptDetail.challengeId -ne $attempt.challengeId) {
        throw "Attempt detail verification returned a different challenge id."
    }
    if ($attemptDetail.resultSummary -ne $attempt.resultSummary) {
        throw "Attempt detail verification returned a different result summary than the upload response."
    }
    if ($attemptDetail.processingComplete -ne $attempt.processingComplete) {
        throw "Attempt detail verification returned a different processingComplete state than the upload response."
    }
}

Write-Host "Verifying MediaPipe bridge + Spring backend stack..."
Write-Host "Bridge:  $BridgeBaseUrl"
Write-Host "Backend: $BackendBaseUrl"
Write-Host "Challenge: $ChallengeId"

Invoke-JsonGet -Url "$BridgeBaseUrl/health" -Label "Bridge Health" | Out-Null
Invoke-JsonGet -Url "$BackendBaseUrl/api/health" -Label "Backend API Health" | Out-Null
Invoke-JsonGet -Url "$BackendBaseUrl/actuator/health" -Label "Backend Actuator Health" | Out-Null
$challengesJson = Invoke-JsonGet -Url "$BackendBaseUrl/api/challenges" -Label "Challenges"
$challenges = $challengesJson | ConvertFrom-Json

if ($challenges -isnot [System.Array]) {
    $challenges = @($challenges)
}

$resolvedChallengeId = $ChallengeId
$resolvedAttemptVideoPath = $AttemptVideoPath
if ([string]::IsNullOrWhiteSpace($resolvedAttemptVideoPath) -and -not [string]::IsNullOrWhiteSpace($ReferenceVideoPath)) {
    $resolvedAttemptVideoPath = $ReferenceVideoPath
}
$shouldProvisionChallenge =
        ($ForceProvisionChallenge -and -not [string]::IsNullOrWhiteSpace($ReferenceVideoPath)) -or
        ($challenges.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($ReferenceVideoPath))
$shouldUploadAttempt = $ForceUploadAttempt -and -not [string]::IsNullOrWhiteSpace($resolvedAttemptVideoPath)

if ($shouldProvisionChallenge) {
    $resolvedChallengeId = New-VerificationChallenge -VideoPath $ReferenceVideoPath
} elseif ($challenges.Count -eq 0) {
    Write-Host ""
    Write-Host "No challenges are available yet. Skipping motion session verification."
    Write-Host "Create a challenge with a reference video, or rerun with -ReferenceVideoPath, then verify again."
    Write-Host ""
    Write-Host "Verification requests completed."
    exit 0
}

$matchingChallenge = if ($shouldProvisionChallenge) {
    [pscustomobject]@{ id = $resolvedChallengeId }
} else {
    $challenges | Where-Object { $_.id -eq $resolvedChallengeId } | Select-Object -First 1
}
if (-not $matchingChallenge) {
    $resolvedChallengeId = $challenges[0].id
    Write-Host ""
    Write-Host "Requested challenge $ChallengeId was not found. Using challenge $resolvedChallengeId instead."
}

if ($shouldUploadAttempt) {
    Submit-VerificationAttempt -ResolvedChallengeId $resolvedChallengeId -VideoPath $resolvedAttemptVideoPath
}

Invoke-JsonGet -Url "$BackendBaseUrl/api/challenges/$resolvedChallengeId/motion-session" -Label "Motion Session" | Out-Null

Write-Host ""
Write-Host "Verification requests completed."
