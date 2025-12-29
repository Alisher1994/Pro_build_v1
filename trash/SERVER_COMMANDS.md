# Команды для выполнения на сервере

Выполните эти команды по порядку:

## 1. Переход в директорию проекта
```bash
cd /opt/football_school
```

## 2. Установка прав доступа
```bash
chown -R www-data:www-data /opt/football_school
chmod -R 775 /opt/football_school/database
chmod -R 775 /opt/football_school/frontend/static/uploads
```

## 3. Перезапуск сервиса
```bash
systemctl restart football_school
```

## 4. Проверка статуса
```bash
systemctl status football_school --no-pager -l
```

## 5. Просмотр логов (если есть ошибки)
```bash
journalctl -u football_school -n 50 --no-pager
```

## 6. Перезагрузка Nginx (если нужно)
```bash
systemctl reload nginx
```

---

## Все команды одной строкой (для копирования):

```bash
cd /opt/football_school && chown -R www-data:www-data /opt/football_school && chmod -R 775 /opt/football_school/database && chmod -R 775 /opt/football_school/frontend/static/uploads && systemctl restart football_school && systemctl status football_school --no-pager -l
```


