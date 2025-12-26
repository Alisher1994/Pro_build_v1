"""
Миграция: добавление полей address и phone в таблицу schools
"""
from app import app, db
from sqlalchemy import text

def migrate_school_fields():
    """Добавить поля address и phone в таблицу schools"""
    with app.app_context():
        try:
            inspector = db.inspect(db.engine)
            columns = {col['name'] for col in inspector.get_columns('schools')}
            
            with db.engine.begin() as conn:
                if 'address' not in columns:
                    conn.execute(text("ALTER TABLE schools ADD COLUMN address VARCHAR(500)"))
                    print("[OK] Добавлено поле address")
                
                if 'phone' not in columns:
                    conn.execute(text("ALTER TABLE schools ADD COLUMN phone VARCHAR(20)"))
                    print("[OK] Добавлено поле phone")
            
            print("[SUCCESS] Миграция завершена успешно")
        except Exception as e:
            print(f"[ERROR] Ошибка миграции: {e}")

if __name__ == '__main__':
    migrate_school_fields()

