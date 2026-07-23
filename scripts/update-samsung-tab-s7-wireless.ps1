param(
  [string]$ApkPath = (Join-Path $PSScriptRoot '..\apps\pos-flutter\build\app\outputs\flutter-apk\app-release.apk'),
  [string]$TabletPairName = 'adb-R52N81A1Q2E',
  [string]$PackageName = 'com.apex.pos.pos_flutter',
  [string]$ActivityName = 'com.apex.pos.pos_flutter/.MainActivity'
)

$ErrorActionPreference = 'Stop'

function Invoke-Adb {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & adb @Arguments
}

function Get-ConnectedDeviceSerial {
  param(
    [Parameter(Mandatory = $true)]
    [string]$MatchText
  )

  $devices = Invoke-Adb -Arguments @('devices', '-l')

  foreach ($line in $devices) {
    if ($line -match '^\S+\s+device\b' -and $line -match [regex]::Escape($MatchText)) {
      return ($line -split '\s+')[0]
    }
  }

  return $null
}

function Get-WirelessEndpoint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$MatchText
  )

  $services = Invoke-Adb -Arguments @('mdns', 'services')

  foreach ($line in $services) {
    if ($line -match [regex]::Escape($MatchText) -and $line -match '_adb-tls-connect._tcp') {
      if ($line -match '(\d+\.\d+\.\d+\.\d+:\d+)') {
        return $matches[1]
      }
    }
  }

  foreach ($line in $services) {
    if ($line -match '_adb-tls-connect._tcp' -and $line -match '(\d+\.\d+\.\d+\.\d+:\d+)') {
      return $matches[1]
    }
  }

  return $null
}

$resolvedApkPath = [System.IO.Path]::GetFullPath($ApkPath)

if (-not (Test-Path $resolvedApkPath)) {
  throw "APK not found: $resolvedApkPath"
}

$deviceSerial = Get-ConnectedDeviceSerial -MatchText $TabletPairName

if (-not $deviceSerial) {
  $endpoint = Get-WirelessEndpoint -MatchText $TabletPairName

  if (-not $endpoint) {
    throw "No paired wireless ADB endpoint found for $TabletPairName. Open Wireless debugging on the tablet first."
  }

  Write-Host "Connecting to $endpoint ..."
  Invoke-Adb -Arguments @('connect', $endpoint) | Write-Host
  Start-Sleep -Seconds 1
  $deviceSerial = Get-ConnectedDeviceSerial -MatchText $TabletPairName

  if (-not $deviceSerial) {
    throw "ADB connect succeeded, but the tablet did not appear as a ready device."
  }
}

Write-Host "Using device $deviceSerial"
Write-Host "Installing $resolvedApkPath ..."
Invoke-Adb -Arguments @('-s', $deviceSerial, 'install', '-r', $resolvedApkPath) | Write-Host

Write-Host "Launching $ActivityName ..."
Invoke-Adb -Arguments @('-s', $deviceSerial, 'shell', 'am', 'start', '-n', $ActivityName) | Write-Host

Write-Host "Wireless update complete."
