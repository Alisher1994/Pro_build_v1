"""
Проверка и добавление полей в таблицу schools
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import text, inspect

def check_and_migrate():
    """Проверить и добавить поля если нужно"""
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            columns = {col['name'] for col in inspector.get_columns('schools')}
            
            print("Checking schools table columns...")
            print(f"Existing columns: {columns}")
            
            # Добавляем owner_username, если его нет
            if 'owner_username' not in columns:
                print("Adding owner_username column...")
                db.session.execute(text("ALTER TABLE schools ADD COLUMN owner_username VARCHAR(80)"))
                db.session.commit()
                print("OK: owner_username added")
            else:
                print("OK: owner_username already exists")
            
            # Добавляем owner_password_hash, если его нет
            if 'owner_password_hash' not in columns:
                print("Adding owner_password_hash column...")
                db.session.execute(text("ALTER TABLE schools ADD COLUMN owner_password_hash VARCHAR(200)"))
                db.session.commit()
                print("OK: owner_password_hash added")
            else:
                print("OK: owner_password_hash already exists")
            
            print("\nMigration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    check_and_migrate()




