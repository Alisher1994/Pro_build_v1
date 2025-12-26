# 🔍 Команды для проверки статуса на VPS

## ⚠️ Если вы в `less` pager:
Нажмите **`q`** чтобы выйти

## 🔍 Диагностика:

### 1. Проверка статуса сервиса
```bash
systemctl status football_school --no-pager -l
```

### 2. Последние логи сервиса (50 строк)
```bash
journalctl -u football_school -n 50 --no-pager
```

### 3. Проверка порта 5001
```bash
ss -tlnp | grep 5001
```

### 4. Проверка процессов Gunicorn
```bash
ps aux | grep gunicorn | grep -v grep
```

### 5. Логи приложения
```bash
tail -n 50 /var/log/football_school/error.log
```

### 6. Логи Nginx
```bash
tail -n 50 /var/log/nginx/football_school_error.log
```

## 🔧 Если есть проблемы с правами доступа:

```bash
cd /opt/football_school
chmod +x fix_permissions.sh
./fix_permissions.sh

# Затем перезапустите сервис
systemctl restart football_school
systemctl status football_school --no-pager -l
```

## 🌐 Проверка доступности приложения:

```bash
# С сервера
curl http://127.0.0.1:5001

# Или через nginx
curl http://localhost
```

## 📝 Если сервис не запускается:

1. Проверьте логи:
```bash
journalctl -u football_school -n 100 --no-pager
```

2. Проверьте, что venv активирован и зависимости установлены:
```bash
cd /opt/football_school
source venv/bin/activate
python3 -c "import flask; print('Flask OK')"
python3 -c "import gunicorn; print('Gunicorn OK')"
```

3. Проверьте .env файл:
```bash
cat .env | grep -v SECRET_KEY
```

4. Попробуйте запустить вручную (для отладки):
```bash
cd /opt/football_school
source venv/bin/activate
gunicorn --bind 127.0.0.1:5001 --workers 2 app:app
```

