$ErrorActionPreference = 'SilentlyContinue'
$log = "C:\Users\hi\AppData\Local\Temp\opencode\cf-auto.log"
$urlFile = "C:\Users\hi\OneDrive\Desktop\new1\backend\tunnel-url.txt"
$envFile = "C:\Users\hi\OneDrive\Desktop\new1\backend\.env"
$cfgFile = "C:\Users\hi\OneDrive\Desktop\new1\backend\data\server-config.json"
$exe = "C:\Users\hi\AppData\Local\cloudflared\cloudflared.exe"
$lastSynced = $null

function Get-LatestUrl {
  if (!(Test-Path $log)) { return $null }
  $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -Last 1
  if ($m) { return ([regex]::Match($m.Line, "https://[a-z0-9-]+\.trycloudflare\.com")).Value }
  return $null
}

function Sync-TruecallerUrl {
  param([string]$u)
  if ($u -eq $script:lastSynced) { return }
  $envChanged = $false
  $cfgChanged = $false
  if (Test-Path $envFile) {
    $txt = Get-Content $envFile -Raw
    if ($txt -notmatch [regex]::Escape($u)) {
      $txt = [regex]::Replace($txt, "TRUECALLER_CALLBACK_URL=.*", "TRUECALLER_CALLBACK_URL=$u")
      [System.IO.File]::WriteAllText($envFile, $txt, (New-Object System.Text.UTF8Encoding($false)))
      $envChanged = $true
    }
  }
  if (Test-Path $cfgFile) {
    try {
      $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
      if ($cfg.truecaller.callbackUrl -ne $u) {
        $cfg.truecaller.callbackUrl = $u
        [System.IO.File]::WriteAllText($cfgFile, ($cfg | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
        $cfgChanged = $true
      }
    } catch {}
  }
  if ($envChanged -or $cfgChanged) {
    $script:lastSynced = $u
    "TUNNEL URL CHANGED -> $u (Truecaller callback updated, server restarting)" | Out-String | Write-Output
    Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*new1*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep 4
    Start-Process node -ArgumentList "server.js" -WorkingDirectory "C:\Users\hi\OneDrive\Desktop\new1\backend" -WindowStyle Hidden
    return $true
  } else {
    $script:lastSynced = $u
    return $false
  }
}

function Start-Tunnel {
  Remove-Item $log -ErrorAction SilentlyContinue
  $p = Start-Process $exe -ArgumentList 'tunnel --url http://localhost:3000 --no-autoupdate --protocol http2 --logfile "C:\Users\hi\AppData\Local\Temp\opencode\cf-auto.log" --loglevel info' -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep 2
    $u = Get-LatestUrl
    if ($u) { Set-Content $urlFile $u; return @{ proc = $p; url = $u } }
    if ($p.HasExited) { return @{ proc = $p; url = $null } }
  }
  return @{ proc = $p; url = $null }
}

function Is-Stuck {
  if (!(Test-Path $log)) { return $false }
  $tail = Get-Content $log -Tail 14
  return ($tail -match 'Unauthorized: Tunnel not found')
}

while ($true) {
  $tun = Start-Tunnel
  $proc = $tun.proc
  $u = $tun.url
  if ($u) {
    Set-Content $urlFile $u
    "URL: $u" | Out-String | Write-Output
    Sync-TruecallerUrl -u $u | Out-Null
  }

  while (-not $proc.HasExited) {
    Start-Sleep 20
    $current = Get-LatestUrl
    if ($current -and $current -ne $u) {
      $u = $current
      Set-Content $urlFile $u
      "URL CHANGED while running: $u" | Out-String | Write-Output
      Sync-TruecallerUrl -u $u | Out-Null
      break
    }
    if (Is-Stuck) {
      "stuck detected - restarting tunnel" | Out-String | Write-Output
      Stop-Process -Id $proc.Id -Force
      Start-Sleep 3
      break
    }
  }
  "tunnel exited - restarting in 5s" | Out-String | Write-Output
  Start-Sleep 5
}