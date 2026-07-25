param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$workspaceRoot = $PSScriptRoot
$dashboardUrl = "http://localhost:$Port/hifi-designer-workspace.html"
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
  throw "Node.js is required to rebuild the project catalog."
}

$pythonCommand = Get-Command py -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
}
if (-not $pythonCommand) {
  throw "Python is required to run the local HTTP server. Install Python, then try again."
}

Write-Host "Rebuilding the project catalog..."
& node "scripts\build-workspace.mjs"
if ($LASTEXITCODE -ne 0) {
  throw "The project catalog build failed with exit code $LASTEXITCODE."
}

Write-Host "Starting the workspace at $dashboardUrl"
$serverProcess = Start-Process `
  -FilePath $pythonCommand.Source `
  -ArgumentList @("-m", "http.server", "$Port", "--bind", "127.0.0.1") `
  -WorkingDirectory $workspaceRoot `
  -NoNewWindow `
  -PassThru

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ($serverProcess.HasExited) {
      throw "The local server stopped before it became ready. Port $Port may already be in use."
    }

    try {
      $response = Invoke-WebRequest `
        -Uri $dashboardUrl `
        -Method Head `
        -UseBasicParsing `
        -TimeoutSec 1
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $ready) {
    throw "The local server did not become ready at $dashboardUrl."
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
