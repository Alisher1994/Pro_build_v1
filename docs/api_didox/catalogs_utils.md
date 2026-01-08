# Интеграция с Didox API: Справочники и Утилиты

Для корректного заполнения документов необходимо использовать актуальные данные из справочников.

## 1. Основные справочники
*   **Банки:** `GET /v1/banks/all` — получение списка всех банков Узбекистана (МФО, Название).
*   **Единицы измерения:** `GET /v1/measures/all` — классификатор (кг, шт, м3 и т.д.).
*   **Регионы:** `GET /v1/regions/all`.
*   **Районы:** `GET /v1/districts/all`.

---

## 2. Утилиты НДС
*   **Товары без НДС:** `GET /v1/utils/without-vat-products/:lang`.
*   **Товары с НДС 0%:** `GET /v1/utils/zero-vat-products/:lang`.
*   **Льготы по НДС:** 
    *   Для товаров: `POST /v1/utils/product-privileges/:lang`.
    *   Для компаний (плательщиков): `POST /v1/utils/company-privileges/:lang`.
    *   Для компаний (налог с оборота): `POST /v1/utils/companies-privileges/:lang`.

---

## 3. Транспорт и Локация
*   **Ж/Д Станции:** 
    *   Все станции: `GET /v1/utils/stations`.
    *   Детали: `GET /v1/utils/stations/:stationId`.
*   **Транспорт по ИНН:** `GET /v1/utils/waybills/transport?tinOrPinfl=ИНН`.
*   **Информация по адресу:**
    *   Регионы для ТТН: `GET /v1/utils/waybills/regions`.
    *   Районы для ТТН: `GET /v1/utils/waybills/districts?regionId={regionId}`.

---

## 4. Прочие утилиты
*   **Виды дохода:** `GET /v1/utils/income-types/:lang`.
*   **Прочие виды доходов:** `GET /v1/utils/other-income-product-classes/:lang`.
*   **Инфо по ИНН/ПИНФЛ:** `GET /v1/utils/info/{TinOrPinfl}` — быстрое получение реквизитов контрагента.
