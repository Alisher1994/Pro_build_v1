"""
Утилиты для работы со школами (SaaS multi-tenancy)
"""
from flask import session, request, g
from backend.models.models import School, SchoolFeature, db


def get_current_school():
    """
    Получить текущую школу из сессии или поддомена
    Возвращает объект School или None
    """
    # Проверяем в g (контекст запроса)
    if hasattr(g, 'current_school'):
        return g.current_school
    
    # Проверяем в сессии
    school_id = session.get('school_id')
    if school_id:
        school = School.query.get(school_id)
        if school and school.is_active:
            g.current_school = school
            return school
    
    # Проверяем поддомен (для будущей реализации)
    host = request.host
    if host and '.' in host:
        subdomain = host.split('.')[0]
        if subdomain and subdomain != 'www':
            school = School.query.filter_by(subdomain=subdomain, is_active=True).first()
            if school:
                session['school_id'] = school.id
                g.current_school = school
                return school
    
    return None


def get_current_school_id():
    """
    Получить ID текущей школы из всех возможных источников
    Приоритет: school_id текущего пользователя > g.current_school_id > session > первая школа
    Возвращает int или None
    """
    from flask import g, session
    from flask_login import current_user
    
    # 1. ПРИОРИТЕТ: Если пользователь аутентифицирован и у него есть school_id, используем его
    # Это самый надёжный способ - пользователь всегда должен работать со своей школой
    if current_user.is_authenticated:
        if hasattr(current_user, 'school_id') and current_user.school_id:
            school = School.query.get(current_user.school_id)
            if school and school.is_active:
                # Устанавливаем в g и сессию для кэширования
                if not hasattr(g, 'current_school_id') or g.current_school_id != current_user.school_id:
                    g.current_school_id = current_user.school_id
                    session['school_id'] = current_user.school_id
                return current_user.school_id
    
    # 2. Проверяем в g (контекст запроса) - установлено middleware или предыдущими вызовами
    if hasattr(g, 'current_school_id') and g.current_school_id:
        return g.current_school_id
    
    # 3. Проверяем в сессии
    school_id = session.get('school_id')
    if school_id:
        # Проверяем, что школа существует и активна
        school = School.query.get(school_id)
        if school and school.is_active:
            # Устанавливаем в g для последующих запросов
            g.current_school_id = school_id
            return school_id
    
    # 4. Если ничего не найдено и пользователь аутентифицирован, 
    # пробуем найти первую активную школу и привязать к пользователю
    # (это fallback для случаев, когда пользователь не привязан к школе)
    if current_user.is_authenticated:
        first_school = School.query.filter_by(is_active=True).first()
        if first_school:
            # Привязываем пользователя к школе, если у него её нет
            if hasattr(current_user, 'school_id') and not current_user.school_id:
                current_user.school_id = first_school.id
                db.session.commit()
            # Устанавливаем в g и сессию
            g.current_school_id = first_school.id
            session['school_id'] = first_school.id
            return first_school.id
    
    # Если ничего не найдено
    return None


def set_current_school(school_id):
    """
    Установить текущую школу в сессии
    """
    session['school_id'] = school_id
    # Очищаем кэш в g
    if hasattr(g, 'current_school'):
        delattr(g, 'current_school')


def is_feature_enabled(feature_name, school_id=None):
    """
    Проверить, включена ли функция для школы
    
    Args:
        feature_name: название функции (например, 'telegram_bot', 'rewards', 'cards')
        school_id: ID школы (если None, используется текущая школа)
    
    Returns:
        bool: True если функция включена, False если выключена или не найдена
    """
    if school_id is None:
        school = get_current_school()
        if not school:
            return False
        school_id = school.id
    
    feature = SchoolFeature.query.filter_by(
        school_id=school_id,
        feature_name=feature_name
    ).first()
    
    if not feature:
        # Если функция не найдена, считаем её выключенной
        return False
    
    return feature.enabled


def get_feature_settings(feature_name, school_id=None):
    """
    Получить настройки функции для школы
    
    Args:
        feature_name: название функции
        school_id: ID школы (если None, используется текущая школа)
    
    Returns:
        dict: словарь с настройками функции или пустой словарь
    """
    if school_id is None:
        school = get_current_school()
        if not school:
            return {}
        school_id = school.id
    
    feature = SchoolFeature.query.filter_by(
        school_id=school_id,
        feature_name=feature_name
    ).first()
    
    if not feature:
        return {}
    
    return feature.get_settings()


def enable_feature(school_id, feature_name, settings=None):
    """
    Включить функцию для школы
    
    Args:
        school_id: ID школы
        feature_name: название функции
        settings: словарь с настройками функции (опционально)
    """
    feature = SchoolFeature.query.filter_by(
        school_id=school_id,
        feature_name=feature_name
    ).first()
    
    if not feature:
        feature = SchoolFeature(
            school_id=school_id,
            feature_name=feature_name,
            enabled=True
        )
        db.session.add(feature)
    else:
        feature.enabled = True
    
    if settings:
        feature.set_settings(settings)
    
    db.session.commit()
    return feature


def disable_feature(school_id, feature_name):
    """
    Выключить функцию для школы
    
    Args:
        school_id: ID школы
        feature_name: название функции
    """
    feature = SchoolFeature.query.filter_by(
        school_id=school_id,
        feature_name=feature_name
    ).first()
    
    if feature:
        feature.enabled = False
        db.session.commit()
    
    return feature

