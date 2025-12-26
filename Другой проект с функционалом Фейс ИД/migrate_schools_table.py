"""
Миграция для обновления таблицы schools с новыми полями
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import text

def migrate_schools_table():
    """Добавить новые поля в таблицу schools"""
    with app.app_context():
        try:
            inspector = db.inspect(db.engine)
            columns = {col['name'] for col in inspector.get_columns('schools')}
            
            # Добавляем owner_username, если его нет
            if 'owner_username' not in columns:
                print("Добавление поля owner_username...")
                db.session.execute(text("ALTER TABLE schools ADD COLUMN owner_username VARCHAR(80)"))
                db.session.commit()
                print("✓ Поле owner_username добавлено")
            
            # Добавляем owner_password_hash, если его нет
            if 'owner_password_hash' not in columns:
                print("Добавление поля owner_password_hash...")
                db.session.execute(text("ALTER TABLE schools ADD COLUMN owner_password_hash VARCHAR(200)"))
                db.session.commit()
                print("✓ Поле owner_password_hash добавлено")
            
            # Мигрируем существующие данные: создаём владельца из первого админа школы
            print("\nМиграция существующих данных...")
            schools = db.session.execute(text("SELECT id FROM schools")).fetchall()
            
            for (school_id,) in schools:
                # Находим первого админа школы
                admin = db.session.execute(
                    text("SELECT username, password_hash FROM users WHERE school_id = :sid AND role = 'admin' LIMIT 1"),
                    {"sid": school_id}
                ).fetchone()
                
                if admin:
                    username, password_hash = admin
                    # Обновляем школу
                    db.session.execute(
                        text("UPDATE schools SET owner_username = :username, owner_password_hash = :pwd_hash WHERE id = :sid"),
                        {"username": username, "pwd_hash": password_hash, "sid": school_id}
                    )
                    print(f"  ✓ Школа ID {school_id}: владелец установлен ({username})")
                else:
                    print(f"  ⚠ Школа ID {school_id}: админ не найден, нужно установить вручную")
            
            db.session.commit()
            print("\n✅ Миграция завершена успешно!")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка миграции: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    print("=" * 60)
    print("Миграция таблицы schools")
    print("=" * 60)
    migrate_schools_table()
    print("=" * 60)




