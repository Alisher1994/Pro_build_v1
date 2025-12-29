# PowerShell скрипт для загрузки исправлений логики кассы на сервер

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_PATH = "C:\Users\LOQ\Desktop\App\CAM\football_school"

Write-Host "🚀 Загрузка исправлений логики кассы на сервер..." -ForegroundColor Green
Write-Host ""

# Файл для загрузки
$file = "app.py"
$localPath = Join-Path $LOCAL_PATH $file

# Проверяем существование файла
Write-Host "📋 Проверка файла..." -ForegroundColor Yellow
if (Test-Path $localPath) {
    Write-Host "  ✅ $file" -ForegroundColor Green
} else {
    Write-Host "  ❌ $file - НЕ НАЙДЕН!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📤 Загрузка файла на сервер..." -ForegroundColor Yellow
Write-Host "Пароль: 12345678" -ForegroundColor Cyan
Write-Host ""

# Загружаем файл
Write-Host "  📤 Загрузка: $file..." -ForegroundColor Cyan
scp "$localPath" "${USER}@${SERVER}:${REMOTE_PATH}/" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ Успешно загружено" -ForegroundColor Green
} else {
    Write-Host "    ❌ Ошибка загрузки" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Настройка прав доступа на сервере..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "chown www-data:www-data ${REMOTE_PATH}/app.py && chmod 644 ${REMOTE_PATH}/app.py" 2>&1 | Out-Null

Write-Host ""
Write-Host "🔄 Перезапуск сервиса..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "systemctl restart football_school" 2>&1 | Out-Null

Write-Host ""
Write-Host "✅ Загрузка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Проверка статуса сервиса:" -ForegroundColor Cyan
ssh "${USER}@${SERVER}" "systemctl status football_school --no-pager -l | head -n 15"

Write-Host ""
Write-Host "🌐 Проверьте работу:" -ForegroundColor Cyan
Write-Host "   https://d-promo.uz/finances → вкладка 'Касса'" -ForegroundColor White
Write-Host ""
Write-Host "📝 Что было исправлено:" -ForegroundColor Cyan
Write-Host "   ✅ Остаток кассы теперь учитывает только наличные платежи" -ForegroundColor White
Write-Host "   ✅ Добавлена проверка достаточности средств при передаче" -ForegroundColor White
Write-Host "   ✅ Нельзя передать больше, чем есть в кассе" -ForegroundColor White


