# 🔍 Получение детальных логов ошибки

## Проблема:
Воркеры Gunicorn не могут загрузиться (`Worker failed to boot`). Нужны детальные логи.

## Шаги для диагностики:

### 1. Подключитесь к серверу:
```bash
ssh root@45.92.173.37
cd /opt/football_school
```

### 2. Проверьте логи воркеров (самое важное!):
```bash
journalctl -u football_school -n 200 --no-pager | grep -A 20 -B 5 "Error\|Traceback\|Exception\|Failed"
```

### 3. Или попробуйте запустить приложение вручную:
```bash
cd /opt/football_school
source venv/bin/activate  # если используется venv
python3 -c "from app import app; print('OK')"
```

### 4. Если есть ошибка импорта, проверьте детально:
```bash
python3 << 'EOF'
import sys
try:
    print("1. Импортируем db...")
    from backend.models.models import db
    print("   ✅ OK")
    
    print("2. Импортируем Expense...")
    from backend.models.models import Expense
    print("   ✅ OK")
    
    print("3. Импортируем CashTransfer...")
    from backend.models.models import CashTransfer
    print("   ✅ OK")
    
    print("4. Импортируем app...")
    from app import app
    print("   ✅ OK")
    
    print("5. Создаем контекст...")
    with app.app_context():
        print("   ✅ OK")
        
except Exception as e:
    print(f"❌ ОШИБКА: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
EOF
```

### 5. Проверьте файл сервиса:
```bash
cat /etc/systemd/system/football_school.service
```

### 6. Проверьте, что файлы загружены правильно:
```bash
ls -la /opt/football_school/app.py
ls -la /opt/football_school/backend/models/models.py

# Проверьте размеры файлов (не должны быть 0)
wc -l /opt/football_school/app.py
wc -l /opt/football_school/backend/models/models.py
```

## 🔧 Быстрое исправление (если проблема в колонке school_id):

```bash
cd /opt/football_school
python3 << 'EOF'
from app import app, db
with app.app_context():
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        
        # Проверяем expenses
        columns = {col['name'] for col in inspector.get_columns('expenses')}
        if 'school_id' not in columns:
            print("Добавляем school_id в expenses...")
            db.session.execute(db.text("ALTER TABLE expenses ADD COLUMN school_id INTEGER"))
            db.session.commit()
            print("✅ OK")
        
        # Проверяем cash_transfers
        columns = {col['name'] for col in inspector.get_columns('cash_transfers')}
        if 'school_id' not in columns:
            print("Добавляем school_id в cash_transfers...")
            db.session.execute(db.text("ALTER TABLE cash_transfers ADD COLUMN school_id INTEGER"))
            db.session.commit()
            print("✅ OK")
    except Exception as e:
        print(f"Ошибка: {e}")
        import traceback
        traceback.print_exc()
EOF
```

## 📋 Что нужно отправить мне:

Выполните команду и отправьте мне вывод:
```bash
journalctl -u football_school -n 200 --no-pager | grep -A 30 "Traceback\|Error\|Exception"
```

Это покажет точную ошибку, из-за которой воркеры не могут загрузиться.


