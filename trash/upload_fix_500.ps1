# Скрипт для загрузки исправленных файлов на сервер
# Исправление ошибки 500 Internal Server Error

$server = "root@45.92.173.37"
$remotePath = "/opt/football_school"

Write-Host "📤 Загрузка исправленных файлов на сервер..." -ForegroundColor Cyan
Write-Host ""

# Файлы для загрузки
$files = @(
    @{
        Local = "backend\models\models.py"
        Remote = "$remotePath/backend/models/models.py"
    },
    @{
        Local = "app.py"
        Remote = "$remotePath/app.py"
    },
    @{
        Local = "backend\middleware\school_middleware.py"
        Remote = "$remotePath/backend/middleware/school_middleware.py"
    }
)

foreach ($file in $files) {
    $localPath = Join-Path $PSScriptRoot $file.Local
    
    if (Test-Path $localPath) {
        Write-Host "📤 Загрузка: $($file.Local)" -ForegroundColor Yellow
        scp $localPath "${server}:$($file.Remote)"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Успешно загружено: $($file.Local)" -ForegroundColor Green
        } else {
            Write-Host "❌ Ошибка загрузки: $($file.Local)" -ForegroundColor Red
        }
        Write-Host ""
    } else {
        Write-Host "⚠️  Файл не найден: $localPath" -ForegroundColor Yellow
    }
}

Write-Host "✅ Загрузка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Следующие шаги на сервере:" -ForegroundColor Cyan
Write-Host "1. Подключитесь: ssh $server" -ForegroundColor White
Write-Host "2. Выполните команды из файла UPLOAD_COMPLETE_MODELS.md" -ForegroundColor White


