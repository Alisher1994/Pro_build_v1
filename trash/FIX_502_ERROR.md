# 🔧 Исправление ошибки 502 Bad Gateway

## 🚨 Проблема:

После загрузки изменений появилась ошибка **502 Bad Gateway**. Это означает, что приложение не запускается.

## 🔍 Диагностика:

### 1. Подключитесь к серверу по SSH:
```bash
ssh root@45.92.173.37
```

### 2. Проверьте статус сервиса:
```bash
systemctl status football_school --no-pager -l
```

### 3. Проверьте логи на наличие ошибок:
```bash
journalctl -u football_school -n 100 --no-pager
```

### 4. Проверьте синтаксис Python файлов:
```bash
cd /opt/football_school
python3 -m py_compile app.py
python3 -m py_compile backend/models/models.py
```

### 5. Проверьте импорты:
```bash
cd /opt/football_school
python3 -c "from backend.models.models import Expense, CashTransfer; print('OK')"
```

## 🔧 Возможные причины и решения:

### Причина 1: Синтаксическая ошибка в коде

**Решение:**
```bash
# Проверьте логи
journalctl -u football_school -n 100 --no-pager | grep -i error

# Если есть ошибка импорта или синтаксиса, исправьте файл
```

### Причина 2: Проблема с базой данных (отсутствует колонка school_id)

**Решение:**
```bash
cd /opt/football_school
python3 -c "
from app import app, db
with app.app_context():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    columns = {col['name'] for col in inspector.get_columns('expenses')}
    if 'school_id' not in columns:
        print('Добавляем school_id в expenses...')
        db.session.execute(db.text('ALTER TABLE expenses ADD COLUMN school_id INTEGER'))
        db.session.commit()
        print('OK')
    else:
        print('school_id уже есть в expenses')
"
```

### Причина 3: Проблема с правами доступа

**Решение:**
```bash
chown -R www-data:www-data /opt/football_school
chmod 644 /opt/football_school/app.py
chmod 644 /opt/football_school/backend/models/models.py
```

### Причина 4: Приложение не может подключиться к БД

**Решение:**
```bash
# Проверьте конфигурацию БД в app.py
# Убедитесь, что путь к БД правильный
ls -la /opt/football_school/database/
```

## 🚀 Быстрое исправление:

### Вариант 1: Перезапуск сервиса
```bash
systemctl restart football_school
systemctl status football_school --no-pager -l
```

### Вариант 2: Проверка и исправление вручную
```bash
cd /opt/football_school

# 1. Проверьте синтаксис
python3 -m py_compile app.py
python3 -m py_compile backend/models/models.py

# 2. Если ошибок нет, перезапустите
systemctl restart football_school

# 3. Проверьте статус
systemctl status football_school --no-pager -l

# 4. Если все еще не работает, проверьте логи
journalctl -u football_school -f
```

## 📋 Пошаговая инструкция:

1. **Подключитесь по SSH:**
   ```bash
   ssh root@45.92.173.37
   ```

2. **Перейдите в директорию проекта:**
   ```bash
   cd /opt/football_school
   ```

3. **Проверьте логи:**
   ```bash
   journalctl -u football_school -n 50 --no-pager
   ```

4. **Скопируйте последние строки логов** и отправьте мне, чтобы я мог точно определить проблему.

5. **Попробуйте запустить приложение вручную для диагностики:**
   ```bash
   cd /opt/football_school
   source venv/bin/activate  # если используется venv
   python3 app.py
   ```
   
   Это покажет ошибку напрямую в консоли.

## 🔍 Частые ошибки:

1. **ImportError: cannot import name 'Expense'**
   - Проверьте, что файл `backend/models/models.py` загружен правильно
   - Убедитесь, что в модели Expense есть поле school_id

2. **OperationalError: no such column: expenses.school_id**
   - Запустите функцию ensure_expenses_table() вручную
   - Или выполните SQL: `ALTER TABLE expenses ADD COLUMN school_id INTEGER`

3. **SyntaxError в models.py**
   - Проверьте синтаксис файла: `python3 -m py_compile backend/models/models.py`

## ✅ После исправления:

1. Перезапустите сервис:
   ```bash
   systemctl restart football_school
   ```

2. Проверьте статус:
   ```bash
   systemctl status football_school --no-pager -l
   ```

3. Проверьте сайт:
   - Откройте `https://d-promo.uz` в браузере


