"""
Скрипт для автоматического создания супер-администратора (без интерактивного ввода)
"""
from app import app, db, bcrypt
from backend.models.models import User

def create_super_admin():
    """Создать супер-администратора"""
    with app.app_context():
        print("Создание супер-администратора...")
        
        # Проверяем, есть ли уже супер-админ
        super_admin = User.query.filter_by(role='super_admin').first()
        if super_admin:
            print(f"[INFO] Супер-администратор уже существует: {super_admin.username}")
            return
        
        # Создаём супер-админа с предустановленными данными
        username = "superadmin"
        password = "superadmin123"  # Измените на свой пароль!
        
        super_admin = User(
            username=username,
            password_hash=bcrypt.generate_password_hash(password).decode('utf-8'),
            role='super_admin',
            school_id=None,  # Супер-админ не привязан к школе
            is_active=True
        )
        
        db.session.add(super_admin)
        db.session.commit()
        
        print(f"[SUCCESS] Супер-администратор создан!")
        print(f"Логин: {username}")
        print(f"Пароль: {password}")
        print("\n[WARNING] ВАЖНО: Измените пароль после первого входа!")
        print("Войдите в систему и перейдите на страницу /schools для управления школами")

if __name__ == '__main__':
    create_super_admin()

