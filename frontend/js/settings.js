// ========================================
// Settings Module - Управление настройками проекта
// ========================================

const SettingsManager = {
    currentProjectId: null,

    async showToleranceSettings(projectId) {
        this.currentProjectId = projectId;
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                <h1 style="margin-bottom: 32px; color: var(--gray-900); font-size: 28px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 12px;">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                    </svg>
                    Инструкции и допуски
                </h1>
                
                <div style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); text-align: center;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 16px;">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <h3 style="margin-bottom: 12px; color: var(--gray-800);">Раздел в разработке</h3>
                    <p style="color: var(--gray-600); max-width: 400px; margin: 0 auto;">
                        Здесь будут отображаться инструкции по выполнению работ, допуски (tolerances) и стандарты качества.
                    </p>
                </div>
            </div>
        `;
    },

    async showProjectSettings(projectId) {
        this.currentProjectId = projectId;

        try {
            // Получаем данные проекта
            const project = await api.getProject(projectId);

            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h1 style="margin-bottom: 32px; color: var(--gray-900); font-size: 28px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 12px;">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"/>
                        </svg>
                        Настройки проекта
                    </h1>
                    
                    <div style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <form id="project-settings-form">
                            <!-- Название объекта -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Название объекта *
                                </label>
                                <input 
                                    type="text" 
                                    id="project-name" 
                                    name="name"
                                    value="${project.name || ''}"
                                    required
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Адрес объекта -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Адрес объекта
                                </label>
                                <input 
                                    type="text" 
                                    id="project-address" 
                                    name="address"
                                    value="${project.address || ''}"
                                    placeholder="Введите адрес объекта"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Заказчик -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Заказчик
                                </label>
                                <input 
                                    type="text" 
                                    id="project-client" 
                                    name="client"
                                    value="${project.client || ''}"
                                    placeholder="Название организации заказчика"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Валюта -->
                            <div style="margin-bottom: 32px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Валюта проекта *
                                </label>
                                <input type="hidden" id="project-currency" name="currency" value="${project.currency || 'RUB'}">
                                <div class="custom-select" id="currency-select">
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

                            <!-- Статус проекта -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Статус проекта
                                </label>
                                <select 
                                    id="project-status" 
                                    name="status"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; background: white; cursor: pointer; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                >
                                    <option value="active" ${(project.status || 'active') === 'active' ? 'selected' : ''}>🟢 Активный</option>
                                    <option value="paused" ${project.status === 'paused' ? 'selected' : ''}>⏸️ Пауза</option>
                                    <option value="closed" ${project.status === 'closed' ? 'selected' : ''}>🔴 Закрыт</option>
                                    <option value="exploitation" ${project.status === 'exploitation' ? 'selected' : ''}>🏗️ Эксплуатация</option>
                                </select>
                            </div>

                            <!-- Менеджер проекта -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Менеджер проекта
                                </label>
                                <input 
                                    type="text" 
                                    id="project-manager" 
                                    name="manager"
                                    value="${project.manager || ''}"
                                    placeholder="ФИО менеджера проекта"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Заместитель менеджера -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Заместитель менеджера
                                </label>
                                <input 
                                    type="text" 
                                    id="project-deputy" 
                                    name="deputy"
                                    value="${project.deputy || ''}"
                                    placeholder="ФИО заместителя менеджера"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Заказчик (Customer) -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Заказчик
                                </label>
                                <input 
                                    type="text" 
                                    id="project-customer" 
                                    name="customer"
                                    value="${project.customer || ''}"
                                    placeholder="Название компании заказчика"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Генподрядчик -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Генподрядчик
                                </label>
                                <input 
                                    type="text" 
                                    id="project-contractor" 
                                    name="contractor"
                                    value="${project.contractor || ''}"
                                    placeholder="Название генподрядчика"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Дополнительная информация -->
                            <div style="border-top: 1px solid var(--gray-200); padding-top: 24px; margin-bottom: 24px;">
                                <h3 style="margin-bottom: 16px; color: var(--gray-800); font-size: 16px;">Дополнительная информация</h3>
                                
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                        Описание проекта
                                    </label>
                                    <textarea 
                                        id="project-description" 
                                        name="description"
                                        rows="4"
                                        placeholder="Краткое описание проекта"
                                        style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; resize: vertical; transition: border-color 0.2s;"
                                        onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                        onblur="this.style.borderColor='var(--gray-300)';"
                                    >${project.description || ''}</textarea>
                                </div>

                                <!-- Фото проекта -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                        Фото проекта
                                    </label>
                                    <div id="settings-photo-area" style="width: 100%; height: 200px; border: 2px dashed var(--gray-300); border-radius: 8px; background: var(--gray-50); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; background-size: cover; background-position: center; ${project.photo ? `background-image: url(${project.photo});` : ''}">
                                        ${!project.photo ? `
                                            <div style="text-align: center; color: var(--gray-600);">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 8px;">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                                    <polyline points="21 15 16 10 5 21"/>
                                                </svg>
                                                <p style="margin: 0 0 4px 0; font-weight: 500;">Загрузите фото</p>
                                                <span style="font-size: 12px; color: var(--gray-500);">Нажмите для выбора файла</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <input type="file" id="settings-photo-input" accept="image/*" style="display: none;">
                                </div>

                                <!-- Яндекс.Карта -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                        Местоположение на карте
                                    </label>
                                    <div id="settings-map" style="width: 100%; height: 300px; border-radius: 8px; border: 1px solid var(--gray-300);"></div>
                                </div>
                            </div>

                            <!-- Кнопки действий -->
                            <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center; padding-top: 16px; border-top: 1px solid var(--gray-200);">
                                <button 
                                    type="button" 
                                    onclick="window.location.reload()"
                                    class="btn btn-secondary"
                                    style="padding: 10px 24px; display: flex; align-items: center; justify-content: center;"
                                >
                                    Отмена
                                </button>
                                <button 
                                    type="submit" 
                                    class="btn btn-primary"
                                    style="padding: 10px 32px; display: flex; align-items: center; justify-content: center;"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                        <polyline points="17 21 17 13 7 13 7 21"/>
                                        <polyline points="7 3 7 8 15 8"/>
                                    </svg>
                                    Сохранить изменения
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Дополнительные настройки -->
                    <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 24px; margin-top: 24px;">
                        <h3 style="margin-bottom: 12px; color: var(--gray-800); font-size: 16px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            Информация о проекте
                        </h3>
                        <div style="color: var(--gray-600); font-size: 13px; line-height: 1.6;">
                            <p style="margin: 4px 0;"><strong>ID проекта:</strong> ${project.id}</p>
                            <p style="margin: 4px 0;"><strong>Дата создания:</strong> ${new Date(project.createdAt).toLocaleString('ru-RU')}</p>
                            <p style="margin: 4px 0;"><strong>Последнее обновление:</strong> ${new Date(project.updatedAt).toLocaleString('ru-RU')}</p>
                        </div>
                    </div>
                </div>
            `;

            // Добавляем обработчик отправки формы
            document.getElementById('project-settings-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProjectSettings();
            });

            // Инициализация фото
            let uploadedPhotoData = project.photo || null;
            const photoArea = document.getElementById('settings-photo-area');
            const photoInput = document.getElementById('settings-photo-input');

            photoArea.addEventListener('click', () => {
                photoInput.click();
            });

            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        uploadedPhotoData = event.target.result;
                        this.uploadedPhotoData = uploadedPhotoData;
                        photoArea.style.backgroundImage = `url(${uploadedPhotoData})`;
                        photoArea.innerHTML = '';
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Инициализация Яндекс.Карты
            let savedMapCoords = null;
            if (window.ymaps) {
                ymaps.ready(() => {
                    const hasCoords = project.latitude && project.longitude;
                    const initialCenter = hasCoords ? [project.latitude, project.longitude] : [41.31, 69.24];

                    const map = new ymaps.Map('settings-map', {
                        center: initialCenter,
                        zoom: hasCoords ? 15 : 12,
                        controls: ['zoomControl', 'geolocationControl']
                    });

                    // Добавляем существующую метку
                    if (hasCoords) {
                        savedMapCoords = [project.latitude, project.longitude];
                        const placemark = new ymaps.Placemark(savedMapCoords, {}, {
                            preset: 'islands#redDotIcon'
                        });
                        map.geoObjects.add(placemark);
                    }

                    // Добавление метки по клику
                    map.events.add('click', (e) => {
                        const coords = e.get('coords');
                        savedMapCoords = coords;
                        this.savedMapCoords = coords;
                        map.geoObjects.removeAll();
                        const placemark = new ymaps.Placemark(coords, {}, {
                            preset: 'islands#redDotIcon'
                        });
                        map.geoObjects.add(placemark);

                        // Геокодирование для получения адреса
                        ymaps.geocode(coords).then(function (res) {
                            const firstGeoObject = res.geoObjects.get(0);
                            const address = firstGeoObject.getAddressLine();
                            document.getElementById('project-address').value = address;
                        });
                    });
                });
            }

            // Инициализация кастомного select для валюты
            const currencySelect = document.getElementById('currency-select');
            const currencyInput = document.getElementById('project-currency');
            const currencyTrigger = currencySelect.querySelector('.custom-select-trigger');
            const currencyOptions = currencySelect.querySelectorAll('.custom-select-option');

            // Установить начальное значение
            const currentCurrency = currencyInput.value || 'RUB';
            const currentOption = currencySelect.querySelector(`[data-value="${currentCurrency}"]`);
            if (currentOption) {
                const flagSrc = currentOption.querySelector('.flag-icon').src;
                const text = currentOption.querySelector('span').textContent;
                currencyTrigger.querySelector('.flag-icon').src = flagSrc;
                currencyTrigger.querySelector('.select-text').textContent = text;
                currentOption.classList.add('selected');
            }

            // Открытие/закрытие dropdown
            currencyTrigger.addEventListener('click', () => {
                currencySelect.classList.toggle('open');
            });

            // Выбор опции
            currencyOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.dataset.value;
                    const flagSrc = option.querySelector('.flag-icon').src;
                    const text = option.querySelector('span').textContent;

                    currencyInput.value = value;
                    currencyTrigger.querySelector('.flag-icon').src = flagSrc;
                    currencyTrigger.querySelector('.select-text').textContent = text;

                    currencyOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    currencySelect.classList.remove('open');
                });
            });

            // Закрытие при клике снаружи
            document.addEventListener('click', (e) => {
                if (!currencySelect.contains(e.target)) {
                    currencySelect.classList.remove('open');
                }
            });

            // Сохраняем ссылки на данные для использования в saveProjectSettings
            this.uploadedPhotoData = uploadedPhotoData;
            this.savedMapCoords = savedMapCoords;

        } catch (error) {
            console.error('Error loading project settings:', error);
            UI.showNotification('Ошибка загрузки настроек проекта: ' + error.message, 'error');
        }
    },

    async saveProjectSettings() {
        try {
            const formData = {
                name: document.getElementById('project-name').value.trim(),
                address: document.getElementById('project-address').value.trim(),
                client: document.getElementById('project-client').value.trim(),
                currency: document.getElementById('project-currency').value,
                status: document.getElementById('project-status').value,
                manager: document.getElementById('project-manager').value.trim(),
                deputy: document.getElementById('project-deputy').value.trim(),
                customer: document.getElementById('project-customer').value.trim(),
                contractor: document.getElementById('project-contractor').value.trim(),
                description: document.getElementById('project-description').value.trim(),
                photo: this.uploadedPhotoData,
                coordinates: this.savedMapCoords ? {
                    latitude: this.savedMapCoords[0],
                    longitude: this.savedMapCoords[1]
                } : null
            };

            if (!formData.name) {
                UI.showNotification('Введите название объекта', 'error');
                return;
            }

            // Обновляем проект через API
            const updatedProject = await api.updateProject(this.currentProjectId, formData);

            UI.showNotification('Настройки проекта сохранены', 'success');

            // Обновляем название в селекторе проектов
            const projectNameElement = document.getElementById('selected-project-name');
            if (projectNameElement) {
                projectNameElement.textContent = updatedProject.name;
            }

            // Обновляем название компании в header
            const companyNameElement = document.getElementById('header-company-name');
            if (companyNameElement && formData.client) {
                companyNameElement.textContent = formData.client;
            }

            // Обновляем EstimateManager с новыми данными проекта
            if (typeof EstimateManager !== 'undefined') {
                EstimateManager.currentProject = updatedProject;
            }

        } catch (error) {
            console.error('Error saving project settings:', error);
            UI.showNotification('Ошибка сохранения настроек: ' + error.message, 'error');
        }
    }
};
