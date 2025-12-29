# PowerShell скрипт для загрузки проекта на сервер через SCP
# Исключает ненужные файлы (venv, __pycache__, *.db и т.д.)

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_PATH = "C:\Users\LOQ\Desktop\App\CAM\football_school"

Write-Host "🚀 Загрузка проекта на сервер..." -ForegroundColor Green

# Создаём временную папку без ненужных файлов
$TEMP_DIR = "$env:TEMP\football_school_upload"
if (Test-Path $TEMP_DIR) {
    Remove-Item -Recurse -Force $TEMP_DIR
}
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null

Write-Host "📦 Копирование файлов (исключая venv, __pycache__, *.db)..." -ForegroundColor Yellow

# Копируем файлы, исключая ненужные
Get-ChildItem -Path $LOCAL_PATH -Recurse | Where-Object {
    $_.FullName -notmatch "\\venv\\" -and
    $_.FullName -notmatch "\\__pycache__\\" -and
    $_.FullName -notmatch "\\\.git\\" -and
    $_.FullName -notmatch "\.db$" -and
    $_.FullName -notmatch "\.pyc$" -and
    $_.FullName -notmatch "\.pyo$" -and
    $_.FullName -notmatch "\.pyd$"
} | ForEach-Object {
    $relativePath = $_.FullName.Substring($LOCAL_PATH.Length + 1)
    $destPath = Join-Path $TEMP_DIR $relativePath
    $destDir = Split-Path $destPath -Parent
    
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir | Out-Null
    }
    
    if (-not $_.PSIsContainer) {
        Copy-Item $_.FullName -Destination $destPath
    }
}

Write-Host "📤 Загрузка на сервер через SCP..." -ForegroundColor Yellow
Write-Host "Пароль: GAbZDK&JgQ8`$hpmk" -ForegroundColor Cyan

# Загружаем через SCP
scp -r "$TEMP_DIR\*" "${USER}@${SERVER}:${REMOTE_PATH}/"

Write-Host "🧹 Очистка временных файлов..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $TEMP_DIR

Write-Host "✅ Загрузка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "Следующий шаг: подключитесь по SSH и запустите установку:" -ForegroundColor Cyan
Write-Host "  ssh ${USER}@${SERVER}" -ForegroundColor White
Write-Host "  cd ${REMOTE_PATH}" -ForegroundColor White
Write-Host "  chmod +x setup_vps.sh" -ForegroundColor White
Write-Host "  ./setup_vps.sh" -ForegroundColor White

