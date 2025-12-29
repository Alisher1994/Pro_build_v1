#!/bin/bash
# Скрипт для загрузки исправленного файла students.html на сервер
# Исправление: openTransferPaymentModal is not defined

SERVER="45.92.173.37"
USER="root"
REMOTE_PATH="/opt/football_school"
LOCAL_FILE="frontend/templates/students.html"
REMOTE_FILE="$REMOTE_PATH/frontend/templates/students.html"

echo "========================================"
echo "Загрузка исправления: Transfer Button Fix"
echo "========================================"
echo ""

# Проверка существования файла
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Ошибка: Файл не найден: $LOCAL_FILE"
    exit 1
fi

echo "📁 Локальный файл: $LOCAL_FILE"
echo "🌐 Удаленный путь: $REMOTE_FILE"
echo ""

# Загрузка файла
echo "📤 Загрузка файла на сервер..."
echo ""

scp "$LOCAL_FILE" "${USER}@${SERVER}:${REMOTE_FILE}"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Файл успешно загружен!"
    echo ""
    echo "🔧 Теперь выполните на сервере:"
    echo "   ssh ${USER}@${SERVER}"
    echo "   systemctl restart football_school"
    echo ""
else
    echo ""
    echo "❌ Ошибка при загрузке файла!"
    echo "Проверьте подключение к серверу и права доступа."
    exit 1
fi

