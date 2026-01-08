# Интеграция с Didox API: Работа с документами

## 1. Управление списком
*   **Список документов:** `GET /v2/documents`
    *   Фильтры: `page`, `limit`, `owner` (0 - входящие, 1 - исходящие), `doctype`, `status`.
*   **Счетчики:** `GET /v2/documents/statistics/all` — количество документов по статусам.
*   **Детализация:** `GET /v1/documents/{id}` — подробная информация о документе.

---

## 2. Жизненный цикл документа

### Создание
*   **Черновик:** `POST /v1/documents/:docType/create`
*   **Обновление черновика:** `POST /v1/documents/:docId/update/:doctype`
*   **Удаление черновика:** `POST /v1/documents/:docId/delete/draft`

### Подписание и Отмена
*   **Подписание исходящего:** `POST /v1/documents/:docId/sign`.
*   **Подписание (принятие) входящего:** `POST /v1/documents/:docId/sign`.
*   **Отклонение (отказ):** `POST /v1/documents/:docId/reject`.
*   **Отмена документа:** `POST /v1/documents/:docId/delete`.

---

## 3. Просмотр и выгрузка
*   **HTML форма:** `GET /v1/documents/view/:id/html/:locale`.
*   **PDF форма:** `GET /v1/documents/view/:id/pdf/:locale`.
*   **Base64 PDF:** `GET /v1/documents/{id}/file/true`.
*   **Архив (ZIP):** `GET /v1/documents/:id/archive`.
    *   Состав: JSON, PDF, файлы подписей. Ссылка валидна 5 минут.

---

## 4. Специфические действия
*   **Информация для подписания:** `POST /v1/documents/:docId/tosign`
    *   Используется для получения данных, которые нужно хешировать и подписывать.
    *   `action`: `accept`, `cancel`, `reject`.
*   **Доверенные лица:** `GET /v2/documents?owner=0&status=60` — список ЭСФ на доверенные лица.
