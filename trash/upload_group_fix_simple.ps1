# Простой скрипт для загрузки исправления редактирования группы
# Можно запустить из любой директории

$PROJECT_DIR = "C:\Users\LOQ\Desktop\App\CAM\football_school"
$SERVER = "45.92.173.37"
$USER = "root"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Загрузка исправления: Group Edit Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка существования директории проекта
if (-not (Test-Path $PROJECT_DIR)) {
    Write-Host "❌ Директория проекта не найдена: $PROJECT_DIR" -ForegroundColor Red
    Write-Host "Измените переменную `$PROJECT_DIR в скрипте" -ForegroundColor Yellow
    exit 1
}

# Файл 1: groups.js
$file1 = Join-Path $PROJECT_DIR "frontend\static\js\groups.js"
if (Test-Path $file1) {
    Write-Host "📤 Загрузка groups.js..." -ForegroundColor Yellow
    scp $file1 "${USER}@${SERVER}:/opt/football_school/frontend/static/js/groups.js"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ groups.js загружен!" -ForegroundColor Green
    } else {
        Write-Host "❌ Ошибка загрузки groups.js" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Файл не найден: $file1" -ForegroundColor Red
}

Write-Host ""

# Файл 2: app.py
$file2 = Join-Path $PROJECT_DIR "app.py"
if (Test-Path $file2) {
    Write-Host "📤 Загрузка app.py..." -ForegroundColor Yellow
    scp $file2 "${USER}@${SERVER}:/opt/football_school/app.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ app.py загружен!" -ForegroundColor Green
    } else {
        Write-Host "❌ Ошибка загрузки app.py" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Файл не найден: $file2" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 Теперь выполните на сервере:" -ForegroundColor Cyan
Write-Host "   ssh ${USER}@${SERVER}" -ForegroundColor White
Write-Host "   systemctl restart football_school" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan

