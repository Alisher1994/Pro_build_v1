# ⚡ Быстрая загрузка на VPS

## 📋 Шаги:

### 1. Подключитесь к серверу через WinSCP:
- Хост: `45.92.173.37`
- Пользователь: `root`
- Пароль: `12345678`

### 2. Загрузите эти файлы в `/opt/football_school/`:

**Новые файлы:**
- `frontend/templates/mobile_dashboard.html`
- `frontend/templates/mobile_add_student.html`

**Обновленные файлы:**
- `frontend/templates/mobile_payment.html`
- `app.py`

### 3. На сервере выполните команды:

```bash
ssh root@45.92.173.37
cd /opt/football_school
chown -R www-data:www-data /opt/football_school
systemctl restart football_school
systemctl status football_school --no-pager -l
```

### 4. Проверьте работу:
- `https://d-promo.uz/mobile-payments`
- `https://d-promo.uz/mobile-dashboard`
- `https://d-promo.uz/mobile-add-student`

**Готово!** ✅

