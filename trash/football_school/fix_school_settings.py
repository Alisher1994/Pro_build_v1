"""
Скрипт для проверки и исправления настроек школы
"""
from app import app, db
from backend.models.models import School, User, ClubSettings
from flask import g

def fix_school_settings():
    with app.app_context():
        print("=== Проверка школ в базе данных ===")
        schools = School.query.all()
        print(f"Найдено школ: {len(schools)}")
        
        if not schools:
            print("\n⚠️  Школы не найдены! Создаем первую школу...")
            school = School(
                name='FK QORASUV',
                contact_email='admin@fkqorasuv.uz',
                is_active=True
            )
            db.session.add(school)
            db.session.commit()
            print(f"✓ Создана школа: {school.name} (ID: {school.id})")
            schools = [school]
        else:
            for school in schools:
                print(f"  - {school.name} (ID: {school.id}, Active: {school.is_active})")
        
        print("\n=== Проверка пользователей ===")
        users = User.query.all()
        print(f"Найдено пользователей: {len(users)}")
        
        fixed_users = 0
        for user in users:
            if not user.school_id:
                print(f"  ⚠️  Пользователь {user.username} (ID: {user.id}) не привязан к школе")
                # Привязываем к первой активной школе
                first_school = School.query.filter_by(is_active=True).first()
                if first_school:
                    user.school_id = first_school.id
                    fixed_users += 1
                    print(f"    ✓ Привязан к школе: {first_school.name}")
            else:
                school = School.query.get(user.school_id)
                school_name = school.name if school else "Не найдена"
                print(f"  ✓ {user.username} (ID: {user.id}) -> Школа: {school_name} (ID: {user.school_id})")
        
        if fixed_users > 0:
            db.session.commit()
            print(f"\n✓ Исправлено пользователей: {fixed_users}")
        
        print("\n=== Проверка настроек ClubSettings ===")
        settings_all = ClubSettings.query.all()
        print(f"Найдено настроек: {len(settings_all)}")
        
        for setting in settings_all:
            school = School.query.get(setting.school_id) if setting.school_id else None
            school_name = school.name if school else "БЕЗ ШКОЛЫ"
            print(f"  - Setting ID: {setting.id}, School: {school_name} (ID: {setting.school_id})")
        
        # Создаем настройки для каждой школы, если их нет
        created_settings = 0
        for school in schools:
            existing = ClubSettings.query.filter_by(school_id=school.id).first()
            if not existing:
                print(f"\n  ⚠️  У школы {school.name} нет настроек, создаем...")
                new_settings = ClubSettings(
                    school_id=school.id,
                    system_name=school.name
                )
                db.session.add(new_settings)
                created_settings += 1
                print(f"    ✓ Созданы настройки для школы {school.name}")
        
        if created_settings > 0:
            db.session.commit()
            print(f"\n✓ Создано настроек: {created_settings}")
        
        print("\n=== Итоговая проверка ===")
        for school in schools:
            users_count = User.query.filter_by(school_id=school.id).count()
            settings = ClubSettings.query.filter_by(school_id=school.id).first()
            print(f"\nШкола: {school.name} (ID: {school.id})")
            print(f"  - Пользователей: {users_count}")
            print(f"  - Настройки: {'✓ Есть' if settings else '✗ Нет'}")
            if settings:
                print(f"    - Название системы: {settings.system_name}")
                print(f"    - Рабочие дни: {settings.working_days}")
                print(f"    - Рабочее время: {settings.work_start_time} - {settings.work_end_time}")
        
        print("\n=== Проверка завершена ===")

if __name__ == '__main__':
    fix_school_settings()
