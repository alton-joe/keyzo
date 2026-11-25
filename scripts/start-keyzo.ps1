# Starts the Keyzo API + a Cloudflare quick tunnel, then points Vercel at the new tunnel address.
# Registered as a scheduled task that runs at logon (see scripts/README in the chat / install-autostart.ps1).
$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$apiDir  = Join-Path $root 'backend\src\Keyzo.Api\bin\Debug\net10.0'
$vercel  = Join-Path $root 'frontend\vercel.json'
$tunnelLog = Join-Path $root 'tunnel.log'
$cf      = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$log     = Join-Path $root 'autostart.log'
function Log($m) { "$(Get-Date -Format s) $m" | Add-Content $log }

try {
  # 1. MySQL (normally already an automatic service)
  $svc = Get-Service MySQL80 -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Running') { Start-Service MySQL80; Log 'started MySQL80' }

  # 2. API on :5080
  if (-not (Get-NetTCPConnection -LocalPort 5080 -State Listen -ErrorAction SilentlyContinue)) {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    Start-Process -FilePath (Join-Path $apiDir 'Keyzo.Api.exe') -WorkingDirectory $apiDir -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $root 'api.run.log') -RedirectStandardError (Join-Path $root 'api.run.err')
    Log 'started API'
  }
  $ok = $false
  for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
    try { $ok = (Invoke-WebRequest http://localhost:5080/health -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { Start-Sleep 2 }
  }
  if (-not $ok) { Log 'API did not become healthy'; exit 1 }

  # 3. fresh tunnel
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  Remove-Item $tunnelLog -ErrorAction SilentlyContinue
  Start-Process -FilePath $cf -ArgumentList 'tunnel', '--url', 'http://localhost:5080', '--logfile', $tunnelLog -WindowStyle Hidden
  $url = $null
  for ($i = 0; $i -lt 40 -and -not $url; $i++) {
    Start-Sleep 2
    if (Test-Path $tunnelLog) { $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
  }
  if (-not $url) { Log 'no tunnel url'; exit 1 }
  Log "tunnel $url"

  # 4. update vercel.json and push when the address changed
  $json = Get-Content $vercel -Raw
  if ($json -notmatch [regex]::Escape($url)) {
    $new = [regex]::Replace($json, 'https://[a-z0-9-]+\.trycloudflare\.com', $url)
    [IO.File]::WriteAllText($vercel, $new)
    Set-Location $root
    git add frontend/vercel.json
    git commit -q -m "Update tunnel address" | Out-Null
    git push -q 2>&1 | Out-Null
    Log 'pushed new tunnel address'
  }
} catch { Log "error: $_"; exit 1 }
