# 🤖 Настройка Telegram бота на VPS

## 📋 Шаг 1: Проверка зависимостей

Подключитесь к серверу и проверьте, установлен ли `python-telegram-bot`:

```bash
cd /opt/football_school
source venv/bin/activate
pip list | grep telegram
```

Если не установлен, установите:

```bash
pip install python-telegram-bot
```

## 📋 Шаг 2: Настройка переменных окружения

### Вариант A: Через .env файл (рекомендуется)

Отредактируйте `.env` файл:

```bash
nano /opt/football_school/.env
```

Добавьте или обновите:

```env
APP_URL=https://d-promo.uz
TELEGRAM_BOT_TOKEN=ваш_токен_бота_от_BotFather
```

### Вариант B: Через настройки приложения

1. Войдите в приложение: `https://d-promo.uz`
2. Перейдите в **Настройки**
3. Найдите раздел **Telegram бот**
4. Введите токен бота и сохраните

## 📋 Шаг 3: Установка systemd сервиса

1. **Скопируйте service файл:**

```bash
cd /opt/football_school
cp telegram_bot.service /etc/systemd/system/
```

2. **Обновите токен в service файле (если используете переменную окружения):**

```bash
# Получите токен из .env
TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d '=' -f2)

# Обновите service файл
sed -i "s/Environment=\"TELEGRAM_BOT_TOKEN=\"/Environment=\"TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN\"/" /etc/systemd/system/telegram_bot.service
```

Или отредактируйте вручную:

```bash
nano /etc/systemd/system/telegram_bot.service
```

Найдите строку:
```
Environment="TELEGRAM_BOT_TOKEN="
```

И замените на:
```
Environment="TELEGRAM_BOT_TOKEN=ваш_токен_бота"
```

3. **Перезагрузите systemd:**

```bash
systemctl daemon-reload
```

4. **Включите автозапуск:**

```bash
systemctl enable telegram_bot
```

5. **Запустите сервис:**

```bash
systemctl start telegram_bot
```

6. **Проверьте статус:**

```bash
systemctl status telegram_bot --no-pager -l
```

## 📋 Шаг 4: Проверка работы

### Проверьте логи:

```bash
# Последние логи
journalctl -u telegram_bot -n 50 --no-pager

# Логи в реальном времени
journalctl -u telegram_bot -f
```

### Проверьте работу бота:

1. Найдите вашего бота в Telegram (через @BotFather)
2. Отправьте команду `/start`
3. Бот должен ответить

## 🔧 Устранение проблем

### Бот не запускается:

1. **Проверьте токен:**
   ```bash
   # Проверьте, что токен установлен
   systemctl show telegram_bot | grep TELEGRAM_BOT_TOKEN
   ```

2. **Проверьте логи:**
   ```bash
   journalctl -u telegram_bot -n 100 --no-pager
   ```

3. **Проверьте, что APP_URL правильный:**
   ```bash
   # Должен быть https://d-promo.uz
   systemctl show telegram_bot | grep APP_URL
   ```

### Бот не отвечает:

1. **Проверьте, что бот запущен:**
   ```bash
   systemctl status telegram_bot
   ```

2. **Проверьте, что токен правильный:**
   - Получите новый токен от @BotFather в Telegram
   - Обновите в настройках приложения или в .env

3. **Проверьте доступность API:**
   ```bash
   curl https://d-promo.uz/api/club-settings/public
   ```

## 📝 Полезные команды

```bash
# Перезапуск бота
systemctl restart telegram_bot

# Остановка бота
systemctl stop telegram_bot

# Просмотр логов
journalctl -u telegram_bot -f

# Проверка статуса
systemctl status telegram_bot
```

