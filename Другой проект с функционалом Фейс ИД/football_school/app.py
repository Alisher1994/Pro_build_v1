from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename
import os
import face_recognition
from datetime import datetime, timedelta, time, date, timezone
from sqlalchemy import func
import pytz

from backend.models.models import db, User, Student, Payment, Attendance, Expense, Group, Tariff, ClubSettings, RewardType, StudentReward, CashTransfer, Role, RolePermission, CardType, StudentCard, School, SchoolFeature, SuperAdmin
from backend.services.face_service import FaceRecognitionService
from backend.data.locations import get_cities, get_districts
from backend.utils.student_utils import (
    generate_telegram_link_code,
    get_next_available_student_number,
    validate_student_number,
    ensure_student_has_telegram_code
)
from backend.utils.school_utils import get_current_school, get_current_school_id, is_feature_enabled
from backend.middleware.school_middleware import setup_tenant_context
from backend.utils.query_filters import filter_query_by_school, ensure_school_id
from backend.services.telegram_service import (
    send_group_notification,
    register_student_by_code,
    send_reward_notification,
    send_card_notification,
    send_payment_notification,
    send_monthly_payment_reminders
)

# Часовой пояс Ташкента (UTC+5)
TASHKENT_TZ = pytz.timezone('Asia/Tashkent')

def get_local_time():
    """Получить текущее локальное время Ташкента"""
    return datetime.now(TASHKENT_TZ)

def get_local_date():
    """Получить текущую локальную дату Ташкента"""
    return get_local_time().date()

def get_local_datetime():
    """Получить текущий локальный datetime Ташкента (без timezone для совместимости с БД)"""
    return get_local_time().replace(tzinfo=None)

# Получить абсолютный путь к папке проекта
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, 
            template_folder='frontend/templates',
            static_folder='frontend/static')

# Конфигурация для production/development
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# PostgreSQL URL для Railway (автоматически устанавливается)
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Railway PostgreSQL использует postgres://, но SQLAlchemy требует postgresql://
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Локальная разработка - SQLite
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database', 'football_school.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, 'frontend', 'static', 'uploads')

UPLOAD_FOLDER = app.config['UPLOAD_FOLDER']

db.init_app(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

face_service = FaceRecognitionService()

@login_manager.user_loader
def load_user(user_id):
    """Загружает пользователя (User или SuperAdmin) по ID"""
    try:
        # Если ID начинается с 'super_', это суперадмин
        if isinstance(user_id, str) and user_id.startswith('super_'):
            admin_id = int(user_id.replace('super_', ''))
            return db.session.get(SuperAdmin, admin_id)
        # Иначе это обычный пользователь
        return db.session.get(User, int(user_id))
    except (ValueError, TypeError):
        return None


DAY_LABELS = {
    1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс'
}


def ensure_payment_type_column():
    """Проверяет и добавляет колонку payment_type в таблицу payments"""
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'payments' not in tables:
            db.create_all()
            return
        
        columns = {col['name'] for col in inspector.get_columns('payments')}
        
        if 'payment_type' not in columns:
            try:
                db.session.execute(db.text("ALTER TABLE payments ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'"))
                # Обновить существующие записи
                db.session.execute(db.text("UPDATE payments SET payment_type = 'cash' WHERE payment_type IS NULL"))
                db.session.commit()
                print("✓ Добавлена колонка payment_type в таблицу payments")
            except Exception as e:
                db.session.rollback()
                if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                    print(f"Ошибка при добавлении payment_type: {e}")
    except Exception as e:
        print(f"Ошибка при проверке колонки payment_type: {e}")


def ensure_schools_table_columns():
    """Проверяет и добавляет отсутствующие колонки в таблицу schools"""
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'schools' not in tables:
            with app.app_context():
                db.create_all()
            return
        
        columns = {col['name'] for col in inspector.get_columns('schools')}
        with db.engine.begin() as conn:
            if 'contact_person' not in columns:
                try:
                    conn.execute(db.text("ALTER TABLE schools ADD COLUMN contact_person VARCHAR(200)"))
                    print("[OK] Добавлена колонка contact_person в таблицу schools")
                except Exception as e:
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении contact_person: {e}")
    except Exception as e:
        print(f"Ошибка при проверке колонок schools: {e}")


def get_club_settings_instance():
    """Получить настройки клуба для текущей школы. Всегда возвращает настройки ТОЛЬКО текущей школы."""
    ensure_schools_table_columns()
    ensure_club_settings_columns()
    ensure_cash_transfers_table()
    ensure_users_table_columns()
    ensure_roles_tables()
    ensure_payment_type_column()
    
    # Получаем настройки для текущей школы
    school_id = get_current_school_id()
    
    if school_id:
        # Ищем настройки ТОЛЬКО для текущей школы
        settings = ClubSettings.query.filter_by(school_id=school_id).first()
        if settings:
            return settings
        
        # Если нет настроек для школы, создаём новые ПУСТЫЕ настройки
        print(f"[SETTINGS] Creating new empty settings for school_id={school_id}")
        settings = ClubSettings(
            school_id=school_id,
            system_name='FK QORASUV',
            working_days=None,
            work_start_time=None,
            work_end_time=None,
            max_groups_per_slot=None,
            block_future_payments=False,
            rewards_reset_period_months=1,
            podium_display_count=20,
            telegram_bot_token=None,
            telegram_notification_template=None,
            telegram_reward_template=None,
            telegram_card_template=None,
            telegram_payment_template=None
        )
        db.session.add(settings)
        db.session.commit()
        return settings
    
    # Если школа не выбрана (например, для супер-админа), возвращаем None или создаём временные
    # Супер-админ не должен использовать настройки конкретной школы
    print("[SETTINGS] No school selected, returning None")
    return None


# Регистрируем before_request обработчик для работы со школами
@app.before_request
def setup_school_context():
    """Устанавливает контекст текущей школы перед каждым запросом"""
    setup_tenant_context()


def ensure_users_table_columns():
    """Проверяет и добавляет отсутствующие колонки в таблицу users"""
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'users' not in tables:
            db.create_all()
            return
        
        columns = {col['name'] for col in inspector.get_columns('users')}
        
        # Добавляем отсутствующие колонки
        if 'role_id' not in columns:
            try:
                db.session.execute(db.text("ALTER TABLE users ADD COLUMN role_id INTEGER"))
                db.session.commit()
                print("✓ Добавлена колонка role_id в таблицу users")
            except Exception as e:
                db.session.rollback()
                if "duplicate column" not in str(e).lower():
                    print(f"Ошибка при добавлении role_id: {e}")
        
        if 'full_name' not in columns:
            try:
                db.session.execute(db.text("ALTER TABLE users ADD COLUMN full_name VARCHAR(200)"))
                db.session.commit()
                print("✓ Добавлена колонка full_name в таблицу users")
            except Exception as e:
                db.session.rollback()
                if "duplicate column" not in str(e).lower():
                    print(f"Ошибка при добавлении full_name: {e}")
        
        if 'is_active' not in columns:
            try:
                db.session.execute(db.text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                db.session.commit()
                # Обновляем существующие записи
                db.session.execute(db.text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
                db.session.commit()
                print("✓ Добавлена колонка is_active в таблицу users")
            except Exception as e:
                db.session.rollback()
                if "duplicate column" not in str(e).lower():
                    print(f"Ошибка при добавлении is_active: {e}")
                    
    except Exception as e:
        print(f"Ошибка при обновлении таблицы users: {e}")


def ensure_roles_tables():
    """Проверяет и создает таблицы для системы ролей"""
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'roles' not in tables or 'role_permissions' not in tables:
            db.create_all()
            # Создать стандартные роли, если их нет
            create_default_roles()
    except Exception as e:
        print(f"Ошибка при проверке таблиц ролей: {e}")


def create_default_roles():
    """Создать стандартные роли с правами доступа"""
    try:
        # Роль "Администратор" - все права
        admin_role = Role.query.filter_by(name='Администратор').first()
        if not admin_role:
            admin_role = Role(name='Администратор', description='Полный доступ ко всем разделам')
            db.session.add(admin_role)
            db.session.flush()
            
            sections = ['dashboard', 'students', 'groups', 'tariffs', 'finances', 'attendance', 'camera', 'rewards', 'rating', 'users', 'cash']
            for section in sections:
                perm = RolePermission(role_id=admin_role.id, section=section, can_view=True, can_edit=True)
                db.session.add(perm)
            
            db.session.commit()
            print("✓ Создана роль 'Администратор'")
    except Exception as e:
        db.session.rollback()
        print(f"Ошибка при создании стандартных ролей: {e}")


def ensure_club_settings_columns():
    """Добавляет отсутствующие колонки в club_settings (на случай старой БД)"""
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    if 'club_settings' not in tables:
        with app.app_context():
            db.create_all()
        return

    columns = {col['name'] for col in inspector.get_columns('club_settings')}
    with db.engine.begin() as conn:
        if 'system_name' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN system_name VARCHAR(200)"))
        if 'rewards_reset_period_months' not in columns:
            # SQLite использует INTEGER, PostgreSQL тоже поддерживает
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN rewards_reset_period_months INTEGER DEFAULT 1"))
        if 'podium_display_count' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN podium_display_count INTEGER DEFAULT 20"))
        if 'telegram_bot_token' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN telegram_bot_token VARCHAR(200)"))
        if 'telegram_notification_template' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN telegram_notification_template TEXT"))
        if 'telegram_reward_template' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN telegram_reward_template TEXT"))
        if 'telegram_card_template' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN telegram_card_template TEXT"))
        if 'telegram_payment_template' not in columns:
            conn.execute(db.text("ALTER TABLE club_settings ADD COLUMN telegram_payment_template TEXT"))


def ensure_students_columns():
    """Добавляет отсутствующие колонки в students (миграция для Telegram)"""
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    
    if 'students' not in tables:
        # Таблица не существует, создадим её через create_all
        with app.app_context():
            db.create_all()
        return
    
    try:
        student_columns = {col['name'] for col in inspector.get_columns('students')}
        with db.engine.begin() as conn:
            if 'telegram_link_code' not in student_columns:
                try:
                    conn.execute(db.text("ALTER TABLE students ADD COLUMN telegram_link_code VARCHAR(10)"))
                    print("✓ Добавлена колонка telegram_link_code в таблицу students")
                except Exception as e:
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении telegram_link_code: {e}")
            
            if 'telegram_chat_id' not in student_columns:
                try:
                    # SQLite использует INTEGER для больших чисел, PostgreSQL - BIGINT
                    # Используем INTEGER для совместимости
                    conn.execute(db.text("ALTER TABLE students ADD COLUMN telegram_chat_id INTEGER"))
                    print("✓ Добавлена колонка telegram_chat_id в таблицу students")
                except Exception as e:
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении telegram_chat_id: {e}")
            
            if 'telegram_notifications_enabled' not in student_columns:
                try:
                    # SQLite использует INTEGER для BOOLEAN (0/1), PostgreSQL - BOOLEAN
                    # Используем INTEGER DEFAULT 1 для совместимости
                    conn.execute(db.text("ALTER TABLE students ADD COLUMN telegram_notifications_enabled INTEGER DEFAULT 1"))
                    print("✓ Добавлена колонка telegram_notifications_enabled в таблицу students")
                except Exception as e:
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении telegram_notifications_enabled: {e}")
    except Exception as e:
        print(f"Ошибка при миграции таблицы students: {e}")
        import traceback
        traceback.print_exc()


def ensure_cash_transfers_table():
    """Проверяет и создает/обновляет таблицу cash_transfers"""
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'cash_transfers' not in tables:
            # Таблица не существует, создаем её
            db.create_all()
            return
        
        # Получаем список существующих колонок
        columns = {col['name'] for col in inspector.get_columns('cash_transfers')}
        
        # Если есть старая колонка transferred_to с NOT NULL, нужно пересоздать таблицу
        if 'transferred_to' in columns:
            print("Обнаружена старая колонка transferred_to. Пересоздаем таблицу...")
            try:
                # Сохраняем данные через raw SQL
                result = db.session.execute(db.text("SELECT id, amount, transferred_to, recipient, transfer_date, notes, created_by, created_at, updated_at FROM cash_transfers"))
                old_data = []
                for row in result:
                    old_data.append({
                        'id': row[0],
                        'amount': row[1],
                        'recipient': row[2] or row[3] or 'Не указано',  # transferred_to или recipient
                        'transfer_date': row[4],
                        'notes': row[5] or '',
                        'created_by': row[6],
                        'created_at': row[7],
                        'updated_at': row[8]
                    })
                
                print(f"Сохранено {len(old_data)} записей")
                
                # Удаляем старую таблицу
                db.session.execute(db.text("DROP TABLE cash_transfers"))
                db.session.commit()
                
                # Создаем новую таблицу через create_all
                db.create_all()
                
                # Восстанавливаем данные
                for data in old_data:
                    transfer = CashTransfer(
                        amount=data['amount'],
                        recipient=data['recipient'],
                        transfer_date=data['transfer_date'],
                        notes=data['notes'],
                        created_by=data['created_by']
                    )
                    if data.get('created_at'):
                        transfer.created_at = data['created_at']
                    if data.get('updated_at'):
                        transfer.updated_at = data['updated_at']
                    db.session.add(transfer)
                
                db.session.commit()
                print("✓ Таблица cash_transfers успешно пересоздана")
                return
            except Exception as e:
                db.session.rollback()
                print(f"Ошибка при пересоздании таблицы: {e}")
                import traceback
                traceback.print_exc()
                # Продолжаем с обычной миграцией
        
        # Обычная миграция - добавляем недостающие колонки
        columns = {col['name'] for col in inspector.get_columns('cash_transfers')}
        
        # Список колонок, которые должны быть в таблице
        required_columns = {
            'recipient': "ALTER TABLE cash_transfers ADD COLUMN recipient VARCHAR(200)",
            'created_at': "ALTER TABLE cash_transfers ADD COLUMN created_at TIMESTAMP",
            'updated_at': "ALTER TABLE cash_transfers ADD COLUMN updated_at TIMESTAMP",
            'created_by': "ALTER TABLE cash_transfers ADD COLUMN created_by INTEGER",
            'transfer_date': "ALTER TABLE cash_transfers ADD COLUMN transfer_date TIMESTAMP",
            'notes': "ALTER TABLE cash_transfers ADD COLUMN notes TEXT",
            'amount': "ALTER TABLE cash_transfers ADD COLUMN amount FLOAT",
            'school_id': "ALTER TABLE cash_transfers ADD COLUMN school_id INTEGER"
        }
        
        # Добавляем отсутствующие колонки
        for col_name, alter_sql in required_columns.items():
            if col_name not in columns:
                try:
                    db.session.execute(db.text(alter_sql))
                    db.session.commit()
                    print(f"✓ Добавлена колонка {col_name} в таблицу cash_transfers")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении колонки {col_name}: {e}")
        
        # Обновляем существующие записи для recipient
        if 'recipient' in columns:
            try:
                # Если есть transferred_to, копируем данные
                if 'transferred_to' in columns:
                    db.session.execute(db.text("UPDATE cash_transfers SET recipient = transferred_to WHERE recipient IS NULL OR recipient = ''"))
                else:
                    db.session.execute(db.text("UPDATE cash_transfers SET recipient = 'Не указано' WHERE recipient IS NULL OR recipient = ''"))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                
    except Exception as e:
        print(f"Ошибка при обновлении таблицы cash_transfers: {e}")
        import traceback
        traceback.print_exc()


def calculate_student_balance(student):
    """
    Расчёт баланса ученика в занятиях.
    Баланс = (сумма оплат / стоимость 1 занятия) - количество посещений
    Стоимость 1 занятия = цена тарифа / кол-во занятий в тарифе
    """
    if not student:
        return 0
    
    # Получаем стоимость одного занятия из тарифа
    lesson_price = 0
    if student.tariff_id:
        tariff_query = Tariff.query.filter_by(id=student.tariff_id)
        tariff = filter_query_by_school(tariff_query, Tariff).first()
        if tariff and tariff.price and tariff.lessons_count and tariff.lessons_count > 0:
            lesson_price = float(tariff.price) / float(tariff.lessons_count)
    
    if lesson_price <= 0:
        # Если тариф не задан или некорректный, возвращаем старый баланс
        return student.balance if student.balance else 0
    
    # Сумма всех оплат ученика
    total_paid = db.session.query(db.func.sum(Payment.amount_paid)).filter(
        Payment.student_id == student.id
    ).scalar() or 0
    
    # Количество посещений (занятий)
    attendance_query = Attendance.query.filter_by(student_id=student.id)
    attendance_count = filter_query_by_school(attendance_query, Attendance).count()
    
    # Баланс в занятиях = оплачено занятий - посещено занятий
    paid_lessons = int(total_paid / lesson_price)
    balance = paid_lessons - attendance_count
    
    return balance


def parse_days_list(raw_days):
    if raw_days is None:
        return []
    if isinstance(raw_days, list):
        return [int(day) for day in raw_days if str(day).isdigit()]
    if isinstance(raw_days, str):
        return [int(day) for day in raw_days.split(',') if day.strip().isdigit()]
    return []


def validate_group_schedule(schedule_time, schedule_days, exclude_group_id=None):
    if schedule_time is None:
        return False, 'Укажите время занятия'
    settings = get_club_settings_instance()
    working_days = set(settings.get_working_days_list())
    selected_days = set(schedule_days)
    if not selected_days:
        return False, 'Выберите хотя бы один день недели'
    if not selected_days.issubset(working_days):
        return False, 'Выбранные дни не входят в рабочий график клуба'
    if schedule_time < settings.work_start_time or schedule_time > settings.work_end_time:
        return False, 'Время занятия вне рабочего времени клуба'
    groups_same_time_query = Group.query.filter_by(schedule_time=schedule_time)
    groups_same_time = filter_query_by_school(groups_same_time_query, Group).all()
    for day in selected_days:
        count = 0
        for group in groups_same_time:
            if exclude_group_id and group.id == exclude_group_id:
                continue
            if day in group.get_schedule_days_list():
                count += 1
        if count >= settings.max_groups_per_slot:
            return False, f"Нет свободного поля на {DAY_LABELS.get(day, day)} {schedule_time.strftime('%H:%M')}"
    return True, ''


@app.template_filter('format_thousand')
def format_thousand(value):
    try:
        if value is None:
            return ''
        number = float(value)
        if number.is_integer():
            return '{:,.0f}'.format(number).replace(',', ' ')
        return '{:,.2f}'.format(number).replace(',', ' ')
    except (TypeError, ValueError):
        return value


@app.template_filter('format_date')
def format_date(value, fmt='%d.%m.%Y'):
    if not value:
        return ''
    if isinstance(value, str):
        try:
            value = datetime.strptime(value, '%Y-%m-%d')
        except ValueError:
            return value
    if isinstance(value, datetime):
        return value.strftime(fmt)
    try:
        return value.strftime(fmt)
    except AttributeError:
        return value


@app.context_processor
def inject_system_name():
    """Добавляет название системы во все шаблоны"""
    try:
        settings = get_club_settings_instance()
        name = settings.system_name or 'FK QORASUV'
    except Exception:
        name = 'FK QORASUV'
    return {'system_name': name}


# ===== МАРШРУТЫ АВТОРИЗАЦИИ =====

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        # Сначала проверяем суперадмина
        super_admin = SuperAdmin.query.filter_by(username=username).first()
        if super_admin and bcrypt.check_password_hash(super_admin.password_hash, password):
            if not super_admin.is_active:
                return jsonify({'success': False, 'message': 'Аккаунт деактивирован'}), 403
            
            # Обновляем время последнего входа
            super_admin.last_login = get_local_datetime()
            db.session.commit()
            
            # Входим как суперадмин (используем специальный ID с префиксом)
            # Flask-Login требует строковый ID, поэтому используем префикс
            login_user(super_admin, remember=False)
            session['user_type'] = 'super_admin'
            
            return jsonify({'success': True, 'role': 'super_admin', 'redirect': '/schools'})
        
        # Проверяем обычного пользователя
        user = User.query.filter_by(username=username).first()
        
        if user and bcrypt.check_password_hash(user.password_hash, password):
            # Проверка активности пользователя
            if not user.is_active:
                return jsonify({'success': False, 'message': 'Аккаунт деактивирован'}), 403
            
            # Для админов школ проверяем, что их школа активна
            if user.role == 'admin' and hasattr(user, 'school_id') and user.school_id:
                school = School.query.get(user.school_id)
                if not school or not school.is_active:
                    return jsonify({'success': False, 'message': 'Школа деактивирована'}), 403
            
            login_user(user)
            session['user_type'] = 'user'
            
            # ВСЕГДА устанавливаем школу пользователя в сессию
            # Если у пользователя есть school_id - используем его
            # Если нет - находим первую активную школу и привязываем
            school_id = None
            if hasattr(user, 'school_id') and user.school_id:
                school = School.query.get(user.school_id)
                if school and school.is_active:
                    school_id = user.school_id
                else:
                    # Школа неактивна - находим первую активную
                    first_school = School.query.filter_by(is_active=True).first()
                    if first_school:
                        school_id = first_school.id
                        # Обновляем пользователя в БД
                        user.school_id = school_id
                        db.session.commit()
            else:
                # Если у пользователя нет school_id, находим первую активную школу
                first_school = School.query.filter_by(is_active=True).first()
                if first_school:
                    school_id = first_school.id
                    # Обновляем пользователя в БД
                    user.school_id = school_id
                    db.session.commit()
            
            # ВСЕГДА устанавливаем school_id в сессию (даже если None - для логирования)
            if school_id:
                from backend.utils.school_utils import set_current_school
                set_current_school(school_id)
                # Также устанавливаем в g для текущего запроса
                from flask import g
                g.current_school_id = school_id
            else:
                print(f"⚠️ WARNING: User {user.username} logged in but no school_id found!")
            
            # Перенаправление в зависимости от роли
            if user.role == 'payment_admin':
                return jsonify({'success': True, 'role': user.role, 'redirect': '/mobile-payments'})
            elif user.role == 'teacher':
                return jsonify({'success': True, 'role': user.role, 'redirect': '/teacher-attendance'})
            return jsonify({'success': True, 'role': user.role})
        else:
            return jsonify({'success': False, 'message': 'Неверный логин или пароль'}), 401
    
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


# ===== ГЛАВНАЯ ПАНЕЛЬ =====

@app.route('/dashboard')
@login_required
def dashboard():
    # Статистика
    total_students_query = Student.query.filter_by(status='active')
    total_students = filter_query_by_school(total_students_query, Student).count()
    # Подсчет студентов с низким балансом (<=2 занятия)
    active_students_query = Student.query.filter_by(status='active')
    active_students = filter_query_by_school(active_students_query, Student).all()
    students_low_balance = sum(1 for s in active_students if calculate_student_balance(s) <= 2)
    
    today = get_local_date()
    today_attendance_query = Attendance.query.filter_by(date=today)
    today_attendance = filter_query_by_school(today_attendance_query, Attendance).count()
    
    # Доходы за месяц
    month_start = get_local_datetime().replace(day=1)
    payment_query = db.session.query(db.func.sum(Payment.amount_paid)).filter(
        Payment.payment_date >= month_start
    )
    payment_query = filter_query_by_school(payment_query, Payment)
    month_income = payment_query.scalar() or 0
    
    # Расходы за месяц
    expense_query = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.expense_date >= month_start
    )
    expense_query = filter_query_by_school(expense_query, Expense)
    month_expenses = expense_query.scalar() or 0
    
    return render_template('dashboard.html',
                         total_students=total_students,
                         students_low_balance=students_low_balance,
                         today_attendance=today_attendance,
                         month_income=month_income,
                         month_expenses=month_expenses,
                         profit=month_income - month_expenses)


# ===== УЧЕНИКИ =====

@app.route('/students')
@login_required
def students():
    from datetime import date
    all_students_query = Student.query.order_by(Student.full_name.asc())
    all_students = filter_query_by_school(all_students_query, Student).all()
    balances = {s.id: calculate_student_balance(s) for s in all_students}

    latest_payment_subquery = db.session.query(
        Payment.student_id,
        db.func.max(Payment.payment_date).label('latest_date')
    ).group_by(Payment.student_id).subquery()

    latest_payments = db.session.query(Payment).join(
        latest_payment_subquery,
        Payment.student_id == latest_payment_subquery.c.student_id
    ).filter(Payment.payment_date == latest_payment_subquery.c.latest_date).all()

    payment_info = {}
    for payment in latest_payments:
        payment_info[payment.student_id] = {
            'date': payment.payment_date.strftime('%d.%m.%Y') if payment.payment_date else None,
            'amount': payment.amount_paid,
            'debt': payment.amount_due
        }
    
    # Подсчет баллов для текущего месяца
    current_month = date.today().month
    current_year = date.today().year
    student_points = {}
    for student in all_students:
        total_points = get_student_points_sum(student.id, current_month, current_year)
        student_points[student.id] = total_points

    # Убедиться, что у всех учеников есть код Telegram
    for student in all_students:
        ensure_student_has_telegram_code(student)
    
    return render_template('students.html',
                           students=all_students,
                           payment_info=payment_info,
                           balances=balances,
                           student_points=student_points)


@app.route('/groups')
@login_required
def groups_page():
    return render_template('groups.html')


@app.route('/api/students', methods=['GET'])
@login_required
def get_students_list():
    """Возвращает всех учеников для фильтров"""
    students_query = Student.query.order_by(Student.full_name.asc())
    students = filter_query_by_school(students_query, Student).all()
    result = []
    for student in students:
        result.append({
            'id': student.id,
            'full_name': student.full_name,
            'student_number': student.student_number,
            'group_id': student.group_id,
            'group_name': student.group.name if student.group else None,
            'status': student.status,
            'photo_path': student.photo_path,
            'admission_date': student.admission_date.isoformat() if student.admission_date else None
        })
    return jsonify(result)


@app.route('/api/students/add', methods=['POST'])
@login_required
def add_student():
    try:
        full_name = request.form.get('full_name')
        phone = request.form.get('phone')
        parent_phone = request.form.get('parent_phone')
        photo = request.files.get('photo')
        
        # Новые поля
        group_id = request.form.get('group_id')
        tariff_id = request.form.get('tariff_id')
        school_number = request.form.get('school_number')
        city = request.form.get('city')
        district = request.form.get('district')
        street = request.form.get('street')
        house_number = request.form.get('house_number')
        
        birth_year = request.form.get('birth_year')
        passport_series = request.form.get('passport_series')
        passport_number = request.form.get('passport_number')
        passport_issued_by = request.form.get('passport_issued_by')
        passport_issue_date = request.form.get('passport_issue_date')
        passport_expiry_date = request.form.get('passport_expiry_date')
        admission_date_raw = request.form.get('admission_date')
        
        club_funded = request.form.get('club_funded') == 'true'
        status = request.form.get('status', 'active')
        blacklist_reason = request.form.get('blacklist_reason')
        student_number = (request.form.get('student_number') or '').strip()
        group_id_int = int(group_id) if group_id else None
        
        # Если номер не указан, автогенерируем
        if not student_number and group_id_int:
            student_number = get_next_available_student_number(group_id_int)
        
        if not student_number:
            return jsonify({'success': False, 'message': 'Номер ученика обязателен'}), 400
        
        # Валидация номера
        is_valid, error_msg = validate_student_number(student_number, group_id_int)
        if not is_valid:
            return jsonify({'success': False, 'message': error_msg}), 400
        
        # Проверить, не переполнена ли группа
        if group_id:
            group = db.session.get(Group, int(group_id))
            if group and group.is_full():
                current_count = group.get_current_students_count()
                return jsonify({
                    'success': False, 
                    'message': f'Группа "{group.name}" заполнена ({current_count}/{group.max_students})'
                }), 400
        
        if admission_date_raw:
            try:
                admission_date = datetime.strptime(admission_date_raw, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'message': 'Некорректная дата принятия'}), 400
        else:
            admission_date = get_local_date()

        # Параметры ученика
        height = request.form.get('height')
        weight = request.form.get('weight')
        jersey_size = request.form.get('jersey_size')
        shorts_size = request.form.get('shorts_size')
        boots_size = request.form.get('boots_size')
        equipment_notes = request.form.get('equipment_notes')
        
        # Создать ученика
        student = Student(
            student_number=student_number,
            school_number=school_number,
            full_name=full_name,
            phone=phone,
            parent_phone=parent_phone,
            balance=0,
            status=status,
            blacklist_reason=blacklist_reason if status == 'blacklist' else None,
            group_id=group_id_int,
            tariff_id=int(tariff_id) if tariff_id else None,
            telegram_link_code=generate_telegram_link_code(),
            city=city,
            district=district,
            street=street,
            house_number=house_number,
            birth_year=int(birth_year) if birth_year else None,
            passport_series=passport_series,
            passport_number=passport_number,
            passport_issued_by=passport_issued_by,
            passport_issue_date=datetime.strptime(passport_issue_date, '%Y-%m-%d').date() if passport_issue_date else None,
            passport_expiry_date=datetime.strptime(passport_expiry_date, '%Y-%m-%d').date() if passport_expiry_date else None,
            admission_date=admission_date,
            club_funded=club_funded,
            height=int(height) if height else None,
            weight=float(weight) if weight else None,
            jersey_size=jersey_size,
            shorts_size=shorts_size,
            boots_size=boots_size,
            equipment_notes=equipment_notes
        )
        
        # Установить school_id автоматически
        ensure_school_id(student)
        
        db.session.add(student)
        db.session.flush()
        
        # Сохранить фото и извлечь face encoding
        if photo:
            photo_path = face_service.save_student_photo(photo, student.id)
            student.photo_path = photo_path
            
            encoding = face_service.extract_face_encoding(photo_path)
            if encoding is not None:
                student.set_face_encoding(encoding)
            else:
                return jsonify({'success': False, 'message': 'Лицо не обнаружено на фото'}), 400
        
        db.session.commit()
        
        # Перезагрузить encodings
        reload_face_encodings()
        
        return jsonify({'success': True, 'student_id': student.id, 'student_number': student_number})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/students/<int:student_id>', methods=['GET'])
@login_required
def get_student(student_id):
    student_query = Student.query.filter_by(id=student_id)
    student = filter_query_by_school(student_query, Student).first_or_404()
    
    # Явно загружаем тариф, если он есть
    tariff_name = None
    tariff_price = 500000  # Дефолтная цена
    if student.tariff_id:
        tariff = db.session.get(Tariff, student.tariff_id)
        if tariff:
            tariff_name = tariff.name
            tariff_price = float(tariff.price) if tariff.price else 500000
    elif student.tariff:
        # Если тариф загружен через relationship
        tariff_name = student.tariff.name if student.tariff.name else None
        tariff_price = float(student.tariff.price) if student.tariff.price else 500000
    
    # Получить информацию о группе и расписании
    group_schedule_days = []
    group_schedule_time = None
    if student.group_id:
        # Явно загружаем группу
        group = db.session.get(Group, student.group_id)
        if group:
            group_schedule_days = group.get_schedule_days_list()
            group_schedule_time = group.schedule_time.strftime('%H:%M') if group.schedule_time else None
    
    return jsonify({
        'id': student.id,
        'student_number': student.student_number,
        'school_number': student.school_number,
        'full_name': student.full_name,
        'phone': student.phone,
        'parent_phone': student.parent_phone,
        'balance': calculate_student_balance(student),
        'status': student.status,
        'blacklist_reason': student.blacklist_reason,
        'group_id': student.group_id,
        'tariff_id': student.tariff_id,
        'tariff_name': tariff_name,
        'tariff_price': tariff_price,
        'city': student.city,
        'district': student.district,
        'street': student.street,
        'house_number': student.house_number,
        'birth_year': student.birth_year,
        'passport_series': student.passport_series,
        'passport_number': student.passport_number,
        'passport_issued_by': student.passport_issued_by,
        'passport_issue_date': student.passport_issue_date.isoformat() if student.passport_issue_date else None,
        'passport_expiry_date': student.passport_expiry_date.isoformat() if student.passport_expiry_date else None,
        'admission_date': student.admission_date.isoformat() if student.admission_date else None,
        'club_funded': student.club_funded,
        'telegram_link_code': student.telegram_link_code,
        'telegram_chat_id': student.telegram_chat_id,
        'telegram_notifications_enabled': student.telegram_notifications_enabled,
        'telegram_link_code': student.telegram_link_code,
        'telegram_chat_id': student.telegram_chat_id,
        'telegram_notifications_enabled': student.telegram_notifications_enabled,
        'photo_path': student.photo_path,
        'height': student.height,
        'weight': student.weight,
        'jersey_size': student.jersey_size,
        'shorts_size': student.shorts_size,
        'boots_size': student.boots_size,
        'equipment_notes': student.equipment_notes,
        'group_schedule_days': group_schedule_days,  # Дни недели занятий (1=Пн, 7=Вс)
        'group_schedule_time': group_schedule_time  # Время начала занятия (HH:MM)
    })


@app.route('/api/students/<int:student_id>', methods=['PUT'])
@login_required
def update_student(student_id):
    try:
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first_or_404()
        
        # Определить группу для валидации
        current_group_id = student.group_id
        if 'group_id' in request.form:
            new_group_id = int(request.form['group_id']) if request.form['group_id'] else None
            # Если группа меняется, нужно проверить номер в новой группе
            if new_group_id != current_group_id:
                current_group_id = new_group_id
        
        if 'student_number' in request.form:
            new_student_number = request.form['student_number'].strip()
            if not new_student_number:
                return jsonify({'success': False, 'message': 'Номер ученика не может быть пустым'}), 400
            
            # Валидация номера
            is_valid, error_msg = validate_student_number(new_student_number, current_group_id, exclude_student_id=student.id)
            if not is_valid:
                return jsonify({'success': False, 'message': error_msg}), 400
            
            student.student_number = new_student_number

        # Обновить поля из формы
        if 'full_name' in request.form:
            student.full_name = request.form['full_name']
        if 'school_number' in request.form:
            student.school_number = request.form['school_number'] or None
        if 'phone' in request.form:
            student.phone = request.form['phone'] or None
        if 'parent_phone' in request.form:
            student.parent_phone = request.form['parent_phone'] or None
        if 'status' in request.form:
            student.status = request.form['status']
            if request.form['status'] != 'blacklist':
                student.blacklist_reason = None
        if 'blacklist_reason' in request.form:
            student.blacklist_reason = request.form['blacklist_reason'] or None
        if 'group_id' in request.form:
            new_group_id = int(request.form['group_id']) if request.form['group_id'] else None
            old_group_id = student.group_id
            
            # Проверить, не переполнена ли новая группа (если группа меняется)
            if new_group_id and new_group_id != old_group_id:
                new_group = db.session.get(Group, new_group_id)
                if new_group and new_group.is_full():
                    current_count = new_group.get_current_students_count()
                    return jsonify({
                        'success': False, 
                        'message': f'Группа "{new_group.name}" заполнена ({current_count}/{new_group.max_students})'
                    }), 400
                
                # Если группа меняется, проверить номер в новой группе
                # Если номер занят в новой группе, предложить свободный
                is_valid, error_msg = validate_student_number(student.student_number, new_group_id, exclude_student_id=student.id)
                if not is_valid:
                    # Автоматически назначить свободный номер
                    free_number = get_next_available_student_number(new_group_id)
                    student.student_number = free_number
            
            student.group_id = new_group_id
        if 'tariff_id' in request.form:
            student.tariff_id = int(request.form['tariff_id']) if request.form['tariff_id'] else None
        if 'city' in request.form:
            student.city = request.form['city'] or None
        if 'district' in request.form:
            student.district = request.form['district'] or None
        if 'street' in request.form:
            student.street = request.form['street'] or None
        if 'house_number' in request.form:
            student.house_number = request.form['house_number'] or None
        if 'birth_year' in request.form:
            student.birth_year = int(request.form['birth_year']) if request.form['birth_year'] else None
        if 'passport_series' in request.form:
            student.passport_series = request.form['passport_series'] or None
        if 'passport_number' in request.form:
            student.passport_number = request.form['passport_number'] or None
        if 'passport_issued_by' in request.form:
            student.passport_issued_by = request.form['passport_issued_by'] or None
        if 'passport_issue_date' in request.form and request.form['passport_issue_date']:
            student.passport_issue_date = datetime.strptime(request.form['passport_issue_date'], '%Y-%m-%d').date()
        if 'passport_expiry_date' in request.form and request.form['passport_expiry_date']:
            student.passport_expiry_date = datetime.strptime(request.form['passport_expiry_date'], '%Y-%m-%d').date()
        if 'admission_date' in request.form:
            if request.form['admission_date']:
                try:
                    student.admission_date = datetime.strptime(request.form['admission_date'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'success': False, 'message': 'Некорректная дата принятия'}), 400
            else:
                student.admission_date = None
        
        # Обработать чекбокс club_funded
        student.club_funded = 'club_funded' in request.form and request.form['club_funded'] == 'true'
        
        # Параметры ученика
        if 'height' in request.form:
            student.height = int(request.form['height']) if request.form['height'] else None
        if 'weight' in request.form:
            student.weight = float(request.form['weight']) if request.form['weight'] else None
        if 'jersey_size' in request.form:
            student.jersey_size = request.form['jersey_size'] or None
        if 'shorts_size' in request.form:
            student.shorts_size = request.form['shorts_size'] or None
        if 'boots_size' in request.form:
            student.boots_size = request.form['boots_size'] or None
        if 'equipment_notes' in request.form:
            student.equipment_notes = request.form['equipment_notes'] or None
        
        # Обработать новое фото (если загружено)
        if 'photo' in request.files:
            photo = request.files['photo']
            if photo and photo.filename:
                # Удалить старое фото
                if student.photo_path and os.path.exists(student.photo_path):
                    os.remove(student.photo_path)
                
                # Сохранить новое фото
                filename = secure_filename(photo.filename)
                photo_filename = f"student_{student.id}_{filename}"
                photo_path = os.path.join(UPLOAD_FOLDER, photo_filename)
                photo.save(photo_path)
                student.photo_path = photo_path
                
                # Создать новый face encoding
                try:
                    image = face_recognition.load_image_file(photo_path)
                    encodings = face_recognition.face_encodings(image)
                    if encodings:
                        student.face_encoding = encodings[0].tobytes()
                        reload_face_encodings()
                except Exception as e:
                    print(f"Ошибка обработки фото: {e}")
        
        # Убедиться, что у ученика есть код для Telegram
        ensure_student_has_telegram_code(student)
        
        db.session.commit()
        return jsonify({'success': True})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/students/<int:student_id>', methods=['DELETE'])
@login_required
def delete_student(student_id):
    try:
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first_or_404()
        student_name = student.full_name
        
        # Удалить все связанные записи перед удалением ученика
        # 1. Удалить карточки ученика
        card_query = StudentCard.query.filter_by(student_id=student_id)
        filter_query_by_school(card_query, StudentCard).delete(synchronize_session=False)
        
        # 2. Удалить вознаграждения ученика
        reward_query = StudentReward.query.filter_by(student_id=student_id)
        filter_query_by_school(reward_query, StudentReward).delete(synchronize_session=False)
        
        # 3. Удалить посещаемость ученика
        attendance_query = Attendance.query.filter_by(student_id=student_id)
        filter_query_by_school(attendance_query, Attendance).delete(synchronize_session=False)
        
        # 4. Удалить платежи ученика
        payment_query = Payment.query.filter_by(student_id=student_id)
        filter_query_by_school(payment_query, Payment).delete(synchronize_session=False)
        
        # 5. Удалить фото ученика, если оно есть
        if student.photo_path and os.path.exists(student.photo_path):
            try:
                os.remove(student.photo_path)
            except Exception as photo_error:
                print(f"Ошибка при удалении фото: {photo_error}")
        
        # 6. Теперь можно безопасно удалить самого ученика
        db.session.delete(student)
        db.session.commit()
        
        # Перезагрузить encodings
        reload_face_encodings()
        
        return jsonify({'success': True, 'message': f'Ученик {student_name} удалён'})
    
    except Exception as e:
        db.session.rollback()
        print(f"Ошибка при удалении ученика {student_id}: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== ПЛАТЕЖИ =====

@app.route('/api/payments/add', methods=['POST'])
@login_required
def add_payment():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        tariff_id = data.get('tariff_id')
        amount_paid = float(data.get('amount_paid'))
        amount_due = float(data.get('amount_due', 0))
        lessons_added = int(data.get('lessons_added', 0))
        is_full_payment = data.get('is_full_payment', True)
        notes = data.get('notes', '')
        
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first_or_404()
        tariff_query = Tariff.query.filter_by(id=tariff_id)
        tariff = filter_query_by_school(tariff_query, Tariff).first() if tariff_id else None
        
        # Создать платёж
        payment = Payment(
            student_id=student_id,
            tariff_id=tariff_id,
            amount_paid=amount_paid,
            amount_due=amount_due,
            lessons_added=lessons_added,
            is_full_payment=is_full_payment,
            tariff_name=tariff.name if tariff else None,
            notes=notes,
            created_by=current_user.id
        )
        db.session.add(payment)
        
        # Обновить тип тарифа при полной оплате
        if is_full_payment:
            student.tariff_type = tariff.name if tariff else None
        
        db.session.commit()
        
        # Отправить уведомление в Telegram (для старого метода)
        try:
            from datetime import date
            payment_date = payment.payment_date or date.today()
            payment_month = payment.payment_month if hasattr(payment, 'payment_month') and payment.payment_month else payment_date.month
            payment_year = payment.payment_year if hasattr(payment, 'payment_year') and payment.payment_year else payment_date.year
            month_label = f"{payment_month}/{payment_year}"
            payment_type = getattr(payment, 'payment_type', 'cash') or 'cash'
            
            send_payment_notification(
                student_id=student_id,
                payment_date=payment_date,
                month=month_label,
                payment_type=payment_type,
                amount_paid=amount_paid,
                debt=amount_due if amount_due > 0 else None
            )
        except Exception as e:
            print(f"Ошибка отправки уведомления об оплате: {e}")
            # Не прерываем выполнение, если уведомление не отправилось
        
        return jsonify({
            'success': True, 
            'new_balance': calculate_student_balance(student),
            'is_full_payment': is_full_payment,
            'amount_due': amount_due
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== ПОСЕЩАЕМОСТЬ =====

@app.route('/attendance')
@login_required
def attendance_page():
    return render_template('attendance.html')


@app.route('/api/attendance/checkin', methods=['POST'])
def attendance_checkin():
    """Отметить вход ученика (вызывается из камеры)"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first_or_404()
        today = get_local_date()
        now = get_local_datetime()
        
        # Проверить, был ли уже чекин сегодня
        # Фильтруем через связь со Student, так как Attendance не имеет school_id
        from backend.middleware.school_middleware import is_super_admin
        existing_query = Attendance.query.filter_by(
            student_id=student_id,
            date=today
        )
        if not is_super_admin():
            school_id = get_current_school_id()
            if school_id:
                existing_query = existing_query.join(Student).filter(Student.school_id == school_id)
            else:
                existing_query = existing_query.filter(False)
        existing = existing_query.first()
        
        if existing:
            return jsonify({'success': False, 'message': 'Уже отмечен сегодня'})
        
        # Проверка баланса: пропускаем даже при нуле/минусе, админ решает
        current_balance = calculate_student_balance(student)
        low_balance = (not student.club_funded and current_balance <= 0)
        
        # Определить опоздание
        is_late = False
        late_minutes = 0
        
        if student.group_id:
            group = db.session.get(Group, student.group_id)
            if group and group.schedule_time:
                scheduled_time = datetime.combine(today, group.schedule_time)
                time_diff = (now - scheduled_time).total_seconds() / 60
                
                if time_diff > group.late_threshold:
                    is_late = True
                    late_minutes = int(time_diff)
        
        # Создать запись посещения
        attendance = Attendance(
            student_id=student_id,
            date=today,
            lesson_deducted=not student.club_funded,
            is_late=is_late,
            late_minutes=late_minutes
        )
        db.session.add(attendance)
        
        # Баланс теперь рассчитывается динамически (оплачено занятий - посещено)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'student_name': student.full_name,
            'remaining_balance': calculate_student_balance(student),
            'is_late': is_late,
            'late_minutes': late_minutes,
            'club_funded': student.club_funded,
            'low_balance': low_balance
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/attendance/manual-checkin', methods=['POST'])
@login_required
def manual_checkin():
    """Ручная фиксация посещения ученика (если камера сломалась)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Нет данных в запросе'}), 400
            
        student_id = data.get('student_id')
        year = data.get('year')
        month = data.get('month')
        day = data.get('day')
        
        # Валидация параметров
        if not student_id:
            return jsonify({'success': False, 'message': 'Не указан ID ученика'}), 400
        if not year or not month or not day:
            return jsonify({'success': False, 'message': 'Не указана дата (год, месяц, день)'}), 400
        
        try:
            student_id = int(student_id)
            year = int(year)
            month = int(month)
            day = int(day)
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Некорректные параметры (должны быть числа)'}), 400
        
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first_or_404()
        
        # Создать дату из параметров с валидацией
        try:
            attendance_date = date(year, month, day)
        except ValueError as ve:
            return jsonify({'success': False, 'message': f'Некорректная дата: {str(ve)}'}), 400
            
        now = get_local_datetime()
        
        # Проверить, была ли уже фиксация в этот день
        # Фильтруем через связь со Student, так как Attendance не имеет school_id
        from backend.middleware.school_middleware import is_super_admin
        existing_query = Attendance.query.filter_by(
            student_id=student_id,
            date=attendance_date
        )
        if not is_super_admin():
            school_id = get_current_school_id()
            if school_id:
                existing_query = existing_query.join(Student).filter(Student.school_id == school_id)
            else:
                existing_query = existing_query.filter(False)
        existing = existing_query.first()
        
        if existing:
            return jsonify({'success': False, 'message': 'Уже отмечен в этот день'})
        
        # Определить опоздание (сравниваем с временем начала занятия в указанный день)
        is_late = False
        late_minutes = 0
        
        if student.group_id:
            group = db.session.get(Group, student.group_id)
            if group and group.schedule_time:
                # Время начала занятия в указанный день
                scheduled_time = datetime.combine(attendance_date, group.schedule_time)
                # Текущее время для сравнения
                current_time = now
                
                # Если это прошедший день, считаем что опоздание уже не актуально
                # Но если это сегодня или будущий день, проверяем опоздание
                if attendance_date <= get_local_date():
                    time_diff = (current_time - scheduled_time).total_seconds() / 60
                    
                    if time_diff > group.late_threshold:
                        is_late = True
                        late_minutes = int(time_diff)
        
        # Создать запись посещения
        attendance = Attendance(
            student_id=student_id,
            date=attendance_date,
            lesson_deducted=not student.club_funded,
            is_late=is_late,
            late_minutes=late_minutes
        )
        db.session.add(attendance)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Посещение {student.full_name} зафиксировано',
            'check_in_time': now.isoformat(),
            'is_late': is_late,
            'late_minutes': late_minutes
        })
    
    except Exception as e:
        db.session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"Ошибка ручной фиксации посещения: {error_trace}")
        return jsonify({'success': False, 'message': f'Ошибка: {str(e)}'}), 500


@app.route('/api/attendance/today')
@login_required
def today_attendance():
    """Список присутствующих сегодня (только текущей школы)"""
    from backend.middleware.school_middleware import is_super_admin
    
    today = get_local_date()
    attendance_query = Attendance.query.filter_by(date=today)
    
    # Attendance не имеет school_id, фильтруем через связь со Student
    if not is_super_admin():
        school_id = get_current_school_id()
        if school_id:
            # Фильтруем через JOIN со Student
            attendance_query = attendance_query.join(Student).filter(Student.school_id == school_id)
        else:
            # Если school_id нет, возвращаем пустой результат
            attendance_query = attendance_query.filter(False)
    
    records = attendance_query.all()
    
    result = []
    for record in records:
        photo_url = None
        if record.student.photo_path:
            normalized_path = record.student.photo_path.replace('frontend/static/', '').replace('\\', '/').lstrip('/')
            photo_url = url_for('static', filename=normalized_path)
        group_name = record.student.group.name if record.student.group else 'Без группы'
        student_balance = calculate_student_balance(record.student)
        low_balance = (not record.student.club_funded) and (student_balance <= 0)
        result.append({
            'id': record.id,
            'student_name': record.student.full_name,
            'photo_url': photo_url,
            'group_name': group_name,
            'check_in': record.check_in.strftime('%H:%M'),
            'balance': student_balance,
            'low_balance': low_balance
        })
    
    return jsonify(result)


@app.route('/api/attendance/years')
@login_required
def attendance_years():
    """Возвращает список годов, в которых есть записи посещаемости"""
    from sqlalchemy import extract
    years_query = db.session.query(extract('year', Attendance.check_in).label('year')) \
        .distinct() \
        .order_by(extract('year', Attendance.check_in).desc()) \
        .all()
    years = []
    for item in years_query:
        raw_value = item.year if hasattr(item, 'year') else item[0]
        if raw_value is None:
            continue
        years.append(int(raw_value))
    current_year = get_local_datetime().year
    return jsonify({'years': years, 'current_year': current_year})


@app.route('/api/attendance/all')
@login_required
def all_attendance():
    """Список посещаемости с фильтрами"""
    from sqlalchemy import extract
    
    # Получение параметров фильтров
    year = request.args.get('year')
    month = request.args.get('month')
    group_id = request.args.get('group_id')
    student_id = request.args.get('student_id')
    
    # Базовый запрос
    query = db.session.query(Attendance).join(Student)
    
    # Применение фильтров
    if year:
        query = query.filter(extract('year', Attendance.check_in) == int(year))
    
    if month:
        query = query.filter(extract('month', Attendance.check_in) == int(month))
    
    if student_id:
        query = query.filter(Attendance.student_id == int(student_id))
    
    if group_id:
        query = query.filter(Student.group_id == int(group_id))
    
    # Сортировка по дате (сначала новые)
    records = query.order_by(Attendance.check_in.desc()).all()
    
    result = []
    for record in records:
        result.append({
            'id': record.id,
            'student_id': record.student_id,
            'student_name': record.student.full_name,
            'group_name': record.student.group.name if record.student.group else None,
            'check_in_time': record.check_in.isoformat(),
            'balance': calculate_student_balance(record.student)
        })
    
    return jsonify(result)


@app.route('/api/attendance/analytics', methods=['GET'])
@login_required
def get_attendance_analytics():
    """Аналитика посещаемости"""
    from sqlalchemy import func, extract
    from datetime import date
    
    year = request.args.get('year', type=int)
    if not year:
        year = date.today().year
    
    # Посещаемость по месяцам
    monthly_data = []
    for month in range(1, 13):
        count = db.session.query(func.count(Attendance.id)).filter(
            extract('year', Attendance.check_in) == year,
            extract('month', Attendance.check_in) == month
        ).scalar() or 0
        
        month_names = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 
                      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
        monthly_data.append({
            'month': month,
            'month_name': month_names[month - 1],
            'count': count
        })
    
    # Посещаемость по дням недели (1=Пн, 7=Вс)
    # Получаем все записи за год и группируем по дням недели в Python
    all_attendance = Attendance.query.filter(
        extract('year', Attendance.check_in) == year
    ).all()
    
    weekday_counts = {i: 0 for i in range(1, 8)}  # 1=Пн, 7=Вс
    for att in all_attendance:
        if att.check_in:
            # weekday() возвращает 0=Пн, 6=Вс, конвертируем в 1-7
            weekday = att.check_in.weekday() + 1
            weekday_counts[weekday] = weekday_counts.get(weekday, 0) + 1
    
    weekday_data = [{
        'weekday': weekday,
        'count': weekday_counts[weekday]
    } for weekday in range(1, 8)]
    
    # Посещаемость по группам
    group_stats = db.session.query(
        Group.name.label('group_name'),
        func.count(Attendance.id).label('count')
    ).join(Student, Group.id == Student.group_id)\
     .join(Attendance, Student.id == Attendance.student_id)\
     .filter(extract('year', Attendance.check_in) == year)\
     .group_by(Group.id, Group.name)\
     .all()
    
    groups_data = [{
        'group_name': g.group_name,
        'count': g.count
    } for g in group_stats]
    
    # Статистика опозданий
    total_attendance = db.session.query(func.count(Attendance.id)).filter(
        extract('year', Attendance.check_in) == year
    ).scalar() or 0
    
    total_late = db.session.query(func.count(Attendance.id)).filter(
        extract('year', Attendance.check_in) == year,
        Attendance.is_late == True
    ).scalar() or 0
    
    avg_late = db.session.query(func.avg(Attendance.late_minutes)).filter(
        extract('year', Attendance.check_in) == year,
        Attendance.is_late == True,
        Attendance.late_minutes.isnot(None)
    ).scalar() or 0
    
    late_percentage = round((total_late / total_attendance * 100) if total_attendance > 0 else 0, 1)
    
    return jsonify({
        'monthly': monthly_data,
        'weekdays': weekday_data,
        'groups': groups_data,
        'late_stats': {
            'total_late': total_late,
            'late_percentage': late_percentage,
            'avg_late_minutes': round(avg_late, 1) if avg_late else 0
        }
    })


@app.route('/api/attendance/groups-statistics', methods=['GET'])
@login_required
def get_groups_attendance_statistics():
    """Статистика посещаемости по группам на выбранную дату"""
    from datetime import date, datetime
    
    # Получаем параметры фильтра
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    day = request.args.get('day', type=int)
    
    # Если дата не указана, используем сегодняшнюю
    if not year or not month or not day:
        today = date.today()
        year = year or today.year
        month = month or today.month
        day = day or today.day
    
    selected_date = date(year, month, day)
    weekday = selected_date.weekday() + 1  # 1=Пн, 7=Вс
    
    # Получаем все группы, у которых есть занятия в этот день недели
    all_groups_query = Group.query
    all_groups = filter_query_by_school(all_groups_query, Group).all()
    groups_with_lessons = []
    
    for group in all_groups:
        schedule_days = group.get_schedule_days_list()
        if weekday in schedule_days:
            groups_with_lessons.append(group)
    
    # Получаем всех учеников этих групп и их посещаемость на выбранную дату
    result = []
    
    for group in groups_with_lessons:
        # Получаем всех активных учеников группы
        students_query = Student.query.filter_by(
            group_id=group.id,
            status='active'
        )
        students = filter_query_by_school(students_query, Student).all()
        
        # Получаем посещаемость на выбранную дату
        attendance_records = {}
        attendance_query = Attendance.query.filter_by(date=selected_date).join(Student).filter(
            Student.group_id == group.id
        )
        attendances = filter_query_by_school(attendance_query, Attendance).all()
        
        for att in attendances:
            # Обрабатываем случай, когда check_in может быть None
            check_in_time_iso = None
            if att.check_in:
                check_in_time_iso = att.check_in.isoformat()
            elif att.date:
                # Если check_in отсутствует, но есть date, используем date с временем 00:00:00
                from datetime import datetime, time
                check_in_datetime = datetime.combine(att.date, time.min)
                check_in_time_iso = check_in_datetime.isoformat()
            
            attendance_records[att.student_id] = {
                'id': att.id,  # ID записи посещения для возможности удаления
                'check_in_time': check_in_time_iso,
                'check_in': att.check_in,  # Может быть None, но это нормально
                'is_late': att.is_late if att.is_late else False,
                'late_minutes': att.late_minutes if att.late_minutes else 0
            }
        
        # Формируем список учеников с информацией о посещаемости
        students_list = []
        for student in students:
            attendance = attendance_records.get(student.id)
            
            # Разделяем имя и фамилию
            name_parts = student.full_name.split(' ', 1)
            first_name = name_parts[0] if name_parts else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            check_in_time = None
            check_in_datetime = None
            is_late = False
            late_minutes = 0
            attendance_id = None
            if attendance:
                # Всегда получаем ID записи посещения, если она существует
                attendance_id = attendance.get('id')
                # Получаем время, если оно есть
                if attendance.get('check_in'):
                    check_in_time = attendance['check_in_time']
                    check_in_datetime = attendance['check_in'].isoformat()
                is_late = attendance.get('is_late', False)
                late_minutes = attendance.get('late_minutes', 0)
            
            students_list.append({
                'id': student.id,
                'first_name': first_name,
                'last_name': last_name,
                'full_name': student.full_name,
                'photo_path': student.photo_path,
                'has_attended': attendance is not None,
                'check_in_time': check_in_time,
                'check_in_datetime': check_in_datetime,
                'is_late': is_late,
                'late_minutes': late_minutes,
                'attendance_id': attendance_id  # ID записи посещения для удаления
            })
        
        # Сортируем: сначала те, кто пришел (по времени входа), потом те, кто не пришел
        students_list.sort(key=lambda x: (
            not x['has_attended'],  # False (пришел) идет раньше True (не пришел)
            x['check_in_datetime'] if x['check_in_datetime'] else ''  # По времени входа
        ))
        
        result.append({
            'group_id': group.id,
            'group_name': group.name,
            'schedule_time': group.schedule_time.strftime('%H:%M') if group.schedule_time else None,
            'total_students': len(students_list),
            'attended_count': sum(1 for s in students_list if s['has_attended']),
            'students': students_list
        })
    
    # Сортируем группы по времени занятий
    result.sort(key=lambda x: x['schedule_time'] or '')
    
    return jsonify({
        'date': selected_date.isoformat(),
        'weekday': weekday,
        'groups': result
    })


@app.route('/api/attendance/delete/<int:attendance_id>', methods=['DELETE'])
@login_required
def delete_attendance(attendance_id):
    """Удалить запись посещаемости (только текущей школы)"""
    from backend.middleware.school_middleware import is_super_admin
    
    record = db.session.get(Attendance, attendance_id)
    
    if not record:
        return jsonify({'success': False, 'message': 'Запись не найдена'}), 404
    
    # Проверяем, что запись принадлежит текущей школе (через Student)
    if not is_super_admin():
        school_id = get_current_school_id()
        if not school_id or record.student.school_id != school_id:
            return jsonify({'success': False, 'message': 'У вас нет доступа к этой записи'}), 403
    
    student = record.student
    
    db.session.delete(record)
    db.session.commit()
    
    # Баланс пересчитывается автоматически после удаления посещения
    return jsonify({
        'success': True,
        'message': f'Запись удалена, баланс {student.full_name}: {calculate_student_balance(student)}'
    })


# ===== РАСХОДЫ =====

@app.route('/expenses')
@login_required
def expenses_page():
    if current_user.role not in ['admin', 'financier']:
        return redirect(url_for('dashboard'))
    
    expenses = Expense.query.order_by(Expense.expense_date.desc()).limit(50).all()
    return render_template('expenses.html', expenses=expenses)


@app.route('/api/expenses/add', methods=['POST'])
@login_required
def add_expense():
    if current_user.role not in ['admin', 'financier']:
        return jsonify({'success': False, 'message': 'Нет доступа'}), 403
    
    try:
        data = request.get_json()
        expense = Expense(
            category=data.get('category'),
            amount=float(data.get('amount')),
            description=data.get('description'),
            created_by=current_user.id
        )
        ensure_school_id(expense)
        db.session.add(expense)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    if current_user.role not in ['admin', 'financier']:
        return jsonify({'success': False, 'message': 'Нет доступа'}), 403

    try:
        data = request.get_json() or {}
        expense_query = Expense.query.filter_by(id=expense_id)
        expense = filter_query_by_school(expense_query, Expense).first()
        if not expense:
            return jsonify({'success': False, 'message': 'Расход не найден'}), 404

        if 'category' in data:
            expense.category = data.get('category')
        if 'amount' in data:
            expense.amount = float(data.get('amount'))
        if 'description' in data:
            expense.description = data.get('description')

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    """Удалить расход"""
    if current_user.role not in ['admin', 'financier']:
        return jsonify({'success': False, 'message': 'Нет доступа'}), 403

    try:
        expense_query = Expense.query.filter_by(id=expense_id)
        expense = filter_query_by_school(expense_query, Expense).first()
        if not expense:
            return jsonify({'success': False, 'message': 'Расход не найден'}), 404

        db.session.delete(expense)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Расход удалён'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== ФИНАНСЫ =====

@app.route('/finances')
@login_required
def finances_page():
    """Страница финансов"""
    return render_template('finances.html')


@app.route('/settings')
@login_required
def club_settings_page():
    """Страница настроек клуба"""
    if getattr(current_user, 'role', None) not in ['admin', 'financier']:
        return redirect(url_for('dashboard'))
    return render_template('settings.html')


def is_super_admin():
    """Проверка, является ли текущий пользователь суперадмином"""
    return isinstance(current_user, SuperAdmin) or (hasattr(current_user, 'role') and current_user.role == 'super_admin')


@app.route('/schools')
@login_required
def schools_page():
    """Страница управления школами (только для супер-админа)"""
    if not is_super_admin():
        return redirect(url_for('dashboard'))
    return render_template('schools.html')


# ===== МОБИЛЬНАЯ ВЕРСИЯ ДЛЯ ОПЛАТ =====

@app.route('/mobile-payments')
@login_required
def mobile_payments():
    """Мобильная страница для добавления оплат"""
    if current_user.role not in ['payment_admin', 'admin']:
        return redirect(url_for('dashboard'))
    return render_template('mobile_payment.html')


@app.route('/mobile-payment-history')
@login_required
def mobile_payment_history():
    """История оплат для мобильной версии"""
    if current_user.role not in ['payment_admin', 'admin']:
        return redirect(url_for('dashboard'))
    return render_template('mobile_payment_history.html')


@app.route('/api/mobile/payment-history', methods=['GET'])
@login_required
def get_mobile_payment_history():
    """Получить историю оплат для мобильной версии"""
    if current_user.role not in ['payment_admin', 'admin']:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    school_id = get_current_school_id()
    
    # Получить все оплаты текущей школы, отсортированные по дате
    payments_query = db.session.query(
        Payment.id,
        Payment.student_id,
        Payment.amount_paid,
        Payment.payment_date,
        Payment.payment_month,
        Payment.payment_year,
        Payment.notes,
        Payment.created_by,
        Student.full_name.label('student_name')
    ).join(Student)
    
    if school_id:
        payments_query = payments_query.filter(Student.school_id == school_id)
    
    payments = payments_query.order_by(Payment.payment_date.desc()).limit(100).all()
    
    result = []
    for p in payments:
        result.append({
            'id': p.id,
            'student_id': p.student_id,
            'student_name': p.student_name,
            'amount_paid': p.amount_paid,
            'payment_date': p.payment_date.isoformat(),
            'payment_month': p.payment_month,
            'payment_year': p.payment_year,
            'notes': p.notes,
            'created_by': p.created_by
        })
    
    return jsonify(result)


# ===== МОБИЛЬНАЯ ВЕРСИЯ ДЛЯ УЧИТЕЛЯ =====

@app.route('/teacher-attendance')
@login_required
def teacher_attendance():
    """Мобильная страница переклички для учителя"""
    if current_user.role not in ['teacher', 'admin']:
        return redirect(url_for('dashboard'))
    return render_template('teacher_attendance.html')


@app.route('/api/teacher/mark-attendance', methods=['POST'])
@login_required
def teacher_mark_attendance():
    """Отметить посещаемость ученика"""
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    try:
        data = request.json
        student_id = data.get('student_id')
        status = data.get('status')  # 'present', 'absent', 'late'
        date_str = data.get('date')
        
        if not all([student_id, status, date_str]):
            return jsonify({'error': 'Недостаточно данных'}), 400
        
        # Проверить, существует ли уже запись на сегодня
        attendance_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        existing_query = Attendance.query.filter_by(
            student_id=student_id,
            date=attendance_date
        )
        existing = filter_query_by_school(existing_query, Attendance).first()
        
        if existing:
            # Обновить существующую запись
            existing.status = status
            existing.check_in_time = datetime.now().time() if status == 'present' else None
        else:
            # Создать новую запись
            attendance = Attendance(
                student_id=student_id,
                date=attendance_date,
                status=status,
                check_in_time=datetime.now().time() if status == 'present' else None
            )
            db.session.add(attendance)
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Статус сохранен'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/teacher/today-attendance', methods=['GET'])
@login_required
def teacher_today_attendance():
    """Получить сегодняшнюю посещаемость для группы учителя"""
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    # Получить group_id учителя
    group_id = current_user.group_id if current_user.role == 'teacher' else request.args.get('group_id', type=int)
    
    if not group_id:
        return jsonify({'error': 'Группа не указана'}), 400
    
    today = date.today()
    
    # Получить сегодняшнюю посещаемость
    attendance_query = Attendance.query.filter_by(date=today)
    attendance_records = filter_query_by_school(attendance_query, Attendance).all()
    
    result = {}
    for record in attendance_records:
        if record.student and record.student.group_id == group_id:
            result[record.student_id] = {
                'status': record.status,
                'check_in_time': record.check_in_time.strftime('%H:%M') if record.check_in_time else None
            }
    
    return jsonify(result)


@app.route('/api/finances/income', methods=['GET'])
@login_required
def get_income_stats():
    """Статистика прихода"""
    from datetime import date
    from sqlalchemy import func, extract
    
    today = date.today()
    school_id = get_current_school_id()
    
    # Базовый запрос с фильтрацией по школе через Student
    base_query = db.session.query(Payment).join(Student, Payment.student_id == Student.id)
    if school_id:
        base_query = base_query.filter(Student.school_id == school_id)
    
    # Сегодня
    income_today_query = base_query.filter(func.date(Payment.payment_date) == today)
    income_today = db.session.query(func.sum(Payment.amount_paid)).select_from(income_today_query.subquery()).scalar() or 0
    
    # Этот месяц
    income_month_query = base_query.filter(
        extract('year', Payment.payment_date) == today.year,
        extract('month', Payment.payment_date) == today.month
    )
    income_month = db.session.query(func.sum(Payment.amount_paid)).select_from(income_month_query.subquery()).scalar() or 0
    
    # Всего
    income_total = db.session.query(func.sum(Payment.amount_paid)).select_from(base_query.subquery()).scalar() or 0
    
    # Последние платежи
    payments_query = db.session.query(
        Payment,
        Student.full_name.label('student_name'),
        Student.group_id.label('group_id'),
        Student.tariff_id.label('student_tariff_id'),
        Group.name.label('group_name'),
        Tariff.name.label('student_tariff_name')
    ).join(Student, Payment.student_id == Student.id, isouter=True) \
     .join(Group, Student.group_id == Group.id, isouter=True) \
     .join(Tariff, Student.tariff_id == Tariff.id, isouter=True)
    
    if school_id:
        payments_query = payments_query.filter(Student.school_id == school_id)
    
    payments = payments_query.order_by(Payment.payment_date.desc()).limit(50).all()
    
    payments_list = [{
        'id': p.Payment.id,
        'payment_date': p.Payment.payment_date.isoformat(),
        'student_id': p.Payment.student_id,
        'student_name': p.student_name,
        'group_id': p.group_id,
        'group_name': p.group_name,
        'tariff_name': p.Payment.tariff_name or p.student_tariff_name or '-',
        'amount_paid': p.Payment.amount_paid,
        'amount_due': p.Payment.amount_due,
        'is_full_payment': p.Payment.is_full_payment,
        'payment_type': getattr(p.Payment, 'payment_type', 'cash') or 'cash',
        'notes': p.Payment.notes
    } for p in payments]
    
    return jsonify({
        'today': income_today,
        'month': income_month,
        'total': income_total,
        'payments': payments_list
    })


@app.route('/api/finances/debtors', methods=['GET'])
@login_required
def get_debtors():
    """Список должников с помесячной детализацией"""
    from datetime import date, datetime
    from sqlalchemy import func, extract
    
    school_id = get_current_school_id()
    
    # Получить всех активных учеников с тарифами текущей школы
    students_query = Student.query.filter(
        Student.status == 'active',
        Student.tariff_id.isnot(None)
    )
    students = filter_query_by_school(students_query, Student).all()
    
    current_year = date.today().year
    current_month = date.today().month
    
    debtors_list = []
    total_debt = 0
    
    for student in students:
        if not student.tariff:
            continue
            
        tariff_price = float(student.tariff.price)
        
        # Определить с какого месяца начинать проверку
        if student.admission_date:
            start_year = student.admission_date.year
            start_month = student.admission_date.month
        else:
            start_year = current_year
            start_month = 1
        
        # Проверить каждый месяц от даты принятия до текущего месяца
        year = start_year
        month = start_month
        
        while (year < current_year) or (year == current_year and month <= current_month):
            month_key = f"{year}-{str(month).zfill(2)}"
            
            # Получить платежи за этот месяц
            month_payments_query = Payment.query.filter(
                Payment.student_id == student.id,
                Payment.payment_year == year,
                Payment.payment_month == month
            )
            month_payments = filter_query_by_school(month_payments_query, Payment).all()
            
            total_paid = sum(p.amount_paid for p in month_payments)
            debt = max(0, tariff_price - total_paid)
            
            if debt > 0:
                total_debt += debt
                debtors_list.append({
                    'student_id': student.id,
                    'student_name': student.full_name,
                    'student_phone': student.phone or student.parent_phone or '-',
                    'tariff_name': student.tariff.name,
                    'tariff_price': tariff_price,
                    'amount_paid': total_paid,
                    'amount_due': debt,
                    'month': month,
                    'year': year,
                    'month_label': f"{month}/{year}"
                })
            
            # Следующий месяц
            month += 1
            if month > 12:
                month = 1
                year += 1
    
    return jsonify({
        'total_debt': total_debt,
        'count': len(debtors_list),
        'debtors': debtors_list
    })


@app.route('/api/finances/expenses', methods=['GET'])
@login_required
def get_expense_stats():
    """Статистика расходов"""
    from datetime import date
    from sqlalchemy import func, extract
    
    today = date.today()
    school_id = get_current_school_id()
    
    # Базовый запрос с фильтрацией по школе
    expenses_query = Expense.query
    if school_id:
        expenses_query = expenses_query.filter(Expense.school_id == school_id)
    
    # Сегодня
    expense_today = expenses_query.filter(func.date(Expense.expense_date) == today).with_entities(func.sum(Expense.amount)).scalar() or 0
    
    # Этот месяц
    expense_month = expenses_query.filter(
        extract('year', Expense.expense_date) == today.year,
        extract('month', Expense.expense_date) == today.month
    ).with_entities(func.sum(Expense.amount)).scalar() or 0
    
    # Всего
    expense_total = expenses_query.with_entities(func.sum(Expense.amount)).scalar() or 0
    
    # Последние расходы
    expenses = expenses_query.order_by(Expense.expense_date.desc()).limit(50).all()
    
    expenses_list = [{
        'id': e.id,
        'expense_date': e.expense_date.isoformat(),
        'category': e.category,
        'amount': e.amount,
        'description': e.description
    } for e in expenses]
    
    return jsonify({
        'today': expense_today,
        'month': expense_month,
        'total': expense_total,
        'expenses': expenses_list
    })


@app.route('/api/finances/analytics', methods=['GET'])
@login_required
def get_analytics():
    """Аналитика по месяцам"""
    from sqlalchemy import func, extract
    from datetime import datetime, date
    
    school_id = get_current_school_id()
    
    # Получить данные за последние 12 месяцев
    months_data = []
    
    for i in range(11, -1, -1):
        target_date = date.today().replace(day=1)
        month = target_date.month - i
        year = target_date.year
        
        if month <= 0:
            month += 12
            year -= 1
        
        # Приход за месяц (фильтруем по школе через Student)
        income_query = db.session.query(Payment).join(Student, Payment.student_id == Student.id).filter(
            extract('year', Payment.payment_date) == year,
            extract('month', Payment.payment_date) == month
        )
        if school_id:
            income_query = income_query.filter(Student.school_id == school_id)
        income = db.session.query(func.sum(Payment.amount_paid)).select_from(income_query.subquery()).scalar() or 0
        
        # Расход за месяц (фильтруем по школе)
        expense_query = db.session.query(Expense).filter(
            extract('year', Expense.expense_date) == year,
            extract('month', Expense.expense_date) == month
        )
        if school_id:
            expense_query = expense_query.filter(Expense.school_id == school_id)
        expense = db.session.query(func.sum(Expense.amount)).select_from(expense_query.subquery()).scalar() or 0
        
        # Название месяца
        month_names = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 
                      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
        month_name = f"{month_names[month - 1]} {year}"
        
        months_data.append({
            'month_name': month_name,
            'income': income,
            'expense': expense
        })
    
    return jsonify({'months': months_data})


@app.route('/api/finances/monthly', methods=['GET'])
@login_required
def get_finances_monthly():
    """Данные по месяцам: приход, расход, остаток (приход - расход)"""
    from sqlalchemy import func, extract
    from datetime import date

    # Получаем год из параметра запроса или используем текущий
    year = request.args.get('year', type=int)
    if not year:
        year = date.today().year

    school_id = get_current_school_id()

    months = []
    # Последовательность месяцев: январь..декабрь выбранного года
    for month in range(1, 12 + 1):
        # Приход за месяц (фильтруем по школе через Student)
        income_query = db.session.query(Payment).join(Student, Payment.student_id == Student.id).filter(
            extract('year', Payment.payment_date) == year,
            extract('month', Payment.payment_date) == month
        )
        if school_id:
            income_query = income_query.filter(Student.school_id == school_id)
        income = db.session.query(func.sum(Payment.amount_paid)).select_from(income_query.subquery()).scalar() or 0
        
        # Расход за месяц (фильтруем по школе)
        expense_query = db.session.query(Expense).filter(
            extract('year', Expense.expense_date) == year,
            extract('month', Expense.expense_date) == month
        )
        if school_id:
            expense_query = expense_query.filter(Expense.school_id == school_id)
        expense = db.session.query(func.sum(Expense.amount)).select_from(expense_query.subquery()).scalar() or 0
        balance = float(income) - float(expense)
        months.append({
            'income': float(income),
            'expense': float(expense),
            'balance': balance
        })

    return jsonify({'months': months})


# ===== ГРУППЫ =====

@app.route('/api/groups', methods=['GET'])
@login_required
def get_groups():
    """Получить список всех групп"""
    groups_query = Group.query
    groups = filter_query_by_school(groups_query, Group).all()
    return jsonify([{
        'id': g.id,
        'name': g.name,
        'schedule_time': g.schedule_time.strftime('%H:%M') if g.schedule_time else '--:--',
        'duration_minutes': g.duration_minutes or 60,
        'field_blocks': g.field_blocks or 1,
        'field_block_indices': g.get_field_block_indices(),
        'late_threshold': g.late_threshold,
        'max_students': g.max_students,
        'notes': g.notes,
        'schedule_days': g.get_schedule_days_list(),
        'schedule_days_label': g.get_schedule_days_display(),
        'student_count': len(g.students),
        'active_student_count': g.get_current_students_count(),
        'is_full': g.is_full()
    } for g in groups])


@app.route('/api/club-settings', methods=['GET'])
@login_required
def get_club_settings():
    """Получить настройки клуба для текущей школы"""
    try:
        # Используем единую функцию для получения school_id
        school_id = get_current_school_id()
        
        if not school_id:
            # Если школа не выбрана, возвращаем дефолтные настройки вместо ошибки
            return jsonify({
                'system_name': 'FK QORASUV',
                'working_days': [1, 2, 3, 4, 5],
                'work_start_time': '09:00',
                'work_end_time': '21:00',
                'max_groups_per_slot': 4,
                'block_future_payments': False,
                'rewards_reset_period_months': 1,
                'podium_display_count': 20,
                'telegram_bot_token': '',
                'telegram_notification_template': '',
                'telegram_reward_template': '',
                'telegram_card_template': '',
                'telegram_payment_template': ''
            })
        
        settings = get_club_settings_instance()
        if not settings:
            # Если настроек нет, возвращаем пустые значения
            return jsonify({
                'system_name': 'FK QORASUV',
                'working_days': [],
                'work_start_time': '09:00',
                'work_end_time': '21:00',
                'max_groups_per_slot': 1,
                'block_future_payments': False,
                'rewards_reset_period_months': 1,
                'podium_display_count': 20,
                'telegram_bot_token': '',
                'telegram_notification_template': '',
                'telegram_reward_template': '',
                'telegram_card_template': '',
                'telegram_payment_template': ''
            })
        
        return jsonify({
            'system_name': settings.system_name or 'FK QORASUV',
            'working_days': settings.get_working_days_list() if settings.working_days else [],
            'work_start_time': settings.work_start_time.strftime('%H:%M') if settings.work_start_time else '09:00',
            'work_end_time': settings.work_end_time.strftime('%H:%M') if settings.work_end_time else '21:00',
            'max_groups_per_slot': settings.max_groups_per_slot or 1,
            'block_future_payments': bool(getattr(settings, 'block_future_payments', False)),
            'rewards_reset_period_months': getattr(settings, 'rewards_reset_period_months', 1),
            'podium_display_count': getattr(settings, 'podium_display_count', 20),
            'telegram_bot_token': getattr(settings, 'telegram_bot_token', '') or '',
            'telegram_notification_template': getattr(settings, 'telegram_notification_template', '') or '',
            'telegram_reward_template': getattr(settings, 'telegram_reward_template', '') or '',
            'telegram_card_template': getattr(settings, 'telegram_card_template', '') or '',
            'telegram_payment_template': getattr(settings, 'telegram_payment_template', '') or ''
        })
    except Exception as e:
        print(f"[ERROR] Error in get_club_settings: {e}")
        import traceback
        traceback.print_exc()
        # Возвращаем дефолтные настройки при ошибке
        return jsonify({
            'system_name': 'FK QORASUV',
            'working_days': [1, 2, 3, 4, 5],
            'work_start_time': '09:00',
            'work_end_time': '21:00',
            'max_groups_per_slot': 4,
            'block_future_payments': False,
            'rewards_reset_period_months': 1,
            'podium_display_count': 20,
            'telegram_bot_token': '',
            'telegram_notification_template': '',
            'telegram_reward_template': '',
            'telegram_card_template': '',
            'telegram_payment_template': ''
        })


@app.route('/api/club-settings', methods=['PUT'])
@login_required
def update_club_settings():
    """Обновить настройки клуба для текущей школы"""
    # Используем единую функцию для получения school_id
    school_id = get_current_school_id()
    
    if not school_id:
        # Если школа не найдена, проверяем у текущего пользователя напрямую
        if current_user.is_authenticated and hasattr(current_user, 'school_id') and current_user.school_id:
            # Пользователь привязан к школе, но она не установлена в сессии/контексте
            school = School.query.get(current_user.school_id)
            if school and school.is_active:
                school_id = current_user.school_id
                # Устанавливаем в сессию и контекст
                from backend.utils.school_utils import set_current_school
                set_current_school(school_id)
                from flask import g
                g.current_school_id = school_id
            else:
                return jsonify({'success': False, 'message': 'Ваша школа деактивирована. Обратитесь к администратору.'}), 400
        else:
            return jsonify({'success': False, 'message': 'Вы не привязаны к школе. Обратитесь к администратору для привязки к школе.'}), 400
    
    try:
        data = request.get_json()
        system_name = (data.get('system_name') or '').strip() or 'FK QORASUV'
        working_days = parse_days_list(data.get('working_days'))
        work_start_time = datetime.strptime(data.get('work_start_time'), '%H:%M').time()
        work_end_time = datetime.strptime(data.get('work_end_time'), '%H:%M').time()
        max_groups_per_slot = int(data.get('max_groups_per_slot', 1))
        block_future_payments = bool(data.get('block_future_payments', False))
        rewards_reset_period_months = int(data.get('rewards_reset_period_months', 1))
        podium_display_count = int(data.get('podium_display_count', 20))
        telegram_bot_token = (data.get('telegram_bot_token') or '').strip()
        telegram_notification_template = (data.get('telegram_notification_template') or '').strip()
        telegram_reward_template = (data.get('telegram_reward_template') or '').strip()
        telegram_card_template = (data.get('telegram_card_template') or '').strip()
        telegram_payment_template = (data.get('telegram_payment_template') or '').strip()

        if not working_days:
            return jsonify({'success': False, 'message': 'Выберите рабочие дни'}), 400
        if work_end_time <= work_start_time:
            return jsonify({'success': False, 'message': 'Время окончания должно быть позже начала'}), 400
        if max_groups_per_slot <= 0:
            return jsonify({'success': False, 'message': 'Вместимость должна быть положительной'}), 400
        if rewards_reset_period_months < 1 or rewards_reset_period_months > 12:
            return jsonify({'success': False, 'message': 'Период сброса вознаграждений должен быть от 1 до 12 месяцев'}), 400
        if podium_display_count < 5 or podium_display_count > 50 or podium_display_count % 5 != 0:
            return jsonify({'success': False, 'message': 'Отображение пьедестала должно быть от 5 до 50 учеников с шагом 5'}), 400

        # Получаем настройки ТОЛЬКО для текущей школы
        settings = ClubSettings.query.filter_by(school_id=school_id).first()
        if not settings:
            # Создаем новые настройки для текущей школы
            settings = ClubSettings(school_id=school_id)
            db.session.add(settings)
        
        # Обновляем настройки
        settings.system_name = system_name
        settings.set_working_days_list(working_days)
        settings.work_start_time = work_start_time
        settings.work_end_time = work_end_time
        settings.max_groups_per_slot = max_groups_per_slot
        settings.block_future_payments = block_future_payments
        settings.rewards_reset_period_months = rewards_reset_period_months
        settings.podium_display_count = podium_display_count
        settings.telegram_bot_token = telegram_bot_token if telegram_bot_token else None
        settings.telegram_notification_template = telegram_notification_template if telegram_notification_template else None
        settings.telegram_reward_template = telegram_reward_template if telegram_reward_template else None
        settings.telegram_card_template = telegram_card_template if telegram_card_template else None
        settings.telegram_payment_template = telegram_payment_template if telegram_payment_template else None
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/groups/add', methods=['POST'])
@login_required
def add_group():
    """Добавить новую группу"""
    try:
        data = request.get_json()
        name = data.get('name')
        schedule_time_str = data.get('schedule_time')  # "13:00"
        duration_minutes = int(data.get('duration_minutes', 60))
        # Количество блоков (на случай старых клиентов)
        field_blocks = int(data.get('field_blocks', 1))
        # Индексы блоков, которые занимает группа
        field_block_indices = data.get('field_block_indices') or []
        late_threshold = int(data.get('late_threshold', 15))
        max_students = data.get('max_students')
        if max_students:
            max_students = int(max_students)
        notes = data.get('notes', '')
        schedule_days = parse_days_list(data.get('schedule_days'))
        if not schedule_time_str:
            return jsonify({'success': False, 'message': 'Укажите время занятия'}), 400
        if not schedule_days:
            return jsonify({'success': False, 'message': 'Выберите дни недели'}), 400
        
        # Парсинг времени
        schedule_time = datetime.strptime(schedule_time_str, '%H:%M').time()
        is_valid, error_message = validate_group_schedule(schedule_time, schedule_days)
        if not is_valid:
            return jsonify({'success': False, 'message': error_message}), 400
        
        group = Group(
            name=name,
            schedule_time=schedule_time,
            duration_minutes=duration_minutes,
            late_threshold=late_threshold,
            max_students=max_students,
            notes=notes
        )
        # Если передали конкретные индексы блоков — используем их,
        # иначе считаем, что заняты первые field_blocks блока
        if field_block_indices:
            group.set_field_block_indices(field_block_indices)
        else:
            group.set_field_block_indices(list(range(field_blocks)))
        group.set_schedule_days_list(schedule_days)
        
        # Установить school_id автоматически
        ensure_school_id(group)
        
        db.session.add(group)
        db.session.commit()
        
        return jsonify({'success': True, 'group_id': group.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/groups/<int:group_id>', methods=['PUT'])
@login_required
def update_group(group_id):
    """Обновить группу"""
    try:
        group_query = Group.query.filter_by(id=group_id)
        group = filter_query_by_school(group_query, Group).first()
        if not group:
            return jsonify({'success': False, 'message': 'Группа не найдена'}), 404
        
        data = request.get_json()
        new_schedule_time = group.schedule_time
        new_schedule_days = group.get_schedule_days_list()
        if 'name' in data:
            group.name = data['name']
        if 'duration_minutes' in data:
            group.duration_minutes = int(data['duration_minutes'])
        # Обновление блоков поля
        if 'field_block_indices' in data:
            # Если пришёл массив индексов — сохраняем его
            group.set_field_block_indices(data['field_block_indices'])
        elif 'field_blocks' in data:
            # Старый формат: только количество блоков
            count = int(data['field_blocks'])
            group.set_field_block_indices(list(range(count)))
        if 'schedule_time' in data:
            new_schedule_time = datetime.strptime(data['schedule_time'], '%H:%M').time()
        if 'late_threshold' in data:
            group.late_threshold = int(data['late_threshold'])
        if 'max_students' in data:
            max_students = data['max_students']
            group.max_students = int(max_students) if max_students else None
        if 'notes' in data:
            group.notes = data['notes']
        if 'schedule_days' in data:
            new_schedule_days = parse_days_list(data['schedule_days'])
        needs_validation = ('schedule_time' in data) or ('schedule_days' in data) or not new_schedule_days
        if needs_validation:
            effective_days = new_schedule_days or group.get_schedule_days_list()
            if not effective_days:
                effective_days = get_club_settings_instance().get_working_days_list()
            is_valid, error_message = validate_group_schedule(new_schedule_time, effective_days, exclude_group_id=group.id)
            if not is_valid:
                return jsonify({'success': False, 'message': error_message}), 400
            if not new_schedule_days:
                new_schedule_days = effective_days
        if new_schedule_days:
            group.set_schedule_days_list(new_schedule_days)
        group.schedule_time = new_schedule_time
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
@login_required
def delete_group(group_id):
    """Удалить группу"""
    try:
        group_query = Group.query.filter_by(id=group_id)
        group = filter_query_by_school(group_query, Group).first()
        if not group:
            return jsonify({'success': False, 'message': 'Группа не найдена'}), 404
        
        # Переводим всех учеников группы в состояние "без группы"
        for student in group.students:
            student.group_id = None
        
        db.session.delete(group)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== ТАРИФЫ =====

@app.route('/tariffs')
@login_required
def tariffs_page():
    return render_template('tariffs.html')


@app.route('/api/tariffs', methods=['GET'])
@login_required
def get_tariffs():
    """Получить список всех тарифов"""
    tariffs_query = Tariff.query.filter_by(is_active=True).order_by(Tariff.lessons_count)
    tariffs = filter_query_by_school(tariffs_query, Tariff).all()
    return jsonify([{
        'id': t.id,
        'name': t.name,
        'lessons_count': t.lessons_count,
        'price': t.price,
        'description': t.description,
        'price_per_lesson': round(t.price / t.lessons_count, 2) if t.lessons_count > 0 else 0
    } for t in tariffs])


@app.route('/api/tariffs/add', methods=['POST'])
@login_required
def add_tariff():
    """Добавить новый тариф"""
    try:
        data = request.get_json()
        name = data.get('name')
        lessons_count = int(data.get('lessons_count'))
        price = float(data.get('price'))
        description = data.get('description', '')
        
        tariff = Tariff(
            name=name,
            lessons_count=lessons_count,
            price=price,
            description=description
        )
        ensure_school_id(tariff)
        db.session.add(tariff)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/tariffs/<int:tariff_id>', methods=['PUT'])
@login_required
def update_tariff(tariff_id):
    """Обновить тариф"""
    try:
        tariff_query = Tariff.query.filter_by(id=tariff_id)
        tariff = filter_query_by_school(tariff_query, Tariff).first()
        if not tariff:
            return jsonify({'success': False, 'message': 'Тариф не найден'}), 404
        
        data = request.get_json()
        if 'name' in data:
            tariff.name = data['name']
        if 'lessons_count' in data:
            tariff.lessons_count = int(data['lessons_count'])
        if 'price' in data:
            tariff.price = float(data['price'])
        if 'description' in data:
            tariff.description = data['description']
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/tariffs/<int:tariff_id>', methods=['DELETE'])
@login_required
def delete_tariff(tariff_id):
    """Удалить (деактивировать) тариф"""
    try:
        tariff_query = Tariff.query.filter_by(id=tariff_id)
        tariff = filter_query_by_school(tariff_query, Tariff).first()
        if not tariff:
            return jsonify({'success': False, 'message': 'Тариф не найден'}), 404
        
        # Не удаляем физически, а деактивируем
        tariff.is_active = False
        db.session.commit()
        
        return jsonify({'success': True, 'message': f'Тариф "{tariff.name}" деактивирован'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== ВОЗНАГРАЖДЕНИЯ =====

@app.route('/rewards')
@login_required
def rewards_page():
    """Страница управления вознаграждениями"""
    if current_user.role != 'admin':
        return redirect(url_for('dashboard'))
    return render_template('rewards.html')


@app.route('/api/rewards', methods=['GET'])
@login_required
def get_rewards():
    """Получить список всех типов вознаграждений"""
    if current_user.role != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    rewards = RewardType.query.order_by(RewardType.created_at.desc()).all()
    return jsonify([{
        'id': r.id,
        'name': r.name,
        'points': r.points,
        'description': r.description or '',
        'created_at': r.created_at.isoformat() if r.created_at else None,
        'updated_at': r.updated_at.isoformat() if r.updated_at else None
    } for r in rewards])


@app.route('/api/rewards/add', methods=['POST'])
@login_required
def add_reward():
    """Добавить новый тип вознаграждения"""
    if current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        points = int(data.get('points', 1))
        description = data.get('description', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': 'Название вознаграждения не может быть пустым'}), 400
        
        if points < 1:
            return jsonify({'success': False, 'message': 'Количество баллов должно быть больше 0'}), 400
        
        reward = RewardType(
            name=name,
            points=points,
            description=description if description else None
        )
        
        db.session.add(reward)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Вознаграждение добавлено',
            'reward': {
                'id': reward.id,
                'name': reward.name,
                'points': reward.points,
                'description': reward.description or ''
            }
        })
    except ValueError:
        return jsonify({'success': False, 'message': 'Некорректное количество баллов'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/rewards/<int:reward_id>', methods=['PUT'])
@login_required
def update_reward(reward_id):
    """Обновить тип вознаграждения"""
    if current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        reward = db.session.get(RewardType, reward_id)
        if not reward:
            return jsonify({'success': False, 'message': 'Вознаграждение не найдено'}), 404
        
        data = request.get_json()
        if 'name' in data:
            name = data['name'].strip()
            if not name:
                return jsonify({'success': False, 'message': 'Название вознаграждения не может быть пустым'}), 400
            reward.name = name
        
        if 'points' in data:
            points = int(data['points'])
            if points < 1:
                return jsonify({'success': False, 'message': 'Количество баллов должно быть больше 0'}), 400
            reward.points = points
        
        if 'description' in data:
            reward.description = data['description'].strip() if data['description'].strip() else None
        
        reward.updated_at = get_local_datetime()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Вознаграждение обновлено',
            'reward': {
                'id': reward.id,
                'name': reward.name,
                'points': reward.points,
                'description': reward.description or ''
            }
        })
    except ValueError:
        return jsonify({'success': False, 'message': 'Некорректное количество баллов'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/rewards/<int:reward_id>', methods=['DELETE'])
@login_required
def delete_reward(reward_id):
    """Удалить тип вознаграждения"""
    if current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        reward = db.session.get(RewardType, reward_id)
        if not reward:
            return jsonify({'success': False, 'message': 'Вознаграждение не найдено'}), 404
        
        reward_name = reward.name
        db.session.delete(reward)
        db.session.commit()
        
        return jsonify({'success': True, 'message': f'Вознаграждение "{reward_name}" удалено'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== ВЫДАЧА ВОЗНАГРАЖДЕНИЙ УЧЕНИКАМ =====

@app.route('/api/students/<int:student_id>/rewards', methods=['POST'])
@login_required
def issue_reward(student_id):
    """Выдать вознаграждение ученику"""
    if current_user.role not in ['admin', 'teacher']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.get_json()
        reward_type_id = int(data.get('reward_type_id'))
        
        student = db.session.get(Student, student_id)
        if not student:
            return jsonify({'success': False, 'message': 'Ученик не найден'}), 404
        
        reward_type = db.session.get(RewardType, reward_type_id)
        if not reward_type:
            return jsonify({'success': False, 'message': 'Тип вознаграждения не найден'}), 404
        
        from datetime import date
        current_date = date.today()
        
        # Создать запись о выдаче вознаграждения
        student_reward = StudentReward(
            student_id=student_id,
            reward_type_id=reward_type_id,
            points=reward_type.points,
            reward_name=reward_type.name,
            issued_by=current_user.id,
            month=current_date.month,
            year=current_date.year
        )
        
        db.session.add(student_reward)
        db.session.commit()
        
        # Подсчитать общее количество баллов за текущий месяц
        total_points = get_student_points_sum(student_id, current_date.month, current_date.year)
        
        # Отправить уведомление в Telegram
        reason = data.get('reason', '').strip()
        try:
            send_reward_notification(
                student_id=student_id,
                reward_name=reward_type.name,
                points=reward_type.points,
                total_points=total_points,
                reason=reason
            )
        except Exception as e:
            print(f"Ошибка отправки уведомления о вознаграждении: {e}")
            # Не прерываем выполнение, если уведомление не отправилось
        
        return jsonify({
            'success': True,
            'message': f'Вознаграждение "{reward_type.name}" выдано (+{reward_type.points} баллов)',
            'total_points': total_points
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/students/<int:student_id>/rewards', methods=['GET'])
@login_required
def get_student_rewards(student_id):
    """Получить историю вознаграждений ученика"""
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        all_history = request.args.get('all', type=bool, default=False)
        
        from datetime import date
        if all_history:
            # Вернуть всю историю для вкладки истории
            rewards_query = StudentReward.query.filter_by(
                student_id=student_id
            ).order_by(StudentReward.issued_at.desc())
            rewards = filter_query_by_school(rewards_query, StudentReward).all()
        elif not month or not year:
            # По умолчанию - текущий месяц
            current_date = date.today()
            month = current_date.month
            year = current_date.year
            rewards_query = StudentReward.query.filter_by(
                student_id=student_id,
                month=month,
                year=year
            ).order_by(StudentReward.issued_at.desc())
            rewards = filter_query_by_school(rewards_query, StudentReward).all()
        else:
            # Конкретный месяц и год
            rewards_query = StudentReward.query.filter_by(
                student_id=student_id,
                month=month,
                year=year
            ).order_by(StudentReward.issued_at.desc())
            rewards = filter_query_by_school(rewards_query, StudentReward).all()
        
        result = []
        for r in rewards:
            # Проверяем is_deleted через прямой запрос к БД, если поле существует
            is_deleted = False
            deleted_at = None
            try:
                inspector = db.inspect(db.engine)
                columns = {col['name'] for col in inspector.get_columns('student_rewards')}
                if 'is_deleted' in columns:
                    result_row = db.session.execute(
                        db.text("SELECT is_deleted, deleted_at FROM student_rewards WHERE id = :id"),
                        {'id': r.id}
                    ).fetchone()
                    if result_row:
                        is_deleted = bool(result_row[0]) if result_row[0] is not None else False
                        deleted_at = result_row[1].isoformat() if result_row[1] else None
            except:
                pass
            
            # Альтернативная проверка через префикс
            if not is_deleted and r.reward_name and r.reward_name.startswith('[УДАЛЕНО] '):
                is_deleted = True
            
            result.append({
                'id': r.id,
                'reward_name': r.reward_name.replace('[УДАЛЕНО] ', '') if r.reward_name.startswith('[УДАЛЕНО] ') else r.reward_name,
                'points': r.points,
                'issued_at': r.issued_at.isoformat() if r.issued_at else None,
                'issuer_name': r.issuer.username if r.issuer else 'Система',
                'is_deleted': is_deleted,
                'deleted_at': deleted_at
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/students/<int:student_id>/points', methods=['GET'])
@login_required
def get_student_points(student_id):
    """Получить общее количество баллов ученика за текущий месяц"""
    try:
        from datetime import date
        current_date = date.today()
        
        total_points = get_student_points_sum(student_id, current_date.month, current_date.year)
        
        return jsonify({'points': total_points})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== КАРТОЧКИ УЧЕНИКОВ =====

@app.route('/api/card-types', methods=['GET'])
@login_required
def get_card_types():
    """Получить список всех типов карточек"""
    try:
        # Проверить, есть ли типы карточек, если нет - создать
        card_types = CardType.query.order_by(CardType.id.asc()).all()
        if not card_types:
            # Автоматически создать типы карточек при первом запросе
            default_types = [
                CardType(name='Желтая', color='yellow', description='Предупреждение'),
                CardType(name='Красная', color='red', description='Удаление с поля'),
                CardType(name='Оранжевая', color='orange', description='Серьезное нарушение'),
                CardType(name='Синяя', color='blue', description='Замечание'),
                CardType(name='Зеленая', color='green', description='Положительное поведение')
            ]
            for card_type in default_types:
                db.session.add(card_type)
            db.session.commit()
            card_types = CardType.query.order_by(CardType.id.asc()).all()
        
        return jsonify([{
            'id': ct.id,
            'name': ct.name,
            'color': ct.color,
            'description': ct.description or ''
        } for ct in card_types])
    except Exception as e:
        # Если ошибка из-за отсутствия таблицы, создать её
        try:
            db.create_all()
            # Попробовать снова создать типы
            default_types = [
                CardType(name='Желтая', color='yellow', description='Предупреждение'),
                CardType(name='Красная', color='red', description='Удаление с поля'),
                CardType(name='Оранжевая', color='orange', description='Серьезное нарушение'),
                CardType(name='Синяя', color='blue', description='Замечание'),
                CardType(name='Зеленая', color='green', description='Положительное поведение')
            ]
            for card_type in default_types:
                db.session.add(card_type)
            db.session.commit()
            card_types = CardType.query.order_by(CardType.id.asc()).all()
            return jsonify([{
                'id': ct.id,
                'name': ct.name,
                'color': ct.color,
                'description': ct.description or ''
            } for ct in card_types])
        except Exception as e2:
            return jsonify({'error': str(e2)}), 500


@app.route('/api/students/<int:student_id>/cards', methods=['GET'])
@login_required
def get_student_cards(student_id):
    """Получить активные карточки ученика"""
    try:
        cards_query = StudentCard.query.filter_by(
            student_id=student_id,
            is_active=True
        ).order_by(StudentCard.issued_at.desc())
        active_cards = filter_query_by_school(cards_query, StudentCard).all()
        
        return jsonify([{
            'id': card.id,
            'card_type_id': card.card_type_id,
            'card_type_name': card.card_type.name,
            'card_type_color': card.card_type.color,
            'reason': card.reason,
            'issued_at': card.issued_at.isoformat() if card.issued_at else None,
            'issued_by': card.issuer_user.username if card.issuer_user else 'Система'
        } for card in active_cards])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/students/<int:student_id>/cards/history', methods=['GET'])
@login_required
def get_student_cards_history(student_id):
    """Получить всю историю карточек ученика"""
    try:
        cards_query = StudentCard.query.filter_by(
            student_id=student_id
        ).order_by(StudentCard.issued_at.desc())
        all_cards = filter_query_by_school(cards_query, StudentCard).all()
        
        result = []
        for card in all_cards:
            # Проверяем is_deleted через прямой запрос к БД, если поле существует
            is_deleted = False
            deleted_at = None
            try:
                inspector = db.inspect(db.engine)
                columns = {col['name'] for col in inspector.get_columns('student_cards')}
                if 'is_deleted' in columns:
                    result_row = db.session.execute(
                        db.text("SELECT is_deleted, deleted_at FROM student_cards WHERE id = :id"),
                        {'id': card.id}
                    ).fetchone()
                    if result_row:
                        is_deleted = bool(result_row[0]) if result_row[0] is not None else False
                        deleted_at = result_row[1].isoformat() if result_row[1] else None
            except:
                pass
            
            # Альтернативная проверка через префикс
            if not is_deleted and card.reason and card.reason.startswith('[УДАЛЕНО] '):
                is_deleted = True
            
            result.append({
                'id': card.id,
                'card_type_id': card.card_type_id,
                'card_type_name': card.card_type.name,
                'card_type_color': card.card_type.color,
                'reason': card.reason.replace('[УДАЛЕНО] ', '') if card.reason.startswith('[УДАЛЕНО] ') else card.reason,
                'issued_at': card.issued_at.isoformat() if card.issued_at else None,
                'issued_by': card.issuer_user.username if card.issuer_user else 'Система',
                'removed_at': card.removed_at.isoformat() if card.removed_at else None,
                'removed_by': card.remover_user.username if card.remover_user else None,
                'is_active': card.is_active,
                'is_deleted': is_deleted,
                'deleted_at': deleted_at
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/students/<int:student_id>/cards', methods=['POST'])
@login_required
def issue_card(student_id):
    """Выдать карточку ученику"""
    if current_user.role not in ['admin', 'teacher']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.get_json()
        card_type_id = int(data.get('card_type_id'))
        reason = data.get('reason', '').strip()
        
        if not reason:
            return jsonify({'success': False, 'message': 'Укажите причину выдачи карточки'}), 400
        
        student = db.session.get(Student, student_id)
        if not student:
            return jsonify({'success': False, 'message': 'Ученик не найден'}), 404
        
        card_type = db.session.get(CardType, card_type_id)
        if not card_type:
            return jsonify({'success': False, 'message': 'Тип карточки не найден'}), 404
        
        # Создать запись о выдаче карточки
        student_card = StudentCard(
            student_id=student_id,
            card_type_id=card_type_id,
            reason=reason,
            issued_by=current_user.id,
            is_active=True
        )
        
        db.session.add(student_card)
        db.session.commit()
        
        # Отправить уведомление в Telegram
        try:
            send_card_notification(
                student_id=student_id,
                card_name=card_type.name,
                reason=reason
            )
        except Exception as e:
            print(f"Ошибка отправки уведомления о карточке: {e}")
            # Не прерываем выполнение, если уведомление не отправилось
        
        return jsonify({
            'success': True,
            'message': f'Карточка "{card_type.name}" выдана',
            'card': {
                'id': student_card.id,
                'card_type_id': card_type.id,
                'card_type_name': card_type.name,
                'card_type_color': card_type.color,
                'reason': reason
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/students/<int:student_id>/cards/<int:card_id>/remove', methods=['POST'])
@login_required
def remove_card(student_id, card_id):
    """Снять карточку с ученика"""
    if current_user.role not in ['admin', 'teacher']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        student_card = db.session.get(StudentCard, card_id)
        if not student_card or student_card.student_id != student_id:
            return jsonify({'success': False, 'message': 'Карточка не найдена'}), 404
        
        if not student_card.is_active:
            return jsonify({'success': False, 'message': 'Карточка уже снята'}), 400
        
        student_card.is_active = False
        student_card.removed_at = get_local_datetime()
        student_card.removed_by = current_user.id
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Карточка снята'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


def ensure_deleted_columns():
    """Добавить колонки is_deleted и deleted_at в таблицы student_rewards и student_cards если их нет"""
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'student_rewards' in tables:
            columns = {col['name'] for col in inspector.get_columns('student_rewards')}
            if 'is_deleted' not in columns:
                try:
                    db.session.execute(db.text("ALTER TABLE student_rewards ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE"))
                    db.session.commit()
                    print("✓ Добавлена колонка is_deleted в student_rewards")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении is_deleted в student_rewards: {e}")
            
            if 'deleted_at' not in columns:
                try:
                    db.session.execute(db.text("ALTER TABLE student_rewards ADD COLUMN deleted_at TIMESTAMP"))
                    db.session.commit()
                    print("✓ Добавлена колонка deleted_at в student_rewards")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении deleted_at в student_rewards: {e}")
        
        if 'student_cards' in tables:
            columns = {col['name'] for col in inspector.get_columns('student_cards')}
            if 'is_deleted' not in columns:
                try:
                    db.session.execute(db.text("ALTER TABLE student_cards ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE"))
                    db.session.commit()
                    print("✓ Добавлена колонка is_deleted в student_cards")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении is_deleted в student_cards: {e}")
            
            if 'deleted_at' not in columns:
                try:
                    db.session.execute(db.text("ALTER TABLE student_cards ADD COLUMN deleted_at TIMESTAMP"))
                    db.session.commit()
                    print("✓ Добавлена колонка deleted_at в student_cards")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Ошибка при добавлении deleted_at в student_cards: {e}")
    except Exception as e:
        print(f"Ошибка при проверке колонок удаления: {e}")


def get_student_points_sum(student_id, month=None, year=None):
    """Подсчитать сумму очков ученика за указанный месяц/год с учетом удаленных вознаграждений"""
    try:
        from datetime import date
        if month is None or year is None:
            current_date = date.today()
            month = month or current_date.month
            year = year or current_date.year
        
        # Проверить наличие колонки is_deleted
        inspector = db.inspect(db.engine)
        columns = {col['name'] for col in inspector.get_columns('student_rewards')}
        
        if 'is_deleted' in columns:
            # Использовать SQL запрос с фильтром is_deleted
            result = db.session.execute(
                db.text("""
                    SELECT COALESCE(SUM(points), 0) 
                    FROM student_rewards 
                    WHERE student_id = :student_id 
                    AND month = :month 
                    AND year = :year 
                    AND (is_deleted = 0 OR is_deleted IS NULL)
                """),
                {'student_id': student_id, 'month': month, 'year': year}
            ).scalar()
            return result or 0
        else:
            # Если колонки нет, использовать обычный запрос, но исключить записи с префиксом [УДАЛЕНО]
            total_points = db.session.query(func.sum(StudentReward.points)).filter(
                StudentReward.student_id == student_id,
                StudentReward.month == month,
                StudentReward.year == year,
                ~StudentReward.reward_name.like('[УДАЛЕНО]%')
            ).scalar() or 0
            return total_points
    except Exception as e:
        print(f"Ошибка при подсчете очков ученика {student_id}: {e}")
        # В случае ошибки вернуть 0 или попробовать базовый запрос
        try:
            total_points = db.session.query(func.sum(StudentReward.points)).filter(
                StudentReward.student_id == student_id,
                StudentReward.month == month,
                StudentReward.year == year
            ).scalar() or 0
            return total_points
        except:
            return 0


@app.route('/api/students/<int:student_id>/rewards/<int:reward_id>/delete', methods=['POST'])
@login_required
def delete_student_reward(student_id, reward_id):
    """Удалить вознаграждение (пометить как удаленное)"""
    if current_user.role not in ['admin', 'teacher']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        ensure_deleted_columns()
        reward_query = StudentReward.query.filter_by(id=reward_id, student_id=student_id)
        reward = filter_query_by_school(reward_query, StudentReward).first()
        if not reward:
            return jsonify({'success': False, 'message': 'Вознаграждение не найдено'}), 404
        
        # Пометить как удаленное (мягкое удаление)
        # Используем прямой SQL-запрос для надежности
        inspector = db.inspect(db.engine)
        columns = {col['name'] for col in inspector.get_columns('student_rewards')}
        
        updated = False
        if 'deleted_at' in columns and 'is_deleted' in columns:
            try:
                db.session.execute(
                    db.text("UPDATE student_rewards SET is_deleted = 1, deleted_at = :deleted_at WHERE id = :id"),
                    {'deleted_at': get_local_datetime(), 'id': reward_id}
                )
                db.session.commit()
                updated = True
                print(f"✓ Вознаграждение {reward_id} помечено как удаленное через SQL (с deleted_at)")
            except Exception as sql_error:
                print(f"Ошибка SQL при удалении вознаграждения (с deleted_at): {sql_error}")
                db.session.rollback()
        
        if not updated and 'is_deleted' in columns:
            try:
                db.session.execute(
                    db.text("UPDATE student_rewards SET is_deleted = 1 WHERE id = :id"),
                    {'id': reward_id}
                )
                db.session.commit()
                updated = True
                print(f"✓ Вознаграждение {reward_id} помечено как удаленное через SQL (только is_deleted)")
            except Exception as sql_error:
                print(f"Ошибка SQL при удалении вознаграждения (только is_deleted): {sql_error}")
                db.session.rollback()
        
        if not updated:
            # Альтернативный способ - префикс в названии
            reward = StudentReward.query.filter_by(id=reward_id, student_id=student_id).first()
            if reward and not reward.reward_name.startswith('[УДАЛЕНО] '):
                reward.reward_name = f"[УДАЛЕНО] {reward.reward_name}"
                db.session.commit()
                updated = True
                print(f"✓ Вознаграждение {reward_id} помечено как удаленное через префикс")
        
        return jsonify({
            'success': True,
            'message': 'Вознаграждение удалено'
        })
    except Exception as e:
        db.session.rollback()
        print(f"Ошибка при удалении вознаграждения {reward_id}: {e}")
        return jsonify({'success': False, 'message': f'Ошибка при удалении: {str(e)}'}), 500


@app.route('/api/students/<int:student_id>/cards/<int:card_id>/delete', methods=['POST'])
@login_required
def delete_student_card(student_id, card_id):
    """Удалить карточку (пометить как удаленную)"""
    if current_user.role not in ['admin', 'teacher']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        ensure_deleted_columns()
        card_query = StudentCard.query.filter_by(id=card_id, student_id=student_id)
        card = filter_query_by_school(card_query, StudentCard).first()
        if not card:
            return jsonify({'success': False, 'message': 'Карточка не найдена'}), 404
        
        # Пометить как удаленную (мягкое удаление)
        # Используем прямой SQL-запрос для надежности
        inspector = db.inspect(db.engine)
        columns = {col['name'] for col in inspector.get_columns('student_cards')}
        
        if 'deleted_at' in columns and 'is_deleted' in columns:
            db.session.execute(
                db.text("UPDATE student_cards SET is_deleted = 1, deleted_at = :deleted_at WHERE id = :id"),
                {'deleted_at': get_local_datetime(), 'id': card_id}
            )
        elif 'is_deleted' in columns:
            db.session.execute(
                db.text("UPDATE student_cards SET is_deleted = 1 WHERE id = :id"),
                {'id': card_id}
            )
        else:
            # Альтернативный способ - префикс в reason
            card.reason = f"[УДАЛЕНО] {card.reason}"
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Карточка удалена'
        })
    except Exception as e:
        db.session.rollback()
        # Если колонки не существуют, попробуем альтернативный способ
        try:
            card = StudentCard.query.filter_by(id=card_id, student_id=student_id).first()
            if card:
                # Используем reason для пометки
                card.reason = f"[УДАЛЕНО] {card.reason}"
                db.session.commit()
                return jsonify({
                    'success': True,
                    'message': 'Карточка удалена'
                })
        except:
            pass
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== РЕЙТИНГ УЧЕНИКОВ =====

@app.route('/rating')
@login_required
def rating_page():
    """Страница рейтинга учеников"""
    return render_template('rating.html')


@app.route('/api/rating/<int:group_id>', methods=['GET'])
@login_required
def get_group_rating(group_id):
    """Получить рейтинг учеников группы за текущий месяц"""
    try:
        from datetime import date
        current_date = date.today()
        
        # Получить настройки для количества мест в пьедестале
        settings = get_club_settings_instance()
        podium_count = getattr(settings, 'podium_display_count', 20)
        
        # Подсчитать баллы для всех учеников группы за текущий месяц
        students_query = Student.query.filter_by(group_id=group_id, status='active')
        students = filter_query_by_school(students_query, Student).all()
        
        rating_data = []
        for student in students:
            total_points = get_student_points_sum(student.id, current_date.month, current_date.year)
            
            if total_points > 0:  # Показываем только тех, у кого есть баллы
                rating_data.append({
                    'student_id': student.id,
                    'full_name': student.full_name,
                    'photo_path': student.photo_path,
                    'points': total_points
                })
        
        # Сортировать по убыванию баллов и взять топ N
        rating_data.sort(key=lambda x: x['points'], reverse=True)
        rating_data = rating_data[:podium_count]
        
        return jsonify({
            'rating': rating_data,
            'month': current_date.month,
            'year': current_date.year
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/rating/all-groups', methods=['GET'])
@login_required
def get_all_groups_rating():
    """Получить рейтинг всех групп за текущий месяц"""
    try:
        from datetime import date
        current_date = date.today()
        
        # Получить настройки для количества мест в пьедестале
        settings = get_club_settings_instance()
        podium_count = getattr(settings, 'podium_display_count', 20)
        
        # Получить все группы текущей школы
        groups_query = Group.query
        groups = filter_query_by_school(groups_query, Group).all()
        
        result = []
        for group in groups:
            # Подсчитать баллы для всех учеников группы за текущий месяц
            students_query = Student.query.filter_by(group_id=group.id, status='active')
            students = filter_query_by_school(students_query, Student).all()
            
            rating_data = []
            for student in students:
                total_points = get_student_points_sum(student.id, current_date.month, current_date.year)
                
                if total_points > 0:  # Показываем только тех, у кого есть баллы
                    rating_data.append({
                        'student_id': student.id,
                        'full_name': student.full_name,
                        'photo_path': student.photo_path,
                        'points': total_points
                    })
            
            # Сортировать по убыванию баллов и взять топ N
            rating_data.sort(key=lambda x: x['points'], reverse=True)
            rating_data = rating_data[:podium_count]
            
            result.append({
                'group_id': group.id,
                'group_name': group.name,
                'rating': rating_data
            })
        
        return jsonify({
            'groups': result,
            'month': current_date.month,
            'year': current_date.year
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/rating/winners-history', methods=['GET'])
@login_required
def get_winners_history():
    """Получить историю победителей (1 место) по месяцам для всех групп"""
    try:
        year = request.args.get('year', type=int)
        from datetime import date
        if not year:
            year = date.today().year
        
        # Получить все группы текущей школы
        groups_query = Group.query
        groups = filter_query_by_school(groups_query, Group).all()
        
        result = {}
        
        for group in groups:
            group_winners = []
            
            # Для каждого месяца года
            for month in range(1, 13):
                # Подсчитать баллы для всех учеников группы за этот месяц
                students_query = Student.query.filter_by(group_id=group.id, status='active')
                students = filter_query_by_school(students_query, Student).all()
                
                monthly_rating = []
                for student in students:
                    total_points = get_student_points_sum(student.id, month, year)
                    
                    if total_points > 0:
                        monthly_rating.append({
                            'student_id': student.id,
                            'full_name': student.full_name,
                            'photo_path': student.photo_path,
                            'points': total_points
                        })
                
                # Найти топ-3 учеников
                if monthly_rating:
                    monthly_rating.sort(key=lambda x: x['points'], reverse=True)
                    top_three = monthly_rating[:3]  # Берем топ-3
                    
                    group_winners.append({
                        'month': month,
                        'students': top_three
                    })
                else:
                    # Нет данных за этот месяц
                    group_winners.append({
                        'month': month,
                        'students': [],
                        'is_empty': True
                    })
            
            result[group.id] = {
                'group_id': group.id,
                'group_name': group.name,
                'winners': group_winners
            }
        
        return jsonify({
            'year': year,
            'groups': list(result.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== ЛОКАЦИИ =====

@app.route('/api/locations/cities', methods=['GET'])
def get_cities_list():
    """Получить список городов"""
    return jsonify(get_cities())


@app.route('/api/locations/districts/<city>', methods=['GET'])
def get_districts_list(city):
    """Получить список районов для города"""
    return jsonify(get_districts(city))


# ===== РАСПОЗНАВАНИЕ ЛИЦ =====

@app.route('/camera')
@login_required
def camera_page():
    """Страница с камерой для распознавания"""
    # Перезагрузить encodings для текущей школы при загрузке страницы
    reload_face_encodings()
    return render_template('camera.html')


@app.route('/users')
@login_required
def users_page():
    """Страница управления пользователями"""
    # Проверка прав доступа
    if not current_user.has_permission('users', 'view'):
        return redirect(url_for('dashboard'))
    return render_template('users.html')


# ===== API ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ =====

@app.route('/api/users', methods=['GET'])
@login_required
def get_users():
    """Получить список пользователей текущей школы"""
    if not current_user.has_permission('users', 'view'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    # Суперадмин видит всех пользователей всех школ
    # Обычные админы школ видят только пользователей своей школы
    from backend.middleware.school_middleware import is_super_admin
    if is_super_admin():
        # Для суперадмина - все пользователи
        users_query = User.query
    else:
        # Для обычных пользователей - только пользователи их школы
        users_query = User.query
        users_query = filter_query_by_school(users_query, User)
    
    users = users_query.all()
    users_list = []
    for user in users:
        role_name = user.role_obj.name if user.role_obj else user.role
        users_list.append({
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'role': user.role,
            'role_id': user.role_id,
            'role_name': role_name,
            'is_active': user.is_active,
            'created_at': user.created_at.isoformat() if user.created_at else None
        })
    
    return jsonify(users_list)


@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    """Создать нового пользователя для текущей школы"""
    if not current_user.has_permission('users', 'edit'):
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        full_name = data.get('full_name', '').strip()
        role_id = data.get('role_id')
        is_active = data.get('is_active', True)
        
        if not username:
            return jsonify({'success': False, 'message': 'Введите имя пользователя'}), 400
        
        if not password or len(password) < 4:
            return jsonify({'success': False, 'message': 'Пароль должен быть не менее 4 символов'}), 400
        
        # Получаем school_id для текущего пользователя
        school_id = get_current_school_id()
        if not school_id:
            return jsonify({'success': False, 'message': 'Школа не выбрана'}), 400
        
        # Проверка уникальности имени пользователя в рамках школы
        existing_user = User.query.filter_by(username=username, school_id=school_id).first()
        if existing_user:
            return jsonify({'success': False, 'message': 'Пользователь с таким именем уже существует в вашей школе'}), 400
        
        # Создание пользователя
        user = User(
            username=username,
            password_hash=bcrypt.generate_password_hash(password).decode('utf-8'),
            full_name=full_name,
            role_id=role_id,
            role='custom' if role_id else 'admin',  # Для обратной совместимости
            is_active=is_active,
            school_id=school_id  # Привязываем к текущей школе
        )
        
        # Убеждаемся, что school_id установлен
        ensure_school_id(user, school_id)
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Пользователь успешно создан',
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'role_id': user.role_id
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """Обновить пользователя (только своей школы)"""
    if not current_user.has_permission('users', 'edit'):
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        # Получаем пользователя с проверкой school_id
        from backend.middleware.school_middleware import is_super_admin
        if is_super_admin():
            # Суперадмин может редактировать любого пользователя
            user = db.session.get(User, user_id)
        else:
            # Обычные админы могут редактировать только пользователей своей школы
            school_id = get_current_school_id()
            if not school_id:
                return jsonify({'success': False, 'message': 'Школа не выбрана'}), 400
            
            user_query = User.query.filter_by(id=user_id)
            user = filter_query_by_school(user_query, User).first()
        
        if not user:
            return jsonify({'success': False, 'message': 'Пользователь не найден или у вас нет доступа к нему'}), 404
        
        data = request.json
        username = data.get('username')
        password = data.get('password')
        full_name = data.get('full_name')
        role_id = data.get('role_id')
        is_active = data.get('is_active')
        
        # Получаем school_id для проверки уникальности
        school_id = user.school_id if hasattr(user, 'school_id') else get_current_school_id()
        
        if username and username != user.username:
            # Проверка уникальности в рамках школы
            existing_user = User.query.filter_by(username=username, school_id=school_id).first()
            if existing_user:
                return jsonify({'success': False, 'message': 'Пользователь с таким именем уже существует в вашей школе'}), 400
            user.username = username
        
        if password:
            if len(password) < 4:
                return jsonify({'success': False, 'message': 'Пароль должен быть не менее 4 символов'}), 400
            user.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        
        if full_name is not None:
            user.full_name = full_name
        
        if role_id is not None:
            user.role_id = role_id
            if role_id:
                user.role = 'custom'
        
        if is_active is not None:
            user.is_active = is_active
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Пользователь успешно обновлен'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """Удалить пользователя (только своей школы)"""
    if not current_user.has_permission('users', 'edit'):
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        # Получаем пользователя с проверкой school_id
        from backend.middleware.school_middleware import is_super_admin
        if is_super_admin():
            # Суперадмин может удалять любого пользователя
            user = db.session.get(User, user_id)
        else:
            # Обычные админы могут удалять только пользователей своей школы
            school_id = get_current_school_id()
            if not school_id:
                return jsonify({'success': False, 'message': 'Школа не выбрана'}), 400
            
            user_query = User.query.filter_by(id=user_id)
            user = filter_query_by_school(user_query, User).first()
        
        if not user:
            return jsonify({'success': False, 'message': 'Пользователь не найден или у вас нет доступа к нему'}), 404
        
        # Нельзя удалить самого себя
        if user.id == current_user.id:
            return jsonify({'success': False, 'message': 'Нельзя удалить самого себя'}), 400
        
        # Нельзя удалить последнего администратора в школе
        if user.role == 'admin':
            school_id = user.school_id if hasattr(user, 'school_id') else get_current_school_id()
            admin_query = User.query.filter_by(role='admin', school_id=school_id)
            admin_count = filter_query_by_school(admin_query, User).count()
            if admin_count <= 1:
                return jsonify({'success': False, 'message': 'Нельзя удалить последнего администратора'}), 400
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Пользователь успешно удален'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== API ДЛЯ УПРАВЛЕНИЯ РОЛЯМИ =====

@app.route('/api/roles', methods=['GET'])
@login_required
def get_roles():
    """Получить список всех ролей с правами доступа"""
    if not current_user.has_permission('users', 'view'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    roles = Role.query.all()
    roles_list = []
    for role in roles:
        permissions_dict = {}
        for perm in role.permissions:
            permissions_dict[perm.section] = {
                'can_view': perm.can_view,
                'can_edit': perm.can_edit
            }
        
        roles_list.append({
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'permissions': permissions_dict,
            'users_count': len(role.users)
        })
    
    return jsonify(roles_list)


@app.route('/api/roles', methods=['POST'])
@login_required
def create_role():
    """Создать новую роль"""
    if not current_user.has_permission('users', 'edit'):
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.json
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        permissions = data.get('permissions', {})
        
        if not name:
            return jsonify({'success': False, 'message': 'Введите название роли'}), 400
        
        # Проверка уникальности
        if Role.query.filter_by(name=name).first():
            return jsonify({'success': False, 'message': 'Роль с таким названием уже существует'}), 400
        
        # Создание роли
        role = Role(name=name, description=description)
        db.session.add(role)
        db.session.flush()  # Получить ID роли
        
        # Добавление прав доступа
        sections = ['dashboard', 'students', 'groups', 'tariffs', 'finances', 'attendance', 'camera', 'rewards', 'rating', 'users', 'cash']
        for section in sections:
            perm_data = permissions.get(section, {})
            permission = RolePermission(
                role_id=role.id,
                section=section,
                can_view=perm_data.get('can_view', False),
                can_edit=perm_data.get('can_edit', False)
            )
            db.session.add(permission)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Роль успешно создана',
            'role': {
                'id': role.id,
                'name': role.name
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/roles/<int:role_id>', methods=['PUT'])
@login_required
def update_role(role_id):
    """Обновить роль и её права доступа"""
    if not current_user.has_permission('users', 'edit'):
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        role = db.session.get(Role, role_id)
        if not role:
            return jsonify({'success': False, 'message': 'Роль не найдена'}), 404
        
        data = request.json
        name = data.get('name')
        description = data.get('description')
        permissions = data.get('permissions')
        
        if name and name != role.name:
            if Role.query.filter_by(name=name).first():
                return jsonify({'success': False, 'message': 'Роль с таким названием уже существует'}), 400
            role.name = name
        
        if description is not None:
            role.description = description
        
        # Обновление прав доступа
        if permissions:
            sections = ['dashboard', 'students', 'groups', 'tariffs', 'finances', 'attendance', 'camera', 'rewards', 'rating', 'users', 'cash']
            for section in sections:
                perm_data = permissions.get(section, {})
                permission = RolePermission.query.filter_by(role_id=role.id, section=section).first()
                
                if permission:
                    permission.can_view = perm_data.get('can_view', False)
                    permission.can_edit = perm_data.get('can_edit', False)
                else:
                    permission = RolePermission(
                        role_id=role.id,
                        section=section,
                        can_view=perm_data.get('can_view', False),
                        can_edit=perm_data.get('can_edit', False)
                    )
                    db.session.add(permission)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Роль успешно обновлена'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/roles/<int:role_id>', methods=['DELETE'])
@login_required
def delete_role(role_id):
    """Удалить роль"""
    if not current_user.has_permission('users', 'edit'):
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        role = db.session.get(Role, role_id)
        if not role:
            return jsonify({'success': False, 'message': 'Роль не найдена'}), 404
        
        # Проверка, используется ли роль
        if len(role.users) > 0:
            return jsonify({'success': False, 'message': 'Роль используется пользователями. Сначала измените роли пользователей'}), 400
        
        db.session.delete(role)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Роль успешно удалена'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/cash')
@login_required
def cash_page():
    """Страница управления кассой - редирект на finances с вкладкой cash"""
    ensure_cash_transfers_table()
    return redirect(url_for('finances_page') + '#cash')


@app.route('/api/cash/balance', methods=['GET'])
@login_required
def get_cash_balance():
    """Получить остаток кассы (приход - расход - переданные средства) для текущей школы"""
    ensure_cash_transfers_table()
    from datetime import date
    from sqlalchemy import func
    from backend.middleware.school_middleware import is_super_admin
    
    school_id = get_current_school_id()
    
    # Общий приход (фильтруем по школе через Student)
    if is_super_admin():
        total_income = db.session.query(func.sum(Payment.amount_paid)).scalar() or 0
    else:
        if school_id:
            income_query = db.session.query(Payment).join(Student, Payment.student_id == Student.id).filter(Student.school_id == school_id)
            total_income = db.session.query(func.sum(Payment.amount_paid)).select_from(income_query.subquery()).scalar() or 0
        else:
            total_income = 0
    
    # Общий расход (фильтруем по школе)
    if is_super_admin():
        total_expenses = db.session.query(func.sum(Expense.amount)).scalar() or 0
    else:
        if school_id:
            expense_query = Expense.query.filter_by(school_id=school_id)
            total_expenses = db.session.query(func.sum(Expense.amount)).select_from(expense_query.subquery()).scalar() or 0
        else:
            total_expenses = 0
    
    # Общая сумма переданных средств (фильтруем по школе)
    if is_super_admin():
        total_transferred = db.session.query(func.sum(CashTransfer.amount)).scalar() or 0
    else:
        if school_id:
            transfer_query = CashTransfer.query.filter_by(school_id=school_id)
            total_transferred = db.session.query(func.sum(CashTransfer.amount)).select_from(transfer_query.subquery()).scalar() or 0
        else:
            total_transferred = 0
    
    # Остаток
    balance = total_income - total_expenses - total_transferred
    
    return jsonify({
        'balance': balance,
        'total_income': total_income,
        'total_expenses': total_expenses,
        'total_transferred': total_transferred
    })


@app.route('/api/cash/transfers', methods=['GET'])
@login_required
def get_cash_transfers():
    """Получить список передач денег управляющему (только текущей школы)"""
    try:
        ensure_cash_transfers_table()
        from datetime import datetime
        from backend.middleware.school_middleware import is_super_admin
        
        # Получить параметры фильтрации
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        recipient = request.args.get('recipient')
        
        query = CashTransfer.query
        
        # Фильтрация по школе
        if not is_super_admin():
            school_id = get_current_school_id()
            if school_id:
                query = query.filter(CashTransfer.school_id == school_id)
            else:
                query = query.filter(False)  # Если школы нет, возвращаем пустой результат
        
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d')
                query = query.filter(CashTransfer.transfer_date >= date_from_obj)
            except:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d')
                query = query.filter(CashTransfer.transfer_date <= date_to_obj)
            except:
                pass
        
        if recipient:
            query = query.filter(CashTransfer.recipient.ilike(f'%{recipient}%'))
        
        transfers = query.order_by(CashTransfer.transfer_date.desc()).all()
        
        transfers_list = []
        for t in transfers:
            creator_name = t.creator.username if t.creator else 'Неизвестно'
            transfers_list.append({
                'id': t.id,
                'amount': t.amount,
                'recipient': getattr(t, 'recipient', 'Не указано'),
                'transfer_date': t.transfer_date.isoformat() if isinstance(t.transfer_date, datetime) else t.transfer_date,
                'notes': t.notes,
                'created_by': t.created_by,
                'creator_name': creator_name,
                'created_at': t.created_at.isoformat() if t.created_at else None
            })
        
        return jsonify(transfers_list)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/cash/transfers', methods=['POST'])
@login_required
def create_cash_transfer():
    """Создать передачу денег управляющему"""
    ensure_cash_transfers_table()
    from datetime import datetime
    
    try:
        data = request.json
        amount = float(data.get('amount', 0))
        recipient = data.get('recipient', '').strip()
        transfer_date_str = data.get('transfer_date')
        notes = data.get('notes', '').strip()
        
        if amount <= 0:
            return jsonify({'success': False, 'message': 'Сумма должна быть больше нуля'}), 400
        
        if not recipient:
            return jsonify({'success': False, 'message': 'Укажите имя управляющего'}), 400
        
        # Парсинг даты
        if transfer_date_str:
            try:
                transfer_date = datetime.fromisoformat(transfer_date_str.replace('Z', '+00:00'))
            except:
                transfer_date = datetime.now()
        else:
            transfer_date = datetime.now()
        
        # Получить school_id для текущей школы
        school_id = get_current_school_id()
        if not school_id:
            return jsonify({'success': False, 'message': 'Школа не выбрана'}), 400
        
        # Создать запись
        transfer = CashTransfer(
            amount=amount,
            recipient=recipient,
            transfer_date=transfer_date,
            notes=notes,
            created_by=current_user.id,
            school_id=school_id
        )
        
        # Убедиться, что school_id установлен
        ensure_school_id(transfer, school_id)
        
        db.session.add(transfer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Передача денег успешно создана',
            'transfer': {
                'id': transfer.id,
                'amount': transfer.amount,
                'recipient': transfer.recipient,
                'transfer_date': transfer.transfer_date.isoformat(),
                'notes': transfer.notes
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/cash/transfers/<int:transfer_id>', methods=['PUT'])
@login_required
def update_cash_transfer(transfer_id):
    """Обновить передачу денег (только текущей школы)"""
    from datetime import datetime
    from backend.middleware.school_middleware import is_super_admin
    
    try:
        # Получаем передачу с проверкой school_id
        if is_super_admin():
            # Суперадмин может редактировать любую передачу
            transfer = db.session.get(CashTransfer, transfer_id)
        else:
            # Обычные админы могут редактировать только передачи своей школы
            school_id = get_current_school_id()
            if not school_id:
                return jsonify({'success': False, 'message': 'Школа не выбрана'}), 400
            
            transfer_query = CashTransfer.query.filter_by(id=transfer_id)
            transfer = filter_query_by_school(transfer_query, CashTransfer).first()
        
        if not transfer:
            return jsonify({'success': False, 'message': 'Передача не найдена или у вас нет доступа к ней'}), 404
        
        data = request.json
        amount = data.get('amount')
        recipient = data.get('recipient')
        transfer_date_str = data.get('transfer_date')
        notes = data.get('notes')
        
        if amount is not None:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'success': False, 'message': 'Сумма должна быть больше нуля'}), 400
            transfer.amount = amount
        
        if recipient is not None:
            recipient = recipient.strip()
            if not recipient:
                return jsonify({'success': False, 'message': 'Укажите имя управляющего'}), 400
            transfer.recipient = recipient
        
        if transfer_date_str:
            try:
                transfer.transfer_date = datetime.fromisoformat(transfer_date_str.replace('Z', '+00:00'))
            except:
                pass
        
        if notes is not None:
            transfer.notes = notes.strip()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Передача денег успешно обновлена'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/cash/transfers/<int:transfer_id>', methods=['DELETE'])
@login_required
def delete_cash_transfer(transfer_id):
    """Удалить передачу денег (только текущей школы)"""
    from backend.middleware.school_middleware import is_super_admin
    
    try:
        # Получаем передачу с проверкой school_id
        if is_super_admin():
            # Суперадмин может удалять любую передачу
            transfer = db.session.get(CashTransfer, transfer_id)
        else:
            # Обычные админы могут удалять только передачи своей школы
            school_id = get_current_school_id()
            if not school_id:
                return jsonify({'success': False, 'message': 'Школа не выбрана'}), 400
            
            transfer_query = CashTransfer.query.filter_by(id=transfer_id)
            transfer = filter_query_by_school(transfer_query, CashTransfer).first()
        
        if not transfer:
            return jsonify({'success': False, 'message': 'Передача не найдена или у вас нет доступа к ней'}), 404
        
        db.session.delete(transfer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Передача денег успешно удалена'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/recognize', methods=['POST'])
def recognize_face():
    """Распознать лицо из кадра камеры"""
    try:
        school_id = get_current_school_id()
        
        # Получить изображение (base64 или файл)
        if 'image' in request.files:
            image_file = request.files['image']
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_recognize.jpg')
            image_file.save(temp_path)
            
            student_id = face_service.recognize_face_from_image(temp_path)
            os.remove(temp_path)
            
            if student_id:
                student_query = Student.query.filter_by(id=student_id)
                student = filter_query_by_school(student_query, Student).first()
                if not student:
                    return jsonify({'success': False, 'message': 'Студент не найден в текущей школе'}), 403
                
                return jsonify({
                    'success': True,
                    'student_id': student.id,
                    'student_name': student.full_name,
                    'balance': calculate_student_balance(student),
                    'photo': student.photo_path
                })
            else:
                return jsonify({'success': False, 'message': 'Лицо не распознано'})
        
        return jsonify({'success': False, 'message': 'Нет изображения'}), 400
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/recognize_multiple', methods=['POST'])
def recognize_multiple_faces():
    """Распознать несколько лиц из кадра камеры"""
    try:
        school_id = get_current_school_id()
        
        if 'image' in request.files:
            image_file = request.files['image']
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_recognize.jpg')
            image_file.save(temp_path)
            
            recognized = face_service.recognize_multiple_faces_from_image(temp_path)
            os.remove(temp_path)
            
            if len(recognized) > 0:
                students_data = []
                for item in recognized:
                    student_query = Student.query.filter_by(id=item['student_id'])
                    student = filter_query_by_school(student_query, Student).first()
                    # Фильтруем только студентов текущей школы
                    if student:
                        students_data.append({
                            'student_id': student.id,
                            'student_name': student.full_name,
                            'balance': calculate_student_balance(student),
                            'photo': student.photo_path
                        })
                
                return jsonify({
                    'success': True,
                    'count': len(students_data),
                    'students': students_data
                })
            else:
                return jsonify({'success': False, 'message': 'Лица не распознаны'})
        
        return jsonify({'success': False, 'message': 'Нет изображения'}), 400
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def reload_face_encodings(school_id=None):
    """Перезагрузить все face encodings в память для текущей школы"""
    try:
        # Пытаемся получить school_id из контекста запроса, если он доступен
        if school_id is None:
            try:
                school_id = get_current_school_id()
            except RuntimeError:
                # Работаем вне контекста запроса (например, при инициализации)
                school_id = None
        
        if school_id:
            students_query = Student.query.filter_by(status='active', school_id=school_id)
            students = filter_query_by_school(students_query, Student).all()
        else:
            # Если школа не выбрана (например, для супер-админа или при инициализации), загружаем всех
            students_query = Student.query.filter_by(status='active')
            students = filter_query_by_school(students_query, Student).all()
        face_service.load_student_encodings(students)
    except Exception as e:
        # Игнорируем ошибки при инициализации, если нет активных запросов
        print(f"[WARNING] Could not reload face encodings: {e}")


# ===== ИНИЦИАЛИЗАЦИЯ =====

def init_db():
    """Создать таблицы и первого админа"""
    with app.app_context():
        db.create_all()
        
        # Выполнить миграции перед запросами к таблицам
        ensure_schools_table_columns()  # Миграция для колонки contact_person
        ensure_users_table_columns()
        ensure_roles_tables()
        ensure_club_settings_columns()
        ensure_students_columns()  # Миграция для Telegram полей
        
        # Проверить, есть ли админ
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(
                username='admin',
                password_hash=bcrypt.generate_password_hash('admin123').decode('utf-8'),
                role='admin'
            )
            db.session.add(admin)
            db.session.commit()
            print("Создан администратор: admin / admin123")
        
        # Убедиться, что у всех учеников есть код Telegram
        students_without_code = Student.query.filter(
            (Student.telegram_link_code.is_(None)) | (Student.telegram_link_code == '')
        ).all()
        if students_without_code:
            for student in students_without_code:
                ensure_student_has_telegram_code(student)
            db.session.commit()
            print(f"✓ Сгенерированы коды Telegram для {len(students_without_code)} учеников")
        
        # Загрузить encodings
        reload_face_encodings()


# ===== ПОМЕСЯЧНЫЕ ОПЛАТЫ =====

@app.route('/api/students/<int:student_id>/monthly-payments', methods=['GET'])
@login_required
def get_monthly_payments(student_id):
    """Получить помесячные оплаты ученика"""
    try:
        # Получить студента и его тариф
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first()
        if not student:
            return jsonify({'error': 'Студент не найден'}), 404
        
        # Явно загружаем тариф, если он есть
        tariff_price = 0
        tariff_name = None
        if student.tariff_id:
            tariff = db.session.get(Tariff, student.tariff_id)
            if tariff:
                tariff_name = tariff.name
                tariff_price = float(tariff.price) if tariff.price else 0
        elif student.tariff:
            # Если тариф загружен через relationship
            tariff_name = student.tariff.name if student.tariff.name else None
            tariff_price = float(student.tariff.price) if student.tariff.price else 0
        
        # Получить все платежи ученика с метаданными месяца
        payments_query = Payment.query.filter_by(student_id=student_id).order_by(Payment.payment_date.desc())
        payments = filter_query_by_school(payments_query, Payment).all()
        
        # Группировать по месяцам используя payment_month и payment_year
        payments_by_month = {}
        for payment in payments:
            # Использовать payment_month/payment_year если есть, иначе брать из payment_date
            if payment.payment_month and payment.payment_year:
                month_key = f"{payment.payment_year}-{str(payment.payment_month).zfill(2)}"
            elif payment.payment_date:
                month_key = payment.payment_date.strftime('%Y-%m')
            else:
                continue
                
            if month_key not in payments_by_month:
                payments_by_month[month_key] = {
                    'payments': [],
                    'total_paid': 0,
                    'tariff_price': tariff_price,
                    'remainder': tariff_price
                }
            
            payments_by_month[month_key]['payments'].append({
                'id': payment.id,
                'date': payment.payment_date.isoformat() if payment.payment_date else None,
                'amount': float(payment.amount_paid),
                'payment_type': payment.payment_type or 'cash',
                'notes': payment.notes or '',
                'tariff_name': payment.tariff_name or ''
            })
            payments_by_month[month_key]['total_paid'] += float(payment.amount_paid)
        
        # Рассчитать остаток для каждого месяца
        for month_key in payments_by_month:
            total_paid = payments_by_month[month_key]['total_paid']
            payments_by_month[month_key]['remainder'] = max(0, tariff_price - total_paid)
        
        return jsonify({
            'payments_by_month': payments_by_month,
            'tariff_price': tariff_price,
            'tariff_name': tariff_name
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/students/add-monthly-payment', methods=['POST'])
@login_required
def add_monthly_payment():
    """Добавить помесячную оплату"""
    try:
        data = request.json
        student_id = data.get('student_id')
        year = data.get('year')
        month = data.get('month')
        payment_date = data.get('payment_date')
        amount = float(data.get('amount', 0))
        payment_type = data.get('payment_type', 'cash')  # Тип оплаты: cash, card, click, payme, uzum
        notes = data.get('notes', '')
        
        student_query = Student.query.filter_by(id=student_id)
        student = filter_query_by_school(student_query, Student).first()
        if not student:
            return jsonify({'success': False, 'message': 'Ученик не найден'})

        # Блокировка оплат за будущие месяцы, если включено в настройках клуба
        settings = get_club_settings_instance()
        if getattr(settings, 'block_future_payments', False):
            today = get_local_date()
            if year > today.year or (year == today.year and month > today.month):
                return jsonify({'success': False, 'message': 'Оплата за будущие месяцы запрещена настройками клуба'}), 400

        # Проверка тарифа и текущих оплат за месяц
        tariff_price = None
        if student.tariff_id:
            tariff_query = Tariff.query.filter_by(id=student.tariff_id)
            tariff = filter_query_by_school(tariff_query, Tariff).first()
            tariff_price = float(tariff.price) if tariff and tariff.price is not None else None

        if tariff_price is not None:
            existing_paid = db.session.query(db.func.sum(Payment.amount_paid)).filter(
                Payment.student_id == student_id,
                Payment.payment_year == year,
                Payment.payment_month == month
            ).scalar() or 0
            if existing_paid + amount > tariff_price:
                remainder = max(0, tariff_price - existing_paid)
                return jsonify({
                    'success': False,
                    'message': f'Оплата превышает стоимость тарифа. Осталось не более {remainder:.0f} сум'
                }), 400
        
        # Создать запись оплаты с привязкой к выбранному месяцу через notes и метаданные
        # payment_date используется только как дата фактической транзакции
        month_label = f"{month}/{year}"
        payment = Payment(
            student_id=student_id,
            tariff_id=student.tariff_id if student.tariff_id else None,
            amount_paid=amount,
            amount_due=0,
            payment_date=datetime.fromisoformat(payment_date),
            payment_type=payment_type,
            notes=f"{notes} (Оплата за {month_label})" if notes else f"Оплата за {month_label}",
            lessons_added=0,
            # Сохранить месяц в отдельном поле для корректной группировки
            payment_month=month,
            payment_year=year
        )
        
        db.session.add(payment)
        db.session.commit()
        
        # Вычислить долг за этот месяц
        tariff_price = tariff_price or 0
        existing_paid = existing_paid or 0
        total_paid_after = existing_paid + amount
        debt = max(0, tariff_price - total_paid_after) if tariff_price > 0 else 0
        
        # Отправить уведомление в Telegram
        try:
            send_payment_notification(
                student_id=student_id,
                payment_date=payment.payment_date,
                month=month_label,
                payment_type=payment_type,
                amount_paid=amount,
                debt=debt if debt > 0 else None
            )
        except Exception as e:
            print(f"Ошибка отправки уведомления об оплате: {e}")
            # Не прерываем выполнение, если уведомление не отправилось
        
        return jsonify({
            'success': True,
            'message': 'Оплата добавлена',
            'payment_id': payment.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/payments/<int:payment_id>', methods=['PUT'])
@login_required
def update_payment(payment_id):
    """Редактирование существующей оплаты (сумма, дата, комментарий)"""
    # Разрешим роли: admin, financier, payment_admin
    if getattr(current_user, 'role', None) not in ['admin', 'financier', 'payment_admin']:
        return jsonify({'success': False, 'message': 'Нет доступа'}), 403

    try:
        data = request.get_json() or {}
        payment_query = Payment.query.filter_by(id=payment_id)
        payment = filter_query_by_school(payment_query, Payment).first()
        if not payment:
            return jsonify({'success': False, 'message': 'Оплата не найдена'}), 404

        # Валидация суммы
        if 'amount_paid' in data:
            new_amount = float(data.get('amount_paid'))
            if new_amount <= 0:
                return jsonify({'success': False, 'message': 'Сумма должна быть положительной'}), 400
            # Проверяем лимит по тарифу в рамках того же месяца
            tariff_price = None
            if payment.tariff_id:
                tariff_query = Tariff.query.filter_by(id=payment.tariff_id)
                tariff_obj = filter_query_by_school(tariff_query, Tariff).first()
                tariff_price = float(tariff_obj.price) if tariff_obj and tariff_obj.price is not None else None
            if tariff_price is not None:
                existing_paid_query = db.session.query(db.func.sum(Payment.amount_paid)).filter(
                    Payment.student_id == payment.student_id,
                    Payment.payment_year == payment.payment_year,
                    Payment.payment_month == payment.payment_month,
                    Payment.id != payment.id
                )
                existing_paid_query = filter_query_by_school(existing_paid_query, Payment)
                existing_paid = existing_paid_query.scalar() or 0
                if existing_paid + new_amount > tariff_price:
                    remainder = max(0, tariff_price - existing_paid)
                    return jsonify({'success': False, 'message': f'Сумма превышает стоимость тарифа. Доступно не более {remainder:.0f} сум'}), 400
            payment.amount_paid = new_amount

        if 'payment_date' in data and data.get('payment_date'):
            try:
                payment_date_str = data.get('payment_date')
                # Если дата в формате YYYY-MM-DD, добавить время
                if len(payment_date_str) == 10:
                    payment_date_str += 'T00:00:00'
                payment.payment_date = datetime.fromisoformat(payment_date_str.replace('Z', '+00:00'))
            except ValueError as e:
                return jsonify({'success': False, 'message': f'Неверный формат даты: {str(e)}'}), 400

        if 'payment_type' in data:
            payment.payment_type = data.get('payment_type')

        if 'notes' in data:
            payment.notes = data.get('notes')

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/payments/<int:payment_id>/delete', methods=['DELETE'])
@login_required
def delete_payment(payment_id):
    """Удалить оплату"""
    if getattr(current_user, 'role', None) not in ['admin', 'financier', 'payment_admin']:
        return jsonify({'success': False, 'message': 'Нет доступа'}), 403

    try:
        payment_query = Payment.query.filter_by(id=payment_id)
        payment = filter_query_by_school(payment_query, Payment).first()
        if not payment:
            return jsonify({'success': False, 'message': 'Оплата не найдена'}), 404

        student = payment.student
        db.session.delete(payment)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Оплата удалена',
            'new_balance': calculate_student_balance(student) if student else None
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/payments/<int:payment_id>/refund', methods=['POST'])
@login_required
def refund_payment(payment_id):
    """Возврат оплаты - создание обратной записи"""
    if getattr(current_user, 'role', None) not in ['admin', 'financier', 'payment_admin']:
        return jsonify({'success': False, 'message': 'Нет доступа'}), 403

    try:
        payment_query = Payment.query.filter_by(id=payment_id)
        original_payment = filter_query_by_school(payment_query, Payment).first()
        if not original_payment:
            return jsonify({'success': False, 'message': 'Оплата не найдена'}), 404

        # Создать обратную запись с отрицательной суммой
        refund_payment = Payment(
            student_id=original_payment.student_id,
            tariff_id=original_payment.tariff_id,
            amount_paid=-original_payment.amount_paid,  # Отрицательная сумма
            amount_due=0,
            lessons_added=-original_payment.lessons_added if original_payment.lessons_added else 0,  # Отрицательные уроки
            is_full_payment=False,
            payment_date=get_local_datetime(),
            tariff_name=original_payment.tariff_name,
            notes=f"Возврат оплаты #{original_payment.id}" + (f" ({original_payment.notes})" if original_payment.notes else ""),
            created_by=current_user.id,
            payment_month=original_payment.payment_month,
            payment_year=original_payment.payment_year,
            payment_type=original_payment.payment_type
        )
        
        db.session.add(refund_payment)
        db.session.commit()

        student = original_payment.student
        return jsonify({
            'success': True,
            'message': 'Возврат оплаты выполнен',
            'new_balance': calculate_student_balance(student) if student else None,
            'refund_id': refund_payment.id
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===== TELEGRAM API =====

@app.route('/api/telegram/register', methods=['POST'])
def telegram_register():
    """
    API для регистрации ученика в Telegram боте
    Используется ботом для привязки ученика по коду
    Поддерживает multi-tenancy через school_id
    """
    try:
        data = request.get_json()
        if not data:
            app.logger.error('[Telegram Register] No JSON data received')
            return jsonify({'success': False, 'message': 'Нет данных в запросе'}), 400
        
        chat_id = data.get('chat_id') or data.get('telegram_chat_id')
        code = data.get('code')
        school_id = data.get('school_id')  # ID школы из бота
        
        app.logger.info(f'[Telegram Register] Request: chat_id={chat_id}, code={code}, school_id={school_id}')
        
        if not chat_id:
            app.logger.error('[Telegram Register] Chat ID not provided')
            return jsonify({'success': False, 'message': 'Chat ID не указан'}), 400
        
        if not code:
            app.logger.error('[Telegram Register] Code not provided')
            return jsonify({'success': False, 'message': 'Код не указан'}), 400
        
        # Если school_id не указан, пытаемся определить из кода
        if not school_id:
            # Пробуем найти ученика по коду в текущей школе (если есть контекст)
            current_school_id = get_current_school_id()
            if current_school_id:
                school_id = current_school_id
                app.logger.info(f'[Telegram Register] Using current_school_id: {school_id}')
        
        if not school_id:
            app.logger.error('[Telegram Register] School ID not provided and cannot be determined')
            return jsonify({'success': False, 'message': 'ID школы не указан'}), 400
        
        success, message, student = register_student_by_code(chat_id, code, school_id)
        
        app.logger.info(f'[Telegram Register] Result: success={success}, message={message}')
        
        if success:
            return jsonify({
                'success': True,
                'message': message,
                'student': {
                    'id': student.id,
                    'full_name': student.full_name,
                    'group_name': student.group.name if student.group else None
                }
            })
        else:
            return jsonify({'success': False, 'message': message}), 400
    
    except Exception as e:
        app.logger.exception(f'[Telegram Register] Exception: {str(e)}')
        return jsonify({'success': False, 'message': f'Ошибка сервера: {str(e)}'}), 500


@app.route('/api/club-settings/public', methods=['GET'])
def get_club_settings_public():
    """
    Публичный endpoint для получения токена бота
    Используется только ботом для получения токена
    """
    settings = get_club_settings_instance()
    return jsonify({
        'telegram_bot_token': settings.telegram_bot_token or ''
    })


@app.route('/api/telegram/send-payment-reminders', methods=['POST'])
@login_required
def send_payment_reminders_api():
    """
    Ручная отправка напоминаний об оплате (для тестирования или ручного запуска)
    """
    if current_user.role not in ['admin']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        result = send_monthly_payment_reminders()
        return jsonify(result)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Ошибка при отправке напоминаний об оплате: {error_trace}")
        return jsonify({'success': False, 'message': f'Ошибка: {str(e)}'}), 500


@app.route('/api/groups/<int:group_id>/send-notification', methods=['POST'])
@login_required
def send_group_notification_api(group_id):
    """
    Отправить уведомления всем ученикам группы
    """
    if current_user.role not in ['admin', 'teacher']:
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.get_json() or {}
        additional_text = data.get('additional_text', '')
        
        result = send_group_notification(group_id, additional_text)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 400
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Ошибка при отправке уведомлений: {error_trace}")
        return jsonify({'success': False, 'message': f'Ошибка: {str(e)}'}), 500


# Планировщик для автоматической отправки напоминаний об оплате
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

def setup_scheduler():
    """Настройка планировщика для автоматической отправки напоминаний"""
    scheduler = BackgroundScheduler()
    
    # Запускать каждый день в 9:00 утра, но функция сама проверит, что это начало месяца (1-3 число)
    scheduler.add_job(
        func=send_monthly_payment_reminders_job,
        trigger=CronTrigger(hour=9, minute=0),
        id='send_payment_reminders',
        name='Отправка напоминаний об оплате',
        replace_existing=True
    )
    
    scheduler.start()
    print("[OK] Планировщик запущен: автоматическая отправка напоминаний об оплате в начале месяца")
    return scheduler

def send_monthly_payment_reminders_job():
    """Задача для планировщика - отправка напоминаний об оплате"""
    with app.app_context():
        try:
            result = send_monthly_payment_reminders()
            print(f"[INFO] Напоминания об оплате: {result.get('message', 'Выполнено')}")
        except Exception as e:
            print(f"[ERROR] Ошибка при отправке напоминаний об оплате: {e}")


# ===== API ДЛЯ УПРАВЛЕНИЯ ШКОЛАМИ (SaaS) =====

@app.route('/api/schools', methods=['GET'])
@login_required
def get_schools():
    """Получить список всех школ (только для супер-админа)"""
    try:
        # Убедиться, что все колонки в таблице schools существуют
        ensure_schools_table_columns()
        
        if not is_super_admin():
            return jsonify({'success': False, 'message': 'Доступ запрещен. Требуется роль супер-администратора'}), 403
        
        schools = School.query.all()
        
        result = []
        for school in schools:
            try:
                features = SchoolFeature.query.filter_by(school_id=school.id).all()
                
                result.append({
                    'id': school.id,
                    'name': school.name or '',
                    'contact_person': school.contact_person or '',
                    'address': school.address or '',
                    'phone': school.phone or '',
                    'owner_username': getattr(school, 'owner_username', '') or '',
                    'is_active': school.is_active if hasattr(school, 'is_active') else True,
                    'created_at': school.created_at.isoformat() if school.created_at else None,
                    'features': [{'feature_name': f.feature_name, 'enabled': f.enabled} for f in features]
                })
            except Exception as e:
                print(f"[ERROR] Error processing school {school.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        return jsonify({
            'success': True,
            'schools': result
        })
    except Exception as e:
        print(f"[ERROR] Error in get_schools: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/schools/<int:school_id>/delete', methods=['POST', 'DELETE'])
@login_required
def delete_school(school_id):
    """Удалить школу и все её данные (только для супер-админа)"""
    if not is_super_admin():
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    school = School.query.get(school_id)
    if not school:
        return jsonify({'success': False, 'message': 'Школа не найдена'}), 404
    
    school_name = school.name
    
    from sqlalchemy import text
    
    try:
        # Удаляем ВСЕ данные школы через прямые SQL запросы
        db.session.execute(text("DELETE FROM student_cards WHERE student_id IN (SELECT id FROM students WHERE school_id = :sid)"), {"sid": school_id})
        db.session.execute(text("DELETE FROM student_rewards WHERE student_id IN (SELECT id FROM students WHERE school_id = :sid)"), {"sid": school_id})
        db.session.execute(text("DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE school_id = :sid)"), {"sid": school_id})
        db.session.execute(text("DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE school_id = :sid)"), {"sid": school_id})
        db.session.execute(text("DELETE FROM students WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM groups WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM tariffs WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM expenses WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM reward_types WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM card_types WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM school_features WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM club_settings WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM users WHERE school_id = :sid"), {"sid": school_id})
        db.session.execute(text("DELETE FROM schools WHERE id = :sid"), {"sid": school_id})
        
        db.session.commit()
        return jsonify({'success': True, 'message': f'Школа "{school_name}" удалена'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Ошибка: {str(e)}'}), 500


@app.route('/api/schools/<int:school_id>', methods=['GET'])
@login_required
def get_school(school_id):
    """Получить информацию о школе (только для супер-админа)"""
    if not is_super_admin():
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        school = School.query.get_or_404(school_id)
        features = SchoolFeature.query.filter_by(school_id=school.id).all()
        
        return jsonify({
            'success': True,
            'school': {
                'id': school.id,
                'name': school.name,
                'contact_person': school.contact_person or '',
                'address': school.address or '',
                'phone': school.phone or '',
                'owner_username': school.owner_username,
                'is_active': school.is_active,
                'created_at': school.created_at.isoformat() if school.created_at else None,
                'features': [{'feature_name': f.feature_name, 'enabled': f.enabled} for f in features]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/schools', methods=['POST'])
@login_required
def create_school():
    """Создать новую школу (только для супер-админа)"""
    if not is_super_admin():
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.get_json()
        # Безопасная обработка значений - проверяем на None перед strip()
        name = (data.get('name') or '').strip()
        contact_person = (data.get('contact_person') or '').strip() or None
        address = (data.get('address') or '').strip() or None
        phone = (data.get('phone') or '').strip() or None
        owner_username = (data.get('owner_username') or '').strip()
        owner_password = data.get('owner_password') or ''
        is_active = data.get('is_active', True)
        features = data.get('features', {})
        
        if not name:
            return jsonify({'success': False, 'message': 'Название школы обязательно'}), 400
        
        if not owner_username or not owner_password:
            return jsonify({'success': False, 'message': 'Логин и пароль владельца школы обязательны'}), 400
        
        # Проверка уникальности логина владельца
        existing_school = School.query.filter_by(owner_username=owner_username).first()
        if existing_school:
            return jsonify({'success': False, 'message': 'Логин владельца уже используется'}), 400
        
        # Создать школу
        school = School(
            name=name,
            contact_person=contact_person or None,
            address=address or None,
            phone=phone or None,
            owner_username=owner_username,
            owner_password_hash=bcrypt.generate_password_hash(owner_password).decode('utf-8'),
            is_active=is_active
        )
        db.session.add(school)
        db.session.flush()  # Получаем school.id
        
        # Создать администратора школы (владельца)
        admin_user = User(
            username=owner_username,
            password_hash=bcrypt.generate_password_hash(owner_password).decode('utf-8'),
            role='admin',
            school_id=school.id,
            is_active=True,
            full_name=contact_person or None
        )
        db.session.add(admin_user)
        
        # Создать feature flags
        for feature_name, enabled in features.items():
            feature = SchoolFeature(
                school_id=school.id,
                feature_name=feature_name,
                enabled=enabled
            )
            db.session.add(feature)
        
        # Создать настройки клуба для школы
        club_settings = ClubSettings(
            school_id=school.id,
            system_name=name,
            working_days='1,2,3,4,5',
            work_start_time=time(9, 0),
            work_end_time=time(21, 0),
            max_groups_per_slot=4,
            block_future_payments=False,
            rewards_reset_period_months=1,
            podium_display_count=20
        )
        db.session.add(club_settings)
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'school_id': school.id,
            'message': f'Школа "{name}" успешно создана'
        })
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/schools/<int:school_id>', methods=['PUT'])
@login_required
def update_school(school_id):
    """Обновить школу (только для супер-админа)"""
    if not is_super_admin():
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        school = School.query.get_or_404(school_id)
        data = request.get_json()
        
        if 'name' in data:
            school.name = (data['name'] or '').strip()
        if 'contact_person' in data:
            school.contact_person = (data['contact_person'] or '').strip() or None
        if 'address' in data:
            school.address = (data['address'] or '').strip() or None
        if 'phone' in data:
            school.phone = (data['phone'] or '').strip() or None
        if 'is_active' in data:
            school.is_active = data['is_active']
        
        # Обновить логин владельца
        if 'owner_username' in data:
            new_username = (data['owner_username'] or '').strip()
            if new_username != school.owner_username:
                # Проверка уникальности
                existing = School.query.filter_by(owner_username=new_username).first()
                if existing and existing.id != school_id:
                    return jsonify({'success': False, 'message': 'Логин уже используется'}), 400
                school.owner_username = new_username
                
                # Обновить логин у пользователя-админа
                admin_user = User.query.filter_by(school_id=school.id, role='admin').first()
                if admin_user:
                    admin_user.username = new_username
        
        # Обновить пароль владельца (если передан)
        if 'owner_password' in data and data['owner_password']:
            school.owner_password_hash = bcrypt.generate_password_hash(data['owner_password']).decode('utf-8')
            
            # Обновить пароль у пользователя-админа
            admin_user = User.query.filter_by(school_id=school.id, role='admin').first()
            if admin_user:
                admin_user.password_hash = school.owner_password_hash
        
        # Обновить feature flags
        if 'features' in data:
            features = data['features']
            for feature_name, enabled in features.items():
                feature = SchoolFeature.query.filter_by(
                    school_id=school.id,
                    feature_name=feature_name
                ).first()
                
                if feature:
                    feature.enabled = enabled
                else:
                    feature = SchoolFeature(
                        school_id=school.id,
                        feature_name=feature_name,
                        enabled=enabled
                    )
                    db.session.add(feature)
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Школа обновлена'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


    
    # 13. Удалить саму школу
    school_name = school.name
    db.session.delete(school)
    db.session.commit()
    
    return {
        'success': True,
        'message': f'Школа "{school_name}" успешно удалена. Удалено: {students_count} учеников, {groups_count} групп, {users_count} пользователей, {payments_count} платежей.'
    }


@app.route('/api/schools/switch', methods=['POST'])
@login_required
def switch_school():
    """Переключиться на другую школу (только для супер-админа)"""
    if not is_super_admin():
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    try:
        data = request.get_json()
        school_id = data.get('school_id')
        
        if not school_id:
            return jsonify({'success': False, 'message': 'ID школы не указан'}), 400
        
        school = School.query.get(school_id)
        if not school:
            return jsonify({'success': False, 'message': 'Школа не найдена'}), 404
        
        # Установить школу в сессии (для просмотра)
        from backend.utils.school_utils import set_current_school
        set_current_school(school_id)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    init_db()
    
    # Запустить планировщик
    scheduler = setup_scheduler()
    
    # Для Railway используется gunicorn, но для локальной разработки используем встроенный сервер
    port = int(os.environ.get('PORT', 5001))  # Изменен порт на 5001
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    
    try:
        app.run(debug=debug, host='0.0.0.0', port=port, use_reloader=False)  # use_reloader=False для планировщика
    except KeyboardInterrupt:
        scheduler.shutdown()


