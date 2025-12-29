"""
Скрипт для миграции существующих данных к системе школ
Устанавливает school_id для существующих записей на основе первого админа или создает дефолтную школу
"""
from app import app, db
from backend.models.models import User, Student, Payment, Attendance, Expense, Group, Tariff, ClubSettings, School
from sqlalchemy import text

def migrate_existing_data():
    """Мигрировать существующие данные к системе школ"""
    with app.app_context():
        try:
            # Проверить, есть ли школы
            schools_count = School.query.count()
            print(f"[INFO] Найдено школ: {schools_count}")
            
            if schools_count == 0:
                print("[INFO] Школы не найдены. Создайте школы через интерфейс супер-админа.")
                return
            
            # Найти все записи без school_id
            print("\n[INFO] Проверка данных без school_id...")
            
            # Студенты без school_id
            students_without_school = Student.query.filter(Student.school_id.is_(None)).count()
            print(f"[INFO] Студентов без school_id: {students_without_school}")
            
            # Группы без school_id
            groups_without_school = Group.query.filter(Group.school_id.is_(None)).count()
            print(f"[INFO] Групп без school_id: {groups_without_school}")
            
            # Тарифы без school_id
            tariffs_without_school = Tariff.query.filter(Tariff.school_id.is_(None)).count()
            print(f"[INFO] Тарифов без school_id: {tariffs_without_school}")
            
            # Расходы без school_id
            expenses_without_school = Expense.query.filter(Expense.school_id.is_(None)).count()
            print(f"[INFO] Расходов без school_id: {expenses_without_school}")
            
            # Настройки клуба без school_id
            settings_without_school = ClubSettings.query.filter(ClubSettings.school_id.is_(None)).count()
            print(f"[INFO] Настроек клуба без school_id: {settings_without_school}")
            
            if students_without_school == 0 and groups_without_school == 0 and tariffs_without_school == 0:
                print("\n[SUCCESS] Все данные уже привязаны к школам!")
                return
            
            # Получить первую школу (или создать дефолтную)
            default_school = School.query.first()
            if not default_school:
                print("[ERROR] Нет школ в системе. Создайте школу через интерфейс супер-админа.")
                return
            
            print(f"\n[INFO] Используется школа по умолчанию: {default_school.name} (ID: {default_school.id})")
            
            # Подтверждение
            response = input("\n[WARNING] Это установит school_id={} для всех записей без school_id. Продолжить? (yes/no): ".format(default_school.id))
            if response.lower() != 'yes':
                print("[CANCELLED] Миграция отменена.")
                return
            
            # Миграция данных
            print("\n[INFO] Начало миграции...")
            
            # Мигрировать группы
            if groups_without_school > 0:
                db.session.execute(
                    text("UPDATE groups SET school_id = :school_id WHERE school_id IS NULL"),
                    {"school_id": default_school.id}
                )
                print(f"[OK] Мигрировано групп: {groups_without_school}")
            
            # Мигрировать студентов
            if students_without_school > 0:
                db.session.execute(
                    text("UPDATE students SET school_id = :school_id WHERE school_id IS NULL"),
                    {"school_id": default_school.id}
                )
                print(f"[OK] Мигрировано студентов: {students_without_school}")
            
            # Мигрировать тарифы
            if tariffs_without_school > 0:
                db.session.execute(
                    text("UPDATE tariffs SET school_id = :school_id WHERE school_id IS NULL"),
                    {"school_id": default_school.id}
                )
                print(f"[OK] Мигрировано тарифов: {tariffs_without_school}")
            
            # Мигрировать расходы
            if expenses_without_school > 0:
                db.session.execute(
                    text("UPDATE expenses SET school_id = :school_id WHERE school_id IS NULL"),
                    {"school_id": default_school.id}
                )
                print(f"[OK] Мигрировано расходов: {expenses_without_school}")
            
            # Мигрировать настройки клуба (только если нет настроек для этой школы)
            if settings_without_school > 0:
                existing_settings = ClubSettings.query.filter_by(school_id=default_school.id).first()
                if not existing_settings:
                    db.session.execute(
                        text("UPDATE club_settings SET school_id = :school_id WHERE school_id IS NULL LIMIT 1"),
                        {"school_id": default_school.id}
                    )
                    print(f"[OK] Мигрировано настроек клуба: 1")
                else:
                    print(f"[SKIP] Настройки клуба для школы {default_school.id} уже существуют")
            
            db.session.commit()
            print("\n[SUCCESS] Миграция завершена успешно!")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n[ERROR] Ошибка миграции: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_existing_data()

