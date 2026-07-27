param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$workspaceRoot = $PSScriptRoot
$serverHost = "127.0.0.1"
$dashboardUrl = "http://${serverHost}:$Port/hifi-designer-workspace.html"
$serverProcess = $null

function Open-DashboardInBrowser {
  param(
    [Parameter(Mandatory)]
    [string]$Url
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $Url
  $startInfo.UseShellExecute = $true

  try {
    [void][System.Diagnostics.Process]::Start($startInfo)
  } catch {
    throw "The server is running, but Windows could not open the default browser at $Url. $($_.Exception.Message)"
  }
}

Set-Location -LiteralPath $workspaceRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 18 or newer is required to run the local workspace service."
}

$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
$claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
if (-not $codexCommand -and -not $claudeCommand) {
  throw "Install and sign in to Codex or Claude Code before starting agent generation."
}

if (-not (Test-Path -LiteralPath "node_modules\@openai\codex-sdk")) {
  Write-Host "Installing local workspace dependencies..."
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Starting the workspace at $dashboardUrl"
$serverProcess = Start-Process `
  -FilePath (Get-Command node).Source `
  -ArgumentList @("server\workspace-server.mjs", "--port", "$Port") `
  -WorkingDirectory $workspaceRoot `
  -NoNewWindow `
  -PassThru

try {
  $ready = $false
  $lastProbeError = $null
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ($serverProcess.HasExited) {
      throw "The local server stopped before it became ready. Port $Port may already be in use."
    }

    try {
      $response = Invoke-WebRequest `
        -Uri $dashboardUrl `
        -Method Get `
        -UseBasicParsing `
        -TimeoutSec 1
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        $ready = $true
        break
      }
    } catch {
      $lastProbeError = $_.Exception.Message
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $ready) {
    $details = if ($lastProbeError) { " Last probe error: $lastProbeError" } else { "" }
    throw "The local server did not become ready at $dashboardUrl.$details"
  }

  Open-DashboardInBrowser -Url $dashboardUrl
  Write-Host "Dashboard opened in your default browser."
  Write-Host "Press Ctrl+C in this window to stop the local server."

  Wait-Process -Id $serverProcess.Id
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id
  }
}
