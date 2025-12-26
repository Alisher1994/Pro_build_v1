# 📤 Файлы для загрузки на VPS сервер

## 📋 Список измененных/новых файлов:

### Новые файлы:
1. `frontend/static/css/mobile.css` - мобильные стили
2. `frontend/static/js/mobile-menu.js` - логика мобильного меню

### Обновленные файлы:
1. `frontend/static/css/style.css` - добавлен импорт mobile.css
2. `frontend/templates/_sidebar.html` - добавлено мобильное меню
3. `frontend/templates/dashboard.html` - подключены мобильные стили и скрипты
4. `frontend/templates/finances.html` - подключены мобильные стили и скрипты
5. `frontend/templates/students.html` - подключены мобильные стили и скрипты

## 📥 Инструкция по загрузке:

### Вариант 1: Через WinSCP (рекомендуется)

1. Подключитесь к серверу через WinSCP:
   - Хост: `45.92.173.37`
   - Пользователь: `root`
   - Пароль: `12345678`

2. Перейдите в директорию `/opt/football_school`

3. Загрузите файлы:

   **Новые файлы:**
   - `frontend/static/css/mobile.css` → `/opt/football_school/frontend/static/css/mobile.css`
   - `frontend/static/js/mobile-menu.js` → `/opt/football_school/frontend/static/js/mobile-menu.js`

   **Обновленные файлы:**
   - `frontend/static/css/style.css` → `/opt/football_school/frontend/static/css/style.css`
   - `frontend/templates/_sidebar.html` → `/opt/football_school/frontend/templates/_sidebar.html`
   - `frontend/templates/dashboard.html` → `/opt/football_school/frontend/templates/dashboard.html`
   - `frontend/templates/finances.html` → `/opt/football_school/frontend/templates/finances.html`
   - `frontend/templates/students.html` → `/opt/football_school/frontend/templates/students.html`

### Вариант 2: Через SSH (SCP команда)

На локальной машине в PowerShell:

```powershell
# Перейдите в директорию проекта
cd C:\Users\LOQ\Desktop\App\CAM\football_school

# Загрузите новые файлы
scp frontend/static/css/mobile.css root@45.92.173.37:/opt/football_school/frontend/static/css/
scp frontend/static/js/mobile-menu.js root@45.92.173.37:/opt/football_school/frontend/static/js/

# Загрузите обновленные файлы
scp frontend/static/css/style.css root@45.92.173.37:/opt/football_school/frontend/static/css/
scp frontend/templates/_sidebar.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp frontend/templates/dashboard.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp frontend/templates/finances.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp frontend/templates/students.html root@45.92.173.37:/opt/football_school/frontend/templates/
```

## 🔄 После загрузки файлов:

Подключитесь к серверу по SSH и выполните:

```bash
# Перезапустите сервис
systemctl restart football_school

# Проверьте статус
systemctl status football_school --no-pager -l

# Проверьте логи (если есть ошибки)
journalctl -u football_school -n 50 --no-pager
```

## ✅ Проверка после деплоя:

1. Откройте приложение на мобильном устройстве: `https://d-promo.uz`
2. Проверьте работу мобильного меню (кнопка hamburger слева вверху)
3. Проверьте адаптацию страниц:
   - Главная (Dashboard)
   - Финансы
   - Ученики (добавление ученика)

