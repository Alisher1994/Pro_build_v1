# Скрипт для загрузки исправленных файлов для редактирования группы
# Исправление: 400 (BAD REQUEST) при редактировании группы

# Автоматическое определение директории проекта
$PROJECT_DIR = "C:\Users\LOQ\Desktop\App\CAM\football_school"

# Если скрипт запущен из директории проекта, используем текущую директорию
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $scriptPath "app.py")) {
    $PROJECT_DIR = $scriptPath
}

# Переход в директорию проекта
Set-Location $PROJECT_DIR

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"

$FILES = @(
    @{
        Local = Join-Path $PROJECT_DIR "frontend\static\js\groups.js"
        Remote = "$REMOTE_PATH/frontend/static/js/groups.js"
    },
    @{
        Local = Join-Path $PROJECT_DIR "app.py"
        Remote = "$REMOTE_PATH/app.py"
    }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Загрузка исправления: Group Edit Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Директория проекта: $PROJECT_DIR" -ForegroundColor Gray
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($file in $FILES) {
    $localFile = $file.Local
    $remoteFile = $file.Remote
    
    # Проверка существования файла
    if (-not (Test-Path $localFile)) {
        Write-Host "❌ Файл не найден: $localFile" -ForegroundColor Red
        $failCount++
        continue
    }
    
    Write-Host "📁 Локальный файл: $localFile" -ForegroundColor Green
    Write-Host "🌐 Удаленный путь: $remoteFile" -ForegroundColor Green
    Write-Host "📤 Загрузка..." -ForegroundColor Yellow
    
    scp $localFile "${USER}@${SERVER}:${remoteFile}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Файл успешно загружен!" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "❌ Ошибка при загрузке файла!" -ForegroundColor Red
        $failCount++
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Результат: $successCount успешно, $failCount ошибок" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($successCount -gt 0) {
    Write-Host "🔧 Теперь выполните на сервере:" -ForegroundColor Cyan
    Write-Host "   ssh ${USER}@${SERVER}" -ForegroundColor White
    Write-Host "   systemctl restart football_school" -ForegroundColor White
    Write-Host ""
}

if ($failCount -gt 0) {
    Write-Host "⚠️  Некоторые файлы не были загружены!" -ForegroundColor Yellow
    Write-Host "Проверьте подключение к серверу и права доступа." -ForegroundColor Yellow
    exit 1
}

