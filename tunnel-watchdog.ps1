$ErrorActionPreference = 'SilentlyContinue'
$log = "C:\Users\hi\AppData\Local\Temp\opencode\cf-auto.log"
$urlFile = "C:\Users\hi\OneDrive\Desktop\new1\tunnel-url.txt"
$exe = "C:\Users\hi\AppData\Local\cloudflared\cloudflared.exe"

function Get-LatestUrl {
  if (!(Test-Path $log)) { return $null }
  $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -Last 1
  if ($m) { return ([regex]::Match($m.Line, "https://[a-z0-9-]+\.trycloudflare\.com")).Value }
  return $null
}

function Start-Tunnel {
  Remove-Item $log -ErrorAction SilentlyContinue
  $exe + "chalu ho raha hai"
  $p = Start-Process $exe -ArgumentList 'tunnel --url http://localhost:3000 --no-autoupdate --protocol http2 --logfile "C:\Users\hi\AppData\Local\Temp\opencode\cf-auto.log" --loglevel info' -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep 2
    $u = Get-LatestUrl
    if ($u) { Set-Content $urlFile $u; return $p }
    if ($p.HasExited) { return $p }
  }
  return $p
}

function Is-Stuck {
  if (!(Test-Path $log)) { return $false }
  $tail = Get-Content $log -Tail 14
  return ($tail -match 'Unauthorized: Tunnel not found')
}

while ($true) {
  $proc = Start-Tunnel
  $u = Get-LatestUrl
  if ($u) { "URL: $u" | Out-String | Write-Output; Set-Content $urlFile $u }

  while (-not $proc.HasExited) {
    Start-Sleep 20
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