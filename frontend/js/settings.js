// ========================================
// Settings Module - Управление настройками проекта
// ========================================

const SettingsManager = {
    currentProjectId: null,
    subcontractors: null,
    workTypesList: [
        "Земельные работы",
        "Разработка котлована",
        "Устройство фундамента",
        "Возведение стен",
        "Монтаж перекрытий",
        "Устройство крыши",
        "Отделочные работы",
        "Инженерные сети",
        "Фасадные работы",
        "Благоустройство"
    ],

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

    async showSubcontractors(projectId) {
        this.currentProjectId = projectId;
        this.subcontractors = this.subcontractors || [];

        const contentArea = document.getElementById('content-area');

        const setLoading = () => {
            contentArea.innerHTML = `
                <div style="padding: 32px 40px; max-width: 1320px; margin: 0 auto; width: 100%;">
                    <div style="height: 120px; border: 1px solid var(--gray-200); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--gray-500);">
                        Загрузка...
                    </div>
                </div>
            `;
        };

        const fetchSubcontractors = async () => {
            try {
                const res = await fetch(`/api/subcontractors?projectId=${encodeURIComponent(this.currentProjectId)}`);
                if (!res.ok) throw new Error('Не удалось получить список');
                this.subcontractors = await res.json();
            } catch (err) {
                console.error(err);
                UI.showNotification('Ошибка загрузки субподрядчиков', 'error');
                this.subcontractors = [];
            }
        };

        const renderTable = () => {
            const rows = this.subcontractors.map((item) => {
                const fio = [item.lastName, item.firstName, item.middleName].filter(Boolean).join(' ');
                const statusLabel = item.status === 'active' ? 'Активен' : 'Неактивен';

                const initialsSource = (item.company || fio || '').trim();
                const initials = initialsSource
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => (p && p[0] ? p[0].toUpperCase() : ''))
                    .join('') || '•';

                const avatar = item.companyPhoto
                    ? `<div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #eef2f7; background-image: url(${item.companyPhoto}); background-size: cover; background-position: center;"></div>`
                    : `<div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #e0f2fe, #dbeafe); color: #1f2937; display: grid; place-items: center; font-weight: 700; font-size: 14px;">${initials}</div>`;

                const workTypes = item.workTypes ? item.workTypes.split(',') : [];
                let workTypesDisplay = '—';
                if (workTypes.length === 1) {
                    workTypesDisplay = workTypes[0];
                } else if (workTypes.length > 1) {
                    workTypesDisplay = `<button class="btn btn-secondary sc-view-work-types" data-id="${item.id}" style="padding: 4px 8px; font-size: 11px; height: 24px; min-width: 80px;">Просмотр</button>`;
                }

                return `
                    <tr data-id="${item.id}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${avatar}
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <span style="font-weight: 600; color: var(--gray-900);">${item.company || ''}</span>
                                    <span style="color: var(--gray-500); font-size: 12px;">${fio || ''}</span>
                                </div>
                            </div>
                        </td>
                        <td>${fio || ''}</td>
                        <td style="font-size: 12px; color: var(--gray-700);">${workTypesDisplay}</td>
                        <td>${item.phone || ''}</td>
                        <td>${item.email || ''}</td>
                        <td>${statusLabel}</td>
                        <td style="white-space: nowrap; display: flex; gap: 8px; align-items: center;">
                            <button class="btn btn-secondary subcontractor-edit" title="Изменить" aria-label="Изменить" data-id="${item.id}" style="width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                </svg>
                            </button>
                            <button class="btn btn-danger subcontractor-delete" title="Удалить" aria-label="Удалить" data-id="${item.id}" style="width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            contentArea.innerHTML = `
                <div style="padding: 32px 40px; max-width: 1320px; margin: 0 auto; width: 100%;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
                                <path d="M8 10h8M8 14h5" />
                                <circle cx="9" cy="18" r="1.2" />
                            </svg>
                            <div>
                                <h1 style="margin: 0; font-size: 24px; color: var(--gray-900);">Субподрядчики</h1>
                                <p style="margin: 4px 0 0; color: var(--gray-600); font-size: 13px;">Управление данными субподрядчиков и контактами</p>
                            </div>
                        </div>
                        <button id="subcontractor-add-btn" class="btn btn-primary" style="padding: 10px 18px; display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                            </svg>
                            Добавить
                        </button>
                    </div>

                    <div class="data-table" style="background: var(--white); border: 1px solid var(--gray-200); border-radius: 12px; box-shadow: var(--shadow-sm); width: 100%; overflow: hidden;">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 22%;">Компания</th>
                                    <th style="width: 20%;">Контактное лицо</th>
                                    <th style="width: 15%;">Вид работ</th>
                                    <th style="width: 12%;">Телефон</th>
                                    <th style="width: 15%;">Почта</th>
                                    <th style="width: 6%;">Статус</th>
                                    <th style="width: 10%; text-align: left;">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="6" style="text-align:center; color: var(--gray-500); padding: 16px;">Нет субподрядчиков</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            bindTableActions();
        };

        const closeModal = (overlay) => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        const toBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const openModal = (mode, data = {}) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal" style="max-width: 1040px; width: calc(100% - 80px);">
                    <div class="modal-header">
                        <h3>${mode === 'edit' ? 'Изменить субподрядчика' : 'Добавить субподрядчика'}</h3>
                        <button class="modal-close" aria-label="Закрыть">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow: visible; position: relative; z-index: 100;">
                        <div style="display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 18px; align-items: stretch;">
                            <form id="subcontractor-form" class="form-grid" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; padding-bottom: 20px; position: relative; z-index: 90;">
                                <div class="form-group" style="grid-column: 1 / span 3;">
                                    <label>Название *</label>
                                    <input type="text" id="sc-company" value="${data.company || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Фамилия *</label>
                                    <input type="text" id="sc-last" value="${data.lastName || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Имя *</label>
                                    <input type="text" id="sc-first" value="${data.firstName || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Отчество</label>
                                    <input type="text" id="sc-middle" value="${data.middleName || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Телефон *</label>
                                    <input type="text" id="sc-phone" value="${data.phone || ''}" placeholder="+998 (__) ___-__-__" required>
                                </div>
                                <div class="form-group">
                                    <label>Почта</label>
                                    <input type="email" id="sc-email" value="${data.email || ''}" placeholder="example@example.com">
                                </div>
                                <div class="form-group">
                                    <label>Пароль *</label>
                                    <input type="text" id="sc-password" value="${data.password || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Статус</label>
                                    <select id="sc-status">
                                        <option value="active" ${data.status !== 'inactive' ? 'selected' : ''}>Активен</option>
                                        <option value="inactive" ${data.status === 'inactive' ? 'selected' : ''}>Неактивен</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>МФО</label>
                                    <input type="text" id="sc-mfo" value="${data.mfo || ''}">
                                </div>
                                <div class="form-group">
                                    <label>ИНН</label>
                                    <input type="text" id="sc-inn" value="${data.inn || ''}">
                                </div>
                                <div class="form-group" style="grid-column: 1 / span 2;">
                                    <label>Название банка</label>
                                    <input type="text" id="sc-bank" value="${data.bankName || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Р/с</label>
                                    <input type="text" id="sc-account" value="${data.account || ''}">
                                </div>
                                <div class="form-group" style="grid-column: 1 / span 3; position: relative; z-index: 1000;">
                                    <label>Вид работ</label>
                                    <div id="sc-work-types-dropdown" style="width: 100%; min-height: 40px; padding: 6px 12px; border: 1px solid var(--gray-300); border-radius: 8px; background: #fff; cursor: pointer; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; position: relative;">
                                        <div id="sc-selected-work-types" style="display: flex; flex-wrap: wrap; gap: 4px;">
                                            <span style="color: var(--gray-400); font-size: 14px;">Выберите виды работ...</span>
                                        </div>
                                        <div style="margin-left: auto;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                        <div id="sc-work-types-list" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid var(--gray-300); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 9999; max-height: 200px; overflow-y: auto; padding: 8px 0;">
                                            ${this.workTypesList.map(type => `
                                                <div class="work-type-option" data-value="${type}" style="padding: 8px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: background 0.2s;">
                                                    <div class="checkbox-box" style="width: 18px; height: 18px; border: 2px solid var(--gray-300); border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="display: none;"><polyline points="20 6 9 17 4 12"/></svg>
                                                    </div>
                                                    <span style="font-size: 14px; color: var(--gray-700);">${type}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group" style="grid-column: 1 / span 3;">
                                    <label>Адрес</label>
                                    <input type="text" id="sc-address" value="${data.address || ''}">
                                </div>
                            </form>

                            <div style="display: flex; flex-direction: column; gap: 12px; height: 100%; justify-content: space-between;">
                                <div>
                                    <label>Фото фирмы</label>
                                    <div id="sc-company-photo-preview" style="position: relative; aspect-ratio: 1 / 1; min-height: 140px; border: 1px dashed var(--gray-300); border-radius: 12px; background: linear-gradient(135deg, var(--gray-50), #f8fafc); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; ${data.companyPhoto ? `background-image: url(${data.companyPhoto}); background-size: cover; background-position: center;` : ''}">
                                        ${data.companyPhoto ? '' : '<div style="display:flex; flex-direction:column; align-items:center; gap:6px; color: var(--gray-500); font-size: 12px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M4 15l4-4 3 3 2-2 5 5"/></svg><span>Нажмите, чтобы загрузить</span></div>'}
                                    </div>
                                    <input type="file" id="sc-company-photo" accept="image/*" style="display: none;">
                                </div>
                                <div>
                                    <label>Фото директора</label>
                                    <div id="sc-director-photo-preview" style="position: relative; aspect-ratio: 1 / 1; min-height: 140px; border: 1px dashed var(--gray-300); border-radius: 12px; background: linear-gradient(135deg, var(--gray-50), #f8fafc); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; ${data.directorPhoto ? `background-image: url(${data.directorPhoto}); background-size: cover; background-position: center;` : ''}">
                                        ${data.directorPhoto ? '' : '<div style="display:flex; flex-direction:column; align-items:center; gap:6px; color: var(--gray-500); font-size: 12px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M4 15l4-4 3 3 2-2 5 5"/></svg><span>Нажмите, чтобы загрузить</span></div>'}
                                    </div>
                                    <input type="file" id="sc-director-photo" accept="image/*" style="display: none;">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-secondary" id="sc-cancel" type="button">Отмена</button>
                        <button class="btn btn-primary" id="sc-save" type="button">Сохранить</button>
                    </div>
                </div>
            `;

            const companyPhotoPreview = overlay.querySelector('#sc-company-photo-preview');
            const directorPhotoPreview = overlay.querySelector('#sc-director-photo-preview');
            const companyPhotoInput = overlay.querySelector('#sc-company-photo');
            const directorPhotoInput = overlay.querySelector('#sc-director-photo');
            let companyPhotoData = data.companyPhoto || null;
            let directorPhotoData = data.directorPhoto || null;

            const placeholder = '<div style="display:flex; flex-direction:column; align-items:center; gap:6px; color: var(--gray-500); font-size: 12px;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M4 15l4-4 3 3 2-2 5 5"/></svg><span>Нажмите, чтобы загрузить</span></div>';

            const updatePreview = (el, value) => {
                if (!el) return;
                if (value) {
                    el.style.backgroundImage = `url(${value})`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                    el.innerHTML = '';
                    el.style.borderColor = 'transparent';
                } else {
                    el.style.backgroundImage = '';
                    el.innerHTML = placeholder;
                    el.style.borderColor = 'var(--gray-300)';
                }
            };

            updatePreview(companyPhotoPreview, companyPhotoData);
            updatePreview(directorPhotoPreview, directorPhotoData);

            overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
            overlay.querySelector('#sc-cancel').addEventListener('click', () => closeModal(overlay));

            // Work types logic
            const dropdown = overlay.querySelector('#sc-work-types-dropdown');
            const list = overlay.querySelector('#sc-work-types-list');
            const selectedContainer = overlay.querySelector('#sc-selected-work-types');
            let selectedWorkTypes = data.workTypes ? data.workTypes.split(',') : [];

            const updateSelectedUI = () => {
                if (selectedWorkTypes.length === 0) {
                    selectedContainer.innerHTML = '<span style="color: var(--gray-400); font-size: 14px;">Выберите виды работ...</span>';
                } else {
                    selectedContainer.innerHTML = selectedWorkTypes.map(type => `
                        <div style="background: #2B7A78; color: #fff; padding: 2px 10px; border-radius: 6px; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            ${type}
                            <span class="remove-work-type" data-value="${type}" style="cursor: pointer; font-size: 14px; line-height: 1;">&times;</span>
                        </div>
                    `).join('');
                }

                // Update options checkmarks
                overlay.querySelectorAll('.work-type-option').forEach(opt => {
                    const val = opt.dataset.value;
                    const checkbox = opt.querySelector('.checkbox-box');
                    const check = checkbox.querySelector('svg');
                    if (selectedWorkTypes.includes(val)) {
                        checkbox.style.background = '#2B7A78';
                        checkbox.style.borderColor = '#2B7A78';
                        check.style.display = 'block';
                    } else {
                        checkbox.style.background = 'transparent';
                        checkbox.style.borderColor = 'var(--gray-300)';
                        check.style.display = 'none';
                    }
                });
            };

            updateSelectedUI();

            dropdown.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-work-type')) {
                    const val = e.target.dataset.value;
                    selectedWorkTypes = selectedWorkTypes.filter(t => t !== val);
                    updateSelectedUI();
                    return;
                }
                list.style.display = list.style.display === 'none' ? 'block' : 'none';
            });

            overlay.querySelectorAll('.work-type-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = opt.dataset.value;
                    if (selectedWorkTypes.includes(val)) {
                        selectedWorkTypes = selectedWorkTypes.filter(t => t !== val);
                    } else {
                        selectedWorkTypes.push(val);
                    }
                    updateSelectedUI();
                });
            });

            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target)) {
                    list.style.display = 'none';
                }
            }, { once: true }); // Need to be careful with global listeners in modals

            companyPhotoPreview?.addEventListener('click', () => companyPhotoInput?.click());
            directorPhotoPreview?.addEventListener('click', () => directorPhotoInput?.click());

            companyPhotoInput?.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    companyPhotoData = await toBase64(file);
                    updatePreview(companyPhotoPreview, companyPhotoData);
                }
            });

            directorPhotoInput?.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    directorPhotoData = await toBase64(file);
                    updatePreview(directorPhotoPreview, directorPhotoData);
                }
            });

            overlay.querySelector('#sc-save').addEventListener('click', async () => {
                const company = overlay.querySelector('#sc-company').value.trim();
                const lastName = overlay.querySelector('#sc-last').value.trim();
                const firstName = overlay.querySelector('#sc-first').value.trim();
                const middleName = overlay.querySelector('#sc-middle').value.trim();
                const phone = overlay.querySelector('#sc-phone').value.trim();
                const email = overlay.querySelector('#sc-email').value.trim();
                const password = overlay.querySelector('#sc-password').value.trim();
                const status = overlay.querySelector('#sc-status').value;
                const mfo = overlay.querySelector('#sc-mfo').value.trim();
                const inn = overlay.querySelector('#sc-inn').value.trim();
                const bankName = overlay.querySelector('#sc-bank').value.trim();
                const account = overlay.querySelector('#sc-account').value.trim();
                const address = overlay.querySelector('#sc-address').value.trim();

                if (!company || !firstName || !lastName || !phone || !password) {
                    UI.showNotification('Заполните обязательные поля: Название, Фамилия, Имя, Телефон, Пароль', 'error');
                    return;
                }

                const payload = {
                    projectId: this.currentProjectId,
                    company,
                    lastName,
                    firstName,
                    middleName,
                    phone,
                    email,
                    password,
                    status,
                    mfo,
                    inn,
                    bankName,
                    account,
                    workTypes: selectedWorkTypes.join(','),
                    address,
                    companyPhoto: companyPhotoData,
                    directorPhoto: directorPhotoData
                };

                try {
                    const endpoint = mode === 'edit' ? `/api/subcontractors/${data.id}` : '/api/subcontractors';
                    const method = mode === 'edit' ? 'PUT' : 'POST';

                    const res = await fetch(endpoint, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(errText || 'Ошибка сохранения');
                    }

                    await fetchSubcontractors();
                    UI.showNotification(mode === 'edit' ? 'Субподрядчик обновлён' : 'Субподрядчик добавлен', 'success');
                    closeModal(overlay);
                    renderTable();
                } catch (err) {
                    console.error(err);
                    UI.showNotification('Не удалось сохранить субподрядчика', 'error');
                }
            });

            document.getElementById('modal-container').appendChild(overlay);
        };

        const bindTableActions = () => {
            document.getElementById('subcontractor-add-btn')?.addEventListener('click', () => openModal('create'));
            contentArea.querySelectorAll('.subcontractor-edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const item = this.subcontractors.find((s) => s.id === id);
                    if (item) openModal('edit', item);
                });
            });
            contentArea.querySelectorAll('.subcontractor-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (!confirm('Вы уверены, что хотите удалить субподрядчика?')) return;
                    try {
                        const res = await fetch(`/api/subcontractors/${id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('Delete failed');
                        await fetchSubcontractors();
                        renderTable();
                        UI.showNotification('Субподрядчик удалён', 'success');
                    } catch (err) {
                        console.error(err);
                        UI.showNotification('Не удалось удалить субподрядчика', 'error');
                    }
                });
            });

            contentArea.querySelectorAll('.sc-view-work-types').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.dataset.id;
                    const item = this.subcontractors.find((s) => s.id === id);
                    if (item && item.workTypes) {
                        const types = item.workTypes.split(',');
                        alert(`Виды работ для ${item.company}:\n\n${types.join('\n')}`);
                    }
                });
            });
        };

        setLoading();
        await fetchSubcontractors();
        renderTable();
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
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 12px;">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.27.52.27 1.14 0 1.66a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
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
