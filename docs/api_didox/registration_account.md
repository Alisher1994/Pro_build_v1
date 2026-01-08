# Интеграция с Didox API: Регистрация и Профиль

## 1. Регистрация нового пользователя
*   **Endpoint:** `POST /v1/auth/signup`
*   **Описание:** Регистрация по ключу ЭЦП. Необходимо передать данные пользователя и сформированную подпись с timestamp.
*   **Ответ:** Возвращает токен доступа (действителен 360 мин).

---

## 2. Управление аккаунтом
*   **Данные аккаунта:** `GET /v1/account` — получение информации о текущем профиле.
*   **Обновление данных:** `POST /v1/profile/update` — изменение данных текущего профиля.

---

## 3. Настройки профиля
*   **Привязанные операторы:** `GET /v1/profile/operators`.
*   **Филиалы:** `GET /v1/profile/branches?tin={ИНН}`.
*   **Склады:** `GET /v1/profile/warehouses/{ИНН_или_ПИНФЛ}`.
*   **Настройка ролей:** `PUT /v1/profile/company/users` — проставление ролей Didox и ГНК.

---

## 4. ГНК и ИКПУ (Коды товаров и услуг)
*   **Привязанные ИКПУ:** `GET /v1/profile/productClassCodes`.
*   **Добавление ИКПУ:** `POST /v1/profile/productClasses`.
*   **Удаление ИКПУ:** `DELETE /v1/profile/productClasses/{classCode}`.
*   **Поиск ИКПУ:** `GET /v1/profile/productClassCodes/?page=&lang=&search=`.
*   **Статус плательщика НДС:** `GET /v1/profile/vatRegStatus/:taxIdOrPinfl?document_date=`.
