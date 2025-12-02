// ========================================
// Schedule Manager - Управление ГПР
// Связь со сметой через EstimateStage (Вид работ)
// ========================================

const ScheduleManager = {
    currentScheduleId: null,
    currentProjectId: null,
    estimateStages: [], // Все виды работ из сметы для выбора

    // ========================================
    // Инициализация и рендер
    // ========================================
    async init(projectId) {
        this.currentProjectId = projectId;
        await this.loadEstimateStages();
        await this.render();
    },

    // Загрузить все виды работ из сметы проекта
    async loadEstimateStages() {
        try {
            // Получаем все сметы проекта
            const estimates = await api.getEstimates(this.currentProjectId);
            this.estimateStages = [];

            for (const estimate of estimates) {
                const sections = await api.getSections(estimate.id);
                for (const section of sections) {
                    const stages = await api.getStages(section.id);
                    for (const stage of stages) {
                        this.estimateStages.push({
                            id: stage.id,
                            name: stage.name,
                            unit: stage.unit,
                            quantity: stage.quantity || 0,
                            totalCost: stage.totalCost || 0,
                            usedQuantity: 0, // Будет рассчитано
                            sectionName: section.name,
                            sectionCode: section.code,
                            estimateName: estimate.name,
                            blockName: estimate.block?.name || '',
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error loading estimate stages:', error);
            this.estimateStages = [];
        }
    },

    async render() {
        const container = document.getElementById('content-area');
        if (!container) return;

        try {
            const schedules = await api.getSchedules(this.currentProjectId);

            container.innerHTML = `
                <div class="schedule-container" style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2>График производства работ (ГПР)</h2>
                        <button onclick="ScheduleManager.showCreateScheduleModal()" class="btn-primary" style="display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                            </svg>
                            Создать график
                        </button>
                    </div>

                    ${schedules.length === 0 ? this.renderEmptyState() : this.renderSchedulesList(schedules)}
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

    renderEmptyState() {
        return `
            <div style="text-align: center; padding: 48px; background: var(--gray-50); border-radius: 8px;">
                <svg width="64" height="64" fill="var(--gray-400)" viewBox="0 0 16 16" style="margin-bottom: 16px;">
                    <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4V.5zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z"/>
                </svg>
                <h3 style="color: var(--gray-600); margin-bottom: 8px;">Нет графиков</h3>
                <p style="color: var(--gray-500);">Создайте первый график производства работ</p>
            </div>
        `;
    },

    renderSchedulesList(schedules) {
        return `
            <div class="schedules-list" style="display: grid; gap: 16px;">
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

        return `
            <div class="schedule-card" style="
                background: var(--white);
                border-radius: 8px;
                padding: 20px;
                box-shadow: var(--shadow-sm);
                border-left: 4px solid ${statusColors[schedule.status] || statusColors.draft};
                cursor: pointer;
                transition: box-shadow 0.2s;
            " onclick="ScheduleManager.openSchedule('${schedule.id}')"
               onmouseover="this.style.boxShadow='var(--shadow-md)'"
               onmouseout="this.style.boxShadow='var(--shadow-sm)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0 0 8px 0; color: var(--gray-800);">${schedule.name}</h3>
                        <p style="margin: 0; color: var(--gray-500); font-size: 14px;">
                            ${schedule.description || 'Без описания'}
                        </p>
                    </div>
                    <span style="
                        background: ${statusColors[schedule.status]}20;
                        color: ${statusColors[schedule.status]};
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 500;
                    ">${statusLabels[schedule.status] || schedule.status}</span>
                </div>
                <div style="display: flex; gap: 24px; margin-top: 16px; font-size: 14px; color: var(--gray-600);">
                    <div>
                        <span style="color: var(--gray-400);">Начало:</span>
                        ${new Date(schedule.startDate).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                        <span style="color: var(--gray-400);">Окончание:</span>
                        ${new Date(schedule.endDate).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                        <span style="color: var(--gray-400);">Позиций:</span>
                        ${schedule._count?.items || 0}
                    </div>
                </div>
            </div>
        `;
    },

    // ========================================
    // Модальное окно создания графика
    // ========================================
    showCreateScheduleModal() {
        const today = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        UI.showModal('Создать график', `
            <form id="create-schedule-form">
                <div class="form-group">
                    <label>Название графика *</label>
                    <input type="text" name="name" required placeholder="Например: ГПР Основной">
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea name="description" rows="3" placeholder="Описание графика..."></textarea>
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
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                    <button type="button" onclick="UI.closeModal()" class="btn-secondary">Отмена</button>
                    <button type="submit" class="btn-primary">Создать</button>
                </div>
            </form>
        `);

        document.getElementById('create-schedule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                await api.createSchedule({
                    projectId: this.currentProjectId,
                    name: formData.get('name'),
                    description: formData.get('description'),
                    startDate: formData.get('startDate'),
                    endDate: formData.get('endDate'),
                });
                UI.closeModal();
                await this.render();
                UI.showToast('График создан', 'success');
            } catch (error) {
                UI.showToast('Ошибка создания графика: ' + error.message, 'error');
            }
        });
    },

    // ========================================
    // Открыть график (детальный вид)
    // ========================================
    async openSchedule(scheduleId) {
        this.currentScheduleId = scheduleId;
        
        try {
            const schedule = await api.getSchedule(scheduleId);
            const container = document.getElementById('content-area');

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
                        <button onclick="ScheduleManager.showAddItemModal()" class="btn-primary" style="display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                            </svg>
                            Добавить работу
                        </button>
                    </div>

                    <!-- Таблица работ -->
                    ${this.renderScheduleItems(schedule.items || [])}
                </div>
            `;
        } catch (error) {
            console.error('Error opening schedule:', error);
            UI.showToast('Ошибка загрузки графика: ' + error.message, 'error');
        }
    },

    renderScheduleItems(items) {
        if (items.length === 0) {
            return `
                <div style="text-align: center; padding: 48px; background: var(--gray-50); border-radius: 8px;">
                    <p style="color: var(--gray-500);">Нет работ в графике. Добавьте первую работу.</p>
                </div>
            `;
        }

        return `
            <div style="overflow-x: auto;">
                <table class="schedule-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--gray-50);">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">Название</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">Из сметы</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--gray-200);">Этаж</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-200);">Объём</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--gray-200);">Начало</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--gray-200);">Окончание</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-200);">Стоимость</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--gray-200);">Статус</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--gray-200);">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => this.renderScheduleItemRow(item)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderScheduleItemRow(item) {
        const statusColors = {
            not_started: 'var(--gray-500)',
            in_progress: 'var(--accent-blue)',
            completed: 'var(--accent-green)',
            delayed: 'var(--accent-red)',
        };
        const statusLabels = {
            not_started: 'Не начата',
            in_progress: 'В работе',
            completed: 'Завершена',
            delayed: 'Задержка',
        };

        const estimateInfo = item.estimateStage 
            ? `${item.estimateStage.section?.code || ''}: ${item.estimateStage.name}`
            : '—';

        return `
            <tr style="border-bottom: 1px solid var(--gray-100);" 
                onmouseover="this.style.background='var(--gray-50)'"
                onmouseout="this.style.background='transparent'">
                <td style="padding: 12px;">
                    <strong>${item.name}</strong>
                    ${item.zone ? `<br><span style="font-size: 12px; color: var(--gray-500);">${item.zone}</span>` : ''}
                </td>
                <td style="padding: 12px; font-size: 13px; color: var(--gray-600);">
                    ${estimateInfo}
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${item.floor ? `Этаж ${item.floor}` : '—'}
                </td>
                <td style="padding: 12px; text-align: right;">
                    ${item.plannedQuantity} ${item.unit || ''}
                </td>
                <td style="padding: 12px; text-align: center; font-size: 13px;">
                    ${new Date(item.plannedStart).toLocaleDateString('ru-RU')}
                </td>
                <td style="padding: 12px; text-align: center; font-size: 13px;">
                    ${new Date(item.plannedEnd).toLocaleDateString('ru-RU')}
                </td>
                <td style="padding: 12px; text-align: right; font-weight: 500;">
                    ${UI.formatCurrency(item.plannedCost || 0)}
                </td>
                <td style="padding: 12px; text-align: center;">
                    <span style="
                        background: ${statusColors[item.status]}20;
                        color: ${statusColors[item.status]};
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    ">${statusLabels[item.status] || item.status}</span>
                </td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="ScheduleManager.editItem('${item.id}')" class="btn-icon" title="Редактировать">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/>
                        </svg>
                    </button>
                    <button onclick="ScheduleManager.deleteItem('${item.id}')" class="btn-icon" title="Удалить" style="color: var(--accent-red);">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    },

    // ========================================
    // Модальное окно добавления работы
    // ========================================
    showAddItemModal() {
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Группируем виды работ по блокам и разделам
        const groupedStages = this.groupEstimateStages();

        UI.showModal('Добавить работу в график', `
            <form id="add-item-form">
                <div class="form-group">
                    <label>Название работы *</label>
                    <input type="text" name="name" required placeholder="Например: Колонны Этаж 1">
                </div>

                <div class="form-group">
                    <label>Связь со сметой (вид работ)</label>
                    <select name="estimateStageId" onchange="ScheduleManager.onEstimateStageSelect(this)">
                        <option value="">— Без привязки к смете —</option>
                        ${groupedStages}
                    </select>
                    <small style="color: var(--gray-500);">При выборе вида работ объём и стоимость рассчитаются автоматически</small>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Этаж</label>
                        <input type="number" name="floor" placeholder="1">
                    </div>
                    <div class="form-group">
                        <label>Зона/Участок</label>
                        <input type="text" name="zone" placeholder="Секция А">
                    </div>
                    <div class="form-group">
                        <label>Ед. изм.</label>
                        <input type="text" name="unit" id="item-unit" placeholder="м³">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Объём *</label>
                        <input type="number" name="plannedQuantity" id="item-quantity" step="0.01" required placeholder="0">
                        <small id="available-quantity" style="color: var(--gray-500);"></small>
                    </div>
                    <div class="form-group">
                        <label>Плановая стоимость</label>
                        <input type="number" name="plannedCost" id="item-cost" step="0.01" placeholder="Авто-расчёт">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
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
                    <label>Примечание</label>
                    <textarea name="notes" rows="2" placeholder="Дополнительная информация..."></textarea>
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
                    zone: formData.get('zone'),
                    plannedQuantity: parseFloat(formData.get('plannedQuantity')),
                    plannedCost: formData.get('plannedCost') ? parseFloat(formData.get('plannedCost')) : null,
                    plannedStart: formData.get('plannedStart'),
                    plannedEnd: formData.get('plannedEnd'),
                    notes: formData.get('notes'),
                });
                UI.closeModal();
                await this.openSchedule(this.currentScheduleId);
                UI.showToast('Работа добавлена', 'success');
            } catch (error) {
                UI.showToast('Ошибка: ' + error.message, 'error');
            }
        });
    },

    groupEstimateStages() {
        // Группируем по блокам
        const grouped = {};
        for (const stage of this.estimateStages) {
            const key = `${stage.blockName} / ${stage.sectionCode}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(stage);
        }

        let html = '';
        for (const [group, stages] of Object.entries(grouped)) {
            html += `<optgroup label="${group}">`;
            for (const stage of stages) {
                const available = stage.quantity - stage.usedQuantity;
                html += `<option value="${stage.id}" 
                    data-unit="${stage.unit || ''}"
                    data-quantity="${stage.quantity}"
                    data-totalcost="${stage.totalCost}">
                    ${stage.name} (${stage.quantity} ${stage.unit || ''}, доступно: ${available})
                </option>`;
            }
            html += '</optgroup>';
        }
        return html;
    },

    onEstimateStageSelect(select) {
        const option = select.options[select.selectedIndex];
        if (!option.value) {
            document.getElementById('item-unit').value = '';
            document.getElementById('available-quantity').textContent = '';
            return;
        }

        const unit = option.dataset.unit;
        const quantity = parseFloat(option.dataset.quantity) || 0;
        const totalCost = parseFloat(option.dataset.totalcost) || 0;

        document.getElementById('item-unit').value = unit;
        document.getElementById('available-quantity').textContent = `Доступно в смете: ${quantity} ${unit}`;

        // Автозаполнение стоимости при вводе количества
        const quantityInput = document.getElementById('item-quantity');
        const costInput = document.getElementById('item-cost');

        quantityInput.oninput = () => {
            if (quantity > 0) {
                const unitCost = totalCost / quantity;
                const plannedQty = parseFloat(quantityInput.value) || 0;
                costInput.value = (unitCost * plannedQty).toFixed(2);
            }
        };
    },

    // ========================================
    // Удаление позиции
    // ========================================
    async deleteItem(itemId) {
        if (!confirm('Удалить эту работу из графика?')) return;

        try {
            await api.deleteScheduleItem(this.currentScheduleId, itemId);
            await this.openSchedule(this.currentScheduleId);
            UI.showToast('Работа удалена', 'success');
        } catch (error) {
            UI.showToast('Ошибка удаления: ' + error.message, 'error');
        }
    },

    // ========================================
    // Редактирование (заглушка)
    // ========================================
    async editItem(itemId) {
        UI.showToast('Редактирование в разработке', 'info');
    },
};

// Экспорт для глобального доступа
window.ScheduleManager = ScheduleManager;
