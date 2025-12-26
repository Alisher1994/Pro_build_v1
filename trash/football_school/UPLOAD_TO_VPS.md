# 📤 Загрузка изменений на VPS сервер

## 🎯 Что нужно загрузить:

### Новые файлы:
1. `frontend/templates/mobile_dashboard.html` - Мобильная главная страница
2. `frontend/templates/mobile_add_student.html` - Мобильная добавление ученика
3. `app.py` - Обновленный с новыми роутами

### Обновленные файлы:
1. `frontend/templates/mobile_payment.html` - Добавлена навигация

## 📋 Инструкция по загрузке:

### Вариант 1: Через WinSCP (рекомендуется)

1. **Подключитесь к серверу через WinSCP:**
   - Хост: `45.92.173.37`
   - Порт: `22`
   - Пользователь: `root`
   - Пароль: `12345678`

2. **Загрузите файлы:**
   - Перейдите в `/opt/football_school/`
   - Скопируйте новые файлы:
     - `frontend/templates/mobile_dashboard.html`
     - `frontend/templates/mobile_add_student.html`
     - Обновите `app.py`
     - Обновите `frontend/templates/mobile_payment.html`

3. **Важно:** Не загружайте папку `venv/` и `database/*.db`

### Вариант 2: Через SSH (SCP команды)

```bash
# На локальной машине (PowerShell)
cd C:\Users\LOQ\Desktop\App\CAM\football_school

# Загрузить новые шаблоны
scp frontend/templates/mobile_dashboard.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp frontend/templates/mobile_add_student.html root@45.92.173.37:/opt/football_school/frontend/templates/

# Загрузить обновленные файлы
scp frontend/templates/mobile_payment.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp app.py root@45.92.173.37:/opt/football_school/
```

### Вариант 3: Создать архив и загрузить

```bash
# На локальной машине (PowerShell)
cd C:\Users\LOQ\Desktop\App\CAM\football_school

# Создать архив (исключая ненужные файлы)
Compress-Archive -Path frontend/templates/mobile_*.html,app.py -DestinationPath mobile_update.zip

# Загрузить через WinSCP и распаковать на сервере
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

### 3. Установите правильные права:
```bash
chown -R www-data:www-data /opt/football_school
chmod -R 775 /opt/football_school/database
chmod -R 775 /opt/football_school/frontend/static/uploads
```

### 4. Перезапустите сервис:
```bash
systemctl restart football_school
```

### 5. Проверьте статус:
```bash
systemctl status football_school --no-pager -l
```

### 6. Проверьте логи (если есть ошибки):
```bash
journalctl -u football_school -n 50 --no-pager
tail -n 50 /var/log/football_school/error.log
```

## ✅ Проверка работы:

После перезапуска проверьте работу мобильных страниц:

1. **Добавление оплаты:**
   - `https://d-promo.uz/mobile-payments`

2. **Главная страница:**
   - `https://d-promo.uz/mobile-dashboard`

3. **Добавление ученика (только для admin):**
   - `https://d-promo.uz/mobile-add-student`

## 📱 Что изменилось:

1. ✅ Добавлена нижняя навигация во всех мобильных страницах
2. ✅ Три основные мобильные страницы доступны через навигацию:
   - 💰 Оплаты
   - 📊 Главная (с вкладками)
   - ➕ Добавление ученика
3. ✅ Остальные окна скрыты - показываются только эти три страницы

## 🚨 Если что-то не работает:

1. **Проверьте права доступа:**
   ```bash
   ls -la /opt/football_school/frontend/templates/mobile_*.html
   ```

2. **Проверьте логи:**
   ```bash
   tail -f /var/log/football_school/error.log
   ```

3. **Перезагрузите Nginx:**
   ```bash
   systemctl reload nginx
   ```

4. **Перезапустите приложение:**
   ```bash
   systemctl restart football_school
   ```

