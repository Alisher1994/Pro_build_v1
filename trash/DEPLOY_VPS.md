# 🚀 Деплой на VPS сервер

## 📋 Требования

- VPS сервер с Ubuntu/Debian
- Доступ по SSH (root)
- IP: 45.92.173.37
- Домен: vps6377.eskiz.uz (опционально)

## 🔐 Данные доступа

```
IP: 45.92.173.37
Порт SSH: 22
Логин: root
Пароль: GAbZDK&JgQ8$hpmk
```

## 📦 Шаг 1: Подготовка проекта

### На локальной машине:

1. **Убедитесь, что проект готов к деплою:**
   ```bash
   # Проверьте, что все файлы сохранены
   git status
   ```

2. **Создайте архив проекта (исключая ненужные файлы):**
   ```bash
   # Создайте .gitignore если его нет
   # Исключите: venv/, __pycache__, *.db, *.pyc
   ```

## 🌐 Шаг 2: Подключение к VPS

### Вариант A: Через SSH (рекомендуется)

```bash
ssh root@45.92.173.37
# Пароль: GAbZDK&JgQ8$hpmk
```

### Вариант B: Через WinSCP/PuTTY (Windows)

1. Откройте WinSCP
2. Хост: `45.92.173.37`
3. Порт: `22`
4. Пользователь: `root`
5. Пароль: `GAbZDK&JgQ8$hpmk`

## 📥 Шаг 3: Загрузка проекта на сервер

### Вариант A: Через Git (если проект на GitHub)

```bash
# На сервере
cd /opt
git clone https://github.com/ваш-репозиторий/football_school.git
cd football_school
```

### Вариант B: Через SCP (с локальной машины)

```bash
# На локальной машине (Windows PowerShell)
scp -r C:\Users\LOQ\Desktop\App\CAM\football_school root@45.92.173.37:/opt/
```

### Вариант C: Через WinSCP

1. Подключитесь к серверу через WinSCP
2. Перетащите папку `football_school` в `/opt/`

## 🔧 Шаг 4: Установка зависимостей

```bash
# Подключитесь к серверу
ssh root@45.92.173.37

# Перейдите в директорию проекта
cd /opt/football_school

# Обновите систему
apt-get update
apt-get upgrade -y

# Установите системные зависимости
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    nginx \
    supervisor \
    git \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libopencv-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libopenblas-dev \
    liblapack-dev \
    gfortran \
    pkg-config \
    cmake

# Создайте виртуальное окружение
python3 -m venv venv
source venv/bin/activate

# Обновите pip
pip install --upgrade pip

# Установите dlib (может занять много времени)
pip install https://github.com/z-mahmud22/prebuilt-dlib/releases/download/v19.24.0/dlib-19.24.0-cp311-cp311-manylinux_2_17_x86_64.whl || \
pip install dlib==19.24.2

# Установите остальные зависимости
pip install -r requirements.txt
```

## 🔐 Шаг 5: Настройка переменных окружения

```bash
cd /opt/football_school

# Создайте файл .env
nano .env
```

Добавьте в файл:

```env
SECRET_KEY=ваш-секретный-ключ-сгенерируйте-новый
FLASK_ENV=production
FLASK_APP=app.py
PYTHONUNBUFFERED=1

# Если используете PostgreSQL (рекомендуется для production)
# DATABASE_URL=postgresql://user:password@localhost/football_school
```

**Сгенерируйте SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## 🗄️ Шаг 6: Настройка базы данных

### Вариант A: SQLite (проще, но не рекомендуется для production)

```bash
cd /opt/football_school
source venv/bin/activate

# Создайте директорию для БД
mkdir -p database

# Инициализируйте базу данных
python init_db.py
```

### Вариант B: PostgreSQL (рекомендуется)

```bash
# Установите PostgreSQL
apt-get install -y postgresql postgresql-contrib

# Создайте базу данных и пользователя
sudo -u postgres psql << EOF
CREATE DATABASE football_school;
CREATE USER football_user WITH PASSWORD 'ваш-надежный-пароль';
ALTER ROLE football_user SET client_encoding TO 'utf8';
ALTER ROLE football_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE football_user SET timezone TO 'Asia/Tashkent';
GRANT ALL PRIVILEGES ON DATABASE football_school TO football_user;
\q
EOF

# Обновите .env файл
echo "DATABASE_URL=postgresql://football_user:ваш-надежный-пароль@localhost/football_school" >> .env

# Инициализируйте базу данных
source venv/bin/activate
python init_db.py
```

## ⚙️ Шаг 7: Настройка Systemd Service

```bash
# Создайте директорию для логов
mkdir -p /var/log/football_school

# Скопируйте service файл
cp football_school.service /etc/systemd/system/

# Отредактируйте service файл (установите правильный SECRET_KEY)
nano /etc/systemd/system/football_school.service

# Перезагрузите systemd
systemctl daemon-reload

# Включите автозапуск
systemctl enable football_school

# Запустите сервис
systemctl start football_school

# Проверьте статус
systemctl status football_school
```

## 🌐 Шаг 8: Настройка Nginx

```bash
# Скопируйте конфигурацию nginx
cp nginx.conf /etc/nginx/sites-available/football_school

# Создайте символическую ссылку
ln -s /etc/nginx/sites-available/football_school /etc/nginx/sites-enabled/

# Удалите дефолтную конфигурацию (если есть)
rm -f /etc/nginx/sites-enabled/default

# Проверьте конфигурацию nginx
nginx -t

# Перезапустите nginx
systemctl restart nginx

# Включите автозапуск nginx
systemctl enable nginx
```

## 🔥 Шаг 9: Настройка Firewall

```bash
# Установите ufw (если не установлен)
apt-get install -y ufw

# Разрешите SSH
ufw allow 22/tcp

# Разрешите HTTP
ufw allow 80/tcp

# Разрешите HTTPS (если будете использовать SSL)
ufw allow 443/tcp

# Включите firewall
ufw enable

# Проверьте статус
ufw status
```

## ✅ Шаг 10: Проверка работы

1. **Проверьте, что приложение запущено:**
   ```bash
   systemctl status football_school
   curl http://localhost:5001
   ```

2. **Проверьте логи:**
   ```bash
   # Логи приложения
   tail -f /var/log/football_school/error.log
   
   # Логи nginx
   tail -f /var/log/nginx/football_school_error.log
   ```

3. **Откройте в браузере:**
   ```
   http://45.92.173.37
   ```

## 🔄 Шаг 11: Обновление приложения

При обновлении кода:

```bash
# На сервере
cd /opt/football_school

# Если используете Git
git pull

# Или загрузите новые файлы через SCP/WinSCP

# Активируйте виртуальное окружение
source venv/bin/activate

# Обновите зависимости (если requirements.txt изменился)
pip install -r requirements.txt

# Перезапустите приложение
systemctl restart football_school

# Проверьте статус
systemctl status football_school
```

## 🔒 Шаг 12: Настройка SSL (HTTPS) - опционально

Для работы камеры в браузере рекомендуется использовать HTTPS:

```bash
# Установите Certbot
apt-get install -y certbot python3-certbot-nginx

# Получите SSL сертификат
certbot --nginx -d vps6377.eskiz.uz

# Автоматическое обновление сертификата
certbot renew --dry-run
```

## 🐛 Troubleshooting

### Приложение не запускается

```bash
# Проверьте логи
journalctl -u football_school -n 50

# Проверьте, что порт 5001 свободен
netstat -tulpn | grep 5001
```

### Nginx не работает

```bash
# Проверьте конфигурацию
nginx -t

# Проверьте логи
tail -f /var/log/nginx/error.log
```

### База данных не работает

```bash
# Проверьте подключение к PostgreSQL
sudo -u postgres psql -d football_school

# Проверьте SQLite файл
ls -lh /opt/football_school/database/
```

## 📝 Полезные команды

```bash
# Перезапуск приложения
systemctl restart football_school

# Остановка приложения
systemctl stop football_school

# Просмотр логов в реальном времени
journalctl -u football_school -f

# Проверка использования ресурсов
htop
df -h
```

## 🎯 Готово!

Ваше приложение должно быть доступно по адресу:
- **HTTP**: http://45.92.173.37
- **С доменом**: http://vps6377.eskiz.uz

**Первый вход:**
- Логин: `admin`
- Пароль: `admin123`

