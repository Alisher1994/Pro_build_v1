# PowerShell скрипт для загрузки исправлений детальной информации об остатке кассы

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_PATH = "C:\Users\LOQ\Desktop\App\CAM\football_school"

Write-Host "🚀 Загрузка исправлений детальной информации об остатке кассы..." -ForegroundColor Green
Write-Host ""

# Файлы для загрузки
$files = @(
    @{
        Local = "app.py"
        Remote = "app.py"
    },
    @{
        Local = "frontend\static\js\cash.js"
        Remote = "frontend/static/js/cash.js"
    }
)

# Проверяем существование файлов
Write-Host "📋 Проверка файлов..." -ForegroundColor Yellow
foreach ($file in $files) {
    $localPath = Join-Path $LOCAL_PATH $file.Local
    if (Test-Path $localPath) {
        Write-Host "  ✅ $($file.Local)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($file.Local) - НЕ НАЙДЕН!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📤 Загрузка файлов на сервер..." -ForegroundColor Yellow
Write-Host "Пароль: 12345678" -ForegroundColor Cyan
Write-Host ""

# Загружаем файлы
foreach ($file in $files) {
    $localPath = Join-Path $LOCAL_PATH $file.Local
    $remotePath = "${REMOTE_PATH}/$($file.Remote)"
    
    Write-Host "  📤 Загрузка: $($file.Local)..." -ForegroundColor Cyan
    
    scp "$localPath" "${USER}@${SERVER}:${remotePath}" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Успешно загружено" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Ошибка загрузки" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔧 Настройка прав доступа на сервере..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "chown www-data:www-data ${REMOTE_PATH}/app.py && chown -R www-data:www-data ${REMOTE_PATH}/frontend/static/js/cash.js && chmod 644 ${REMOTE_PATH}/app.py && chmod 644 ${REMOTE_PATH}/frontend/static/js/cash.js" 2>&1 | Out-Null

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
Write-Host "   ✅ Добавлена детальная информация об остатке кассы" -ForegroundColor White
Write-Host "   ✅ Показывается разбивка: приход - расходы - передачи" -ForegroundColor White
Write-Host "   ✅ При отрицательном балансе указывается причина" -ForegroundColor White
Write-Host "   ✅ Улучшены сообщения об ошибках" -ForegroundColor White


