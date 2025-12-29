#!/bin/bash
# Скрипт деплоя Flask приложения на VPS

set -e  # Остановка при ошибке

echo "🚀 Начало деплоя Flask приложения..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Переменные
APP_NAME="football_school"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="$APP_NAME"
USER="www-data"

echo -e "${YELLOW}📦 Обновление системы...${NC}"
apt-get update
apt-get upgrade -y

echo -e "${YELLOW}🔧 Установка системных зависимостей...${NC}"
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

echo -e "${YELLOW}📁 Создание директории приложения...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR

echo -e "${YELLOW}🐍 Создание виртуального окружения...${NC}"
python3 -m venv venv
source venv/bin/activate

echo -e "${YELLOW}📥 Установка Python зависимостей...${NC}"
# Установка dlib отдельно (требует много времени)
pip install --upgrade pip
pip install https://github.com/z-mahmud22/prebuilt-dlib/releases/download/v19.24.0/dlib-19.24.0-cp311-cp311-manylinux_2_17_x86_64.whl || \
pip install dlib==19.24.2

# Установка остальных зависимостей
pip install -r requirements.txt

echo -e "${YELLOW}📂 Создание необходимых директорий...${NC}"
mkdir -p database frontend/static/uploads
chown -R $USER:$USER $APP_DIR
chmod -R 755 $APP_DIR

echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo -e "${YELLOW}📝 Следующие шаги:${NC}"
echo "1. Настройте переменные окружения в $APP_DIR/.env"
echo "2. Инициализируйте базу данных: python init_db.py"
echo "3. Настройте nginx конфигурацию"
echo "4. Настройте systemd service"
echo "5. Запустите приложение: systemctl start $SERVICE_NAME"

