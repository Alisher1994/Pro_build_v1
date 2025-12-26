# 🔍 Отладка Telegram бота

## ✅ Шаги для исправления:

### 1. Загрузите обновлённые файлы на сервер (через WinSCP):
- `app.py` (добавлено логирование для отладки)
- `telegram_bot_manager.py` (улучшена обработка ошибок)

### 2. На сервере перезапустите сервисы:

```bash
cd /opt/football_school
systemctl restart football_school
systemctl restart telegram_bot

# Проверьте статус
systemctl status football_school
systemctl status telegram_bot
```

### 3. Протестируйте API endpoint с сервера:

```bash
curl -X POST https://d-promo.uz/api/telegram/register \
  -H "Content-Type: application/json" \
  -d '{"telegram_chat_id":123,"code":"A001","school_id":2}'
```

Ожидаемый ответ: `{"success":false,"message":"..."}` с информацией об ошибке.

### 4. Проверьте логи Flask приложения (в реальном времени):

```bash
# Откройте в отдельном терминале и оставьте открытым
journalctl -u football_school -f

# Теперь отправьте код боту и смотрите логи
```

### 5. Проверьте, что код ученика существует в базе:

```bash
cd /opt/football_school
source venv/bin/activate
python3 -c "
from app import app, db
from backend.models.models import Student
with app.app_context():
    student = Student.query.filter_by(telegram_link_code='A001', school_id=2).first()
    if student:
        print(f'✅ Ученик найден: {student.full_name}, ID: {student.id}')
    else:
        print('❌ Ученик с кодом A001 не найден в школе ID 2')
        students = Student.query.filter(Student.telegram_link_code.isnot(None)).all()
        print(f'Всего учеников с кодами: {len(students)}')
        for s in students[:10]:
            print(f'  - {s.full_name}: код={s.telegram_link_code}, school_id={s.school_id}')
"
```

### 6. Протестируйте бота в Telegram:

1. Откройте бота школы A2 в Telegram
2. Отправьте `/start` - должно быть приветствие
3. Отправьте код `A001` (или другой существующий код)
4. Смотрите логи в терминале из шага 4

### 2. Проверьте логи бота (вывод процесса):

```bash
# Найти PID процесса бота
ps aux | grep telegram_bot_school_2

# Проверить вывод процесса (если возможно)
# Логи бота должны быть в stdout процесса
```

### 3. Проверьте доступность API с сервера:

```bash
# Тест API endpoint
curl -X POST https://d-promo.uz/api/telegram/register \
  -H "Content-Type: application/json" \
  -d '{"telegram_chat_id":123,"code":"A001","school_id":2}'
```

### 4. Проверьте временный файл бота:

```bash
# Просмотр скрипта бота
cat /tmp/telegram_bot_school_2.py | head -n 50
```

### 5. Проверьте, что код ученика существует:

```bash
cd /opt/football_school
source venv/bin/activate
python3 -c "
from app import app, db
from backend.models.models import Student
with app.app_context():
    student = Student.query.filter_by(telegram_link_code='A001', school_id=2).first()
    if student:
        print(f'✅ Ученик найден: {student.full_name}, ID: {student.id}')
    else:
        print('❌ Ученик с кодом A001 не найден в школе ID 2')
        # Проверим всех учеников с кодами
        students = Student.query.filter(Student.telegram_link_code.isnot(None)).all()
        print(f'Всего учеников с кодами: {len(students)}')
        for s in students[:5]:
            print(f'  - {s.full_name}: код={s.telegram_link_code}, school_id={s.school_id}')
"
```

