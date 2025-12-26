# PowerShell скрипт для проверки загрузки файлов на сервер

$SERVER = "45.92.173.37"
$USER = "root"
$REMOTE_PATH = "/opt/football_school"

Write-Host "🔍 Проверка загрузки файлов на сервер..." -ForegroundColor Green
Write-Host ""

# Файлы для проверки
$files = @(
    "frontend/templates/login.html",
    "frontend/static/css/style.css",
    "frontend/static/videos/Login_video.mp4"
)

Write-Host "📋 Проверка существования файлов на сервере:" -ForegroundColor Yellow
Write-Host ""

foreach ($file in $files) {
    $remotePath = "${REMOTE_PATH}/${file}"
    
    Write-Host "  📄 Проверка: $file" -ForegroundColor Cyan
    
    # Проверяем существование файла
    $testResult = ssh "${USER}@${SERVER}" "if test -f ${remotePath}; then echo 'EXISTS'; else echo 'NOT_FOUND'; fi" 2>&1
    
    if ($testResult -match "EXISTS") {
        Write-Host "    ✅ Файл существует" -ForegroundColor Green
        
        # Проверяем размер файла
        $size = ssh "${USER}@${SERVER}" "stat -c%s ${remotePath} 2>/dev/null || stat -f%z ${remotePath} 2>/dev/null || echo '0'"
        $sizeMB = [math]::Round([int]$size / 1MB, 2)
        Write-Host "    📊 Размер: $sizeMB MB" -ForegroundColor Gray
        
        # Проверяем права доступа
        $perms = ssh "${USER}@${SERVER}" "ls -la ${remotePath} | awk '{print \$1, \$3, \$4}'"
        Write-Host "    🔐 Права: $perms" -ForegroundColor Gray
        
    } else {
        Write-Host "    ❌ Файл НЕ НАЙДЕН!" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "📁 Проверка структуры папок:" -ForegroundColor Yellow
Write-Host ""

$folders = @(
    "${REMOTE_PATH}/frontend",
    "${REMOTE_PATH}/frontend/templates",
    "${REMOTE_PATH}/frontend/static",
    "${REMOTE_PATH}/frontend/static/css",
    "${REMOTE_PATH}/frontend/static/videos"
)

foreach ($folder in $folders) {
    $testResult = ssh "${USER}@${SERVER}" "if test -d ${folder}; then echo 'EXISTS'; else echo 'NOT_FOUND'; fi" 2>&1
    if ($testResult -match "EXISTS") {
        Write-Host "  ✅ $folder" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $folder - НЕ НАЙДЕНА!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔐 Проверка прав доступа:" -ForegroundColor Yellow
Write-Host ""

$owner = ssh "${USER}@${SERVER}" "ls -ld ${REMOTE_PATH}/frontend | awk '{print \$3\":\"\$4}'"
Write-Host "  Владелец frontend: $owner" -ForegroundColor Cyan

$videosPerms = ssh "${USER}@${SERVER}" "stat -c '%a' ${REMOTE_PATH}/frontend/static/videos 2>/dev/null || echo 'N/A'"
Write-Host "  Права папки videos: $videosPerms" -ForegroundColor Cyan

Write-Host ""
Write-Host "🔄 Проверка статуса сервиса:" -ForegroundColor Yellow
Write-Host ""

$status = ssh "${USER}@${SERVER}" "systemctl is-active football_school"
if ($status -match "active") {
    Write-Host "  ✅ Сервис активен" -ForegroundColor Green
} else {
    Write-Host "  ❌ Сервис НЕ активен!" -ForegroundColor Red
}

Write-Host ""
Write-Host "📊 Последние логи сервиса:" -ForegroundColor Yellow
Write-Host ""

ssh "${USER}@${SERVER}" "journalctl -u football_school -n 20 --no-pager | tail -n 10"

Write-Host ""
Write-Host "🌐 Проверка доступности через веб-сервер:" -ForegroundColor Yellow
Write-Host ""

# Проверяем доступность файлов через HTTP
$baseUrl = "https://d-promo.uz"

Write-Host "  Проверка CSS файла..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "${baseUrl}/static/css/style.css" -Method Head -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "    ✅ CSS доступен (статус: $($response.StatusCode))" -ForegroundColor Green
    }
} catch {
    Write-Host "    ⚠️  CSS недоступен или ошибка: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Проверка видео файла..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "${baseUrl}/static/videos/Login_video.mp4" -Method Head -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $contentLength = $response.Headers['Content-Length']
        $sizeMB = [math]::Round([int]$contentLength / 1MB, 2)
        Write-Host "    ✅ Видео доступно (статус: $($response.StatusCode), размер: $sizeMB MB)" -ForegroundColor Green
    }
} catch {
    Write-Host "    ⚠️  Видео недоступно или ошибка: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📝 Проверка содержимого login.html:" -ForegroundColor Yellow
Write-Host ""

$loginContent = ssh "${USER}@${SERVER}" "grep -o 'Login_video.mp4' ${REMOTE_PATH}/frontend/templates/login.html | head -1"
if ($loginContent -match "Login_video.mp4") {
    Write-Host "  ✅ Видео упоминается в login.html" -ForegroundColor Green
} else {
    Write-Host "  ❌ Видео НЕ найдено в login.html!" -ForegroundColor Red
}

$titleContent = ssh "${USER}@${SERVER}" "grep -o 'FK QORASUV на GOAL PRO' ${REMOTE_PATH}/frontend/templates/login.html | head -1"
if ($titleContent -match "FK QORASUV на GOAL PRO") {
    Write-Host "  ✅ Новый заголовок найден в login.html" -ForegroundColor Green
} else {
    Write-Host "  ❌ Новый заголовок НЕ найден в login.html!" -ForegroundColor Red
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📋 РЕЗЮМЕ ПРОВЕРКИ" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Если все файлы найдены, но изменения не видны:" -ForegroundColor Yellow
Write-Host "  1. Очистите кеш браузера (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "  2. Попробуйте открыть в режиме инкогнито" -ForegroundColor White
Write-Host "  3. Проверьте консоль браузера (F12) на ошибки" -ForegroundColor White
Write-Host "  4. Убедитесь, что Nginx обслуживает статические файлы" -ForegroundColor White
Write-Host ""
