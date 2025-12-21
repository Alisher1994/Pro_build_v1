# Скрипт для резервного копирования базы данных
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$source = ".\prisma\prisma\dev.db"
$backup = ".\prisma\backups\dev_backup_$timestamp.db"

# Создаем папку для бэкапов
New-Item -ItemType Directory -Force -Path ".\prisma\backups" | Out-Null

# Копируем базу данных
if (Test-Path $source) {
    Copy-Item $source $backup
    Write-Host "✅ Бэкап создан: $backup" -ForegroundColor Green
} else {
    Write-Host "❌ Файл базы данных не найден!" -ForegroundColor Red
}
