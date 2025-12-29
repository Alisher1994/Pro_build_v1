# Скрипт для загрузки исправленного файла students.html на сервер
# Исправление: openTransferPaymentModal is not defined

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_FILE = "frontend\templates\students.html"
$REMOTE_FILE = "$REMOTE_PATH/frontend/templates/students.html"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Загрузка исправления: Transfer Button Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка существования файла
if (-not (Test-Path $LOCAL_FILE)) {
    Write-Host "❌ Ошибка: Файл не найден: $LOCAL_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Локальный файл: $LOCAL_FILE" -ForegroundColor Green
Write-Host "🌐 Удаленный путь: $REMOTE_FILE" -ForegroundColor Green
Write-Host ""

# Загрузка файла
Write-Host "📤 Загрузка файла на сервер..." -ForegroundColor Yellow
Write-Host ""

scp $LOCAL_FILE "${USER}@${SERVER}:${REMOTE_FILE}"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Файл успешно загружен!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔧 Теперь выполните на сервере:" -ForegroundColor Cyan
    Write-Host "   ssh ${USER}@${SERVER}" -ForegroundColor White
    Write-Host "   systemctl restart football_school" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Ошибка при загрузке файла!" -ForegroundColor Red
    Write-Host "Проверьте подключение к серверу и права доступа." -ForegroundColor Yellow
    exit 1
}

