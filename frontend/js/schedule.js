// ========================================
// Schedule Manager - ГПР
// ========================================

const ScheduleManager = {
    currentProject: null,
    currentSchedule: null,
    currentBlock: null,
    currentView: 'table',
    tasks: [],

    async init() {
        const projectId = localStorage.getItem('currentProject');
        const scheduleId = localStorage.getItem('currentSchedule');

        if (!projectId) {
            window.location.href = 'index.html';
            return;
        }

        this.currentProject = { id: projectId };

        if (scheduleId) {
            await this.loadScheduleDetails(scheduleId);
        } else {
            await this.loadSchedulesList();
        }

        this.updateBreadcrumbs();
    },

    async loadSchedulesList() {
        try {
            const response = await fetch(`/api/schedules?projectId=${this.currentProject.id}`);
            const schedules = await response.json();

            document.getElementById('scheduleListView').style.display = 'block';
            document.getElementById('scheduleDetailView').style.display = 'none';

            this.renderSchedulesList(schedules);
        } catch (error) {
            console.error('Error loading schedules:', error);
            UI.showToast('Ошибка загрузки графиков', 'error');
        }
    },

    renderSchedulesList(schedules) {
        const container = document.getElementById('scheduleList');
        
        if (schedules.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Нет созданных графиков</p>
                    <button class="btn btn-primary" onclick="ScheduleManager.createSchedule()">
                        Создать первый ГПР
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = schedules.map(schedule => `
            <div class="schedule-card" onclick="ScheduleManager.openSchedule('${schedule.id}')">
                <div class="schedule-card-header">
                    <div class="schedule-card-title">${schedule.name}</div>
                    <div class="schedule-card-meta">
                        Создан: ${new Date(schedule.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                </div>
                <div class="schedule-card-body">
                    ${schedule.description ? `<p>${schedule.description}</p>` : ''}
                </div>
                <div class="schedule-card-stats">
                    <div class="stat-item">
                        <span class="stat-label">Задач</span>
                        <span class="stat-value">${schedule._count?.tasks || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Статус</span>
                        <span class="stat-value">${this.getStatusLabel(schedule.status)}</span>
                    </div>
                    ${schedule.startDate ? `
                        <div class="stat-item">
                            <span class="stat-label">Начало</span>
                            <span class="stat-value">${new Date(schedule.startDate).toLocaleDateString('ru-RU')}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    async loadScheduleDetails(scheduleId) {
        try {
            const response = await fetch(`/api/schedules/${scheduleId}`);
            this.currentSchedule = await response.json();

            // Загружаем задачи
            const tasksResponse = await fetch(`/api/schedules/${scheduleId}/tasks`);
            this.tasks = await tasksResponse.json();

            document.getElementById('scheduleListView').style.display = 'none';
            document.getElementById('scheduleDetailView').style.display = 'block';
            document.getElementById('scheduleTitle').textContent = this.currentSchedule.name;

            this.renderTasks();
        } catch (error) {
            console.error('Error loading schedule details:', error);
            UI.showToast('Ошибка загрузки графика', 'error');
        }
    },

    renderTasks() {
        const tbody = document.getElementById('tasksTableBody');
        
        if (this.tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #999;">
                        Нет задач. Используйте "Импорт из сметы" для добавления работ.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.tasks.map(task => `
            <tr data-task-id="${task.id}">
                <td>
                    <input type="text" 
                           class="editable-field" 
                           value="${task.floor || ''}" 
                           onchange="ScheduleManager.updateTask('${task.id}', 'floor', this.value)">
                </td>
                <td>${task.stageName}</td>
                <td>${task.unit || '-'}</td>
                <td>
                    <input type="number" 
                           class="editable-field" 
                           value="${task.quantity}" 
                           step="0.01"
                           onchange="ScheduleManager.updateTask('${task.id}', 'quantity', parseFloat(this.value))">
                </td>
                <td>
                    <input type="date" 
                           class="editable-field" 
                           value="${task.startDate ? task.startDate.split('T')[0] : ''}" 
                           onchange="ScheduleManager.updateTask('${task.id}', 'startDate', this.value)">
                </td>
                <td>
                    <input type="date" 
                           class="editable-field" 
                           value="${task.endDate ? task.endDate.split('T')[0] : ''}" 
                           onchange="ScheduleManager.updateTask('${task.id}', 'endDate', this.value)">
                </td>
                <td>${task.duration ? task.duration + ' дн.' : '-'}</td>
                <td>
                    <select class="editable-select" 
                            onchange="ScheduleManager.updateTask('${task.id}', 'status', this.value)">
                        <option value="not_started" ${task.status === 'not_started' ? 'selected' : ''}>Не начато</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Завершено</option>
                        <option value="delayed" ${task.status === 'delayed' ? 'selected' : ''}>Задержка</option>
                    </select>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn delete" onclick="ScheduleManager.deleteTask('${task.id}')">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async updateTask(taskId, field, value) {
        try {
            const updateData = { [field]: value };

            const response = await fetch(`/api/schedules/${this.currentSchedule.id}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error('Failed to update task');

            // Обновляем локальные данные
            const taskIndex = this.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = await response.json();
                this.renderTasks(); // Перерисовываем для обновления duration
            }

            UI.showToast('Изменения сохранены', 'success');
        } catch (error) {
            console.error('Error updating task:', error);
            UI.showToast('Ошибка сохранения', 'error');
        }
    },

    async deleteTask(taskId) {
        if (!confirm('Удалить эту задачу?')) return;

        try {
            const response = await fetch(`/api/schedules/${this.currentSchedule.id}/tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete task');

            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.renderTasks();
            UI.showToast('Задача удалена', 'success');
        } catch (error) {
            console.error('Error deleting task:', error);
            UI.showToast('Ошибка удаления', 'error');
        }
    },

    switchView(view) {
        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Переключаем панели
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        this.currentView = view;

        if (view === 'table') {
            document.getElementById('tableView').classList.add('active');
        } else if (view === 'gantt') {
            document.getElementById('ganttView').classList.add('active');
            this.renderGantt();
        } else if (view === 'ifc') {
            document.getElementById('ifcView').classList.add('active');
            this.loadIFCViewer();
        }
    },

    renderGantt() {
        const container = document.getElementById('ganttChart');
        
        // TODO: Интеграция с библиотекой Gantt (например, DHTMLX Gantt, Frappe Gantt)
        container.innerHTML = `
            <div class="gantt-placeholder">
                <div style="text-align: center;">
                    <p>Диаграмма Ганта будет реализована в следующей версии</p>
                    <p style="color: #999; font-size: 0.875rem;">Сейчас используйте табличный вид для работы с датами</p>
                </div>
            </div>
        `;
    },

    loadIFCViewer() {
        const container = document.getElementById('ifcContainer');
        
        // TODO: Интеграция с xeokit для загрузки IFC модели
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white;">
                <div style="text-align: center;">
                    <p>IFC Viewer будет реализован в следующей версии</p>
                    <p style="color: #ccc; font-size: 0.875rem;">Здесь будет отображаться 3D модель с подсветкой элементов по этажам</p>
                </div>
            </div>
        `;
    },

    async createSchedule() {
        // Загружаем блоки для выбора
        try {
            const response = await fetch(`/api/blocks?projectId=${this.currentProject.id}`);
            const blocks = await response.json();

            const blockSelect = document.getElementById('blockSelect');
            blockSelect.innerHTML = `
                <option value="">Выберите блок</option>
                ${blocks.map(block => `
                    <option value="${block.id}">${block.name} (${block.floors} этажей)</option>
                `).join('')}
            `;

            // Автозаполнение названия при выборе блока
            blockSelect.onchange = (e) => {
                const block = blocks.find(b => b.id === e.target.value);
                if (block) {
                    document.getElementById('scheduleName').value = `ГПР ${block.name}`;
                    this.currentBlock = block;
                }
            };

            UI.showModal('createScheduleModal');
        } catch (error) {
            console.error('Error loading blocks:', error);
            UI.showToast('Ошибка загрузки блоков', 'error');
        }
    },

    async saveSchedule() {
        const blockId = document.getElementById('blockSelect').value;
        const name = document.getElementById('scheduleName').value.trim();
        const description = document.getElementById('scheduleDescription').value.trim();

        if (!blockId || !name) {
            UI.showToast('Заполните все обязательные поля', 'error');
            return;
        }

        try {
            const response = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.currentProject.id,
                    blockId,
                    name,
                    description
                })
            });

            if (!response.ok) throw new Error('Failed to create schedule');

            const schedule = await response.json();
            
            UI.closeModal('createScheduleModal');
            UI.showToast('ГПР создан', 'success');
            
            this.openSchedule(schedule.id);
        } catch (error) {
            console.error('Error creating schedule:', error);
            UI.showToast('Ошибка создания ГПР', 'error');
        }
    },

    async importFromEstimate() {
        try {
            // Загружаем сметы проекта
            const response = await fetch(`/api/estimates?projectId=${this.currentProject.id}`);
            const estimates = await response.json();

            const container = document.getElementById('estimateCheckboxes');
            container.innerHTML = estimates.map(est => `
                <div class="checkbox-item">
                    <input type="checkbox" id="est_${est.id}" value="${est.id}">
                    <label for="est_${est.id}">${est.name}</label>
                </div>
            `).join('');

            // Генерируем поля этажей из блока
            if (this.currentSchedule?.blockId) {
                const blockResponse = await fetch(`/api/blocks/${this.currentSchedule.blockId}`);
                const block = await blockResponse.json();
                
                const floorContainer = document.getElementById('floorInputs');
                floorContainer.innerHTML = '';
                
                for (let i = 1; i <= block.floors; i++) {
                    this.addFloorInput(`Этаж ${i}`);
                }
            }

            UI.showModal('importEstimateModal');
        } catch (error) {
            console.error('Error loading estimates:', error);
            UI.showToast('Ошибка загрузки смет', 'error');
        }
    },

    addFloorInput(value = '') {
        const container = document.getElementById('floorInputs');
        const row = document.createElement('div');
        row.className = 'floor-input-row';
        row.innerHTML = `
            <input type="text" class="form-control floor-input" value="${value}" placeholder="Название этажа">
            <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(row);
    },

    async executeImport() {
        const selectedEstimates = Array.from(document.querySelectorAll('#estimateCheckboxes input:checked'))
            .map(cb => cb.value);

        const floors = Array.from(document.querySelectorAll('.floor-input'))
            .map(input => input.value.trim())
            .filter(v => v);

        if (selectedEstimates.length === 0) {
            UI.showToast('Выберите хотя бы одну смету', 'error');
            return;
        }

        if (floors.length === 0) {
            UI.showToast('Укажите хотя бы один этаж', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/schedules/${this.currentSchedule.id}/import-from-estimate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estimateIds: selectedEstimates,
                    floors
                })
            });

            if (!response.ok) throw new Error('Failed to import');

            const result = await response.json();
            
            UI.closeModal('importEstimateModal');
            UI.showToast(`Импортировано ${result.count} задач`, 'success');
            
            // Перезагружаем задачи
            await this.loadScheduleDetails(this.currentSchedule.id);
        } catch (error) {
            console.error('Error importing tasks:', error);
            UI.showToast('Ошибка импорта', 'error');
        }
    },

    openSchedule(scheduleId) {
        localStorage.setItem('currentSchedule', scheduleId);
        this.loadScheduleDetails(scheduleId);
    },

    goBack() {
        if (this.currentSchedule) {
            localStorage.removeItem('currentSchedule');
            this.currentSchedule = null;
            this.loadSchedulesList();
        } else {
            window.location.href = 'index.html';
        }
    },

    updateBreadcrumbs() {
        const breadcrumbs = document.getElementById('breadcrumbs');
        
        let html = '<span class="breadcrumb-item">Объекты</span>';
        
        if (this.currentSchedule) {
            html += ` → <span class="breadcrumb-item">${this.currentSchedule.name}</span>`;
        } else {
            html += ` → <span class="breadcrumb-item">Графики работ</span>`;
        }
        
        breadcrumbs.innerHTML = html;
    },

    getStatusLabel(status) {
        const labels = {
            draft: 'Черновик',
            active: 'Активен',
            completed: 'Завершён'
        };
        return labels[status] || status;
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    ScheduleManager.init();
});
