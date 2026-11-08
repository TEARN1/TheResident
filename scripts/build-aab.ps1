$ErrorActionPreference = "Stop"

$jdkCandidates = @(
  @(
    $env:JAVA_HOME,
    "C:\Users\ACER\.jdks\jbr-21.0.10",
    "C:\Program Files\Android\Android Studio\jbr"
  ) | Where-Object { $_ -and (Test-Path "$_\bin\java.exe") }
)

if ($jdkCandidates.Count -eq 0) {
  throw "No JDK found. Set JAVA_HOME to JDK 17 or 21."
}
$env:JAVA_HOME = $jdkCandidates[0]

if (-not $env:ANDROID_HOME -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk")) {
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

$cachedGradle = Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.13*\*\gradle-8.13\bin\gradle.bat" -ErrorAction SilentlyContinue | Select-Object -First 1

Push-Location "$PSScriptRoot\..\android"
try {
  $aab = Join-Path $PWD "app\build\outputs\bundle\release\app-release.aab"
  if (Test-Path $aab) { Remove-Item $aab -Force }

  if ($cachedGradle) {
    & $cachedGradle.FullName clean bundleRelease --no-daemon
  } else {
    & .\gradlew.bat clean bundleRelease --no-daemon
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle bundleRelease failed with exit code $LASTEXITCODE"
  }

  $dest = Join-Path $PSScriptRoot "..\the-resident-release.aab"
  Copy-Item $aab $dest -Force
  Write-Host "Signed AAB ready at: $((Resolve-Path $dest).Path)"
} finally {
  Pop-Location
}
