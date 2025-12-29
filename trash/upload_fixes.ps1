# PowerShell script for uploading fixed files to server
# Uploads only the files that were fixed

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_PATH = $PSScriptRoot

Write-Host "Uploading fixed files to server..." -ForegroundColor Green
Write-Host ""

# Files to upload (only fixed files)
$files = @(
    @{
        Local = "app.py"
        Remote = "$REMOTE_PATH/app.py"
    },
    @{
        Local = "frontend\static\js\cash.js"
        Remote = "$REMOTE_PATH/frontend/static/js/cash.js"
    },
    @{
        Local = "frontend\static\js\students.js"
        Remote = "$REMOTE_PATH/frontend/static/js/students.js"
    },
    @{
        Local = "frontend\templates\students.html"
        Remote = "$REMOTE_PATH/frontend/templates/students.html"
    }
)

$uploadedCount = 0
$failedCount = 0

foreach ($file in $files) {
    $localPath = Join-Path $LOCAL_PATH $file.Local
    
    if (Test-Path $localPath) {
        Write-Host "Uploading: $($file.Local)" -ForegroundColor Yellow
        $remotePath = $file.Remote
        
        # Convert Windows path to Unix path for remote
        $remotePath = $remotePath.Replace('\', '/')
        
        # Upload file
        scp $localPath "${USER}@${SERVER}:${remotePath}"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK: $($file.Local)" -ForegroundColor Green
            $uploadedCount++
        } else {
            Write-Host "  ERROR: $($file.Local)" -ForegroundColor Red
            $failedCount++
        }
        Write-Host ""
    } else {
        Write-Host "  WARNING: File not found: $localPath" -ForegroundColor Yellow
        $failedCount++
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Uploaded: $uploadedCount" -ForegroundColor Green
Write-Host "  Failed: $failedCount" -ForegroundColor $(if ($failedCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($uploadedCount -gt 0) {
    Write-Host "Next steps on server:" -ForegroundColor Cyan
    Write-Host "1. Connect: ssh ${USER}@${SERVER}" -ForegroundColor White
    Write-Host "2. Restart service: systemctl restart football_school" -ForegroundColor White
    Write-Host "3. Check status: systemctl status football_school --no-pager -l" -ForegroundColor White
    Write-Host ""
}
