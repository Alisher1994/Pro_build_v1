# 🔍 Проверка загрузки файлов на сервер

## 🚀 Быстрая проверка (автоматическая)

Запустите скрипт проверки:
```powershell
cd C:\Users\LOQ\Desktop\App\CAM\football_school
.\check_upload.ps1
```

## 📋 Ручная проверка через SSH

### 1. Подключитесь к серверу:
```bash
ssh root@45.92.173.37
```

### 2. Проверьте существование файлов:
```bash
# Проверка login.html
ls -lh /opt/football_school/frontend/templates/login.html

# Проверка style.css
ls -lh /opt/football_school/frontend/static/css/style.css

# Проверка видео
ls -lh /opt/football_school/frontend/static/videos/Login_video.mp4
```

### 3. Проверьте содержимое файлов:
```bash
# Проверка, что в login.html есть упоминание видео
grep "Login_video.mp4" /opt/football_school/frontend/templates/login.html

# Проверка, что в login.html есть новый заголовок
grep "FK QORASUV на GOAL PRO" /opt/football_school/frontend/templates/login.html

# Проверка, что в style.css есть стили для видео
grep "login-background-video" /opt/football_school/frontend/static/css/style.css
```

### 4. Проверьте права доступа:
```bash
# Проверка владельца
ls -la /opt/football_school/frontend/templates/login.html
ls -la /opt/football_school/frontend/static/videos/Login_video.mp4

# Должно быть: www-data:www-data
```

### 5. Проверьте статус сервиса:
```bash
# Статус сервиса
systemctl status football_school --no-pager -l

# Последние логи
journalctl -u football_school -n 50 --no-pager | tail -n 20
```

### 6. Проверьте доступность через веб:
```bash
# Проверка доступности CSS
curl -I https://d-promo.uz/static/css/style.css

# Проверка доступности видео
curl -I https://d-promo.uz/static/videos/Login_video.mp4

# Проверка страницы входа
curl -I https://d-promo.uz/login
```

## 🔧 Если файлы не найдены - загрузите заново:

### Вариант 1: Через WinSCP
1. Откройте WinSCP
2. Подключитесь к `45.92.173.37` (root/12345678)
3. Перейдите в `/opt/football_school/`
4. Загрузите файлы:
   - `frontend/templates/login.html`
   - `frontend/static/css/style.css`
   - `frontend/static/videos/Login_video.mp4`

### Вариант 2: Через PowerShell
```powershell
cd C:\Users\LOQ\Desktop\App\CAM\football_school

# Загрузить файлы
scp frontend/templates/login.html root@45.92.173.37:/opt/football_school/frontend/templates/
scp frontend/static/css/style.css root@45.92.173.37:/opt/football_school/frontend/static/css/

# Создать папку videos (если нет)
ssh root@45.92.173.37 "mkdir -p /opt/football_school/frontend/static/videos"

# Загрузить видео
scp frontend/static/videos/Login_video.mp4 root@45.92.173.37:/opt/football_school/frontend/static/videos/
```

## 🔐 После загрузки - установите права и перезапустите:

```bash
ssh root@45.92.173.37

# Установить права
chown -R www-data:www-data /opt/football_school/frontend
chmod -R 755 /opt/football_school/frontend/static/videos

# Перезапустить сервис
systemctl restart football_school

# Проверить статус
systemctl status football_school --no-pager -l
```

## 🌐 Проверка в браузере:

1. **Откройте страницу входа:**
   - `https://d-promo.uz/login`

2. **Очистите кеш браузера:**
   - Нажмите `Ctrl + Shift + Delete`
   - Выберите "Кешированные изображения и файлы"
   - Или откройте в режиме инкогнито (`Ctrl + Shift + N`)

3. **Откройте консоль разработчика (F12):**
   - Перейдите на вкладку "Console"
   - Проверьте наличие ошибок
   - Перейдите на вкладку "Network"
   - Обновите страницу (F5)
   - Проверьте, загружаются ли файлы:
     - `style.css` (статус 200)
     - `Login_video.mp4` (статус 200)

## 🚨 Частые проблемы:

### Проблема 1: Файлы не загружаются через браузер
**Решение:**
```bash
# Проверьте конфигурацию Nginx
ssh root@45.92.173.37
nginx -t
systemctl reload nginx
```

### Проблема 2: Видео не воспроизводится
**Решение:**
```bash
# Проверьте MIME типы в Nginx
ssh root@45.92.173.37
grep -i "video" /etc/nginx/nginx.conf

# Если нет, добавьте в конфиг:
# location ~* \.(mp4|webm|ogg)$ {
#     add_header Content-Type video/mp4;
# }
```

### Проблема 3: CSS не применяется
**Решение:**
- Очистите кеш браузера
- Проверьте, что файл загружен правильно
- Проверьте консоль браузера на ошибки 404

### Проблема 4: Сервис не перезапускается
**Решение:**
```bash
ssh root@45.92.173.37
journalctl -u football_school -n 100 --no-pager
# Найдите ошибки и исправьте их
```

## ✅ Чек-лист проверки:

- [ ] Файл `login.html` существует на сервере
- [ ] Файл `style.css` существует на сервере
- [ ] Файл `Login_video.mp4` существует на сервере
- [ ] В `login.html` есть упоминание `Login_video.mp4`
- [ ] В `login.html` есть текст "FK QORASUV на GOAL PRO"
- [ ] В `style.css` есть стили `.login-background-video`
- [ ] Права доступа установлены (www-data:www-data)
- [ ] Сервис `football_school` активен
- [ ] Файлы доступны через веб (статус 200)
- [ ] Кеш браузера очищен
