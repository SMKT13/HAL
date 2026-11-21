# HAL Atlas AI Desk 5.4 - development-only Windows verification.
# Never signs, installs, uninstalls, changes data, or runs GitHub Actions.
[CmdletBinding()]
param(
    [switch]$Offline,
    [switch]$SkipNpmInstall,
    [switch]$BrowserUI
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$gradle = Join-Path $root 'gradlew.bat'
$build = Join-Path $root 'app\build.gradle'
$sdk = $env:ANDROID_SDK_ROOT
if ([string]::IsNullOrWhiteSpace($sdk)) { $sdk = $env:ANDROID_HOME }

function Invoke-Checked([string]$exe, [string[]]$arguments) {
    Write-Host "[AI VERIFY] $exe $($arguments -join ' ')"
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $exe. Verification is INCOMPLETE."
    }
}

foreach ($name in @('java.exe', 'node.exe', 'npm.cmd', 'python.exe')) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing $name. This script requires JDK, Node 22, and Python 3."
    }
}
if (-not (Test-Path -LiteralPath $gradle)) {
    throw "Gradle wrapper not found at $gradle"
}
if ([string]::IsNullOrWhiteSpace($sdk) -or -not (Test-Path -LiteralPath (Join-Path $sdk 'platforms\android-35\android.jar'))) {
    throw 'Android SDK platform 35 not found. Configure ANDROID_SDK_ROOT or ANDROID_HOME.'
}
if (-not (Test-Path -LiteralPath (Join-Path $sdk 'build-tools\35.0.0'))) {
    throw 'Android SDK build-tools 35.0.0 not found.'
}
$spec = Get-Content -LiteralPath $build -Raw
if (-not $spec.Contains("applicationId 'in.smkt.haldesk'")) {
    throw 'HAL Atlas application ID changed; refusing verification.'
}
if (-not $spec.Contains("versionCode 59") -or -not $spec.Contains("versionName '5.3.0'")) {
    throw 'This script is for the feature branch before assigning a 5.4 release candidate version.'
}
Write-Host '[AI VERIFY] Development identity verified. No signing or installation will occur.'

Push-Location $root
try {
    if (-not $SkipNpmInstall) {
        $npmArgs = @('ci', '--no-audit', '--no-fund')
        if ($Offline) { $npmArgs += '--offline' }
        Invoke-Checked 'npm.cmd' $npmArgs
    }
    Invoke-Checked 'npm.cmd' @('test')
    Invoke-Checked 'python.exe' @('-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v')
    Invoke-Checked 'npm.cmd' @('run', 'assets')
    if ($BrowserUI) {
        if (-not $Offline) { Invoke-Checked 'npx.cmd' @('playwright', 'install', 'chromium') }
        Invoke-Checked 'npm.cmd' @('run', 'test:ui')
    }
    $gradleArgs = @('--no-daemon')
    if ($Offline) { $gradleArgs += '--offline' }
    $gradleArgs += @(':app:testDebugUnitTest', ':app:lintDebug', ':app:assembleDebug')
    Invoke-Checked $gradle $gradleArgs

    $apk = Join-Path $root 'app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $apk)) { throw 'Debug APK not produced; verification INCOMPLETE.' }
    $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
    Write-Host "[PASS] Native Android debug-build checks completed. APK SHA256: $hash"
    Write-Host '[STOP] DEBUG ONLY. Do not install over the original-key-signed 5.3.0 app.'
    Write-Host '[STOP] Production release requires signed upgrade, backup, device reconciliation and explicit approval.'
} finally {
    Pop-Location
}
