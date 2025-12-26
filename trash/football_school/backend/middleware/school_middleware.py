"""
Middleware для автоматической фильтрации данных по школе (мультитенантность)
"""
from flask import g, session, request
from flask_login import current_user
from backend.models.models import School, SuperAdmin, db


def setup_tenant_context():
    """
    Устанавливает контекст текущей школы перед каждым запросом
    Автоматически фильтрует все данные по school_id
    """
    try:
        print(f"[SETUP] setup_tenant_context вызван, user authenticated: {current_user.is_authenticated}")
        # Для супер-админа - не фильтруем данные, но можем выбрать школу для просмотра
        if current_user.is_authenticated and isinstance(current_user, SuperAdmin):
            # Супер-админ может выбрать школу из сессии для просмотра
            school_id = session.get('view_school_id')
            if school_id:
                school = School.query.get(school_id)
                g.current_school = school
                g.current_school_id = school_id if school else None
            else:
                g.current_school = None
                g.current_school_id = None
            g.is_super_admin = True
            return
        
        # Для обычных пользователей (админов школ) - автоматически устанавливаем их школу
        if current_user.is_authenticated:
            print(f"  [USER] User: {current_user.username}, has school_id: {hasattr(current_user, 'school_id')}")
            if hasattr(current_user, 'school_id'):
                print(f"  [SCHOOL] current_user.school_id = {current_user.school_id}")
            school_id = None
            if hasattr(current_user, 'school_id') and current_user.school_id:
                # Проверяем, что школа активна
                school = School.query.get(current_user.school_id)
                if school and school.is_active:
                    school_id = current_user.school_id
                    session['school_id'] = school_id
                    g.current_school = school
                    g.current_school_id = school_id
                    g.is_super_admin = False
                    print(f"  [OK] Установлен school_id: {school_id}, школа: {school.name}")
                else:
                    # Школа неактивна или не найдена - ищем первую активную
                    first_school = School.query.filter_by(is_active=True).first()
                    if first_school:
                        school_id = first_school.id
                        # Обновляем пользователя в БД
                        current_user.school_id = school_id
                        db.session.commit()
                        session['school_id'] = school_id
                        g.current_school = first_school
                        g.current_school_id = school_id
                    else:
                        g.current_school = None
                        g.current_school_id = None
                    g.is_super_admin = False
            else:
                # У пользователя нет school_id - ищем первую активную школу
                first_school = School.query.filter_by(is_active=True).first()
                if first_school:
                    school_id = first_school.id
                    # Обновляем пользователя в БД
                    current_user.school_id = school_id
                    db.session.commit()
                    session['school_id'] = school_id
                    g.current_school = first_school
                    g.current_school_id = school_id
                else:
                    g.current_school = None
                    g.current_school_id = None
                g.is_super_admin = False
        else:
            g.current_school = None
            g.current_school_id = None
            g.is_super_admin = False
    except Exception as e:
        # Если произошла ошибка, устанавливаем безопасные значения
        import traceback
        print(f"[ERROR] Ошибка в setup_tenant_context: {e}")
        print(traceback.format_exc())
        g.current_school = None
        g.current_school_id = None
        g.is_super_admin = False


def get_current_school_id():
    """Получить ID текущей школы"""
    if hasattr(g, 'current_school_id'):
        return g.current_school_id
    return None


def get_current_school():
    """Получить объект текущей школы"""
    if hasattr(g, 'current_school'):
        return g.current_school
    return None


def is_super_admin():
    """Проверить, является ли пользователь супер-админом"""
    if hasattr(g, 'is_super_admin'):
        return g.is_super_admin
    return False


# Обратная совместимость
def before_request_handler():
    """Алиас для setup_tenant_context (обратная совместимость)"""
    setup_tenant_context()

