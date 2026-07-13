# SmartShelf helper — bootstrap igcse-study-agent on Windows (PowerShell).
# Usage:
#   .\scripts\windows\setup-igcse-study-agent.ps1
#   .\scripts\windows\setup-igcse-study-agent.ps1 -RepoPath C:\dev\igcse-study-agent

param(
    [string]$RepoPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoPath) {
    $RepoPath = Join-Path $env:USERPROFILE "igcse-study-agent"
}

Write-Host "IGCSE study agent path: $RepoPath"

if (-not (Test-Path $RepoPath)) {
    Write-Host "Cloning https://github.com/deepakp1308/igcse-study-agent.git ..."
    git clone https://github.com/deepakp1308/igcse-study-agent.git $RepoPath
}

Push-Location $RepoPath

if (-not (Test-Path ".\.venv")) {
    Write-Host "Creating Python venv ..."
    python -m venv .venv
}

Write-Host "Activating venv and installing Python package ..."
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\pip.exe" install -e ".[dev]"

Write-Host "Installing simulator npm dependencies ..."
Push-Location simulator
npm install
Pop-Location

Pop-Location

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. See docs\IGCSE_STUDY_AGENT_WINDOWS.md for ingest/generate commands."
Write-Host "  2. After deploy, set EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL in frontend\smartshelf\.env"
Write-Host "  3. Activate venv:  cd `"$RepoPath`" ; .\.venv\Scripts\Activate.ps1"
