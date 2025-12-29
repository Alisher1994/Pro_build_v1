#!/bin/bash
# Скрипт для диагностики и исправления ошибки 502 Bad Gateway

echo "🔍 Диагностика ошибки 502 Bad Gateway..."
echo ""

cd /opt/football_school

echo "1. Проверка статуса сервиса..."
systemctl status football_school --no-pager -l | head -n 20
echo ""

echo "2. Проверка последних логов (последние 50 строк)..."
journalctl -u football_school -n 50 --no-pager
echo ""

echo "3. Проверка синтаксиса Python файлов..."
python3 -m py_compile app.py 2>&1
if [ $? -eq 0 ]; then
    echo "✅ app.py - синтаксис правильный"
else
    echo "❌ app.py - ОШИБКА СИНТАКСИСА!"
fi

python3 -m py_compile backend/models/models.py 2>&1
if [ $? -eq 0 ]; then
    echo "✅ backend/models/models.py - синтаксис правильный"
else
    echo "❌ backend/models/models.py - ОШИБКА СИНТАКСИСА!"
fi
echo ""

echo "4. Проверка импортов..."
python3 -c "from backend.models.models import Expense, CashTransfer; print('✅ Импорты работают')" 2>&1
echo ""

echo "5. Проверка колонки school_id в таблице expenses..."
python3 << 'EOF'
from app import app, db
with app.app_context():
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        columns = {col['name'] for col in inspector.get_columns('expenses')}
        if 'school_id' not in columns:
            print("⚠️  Колонка school_id отсутствует в expenses")
            print("   Добавляем колонку...")
            db.session.execute(db.text("ALTER TABLE expenses ADD COLUMN school_id INTEGER"))
            db.session.commit()
            print("✅ Колонка school_id добавлена")
        else:
            print("✅ Колонка school_id уже существует")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
EOF
echo ""

echo "6. Проверка прав доступа..."
ls -la app.py backend/models/models.py | head -n 5
echo ""

echo "7. Попытка перезапуска сервиса..."
systemctl restart football_school
sleep 2
systemctl status football_school --no-pager -l | head -n 15
echo ""

echo "✅ Диагностика завершена!"
echo ""
echo "Если проблема не решена, проверьте логи выше и отправьте их разработчику."


