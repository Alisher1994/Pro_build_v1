"""
Скрипт для автоматического создания супер-администратора (без интерактивного ввода)
Использует предустановленные данные
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, bcrypt
from backend.models.models import SuperAdmin

def create_superadmin_auto():
    """Создать супер-администратора с предустановленными данными"""
    with app.app_context():
        # Создаём таблицу, если её нет
        db.create_all()
        
        # Предустановленные данные (ИЗМЕНИТЕ НА СВОИ!)
        username = "superadmin"
        password = "superadmin123"  # ⚠️ ИЗМЕНИТЕ НА БЕЗОПАСНЫЙ ПАРОЛЬ!
        full_name = "Супер Администратор"
        email = None
        
        # Проверяем, существует ли уже суперадмин с таким логином
        existing = SuperAdmin.query.filter_by(username=username).first()
        if existing:
            print(f"[ERROR] Super admin with username '{username}' already exists!")
            print(f"   If you forgot the password, delete the record from database and run script again.")
            return False
        
        # Создаём нового суперадмина
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        superadmin = SuperAdmin(
            username=username,
            password_hash=password_hash,
            full_name=full_name,
            email=email,
            is_active=True
        )
        
        db.session.add(superadmin)
        db.session.commit()
        
        print("=" * 60)
        print("[SUCCESS] Super admin created successfully!")
        print("=" * 60)
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        if full_name:
            print(f"   Full Name: {full_name}")
        if email:
            print(f"   Email: {email}")
        print("\n[WARNING] IMPORTANT: Save these credentials in a safe place!")
        print("[WARNING] RECOMMENDED: Change password after first login!")
        print("\n[INFO] Login to system and go to /schools to manage schools")
        print("=" * 60)
        
        return True

if __name__ == '__main__':
    create_superadmin_auto()




