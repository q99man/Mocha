param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPath = Join-Path $root ".venv"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"

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

Write-Host "Installing bridge dependencies..."
Invoke-PythonStep -Arguments @("-m", "pip", "install", "--upgrade", "pip") -FailureMessage "Failed to upgrade pip in the MediaPipe bridge virtual environment."
Invoke-PythonStep -Arguments @("-m", "pip", "install", "-r", (Join-Path $root "requirements.txt")) -FailureMessage "Failed to install MediaPipe bridge dependencies."

Write-Host "Starting MediaPipe bridge on port $Port..."
Invoke-PythonStep -Arguments @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$Port", "--reload") -FailureMessage "Failed to start the MediaPipe bridge with uvicorn."
