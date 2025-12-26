# 📤 Загрузка изменений страницы входа на сервер

## 🎯 Измененные файлы:

1. `frontend/templates/login.html` - Добавлено фоновое видео и обновлен заголовок
2. `frontend/static/css/style.css` - Добавлены стили для видео и заголовка
3. `frontend/static/videos/Login_video.mp4` - Новый видео файл (если еще не загружен)

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
     - `frontend/templates/login.html` → `/opt/football_school/frontend/templates/login.html`
     - `frontend/static/css/style.css` → `/opt/football_school/frontend/static/css/style.css`
     - `frontend/static/videos/Login_video.mp4` → `/opt/football_school/frontend/static/videos/Login_video.mp4`
       (если папки `videos` нет, создайте её)

### Вариант 2: Через PowerShell (SCP команды)

```powershell
# Перейдите в директорию проекта
cd C:\Users\LOQ\Desktop\App\CAM\football_school

# Загрузить обновленные файлы
scp frontend/templates/login.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp frontend/static/css/style.css root@45.92.173.37:/opt/football_school/frontend/static/css/

# Создать папку videos на сервере (если её нет)
ssh root@45.92.173.37 "mkdir -p /opt/football_school/frontend/static/videos"

# Загрузить видео файл
scp frontend/static/videos/Login_video.mp4 root@45.92.173.37:/opt/football_school/frontend/static/videos/
```

## 🔄 После загрузки файлов на VPS:

### 1. Подключитесь к серверу по SSH:
```bash
ssh root@45.92.173.37
```

### 2. Установите правильные права:
```bash
chown -R www-data:www-data /opt/football_school/frontend
chmod -R 755 /opt/football_school/frontend/static/videos
```

### 3. Перезапустите сервис:
```bash
systemctl restart football_school
```

### 4. Проверьте статус:
```bash
systemctl status football_school --no-pager -l
```

### 5. Проверьте логи (если есть ошибки):
```bash
journalctl -u football_school -n 50 --no-pager
```

## ✅ Проверка работы:

После перезапуска проверьте страницу входа:
- `https://d-promo.uz/login`

**Ожидаемый результат:**
- ✅ Фоновое видео воспроизводится автоматически
- ✅ Заголовок "GOAL PRO" отображается жирным курсивом
- ✅ Форма входа видна поверх видео

## 🚨 Если что-то не работает:

1. **Проверьте права доступа:**
   ```bash
   ls -la /opt/football_school/frontend/templates/login.html
   ls -la /opt/football_school/frontend/static/videos/Login_video.mp4
   ```

2. **Проверьте, что видео файл существует:**
   ```bash
   file /opt/football_school/frontend/static/videos/Login_video.mp4
   ```

3. **Проверьте логи:**
   ```bash
   tail -f /var/log/football_school/error.log
   ```

4. **Перезагрузите Nginx:**
   ```bash
   systemctl reload nginx
   ```

5. **Перезапустите приложение:**
   ```bash
   systemctl restart football_school
   ```


