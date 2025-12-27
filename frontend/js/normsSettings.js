// ========================================
// Norms Settings Module - Управление нормативной базой
// ========================================

const NormsSettingsManager = {
    currentProjectId: null,
    norms: [], // [{ workTypeName, unit, productionRate, resourceName?, id, createdAt }]

    // Инициализация
    async init(projectId) {
        this.currentProjectId = projectId;
        await this.loadNorms();
    },

    // Загрузка нормативов из localStorage
    loadNorms() {
        const key = `norms_${this.currentProjectId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                this.norms = JSON.parse(stored);
            } catch (e) {
                this.norms = [];
            }
        } else {
            this.norms = [];
        }
    },

    // Сохранение нормативов в localStorage
    saveNorms() {
        const key = `norms_${this.currentProjectId}`;
        localStorage.setItem(key, JSON.stringify(this.norms));
    },

    // Получить норматив для вида работ
    getNorm(workTypeName, unit) {
        return this.norms.find(n =>
            n.workTypeName === workTypeName &&
            (n.unit === unit || (!n.unit && !unit))
        );
    },

    // Найти похожие нормативы (для ИИ сопоставления)
    findSimilarNorms(workTypeName) {
        const name = workTypeName.toLowerCase();
        return this.norms.filter(n => {
            const normName = n.workTypeName.toLowerCase();
            return normName.includes(name) || name.includes(normName) ||
                normName.split(' ').some(word => name.includes(word)) ||
                name.split(' ').some(word => normName.includes(word));
        });
    },

    // Показать окно нормативной базы
    async showNormsSettings(projectId) {
        this.currentProjectId = projectId;
        await this.loadNorms();

        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; background: var(--gray-100);">
                <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; background: var(--white);">
                    <div style="padding: 12px 24px; background: var(--gray-50); border-bottom: 1px solid var(--gray-300); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-700);">Нормативная база</h3>
                        <button id="add-norm-btn" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                            Добавить норматив
                        </button>
                    </div>
                    
                    <div style="flex: 1; overflow-y: auto; padding: 24px;">
                        <div class="data-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">№</th>
                                        <th>Вид работ</th>
                                        <th style="width: 100px;">Ед. изм.</th>
                                        <th style="width: 150px;">Норматив (ед/день)</th>
                                        <th style="width: 150px;">Ресурс</th>
                                        <th style="width: 150px;">Действия</th>
                                    </tr>
                                </thead>
                                <tbody id="norms-table-body">
                                    ${this.renderNormsTable()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Инициализация обработчиков
        document.getElementById('add-norm-btn').addEventListener('click', () => {
            this.showAddNormModal();
        });

        // Обработчики для кнопок редактирования/удаления
        this.attachNormActions();
    },

    // Рендеринг таблицы нормативов
    renderNormsTable() {
        if (this.norms.length === 0) {
            return `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--gray-600);">
                        Нормативы не добавлены. Нажмите "Добавить норматив" для создания.
                    </td>
                </tr>
            `;
        }

        return this.norms.map((norm, index) => `
            <tr data-norm-id="${norm.id}">
                <td>${index + 1}</td>
                <td>${norm.workTypeName}</td>
                <td>${norm.unit || '-'}</td>
                <td style="font-weight: 600; color: var(--primary);">${norm.productionRate}</td>
                <td>${norm.resourceName || '-'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="NormsSettingsManager.editNorm('${norm.id}')" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;">
                        Редактировать
                    </button>
                    <button class="btn btn-danger" onclick="NormsSettingsManager.deleteNorm('${norm.id}')" style="padding: 4px 8px; font-size: 12px;">
                        Удалить
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Прикрепить обработчики действий
    attachNormActions() {
        // Обработчики уже добавлены через onclick в HTML
    },

    // Показать модальное окно добавления/редактирования норматива
    async showAddNormModal(normId = null) {
        const norm = normId ? this.norms.find(n => n.id === normId) : null;
        const isEdit = !!norm;

        // Загружаем виды работ из справочника
        const workTypesData = this.loadWorkTypesFromSettings();

        const content = `
            <div class="form-group">
                <label>Вид работ *</label>
                <input type="text" id="norm-worktype-name" value="${norm ? (norm.workTypeName || '') : ''}" 
                       placeholder="Например: Кладка кирпича" 
                       list="worktypes-list"
                       required>
                <datalist id="worktypes-list">
                    ${workTypesData.map(wt => `<option value="${wt.name}">${wt.group}</option>`).join('')}
                </datalist>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Единица измерения *</label>
                    <input type="text" id="norm-unit" value="${norm ? (norm.unit || '') : ''}" 
                           placeholder="м², м³, шт, т" required>
                </div>
                <div class="form-group">
                    <label>Норматив (ед/день) *</label>
                    <input type="number" id="norm-production-rate" 
                           value="${norm ? (norm.productionRate || '') : ''}" 
                           placeholder="10.5" step="0.1" min="0.1" required>
                </div>
            </div>
            <div class="form-group">
                <label>Ресурс (опционально)</label>
                <input type="text" id="norm-resource-name" value="${norm ? (norm.resourceName || '') : ''}" 
                       placeholder="Например: Бригада каменщиков (3 чел.)">
            </div>
            <div class="form-group" style="margin-top: 16px; padding: 12px; background: var(--gray-50); border-radius: var(--radius-md);">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <input type="checkbox" id="norm-generate-with-ai" style="width: auto;">
                    <span>Сгенерировать норматив с помощью ИИ</span>
                </label>
                <button type="button" id="generate-norm-ai-btn" class="btn btn-secondary" 
                        style="padding: 6px 12px; font-size: 13px; display: none; margin-top: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Сгенерировать
                </button>
            </div>
        `;

        const buttons = [
            {
                text: 'Отмена',
                class: 'btn-secondary',
                onclick: () => UI.closeModal()
            },
            {
                text: isEdit ? 'Сохранить' : 'Добавить',
                class: 'btn-primary',
                onclick: () => this.saveNorm(normId)
            }
        ];

        UI.showModal(isEdit ? 'Редактировать норматив' : 'Добавить норматив', content, buttons);

        // Обработчик чекбокса "Сгенерировать с ИИ"
        setTimeout(() => {
            const aiCheckbox = document.getElementById('norm-generate-with-ai');
            const generateBtn = document.getElementById('generate-norm-ai-btn');

            aiCheckbox.addEventListener('change', (e) => {
                generateBtn.style.display = e.target.checked ? 'inline-flex' : 'none';
            });

            generateBtn.addEventListener('click', () => {
                this.generateNormWithAI();
            });
        }, 100);
    },

    // Генерация норматива с помощью ИИ
    async generateNormWithAI() {
        const workTypeNameInput = document.getElementById('norm-worktype-name');
        const unitInput = document.getElementById('norm-unit');
        const productionRateInput = document.getElementById('norm-production-rate');
        const generateBtn = document.getElementById('generate-norm-ai-btn');

        const workTypeName = workTypeNameInput.value.trim();
        const unit = unitInput.value.trim();

        if (!workTypeName) {
            UI.showNotification('Введите вид работ для генерации норматива', 'error');
            return;
        }

        if (!unit) {
            UI.showNotification('Введите единицу измерения', 'error');
            return;
        }

        // Блокируем кнопку
        const originalText = generateBtn.innerHTML;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> Генерация...';

        try {
            const productionRate = await NormsManager.calculateNorm(workTypeName, unit);
            productionRateInput.value = productionRate;
            UI.showNotification(`✅ Норматив сгенерирован: ${productionRate} ${unit}/день`, 'success');
        } catch (error) {
            console.error('Error generating norm:', error);
            UI.showNotification('Ошибка генерации норматива: ' + (error.message || 'Попробуйте позже'), 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
        }
    },

    // Загрузить виды работ из справочника (из localStorage)
    loadWorkTypesFromSettings() {
        const key = `worktypes_${this.currentProjectId}`;
        const stored = localStorage.getItem(key);
        if (!stored) return [];

        try {
            const data = JSON.parse(stored);
            const workTypes = [];

            if (data.groups && Array.isArray(data.groups)) {
                data.groups.forEach(group => {
                    if (group.items && Array.isArray(group.items)) {
                        group.items.forEach(item => {
                            workTypes.push({
                                name: item.name,
                                group: group.name
                            });
                        });
                    }
                });
            }

            return workTypes;
        } catch (e) {
            return [];
        }
    },

    // Сохранение норматива
    saveNorm(normId = null) {
        const workTypeName = document.getElementById('norm-worktype-name').value.trim();
        const unit = document.getElementById('norm-unit').value.trim();
        const productionRate = parseFloat(document.getElementById('norm-production-rate').value);
        const resourceName = document.getElementById('norm-resource-name').value.trim() || null;

        if (!workTypeName || !unit || !productionRate || productionRate <= 0) {
            UI.showNotification('Заполните все обязательные поля', 'error');
            return;
        }

        if (normId) {
            // Редактирование
            const index = this.norms.findIndex(n => n.id === normId);
            if (index !== -1) {
                this.norms[index] = {
                    ...this.norms[index],
                    workTypeName,
                    unit,
                    productionRate,
                    resourceName,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            // Добавление
            const newNorm = {
                id: `norm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                workTypeName,
                unit,
                productionRate,
                resourceName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.norms.push(newNorm);
        }

        this.saveNorms();
        this.showNormsSettings(this.currentProjectId);
        UI.closeModal();
        UI.showNotification(normId ? 'Норматив обновлен' : 'Норматив добавлен', 'success');
    },

    // Редактирование норматива
    editNorm(normId) {
        this.showAddNormModal(normId);
    },

    // Удаление норматива
    async deleteNorm(normId) {
        const confirmed = await UI.showConfirmDialog('Удаление', 'Вы уверены, что хотите удалить этот норматив?');
        if (!confirmed) return;

        this.norms = this.norms.filter(n => n.id !== normId);
        this.saveNorms();
        this.showNormsSettings(this.currentProjectId);
        UI.showNotification('Норматив удален', 'success');
    }
};

// Добавляем метод в SettingsManager
if (typeof SettingsManager !== 'undefined') {
    SettingsManager.showNormsSettings = function (projectId) {
        NormsSettingsManager.showNormsSettings(projectId);
    };
}







