"""
Утилиты для работы с мультитенантностью
"""
from flask import g
from backend.models.models import db
from backend.middleware.school_middleware import get_current_school_id, is_super_admin


def filter_query_by_school(query, model_class):
    """
    Автоматически фильтровать запрос по school_id текущей школы
    Полная изоляция данных между школами
    
    Args:
        query: SQLAlchemy query объект
        model_class: класс модели, у которой есть school_id
    
    Returns:
        отфильтрованный query
    """
    # Супер-админ видит все данные (не фильтруем)
    if is_super_admin():
        return query
    
    # Для остальных пользователей ОБЯЗАТЕЛЬНО фильтруем по их школе
    school_id = get_current_school_id()
    if school_id and hasattr(model_class, 'school_id'):
        return query.filter(model_class.school_id == school_id)
    
    # Если school_id нет, возвращаем пустой результат (безопасность)
    if hasattr(model_class, 'school_id'):
        return query.filter(False)  # Пустой результат
    
    return query


def ensure_school_id(model_instance, school_id=None):
    """
    Убедиться, что у создаваемой записи установлен school_id
    Полная изоляция данных - каждая запись должна быть привязана к школе
    
    Args:
        model_instance: экземпляр модели для сохранения
        school_id: ID школы (если None, используется текущая школа)
    """
    if not hasattr(model_instance, 'school_id'):
        return
    
    # Супер-админ может создавать записи без school_id (для просмотра)
    if is_super_admin():
        if school_id:
            model_instance.school_id = school_id
        return
    
    # Для остальных пользователей ОБЯЗАТЕЛЬНО устанавливаем их школу
    if model_instance.school_id is None:
        if school_id is None:
            school_id = get_current_school_id()
        if school_id:
            model_instance.school_id = school_id
        else:
            # Если school_id не установлен, это ошибка безопасности
            raise ValueError("Не удалось определить school_id для записи. Изоляция данных нарушена.")






