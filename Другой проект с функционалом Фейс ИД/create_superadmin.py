"""
Скрипт для создания супер-администратора платформы
"""
import os
import sys

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, bcrypt
from backend.models.models import SuperAdmin

def create_superadmin(username, password, full_name=None, email=None):
    """Создать супер-администратора"""
    with app.app_context():
        # Проверяем, существует ли уже суперадмин с таким логином
        existing = SuperAdmin.query.filter_by(username=username).first()
        if existing:
            print(f"❌ Супер-администратор с логином '{username}' уже существует!")
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
        
        print(f"✅ Супер-администратор '{username}' успешно создан!")
        print(f"   Логин: {username}")
        print(f"   Пароль: {password}")
        if full_name:
            print(f"   ФИО: {full_name}")
        if email:
            print(f"   Email: {email}")
        print("\n⚠️  Сохраните эти данные в безопасном месте!")
        
        return True

if __name__ == '__main__':
    print("=" * 60)
    print("Создание супер-администратора платформы")
    print("=" * 60)
    
    # Создаём таблицу, если её нет
    with app.app_context():
        db.create_all()
    
    # Запрашиваем данные
    username = input("\nВведите логин супер-администратора: ").strip()
    if not username:
        print("❌ Логин не может быть пустым!")
        sys.exit(1)
    
    password = input("Введите пароль: ").strip()
    if not password:
        print("❌ Пароль не может быть пустым!")
        sys.exit(1)
    
    full_name = input("Введите ФИО (необязательно): ").strip() or None
    email = input("Введите email (необязательно): ").strip() or None
    
    print("\n" + "=" * 60)
    create_superadmin(username, password, full_name, email)
    print("=" * 60)




