"""
Миграционный скрипт для добавления поддержки SaaS (multi-tenancy)
Создаёт дефолтную школу и добавляет school_id во все существующие записи
"""
from app import app, db
from backend.models.models import (
    School, SchoolFeature, User, Student, Group, Tariff, Expense, 
    ClubSettings, RewardType, CardType, Payment, Attendance, 
    StudentReward, StudentCard, CashTransfer
)
from sqlalchemy import text

def migrate_to_saas():
    """Миграция к SaaS системе"""
    import sys
    import io
    # Устанавливаем UTF-8 для вывода
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    with app.app_context():
        print("Начало миграции к SaaS системе...")
        
        # 1. Создаём таблицы для новых моделей
        print("\nСоздание новых таблиц...")
        try:
            db.create_all()
            print("[OK] Таблицы созданы")
        except Exception as e:
            print(f"[WARNING] Ошибка при создании таблиц: {e}")
        
        # 2. Проверяем, есть ли уже школы
        existing_schools = School.query.all()
        if existing_schools:
            print(f"\n[INFO] Найдено {len(existing_schools)} существующих школ")
            default_school = existing_schools[0]
        else:
            # 3. Создаём дефолтную школу
            print("\nСоздание дефолтной школы...")
            default_school = School(
                name="Основная школа",
                subdomain=None,
                is_active=True
            )
            db.session.add(default_school)
            db.session.commit()
            print(f"[OK] Дефолтная школа создана (ID: {default_school.id})")
        
        school_id = default_school.id
        
        # 4. Добавляем колонки school_id в существующие таблицы (если их нет)
        print("\nДобавление колонок school_id...")
        
        tables_to_update = [
            ('users', 'school_id'),
            ('students', 'school_id'),
            ('groups', 'school_id'),
            ('tariffs', 'school_id'),
            ('expenses', 'school_id'),
            ('club_settings', 'school_id'),
            ('reward_types', 'school_id'),
            ('card_types', 'school_id')
        ]
        
        for table_name, column_name in tables_to_update:
            try:
                # Проверяем, существует ли колонка
                inspector = db.inspect(db.engine)
                columns = {col['name'] for col in inspector.get_columns(table_name)}
                
                if column_name not in columns:
                    # Добавляем колонку (SQLite не поддерживает UNIQUE при добавлении колонки)
                    db.session.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} INTEGER REFERENCES schools(id)")
                    )
                    db.session.commit()
                    print(f"[OK] Добавлена колонка {column_name} в таблицу {table_name}")
                else:
                    print(f"[INFO] Колонка {column_name} уже существует в таблице {table_name}")
            except Exception as e:
                print(f"[WARNING] Ошибка при добавлении колонки {column_name} в {table_name}: {e}")
                db.session.rollback()
        
        # 5. Добавляем school_id в существующие записи
        print("\nОбновление существующих записей...")
        
        # Обновляем Users
        try:
            users_updated = db.session.execute(
                text("UPDATE users SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено пользователей: {users_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении пользователей: {e}")
        
        # Обновляем Students
        try:
            students_updated = db.session.execute(
                text("UPDATE students SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено учеников: {students_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении учеников: {e}")
        
        # Обновляем Groups
        try:
            groups_updated = db.session.execute(
                text("UPDATE groups SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено групп: {groups_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении групп: {e}")
        
        # Обновляем Tariffs
        try:
            tariffs_updated = db.session.execute(
                text("UPDATE tariffs SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено тарифов: {tariffs_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении тарифов: {e}")
        
        # Обновляем Expenses
        try:
            expenses_updated = db.session.execute(
                text("UPDATE expenses SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено расходов: {expenses_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении расходов: {e}")
        
        # Обновляем ClubSettings
        try:
            settings_updated = db.session.execute(
                text("UPDATE club_settings SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено настроек клуба: {settings_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении настроек клуба: {e}")
        
        # Обновляем RewardType
        try:
            rewards_updated = db.session.execute(
                text("UPDATE reward_types SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено типов вознаграждений: {rewards_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении типов вознаграждений: {e}")
        
        # Обновляем CardType
        try:
            cards_updated = db.session.execute(
                text("UPDATE card_types SET school_id = :school_id WHERE school_id IS NULL"),
                {"school_id": school_id}
            )
            print(f"[OK] Обновлено типов карточек: {cards_updated.rowcount}")
        except Exception as e:
            print(f"[WARNING] Ошибка при обновлении типов карточек: {e}")
        
        # 6. Создаём дефолтные feature flags для школы
        print("\nСоздание feature flags...")
        default_features = [
            'telegram_bot',
            'rewards',
            'cards',
            'face_recognition',
            'attendance',
            'payments',
            'finances'
        ]
        
        for feature_name in default_features:
            existing = SchoolFeature.query.filter_by(
                school_id=school_id,
                feature_name=feature_name
            ).first()
            
            if not existing:
                feature = SchoolFeature(
                    school_id=school_id,
                    feature_name=feature_name,
                    enabled=True
                )
                db.session.add(feature)
                print(f"  [OK] {feature_name}: включено")
            else:
                print(f"  [INFO] {feature_name}: уже существует")
        
        db.session.commit()
        
        # 7. Создаём ClubSettings для школы, если его нет
        print("\nПроверка настроек клуба...")
        try:
            club_settings = ClubSettings.query.filter_by(school_id=school_id).first()
            if not club_settings:
                # Проверяем, есть ли старые настройки без school_id
                old_settings = ClubSettings.query.filter_by(school_id=None).first()
                if old_settings:
                    old_settings.school_id = school_id
                    db.session.commit()
                    print("[OK] Существующие настройки клуба привязаны к школе")
                else:
                    club_settings = ClubSettings(school_id=school_id)
                    db.session.add(club_settings)
                    db.session.commit()
                    print("[OK] Настройки клуба созданы для школы")
            else:
                print("[INFO] Настройки клуба уже существуют")
        except Exception as e:
            print(f"[WARNING] Ошибка при работе с настройками клуба: {e}")
        
        print("\n[SUCCESS] Миграция завершена успешно!")
        print(f"Дефолтная школа: {default_school.name} (ID: {default_school.id})")
        print("\nСледующие шаги:")
        print("   1. Все существующие данные привязаны к дефолтной школе")
        print("   2. Вы можете создать дополнительные школы через админ-панель")
        print("   3. Используйте feature flags для управления функциями")

if __name__ == '__main__':
    migrate_to_saas()

