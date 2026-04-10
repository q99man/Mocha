param(
    [string]$BridgeBaseUrl = "http://localhost:8000",
    [string]$BackendBaseUrl = "http://localhost:8080",
    [int]$ChallengeId = 2,
    [string]$ReferenceVideoPath,
    [string]$AttemptVideoPath,
    [string]$ProvisionTitle = "Bridge Verification Challenge",
    [string]$AttemptNotes = "Temporary verification attempt created by verify-mediapipe-stack.ps1",
    [int]$PendingPollIntervalSeconds = 2,
    [int]$PendingPollTimeoutSeconds = 45,
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

    $response = Invoke-WebRequest -UseBasicParsing $Url
    $content = Convert-ResponseContentToText $response.Content
    Write-Host ""
    Write-Host "== $Label =="
    Write-Host $content
    return $content
}

function Invoke-JsonGetObject {
    param(
        [string]$Url,
        [string]$Label,
        [switch]$Quiet
    )

    $response = Invoke-WebRequest -UseBasicParsing $Url
    $content = Convert-ResponseContentToText $response.Content

    if (-not $Quiet) {
        Write-Host ""
        Write-Host "== $Label =="
        Write-Host $content
    }

    return [pscustomobject]@{
        Raw = $content
        Json = $content | ConvertFrom-Json
    }
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

function Format-NullableValue {
    param($Value)

    if ($null -eq $Value) {
        return "<null>"
    }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        return "<blank>"
    }

    return $text
}

function Wait-ForAttemptProcessingTerminalState {
    param(
        [int]$ResolvedChallengeId,
        [string]$TrackingId
    )

    $pollStartedAt = Get-Date
    $deadline = $pollStartedAt.AddSeconds($PendingPollTimeoutSeconds)
    $pollCount = 0
    $latestProgressResponse = $null
    $latestProgress = $null

    Write-Host ""
    Write-Host "Polling async attempt progress for trackingId $TrackingId ..."

    while ($true) {
        $pollCount += 1
        $latestProgressResponse = Invoke-JsonGetObject -Url "$BackendBaseUrl/api/attempts/video-processing-progress/$TrackingId" -Label "Attempt Processing Progress" -Quiet
        $latestProgress = $latestProgressResponse.Json

        if ($latestProgress.trackingId -ne $TrackingId) {
            throw "Progress polling returned a different tracking id than the upload response."
        }
        if ($latestProgress.challengeId -ne $ResolvedChallengeId) {
            throw "Progress polling returned a different challenge id than the upload response."
        }

        Write-Host (
            "[Poll {0}] status={1}, runtimeState={2}, strategy={3}, processingAttempts={4}, retryCount={5}, resultAttemptId={6}" -f
            $pollCount,
            (Format-NullableValue $latestProgress.status),
            (Format-NullableValue $latestProgress.runtimeState),
            (Format-NullableValue $latestProgress.completionStrategy),
            (Format-NullableValue $latestProgress.processingAttempts),
            (Format-NullableValue $latestProgress.retryCount),
            (Format-NullableValue $latestProgress.resultAttemptId))

        if ($latestProgress.status -in @("COMPLETED", "FAILED")) {
            break
        }

        if ((Get-Date) -ge $deadline) {
            Write-Host ""
            Write-Host "== Attempt Processing Progress (Last Poll) =="
            Write-Host $latestProgressResponse.Raw

            $manualHint = ""
            if ($latestProgress.completionStrategy -eq "MANUAL_COMPLETION") {
                $manualHint =
                    " The backend is currently using MANUAL_COMPLETION, so terminal completion requires a separate completion trigger or APP_ATTEMPT_ASYNC_PENDING_AUTO_COMPLETE_ENABLED=true."
            }

            throw "Timed out after $PendingPollTimeoutSeconds second(s) waiting for trackingId $TrackingId to reach a terminal state.$manualHint"
        }

        Start-Sleep -Seconds $PendingPollIntervalSeconds
    }

    Write-Host ""
    Write-Host "== Attempt Processing Progress (Terminal) =="
    Write-Host $latestProgressResponse.Raw

    return $latestProgress
}

function Assert-AttemptDetailMatches {
    param(
        $AttemptDetail,
        [int]$ExpectedChallengeId,
        [string]$ExpectedTrackingId,
        [string]$ExpectedOriginalFileName,
        $UploadAttempt,
        $Progress
    )

    if ($AttemptDetail.challengeId -ne $ExpectedChallengeId) {
        throw "Attempt detail verification returned a different challenge id."
    }

    if ($UploadAttempt -and $UploadAttempt.attemptId -and $AttemptDetail.id -ne $UploadAttempt.attemptId) {
        throw "Attempt detail verification returned a different attempt id."
    }

    if ($Progress -and $Progress.resultAttemptId -and $AttemptDetail.id -ne $Progress.resultAttemptId) {
        throw "Attempt detail verification returned a different attempt id than the completed processing job."
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedTrackingId) -and $AttemptDetail.pendingTrackingId -ne $ExpectedTrackingId) {
        throw "Attempt detail verification returned a different pendingTrackingId than the upload response."
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedOriginalFileName) -and $AttemptDetail.originalFileName -ne $ExpectedOriginalFileName) {
        throw "Attempt detail verification returned a different original file name."
    }

    if ($UploadAttempt -and [string]::IsNullOrWhiteSpace($ExpectedTrackingId)) {
        if ($AttemptDetail.resultSummary -ne $UploadAttempt.resultSummary) {
            throw "Attempt detail verification returned a different result summary than the upload response."
        }
        if ($AttemptDetail.processingComplete -ne $UploadAttempt.processingComplete) {
            throw "Attempt detail verification returned a different processingComplete state than the upload response."
        }
    }

    if ($Progress) {
        if ($AttemptDetail.durableProgressStatus -ne $Progress.status) {
            throw "Attempt detail verification returned a different durable progress status than the terminal processing job."
        }
        if (-not $AttemptDetail.processingComplete) {
            throw "Attempt detail verification returned processingComplete=false after terminal completion."
        }
        if ([string]::IsNullOrWhiteSpace($AttemptDetail.resultSummary)) {
            throw "Attempt detail verification returned an empty result summary after terminal completion."
        }
    }
}

function Assert-MotionSessionMatches {
    param(
        $MotionSession,
        [int]$ExpectedChallengeId,
        [string]$ExpectedRuntimeState,
        [long]$ExpectedAttemptId
    )

    if ($MotionSession.challengeId -ne $ExpectedChallengeId) {
        throw "Motion session verification returned a different challenge id."
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedRuntimeState) -and $MotionSession.runtimeState -ne $ExpectedRuntimeState) {
        throw "Motion session verification returned runtimeState '$($MotionSession.runtimeState)' instead of '$ExpectedRuntimeState'."
    }

    if ($ExpectedRuntimeState -eq "SCORING_COMPLETED") {
        if ($MotionSession.latestAttemptId -ne $ExpectedAttemptId) {
            throw "Motion session verification returned a different latestAttemptId than the verified attempt."
        }
        if (-not $MotionSession.scoreAvailable) {
            throw "Motion session verification did not report scoreAvailable=true after completion."
        }
    }
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
    if ($attempt.challengeId -ne $ResolvedChallengeId) {
        throw "Attempt upload verification returned a different challenge id."
    }
    if (-not $attempt.attemptId -and [string]::IsNullOrWhiteSpace($attempt.pendingTrackingId)) {
        throw "Attempt upload verification returned neither an attempt id nor a pending tracking id."
    }
    if ([string]::IsNullOrWhiteSpace($attempt.pendingTrackingId) -and $attempt.analyzerName -ne "mediapipe-fastapi-pose-v1") {
        throw "Attempt upload verification returned unexpected analyzer '$($attempt.analyzerName)'."
    }
    if (-not $attempt.scoreAvailable -and [string]::IsNullOrWhiteSpace($attempt.pendingTrackingId)) {
        throw "Attempt upload verification returned neither a score nor a pending tracking id."
    }

    $verifiedAttemptId = $attempt.attemptId
    $terminalProgress = $null
    if (-not [string]::IsNullOrWhiteSpace($attempt.pendingTrackingId)) {
        if ($attempt.processingMode -ne "ASYNC_JOB_PENDING") {
            throw "Attempt upload verification returned a pending tracking id without ASYNC_JOB_PENDING processing mode."
        }
        if ($attempt.processingComplete) {
            throw "Attempt upload verification returned processingComplete=true even though it is still pending."
        }

        $terminalProgress = Wait-ForAttemptProcessingTerminalState -ResolvedChallengeId $ResolvedChallengeId -TrackingId $attempt.pendingTrackingId
        if ($terminalProgress.status -eq "FAILED") {
            $failureCode = Format-NullableValue $terminalProgress.failureCode
            $failureAction = Format-NullableValue $terminalProgress.failureAction
            throw "Attempt processing reached FAILED terminal state. failureCode=$failureCode, failureAction=$failureAction, runtimeState=$($terminalProgress.runtimeState)"
        }
        if ($terminalProgress.status -ne "COMPLETED") {
            throw "Attempt processing reached unexpected terminal status '$($terminalProgress.status)'."
        }
        if (-not $terminalProgress.resultAttemptId) {
            throw "Completed attempt processing did not return a resultAttemptId."
        }

        $verifiedAttemptId = $terminalProgress.resultAttemptId
    }

    $attemptDetailJson = Invoke-JsonGet -Url "$BackendBaseUrl/api/attempts/$verifiedAttemptId" -Label "Attempt Detail"
    $attemptDetail = $attemptDetailJson | ConvertFrom-Json

    Assert-AttemptDetailMatches `
        -AttemptDetail $attemptDetail `
        -ExpectedChallengeId $ResolvedChallengeId `
        -ExpectedTrackingId $attempt.pendingTrackingId `
        -ExpectedOriginalFileName $videoFileName `
        -UploadAttempt $attempt `
        -Progress $terminalProgress

    return [pscustomobject]@{
        AttemptId = [long]$attemptDetail.id
        ExpectedMotionSessionRuntimeState = "SCORING_COMPLETED"
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

$verifiedAttempt = $null
if ($shouldUploadAttempt) {
    $verifiedAttempt = Submit-VerificationAttempt -ResolvedChallengeId $resolvedChallengeId -VideoPath $resolvedAttemptVideoPath
}

$motionSessionResponse = Invoke-JsonGetObject -Url "$BackendBaseUrl/api/challenges/$resolvedChallengeId/motion-session" -Label "Motion Session"
if ($verifiedAttempt) {
    Assert-MotionSessionMatches `
        -MotionSession $motionSessionResponse.Json `
        -ExpectedChallengeId $resolvedChallengeId `
        -ExpectedRuntimeState $verifiedAttempt.ExpectedMotionSessionRuntimeState `
        -ExpectedAttemptId $verifiedAttempt.AttemptId
}

Write-Host ""
Write-Host "Verification requests completed."
