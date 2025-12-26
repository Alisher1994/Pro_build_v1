# PowerShell скрипт для загрузки изменений страницы входа на сервер

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"
$LOCAL_PATH = "C:\Users\LOQ\Desktop\App\CAM\football_school"

Write-Host "🚀 Загрузка изменений страницы входа на сервер..." -ForegroundColor Green
Write-Host ""

# Файлы для загрузки
$files = @(
    @{
        Local = "frontend\templates\login.html"
        Remote = "frontend/templates/login.html"
    },
    @{
        Local = "frontend\static\css\style.css"
        Remote = "frontend/static/css/style.css"
    },
    @{
        Local = "frontend\static\videos\Login_video.mp4"
        Remote = "frontend/static/videos/Login_video.mp4"
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

# Создаем папку videos на сервере (если её нет)
Write-Host "📁 Создание папки videos на сервере..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "mkdir -p ${REMOTE_PATH}/frontend/static/videos" 2>&1 | Out-Null

# Загружаем файлы
foreach ($file in $files) {
    $localPath = Join-Path $LOCAL_PATH $file.Local
    $remotePath = "${REMOTE_PATH}/$($file.Remote)"
    
    Write-Host "  📤 Загрузка: $($file.Local)..." -ForegroundColor Cyan
    
    # Заменяем обратные слеши на прямые для SCP
    $localPathForScp = $localPath -replace '\\', '/'
    
    scp "$localPath" "${USER}@${SERVER}:${remotePath}" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Успешно загружено" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Ошибка загрузки" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔧 Настройка прав доступа на сервере..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "chown -R www-data:www-data ${REMOTE_PATH}/frontend && chmod -R 755 ${REMOTE_PATH}/frontend/static/videos" 2>&1 | Out-Null

Write-Host ""
Write-Host "🔄 Перезапуск сервиса..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "systemctl restart football_school" 2>&1 | Out-Null

Write-Host ""
Write-Host "✅ Загрузка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Проверка статуса сервиса:" -ForegroundColor Cyan
ssh "${USER}@${SERVER}" "systemctl status football_school --no-pager -l | head -n 10"

Write-Host ""
Write-Host "🌐 Проверьте страницу входа:" -ForegroundColor Cyan
Write-Host "   https://d-promo.uz/login" -ForegroundColor White


