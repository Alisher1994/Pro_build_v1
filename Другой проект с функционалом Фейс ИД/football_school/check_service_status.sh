#!/bin/bash
# Скрипт для проверки статуса после загрузки мобильных страниц

echo "=== Проверка статуса сервиса ==="
systemctl status football_school --no-pager -l | head -n 20

echo ""
echo "=== Проверка наличия новых файлов ==="
ls -la frontend/templates/mobile_*.html

echo ""
echo "=== Проверка последних логов ==="
journalctl -u football_school -n 20 --no-pager

echo ""
echo "=== Проверка порта 5001 ==="
ss -tlnp | grep 5001

echo ""
echo "=== Тест мобильных страниц ==="
curl -I http://127.0.0.1:5001/mobile-payments 2>&1 | head -n 3
curl -I http://127.0.0.1:5001/mobile-dashboard 2>&1 | head -n 3
curl -I http://127.0.0.1:5001/mobile-add-student 2>&1 | head -n 3

