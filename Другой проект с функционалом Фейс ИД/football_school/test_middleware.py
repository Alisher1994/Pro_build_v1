"""
Тестирование middleware для проверки school_id
"""
from app import app, db
from backend.models.models import User, School
from flask import g
from flask_login import login_user
from backend.middleware.school_middleware import setup_tenant_context

def test_middleware():
    with app.app_context():
        with app.test_request_context():
            print("=== Тест middleware ===\n")
            
            # Получаем пользователя
            user = User.query.filter_by(username='admin').first()
            if not user:
                user = User.query.first()
            
            if not user:
                print("❌ Пользователи не найдены в БД")
                return
            
            print(f"Пользователь: {user.username} (ID: {user.id})")
            print(f"  school_id: {user.school_id}")
            
            if user.school_id:
                school = School.query.get(user.school_id)
                if school:
                    print(f"  Школа: {school.name} (ID: {school.id}, Active: {school.is_active})")
                else:
                    print(f"  ❌ Школа с ID {user.school_id} не найдена!")
            else:
                print(f"  ⚠️  У пользователя нет school_id")
            
            # Симулируем login
            login_user(user)
            
            print("\n--- Вызов setup_tenant_context() ---")
            setup_tenant_context()
            
            print(f"\nРезультаты:")
            print(f"  g.current_school_id: {getattr(g, 'current_school_id', 'НЕ УСТАНОВЛЕН')}")
            print(f"  g.current_school: {getattr(g, 'current_school', 'НЕ УСТАНОВЛЕН')}")
            print(f"  g.is_super_admin: {getattr(g, 'is_super_admin', 'НЕ УСТАНОВЛЕН')}")
            
            if hasattr(g, 'current_school_id') and g.current_school_id:
                print(f"\n✅ Middleware работает корректно!")
            else:
                print(f"\n❌ Middleware НЕ установил school_id!")

if __name__ == '__main__':
    test_middleware()
