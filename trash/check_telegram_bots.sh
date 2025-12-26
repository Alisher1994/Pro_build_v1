#!/bin/bash
# Скрипт для проверки Telegram ботов

echo "=== Статус сервиса ==="
systemctl status telegram_bot --no-pager -l | head -n 15

echo ""
echo "=== Последние логи (50 строк) ==="
journalctl -u telegram_bot -n 50 --no-pager

echo ""
echo "=== Проверка процессов ботов ==="
ps aux | grep telegram_bot | grep -v grep

echo ""
echo "=== Проверка временных файлов ботов ==="
ls -la /tmp/telegram_bot_school_*.py 2>/dev/null || echo "Временные файлы не найдены"

