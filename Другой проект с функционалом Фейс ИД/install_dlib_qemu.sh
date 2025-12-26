#!/bin/bash
# Скрипт для установки dlib на QEMU виртуальном процессоре

set -e

echo "🔧 Установка dlib для QEMU виртуального процессора..."

# Удаляем несовместимый dlib-binary
pip uninstall -y dlib-binary dlib 2>/dev/null || true

# Устанавливаем дополнительные зависимости для сборки
apt-get install -y libx11-dev libgtk-3-dev libboost-all-dev

# Устанавливаем dlib из исходников с отключенными AVX оптимизациями
echo "📦 Сборка dlib из исходников (это займет 10-20 минут)..."

# Устанавливаем переменные окружения для отключения AVX
export CMAKE_ARGS="-DUSE_AVX_INSTRUCTIONS=OFF -DUSE_SSE4_INSTRUCTIONS=ON"
export DLIB_USE_CUDA=0

# Устанавливаем dlib с флагами для отключения AVX
pip install --no-cache-dir dlib==19.24.2 --verbose 2>&1 | tee dlib_build.log || {
    echo "❌ Ошибка при сборке. Пробуем альтернативный способ..."
    
    # Альтернативный способ - через git и ручную сборку
    cd /tmp
    git clone https://github.com/davisking/dlib.git
    cd dlib
    mkdir build
    cd build
    
    # Конфигурируем CMake без AVX
    cmake .. -DUSE_AVX_INSTRUCTIONS=OFF -DUSE_SSE4_INSTRUCTIONS=ON -DCMAKE_BUILD_TYPE=Release
    cmake --build . --config Release
    
    # Устанавливаем в виртуальное окружение
    cd ..
    python setup.py install --no DLIB_USE_CUDA
}

echo "✅ dlib установлен!"

