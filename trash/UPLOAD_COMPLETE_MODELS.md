# 📤 Загрузка ПОЛНОГО файла models.py на сервер

## 🚨 Критическая проблема:

**Файл `models.py` на сервере был неполным (16 КБ вместо ~20.5 КБ)!**

В файле отсутствовали модели:
- School
- SchoolFeature  
- SuperAdmin
- Role
- RolePermission
- CardType
- StudentCard

Также отсутствовали поля:
- User.school_id, User.role_id, User.full_name, User.is_active
- Student.school_id
- Group.school_id
- Tariff.school_id
- ClubSettings.school_id

## ✅ Исправлено:

Все недостающие модели и поля добавлены в `backend/models/models.py`.

## 📋 Файлы для загрузки:

### 3 файла:

1. **`backend/models/models.py`** - ВОССТАНОВЛЕН полный файл со всеми моделями (~20.5 КБ)
2. **`app.py`** - Исправлена логика расчета остатка кассы
3. **`backend/middleware/school_middleware.py`** - Добавлены функции `setup_tenant_context()` и `is_super_admin()`

## 📋 Инструкция по загрузке:

### Вариант 1: Через WinSCP (рекомендуется)

1. **Подключитесь к серверу через WinSCP:**
   - Хост: `45.92.173.37`
   - Порт: `22`
   - Пользователь: `root`
   - Пароль: `12345678`

2. **Загрузите файлы:**
   - Перейдите в `/opt/football_school/`
   - Скопируйте файлы:
     - `backend/models/models.py` → `/opt/football_school/backend/models/models.py`
     - `app.py` → `/opt/football_school/app.py`
     - `backend/middleware/school_middleware.py` → `/opt/football_school/backend/middleware/school_middleware.py`

### Вариант 2: Через PowerShell (SCP команды)

```powershell
# Перейдите в директорию проекта
cd C:\Users\LOQ\Desktop\App\CAM\football_school

# Загрузить обновленные файлы
scp backend/models/models.py root@45.92.173.37:/opt/football_school/backend/models/
scp app.py root@45.92.173.37:/opt/football_school/
scp backend/middleware/school_middleware.py root@45.92.173.37:/opt/football_school/backend/middleware/
```

## 🔄 После загрузки файлов на VPS:

### 1. Подключитесь к серверу по SSH:
```bash
ssh root@45.92.173.37
```

### 2. Перейдите в директорию проекта:
```bash
cd /opt/football_school
```

### 3. Проверьте размер файла (должен быть ~20 КБ):
```bash
ls -lh backend/models/models.py
# Должно показать примерно 20K или больше
```

### 4. Установите правильные права:
```bash
chown -R www-data:www-data backend/models/models.py backend/middleware/school_middleware.py
chown www-data:www-data app.py
chmod 644 backend/models/models.py backend/middleware/school_middleware.py
chmod 644 app.py
```

### 5. Проверьте синтаксис перед перезапуском:
```bash
source venv/bin/activate
python3 -m py_compile app.py
python3 -m py_compile backend/models/models.py
python3 -m py_compile backend/middleware/school_middleware.py
python3 -c "from backend.models.models import School, Role, CardType, SuperAdmin, StudentCard, RolePermission, SchoolFeature; print('✅ Все модели импортируются')"
python3 -c "from backend.middleware.school_middleware import setup_tenant_context, is_super_admin; print('✅ Функции middleware импортируются')"
deactivate
```

Если есть ошибки синтаксиса, исправьте их перед перезапуском!

### 6. Перезапустите сервис:
```bash
systemctl restart football_school
```

### 7. Проверьте статус:
```bash
systemctl status football_school --no-pager -l
```

### 8. Проверьте логи (если есть ошибки):
```bash
journalctl -u football_school -n 100 --no-pager | grep -A 30 "Traceback\|Error\|Exception"
```

## ✅ Проверка работы:

После перезапуска проверьте:

1. **Сайт должен открываться:**
   - `https://d-promo.uz`

2. **Страница кассы:**
   - `https://d-promo.uz/finances` → вкладка "Касса"
   - Остаток должен быть правильным (0 если нет прихода)

## 📝 Что было восстановлено:

### Модели:
1. ✅ **School** - Школы (мультитенантность)
2. ✅ **SchoolFeature** - Флаги функций для школ
3. ✅ **SuperAdmin** - Суперадминистратор системы
4. ✅ **Role** - Роли пользователей
5. ✅ **RolePermission** - Права доступа для ролей
6. ✅ **CardType** - Типы карточек (желтая, красная и т.д.)
7. ✅ **StudentCard** - Выданные карточки ученикам

### Поля:
1. ✅ **User**: school_id, role_id, full_name, is_active
2. ✅ **Student**: school_id
3. ✅ **Group**: school_id
4. ✅ **Tariff**: school_id
5. ✅ **ClubSettings**: school_id
6. ✅ **Expense**: school_id (уже было добавлено ранее)
7. ✅ **CashTransfer**: school_id (уже было добавлено ранее)

## 🚨 Важно:

После загрузки файла models.py приложение должно запуститься, так как все импортируемые модели теперь определены.


