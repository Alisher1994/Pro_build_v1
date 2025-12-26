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
                const res = await fetch(`/api/subcontractors`);
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
                        <td style="vertical-align: middle;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${avatar}
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <span style="font-weight: 600; color: var(--gray-900); line-height: 1.2;">${item.company || ''}</span>
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <span style="color: var(--gray-500); font-size: 11px;">ИНН: ${item.inn || '—'}</span>
                                        <span style="display: inline-flex; align-items: center; gap: 3px; color: #f59e0b; font-size: 11px; font-weight: 700; background: #fffbeb; padding: 1px 6px; border-radius: 12px; border: 1px solid #fef3c7;">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                            0.0
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </td>

                        <td style="vertical-align: middle;">${fio || ''}</td>
                        <td style="vertical-align: middle; font-size: 12px; color: var(--gray-700);">${workTypesDisplay}</td>
                        <td style="vertical-align: middle;">${item.phone || ''}</td>
                        <td style="vertical-align: middle;">${item.email || ''}</td>
                        <td style="vertical-align: middle;">${statusLabel}</td>
                        <td style="vertical-align: middle;">
                            <div style="white-space: nowrap; display: flex; gap: 8px; align-items: center;">
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
                            </div>
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
                                <h1 style="margin: 0; font-size: 24px; color: var(--gray-900);">Субподрядчики (Общий список)</h1>
                                <p style="margin: 4px 0 0; color: var(--gray-600); font-size: 13px;">Управление данными субподрядчиков для всех объектов</p>
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
                                    <label>ИНН (9 цифр)</label>
                                    <input type="text" id="sc-inn" value="${data.inn || ''}" maxlength="9">
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
                        <div style="background: #207345; color: #fff; padding: 2px 10px; border-radius: 6px; font-size: 12px; display: flex; align-items: center; gap: 6px;">
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
                        checkbox.style.background = '#207345';
                        checkbox.style.borderColor = '#207345';
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

                if (inn && (inn.length !== 9 || !/^\d+$/.test(inn))) {
                    UI.showNotification('ИНН должен состоять ровно из 9 цифр', 'error');
                    return;
                }

                const payload = {
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
                    const ok = await UI.showConfirmDialog('Удаление субподрядчика', 'Вы уверены, что хотите удалить этого субподрядчика?');
                    if (!ok) return;
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
                        UI.showModal(
                            `Виды работ: ${item.company}`,
                            `<div style="font-size: 14px; line-height: 1.6;">
                                <p><b>ИНН:</b> ${item.inn || '—'}</p>
                                <p><b>Список работ:</b></p>
                                <ul style="padding-left: 20px; color: var(--gray-700);">
                                    ${types.map(t => `<li>${t.trim()}</li>`).join('')}
                                </ul>
                            </div>`,
                            `<button class="btn btn-primary" onclick="UI.closeModal()" style="width: 100%;">Понятно</button>`
                        );
                    }
                });
            });
        };

        await fetchSubcontractors();
        renderTable();
    },

    async showDepartments(projectId) {
        this.currentProjectId = projectId;
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `<div style="padding: 32px 40px;"><p>Загрузка отделов...</p></div>`;

        try {
            const res = await fetch('/api/departments');
            const list = await res.json();

            contentArea.innerHTML = `
                <div style="padding: 32px 40px; max-width: 800px; margin: 0 auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h1 style="font-size: 24px; color: var(--gray-900);">Отделы</h1>
                        <button id="add-dept-btn" class="btn btn-primary">+ Добавить отдел</button>
                    </div>
                    <div class="data-table" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); overflow: hidden;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Название</th>
                                    <th style="width: 100px; text-align: right;">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(d => `
                                    <tr>
                                        <td>${d.name}</td>
                                        <td style="text-align: right;">
                                            ${!d.isSystem ? `
                                                <button class="btn btn-danger btn-sm delete-dept" data-id="${d.id}" style="width: 32px; height: 32px; padding: 0;">&times;</button>
                                            ` : '<span style="color: var(--gray-400); font-size: 11px;">Системный</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.getElementById('add-dept-btn').onclick = () => {
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                    <div class="modal" style="max-width: 400px; width: 90%;">
                        <div class="modal-header"><h3>Добавить отдел</h3><button class="modal-close">&times;</button></div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Название отдела *</label>
                                <input type="text" id="new-dept-name" placeholder="Напр. Отдел маркетинга" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" id="save-dept-btn" style="width: 100%;">Сохранить</button>
                        </div>
                    </div>
                `;
                overlay.querySelector('.modal-close').onclick = () => overlay.remove();
                overlay.querySelector('#save-dept-btn').onclick = async () => {
                    const name = document.getElementById('new-dept-name').value.trim();
                    if (!name) {
                        UI.showNotification('Введите название', 'error');
                        return;
                    }
                    try {
                        const res = await fetch('/api/departments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name })
                        });
                        if (res.ok) {
                            overlay.remove();
                            this.showDepartments(projectId);
                        } else {
                            const err = await res.json();
                            UI.showNotification(err.error, 'error');
                        }
                    } catch (e) { UI.showNotification('Ошибка сети', 'error'); }
                };
                document.getElementById('modal-container').appendChild(overlay);
                document.getElementById('new-dept-name').focus();
            };

            contentArea.querySelectorAll('.delete-dept').forEach(btn => {
                btn.onclick = async () => {
                    const ok = await UI.showConfirmDialog('Удаление отдела', 'Вы уверены, что хотите удалить этот отдел?');
                    if (ok) {
                        fetch(`/api/departments/${btn.dataset.id}`, { method: 'DELETE' })
                            .then(() => this.showDepartments(projectId));
                    }
                };
            });
        } catch (e) { console.error(e); }
    },

    async showPositions(projectId) {
        this.currentProjectId = projectId;
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `<div style="padding: 32px 40px;"><p>Загрузка должностей...</p></div>`;

        try {
            const [posRes, deptsRes] = await Promise.all([
                fetch('/api/positions'),
                fetch('/api/departments')
            ]);
            const list = await posRes.json();
            const depts = await deptsRes.json();

            contentArea.innerHTML = `
                <div style="padding: 32px 40px; max-width: 800px; margin: 0 auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h1 style="font-size: 24px; color: var(--gray-900);">Должности</h1>
                        <button id="add-pos-btn" class="btn btn-primary">+ Добавить должность</button>
                    </div>
                    <div class="data-table" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); overflow: hidden;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Должность</th>
                                    <th>Отдел</th>
                                    <th>Рук. отдела</th>
                                    <th>Привилегии</th>
                                    <th style="width: 80px; text-align: right;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(p => {
                const privs = typeof p.privileges === 'string' ? JSON.parse(p.privileges) : p.privileges;
                return `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td><span class="badge" style="background: var(--gray-100); color: var(--gray-700);">${p.department?.name || '—'}</span></td>
                                        <td>${p.isHead ? '✅' : '—'}</td>
                                        <td style="font-size: 11px; color: var(--gray-600);">
                                            Чтение: ${privs?.read ? '✅' : '❌'}, Ред.: ${privs?.edit ? '✅' : '❌'}
                                        </td>
                                        <td style="text-align: right;">
                                            <div style="display: flex; gap: 4px; justify-content: flex-end;">
                                                <button class="btn btn-secondary btn-sm edit-pos" data-id="${p.id}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Изменить">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                                ${p.isSystem ? '' : `<button class="btn btn-danger btn-sm delete-pos" data-id="${p.id}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">&times;</button>`}
                                            </div>
                                        </td>
                                    </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.getElementById('add-pos-btn').onclick = () => {
                this.openPositionModal('create', { depts, list, projectId });
            };

            contentArea.onclick = async (e) => {
                const editBtn = e.target.closest('.edit-pos');
                const deleteBtn = e.target.closest('.delete-pos');

                if (editBtn) {
                    const id = editBtn.dataset.id;
                    const pos = list.find(x => x.id === id);
                    this.openPositionModal('edit', { pos, depts, list, projectId });
                } else if (deleteBtn) {
                    const ok = await UI.showConfirmDialog('Удаление должности', 'Вы уверены, что хотите удалить эту должность?');
                    if (ok) {
                        fetch(`/api/positions/${deleteBtn.dataset.id}`, { method: 'DELETE' })
                            .then(() => this.showPositions(projectId));
                    }
                }
            };
        } catch (e) { console.error(e); }
    },

    openPositionModal(mode, { pos, depts, list, projectId, preSelectDeptId }) {
        const isEdit = mode === 'edit';
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        // Determine which department to select
        const selectedDeptId = preSelectDeptId || pos?.departmentId;
        const isDeptLocked = !isEdit && preSelectDeptId; // Lock department only when creating from selected dept

        overlay.innerHTML = `
            <div class="modal" style="max-width: 450px; width: 90%;">
                <div class="modal-header"><h3>${isEdit ? 'Изменить должность' : 'Добавить должность'}</h3><button class="modal-close">&times;</button></div>
                <div class="modal-body">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label>Отдел *</label>
                        <select id="new-pos-dept" required ${isDeptLocked ? 'disabled' : ''}>
                            <option value="">Выберите отдел</option>
                            ${depts.map(d => `<option value="${d.id}" ${selectedDeptId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                        </select>
                        ${isDeptLocked ? `<input type="hidden" id="locked-dept-id" value="${selectedDeptId}">` : ''}
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label>Название должности *</label>
                        <input type="text" id="new-pos-name" value="${pos?.name || ''}" placeholder="Напр. Инженер ПТО" required>
                    </div>
                    <div class="privileges-section" style="background: var(--gray-50); padding: 16px; border-radius: 8px; border: 1px solid var(--gray-200);">
                        <label style="display: block; margin-bottom: 12px; font-weight: 600; font-size: 13px; color: var(--gray-700);">Базовые права доступа:</label>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="priv-read" ${(!pos || pos.privileges?.read) ? 'checked' : ''}> 
                                <span>Просмотр данных</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="priv-edit" ${pos?.privileges?.edit ? 'checked' : ''}> 
                                <span>Редактирование данных</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--gray-200);">
                                <input type="checkbox" id="pos-is-head" ${pos?.isHead ? 'checked' : ''}> 
                                <span style="font-weight: 600; color: var(--primary);">Руководитель отдела</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="save-pos-btn" style="width: 100%;">Сохранить</button>
                </div>
            </div>
        `;
        const deptSelect = overlay.querySelector('#new-pos-dept');
        const headCheckbox = overlay.querySelector('#pos-is-head');

        const updateHeadAvailability = () => {
            const deptId = deptSelect.value;
            if (!deptId) {
                headCheckbox.disabled = false;
                return;
            }
            // Check if any position (other than the one being edited) is already a Head
            const hasHead = list.some(p => p.departmentId === deptId && p.isHead && (!isEdit || p.id !== pos.id));
            if (hasHead) {
                headCheckbox.checked = false;
                headCheckbox.disabled = true;
                headCheckbox.parentElement.title = "В этом отделе уже создана штатная единица руководителя";
                headCheckbox.parentElement.style.opacity = '0.5';
            } else {
                headCheckbox.disabled = false;
                headCheckbox.parentElement.title = "";
                headCheckbox.parentElement.style.opacity = '1';
            }
        };

        deptSelect.onchange = updateHeadAvailability;
        updateHeadAvailability();

        overlay.querySelector('.modal-close').onclick = () => overlay.remove();
        overlay.querySelector('#save-pos-btn').onclick = async () => {
            const name = overlay.querySelector('#new-pos-name').value.trim();
            const deptSelectEl = overlay.querySelector('#new-pos-dept');
            const lockedDeptInput = overlay.querySelector('#locked-dept-id');

            // Use locked dept ID if select is disabled, otherwise use select value
            const departmentId = lockedDeptInput ? lockedDeptInput.value : deptSelectEl.value;

            const isHead = overlay.querySelector('#pos-is-head').checked;
            const read = overlay.querySelector('#priv-read').checked;
            const edit = overlay.querySelector('#priv-edit').checked;
            if (!name || !departmentId) {
                UI.showNotification('Заполните все обязательные поля', 'error');
                return;
            }

            if (isHead) {
                const hasHead = list.some(p => p.departmentId === departmentId && p.isHead && (!isEdit || p.id !== pos.id));
                if (hasHead) {
                    UI.showNotification('В этом отделе уже есть должность руководителя', 'error');
                    return;
                }
            }
            try {
                const url = isEdit ? `/api/positions/${pos.id}` : '/api/positions';
                const method = isEdit ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        departmentId,
                        isHead,
                        privileges: { read, edit, windows: ['dashboard'] }
                    })
                });
                if (res.ok) {
                    overlay.remove();
                    this.showStaffManagement(projectId, { deptId: departmentId });
                } else {
                    const err = await res.json();
                    UI.showNotification(err.error, 'error');
                }
            } catch (e) { UI.showNotification('Ошибка сети', 'error'); }
        };
        document.getElementById('modal-container').appendChild(overlay);
        if (!isEdit) document.getElementById('new-pos-name').focus();
    },

    async showEmployees(projectId) {
        this.currentProjectId = projectId;
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `<div style="padding: 32px 40px;"><p>Загрузка сотрудников...</p></div>`;

        try {
            const [empsRes, deptsRes, posRes, projectsRes] = await Promise.all([
                fetch('/api/employees'),
                fetch('/api/departments'),
                fetch('/api/positions'),
                fetch('/api/projects')
            ]);

            const list = await empsRes.json();
            const depts = await deptsRes.json();
            const positions = await posRes.json();
            const projects = await projectsRes.json();

            contentArea.innerHTML = `
                <div style="padding: 32px 40px; max-width: 1400px; margin: 0 auto; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div>
                            <h1 style="font-size: 24px; color: var(--gray-900); margin: 0;">Сотрудники</h1>
                            <p style="margin: 4px 0 0; color: var(--gray-600); font-size: 13px;">Управление штатом сотрудников и их доступом</p>
                        </div>
                        <button id="add-employee-btn" class="btn btn-primary" style="padding: 10px 18px; display: flex; align-items: center; gap: 8px;">
                             + Добавить сотрудника
                        </button>
                    </div>
                    <div class="data-table" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm); overflow: hidden;">
                        <table style="width: 100%;">
                            <thead>
                                <tr>
                                    <th>ФИО</th>
                                    <th>Отдел</th>
                                    <th>Должность</th>
                                    <th>Телефон</th>
                                    <th>Объект</th>
                                    <th>Баллы</th>
                                    <th>Статус</th>
                                    <th style="width:100px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(e => `
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:10px;">
                                                <div style="width:32px; height:32px; border-radius:50%; background:#eee; background-image:url(${e.photo || ''}); background-size:cover;"></div>
                                                <span>${e.lastName} ${e.firstName}</span>
                                            </div>
                                        </td>
                                        <td>${e.department?.name || '—'} ${e.isHead ? '<b>(Р)</b>' : ''}</td>
                                        <td>${e.position?.name || '—'}</td>
                                        <td>${e.phone}</td>
                                        <td>${e.project?.name || '—'}</td>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:4px; color: #f39c12; font-weight: 600;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                </svg>
                                                ${e.score}
                                            </div>
                                        </td>
                                        <td><span class="badge ${e.status === 'active' ? 'badge-success' : 'badge-danger'}">${e.status === 'active' ? 'Работает' : 'Уволен'}</span></td>
                                        <td style="text-align: right;">
                                            <div style="display: flex; gap: 4px; justify-content: flex-end;">
                                                <button class="btn btn-secondary btn-sm edit-employee" data-id="${e.id}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Изменить">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                                <button class="btn btn-danger btn-sm delete-employee" data-id="${e.id}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Удалить">&times;</button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Event delegation for Edit and Delete
            contentArea.onclick = async (e) => {
                const deleteBtn = e.target.closest('.delete-employee');
                const editBtn = e.target.closest('.edit-employee');
                const addBtn = e.target.closest('#add-employee-btn');

                if (addBtn) {
                    this.openEmployeeModal('create', { depts, positions, projects, allEmployees: list });
                } else if (deleteBtn) {
                    const id = deleteBtn.dataset.id;
                    const ok = await UI.showConfirmDialog('Увольнение сотрудника', 'Вы уверены, что хотите уволить этого сотрудника?');
                    if (ok) {
                        await fetch(`/api/employees/${id}`, { method: 'DELETE' });
                        this.showEmployees(this.currentProjectId);
                    }
                } else if (editBtn) {
                    const id = editBtn.dataset.id;
                    const emp = list.find(x => x.id === id);
                    if (emp) {
                        this.openEmployeeModal('edit', { emp, depts, positions, projects, allEmployees: list });
                    }
                }
            };
        } catch (e) { console.error(e); }
    },

    async showStaffManagement(projectId, initialState = {}) {
        this.currentProjectId = projectId;
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `<div style="padding: 32px 40px;"><p>Загрузка данных...</p></div>`;

        try {
            const [deptsRes, posRes, empsRes, projectsRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/positions'),
                fetch('/api/employees'),
                fetch('/api/projects')
            ]);

            const depts = await deptsRes.json();
            const positions = await posRes.json();
            const employees = await empsRes.json();
            const projects = await projectsRes.json();

            if (!Array.isArray(depts) || !Array.isArray(positions) || !Array.isArray(employees)) {
                console.error('Invalid API response:', { depts, positions, employees });
                UI.showNotification('Ошибка: API вернул некорректные данные. Возможно, сервер не обновлен.', 'error');
                contentArea.innerHTML = `<div style="padding: 32px 40px; color: red;"><p>Ошибка загрузки данных. API ответил ошибкой.</p><p>${JSON.stringify(depts.error || depts)}</p></div>`;
                return;
            }

            let selectedDeptId = initialState.deptId || null;
            let selectedPosId = initialState.posId || null;

            const render = () => {
                const filteredPositions = selectedDeptId
                    ? positions.filter(p => p.departmentId === selectedDeptId)
                    : [];

                const filteredEmployees = selectedPosId
                    ? employees.filter(e => e.positionId === selectedPosId)
                    : [];

                contentArea.innerHTML = `
                    <div style="padding: 20px 40px; height: calc(100vh - 140px); display: flex; flex-direction: column;">
                        <div style="margin-bottom: 20px;">
                            <h1 style="font-size: 24px; color: var(--gray-900); margin: 0;">Управление кадрами</h1>
                            <p style="margin: 4px 0 0; color: var(--gray-600); font-size: 13px;">Структура компании и сотрудники</p>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; flex: 1; min-height: 0;">
                            <!-- Departments Column -->
                            <div class="staff-col" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); display: flex; flex-direction: column; overflow: hidden;">
                                <div style="padding: 16px; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; background: var(--gray-50);">
                                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-800);">1. Отделы</h3>
                                    <button class="btn btn-primary btn-sm" id="add-dept-btn" title="Добавить отдел">+</button>
                                </div>
                                <div style="flex: 1; overflow-y: auto; padding: 12px;">
                                    ${depts.map(d => `
                                        <div class="staff-item ${selectedDeptId === d.id ? 'active' : ''}" 
                                             onclick="document.dispatchEvent(new CustomEvent('staff:select-dept', {detail: '${d.id}'}))"
                                             style="padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s; ${selectedDeptId === d.id ? 'background: var(--primary-light); border: 1px solid var(--primary);' : 'background: white; border: 1px solid var(--gray-200); hover:border-var(--primary);'}">
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <span style="font-weight: 500; ${selectedDeptId === d.id ? 'color: var(--primary-dark);' : 'color: var(--gray-700);'}">${d.name}</span>
                                                ${!d.isSystem ? `
                                                    <button class="btn-icon delete-dept-btn" data-id="${d.id}" onclick="event.stopPropagation()" style="opacity: 0.5;">&times;</button>
                                                ` : '<span style="font-size: 10px; opacity: 0.5;">🔒</span>'}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Positions Column -->
                            <div class="staff-col" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); display: flex; flex-direction: column; overflow: hidden; opacity: ${selectedDeptId ? '1' : '0.5'}; pointer-events: ${selectedDeptId ? 'all' : 'none'};">
                                <div style="padding: 16px; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; background: var(--gray-50);">
                                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-800);">2. Должности</h3>
                                    <button class="btn btn-primary btn-sm" id="add-pos-btn" title="Добавить должность" ${selectedDeptId ? '' : 'disabled'}>+</button>
                                </div>
                                <div style="flex: 1; overflow-y: auto; padding: 12px;">
                                    ${!selectedDeptId ? '<div style="text-align:center; color:#999; padding-top:40px;">Выберите отдел</div>' :
                        filteredPositions.length === 0 ? '<div style="text-align:center; color:#999; padding-top:40px;">Нет должностей</div>' :
                            filteredPositions.map(p => `
                                        <div class="staff-item ${selectedPosId === p.id ? 'active' : ''}" 
                                             onclick="document.dispatchEvent(new CustomEvent('staff:select-pos', {detail: '${p.id}'}))"
                                             style="padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s; ${selectedPosId === p.id ? 'background: var(--primary-light); border: 1px solid var(--primary);' : 'background: white; border: 1px solid var(--gray-200); hover:border-var(--primary);'}">
                                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                                <div>
                                                    <div style="font-weight: 500; ${selectedPosId === p.id ? 'color: var(--primary-dark);' : 'color: var(--gray-700);'}">${p.name}</div>
                                                    ${p.isHead ? '<div style="font-size: 11px; color: var(--primary); margin-top: 4px;">Руководитель отдела</div>' : ''}
                                                </div>
                                                <div style="display: flex; gap: 4px;">
                                                    <button class="btn-icon edit-pos-btn" data-id="${p.id}" onclick="event.stopPropagation()">✎</button>
                                                    ${!p.isSystem ? `<button class="btn-icon delete-pos-btn" data-id="${p.id}" onclick="event.stopPropagation()">&times;</button>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Employees Column -->
                            <div class="staff-col" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); display: flex; flex-direction: column; overflow: hidden; opacity: ${selectedPosId ? '1' : '0.5'}; pointer-events: ${selectedPosId ? 'all' : 'none'};">
                                <div style="padding: 16px; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; background: var(--gray-50);">
                                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-800);">3. Сотрудники</h3>
                                    <button class="btn btn-primary btn-sm" id="add-emp-btn" title="Добавить сотрудника" ${selectedPosId ? '' : 'disabled'}>+</button>
                                </div>
                                <div style="flex: 1; overflow-y: auto; padding: 12px;">
                                    ${!selectedPosId ? '<div style="text-align:center; color:#999; padding-top:40px;">Выберите должность</div>' :
                        filteredEmployees.length === 0 ? '<div style="text-align:center; color:#999; padding-top:40px;">Нет сотрудников</div>' :
                            filteredEmployees.map(e => `
                                        <div class="staff-item" style="padding: 12px; border-radius: 8px; margin-bottom: 8px; background: white; border: 1px solid var(--gray-200);">
                                            <div style="display: flex; align-items: center; gap: 12px;">
                                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #eee; background-image: url(${e.photo || ''}); background-size: cover; flex-shrink: 0;"></div>
                                                <div style="flex: 1; min-width: 0;">
                                                    <div style="font-weight: 500; color: var(--gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.lastName} ${e.firstName}</div>
                                                    <div style="font-size: 12px; color: var(--gray-500);">${e.phone}</div>
                                                </div>
                                                <div style="display: flex; gap: 4px;">
                                                    <button class="btn-icon edit-emp-btn" data-id="${e.id}" title="Изменить">✎</button>
                                                    <button class="btn-icon delete-emp-btn" data-id="${e.id}" title="Уволить">&times;</button>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <style>
                        .staff-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                        .btn-icon { background: none; border: none; cursor: pointer; color: var(--gray-500); padding: 4px; border-radius: 4px; }
                        .btn-icon:hover { background: var(--gray-100); color: var(--gray-900); }
                    </style>
                `;

                // Bind Events

                // Add Dept
                const addDeptBtn = document.getElementById('add-dept-btn');
                if (addDeptBtn) addDeptBtn.onclick = () => {
                    const overlay = document.createElement('div');
                    overlay.className = 'modal-overlay';
                    overlay.innerHTML = `
                       <div class="modal" style="max-width: 400px; width: 90%;">
                           <div class="modal-header"><h3>Добавить отдел</h3><button class="modal-close">&times;</button></div>
                           <div class="modal-body">
                               <div class="form-group">
                                   <label>Название отдела *</label>
                                   <input type="text" id="new-dept-name" placeholder="Напр. Отдел маркетинга" required>
                               </div>
                           </div>
                           <div class="modal-footer"><button class="btn btn-primary" id="save-dept-btn" style="width: 100%;">Сохранить</button></div>
                       </div>
                   `;
                    overlay.querySelector('.modal-close').onclick = () => overlay.remove();
                    overlay.querySelector('#save-dept-btn').onclick = async () => {
                        const name = document.getElementById('new-dept-name').value;
                        if (!name) return;
                        try {
                            const res = await fetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                            if (res.ok) this.showStaffManagement(projectId, { deptId: selectedDeptId });
                            else { const err = await res.json(); UI.showNotification(err.error, 'error'); }
                            overlay.remove();
                        } catch (e) { console.error(e); }
                    };
                    document.getElementById('modal-container').appendChild(overlay);
                    document.getElementById('new-dept-name').focus();
                };

                // Delete Dept
                document.querySelectorAll('.delete-dept-btn').forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        if (await UI.showConfirmDialog('Удаление', 'Удалить отдел?')) {
                            await fetch('/api/departments/' + btn.dataset.id, { method: 'DELETE' });
                            if (selectedDeptId === btn.dataset.id) selectedDeptId = null;
                            this.showStaffManagement(projectId);
                        }
                    };
                });

                // Add Position
                const addPosBtn = document.getElementById('add-pos-btn');
                if (addPosBtn) addPosBtn.onclick = () => {
                    // Reuse openPositionModal but pre-select dept
                    this.openPositionModal('create', { depts, list: positions, projectId, preSelectDeptId: selectedDeptId });
                };

                // Edit/Delete Position
                document.querySelectorAll('.edit-pos-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const pos = positions.find(p => p.id === btn.dataset.id);
                        this.openPositionModal('edit', { pos, depts, list: positions, projectId });
                    };
                });
                document.querySelectorAll('.delete-pos-btn').forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        if (await UI.showConfirmDialog('Удаление', 'Удалить должность?')) {
                            await fetch('/api/positions/' + btn.dataset.id, { method: 'DELETE' });
                            if (selectedPosId === btn.dataset.id) selectedPosId = null;
                            this.showStaffManagement(projectId);
                        }
                    };
                });

                // Add Employee
                const addEmpBtn = document.getElementById('add-emp-btn');
                if (addEmpBtn) addEmpBtn.onclick = () => {
                    // Pre-select logic needs to be handled in openEmployeeModal
                    // I might need to adapt openEmployeeModal to accept pre-selections
                    // For now, I'll pass the whole filtered context
                    const empStub = { departmentId: selectedDeptId, positionId: selectedPosId };
                    this.openEmployeeModal('create', { depts, positions, projects, allEmployees: employees, preSelect: empStub });
                };

                // Edit/Delete Employee
                document.querySelectorAll('.edit-emp-btn').forEach(btn => {
                    btn.onclick = () => {
                        const emp = employees.find(e => e.id === btn.dataset.id);
                        this.openEmployeeModal('edit', { emp, depts, positions, projects, allEmployees: employees });
                    };
                });
                document.querySelectorAll('.delete-emp-btn').forEach(btn => {
                    btn.onclick = async () => {
                        if (await UI.showConfirmDialog('Увольнение', 'Уволить сотрудника?')) {
                            await fetch('/api/employees/' + btn.dataset.id, { method: 'DELETE' });
                            this.showStaffManagement(projectId);
                        }
                    };
                });
            };

            // Custom event listeners for local state management without full reload
            // Except for CRUD operations which trigger re-fetch in my simple impl above
            document.addEventListener('staff:select-dept', (e) => {
                selectedDeptId = e.detail;
                selectedPosId = null; // Reset pos when dept changes
                render();
            }, { once: true }); // Note: this is tricky with re-renders.
            // Better approach: Attach specific listeners to elements that update state variables and call render()

            // I'll rewrite the render loop to not rely on loose event listeners but direct re-render
            // The render function defined above is good, but I need to call it initially.
            // And update `onclick` handlers to call logic that updates state and re-calls `render()`.

            // Let's redefine render to be cleaner
            const updateState = (key, val) => {
                if (key === 'dept') { selectedDeptId = val; selectedPosId = null; }
                if (key === 'pos') { selectedPosId = val; }
                render();
            };

            // Monkey-patch the onclicks in the HTML string to call a global or scoped handler? 
            // Better: use delegation on the container.

            contentArea.addEventListener('click', (e) => {
                const deptItem = e.target.closest('.staff-item');
                // Check if it's inside departments column
                if (deptItem && deptItem.parentElement.closest('.staff-col').querySelector('h3').textContent.includes('1. Отделы')) {
                    // It's a dept
                    // Extract ID from... I need to store ID in dataset
                    // I will update the HTML generation to include data-id
                }
            });

            // Actually, I'll just overwite the internal `render` function to attach events properly.

            const internalRender = () => {
                // Initialize search and sort states if not already defined
                if (typeof deptSearchQuery === 'undefined') deptSearchQuery = '';
                if (typeof posSearchQuery === 'undefined') posSearchQuery = '';
                if (typeof empSearchQuery === 'undefined') empSearchQuery = '';
                if (typeof deptSortAZ === 'undefined') deptSortAZ = false;
                if (typeof posSortAZ === 'undefined') posSortAZ = false;
                if (typeof empSortAZ === 'undefined') empSortAZ = false;

                const filteredPositions = selectedDeptId
                    ? positions
                        .filter(p => p.departmentId === selectedDeptId)
                        .sort((a, b) => {
                            if (a.isHead && !b.isHead) return -1;
                            if (!a.isHead && b.isHead) return 1;
                            return 0;
                        })
                    : [];

                const filteredEmployees = selectedPosId
                    ? employees.filter(e => e.positionId === selectedPosId)
                    : [];

                contentArea.innerHTML = `
                    <div style="padding: 20px 40px; height: calc(100vh - 140px); display: flex; flex-direction: column;">
                        <div style="margin-bottom: 20px;">
                            <h1 style="font-size: 24px; color: var(--gray-900); margin: 0;">Управление кадрами</h1>
                            <p style="margin: 4px 0 0; color: var(--gray-600); font-size: 13px;">Структура компании и сотрудники</p>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; flex: 1; min-height: 0;">
                            <!-- Departments -->
                            <div class="staff-col-1" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); display: flex; flex-direction: column; overflow: hidden;">
                                <div style="padding: 16px; border-bottom: 1px solid var(--gray-200); background: var(--gray-50);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-800);">1. Отделы</h3>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="btn-icon" id="dept-sort-btn" title="Сортировка А-Я" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">⇅</button>
                                            <button class="btn btn-primary" id="add-dept-btn" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;">+</button>
                                        </div>
                                    </div>
                                    <input type="text" id="dept-search" placeholder="Поиск отдела..." style="width: 100%; padding: 8px; border: 1px solid var(--gray-300); border-radius: 6px; font-size: 13px;">
                                </div>
                                <div id="dept-list" style="flex: 1; overflow-y: auto; padding: 12px;"></div>
                            </div>

                            <!-- Positions -->
                            <div class="staff-col-2" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); display: flex; flex-direction: column; overflow: hidden; opacity: ${selectedDeptId ? '1' : '0.5'}; pointer-events: ${selectedDeptId ? 'all' : 'none'};">
                                <div style="padding: 16px; border-bottom: 1px solid var(--gray-200); background: var(--gray-50);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-800);">2. Должности</h3>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="btn-icon" id="pos-sort-btn" title="Сортировка А-Я" ${selectedDeptId ? '' : 'disabled'} style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">⇅</button>
                                            <button class="btn btn-primary" id="add-pos-btn" ${selectedDeptId ? '' : 'disabled'} style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;">+</button>
                                        </div>
                                    </div>
                                    <input type="text" id="pos-search" placeholder="Поиск должности..." style="width: 100%; padding: 8px; border: 1px solid var(--gray-300); border-radius: 6px; font-size: 13px;" ${selectedDeptId ? '' : 'disabled'}>
                                </div>
                                <div id="pos-list" style="flex: 1; overflow-y: auto; padding: 12px;"></div>
                            </div>

                            <!-- Employees -->
                            <div class="staff-col-3" style="background: white; border-radius: 12px; border: 1px solid var(--gray-200); display: flex; flex-direction: column; overflow: hidden; opacity: ${selectedPosId ? '1' : '0.5'}; pointer-events: ${selectedPosId ? 'all' : 'none'};">
                                <div style="padding: 16px; border-bottom: 1px solid var(--gray-200); background: var(--gray-50);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-800);">3. Сотрудники</h3>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="btn-icon" id="emp-sort-btn" title="Сортировка А-Я" ${selectedPosId ? '' : 'disabled'} style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">⇅</button>
                                            <button class="btn btn-primary" id="add-emp-btn" ${selectedPosId ? '' : 'disabled'} style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;">+</button>
                                        </div>
                                    </div>
                                    <input type="text" id="emp-search" placeholder="Поиск сотрудника..." style="width: 100%; padding: 8px; border: 1px solid var(--gray-300); border-radius: 6px; font-size: 13px;" ${selectedPosId ? '' : 'disabled'}>
                                </div>
                                <div id="emp-list" style="flex: 1; overflow-y: auto; padding: 12px;"></div>
                            </div>
                        </div>
                    </div>`;

                // Render Departments
                const deptList = document.getElementById('dept-list');

                // Filter and sort departments
                let filteredDepts = depts.filter(d =>
                    d.name.toLowerCase().includes(deptSearchQuery.toLowerCase())
                );

                if (deptSortAZ) {
                    // Separate system and non-system departments
                    const systemDepts = filteredDepts.filter(d => d.isSystem);
                    const nonSystemDepts = filteredDepts.filter(d => !d.isSystem).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
                    filteredDepts = [...systemDepts, ...nonSystemDepts];
                }

                filteredDepts.forEach(d => {
                    const deptEmployeeCount = employees.filter(e => e.departmentId === d.id).length;
                    const el = document.createElement('div');
                    el.className = `staff-item ${selectedDeptId === d.id ? 'active' : ''}`;
                    el.style.cssText = `padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s; border: 1px solid ${selectedDeptId === d.id ? 'var(--primary)' : 'var(--gray-200)'}; background: ${selectedDeptId === d.id ? 'var(--primary-light)' : 'white'};`;
                    el.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <span style="font-weight: 500; color: ${selectedDeptId === d.id ? 'var(--primary-dark)' : 'var(--gray-700)'};">${d.name}</span>
                                <div style="font-size: 11px; color: var(--gray-500); margin-top: 2px;">${deptEmployeeCount} сотр.</div>
                            </div>
                            ${!d.isSystem ? `<button class="btn-icon delete-dept" style="opacity: 0.5;">&times;</button>` : '<span style="font-size: 12px;">🔒</span>'}
                        </div>
                    `;
                    el.onclick = () => { selectedDeptId = d.id; selectedPosId = null; internalRender(); };
                    if (!d.isSystem) {
                        el.querySelector('.delete-dept').onclick = async (e) => {
                            e.stopPropagation();
                            if (await UI.showConfirmDialog('Удаление', 'Удалить отдел?')) {
                                await fetch('/api/departments/' + d.id, { method: 'DELETE' });
                                this.showStaffManagement(projectId, { deptId: null, posId: null });
                            }
                        };
                    }
                    deptList.appendChild(el);
                });

                // Render Positions
                const posList = document.getElementById('pos-list');

                // Filter and sort positions
                let displayPositions = filteredPositions.filter(p =>
                    p.name.toLowerCase().includes(posSearchQuery.toLowerCase())
                );

                if (posSortAZ) {
                    displayPositions = displayPositions.sort((a, b) => {
                        // Keep heads first, then sort alphabetically
                        if (a.isHead && !b.isHead) return -1;
                        if (!a.isHead && b.isHead) return 1;
                        return a.name.localeCompare(b.name, 'ru');
                    });
                }

                if (displayPositions.length === 0 && selectedDeptId) posList.innerHTML = '<div style="text-align:center; color:#999; padding-top:40px;">Нет должностей</div>';
                else if (!selectedDeptId) posList.innerHTML = '<div style="text-align:center; color:#999; padding-top:40px;">Выберите отдел</div>';

                displayPositions.forEach(p => {
                    const posEmployeeCount = employees.filter(e => e.positionId === p.id).length;
                    const el = document.createElement('div');
                    el.style.cssText = `padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s; border: 1px solid ${selectedPosId === p.id ? 'var(--primary)' : 'var(--gray-200)'}; background: ${selectedPosId === p.id ? 'var(--primary-light)' : 'white'};`;
                    el.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: ${selectedPosId === p.id ? 'var(--primary-dark)' : 'var(--gray-700)'};">${p.name}</div>
                                <div style="font-size: 11px; color: var(--gray-500); margin-top: 2px;">
                                    ${p.isHead ? '<span style="color: var(--primary);">Руководитель отдела</span> • ' : ''}${posEmployeeCount} сотр.
                                </div>
                            </div>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn-icon edit-pos">✎</button>
                                ${!p.isSystem ? `<button class="btn-icon delete-pos">&times;</button>` : ''}
                            </div>
                        </div>
                    `;
                    el.onclick = () => { selectedPosId = p.id; internalRender(); };
                    el.querySelector('.edit-pos').onclick = (e) => {
                        e.stopPropagation();
                        this.openPositionModal('edit', { pos: p, depts, list: positions, projectId });
                    };
                    if (!p.isSystem) {
                        el.querySelector('.delete-pos').onclick = async (e) => {
                            e.stopPropagation();
                            if (await UI.showConfirmDialog('Удаление', 'Удалить должность?')) {
                                await fetch('/api/positions/' + p.id, { method: 'DELETE' });
                                this.showStaffManagement(projectId, { deptId: selectedDeptId, posId: null });
                            }
                        };
                    }
                    posList.appendChild(el);
                });

                // Render Employees
                const empList = document.getElementById('emp-list');

                // Filter and sort employees
                let displayEmployees = filteredEmployees.filter(e => {
                    const fullName = `${e.lastName} ${e.firstName} ${e.middleName || ''}`.toLowerCase();
                    return fullName.includes(empSearchQuery.toLowerCase());
                });

                if (empSortAZ) {
                    displayEmployees = displayEmployees.sort((a, b) =>
                        a.lastName.localeCompare(b.lastName, 'ru')
                    );
                }

                if (displayEmployees.length === 0 && selectedPosId) empList.innerHTML = '<div style="text-align:center; color:#999; padding-top:40px;">Нет сотрудников</div>';
                else if (!selectedPosId) empList.innerHTML = '<div style="text-align:center; color:#999; padding-top:40px;">Выберите должность</div>';

                displayEmployees.forEach(e => {
                    const empProject = projects.find(p => p.id === e.projectId);
                    const isBlacklisted = e.status === 'blacklist';
                    const el = document.createElement('div');
                    el.style.cssText = `padding: 12px; border-radius: 8px; margin-bottom: 8px; background: ${isBlacklisted ? '#f2f2f2' : 'white'}; border: 1px solid ${isBlacklisted ? '#dadada' : 'var(--gray-200)'}; position: relative; opacity: ${e.status === 'terminated' ? 0.7 : 1};`;
                    el.innerHTML = `
                        <div style="display: flex; align-items: start; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: #eee; background-image: url(${e.photo || ''}); background-size: cover; flex-shrink: 0;"></div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 500; color: var(--gray-900); margin-bottom: 4px;">${e.lastName} ${e.firstName}</div>
                                <div style="font-size: 11px; color: var(--gray-500); line-height: 1.4;">
                                    ${e.phone ? `📱 ${e.phone}<br>` : ''}
                                    ${e.email ? `✉️ ${e.email}<br>` : ''}
                                    ${empProject ? `🏢 ${empProject.name}<br>` : ''}
                                    ${e.score ? `⭐ ${e.score} баллов` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn-icon edit-emp">✎</button>
                                <button class="btn-icon delete-emp">&times;</button>
                            </div>
                        </div>
                    `;
                    el.querySelector('.edit-emp').onclick = () => {
                        this.openEmployeeModal('edit', { emp: e, depts, positions, projects, allEmployees: employees });
                    };
                    el.querySelector('.delete-emp').onclick = async () => {
                        if (await UI.showConfirmDialog('Увольнение', 'Уволить?')) {
                            await fetch('/api/employees/' + e.id, { method: 'DELETE' });
                            this.showStaffManagement(projectId, { deptId: selectedDeptId, posId: selectedPosId });
                        }
                    };
                    empList.appendChild(el);
                });

                // Bind Add Buttons
                document.getElementById('add-dept-btn').onclick = () => {
                    const overlay = document.createElement('div');
                    overlay.className = 'modal-overlay';
                    overlay.innerHTML = `
                       <div class="modal" style="max-width: 400px; width: 90%;">
                           <div class="modal-header"><h3>Добавить отдел</h3><button class="modal-close">&times;</button></div>
                           <div class="modal-body">
                               <div class="form-group">
                                   <label>Название отдела *</label>
                                   <input type="text" id="new-dept-name" placeholder="Напр. Отдел маркетинга" required>
                               </div>
                           </div>
                           <div class="modal-footer"><button class="btn btn-primary" id="save-dept-btn" style="width: 100%;">Сохранить</button></div>
                       </div>
                   `;
                    overlay.querySelector('.modal-close').onclick = () => overlay.remove();
                    overlay.querySelector('#save-dept-btn').onclick = async () => {
                        const name = document.getElementById('new-dept-name').value;
                        if (!name) return;
                        try {
                            const res = await fetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                            if (res.ok) this.showStaffManagement(projectId);
                            else { const err = await res.json(); UI.showNotification(err.error, 'error'); }
                            overlay.remove();
                        } catch (e) { console.error(e); }
                    };
                    document.getElementById('modal-container').appendChild(overlay);
                    document.getElementById('new-dept-name').focus();
                };

                document.getElementById('add-pos-btn').onclick = () => {
                    this.openPositionModal('create', { depts, list: positions, projectId, preSelectDeptId: selectedDeptId });
                };

                document.getElementById('add-emp-btn').onclick = () => {
                    const empStub = { departmentId: selectedDeptId, positionId: selectedPosId };
                    this.openEmployeeModal('create', { depts, positions, projects, allEmployees: employees, preSelect: empStub });
                };

                // Search handlers
                document.getElementById('dept-search').oninput = (e) => {
                    deptSearchQuery = e.target.value;
                    internalRender();
                };

                document.getElementById('pos-search').oninput = (e) => {
                    posSearchQuery = e.target.value;
                    internalRender();
                };

                document.getElementById('emp-search').oninput = (e) => {
                    empSearchQuery = e.target.value;
                    internalRender();
                };

                // Sort handlers
                document.getElementById('dept-sort-btn').onclick = () => {
                    deptSortAZ = !deptSortAZ;
                    internalRender();
                };

                document.getElementById('pos-sort-btn').onclick = () => {
                    posSortAZ = !posSortAZ;
                    internalRender();
                };

                document.getElementById('emp-sort-btn').onclick = () => {
                    empSortAZ = !empSortAZ;
                    internalRender();
                };
            };

            internalRender();

        } catch (e) { console.error(e); contentArea.innerHTML = '<p>Ошибка загрузки</p>'; }
    },

    openEmployeeModal(mode, { emp, depts, positions, projects, allEmployees, preSelect }) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Редактировать сотрудника' : 'Добавить сотрудника';

        overlay.innerHTML = `
            <div class="modal" style="max-width: 800px; width: 90%;">
                <div class="modal-header"><h3>${title}</h3><button class="modal-close">&times;</button></div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 200px; gap: 24px;">
                        <form id="employee-form" class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group"><label>Фамилия *</label><input type="text" name="lastName" value="${emp?.lastName || ''}" required></div>
                            <div class="form-group"><label>Имя *</label><input type="text" name="firstName" value="${emp?.firstName || ''}" required></div>
                            <div class="form-group"><label>Отчество</label><input type="text" name="middleName" value="${emp?.middleName || ''}"></div>
                            <div class="form-group"><label>Email</label><input type="email" name="email" value="${emp?.email || ''}"></div>
                            <div class="form-group"><label>Телефон *</label><input type="text" name="phone" value="${emp?.phone || '+998'}" required></div>
                            <div class="form-group"><label>Корпоративный номер</label><input type="text" name="corporatePhone" value="${emp?.corporatePhone || '+998'}"></div>
                            
                            <div class="form-group"><label>Пол</label>
                                <select name="gender">
                                    <option value="Мужской" ${emp?.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
                                    <option value="Женский" ${emp?.gender === 'Женский' ? 'selected' : ''}>Женский</option>
                                </select>
                            </div>
                            <div class="form-group"><label>Статус</label>
                                <select name="status">
                                    <option value="active" ${emp?.status === 'active' ? 'selected' : ''}>Активный</option>
                                    <option value="terminated" ${emp?.status === 'terminated' ? 'selected' : ''}>Уволен</option>
                                    <option value="blacklist" ${emp?.status === 'blacklist' ? 'selected' : ''}>Чёрный список</option>
                                </select>
                            </div>
                            <div class="form-group"><label>Пароль ${isEdit ? '' : '*'}</label><input type="password" name="password" placeholder="${isEdit ? 'Оставьте пустым для сохранения' : ''}" ${isEdit ? '' : 'value="123456" required'}></div>
                            
                            <div class="form-group"><label>Закрепленный объект *</label>
                                <select name="projectId" id="emp-proj-id" required>
                                    <option value="">Выберите объект</option>
                                    ${projects.map(p => `<option value="${p.id}" ${emp?.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <div style="display: flex; gap: 12px; align-items: flex-end;">
                                    <div style="flex: 1;">
                                        <label>Отдел *</label>
                                        <select name="departmentId" id="emp-dept-id" required ${preSelect?.departmentId && !isEdit ? 'disabled' : ''}>
                                            <option value="">Выберите отдел</option>
                                            ${depts.map(d => `<option value="${d.id}" ${(emp?.departmentId === d.id || (preSelect?.departmentId && d.id === preSelect.departmentId)) ? 'selected' : ''}>${d.name}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div style="padding-bottom: 10px; font-weight: bold; color: var(--gray-400);">&gt;</div>
                                    <div style="flex: 1;">
                                        <label>Должность *</label>
                                        <select name="positionId" id="emp-pos-id" required ${preSelect?.positionId && !isEdit ? 'disabled' : 'disabled'}>
                                            <option value="">Выберите должность</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group"><label>Дата приема</label><input type="date" name="hireDate" value="${emp?.hireDate ? emp.hireDate.split('T')[0] : ''}"></div>
                            <div class="form-group"><label>Набранные баллы</label><input type="number" name="score" value="${emp?.score || 0}"></div>

                            <div style="grid-column: span 2; margin-top: 12px; padding-bottom: 4px; border-bottom: 1px solid var(--gray-200); font-weight: 600; color: var(--gray-700);">Паспортные данные</div>
                            
                            <div class="form-group" style="grid-column: span 2;">
                                <div style="display: flex; gap: 12px;">
                                    <div style="flex: 2;">
                                        <label>ПИНФЛ</label>
                                        <input type="text" name="pinfl" value="${emp?.pinfl || ''}" placeholder="14 цифр">
                                    </div>
                                    <div style="flex: 1;">
                                        <label>Серия</label>
                                        <input type="text" name="passportSeries" value="${emp?.passportSeries || ''}" maxlength="2" style="text-transform: uppercase;" oninput="this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '')">
                                    </div>
                                    <div style="flex: 2;">
                                        <label>Номер</label>
                                        <input type="text" name="passportNumber" value="${emp?.passportNumber || ''}">
                                    </div>
                                </div>
                            </div>

                            <div class="form-group" style="grid-column: span 2;"><label>Кем выдано</label><input type="text" name="passportIssuedBy" value="${emp?.passportIssuedBy || ''}"></div>
                            <div class="form-group"><label>Дата выдачи</label><input type="date" name="passportIssueDate" value="${emp?.passportIssueDate ? emp.passportIssueDate.split('T')[0] : ''}"></div>
                            <div class="form-group"><label>Срок действия</label><input type="date" name="passportExpiryDate" value="${emp?.passportExpiryDate ? emp.passportExpiryDate.split('T')[0] : ''}"></div>
                            <div class="form-group"><label>Национальность</label>
                                <select name="nationality">
                                    <option value="Узбекистан" ${emp?.nationality === 'Узбекистан' ? 'selected' : ''}>Узбекистан</option>
                                    <option value="Россия" ${emp?.nationality === 'Россия' ? 'selected' : ''}>Россия</option>
                                    <option value="Казахстан" ${emp?.nationality === 'Казахстан' ? 'selected' : ''}>Казахстан</option>
                                    <option value="Таджикистан" ${emp?.nationality === 'Таджикистан' ? 'selected' : ''}>Таджикистан</option>
                                    <option value="Кыргызстан" ${emp?.nationality === 'Кыргызстан' ? 'selected' : ''}>Кыргызстан</option>
                                    <option value="Другое" ${emp?.nationality === 'Другое' ? 'selected' : ''}>Другое</option>
                                </select>
                            </div>
                        </form>
                        <div class="photo-section">
                            <label>Фото сотрудника</label>
                            <div id="emp-photo-area" style="width: 100%; height: 200px; border: 2px dashed var(--gray-300); border-radius: 12px; background: var(--gray-50); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; background-size: cover; background-position: center; ${emp?.photo ? `background-image:url(${emp.photo})` : ''}">
                                ${!emp?.photo ? `
                                <div style="text-align: center; color: var(--gray-500); padding: 10px;">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                                    </svg>
                                    <p style="font-size: 11px; margin: 0;">Нажмите или вставьте (Ctrl+V)</p>
                                </div>` : ''}
                            </div>
                            <input type="file" id="emp-photo-input" accept="image/*" style="display: none;">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="save-employee" style="width: 100%;">Сохранить</button>
                </div>
            </div>
        `;

        const projSelect = overlay.querySelector('#emp-proj-id');
        const deptSelect = overlay.querySelector('#emp-dept-id');
        const posSelect = overlay.querySelector('#emp-pos-id');

        const updatePositionsList = () => {
            const selectedDeptId = deptSelect.value;
            const selectedPosId = posSelect.value || emp?.positionId;

            if (!selectedDeptId) {
                posSelect.innerHTML = '<option value="">Сначала выберите отдел</option>';
                posSelect.disabled = true;
                return;
            }

            posSelect.disabled = (preSelect?.positionId && !isEdit) ? true : false;
            // Filter positions that belong to this department
            const filtered = positions.filter(p => p.departmentId === selectedDeptId);

            posSelect.innerHTML = `
                <option value="">Выберите должность</option>
                ${filtered.map(p => `<option value="${p.id}" ${(selectedPosId === p.id || (preSelect?.positionId && p.id === preSelect.positionId)) ? 'selected' : ''}>${p.name}</option>`).join('')}
            `;

            updatePositionsAvailability();
        };

        const updatePositionsAvailability = () => {
            const selectedProjId = projSelect.value;
            const selectedDeptId = deptSelect.value;
            const selectedProject = projects.find(p => p.id === selectedProjId);
            const isMainOffice = selectedProject?.name === 'Главный офис';

            const projectEmployees = allEmployees.filter(e => e.projectId === selectedProjId && (!isEdit || e.id !== emp.id));

            Array.from(posSelect.options).forEach(opt => {
                const posId = opt.value;
                if (!posId) return;
                const pos = positions.find(p => p.id === posId);
                const isRP_ZRP = pos?.name === 'РП (Руководитель проекта)' || pos?.name === 'ЗРП (Зам. руководителя проекта)';

                let disabled = false;
                let reason = '';

                if (isRP_ZRP && isMainOffice) {
                    disabled = true;
                    reason = '(недоступно)';
                } else if (isRP_ZRP) {
                    const alreadyExists = projectEmployees.some(e => e.positionId === posId);
                    if (alreadyExists) {
                        disabled = true;
                        reason = '(уже назначен)';
                    }
                } else if (pos?.isHead) {
                    const deptHeadExists = projectEmployees.some(e =>
                        e.departmentId === selectedDeptId &&
                        e.isHead &&
                        !['РП (Руководитель проекта)', 'ЗРП (Зам. руководителя проекта)'].includes(e.position?.name)
                    );
                    if (deptHeadExists) {
                        disabled = true;
                        reason = '(уже есть рук-ль)';
                    }
                }

                opt.disabled = disabled;
                if (disabled) {
                    if (!opt.dataset.origText) opt.dataset.origText = opt.text;
                    opt.text = `${opt.dataset.origText} ${reason}`;
                    opt.style.color = '#999';
                } else if (opt.dataset.origText) {
                    opt.text = opt.dataset.origText;
                    opt.style.color = '';
                }
            });
        };

        projSelect.onchange = updatePositionsAvailability;
        deptSelect.onchange = updatePositionsList;
        updatePositionsList(); // setup initial state

        // If preSelect Position is present and we are creating, select it after update
        if (preSelect?.positionId && !isEdit) {
            const posSelect = overlay.querySelector('#emp-pos-id');
            // Timeout to allow options to render if any async (though here it is sync)
            setTimeout(() => {
                posSelect.value = preSelect.positionId;
                // Force update availability logic
                updatePositionsAvailability();
            }, 0);
        }


        const photoArea = overlay.querySelector('#emp-photo-area');
        const photoInput = overlay.querySelector('#emp-photo-input');
        let employeePhotoData = emp?.photo || null;

        photoArea.onclick = () => photoInput.click();
        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    employeePhotoData = ev.target.result;
                    photoArea.style.backgroundImage = `url(${employeePhotoData})`;
                    photoArea.innerHTML = '';
                };
                reader.readAsDataURL(file);
            }
        };

        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        employeePhotoData = ev.target.result;
                        photoArea.style.backgroundImage = `url(${employeePhotoData})`;
                        photoArea.innerHTML = '';
                    };
                    reader.readAsDataURL(file);
                    e.preventDefault();
                    break;
                }
            }
        };
        document.addEventListener('paste', handlePaste);

        overlay.querySelector('.modal-close').onclick = () => {
            document.removeEventListener('paste', handlePaste);
            overlay.remove();
        };

        overlay.querySelector('#save-employee').onclick = async () => {
            const form = overlay.querySelector('#employee-form');
            const data = Object.fromEntries(new FormData(form).entries());
            data.photo = employeePhotoData;

            // Handle disabled fields which are not included in FormData
            if (preSelect?.departmentId && !isEdit) data.departmentId = preSelect.departmentId;
            if (preSelect?.positionId && !isEdit) data.positionId = preSelect.positionId;

            // Remove empty password if editing
            if (isEdit && !data.password) delete data.password;

            // Validation: Check if position is Head and already occupied
            const selectedPos = positions.find(p => p.id === data.positionId);
            if (selectedPos && selectedPos.isHead) {
                // Check if any OTHER employee already has this position
                const existingHead = allEmployees.find(e =>
                    e.positionId === data.positionId &&
                    e.id !== emp?.id // Exclude self if editing
                );

                if (existingHead) {
                    UI.showNotification(`Должность "${selectedPos.name}" уже занята сотрудником ${existingHead.lastName} ${existingHead.firstName}. Руководитель может быть только один.`, 'error');
                    return;
                }
            }

            try {
                const method = isEdit ? 'PUT' : 'POST';
                const url = isEdit ? `/api/employees/${emp.id}` : '/api/employees';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    document.removeEventListener('paste', handlePaste);
                    overlay.remove();
                    this.showStaffManagement(this.currentProjectId, { deptId: data.departmentId, posId: data.positionId });
                } else {
                    const err = await res.json();
                    UI.showNotification(err.error, 'error');
                }
            } catch (e) { UI.showNotification('Ошибка сети', 'error'); }
        };

        document.getElementById('modal-container').appendChild(overlay);
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
