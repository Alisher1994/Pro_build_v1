#!/bin/bash
# Скрипт для исправления прав доступа для www-data

echo "=== Установка прав доступа ==="

# Создаём директорию для логов если её нет
mkdir -p /var/log/football_school
chown -R www-data:www-data /var/log/football_school

# Устанавливаем владельца для проекта (www-data должен иметь доступ на чтение)
chown -R www-data:www-data /opt/football_school

# Особые права для базы данных и загрузок (запись)
chmod -R 775 /opt/football_school/database
chmod -R 775 /opt/football_school/frontend/static/uploads

# Права для логов приложения
chmod -R 755 /var/log/football_school

echo "✅ Права доступа установлены"

echo ""
echo "=== Проверка владельцев ==="
ls -la /opt/football_school | head -n 5
ls -la /opt/football_school/database
ls -la /var/log/football_school

