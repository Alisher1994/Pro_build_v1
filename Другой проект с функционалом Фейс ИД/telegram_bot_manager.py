"""
Менеджер Telegram ботов для multi-tenancy системы
Запускает отдельный бот для каждой школы с активным токеном

Запуск:
python telegram_bot_manager.py
"""
import os
import sys
import time
import signal
import subprocess
from threading import Thread
from datetime import datetime

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from backend.models.models import db, ClubSettings, School

# Создаём Flask приложение для доступа к БД
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    f'sqlite:///{os.path.join(os.path.dirname(__file__), "database", "football_school.db")}'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Словарь для хранения процессов ботов {school_id: process}
bot_processes = {}
running = True

APP_URL = os.environ.get('APP_URL', 'https://d-promo.uz')


def get_schools_with_bots():
    """Получить список школ с активными токенами ботов"""
    with app.app_context():
        schools = School.query.filter_by(is_active=True).all()
        schools_with_bots = []
        
        for school in schools:
            # Получаем настройки для школы
            settings = ClubSettings.query.filter_by(school_id=school.id).first()
            if settings and settings.telegram_bot_token:
                schools_with_bots.append({
                    'school_id': school.id,
                    'school_name': school.name,
                    'token': settings.telegram_bot_token
                })
        
        return schools_with_bots


def start_bot_for_school(school_id, school_name, token):
    """Запустить бот для конкретной школы"""
    print(f"🤖 Запуск бота для школы '{school_name}' (ID: {school_id})...")
    
    # Создаём отдельный скрипт для запуска бота школы
    project_dir = os.path.dirname(os.path.abspath(__file__))
    bot_script = f"""
import os
import sys
sys.path.insert(0, r'{project_dir}')

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import requests
import time

APP_URL = '{APP_URL}'
SCHOOL_ID = {school_id}
SCHOOL_NAME = '{school_name}'
TOKEN = '{token}'

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    '''Обработчик команды /start'''
    await update.message.reply_text(
        f"👋 Добро пожаловать!\\n\\n"
        f"Я бот школы '{{SCHOOL_NAME}}'.\\n\\n"
        f"Для регистрации отправьте код, который вы получили в школе."
    )

async def handle_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    '''Обработчик кода регистрации'''
    code = update.message.text.strip().upper()
    chat_id = update.message.chat_id
    
    try:
        response = requests.post(
            f'{{APP_URL}}/api/telegram/register',
            json={{
                'code': code,
                'telegram_chat_id': chat_id,
                'school_id': SCHOOL_ID
            }},
            timeout=10
        )
        
        # Обработка ответа
        try:
            data = response.json()
        except:
            data = {{}}
        
        if response.status_code == 200:
            if data.get('success'):
                student_info = data.get('student', {{}})
                student_name = student_info.get('full_name', 'Ученик')
                group_name = student_info.get('group_name', '')
                group_text = f"Группа: {{group_name}}\\n" if group_name else ""
                await update.message.reply_text(
                    f"✅ Регистрация успешна!\\n\\n"
                    f"Вы зарегистрированы как: {{student_name}}\\n"
                    f"{{group_text}}\\n"
                    f"Теперь вы будете получать уведомления о занятиях."
                )
            else:
                error_msg = data.get('message', 'Ошибка регистрации')
                await update.message.reply_text(f"❌ {{error_msg}}")
        else:
            # Если статус не 200, показываем сообщение об ошибке из API или общее
            error_msg = data.get('message', f'Ошибка сервера (код {{response.status_code}})')
            print(f"API вернул статус {{response.status_code}}: {{error_msg}}")
            await update.message.reply_text(f"❌ {{error_msg}}")
    except requests.exceptions.Timeout:
        print(f"Таймаут при запросе к API")
        await update.message.reply_text("❌ Сервер не отвечает. Попробуйте позже.")
    except requests.exceptions.ConnectionError as e:
        print(f"Ошибка подключения к API: {{e}}")
        await update.message.reply_text("❌ Не удалось подключиться к серверу. Проверьте подключение к интернету.")
    except Exception as e:
        print(f"Ошибка регистрации: {{e}}")
        import traceback
        traceback.print_exc()
        await update.message.reply_text(f"❌ Произошла ошибка: {{str(e)}}")

async def unknown(update: Update, context: ContextTypes.DEFAULT_TYPE):
    '''Обработчик неизвестных команд'''
    await update.message.reply_text("❓ Неизвестная команда. Используйте /start для начала.")

if __name__ == '__main__':
    print(f"🤖 Запуск бота для школы '{{SCHOOL_NAME}}' (ID: {{SCHOOL_ID}})...")
    print(f"📡 Подключение к приложению: {{APP_URL}}")
    
    application = Application.builder().token(TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_code))
    application.add_handler(MessageHandler(filters.COMMAND, unknown))
    
    print(f"✅ Бот для школы '{{SCHOOL_NAME}}' запущен!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)
"""
    
    # Записываем скрипт во временный файл
    script_path = f'/tmp/telegram_bot_school_{school_id}.py'
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(bot_script)
    
    # Запускаем процесс
    venv_python = os.path.join(os.path.dirname(__file__), 'venv', 'bin', 'python3')
    if not os.path.exists(venv_python):
        venv_python = 'python3'
    
    process = subprocess.Popen(
        [venv_python, script_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(__file__)
    )
    
    return process


def stop_all_bots():
    """Остановить все запущенные боты"""
    global running
    running = False
    
    print("\n🛑 Остановка всех ботов...")
    for school_id, process in bot_processes.items():
        if process.poll() is None:  # Процесс ещё работает
            print(f"  Остановка бота для школы ID: {school_id}")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
    
    bot_processes.clear()
    print("✅ Все боты остановлены")


def check_and_restart_bots():
    """Проверить и перезапустить боты при необходимости"""
    global bot_processes
    
    with app.app_context():
        schools_with_bots = get_schools_with_bots()
        current_school_ids = {s['school_id'] for s in schools_with_bots}
        running_school_ids = set(bot_processes.keys())
        
        # Остановить боты для школ, у которых больше нет токена
        for school_id in running_school_ids - current_school_ids:
            if school_id in bot_processes:
                process = bot_processes[school_id]
                if process.poll() is None:
                    print(f"🛑 Остановка бота для школы ID: {school_id} (токен удалён)")
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                del bot_processes[school_id]
        
        # Запустить новые боты или перезапустить упавшие
        for school_info in schools_with_bots:
            school_id = school_info['school_id']
            
            # Если бот не запущен или упал
            if school_id not in bot_processes or bot_processes[school_id].poll() is not None:
                # Если процесс упал, удаляем его из списка
                if school_id in bot_processes:
                    del bot_processes[school_id]
                
                # Запускаем новый бот
                process = start_bot_for_school(
                    school_id,
                    school_info['school_name'],
                    school_info['token']
                )
                bot_processes[school_id] = process
                time.sleep(1)  # Небольшая задержка между запусками


def signal_handler(signum, frame):
    """Обработчик сигналов для корректного завершения"""
    stop_all_bots()
    sys.exit(0)


def main():
    """Главная функция"""
    global running
    
    # Регистрация обработчиков сигналов
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("=" * 60)
    print("🤖 Менеджер Telegram ботов для Football School")
    print("=" * 60)
    print(f"📡 URL приложения: {APP_URL}")
    print()
    
    # Первоначальный запуск ботов
    check_and_restart_bots()
    
    if not bot_processes:
        print("⚠️  Не найдено школ с активными токенами ботов")
        print("   Добавьте токены в настройках каждой школы")
        return
    
    print(f"\n✅ Запущено ботов: {len(bot_processes)}")
    print("🔄 Проверка ботов каждые 60 секунд...")
    print("Нажмите Ctrl+C для остановки\n")
    
    # Основной цикл проверки
    while running:
        try:
            time.sleep(60)  # Проверка каждую минуту
            if running:
                check_and_restart_bots()
        except KeyboardInterrupt:
            break
    
    stop_all_bots()


if __name__ == '__main__':
    main()

