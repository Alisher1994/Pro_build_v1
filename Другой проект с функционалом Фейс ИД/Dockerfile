# Используем образ с поддержкой OpenCV и face_recognition
FROM python:3.11-slim

# Установка системных зависимостей для face_recognition и OpenCV
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    wget \
    unzip \
    pkg-config \
    libopencv-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libopenblas-dev \
    liblapack-dev \
    gfortran \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Установка предварительно собранного dlib (без сборки из исходников)
RUN pip install --no-cache-dir \
    https://github.com/z-mahmud22/prebuilt-dlib/releases/download/v19.24.0/dlib-19.24.0-cp311-cp311-manylinux_2_17_x86_64.whl

# Создание рабочей директории
WORKDIR /app

# Копирование requirements.txt
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование всего проекта
COPY . .

# Создание необходимых директорий
RUN mkdir -p database frontend/static/uploads

# Установка переменных окружения
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py

# Открытие порта
EXPOSE $PORT

# Создание startup скрипта
RUN echo '#!/bin/bash\n\
python init_db.py\n\
gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120' > /app/start.sh && \
chmod +x /app/start.sh

# Запуск приложения
CMD ["/app/start.sh"]
