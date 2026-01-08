# Интеграция с Didox API: Шаблоны и Оферта

## 1. Шаблоны документов (Templates)
Didox позволяет создавать и использовать шаблоны, что упрощает генерацию однотипных договоров.
*   **Список шаблонов:** `GET /v1/document-template?size=&page=&docType=`.
*   **Получение шаблона:** `GET /v1/document-template/:id`.
*   **Создание шаблона:** `POST /v1/document-template`.
*   **Обновление:** `PUT /v1/document-template/:id`.
*   **Удаление:** `DELETE /v1/document-template/:id`.

---

## 2. Подписание публичной оферты
После регистрации или при обновлении условий системы, пользователю необходимо подписать оферту Didox.
*   **Получение оферты (Base64):** `GET /v1/newoffer/base64`.
*   **Создание документа оферты:** `POST /v1/documents/offer/create`.
*   **Подписание оферты:** `POST /v1/documents/offer/sign` (требуется подпись ЭЦП).
