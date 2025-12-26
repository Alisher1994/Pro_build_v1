#!/bin/bash
# Автоматическая установка и настройка на VPS

set -e

APP_NAME="football_school"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="$APP_NAME"

echo "🚀 Начало автоматической установки..."

# Обновление системы
echo "📦 Обновление системы..."
apt-get update
apt-get upgrade -y

# Установка системных зависимостей
echo "🔧 Установка зависимостей..."
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
    cmake \
    ufw

# Создание директории приложения
echo "📁 Создание директории..."
mkdir -p $APP_DIR
cd $APP_DIR

# Если проект уже загружен, пропускаем
if [ ! -f "app.py" ]; then
    echo "⚠️  Файл app.py не найден!"
    echo "Пожалуйста, загрузите проект в $APP_DIR"
    exit 1
fi

# Создание виртуального окружения
echo "🐍 Создание виртуального окружения..."
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
echo "📥 Установка Python зависимостей..."
pip install --upgrade pip

# Установка dlib
echo "⏳ Установка dlib (это может занять время)..."
pip install https://github.com/z-mahmud22/prebuilt-dlib/releases/download/v19.24.0/dlib-19.24.0-cp311-cp311-manylinux_2_17_x86_64.whl 2>/dev/null || \
pip install dlib==19.24.2

# Установка остальных зависимостей
pip install -r requirements.txt

# Создание необходимых директорий
echo "📂 Создание директорий..."
mkdir -p database frontend/static/uploads
mkdir -p /var/log/$SERVICE_NAME

# Генерация SECRET_KEY
echo "🔐 Генерация SECRET_KEY..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# Создание .env файла
echo "📝 Создание .env файла..."
cat > .env << EOF
SECRET_KEY=$SECRET_KEY
FLASK_ENV=production
FLASK_APP=app.py
PYTHONUNBUFFERED=1
EOF

# Настройка прав доступа
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR
chown -R www-data:www-data /var/log/$SERVICE_NAME

# Создание systemd service
echo "⚙️  Настройка systemd service..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Football School Flask Application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
Environment="PATH=$APP_DIR/venv/bin"
Environment="FLASK_APP=app.py"
Environment="FLASK_ENV=production"
EnvironmentFile=$APP_DIR/.env
Environment="PYTHONUNBUFFERED=1"

ExecStart=$APP_DIR/venv/bin/gunicorn \\
    --bind 127.0.0.1:5001 \\
    --workers 2 \\
    --timeout 120 \\
    --access-logfile /var/log/$SERVICE_NAME/access.log \\
    --error-logfile /var/log/$SERVICE_NAME/error.log \\
    app:app

Restart=always
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# Настройка Nginx
echo "🌐 Настройка Nginx..."
cat > /etc/nginx/sites-available/$SERVICE_NAME << EOF
server {
    listen 80;
    server_name 45.92.173.37 vps6377.eskiz.uz;

    access_log /var/log/nginx/${SERVICE_NAME}_access.log;
    error_log /var/log/nginx/${SERVICE_NAME}_error.log;

    client_max_body_size 10M;

    location /static {
        alias $APP_DIR/frontend/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /static/uploads {
        alias $APP_DIR/frontend/static/uploads;
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

# Активация конфигурации Nginx
ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации Nginx
nginx -t

# Настройка firewall
echo "🔥 Настройка firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Перезагрузка systemd
systemctl daemon-reload

# Включение автозапуска
systemctl enable $SERVICE_NAME
systemctl enable nginx

echo "✅ Установка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Инициализируйте базу данных:"
echo "   cd $APP_DIR"
echo "   source venv/bin/activate"
echo "   python init_db.py"
echo ""
echo "2. Запустите приложение:"
echo "   systemctl start $SERVICE_NAME"
echo "   systemctl restart nginx"
echo ""
echo "3. Проверьте статус:"
echo "   systemctl status $SERVICE_NAME"
echo ""
echo "4. Откройте в браузере:"
echo "   http://45.92.173.37"

