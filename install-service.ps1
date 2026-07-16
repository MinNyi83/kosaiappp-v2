# Run this script as Administrator to install the NAS Bridge and Cloudflare Tunnel as Windows Services.
$ErrorActionPreference = "Stop"

# === HARDCODED CONFIGURATION ===
$NAS_PATH = "\\\\192.168.1.100\\dispatch-photos"
$PORT = "3010"
$INSTALL_DIR = "C:\Program Files\LocalNASBridge"
$TUNNEL_TOKEN = "" # Add your Cloudflare Tunnel Token here if you want it automated
# ===============================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Local NAS Bridge Windows Installer     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check for Admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Please run this PowerShell script as Administrator!"
    Exit
}

# 2. Create Target Directory
if (-not (Test-Path $INSTALL_DIR)) {
    Write-Host "Creating installation directory at $INSTALL_DIR..." -ForegroundColor Green
    New-Item -Path $INSTALL_DIR -ItemType Directory | Out-Null
}

# 3. Copy application files
Write-Host "Copying project files..." -ForegroundColor Green
Copy-Item -Path "$PSScriptRoot\local-nas-bridge.js" -Destination "$INSTALL_DIR\" -Force
Copy-Item -Path "$PSScriptRoot\package.json" -Destination "$INSTALL_DIR\" -Force

# 4. Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
Push-Location $INSTALL_DIR
Start-Process cmd.exe -ArgumentList "/c npm install --production" -Wait -NoNewWindow
Pop-Location

# 5. Download NSSM (Non-Sucking Service Manager) to manage the background service
$nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
$zipPath = "$INSTALL_DIR\nssm.zip"
$extractedPath = "$INSTALL_DIR\nssm-temp"

if (-not (Test-Path "$INSTALL_DIR\nssm.exe")) {
    Write-Host "Downloading NSSM service manager..." -ForegroundColor Green
    Invoke-WebRequest -Uri $nssmUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $extractedPath -Force
    # Copy the 64-bit version of nssm
    Copy-Item -Path "$extractedPath\nssm-2.24\win64\nssm.exe" -Destination "$INSTALL_DIR\nssm.exe" -Force
    # Clean up zip files
    Remove-Item -Path $zipPath -Force
    Remove-Item -Path $extractedPath -Recurse -Force
}

# 6. Install the NAS Bridge Service
Write-Host "Registering Local NAS Bridge Service..." -ForegroundColor Green
$NodePath = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $NodePath) {
    Write-Error "Node.js is not installed or not in PATH! Please install Node.js first."
    Exit
}

# Remove service if it already exists
Start-Process "$INSTALL_DIR\nssm.exe" -ArgumentList "remove LocalNASBridge confirm" -Wait -NoNewWindow

# Configure the service
Start-Process "$INSTALL_DIR\nssm.exe" -ArgumentList "install LocalNASBridge `"$NodePath`" `"$INSTALL_DIR\local-nas-bridge.js`"" -Wait -NoNewWindow
Start-Process "$INSTALL_DIR\nssm.exe" -ArgumentList "set LocalNASBridge AppDirectory `"$INSTALL_DIR`"" -Wait -NoNewWindow
Start-Process "$INSTALL_DIR\nssm.exe" -ArgumentList "set LocalNASBridge AppEnvironmentExtra NAS_MOUNT_PATH=$NAS_PATH PORT=$PORT" -Wait -NoNewWindow
Start-Process "$INSTALL_DIR\nssm.exe" -ArgumentList "set LocalNASBridge Start SERVICE_AUTO_START" -Wait -NoNewWindow

# Start the service
Start-Service -Name "LocalNASBridge"
Write-Host "🚀 LocalNASBridge Service successfully installed and started!" -ForegroundColor Green

# 7. Optional: Install Cloudflare Tunnel as a Windows Service
if ($TUNNEL_TOKEN) {
    Write-Host "Setting up Cloudflare Tunnel Service..." -ForegroundColor Green
    $cfPath = "$INSTALL_DIR\cloudflared.exe"
    if (-not (Test-Path $cfPath)) {
        Write-Host "Downloading cloudflared.exe..." -ForegroundColor Green
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cfPath
    }
    
    # Run cloudflared service install command
    Start-Process $cfPath -ArgumentList "service install $TUNNEL_TOKEN" -Wait -NoNewWindow
    Write-Host "☁️ Cloudflare Tunnel Service installed!" -ForegroundColor Green
} else {
    Write-Host "Skipping Cloudflare Tunnel service installation (No Tunnel Token provided)." -ForegroundColor Yellow
}

Write-Host "`nInstallation Completed Successfully!" -ForegroundColor Green
Write-Host "You can manage the service using Windows Services GUI (services.msc) under 'LocalNASBridge'." -ForegroundColor Cyan
