# Convert an Android App Bundle (.aab) to a universal installable .apk (Windows).
# Usage:
#   .\scripts\windows\aab-to-apk.ps1 -AabPath "C:\path\to\app.aab"
#   .\scripts\windows\aab-to-apk.ps1   # uses build-artifacts\smartshelf.aab if present

param(
    [string]$AabPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ArtifactsDir = Join-Path $RepoRoot "build-artifacts"
$ToolsDir = Join-Path $ArtifactsDir "tools"
$BundletoolJar = Join-Path $ToolsDir "bundletool.jar"
$BundletoolVersion = "1.18.0"
$BundletoolUrl = "https://github.com/google/bundletool/releases/download/$BundletoolVersion/bundletool-all-$BundletoolVersion.jar"

if (-not $AabPath) {
    $default = Join-Path $ArtifactsDir "smartshelf.aab"
    if (Test-Path $default) { $AabPath = $default }
}

if (-not $AabPath -or -not (Test-Path $AabPath)) {
    Write-Host "Place your .aab in: $ArtifactsDir\smartshelf.aab"
    Write-Host "Or run: .\scripts\windows\aab-to-apk.ps1 -AabPath `"C:\Downloads\your.aab`""
    exit 1
}

New-Item -ItemType Directory -Force -Path $ArtifactsDir, $ToolsDir | Out-Null

if (-not (Test-Path $BundletoolJar)) {
    Write-Host "Downloading bundletool $BundletoolVersion ..."
    Invoke-WebRequest -Uri $BundletoolUrl -OutFile $BundletoolJar -UseBasicParsing
}

$ApksOut = Join-Path $ArtifactsDir "smartshelf-universal.apks"
$ExtractDir = Join-Path $ArtifactsDir "apks-extract"
$ApkOut = Join-Path $ArtifactsDir "smartshelf-universal.apk"

if (Test-Path $ApksOut) { Remove-Item $ApksOut -Force }
if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }

Write-Host "Converting: $AabPath"
java -jar $BundletoolJar build-apks --bundle="$AabPath" --output="$ApksOut" --mode=universal

$ZipCopy = "$ApksOut.zip"
Copy-Item $ApksOut $ZipCopy -Force
Expand-Archive -Path $ZipCopy -DestinationPath $ExtractDir -Force
Remove-Item $ZipCopy -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ExtractDir "universal.apk") -Destination $ApkOut -Force

# Sign so the APK installs (bundletool universal output is unsigned by default)
$Keytool = "${env:ProgramFiles}\Android\Android Studio\jbr\bin\keytool.exe"
$Apksigner = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1 |
  ForEach-Object { Join-Path $_.FullName "apksigner.bat" }

$Ks = Join-Path $ArtifactsDir "signing-debug.keystore"
if ($Apksigner -and (Test-Path $Apksigner)) {
  if (-not (Test-Path $Ks) -and (Test-Path $Keytool)) {
    & $Keytool -genkeypair -v -keystore $Ks -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 `
      -storepass android -keypass android -dname "CN=SmartShelf Debug,O=SmartShelf,C=US"
  }
  if (Test-Path $Ks) {
    & $Apksigner sign --ks $Ks --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android $ApkOut
    Write-Host "Signed with build-artifacts\signing-debug.keystore (local debug — uninstall old SmartShelf first if install fails)."
  }
} else {
  Write-Host "WARNING: apksigner not found — APK may not install. Install Android SDK build-tools or sign manually."
}

Write-Host ""
Write-Host "Done: $ApkOut"
Write-Host "Copy to your phone and install (enable Install unknown apps if prompted)."
