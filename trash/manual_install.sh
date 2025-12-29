#!/bin/bash
# Ручная установка после ошибки

set -e

APP_DIR="/opt/football_school"
cd $APP_DIR

echo "🔧 Установка системных зависимостей..."

# Установка Python и базовых пакетов
apt-get install -y python3 python3-pip python3-venv

# Установка зависимостей для face_recognition
apt-get install -y \
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
    nginx \
    supervisor \
    git

echo "🐍 Создание виртуального окружения..."
python3 -m venv venv
source venv/bin/activate

echo "📥 Обновление pip..."
pip install --upgrade pip

echo "⏳ Установка dlib (это может занять время)..."
# Попробуем установить предсобранный dlib
pip install https://github.com/z-mahmud22/prebuilt-dlib/releases/download/v19.24.0/dlib-19.24.0-cp311-cp311-manylinux_2_17_x86_64.whl 2>/dev/null || \
pip install dlib==19.24.2

echo "📦 Установка Python зависимостей..."
pip install -r requirements.txt

echo "📂 Создание директорий..."
mkdir -p database frontend/static/uploads
mkdir -p /var/log/football_school

echo "🔐 Генерация SECRET_KEY..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

echo "📝 Создание .env файла..."
cat > .env << EOF
SECRET_KEY=$SECRET_KEY
FLASK_ENV=production
FLASK_APP=app.py
PYTHONUNBUFFERED=1
EOF

echo "✅ Установка завершена!"
echo ""
echo "Следующий шаг:"
echo "  source venv/bin/activate"
echo "  python init_db.py"

