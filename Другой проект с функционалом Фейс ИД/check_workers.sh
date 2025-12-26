#!/bin/bash
# Проверка работы воркеров Gunicorn

echo "🔍 Проверка работы воркеров..."
echo ""

cd /opt/football_school

echo "1. Статус сервиса:"
systemctl status football_school --no-pager -l | head -n 15
echo ""

echo "2. Проверка процессов Gunicorn:"
ps aux | grep gunicorn | grep -v grep
echo ""

echo "3. Последние логи (последние 100 строк):"
journalctl -u football_school -n 100 --no-pager | tail -n 50
echo ""

echo "4. Проверка доступности приложения:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:5001/ || echo "Приложение не отвечает"
echo ""

echo "5. Проверка с виртуальным окружением:"
source venv/bin/activate
python3 -c "from app import app; print('✅ Импорт успешен')" 2>&1
deactivate
echo ""

echo "6. Проверка логов ошибок:"
tail -n 50 /var/log/football_school/error.log 2>/dev/null || echo "Файл логов не найден"
echo ""

echo "✅ Проверка завершена!"


