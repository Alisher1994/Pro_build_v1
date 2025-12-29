#!/bin/bash
# Скрипт для проверки работы приложения

echo "=== 1. Проверка статуса сервиса ==="
systemctl status football_school --no-pager -l | head -n 15

echo ""
echo "=== 2. Проверка порта 5001 ==="
ss -tlnp | grep 5001

echo ""
echo "=== 3. Проверка процессов Gunicorn ==="
ps aux | grep gunicorn | grep -v grep

echo ""
echo "=== 4. Тест HTTP запроса ==="
curl -I http://127.0.0.1:5001 2>&1 | head -n 5

echo ""
echo "=== 5. Проверка последних логов ==="
tail -n 10 /var/log/football_school/error.log 2>/dev/null || echo "Лог файл пуст или не создан"

echo ""
echo "=== 6. Проверка Nginx ==="
systemctl status nginx --no-pager -l | head -n 10

echo ""
echo "=== 7. Тест через Nginx ==="
curl -I http://localhost 2>&1 | head -n 5

