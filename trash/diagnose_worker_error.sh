#!/bin/bash
# Скрипт для диагностики ошибки загрузки воркеров

echo "🔍 Диагностика ошибки загрузки воркеров..."
echo ""

cd /opt/football_school

echo "1. Проверка синтаксиса app.py..."
python3 -m py_compile app.py 2>&1
if [ $? -ne 0 ]; then
    echo "❌ ОШИБКА СИНТАКСИСА В app.py!"
    exit 1
fi
echo "✅ app.py - OK"
echo ""

echo "2. Проверка синтаксиса models.py..."
python3 -m py_compile backend/models/models.py 2>&1
if [ $? -ne 0 ]; then
    echo "❌ ОШИБКА СИНТАКСИСА В models.py!"
    exit 1
fi
echo "✅ models.py - OK"
echo ""

echo "3. Попытка импорта приложения..."
python3 << 'EOF'
import sys
try:
    print("Импортируем app...")
    from app import app
    print("✅ Импорт app успешен")
    
    print("Создаем контекст приложения...")
    with app.app_context():
        print("✅ Контекст создан")
        
        print("Проверяем импорт моделей...")
        from backend.models.models import Expense, CashTransfer
        print("✅ Модели импортированы")
        
        print("Проверяем подключение к БД...")
        from app import db
        db.session.execute(db.text("SELECT 1"))
        print("✅ БД доступна")
        
except Exception as e:
    print(f"❌ ОШИБКА: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
EOF

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Ошибка при импорте приложения!"
    exit 1
fi

echo ""
echo "4. Проверка колонки school_id в expenses..."
python3 << 'EOF'
from app import app, db
with app.app_context():
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        columns = {col['name'] for col in inspector.get_columns('expenses')}
        if 'school_id' not in columns:
            print("⚠️  Добавляем school_id...")
            db.session.execute(db.text("ALTER TABLE expenses ADD COLUMN school_id INTEGER"))
            db.session.commit()
            print("✅ Колонка добавлена")
        else:
            print("✅ Колонка school_id уже есть")
    except Exception as e:
        print(f"⚠️  Ошибка при проверке колонки: {e}")
EOF

echo ""
echo "5. Проверка колонки school_id в cash_transfers..."
python3 << 'EOF'
from app import app, db
with app.app_context():
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        columns = {col['name'] for col in inspector.get_columns('cash_transfers')}
        if 'school_id' not in columns:
            print("⚠️  Добавляем school_id...")
            db.session.execute(db.text("ALTER TABLE cash_transfers ADD COLUMN school_id INTEGER"))
            db.session.commit()
            print("✅ Колонка добавлена")
        else:
            print("✅ Колонка school_id уже есть")
    except Exception as e:
        print(f"⚠️  Ошибка при проверке колонки: {e}")
EOF

echo ""
echo "✅ Диагностика завершена!"


