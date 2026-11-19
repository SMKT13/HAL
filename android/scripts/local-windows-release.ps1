# HAL Desk 5.0 — local Windows verification without paid GitHub runners.
# Run on your own trusted machine, after manually backing up 4.6 data.
# This NEVER installs/uninstalls an app, opens a broker session or uploads keys.
[CmdletBinding()]
param(
  [switch]$Sign,
  [switch]$SkipBrowser
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if($Sign -and $SkipBrowser){throw 'Signed candidate requires browser tests. Omit -SkipBrowser.'}
$repoRoot=Split-Path -Parent $PSScriptRoot
$sdk=$env:ANDROID_SDK_ROOT
if([string]::IsNullOrWhiteSpace($sdk)){$sdk=$env:ANDROID_HOME}
if([string]::IsNullOrWhiteSpace($sdk)){throw 'Set ANDROID_SDK_ROOT to the Android SDK installation path (platform 35, build tools 35.0.0).'}
$buildTools=Join-Path $sdk 'build-tools\35.0.0'
$zipalign=Join-Path $buildTools 'zipalign.exe'
$apksigner=Join-Path $buildTools 'apksigner.bat'
$gradle=Join-Path $repoRoot 'gradlew.bat'
$release=Join-Path $repoRoot 'app\build\outputs\apk\release\app-release-unsigned.apk'
$dist=Join-Path $repoRoot 'build'
$unsigned=Join-Path $dist 'HAL-Desk-v5.1.0-unsigned.apk'
$signed=Join-Path $dist 'HAL-Desk-v5.1.0-signed.apk'
$expected='a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382'
foreach($path in @($zipalign,$apksigner,$gradle)){
 if(!(Test-Path -LiteralPath $path)){throw "Missing required build tool: $path"}
}
foreach($name in @('node.exe','npm.cmd','npx.cmd','java.exe')){
 if(!(Get-Command $name -ErrorAction SilentlyContinue)){throw "Missing $name. Install Node 22 and JDK 17."}
}
function Run-Checked([string]$exe,[string[]]$arguments){
 Write-Host "[VERIFY] $exe $($arguments -join ' ')"
 & $exe @arguments
 if($LASTEXITCODE -ne 0){throw "Command failed ($LASTEXITCODE): $exe"}
}
Push-Location $repoRoot
try{
 $buildText=Get-Content -LiteralPath (Join-Path $repoRoot 'app\build.gradle') -Raw
 if(!$buildText.Contains("applicationId 'in.smkt.haldesk'") -or
    !$buildText.Contains('versionCode 34') -or
    !$buildText.Contains("versionName '5.1.0'")){
  throw 'Release identity mismatch: expected in.smkt.haldesk / versionCode 34 / 5.1.0'
 }
 Write-Host '[VERIFY] Immutable package and upgrade version matched.'
 Run-Checked 'npm.cmd' @('ci','--no-audit','--no-fund')
 Run-Checked 'npm.cmd' @('test')
 Run-Checked 'npm.cmd' @('run','assets')
 if(!$SkipBrowser){
  Run-Checked 'npx.cmd' @('playwright','install','chromium')
  Run-Checked 'npm.cmd' @('run','test:ui')
 }else{
  Write-Warning 'Browser tests intentionally skipped: this output is NOT release-verified.'
 }
 Run-Checked $gradle @('--no-daemon',':app:testReleaseUnitTest',':app:lintRelease',':app:assembleRelease')
 if(!(Test-Path -LiteralPath $release)){throw "Gradle did not produce expected release APK: $release"}
 New-Item -ItemType Directory -Force -Path $dist | Out-Null
 Run-Checked $zipalign @('-f','-P','16','4',$release,$unsigned)
 Run-Checked $zipalign @('-c','-P','16','4',$unsigned)
 Write-Host "[OK] Built aligned unsigned candidate: $unsigned"
 if(!$Sign){
  Write-Host '[STOP] Unsigned only. It cannot update your existing HAL Desk 4.6 installation.'
  return
 }
 $key=$env:HAL_SIGNING_KEY_FILE
 $password=$env:HAL_SIGNING_PASSWORD_FILE
 if([string]::IsNullOrWhiteSpace($key) -or [string]::IsNullOrWhiteSpace($password) -or
    !(Test-Path -LiteralPath $key) -or !(Test-Path -LiteralPath $password)){
  throw 'Original keystore and password file required outside the repository. Set HAL_SIGNING_KEY_FILE and HAL_SIGNING_PASSWORD_FILE.'
 }
 if(Test-Path -LiteralPath $signed){Remove-Item -LiteralPath $signed -Force}
 try{
  Run-Checked $apksigner @('sign','--ks',$key,'--ks-key-alias','hal-personal',
    '--ks-pass',("file:"+$password),'--v1-signing-enabled','false',
    '--v2-signing-enabled','true','--v3-signing-enabled','true',
    '--out',$signed,$unsigned)
  $certOutput=(& $apksigner 'verify' '--verbose' '--print-certs' $signed 2>&1 | Out-String)
  if($LASTEXITCODE -ne 0){throw 'apksigner verification failed'}
  if($certOutput.ToLowerInvariant() -notmatch [regex]::Escape($expected)){throw 'Original signing certificate fingerprint does not match installed HAL Desk'}
  if($certOutput -notmatch 'Verified using v2 scheme.*true' -or $certOutput -notmatch 'Verified using v3 scheme.*true'){
   throw 'Expected APK v2 and v3 signatures were not both verified'
  }
  Write-Host "[OK] Original certificate and v2/v3 signatures checked. Candidate: $signed"
  Write-Warning 'Do not install until you have backed up the real book and completed a careful phone upgrade test.'
 }catch{
  if(Test-Path -LiteralPath $signed){Remove-Item -LiteralPath $signed -Force}
  throw
 }
}finally{Pop-Location}
