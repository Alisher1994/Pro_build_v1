// ========================================
// UI Helper Functions
// ========================================

const UI = {
    // Показать модальное окно
    showModal(title, content, buttons, options = {}) {
        const modalClassName = options.modalClassName ? ` ${options.modalClassName}` : '';
        const modalStyleParts = [];
        if (options.width) modalStyleParts.push(`width: ${options.width};`);
        if (options.maxWidth) modalStyleParts.push(`max-width: ${options.maxWidth};`);
        if (options.maxHeight) modalStyleParts.push(`max-height: ${options.maxHeight};`);
        const modalStyle = modalStyleParts.length ? ` style="${modalStyleParts.join(' ')}"` : '';

        const modalHTML = `
            <div class="modal-overlay" id="modal-overlay">
                <div class="modal${modalClassName}"${modalStyle}>
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" onclick="UI.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${buttons || ''}
                    </div>
                </div>
            </div>
        `;

        const container = document.getElementById('modal-container');
        container.innerHTML = modalHTML;

        // Close on overlay click
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                UI.closeModal();
            }
        });
    },

    closeModal() {
        const container = document.getElementById('modal-container');
        container.innerHTML = '';
    },

    // Показать модальное окно загрузки с прогресс-баром
    showLoadingModal(title = 'Загрузка') {
        const modalHTML = `
            <div class="modal-overlay" id="loading-modal-overlay" style="background: rgba(0,0,0,0.8); z-index: 10000;">
                <div class="modal" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="modal-body" style="padding: 30px;">
                        <div style="margin-bottom: 15px; text-align: center;">
                            <div id="loading-progress-text" style="font-size: 32px; font-weight: 600; color: var(--primary); margin-bottom: 10px;">0%</div>
                            <div style="font-size: 14px; color: var(--gray-600);">Загрузка 3D модели...</div>
                        </div>
                        <div style="width: 100%; height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden;">
                            <div id="loading-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary), #4CAF50); transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Добавляем прямо в body для гарантированного отображения
        const existingModal = document.getElementById('loading-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // Обновить прогресс загрузки
    updateLoadingProgress(percent) {
        const progressBar = document.getElementById('loading-progress-bar');
        const progressText = document.getElementById('loading-progress-text');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }
    },

    // Закрыть модальное окно загрузки
    closeLoadingModal() {
        const overlay = document.getElementById('loading-modal-overlay');
        if (overlay) {
            overlay.remove();
        }
    },

    // Generic loading spinner overlay
    showLoading(isLoading, message = 'Загрузка...') {
        const id = 'generic-loading-overlay';
        const existing = document.getElementById(id);

        if (!isLoading) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;

        const html = `
            <div id="${id}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.7); z-index: 9999; display: flex; justify-content: center; align-items: center; flex-direction: column;">
                <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div style="margin-top: 16px; font-weight: 500; color: var(--gray-800);">${message}</div>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // Показать форму создания проекта
    showCreateProjectModal(callback, existingProject = null) {
        const content = `
            <div class="project-modal-layout">
                <div class="project-modal-left">
                    <div class="form-group">
                        <label>Название проекта *</label>
                        <input type="text" id="project-name" placeholder="Введите название" value="${existingProject?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Адрес</label>
                        <input type="text" id="project-address" placeholder="Введите адрес" value="${existingProject?.address || ''}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Статус</label>
                            <select id="project-status">
                                <option value="active" ${existingProject?.status === 'active' ? 'selected' : ''}>Активный</option>
                                <option value="paused" ${existingProject?.status === 'paused' ? 'selected' : ''}>Пауза</option>
                                <option value="closed" ${existingProject?.status === 'closed' ? 'selected' : ''}>Закрыт</option>
                                <option value="exploitation" ${existingProject?.status === 'exploitation' ? 'selected' : ''}>Эксплуатация</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Валюта проекта</label>
                            <input type="hidden" id="project-currency" value="${existingProject?.currency || 'RUB'}">
                            <div class="custom-select" id="modal-currency-select">
                                <div class="custom-select-trigger" tabindex="0">
                                    <img class="flag-icon" src="" alt="">
                                    <span class="select-text">Выберите валюту</span>
                                    <svg class="select-arrow" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5H7z"/></svg>
                                </div>
                                <div class="custom-select-options">
                                    <div class="custom-select-option" data-value="RUB">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/ru.png" alt="RU">
                                        <span>Российский рубль (₽)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="UZS">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/uz.png" alt="UZ">
                                        <span>Узбекский сум (сўм)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="USD">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/us.png" alt="US">
                                        <span>Доллар США ($)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="EUR">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/eu.png" alt="EU">
                                        <span>Евро (€)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="KGS">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/kg.png" alt="KG">
                                        <span>Киргизский сом (сом)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="KZT">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/kz.png" alt="KZ">
                                        <span>Казахский тенге (₸)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="TJS">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/tj.png" alt="TJ">
                                        <span>Таджикский сомони (ЅМ)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="TMT">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/tm.png" alt="TM">
                                        <span>Туркменский манат (m)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="AZN">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/az.png" alt="AZ">
                                        <span>Азербайджанский манат (₼)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="BYN">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/by.png" alt="BY">
                                        <span>Белорусский рубль (Br)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="UAH">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/ua.png" alt="UA">
                                        <span>Украинская гривна (₴)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="GBP">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/gb.png" alt="GB">
                                        <span>Фунт стерлингов (£)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="CNY">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/cn.png" alt="CN">
                                        <span>Китайский юань (¥)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="TRY">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/tr.png" alt="TR">
                                        <span>Турецкая лира (₺)</span>
                                    </div>
                                    <div class="custom-select-option" data-value="AED">
                                        <img class="flag-icon" src="https://flagcdn.com/w40/ae.png" alt="AE">
                                        <span>Дирхам ОАЭ (د.إ)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Дата начала</label>
                            <input type="date" id="project-start-date" value="${existingProject?.startDate || ''}">
                        </div>
                        <div class="form-group">
                            <label>Дата окончания</label>
                            <input type="date" id="project-end-date" value="${existingProject?.endDate || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Заказчик</label>
                            <input type="text" id="project-customer" placeholder="Название компании" value="${existingProject?.customer || ''}">
                        </div>
                        <div class="form-group">
                            <label>Генподрядчик</label>
                            <input type="text" id="project-contractor" placeholder="Название компании" value="${existingProject?.contractor || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Менеджер проекта</label>
                            <input type="text" id="project-manager" placeholder="ФИО менеджера" value="${existingProject?.manager || ''}">
                        </div>
                        <div class="form-group">
                            <label>Заместитель менеджера</label>
                            <input type="text" id="project-deputy" placeholder="ФИО заместителя" value="${existingProject?.deputy || ''}">
                        </div>
                    </div>
                </div>
                <div class="project-modal-right">
                    <div class="photo-upload-container">
                        <div class="photo-upload-area" id="photo-upload-area">
                            <div class="photo-upload-text">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <p>Вставьте фото проекта</p>
                                <span>Ctrl+V или щелкните для выбора</span>
                            </div>
                        </div>
                        <input type="file" id="photo-file-input" accept="image/*" style="display: none;">
                    </div>
                    <div class="map-container">
                        <div id="project-map"></div>
                    </div>
                </div>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-project-btn">${existingProject ? 'Сохранить' : 'Создать'}</button>
        `;

        UI.showModal(existingProject ? 'Редактировать проект' : 'Новый проект', content, buttons);

        setTimeout(() => {
            // Инициализация Яндекс.Карты
            if (window.ymaps) {
                ymaps.ready(() => {
                    // Проверяем, есть ли сохраненные координаты
                    const hasExistingCoords = existingProject?.latitude && existingProject?.longitude;
                    const initialCenter = hasExistingCoords
                        ? [existingProject.latitude, existingProject.longitude]
                        : null;

                    // Определяем геолокацию пользователя
                    ymaps.geolocation.get({
                        provider: 'yandex',
                        mapStateAutoApply: true
                    }).then(function (result) {
                        const userCoords = result.geoObjects.position;
                        const map = new ymaps.Map('project-map', {
                            center: initialCenter || userCoords || [41.31, 69.24], // Приоритет: сохраненные координаты > геолокация > Ташкент
                            zoom: 12,
                            controls: ['zoomControl', 'geolocationControl']
                        });

                        // Если есть сохраненные координаты, добавляем метку
                        if (hasExistingCoords) {
                            savedMapCoords = [existingProject.latitude, existingProject.longitude];
                            const placemark = new ymaps.Placemark(savedMapCoords, {}, {
                                preset: 'islands#redDotIcon'
                            });
                            map.geoObjects.add(placemark);
                        }

                        // Добавляем метку при клике
                        map.events.add('click', function (e) {
                            const coords = e.get('coords');
                            savedMapCoords = coords; // Сохраняем координаты
                            map.geoObjects.removeAll();
                            const placemark = new ymaps.Placemark(coords, {}, {
                                preset: 'islands#redDotIcon'
                            });
                            map.geoObjects.add(placemark);

                            // Получаем адрес
                            ymaps.geocode(coords).then(function (res) {
                                const firstGeoObject = res.geoObjects.get(0);
                                const address = firstGeoObject.getAddressLine();
                                document.getElementById('project-address').value = address;
                            });
                        });
                    }).catch(function () {
                        // Если геолокация не работает, используем Ташкент по умолчанию
                        const map = new ymaps.Map('project-map', {
                            center: initialCenter || [41.31, 69.24],
                            zoom: 12,
                            controls: ['zoomControl', 'geolocationControl']
                        });

                        // Если есть сохраненные координаты, добавляем метку
                        if (hasExistingCoords) {
                            savedMapCoords = [existingProject.latitude, existingProject.longitude];
                            const placemark = new ymaps.Placemark(savedMapCoords, {}, {
                                preset: 'islands#redDotIcon'
                            });
                            map.geoObjects.add(placemark);
                        }

                        map.events.add('click', function (e) {
                            const coords = e.get('coords');
                            savedMapCoords = coords; // Сохраняем координаты
                            map.geoObjects.removeAll();
                            const placemark = new ymaps.Placemark(coords, {}, {
                                preset: 'islands#redDotIcon'
                            });
                            map.geoObjects.add(placemark);

                            ymaps.geocode(coords).then(function (res) {
                                const firstGeoObject = res.geoObjects.get(0);
                                const address = firstGeoObject.getAddressLine();
                                document.getElementById('project-address').value = address;
                            });
                        });
                    });
                });
            }

            // Обработка загрузки фото
            const photoArea = document.getElementById('photo-upload-area');
            const fileInput = document.getElementById('photo-file-input');
            let uploadedPhotoData = existingProject?.photo || null;
            let savedMapCoords = null;

            // Инициализация кастомного select для валюты
            const modalCurrencySelect = document.getElementById('modal-currency-select');
            const modalCurrencyInput = document.getElementById('project-currency');
            const modalCurrencyTrigger = modalCurrencySelect.querySelector('.custom-select-trigger');
            const modalCurrencyOptions = modalCurrencySelect.querySelectorAll('.custom-select-option');

            // Установить начальное значение
            const modalCurrentCurrency = modalCurrencyInput.value || 'RUB';
            const modalCurrentOption = modalCurrencySelect.querySelector(`[data-value="${modalCurrentCurrency}"]`);
            if (modalCurrentOption) {
                const flagSrc = modalCurrentOption.querySelector('.flag-icon').src;
                const text = modalCurrentOption.querySelector('span').textContent;
                modalCurrencyTrigger.querySelector('.flag-icon').src = flagSrc;
                modalCurrencyTrigger.querySelector('.select-text').textContent = text;
                modalCurrentOption.classList.add('selected');
            }

            // Открытие/закрытие dropdown
            modalCurrencyTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                modalCurrencySelect.classList.toggle('open');
            });

            // Выбор опции
            modalCurrencyOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = option.dataset.value;
                    const flagSrc = option.querySelector('.flag-icon').src;
                    const text = option.querySelector('span').textContent;

                    modalCurrencyInput.value = value;
                    modalCurrencyTrigger.querySelector('.flag-icon').src = flagSrc;
                    modalCurrencyTrigger.querySelector('.select-text').textContent = text;

                    modalCurrencyOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    modalCurrencySelect.classList.remove('open');
                });
            });

            // Закрытие при клике снаружи
            document.addEventListener('click', (e) => {
                if (!modalCurrencySelect.contains(e.target)) {
                    modalCurrencySelect.classList.remove('open');
                }
            });

            // Если есть существующее фото, отображаем его
            if (existingProject?.photo) {
                photoArea.style.backgroundImage = `url(${existingProject.photo})`;
                photoArea.style.backgroundSize = 'cover';
                photoArea.style.backgroundPosition = 'center';
                photoArea.innerHTML = '';
            }

            // Клик для выбора файла
            photoArea.addEventListener('click', () => {
                fileInput.click();
            });

            // Выбор файла
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    displayPhoto(file);
                }
            });

            // Вставка из буфера обмена
            document.addEventListener('paste', handlePaste);

            function handlePaste(e) {
                const items = e.clipboardData?.items;
                if (!items) return;

                for (let item of items) {
                    if (item.type.indexOf('image') !== -1) {
                        const file = item.getAsFile();
                        displayPhoto(file);
                        e.preventDefault();
                        break;
                    }
                }
            }

            function displayPhoto(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedPhotoData = e.target.result;
                    photoArea.style.backgroundImage = `url(${uploadedPhotoData})`;
                    photoArea.style.backgroundSize = 'cover';
                    photoArea.style.backgroundPosition = 'center';
                    photoArea.innerHTML = '';
                };
                reader.readAsDataURL(file);
            }

            document.getElementById('save-project-btn').addEventListener('click', () => {
                const data = {
                    name: document.getElementById('project-name').value.trim(),
                    address: document.getElementById('project-address').value.trim(),
                    status: document.getElementById('project-status').value,
                    currency: document.getElementById('project-currency').value,
                    manager: document.getElementById('project-manager').value.trim(),
                    deputy: document.getElementById('project-deputy').value.trim(),
                    customer: document.getElementById('project-customer').value.trim(),
                    contractor: document.getElementById('project-contractor').value.trim(),
                    startDate: document.getElementById('project-start-date').value || null,
                    endDate: document.getElementById('project-end-date').value || null,
                    photo: uploadedPhotoData,
                    coordinates: savedMapCoords ? {
                        latitude: savedMapCoords[0],
                        longitude: savedMapCoords[1]
                    } : null
                };

                if (!data.name) {
                    UI.showNotification('Пожалуйста, введите название проекта', 'error');
                    return;
                }

                // Удаляем обработчик paste при закрытии
                document.removeEventListener('paste', handlePaste);
                callback(data);
            });
        }, 100);
    },

    // Показать форму создания блока
    showCreateBlockModal(projectId, callback) {
        const content = `
            <div class="form-group">
                <label>Название блока *</label>
                <input type="text" id="block-name" placeholder="Блок А, Корпус 1 и т.д." required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="block-description" placeholder="Описание блока"></textarea>
            </div>
            <div class="form-group">
                <label>Количество этажей (надземных)</label>
                <input type="number" id="block-floors" value="1" min="1">
            </div>
            <div class="form-group">
                <label>Количество подземных этажей</label>
                <input type="number" id="block-underground-floors" value="0" min="0">
            </div>
            <div class="form-group">
                <label>Площадь (м²)</label>
                <input type="number" id="block-area" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label>Очередь строительства</label>
                <input type="number" id="block-phase" value="1" min="1">
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-block-btn">Создать</button>
        `;

        UI.showModal('Новый блок', content, buttons);

        setTimeout(() => {
            document.getElementById('save-block-btn').addEventListener('click', () => {
                const data = {
                    projectId,
                    name: document.getElementById('block-name').value.trim(),
                    description: document.getElementById('block-description').value.trim(),
                    floors: parseInt(document.getElementById('block-floors').value) || 1,
                    undergroundFloors: parseInt(document.getElementById('block-underground-floors').value) || 0,
                    area: parseFloat(document.getElementById('block-area').value) || null,
                    constructionPhase: parseInt(document.getElementById('block-phase').value) || 1,
                };

                if (!data.name) {
                    UI.showNotification('Пожалуйста, введите название блока', 'error');
                    return;
                }

                callback(data);
            });
        }, 100);
    },

    // Показать форму создания раздела сметы
    showCreateSectionModal(estimateId, callback) {
        const content = `
            <div class="form-group">
                <label>Код раздела *</label>
                <select id="section-code">
                    <option value="">-- Выберите раздел --</option>
                    <option value="АР">АР - Архитектурные решения</option>
                    <option value="КЖ">КЖ - Конструкции железобетонные</option>
                    <option value="КМ">КМ - Конструкции металлические</option>
                    <option value="ОВ">ОВ - Отопление и вентиляция</option>
                    <option value="ВК">ВК - Водоснабжение и канализация</option>
                    <option value="ЭОМ">ЭОМ - Электрооборудование и электроосвещение</option>
                    <option value="СС">СС - Сети связи</option>
                    <option value="БЛАГ">БЛАГ - Благоустройство территории</option>
                    <option value="ПОС">ПОС - Проект организации строительства</option>
                </select>
            </div>
            <div class="form-group">
                <label>Название раздела *</label>
                <input type="text" id="section-name" placeholder="Полное название раздела">
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="section-description" placeholder="Описание раздела"></textarea>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-section-btn">Создать</button>
        `;

        UI.showModal('Новый раздел сметы', content, buttons);

        setTimeout(() => {
            // Auto-fill name based on code selection
            document.getElementById('section-code').addEventListener('change', (e) => {
                const selected = e.target.selectedOptions[0].text;
                if (selected !== '-- Выберите раздел --') {
                    document.getElementById('section-name').value = selected;
                }
            });

            document.getElementById('save-section-btn').addEventListener('click', () => {
                const data = {
                    estimateId,
                    code: document.getElementById('section-code').value,
                    name: document.getElementById('section-name').value.trim(),
                    description: document.getElementById('section-description').value.trim(),
                };

                if (!data.code || !data.name) {
                    UI.showNotification('Пожалуйста, заполните обязательные поля', 'error');
                    return;
                }

                callback(data);
            });
        }, 100);
    },

    // Форматирование числа (1 000 000)
    formatNumber(num, fractionDigits) {
        if (num === null || num === undefined) return '';
        const parsed = Number(num);
        if (!Number.isFinite(parsed)) return '';
        const fixed = typeof fractionDigits === 'number' ? parsed.toFixed(fractionDigits) : parsed.toString();
        return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    // Форматирование валюты с символом
    formatCurrency(amount, currencyCode = 'RUB') {
        if (amount === null || amount === undefined) return '';

        const formatted = this.formatNumber(amount);
        const symbols = {
            'RUB': '₽',
            'UZS': 'сўм',
            'USD': '$',
            'EUR': '€',
            'KGS': 'сом',
            'KZT': '₸',
            'TJS': 'ЅМ',
            'TMT': 'm',
            'AZN': '₼',
            'BYN': 'Br',
            'UAH': '₴',
            'GBP': '£',
            'CNY': '¥',
            'TRY': '₺',
            'AED': 'د.إ'
        };

        const symbol = symbols[currencyCode] || currencyCode;

        // Для некоторых валют символ ставится перед суммой
        if (['USD', 'EUR', 'GBP', 'CNY'].includes(currencyCode)) {
            return `${symbol}${formatted}`;
        }

        return `${formatted} ${symbol}`;
    },

    // Получить текущую валюту проекта
    getCurrentCurrency() {
        // Получаем из EstimateManager или используем RUB по умолчанию
        if (typeof EstimateManager !== 'undefined' && EstimateManager.currentProject) {
            return EstimateManager.currentProject.currency || 'RUB';
        }
        return 'RUB';
    },

    // Форматирование даты
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    },

    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'error' ? '#D13438' : type === 'success' ? '#107C10' : '#0078D4'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // Показать модальное окно подтверждения с promise
    showConfirmDialog(title, message, confirmText = 'Да', cancelText = 'Нет') {
        return new Promise((resolve) => {
            const content = `
                <p style="font-size: 14px; color: var(--gray-700); margin: 0;">${message}</p>
            `;

            const buttons = `
                <button class="btn btn-secondary" id="confirm-cancel-btn">${cancelText}</button>
                <button class="btn btn-danger" id="confirm-ok-btn">${confirmText}</button>
            `;

            UI.showModal(title, content, buttons);

            setTimeout(() => {
                document.getElementById('confirm-ok-btn').addEventListener('click', () => {
                    UI.closeModal();
                    resolve(true);
                });

                document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
                    UI.closeModal();
                    resolve(false);
                });
            }, 100);
        });
    },

    // Подтверждение удаления
    confirmDelete(message, callback) {
        if (confirm(message)) {
            callback();
        }
    },

    // Показать диалог подтверждения
    showConfirmDialog(title, message, confirmText = 'Да', cancelText = 'Нет') {
        return new Promise((resolve) => {
            const content = `
                <p style="font-size: 14px; margin: 16px 0;">${message}</p>
            `;

            const buttons = `
                <button class="btn btn-secondary" id="confirm-cancel-btn">${cancelText}</button>
                <button class="btn btn-primary" id="confirm-ok-btn">${confirmText}</button>
            `;

            UI.showModal(title, content, buttons);

            setTimeout(() => {
                document.getElementById('confirm-ok-btn').addEventListener('click', () => {
                    UI.closeModal();
                    resolve(true);
                });
                document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
                    UI.closeModal();
                    resolve(false);
                });
            }, 100);
        });
    }
};

// CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
