// ========================================
// Schedule Manager - Управление ГПР
// Пошаговое создание: Блок → Разделы → Этапы/Виды работ
// ========================================

const ScheduleManager = {
    currentScheduleId: null,
    currentProjectId: null,
    blocks: [],          // Блоки проекта
    estimates: [],       // Сметы
    selectedBlockId: null,
    selectedSections: [], // Выбранные разделы сметы

    // ========================================
    // Инициализация
    // ========================================
    async init(projectId) {
        this.currentProjectId = projectId;
        await this.loadProjectData();
        await this.render();
    },

    // Загрузить данные проекта (блоки и сметы)
    async loadProjectData() {
        try {
            this.blocks = await api.getBlocks(this.currentProjectId);
            this.estimates = await api.getEstimates(this.currentProjectId);
        } catch (error) {
            console.error('Error loading project data:', error);
            this.blocks = [];
            this.estimates = [];
        }
    },

    // ========================================
    // Главный рендер - список ГПР
    // ========================================
    async render() {
        const container = document.getElementById('content-area');
        if (!container) return;

        try {
            const schedules = await api.getSchedules(this.currentProjectId);

            container.innerHTML = `
                <div class="schedule-container" style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2>График производства работ (ГПР)</h2>
                        <button onclick="ScheduleManager.showCreateScheduleWizard()" class="btn-primary" style="display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                            </svg>
                            Создать ГПР
                        </button>
                    </div>

                    ${this.blocks.length === 0 
                        ? this.renderNoBlocksState() 
                        : (schedules.length === 0 ? this.renderEmptyState() : this.renderSchedulesList(schedules))
                    }
                </div>
            `;
        } catch (error) {
            console.error('Error rendering schedules:', error);
            container.innerHTML = `
                <div style="padding: 24px; color: var(--accent-red);">
                    Ошибка загрузки графиков: ${error.message}
                </div>
            `;
        }
    },

    renderNoBlocksState() {
        return `
            <div style="text-align: center; padding: 48px; background: var(--gray-50); border-radius: 8px;">
                <svg width="64" height="64" fill="var(--gray-400)" viewBox="0 0 16 16" style="margin-bottom: 16px;">
                    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                </svg>
                <h3 style="color: var(--gray-600); margin-bottom: 8px;">Нет блоков</h3>
                <p style="color: var(--gray-500);">Сначала создайте блоки и сметы в разделе "Смета"</p>
            </div>
        `;
    },

    renderEmptyState() {
        return `
            <div style="text-align: center; padding: 48px; background: var(--gray-50); border-radius: 8px;">
                <svg width="64" height="64" fill="var(--gray-400)" viewBox="0 0 16 16" style="margin-bottom: 16px;">
                    <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4V.5zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z"/>
                </svg>
                <h3 style="color: var(--gray-600); margin-bottom: 8px;">Нет графиков</h3>
                <p style="color: var(--gray-500);">Создайте первый ГПР для планирования работ</p>
            </div>
        `;
    },

    renderSchedulesList(schedules) {
        return `
            <div class="schedules-list" style="display: flex; flex-direction: column; gap: 16px;">
                ${schedules.map(schedule => this.renderScheduleCard(schedule)).join('')}
            </div>
        `;
    },

    renderScheduleCard(schedule) {
        const statusColors = {
            draft: 'var(--gray-500)',
            active: 'var(--accent-blue)',
            completed: 'var(--accent-green)',
        };
        const statusLabels = {
            draft: 'Черновик',
            active: 'Активный',
            completed: 'Завершён',
        };

        // Найти блок для этого графика
        const block = this.blocks.find(b => b.id === schedule.blockId);
        const blockName = block?.name || '';

        return `
            <div class="schedule-card" style="
                background: var(--white);
                border-radius: 8px;
                padding: 16px 20px;
                box-shadow: var(--shadow-sm);
                border-left: 4px solid ${statusColors[schedule.status] || statusColors.draft};
                cursor: pointer;
                transition: all 0.2s;
            " onclick="ScheduleManager.openSchedule('${schedule.id}')"
               onmouseover="this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateX(4px)'"
               onmouseout="this.style.boxShadow='var(--shadow-sm)'; this.style.transform='translateX(0)'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            ${blockName ? `<span style="background: var(--gray-200); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">${blockName}</span>` : ''}
                            <h4 style="margin: 0; color: var(--gray-800);">${schedule.name}</h4>
                        </div>
                        <div style="display: flex; gap: 16px; font-size: 13px; color: var(--gray-500);">
                            <span>${new Date(schedule.startDate).toLocaleDateString('ru-RU')} — ${new Date(schedule.endDate).toLocaleDateString('ru-RU')}</span>
                            <span>Работ: ${schedule._count?.items || 0}</span>
                        </div>
                    </div>
                    <span style="
                        background: ${statusColors[schedule.status]}15;
                        color: ${statusColors[schedule.status]};
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 500;
                    ">${statusLabels[schedule.status] || schedule.status}</span>
                </div>
            </div>
        `;
    },

    // ========================================
    // Мастер создания ГПР (Шаг 1: Выбор блока)
    // ========================================
    async showCreateScheduleWizard() {
        this.selectedBlockId = null;
        this.selectedSections = [];

        if (this.blocks.length === 0) {
            UI.showToast('Сначала создайте блоки в разделе Смета', 'warning');
            return;
        }

        UI.showModal('Создание ГПР — Шаг 1: Выбор блока', `
            <div id="wizard-step-1">
                <p style="color: var(--gray-600); margin-bottom: 16px;">
                    Выберите блок, для которого создаётся график работ:
                </p>
                <div class="block-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                    ${this.blocks.map(block => {
                        const blockEstimates = this.estimates.filter(e => e.blockId === block.id);
                        const hasEstimates = blockEstimates.length > 0;
                        return `
                            <div class="block-option ${hasEstimates ? '' : 'disabled'}" 
                                 data-block-id="${block.id}"
                                 style="
                                    padding: 16px;
                                    border: 2px solid var(--gray-200);
                                    border-radius: 8px;
                                    cursor: ${hasEstimates ? 'pointer' : 'not-allowed'};
                                    opacity: ${hasEstimates ? '1' : '0.5'};
                                    transition: all 0.2s;
                                 "
                                 ${hasEstimates ? `onclick="ScheduleManager.selectBlock('${block.id}')"` : ''}>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="color: var(--gray-800);">${block.name}</strong>
                                        <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--gray-500);">
                                            ${block.description || 'Без описания'}
                                        </p>
                                    </div>
                                    <div style="text-align: right; font-size: 13px;">
                                        <div style="color: var(--gray-600);">Смет: ${blockEstimates.length}</div>
                                        ${!hasEstimates ? '<div style="color: var(--accent-red);">Нет смет</div>' : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                    <button type="button" onclick="UI.closeModal()" class="btn-secondary">Отмена</button>
                </div>
            </div>
        `, { width: '500px' });
    },

    // ========================================
    // Шаг 2: Выбор разделов сметы
    // ========================================
    async selectBlock(blockId) {
        this.selectedBlockId = blockId;
        const block = this.blocks.find(b => b.id === blockId);
        const blockEstimates = this.estimates.filter(e => e.blockId === blockId);

        // Загружаем разделы для всех смет блока
        let allSections = [];
        for (const estimate of blockEstimates) {
            const sections = await api.getSections(estimate.id);
            for (const section of sections) {
                allSections.push({
                    ...section,
                    estimateName: estimate.name,
                    estimateId: estimate.id,
                });
            }
        }

        if (allSections.length === 0) {
            UI.showToast('В сметах этого блока нет разделов', 'warning');
            return;
        }

        UI.showModal(`Создание ГПР — Шаг 2: Разделы (${block.name})`, `
            <div id="wizard-step-2">
                <p style="color: var(--gray-600); margin-bottom: 16px;">
                    Выберите разделы сметы для включения в график:
                </p>
                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="select-all-sections" onchange="ScheduleManager.toggleAllSections(this)">
                        <strong>Выбрать все</strong>
                    </label>
                </div>
                <div class="sections-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 350px; overflow-y: auto;">
                    ${allSections.map(section => `
                        <label class="section-option" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 12px 16px;
                            border: 1px solid var(--gray-200);
                            border-radius: 6px;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">
                            <input type="checkbox" class="section-checkbox" value="${section.id}" 
                                   data-section='${JSON.stringify({id: section.id, code: section.code, name: section.name, estimateName: section.estimateName}).replace(/'/g, "&#39;")}'>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="background: var(--accent-blue); color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                                        ${section.code}
                                    </span>
                                    <strong>${section.name}</strong>
                                </div>
                                <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">
                                    Смета: ${section.estimateName} • Сумма: ${UI.formatCurrency(section.totalCost || 0)}
                                </div>
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 24px;">
                    <button type="button" onclick="ScheduleManager.showCreateScheduleWizard()" class="btn-secondary">← Назад</button>
                    <button type="button" onclick="ScheduleManager.goToStep3()" class="btn-primary">Далее →</button>
                </div>
            </div>
        `, { width: '550px' });
    },

    toggleAllSections(checkbox) {
        const checkboxes = document.querySelectorAll('.section-checkbox');
        checkboxes.forEach(cb => cb.checked = checkbox.checked);
    },

    // ========================================
    // Шаг 3: Настройки и предпросмотр
    // ========================================
    async goToStep3() {
        const checkboxes = document.querySelectorAll('.section-checkbox:checked');
        if (checkboxes.length === 0) {
            UI.showToast('Выберите хотя бы один раздел', 'warning');
            return;
        }

        this.selectedSections = [];
        checkboxes.forEach(cb => {
            this.selectedSections.push(JSON.parse(cb.dataset.section.replace(/&#39;/g, "'")));
        });

        const block = this.blocks.find(b => b.id === this.selectedBlockId);
        const today = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        UI.showModal(`Создание ГПР — Шаг 3: Настройки`, `
            <form id="create-schedule-form">
                <div style="background: var(--gray-50); padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                    <div style="font-size: 13px; color: var(--gray-500);">Блок: <strong style="color: var(--gray-800);">${block.name}</strong></div>
                    <div style="font-size: 13px; color: var(--gray-500); margin-top: 4px;">
                        Разделы: ${this.selectedSections.map(s => s.code).join(', ')}
                    </div>
                </div>

                <div class="form-group">
                    <label>Название графика *</label>
                    <input type="text" name="name" required value="ГПР ${block.name}" placeholder="Название графика">
                </div>
                
                <div class="form-group">
                    <label>Описание</label>
                    <textarea name="description" rows="2" placeholder="Описание графика...">${this.selectedSections.map(s => s.name).join(', ')}</textarea>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Дата начала *</label>
                        <input type="date" name="startDate" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label>Дата окончания *</label>
                        <input type="date" name="endDate" required value="${endDate}">
                    </div>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" name="importWorkTypes" checked>
                        Импортировать виды работ из выбранных разделов
                    </label>
                    <small style="color: var(--gray-500); display: block; margin-top: 4px;">
                        Виды работ будут добавлены как позиции графика
                    </small>
                </div>

                <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 24px;">
                    <button type="button" onclick="ScheduleManager.selectBlock('${this.selectedBlockId}')" class="btn-secondary">← Назад</button>
                    <button type="submit" class="btn-primary">Создать ГПР</button>
                </div>
            </form>
        `, { width: '500px' });

        document.getElementById('create-schedule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createScheduleWithItems(new FormData(e.target));
        });
    },

    // ========================================
    // Создание ГПР с импортом видов работ
    // ========================================
    async createScheduleWithItems(formData) {
        try {
            UI.showToast('Создание графика...', 'info');

            // 1. Создаём график
            const schedule = await api.createSchedule({
                projectId: this.currentProjectId,
                blockId: this.selectedBlockId,
                name: formData.get('name'),
                description: formData.get('description'),
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate'),
            });

            // 2. Если выбран импорт — добавляем виды работ
            if (formData.get('importWorkTypes')) {
                const startDate = new Date(formData.get('startDate'));
                let dayOffset = 0;

                for (const section of this.selectedSections) {
                    // Загружаем этапы (виды работ) раздела
                    const stages = await api.getStages(section.id);
                    
                    for (const stage of stages) {
                        // Каждый этап добавляем как позицию графика
                        const itemStart = new Date(startDate);
                        itemStart.setDate(itemStart.getDate() + dayOffset);
                        
                        const itemEnd = new Date(itemStart);
                        itemEnd.setDate(itemEnd.getDate() + 7); // По умолчанию неделя

                        await api.createScheduleItem(schedule.id, {
                            estimateStageId: stage.id,
                            name: `${section.code}: ${stage.name}`,
                            unit: stage.unit || '',
                            plannedQuantity: stage.quantity || 0,
                            plannedCost: stage.totalCost || 0,
                            plannedStart: itemStart.toISOString().split('T')[0],
                            plannedEnd: itemEnd.toISOString().split('T')[0],
                        });

                        dayOffset += 3; // Смещаем следующую работу на 3 дня
                    }
                }
            }

            UI.closeModal();
            await this.render();
            UI.showToast('ГПР создан успешно!', 'success');
            
            // Открываем созданный график
            await this.openSchedule(schedule.id);

        } catch (error) {
            console.error('Error creating schedule:', error);
            UI.showToast('Ошибка создания: ' + error.message, 'error');
        }
    },

    // ========================================
    // Открыть график (детальный вид)
    // ========================================
    async openSchedule(scheduleId) {
        this.currentScheduleId = scheduleId;
        
        try {
            const schedule = await api.getSchedule(scheduleId);
            const container = document.getElementById('content-area');

            // Группируем позиции по разделам
            const groupedItems = this.groupItemsBySection(schedule.items || []);

            container.innerHTML = `
                <div class="schedule-detail" style="padding: 24px;">
                    <!-- Заголовок -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <button onclick="ScheduleManager.render()" class="btn-icon" title="Назад">
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                    <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                                </svg>
                            </button>
                            <div>
                                <h2 style="margin: 0;">${schedule.name}</h2>
                                <p style="margin: 4px 0 0 0; color: var(--gray-500); font-size: 14px;">
                                    ${new Date(schedule.startDate).toLocaleDateString('ru-RU')} — 
                                    ${new Date(schedule.endDate).toLocaleDateString('ru-RU')}
                                </p>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <button onclick="ScheduleManager.showAddItemModal()" class="btn-secondary" style="display: flex; align-items: center; gap: 8px;">
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                                </svg>
                                Добавить работу
                            </button>
                            <button onclick="ScheduleManager.deleteSchedule('${scheduleId}')" class="btn-icon" style="color: var(--accent-red);" title="Удалить график">
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Сводка -->
                    ${this.renderScheduleSummary(schedule)}

                    <!-- Позиции по разделам -->
                    ${this.renderGroupedItems(groupedItems)}
                </div>
            `;
        } catch (error) {
            console.error('Error opening schedule:', error);
            UI.showToast('Ошибка загрузки графика: ' + error.message, 'error');
        }
    },

    groupItemsBySection(items) {
        const groups = {};
        for (const item of items) {
            const sectionCode = item.estimateStage?.section?.code || 'Без раздела';
            const sectionName = item.estimateStage?.section?.name || '';
            const key = sectionCode;
            
            if (!groups[key]) {
                groups[key] = {
                    code: sectionCode,
                    name: sectionName,
                    items: [],
                    totalCost: 0,
                };
            }
            groups[key].items.push(item);
            groups[key].totalCost += item.plannedCost || 0;
        }
        return groups;
    },

    renderScheduleSummary(schedule) {
        const items = schedule.items || [];
        const totalCost = items.reduce((sum, i) => sum + (i.plannedCost || 0), 0);
        const completedCount = items.filter(i => i.status === 'completed').length;
        const inProgressCount = items.filter(i => i.status === 'in_progress').length;

        return `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                <div style="background: var(--white); padding: 16px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                    <div style="color: var(--gray-500); font-size: 13px;">Всего работ</div>
                    <div style="font-size: 24px; font-weight: 600; color: var(--gray-800);">${items.length}</div>
                </div>
                <div style="background: var(--white); padding: 16px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                    <div style="color: var(--gray-500); font-size: 13px;">В работе</div>
                    <div style="font-size: 24px; font-weight: 600; color: var(--accent-blue);">${inProgressCount}</div>
                </div>
                <div style="background: var(--white); padding: 16px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                    <div style="color: var(--gray-500); font-size: 13px;">Завершено</div>
                    <div style="font-size: 24px; font-weight: 600; color: var(--accent-green);">${completedCount}</div>
                </div>
                <div style="background: var(--white); padding: 16px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                    <div style="color: var(--gray-500); font-size: 13px;">Плановая стоимость</div>
                    <div style="font-size: 20px; font-weight: 600; color: var(--gray-800);">${UI.formatCurrency(totalCost)}</div>
                </div>
            </div>
        `;
    },

    renderGroupedItems(groupedItems) {
        const sections = Object.values(groupedItems);
        
        if (sections.length === 0) {
            return `
                <div style="text-align: center; padding: 32px; background: var(--gray-50); border-radius: 8px;">
                    <p style="color: var(--gray-500);">Нет работ в графике</p>
                </div>
            `;
        }

        return sections.map(section => `
            <div class="schedule-section" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 8px 12px; background: var(--gray-100); border-radius: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: var(--accent-blue); color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${section.code}
                        </span>
                        <strong>${section.name}</strong>
                    </div>
                    <span style="font-size: 14px; color: var(--gray-600);">
                        ${UI.formatCurrency(section.totalCost)}
                    </span>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: var(--gray-50);">
                                <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--gray-200);">Работа</th>
                                <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--gray-200); width: 80px;">Объём</th>
                                <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--gray-200); width: 100px;">Начало</th>
                                <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--gray-200); width: 100px;">Окончание</th>
                                <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid var(--gray-200); width: 120px;">Стоимость</th>
                                <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--gray-200); width: 100px;">Статус</th>
                                <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--gray-200); width: 60px;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${section.items.map(item => this.renderItemRow(item)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('');
    },

    renderItemRow(item) {
        const statusColors = {
            not_started: 'var(--gray-500)',
            in_progress: 'var(--accent-blue)',
            completed: 'var(--accent-green)',
            delayed: 'var(--accent-red)',
        };

        return `
            <tr style="border-bottom: 1px solid var(--gray-100);">
                <td style="padding: 10px 12px;">
                    <div>${item.name}</div>
                    ${item.floor ? `<div style="font-size: 12px; color: var(--gray-500);">Этаж ${item.floor}</div>` : ''}
                </td>
                <td style="padding: 10px 12px; text-align: center;">
                    ${item.plannedQuantity || 0} ${item.unit || ''}
                </td>
                <td style="padding: 10px 12px; text-align: center; font-size: 13px;">
                    ${new Date(item.plannedStart).toLocaleDateString('ru-RU')}
                </td>
                <td style="padding: 10px 12px; text-align: center; font-size: 13px;">
                    ${new Date(item.plannedEnd).toLocaleDateString('ru-RU')}
                </td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 500;">
                    ${UI.formatCurrency(item.plannedCost || 0)}
                </td>
                <td style="padding: 10px 12px; text-align: center;">
                    <select onchange="ScheduleManager.updateItemStatus('${item.id}', this.value)" 
                            style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--gray-300); font-size: 12px; background: ${statusColors[item.status]}15; color: ${statusColors[item.status]};">
                        <option value="not_started" ${item.status === 'not_started' ? 'selected' : ''}>Ожидает</option>
                        <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                        <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Готово</option>
                        <option value="delayed" ${item.status === 'delayed' ? 'selected' : ''}>Задержка</option>
                    </select>
                </td>
                <td style="padding: 10px 12px; text-align: center;">
                    <button onclick="ScheduleManager.deleteItem('${item.id}')" class="btn-icon" style="color: var(--accent-red);" title="Удалить">
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    },

    // ========================================
    // Обновление статуса позиции
    // ========================================
    async updateItemStatus(itemId, status) {
        try {
            await api.updateScheduleItem(this.currentScheduleId, itemId, { status });
        } catch (error) {
            UI.showToast('Ошибка обновления: ' + error.message, 'error');
            await this.openSchedule(this.currentScheduleId);
        }
    },

    // ========================================
    // Модальное окно добавления работы
    // ========================================
    async showAddItemModal() {
        const schedule = await api.getSchedule(this.currentScheduleId);
        
        // Получаем виды работ из смет блока
        const blockEstimates = this.estimates.filter(e => e.blockId === schedule.blockId);
        let allStages = [];
        
        for (const estimate of blockEstimates) {
            const sections = await api.getSections(estimate.id);
            for (const section of sections) {
                const stages = await api.getStages(section.id);
                for (const stage of stages) {
                    allStages.push({
                        id: stage.id,
                        name: stage.name,
                        unit: stage.unit,
                        quantity: stage.quantity || 0,
                        totalCost: stage.totalCost || 0,
                        sectionCode: section.code,
                        sectionName: section.name,
                    });
                }
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        UI.showModal('Добавить работу', `
            <form id="add-item-form">
                <div class="form-group">
                    <label>Вид работ из сметы</label>
                    <select name="estimateStageId" id="stage-select" onchange="ScheduleManager.onStageSelect(this)">
                        <option value="">— Выберите или добавьте вручную —</option>
                        ${allStages.map(s => `
                            <option value="${s.id}" 
                                data-unit="${s.unit || ''}"
                                data-quantity="${s.quantity}"
                                data-cost="${s.totalCost}"
                                data-name="${s.sectionCode}: ${s.name}">
                                ${s.sectionCode}: ${s.name} (${s.quantity} ${s.unit || ''})
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Название работы *</label>
                    <input type="text" name="name" id="item-name" required placeholder="Название работы">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label>Ед. изм.</label>
                        <input type="text" name="unit" id="item-unit" placeholder="м³">
                    </div>
                    <div class="form-group">
                        <label>Объём</label>
                        <input type="number" name="plannedQuantity" id="item-quantity" step="0.01" value="0">
                    </div>
                    <div class="form-group">
                        <label>Этаж</label>
                        <input type="number" name="floor" placeholder="1">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label>Дата начала *</label>
                        <input type="date" name="plannedStart" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label>Дата окончания *</label>
                        <input type="date" name="plannedEnd" required value="${nextWeek}">
                    </div>
                </div>

                <div class="form-group">
                    <label>Плановая стоимость</label>
                    <input type="number" name="plannedCost" id="item-cost" step="0.01" value="0">
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                    <button type="button" onclick="UI.closeModal()" class="btn-secondary">Отмена</button>
                    <button type="submit" class="btn-primary">Добавить</button>
                </div>
            </form>
        `);

        document.getElementById('add-item-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                await api.createScheduleItem(this.currentScheduleId, {
                    estimateStageId: formData.get('estimateStageId') || null,
                    name: formData.get('name'),
                    unit: formData.get('unit'),
                    floor: formData.get('floor') ? parseInt(formData.get('floor')) : null,
                    plannedQuantity: parseFloat(formData.get('plannedQuantity')) || 0,
                    plannedCost: parseFloat(formData.get('plannedCost')) || 0,
                    plannedStart: formData.get('plannedStart'),
                    plannedEnd: formData.get('plannedEnd'),
                });
                UI.closeModal();
                await this.openSchedule(this.currentScheduleId);
                UI.showToast('Работа добавлена', 'success');
            } catch (error) {
                UI.showToast('Ошибка: ' + error.message, 'error');
            }
        });
    },

    onStageSelect(select) {
        const option = select.options[select.selectedIndex];
        if (!option.value) return;

        document.getElementById('item-name').value = option.dataset.name;
        document.getElementById('item-unit').value = option.dataset.unit;
        document.getElementById('item-quantity').value = option.dataset.quantity;
        document.getElementById('item-cost').value = option.dataset.cost;
    },

    // ========================================
    // Удаление
    // ========================================
    async deleteItem(itemId) {
        if (!confirm('Удалить эту работу?')) return;
        try {
            await api.deleteScheduleItem(this.currentScheduleId, itemId);
            await this.openSchedule(this.currentScheduleId);
            UI.showToast('Работа удалена', 'success');
        } catch (error) {
            UI.showToast('Ошибка: ' + error.message, 'error');
        }
    },

    async deleteSchedule(scheduleId) {
        if (!confirm('Удалить весь график? Это действие нельзя отменить.')) return;
        try {
            await api.deleteSchedule(scheduleId);
            await this.render();
            UI.showToast('График удалён', 'success');
        } catch (error) {
            UI.showToast('Ошибка: ' + error.message, 'error');
        }
    },
};

// Экспорт для глобального доступа
window.ScheduleManager = ScheduleManager;
