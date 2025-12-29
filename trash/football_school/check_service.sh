#!/bin/bash
# Скрипт для проверки статуса сервиса

echo "=== Проверка статуса сервиса ==="
systemctl status football_school --no-pager -l

echo ""
echo "=== Последние 50 строк логов сервиса ==="
journalctl -u football_school -n 50 --no-pager

echo ""
echo "=== Проверка порта 5001 ==="
netstat -tlnp | grep 5001 || ss -tlnp | grep 5001

echo ""
echo "=== Проверка процессов Gunicorn ==="
ps aux | grep gunicorn | grep -v grep

echo ""
echo "=== Последние 20 строк error.log ==="
tail -n 20 /var/log/football_school/error.log 2>/dev/null || echo "Файл логов не найден"

echo ""
echo "=== Проверка Nginx статуса ==="
systemctl status nginx --no-pager -l | head -n 20

echo ""
echo "=== Последние 20 строк nginx error.log ==="
tail -n 20 /var/log/nginx/football_school_error.log 2>/dev/null || echo "Nginx error log не найден"

