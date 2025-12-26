# PowerShell script for full project upload to server via SCP
# Overwrites all files on server
# Excludes unnecessary files (venv, __pycache__, *.db, .git, etc.)

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_PATH = $PSScriptRoot

Write-Host "Starting full project upload to server..." -ForegroundColor Green
Write-Host "Local path: $LOCAL_PATH" -ForegroundColor Cyan
Write-Host "Server: ${USER}@${SERVER}:${REMOTE_PATH}" -ForegroundColor Cyan
Write-Host ""

# Create temporary folder without unnecessary files
$TEMP_DIR = "$env:TEMP\football_school_upload_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (Test-Path $TEMP_DIR) {
    Remove-Item -Recurse -Force $TEMP_DIR
}
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null

Write-Host "Copying files (excluding unnecessary)..." -ForegroundColor Yellow

# Exclusion patterns
$excludePatterns = @(
    "\\venv\\",
    "\\__pycache__\\",
    "\\.git\\",
    "\\.gitignore",
    "\\.winscpignore",
    "\\.dockerignore",
    "\.db$",
    "\.pyc$",
    "\.pyo$",
    "\.pyd$",
    "\\node_modules\\",
    "\\\.idea\\",
    "\\\.vscode\\",
    "\\\.cursor\\",
    "\\\.cache\\",
    "\\300ppi\\",
    "\\football_school\\"
)

# Counters
$totalFiles = 0
$copiedFiles = 0
$excludedFiles = 0

# Copy files, excluding unnecessary ones
Get-ChildItem -Path $LOCAL_PATH -Recurse -File | ForEach-Object {
    $totalFiles++
    $relativePath = $_.FullName.Substring($LOCAL_PATH.Length + 1)
    $shouldExclude = $false
    
    # Normalize path separators for matching
    $normalizedPath = $relativePath.Replace('\', '/')
    
    # Check exclusions - check if any part of the path matches exclusion patterns
    foreach ($pattern in $excludePatterns) {
        $normalizedPattern = $pattern.Replace('\\', '/')
        if ($normalizedPath -match $normalizedPattern) {
            $shouldExclude = $true
            $excludedFiles++
            break
        }
    }
    
    # Additional check: exclude if path contains venv, __pycache__, .git, etc.
    $pathParts = $normalizedPath -split '/'
    foreach ($part in $pathParts) {
        if ($part -eq 'venv' -or $part -eq '__pycache__' -or $part -eq '.git' -or 
            $part -eq 'node_modules' -or $part -eq '.idea' -or $part -eq '.vscode' -or
            $part -eq '.cursor' -or $part -eq '.cache' -or $part -eq '300ppi' -or
            $part -eq 'football_school') {
            $shouldExclude = $true
            $excludedFiles++
            break
        }
    }
    
    # Exclude .db, .pyc, .pyo, .pyd files
    $fileName = Split-Path $relativePath -Leaf
    if ($fileName -match '\.(db|pyc|pyo|pyd)$') {
        $shouldExclude = $true
        $excludedFiles++
    }
    
    if (-not $shouldExclude) {
        $destPath = Join-Path $TEMP_DIR $relativePath
        $destDir = Split-Path $destPath -Parent
        
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        try {
            Copy-Item $_.FullName -Destination $destPath -Force
            $copiedFiles++
            
            if ($copiedFiles % 50 -eq 0) {
                Write-Host "  Processed files: $copiedFiles" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "  Warning: Copy error: $relativePath" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Statistics:" -ForegroundColor Cyan
Write-Host "  Total files: $totalFiles" -ForegroundColor White
Write-Host "  Copied: $copiedFiles" -ForegroundColor Green
Write-Host "  Excluded: $excludedFiles" -ForegroundColor Yellow
Write-Host ""

Write-Host "Uploading to server via SCP..." -ForegroundColor Yellow
Write-Host "Warning: All files on server will be overwritten!" -ForegroundColor Red
Write-Host ""

# Request confirmation
$confirm = Read-Host "Continue upload? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Upload cancelled" -ForegroundColor Red
    Remove-Item -Recurse -Force $TEMP_DIR
    exit
}

Write-Host ""
Write-Host "Password for connection: 12345678" -ForegroundColor Cyan
Write-Host ""

# Upload via SCP (recursive)
$scpCommand = "scp -r `"$TEMP_DIR\*`" ${USER}@${SERVER}:${REMOTE_PATH}/"
Write-Host "Executing command: $scpCommand" -ForegroundColor Gray
Write-Host ""

# Execute SCP
$scpProcess = Start-Process -FilePath "scp" -ArgumentList "-r", "$TEMP_DIR\*", "${USER}@${SERVER}:${REMOTE_PATH}/" -NoNewWindow -Wait -PassThru

if ($scpProcess.ExitCode -eq 0) {
    Write-Host "Upload completed successfully!" -ForegroundColor Green
}
else {
    Write-Host "Upload error. Exit code: $($scpProcess.ExitCode)" -ForegroundColor Red
    Write-Host "Try executing command manually:" -ForegroundColor Yellow
    Write-Host "  scp -r `"$TEMP_DIR\*`" ${USER}@${SERVER}:${REMOTE_PATH}/" -ForegroundColor White
}

Write-Host ""
Write-Host "Cleaning temporary files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $TEMP_DIR

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps on server:" -ForegroundColor Cyan
Write-Host "1. Connect via SSH:" -ForegroundColor White
Write-Host "   ssh ${USER}@${SERVER}" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Set permissions:" -ForegroundColor White
Write-Host "   cd ${REMOTE_PATH}" -ForegroundColor Gray
Write-Host "   chown -R www-data:www-data ${REMOTE_PATH}" -ForegroundColor Gray
Write-Host "   chmod -R 775 ${REMOTE_PATH}/database" -ForegroundColor Gray
Write-Host "   chmod -R 775 ${REMOTE_PATH}/frontend/static/uploads" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Restart service:" -ForegroundColor White
Write-Host "   systemctl restart football_school" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Check status:" -ForegroundColor White
Write-Host "   systemctl status football_school --no-pager -l" -ForegroundColor Gray
Write-Host ""


