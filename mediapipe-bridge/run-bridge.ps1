param(
    [int]$Port = 8000,
    [switch]$Reload
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPath = Join-Path $root ".venv"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$cacheRoot = Join-Path $root ".cache"
$tempRoot = Join-Path $cacheRoot "temp"
$matplotlibConfigRoot = Join-Path $cacheRoot "matplotlib"
$modelsRoot = Join-Path $root "models"
$defaultModelCandidates = @(
    "pose_landmarker_active.task",
    "pose_landmarker_heavy.task",
    "pose_landmarker_full.task",
    "pose_landmarker_lite.task"
)
$defaultModelPath = $null
foreach ($candidate in $defaultModelCandidates) {
    $candidatePath = Join-Path $modelsRoot $candidate
    if (Test-Path $candidatePath) {
        $defaultModelPath = $candidatePath
        break
    }
}

function Test-CommandAvailable {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Try-CreateVirtualEnvironment {
    param(
        [string]$Launcher,
        [string[]]$Arguments
    )

    try {
        & $Launcher @Arguments
    } catch {
        return $false
    }

    return (Test-Path $pythonExe)
}

if (-not (Test-Path $pythonExe)) {
    Write-Host "Creating virtual environment..."

    $created = $false

    if (Test-CommandAvailable "py") {
        $created = Try-CreateVirtualEnvironment -Launcher "py" -Arguments @("-3", "-m", "venv", $venvPath)
        if (-not $created) {
            $created = Try-CreateVirtualEnvironment -Launcher "py" -Arguments @("-m", "venv", $venvPath)
        }
    }

    if (-not $created -and (Test-CommandAvailable "python")) {
        $created = Try-CreateVirtualEnvironment -Launcher "python" -Arguments @("-m", "venv", $venvPath)
    }

    if (-not $created) {
        throw "Virtual environment creation failed. Make sure a full Python installation with venv support is available."
    }
}

if (-not (Test-Path $pythonExe)) {
    throw "Virtual environment was not created correctly. Expected python at $pythonExe"
}

foreach ($directory in @($cacheRoot, $tempRoot, $matplotlibConfigRoot, $modelsRoot)) {
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
}

$env:TEMP = $tempRoot
$env:TMP = $tempRoot
if (-not $env:MPLCONFIGDIR) {
    $env:MPLCONFIGDIR = $matplotlibConfigRoot
}
$env:MEDIAPIPE_BRIDGE_MODE = "mediapipe"
$configuredModelPath = $env:MEDIAPIPE_BRIDGE_MODEL_PATH
if ([string]::IsNullOrWhiteSpace($configuredModelPath)) {
    if ($defaultModelPath -and (Test-Path $defaultModelPath)) {
        $env:MEDIAPIPE_BRIDGE_MODEL_PATH = $defaultModelPath
    }
} elseif (-not (Test-Path $configuredModelPath)) {
    Write-Warning "Configured MEDIAPIPE_BRIDGE_MODEL_PATH does not exist: $configuredModelPath"
    if ($defaultModelPath -and (Test-Path $defaultModelPath)) {
        Write-Host "Falling back to bundled model: $defaultModelPath"
        $env:MEDIAPIPE_BRIDGE_MODEL_PATH = $defaultModelPath
    }
}

function Invoke-PythonStep {
    param(
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    & $pythonExe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Test-BridgeDependenciesInstalled {
    & $pythonExe -c "import fastapi, uvicorn, pydantic, numpy, cv2, mediapipe"
    return ($LASTEXITCODE -eq 0)
}

if (Test-BridgeDependenciesInstalled) {
    Write-Host "Bridge dependencies already available. Skipping pip install."
} else {
    Write-Host "Installing bridge dependencies..."
    Invoke-PythonStep -Arguments @("-m", "pip", "install", "--upgrade", "pip") -FailureMessage "Failed to upgrade pip in the MediaPipe bridge virtual environment."
    Invoke-PythonStep -Arguments @("-m", "pip", "install", "-r", (Join-Path $root "requirements.txt")) -FailureMessage "Failed to install MediaPipe bridge dependencies."
}

Write-Host "Starting MediaPipe bridge on port $Port..."
Write-Host "Bridge mode: $($env:MEDIAPIPE_BRIDGE_MODE)"
Write-Host "Temp dir: $($env:TEMP)"
Write-Host "Matplotlib config dir: $($env:MPLCONFIGDIR)"
Write-Host "Model dir: $modelsRoot"
Write-Host "Model path: $($env:MEDIAPIPE_BRIDGE_MODEL_PATH)"
$uvicornArguments = @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$Port")
if ($Reload) {
    $uvicornArguments += "--reload"
}
Invoke-PythonStep -Arguments $uvicornArguments -FailureMessage "Failed to start the MediaPipe bridge with uvicorn."
