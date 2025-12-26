#!/bin/bash
# Диагностика ошибки 500 Internal Server Error

echo "🔍 Диагностика ошибки 500..."
echo ""

cd /opt/football_school

echo "1. Статус сервиса:"
systemctl status football_school --no-pager -l | head -n 20
echo ""

echo "2. Последние ошибки из логов (последние 50 строк):"
journalctl -u football_school -n 50 --no-pager | tail -n 50
echo ""

echo "3. Логи ошибок приложения:"
tail -n 100 /var/log/football_school/error.log 2>/dev/null || echo "Файл логов не найден"
echo ""

echo "4. Проверка импорта моделей:"
source venv/bin/activate
python3 -c "
try:
    from backend.models.models import db, User, Student, Payment, Attendance, Expense, Group, Tariff, ClubSettings, RewardType, StudentReward, CashTransfer, Role, RolePermission, CardType, StudentCard, School, SchoolFeature, SuperAdmin
    print('✅ Все модели импортируются успешно')
except ImportError as e:
    print(f'❌ Ошибка импорта: {e}')
except Exception as e:
    print(f'❌ Другая ошибка: {e}')
    import traceback
    traceback.print_exc()
" 2>&1
deactivate
echo ""

echo "5. Проверка импорта приложения:"
source venv/bin/activate
python3 -c "
try:
    from app import app
    print('✅ Приложение импортируется успешно')
    with app.app_context():
        print('✅ Контекст приложения создан')
except Exception as e:
    print(f'❌ Ошибка: {e}')
    import traceback
    traceback.print_exc()
" 2>&1
deactivate
echo ""

echo "6. Проверка размера models.py:"
ls -lh backend/models/models.py
echo ""

echo "7. Проверка синтаксиса:"
source venv/bin/activate
python3 -m py_compile app.py 2>&1
python3 -m py_compile backend/models/models.py 2>&1
deactivate
echo ""

echo "8. Проверка доступности приложения:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:5001/ || echo "Приложение не отвечает"
echo ""

echo "✅ Диагностика завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте вывод выше на наличие ошибок"
echo "2. Если есть ошибки импорта - проверьте models.py"
echo "3. Если есть ошибки в логах - исправьте их"
echo "4. Перезапустите: systemctl restart football_school"


