// ========================================
// Schedule Manager - ГПР (DHTMLX Gantt)
// ========================================

const ScheduleManager = {
    version: '20251219-2',
    currentProjectId: null,
    isInitialized: false,
    showEstimate: false,
    showVolume: false,
    todayMarkerId: null,
    isAutoUpdatingParents: false,
    bottomPanel: {
        activeTab: 'resources',
        isOpen: false,
        openHeightPx: null,
    },

    filters: {
        sections: [], // selected names
        floors: [],   // selected names
    },

    currentTaskResources: [],
    charts: {
        labor: null,
        equipment: null
    },

    contextMenu: {
        el: null,
        activeTaskId: null,
        isInstalled: false,
    },

    resourcesPane: {
        token: 0,
        selectedTaskId: null,
        selectedWorkTypeId: null,
    },

    settingsPane: {
        token: 0,
        selectedTaskId: null,
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatQty(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        // keep up to 3 decimals, trim trailing zeros
        const s = n.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
        return s;
    },

    extractWorkTypeIdFromTaskId(taskId) {
        const id = String(taskId ?? '');
        if (!id.startsWith('worktype-')) return null;

        // id format: worktype-<workTypeId>-<floorTaskId>, where floorTaskId starts with "floor-"
        const rest = id.slice('worktype-'.length);
        const idx = rest.indexOf('-floor-');
        if (idx > 0) return rest.slice(0, idx);

        // Fallback for unexpected formats: take UUID-like prefix
        if (rest.length >= 36) return rest.slice(0, 36);
        return null;
    },

    calculatePhysicalVolume(qty, unit) {
        if (!qty) return 0;
        const u = String(unit || '').trim();
        // Извлекаем число из начала строки, например "100 м2" -> 100, "1000 м3" -> 1000
        const match = u.match(/^(\d+)/);
        const multiplier = match ? parseInt(match[1], 10) : 1;
        return qty * multiplier;
    },

    getResourcesPaneEl() {
        return document.querySelector('#schedule-bottom [data-pane="resources"]');
    },

    renderResourcesPlaceholder(message = 'Выберите вид работ, чтобы увидеть ресурсы') {
        const pane = this.getResourcesPaneEl();
        if (!pane) return;
        pane.innerHTML = `
            <div style="color: var(--gray-700);">${this.escapeHtml(message)}</div>
        `;
    },

    renderResourcesLoading(taskName) {
        const pane = this.getResourcesPaneEl();
        if (!pane) return;
        pane.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-weight:600; color: var(--gray-900);">${this.escapeHtml(taskName || 'Вид работ')}</div>
                <div style="color: var(--gray-700);">Загрузка ресурсов...</div>
            </div>
        `;
    },

    getSettingsPaneEl() {
        return document.querySelector('#schedule-bottom [data-pane="settings"]');
    },

    renderSettingsPlaceholder(message = 'Выберите вид работ, чтобы увидеть настройки') {
        const pane = this.getSettingsPaneEl();
        if (!pane) return;
        pane.innerHTML = `
            <div style="color: var(--gray-700);">${this.escapeHtml(message)}</div>
        `;
    },

    renderSettingsLoading(taskName) {
        const pane = this.getSettingsPaneEl();
        if (!pane) return;
        pane.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-weight:600; color: var(--gray-900);">${this.escapeHtml(taskName || 'Вид работ')}</div>
                <div style="color: var(--gray-700);">Загрузка настроек...</div>
            </div>
        `;
    },

    renderSettingsPane(taskName, task, resources = []) {
        const pane = this.getSettingsPaneEl();
        if (!pane) return;

        const safeTask = this.escapeHtml(taskName || 'Вид работ');

        pane.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:16px; padding: 4px;">
                <div style="font-weight:600; color: var(--gray-900); display: flex; align-items: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Настройки: ${safeTask}
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="font-size:12px; font-weight:600; color:var(--gray-600);">РЕЖИМ РАСЧЕТА</label>
                        <select id="task-calc-mode" style="padding: 8px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px;">
                            <option value="manual" ${task.calculationMode === 'manual' ? 'selected' : ''}>Вручную (фиксированно)</option>
                            <option value="auto_duration" ${task.calculationMode === 'auto_duration' ? 'selected' : ''}>Авто: Считать длительность</option>
                            <option value="auto_resources" ${task.calculationMode === 'auto_resources' ? 'selected' : ''}>Авто: Считать ресурсы</option>
                        </select>
                        <span style="font-size:11px; color:var(--gray-500);">Как система должна реагировать на изменения</span>
                    </div>
                </div>

                <div style="margin-top: 8px; display: flex; align-items: center; gap: 12px;">
                    <button id="task-save-settings" class="btn btn-primary" style="height: 36px; padding: 0 20px;">
                        Применить настройки
                    </button>
                    <div id="settings-save-status" style="font-size: 13px; font-weight: 500;"></div>
                </div>
            </div>
        `;

        const saveBtn = pane.querySelector('#task-save-settings');
        const statusEl = pane.querySelector('#settings-save-status');

        saveBtn.addEventListener('click', async () => {
            const mode = pane.querySelector('#task-calc-mode').value;

            saveBtn.disabled = true;
            statusEl.textContent = 'Сохранение...';
            statusEl.style.color = 'var(--gray-600)';

            try {
                await api.updateGanttTask(task.id, {
                    calculationMode: mode
                });

                // Update local task object
                const t = gantt.getTask(task.id);
                t.calculationMode = mode;

                // If auto mode is on, we might need a separate call or logic to trigger recalculation
                // For now, just refresh the task in UI
                gantt.updateTask(task.id);
                gantt.render();

                statusEl.textContent = 'Настройки применены';
                statusEl.style.color = 'var(--accent-green)';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
            } catch (err) {
                console.error('Failed to save task settings', err);
                statusEl.textContent = 'Ошибка сохранения';
                statusEl.style.color = 'var(--accent-red)';
            } finally {
                saveBtn.disabled = false;
            }
        });
    },

    async loadAndShowSettingsForTask(taskId) {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            const task = gantt.getTask(taskId);
            if (!task) return;

            if (task.type !== 'task') {
                this.settingsPane.selectedTaskId = null;
                this.renderSettingsPlaceholder('Настройки доступны только для видов работ');
                return;
            }

            this.settingsPane.selectedTaskId = task.id;
            const token = ++this.settingsPane.token;

            this.renderSettingsLoading(task.text);

            const workTypeId = this.extractWorkTypeIdFromTaskId(task.id);
            let resources = [];
            if (workTypeId) {
                resources = await api.getResources(workTypeId);
            }

            if (token !== this.settingsPane.token) return;

            this.renderSettingsPane(task.text, task, resources);
        } catch (e) {
            console.error('loadAndShowSettingsForTask failed', e);
            this.renderSettingsPlaceholder('Ошибка загрузки настроек');
        }
    },

    renderResourcesList(taskName, resources) {
        const pane = this.getResourcesPaneEl();
        if (!pane) return;

        const safeTask = this.escapeHtml(taskName || 'Вид работ');
        const list = Array.isArray(resources) ? resources : [];

        if (list.length === 0) {
            const task = gantt.getTask(this.resourcesPane.selectedTaskId);
            const subHtml = task.subcontractor ? `
                <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
                    <div style="background: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #c7d2fe; color: #4338ca; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #4338ca; font-weight: 700; text-transform: uppercase;">Исполнитель по тендеру</div>
                        <div style="font-size: 15px; color: #1e1b4b; font-weight: 800;">${this.escapeHtml(task.subcontractor)}</div>
                    </div>
                </div>
            ` : '';

            pane.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${subHtml}
                    <div style="font-weight:600; color: var(--gray-900);">${safeTask}</div>
                    <div style="color: var(--gray-700); padding: 10px; background: var(--gray-50); border-radius: 6px; border: 1px solid var(--gray-100);">Ресурсы для данного вида работ еще не заведены в смете</div>
                </div>
            `;
            return;
        }

        const getBadge = (type) => {
            const t = (type || 'material').toLowerCase();
            const config = {
                labor: { icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`, color: '#800080', bg: 'rgba(128, 0, 128, 0.1)', border: 'rgba(128, 0, 128, 0.2)' },
                equipment: { icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M3 18h2"/><path d="M9 18h6"/><path d="M19 18h2"/><path d="M6 18V9h7l2 3h3v6"/><path d="M6 9l-1-3"/></svg>`, color: '#ca5010', bg: 'rgba(202, 80, 16, 0.1)', border: 'rgba(202, 80, 16, 0.2)' },
                material: { icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>`, color: '#000080', bg: 'rgba(0, 0, 128, 0.1)', border: 'rgba(0, 0, 128, 0.2)' }
            };
            return config[t] || config.material;
        };

        const task = gantt.getTask(this.resourcesPane.selectedTaskId);
        const taskQty = Number(task.quantity || 0);
        const duration = Number(task.duration || 1);

        const subcontractorHtml = task.subcontractor ? `
            <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; transition: transform 0.2s hover; cursor: default; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="background: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #c7d2fe; color: #4338ca; flex-shrink: 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 10px; color: #4338ca; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 2px;">Исполнитель по тендеру</div>
                    <div style="font-size: 15px; color: #1e1b4b; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(task.subcontractor)}</div>
                </div>
                <div style="background: #dbeafe; padding: 4px 10px; border-radius: 20px; color: #1e40af; font-size: 11px; font-weight: 600; border: 1px solid #bfdbfe;">
                    Контракт
                </div>
            </div>
        ` : '';

        const rows = list.map((r, idx) => {
            const b = getBadge(r.resourceType);
            const name = this.escapeHtml(r?.name || '—');
            const qty = this.escapeHtml(this.formatQty(r?.quantity));
            const unit = this.escapeHtml(r?.unit || '');
            const displayNo = r.code || (idx + 1);
            const norm = r.normPerUnit !== null ? Number(r.normPerUnit) : 0;
            const totalHours = norm * taskQty;
            const resShifts = Number(r.shiftsPerDay || 1);

            // ПРИОРИТЕТ: настройки ресурса → настройки задачи → глобальные настройки
            // Часов в смене может быть задано на уровне ресурса, задачи или проекта
            const shiftHrs = Number(r.shiftDuration) ||
                Number(task.shiftDuration) ||
                (this.projectSettings?.shiftDuration) ||
                8;

            // DEBUG: Логируем для первого ресурса
            if (idx === 0) {
                console.log('=== INTENSITY CALCULATION DEBUG ===');
                console.log('Resource:', r.name);
                console.log('Unit:', r.unit);
                console.log('Norm per unit:', norm, 'чел-ч');
                console.log('Task quantity:', taskQty, task.unit);
                console.log('Total hours:', totalHours, 'чел-ч');
                console.log('Duration:', duration, 'дней');
                console.log('Resource shifts per day:', resShifts);
                console.log('Hours per shift (priority: resource → task → project):', shiftHrs);
                console.log('  - Resource shiftDuration:', r.shiftDuration || 'not set');
                console.log('  - Task shiftDuration:', task.shiftDuration || 'not set');
                console.log('  - Project shiftDuration:', this.projectSettings?.shiftDuration || 'not set');
                console.log('Formula: totalHours / (duration × resShifts × shiftHrs)');
                console.log('Formula:', totalHours, '/ (', duration, '×', resShifts, '×', shiftHrs, ')');
            }

            // Intensity = Total Hours / (Duration * Shifts * ShiftHours)
            let intensity = 0;
            let intensityDisplay = '—';
            let intensityStyle = '';

            if (duration > 0 && resShifts > 0 && shiftHrs > 0 && (r.resourceType === 'labor' || r.resourceType === 'equipment')) {
                const rawIntensity = totalHours / (duration * resShifts * shiftHrs);

                if (idx === 0) {
                    console.log('Raw intensity:', rawIntensity);
                    console.log('Rounded intensity:', Math.ceil(rawIntensity));
                    console.log('===================================');
                }

                // Округляем до целого числа (нельзя иметь 0.947 человека!)
                intensity = Math.ceil(rawIntensity); // Округляем вверх

                // Определяем единицу измерения
                const unit = r.resourceType === 'labor' ? 'чел' : 'маш';

                if (task.calculationMode === 'auto_duration') {
                    // В режиме "Считать дни" показываем инпут. 
                    // Если это ведущий ресурс или его интенсивность была только что изменена, 
                    // мы можем использовать task.resourceCount для отображения точного числа, которое ввел пользователь.
                    const displayIntensity = (idx === 0 && task.resourceCount) ? Math.ceil(task.resourceCount) : intensity;

                    intensityDisplay = `
                        <div style="display:flex; align-items:center; justify-content:flex-end; gap:5px;">
                            <input type="number" class="res-intensity-input" value="${displayIntensity}" min="1" step="1" 
                                   style="width: 45px; padding: 2px 4px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 12px; text-align: right; background: #fff; color: #000;">
                            <span style="font-size: 11px; color: inherit; opacity: 0.8;">${unit}</span>
                        </div>
                    `;
                    intensityStyle = 'background: rgba(40, 167, 69, 0.05);';
                } else if (rawIntensity < 1) {
                    // Предупреждение если интенсивность слишком низкая (в ручном режиме)
                    intensityDisplay = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><span style="color: var(--accent-orange); font-size: 14px;" title="Работа растянута по времени">⚠️</span><span>${intensity} ${unit}</span></div>`;
                    intensityStyle = 'background: rgba(255, 165, 0, 0.1); padding: 4px 8px !important;';
                } else {
                    intensityDisplay = `${intensity} ${unit}`;
                }
            }

            const isLeading = task.leadingResourceId === r.id;

            return `
                <tr class="resource-row" 
                    data-resource-id="${r.id}" 
                    data-norm="${norm}"
                    data-total-hours="${totalHours}"
                    data-shifts="${resShifts}"
                    data-shift-duration="${shiftHrs}"
                    style="color: ${b.color}; font-weight: 400;">
                    <td style="text-align: center; color: var(--gray-500); font-size: 11px;">${displayNo}</td>
                    <td style="text-align: center;">
                        <input type="checkbox" class="leading-checkbox" 
                               ${task.leadingResourceId === r.id ? 'checked' : ''} 
                               ${task.leadingResourceId && task.leadingResourceId !== r.id ? 'disabled' : ''}
                               style="cursor:pointer; width: 16px; height: 16px; accent-color: var(--primary);">
                    </td>
                    <td style="text-align: center;">
                        <div style="width: 24px; height: 24px; border-radius: 4px; background: ${b.bg}; color: ${b.color}; display: flex; align-items: center; justify-content: center; border: 1px solid ${b.border};">
                            ${b.icon}
                        </div>
                    </td>
                    <td style="font-size: 13px;">${this.escapeHtml(r?.name || '—')}</td>
                    <td style="padding: 0; position: relative;">
                        <div class="custom-shift-dropdown" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 4px 0; font-size: 11px; transition: background 0.2s;" data-value="${resShifts}">
                            ${resShifts} см
                            <div class="custom-shift-options" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; background: #fff; border: 1px solid var(--gray-300); box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden;">
                                <div class="shift-opt" data-val="1" style="padding: 6px; text-align: center; border-bottom: 1px solid var(--gray-100);">1 см</div>
                                <div class="shift-opt" data-val="2" style="padding: 6px; text-align: center; border-bottom: 1px solid var(--gray-100);">2 см</div>
                                <div class="shift-opt" data-val="3" style="padding: 6px; text-align: center;">3 см</div>
                            </div>
                        </div>
                    </td>
                    <td style="color: inherit; opacity: 0.7; font-size: 12px; white-space:nowrap;">${unit}</td>
                    <td style="text-align:left; color: inherit; white-space:nowrap; font-size: 11px;">${norm > 0 ? this.formatQty(norm) : '—'}</td>
                    <td style="text-align:left; color: inherit; white-space:nowrap; font-size: 11px;">${totalHours > 0 ? this.formatQty(totalHours) : '—'}</td>
                    <td style="text-align:left; color: inherit; white-space:nowrap; font-size: 11px; ${intensityStyle}">${intensityDisplay}</td>
                    <td style="padding: 2px 4px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <!-- Permit Status Icon (only for labor/equipment, empty for materials) -->
                            ${r.resourceType === 'material' ?
                    '<div style="width: 16px; height: 16px; flex-shrink: 0;"></div>' :
                    `<div class="permit-status" title="${r.hasPermit ? 'Допуск получен' : 'Допуск не получен'}" style="flex-shrink: 0; cursor: pointer;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${r.hasPermit ? '#22c55e' : 'none'}" stroke="${r.hasPermit ? '#16a34a' : '#9ca3af'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        ${r.hasPermit ? '<path d="m9 12 2 2 4-4" stroke="white" stroke-width="2"/>' : ''}
                                    </svg>
                                </div>`
                }
                            <div class="contractor-dropdown" data-resource-id="${r.id}" style="display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 4px; cursor: pointer; font-size: 11px; color: var(--gray-600); flex: 1;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                <span class="contractor-name">${this.escapeHtml(r.contractorName || task.subcontractor || 'Не назначен')}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        pane.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${subcontractorHtml}
                <div style="display: flex; justify-content: space-between; align-items: center; padding-right: 12px;">
                    <div style="font-weight:600; color: var(--gray-900); display: flex; align-items: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                        Состав ресурсов: ${safeTask}
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase;">Режим расчета:</span>
                        <div class="calc-mode-toggle-group" style="display: flex; background: var(--gray-100); padding: 2px; border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div class="calc-mode-btn ${task.calculationMode === 'auto_duration' ? 'active' : ''}" data-value="auto_duration" 
                                 style="padding: 4px 12px; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 4px; transition: all 0.2s; ${task.calculationMode === 'auto_duration' ? 'background: #fff; color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.1);' : 'color: var(--gray-500);'}">
                                Считать дни (от людей)
                            </div>
                            <div class="calc-mode-btn ${task.calculationMode !== 'auto_duration' ? 'active' : ''}" data-value="auto_resources" 
                                 style="padding: 4px 12px; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 4px; transition: all 0.2s; ${task.calculationMode !== 'auto_duration' ? 'background: #fff; color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.1);' : 'color: var(--gray-500);'}">
                                Считать людей (от сроков)
                            </div>
                        </div>
                    </div>
                </div>

                ${task.calculationMode !== 'auto_duration' ? `
                <div class="target-duration-row" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--primary-lighter); border-radius: 6px; margin-top: 4px;">
                    <label style="font-size: 12px; font-weight: 500; color: var(--gray-700); white-space: nowrap;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Целевой срок (дней):
                    </label>
                    <input type="number" 
                           class="target-duration-input" 
                           value="${duration}" 
                           min="1" 
                           style="width: 80px; padding: 6px 10px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 13px; font-weight: 600; text-align: center; background: #fff;"
                           title="Введите количество дней для завершения работы. Интенсивность ресурсов пересчитается автоматически."
                    />
                    <span style="font-size: 11px; color: var(--gray-500);">Ресурсы будут рассчитаны автоматически</span>
                </div>
                ` : ''}

                <table class="schedule-resources-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center; color: #000;">№</th>
                            <th style="width: 32px; text-align: center; color: #000;" title="Ведущий ресурс">Ведущ.</th>
                            <th style="width: 24px; color: #000;"></th>
                            <th style="color: #000;">Ресурс</th>
                            <th style="width: 50px; color: #000;">Смены</th>
                            <th style="width: 50px; color: #000;">Ед.изм</th>
                            <th style="width: 55px; color: #000;">Норма</th>
                            <th style="width: 55px; color: #000;">Всего</th>
                            <th style="width: 70px; color: #000; font-weight: 600;">Потребн.</th>
                            <th style="color: #000;">Исполнитель</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;

        // Handle calculation mode change (New Toggle Group)
        const calcBtns = pane.querySelectorAll('.calc-mode-btn');
        calcBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const mode = btn.dataset.value;
                const taskId = this.resourcesPane.selectedTaskId;

                try {
                    UI.showNotification('Обновление режима расчета...', 'info');
                    await api.updateGanttTask(taskId, { calculationMode: mode });

                    const task = gantt.getTask(taskId);
                    task.calculationMode = mode;

                    gantt.updateTask(taskId);
                    gantt.render();

                    // Перерисовываем список ресурсов, чтобы инпуты появились/исчезли
                    await this.loadAndShowResourcesForTask(taskId);

                    UI.showNotification('Режим расчета изменен', 'success');
                } catch (err) {
                    console.error('Failed to update calc mode', err);
                    UI.showNotification('Ошибка при смене режима', 'error');
                }
            });
        });

        // Handle intensity change (for Resource Driven mode)
        const intensityInputs = pane.querySelectorAll('.res-intensity-input');
        intensityInputs.forEach(input => {
            input.addEventListener('change', async (e) => {
                const newVal = parseInt(e.target.value);
                if (isNaN(newVal) || newVal < 1) return;

                const row = input.closest('.resource-row');
                const resourceId = row.dataset.resourceId;
                const taskId = this.resourcesPane.selectedTaskId;
                const task = gantt.getTask(taskId);

                // Берем данные прямо из атрибутов строки, чтобы избежать рассинхрона
                const totalHours = Number(row.dataset.totalHours || 0);
                const resShifts = Number(row.dataset.shifts || 1);
                const shiftHrs = Number(row.dataset.shiftDuration || 8);

                try {
                    UI.showNotification('Пересчет длительности...', 'info');

                    if (totalHours <= 0) {
                        console.warn('Total hours is 0, cannot recalc duration');
                        return;
                    }

                    // Формула: Duration = TotalHours / (Intensity * Shifts * ShiftHrs)
                    // Гарантируем, что длительность не может быть меньше 1 дня
                    const calculatedDays = Math.ceil(totalHours / (newVal * resShifts * shiftHrs));
                    const newDuration = Math.max(1, calculatedDays);

                    console.log(`[Recalc Duration] Intensity: ${newVal}, Hours: ${totalHours}, Shifts: ${resShifts}, ShiftHrs: ${shiftHrs}, New Duration: ${newDuration}`);

                    // Обновляем задачу: и длительность, и resourceCount (интенсивность)
                    await api.updateGanttTask(taskId, {
                        duration: newDuration,
                        resourceCount: newVal
                    });

                    // Явно обновляем объект в Gantt
                    task.duration = newDuration;
                    task.resourceCount = newVal;

                    // Конец даты обновится автоматически в Ганте при изменении длительности
                    const end = gantt.date.add(task.start_date, newDuration, "day");
                    task.end_date = end;

                    gantt.updateTask(taskId);
                    gantt.refreshTask(taskId); // Дополнительное принудительное обновление
                    gantt.render();

                    // Небольшая пауза перед перерисовкой списка ресурсов для синхронизации
                    setTimeout(async () => {
                        await this.loadAndShowResourcesForTask(taskId);
                        UI.showNotification('Длительность пересчитана: ' + newDuration + ' дн.', 'success');
                    }, 50);
                } catch (err) {
                    console.error('Failed to update duration', err);
                    UI.showNotification('Ошибка при пересчете длительности', 'error');
                }
            });
        });

        // Add event listeners for leading resource checkboxes
        const checkboxes = pane.querySelectorAll('.leading-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const row = e.target.closest('.resource-row');
                const resourceId = row.dataset.resourceId;
                const taskId = this.resourcesPane.selectedTaskId;
                const isChecked = e.target.checked;

                try {
                    UI.showNotification('Обновление ведущего ресурса...', 'info');

                    // Если сняли галочку - убираем ведущий ресурс
                    const newLeaderId = isChecked ? resourceId : null;

                    await api.updateGanttTask(taskId, { leadingResourceId: newLeaderId });

                    // Update local gantt task
                    const t = gantt.getTask(taskId);
                    t.leadingResourceId = newLeaderId;

                    // Refresh data
                    gantt.updateTask(taskId);
                    gantt.render();

                    // Перерисовываем список ресурсов для обновления состояния чекбоксов
                    await this.loadAndShowResourcesForTask(taskId);

                    UI.showNotification(isChecked ? 'Ведущий ресурс назначен' : 'Ведущий ресурс снят', 'success');
                } catch (err) {
                    console.error('Failed to update leading resource', err);
                    UI.showNotification('Ошибка при смене ведущего ресурса', 'error');
                }
            });
        });

        // Custom shift dropdown logic
        const dropdowns = pane.querySelectorAll('.custom-shift-dropdown');
        dropdowns.forEach(dd => {
            const options = dd.querySelector('.custom-shift-options');

            dd.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns
                pane.querySelectorAll('.custom-shift-options').forEach(o => {
                    if (o !== options) o.style.display = 'none';
                });
                options.style.display = options.style.display === 'block' ? 'none' : 'block';
            });

            options.querySelectorAll('.shift-opt').forEach(opt => {
                opt.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const newVal = parseInt(opt.dataset.val);
                    options.style.display = 'none';

                    const row = dd.closest('.resource-row');
                    const resourceId = row.dataset.resourceId;
                    const taskId = this.resourcesPane.selectedTaskId;

                    try {
                        UI.showNotification('Обновление сменности...', 'info');
                        await api.updateTaskResourceAssignment(taskId, resourceId, { shiftsPerDay: newVal });

                        const task = gantt.getTask(taskId);
                        if (task.leadingResourceId === resourceId) {
                            await api.updateGanttTask(taskId, { shiftsPerDay: newVal });
                            task.shiftsPerDay = newVal;
                            gantt.updateTask(taskId);
                        }

                        await this.loadAndShowResourcesForTask(taskId);
                        gantt.render();
                        UI.showNotification('Сменность обновлена', 'success');
                    } catch (err) {
                        console.error('Failed to update shifts', err);
                        UI.showNotification('Ошибка при смене сменности', 'error');
                    }
                });
            });
        });

        // Handle target duration change (for auto_resources mode)
        const targetDurationInput = pane.querySelector('.target-duration-input');
        if (targetDurationInput) {
            targetDurationInput.addEventListener('change', async (e) => {
                const newDuration = parseInt(e.target.value);
                if (isNaN(newDuration) || newDuration < 1) {
                    e.target.value = 1;
                    return;
                }

                const taskId = this.resourcesPane.selectedTaskId;
                const task = gantt.getTask(taskId);

                try {
                    UI.showNotification('Обновление срока...', 'info');

                    // Обновляем задачу в БД
                    await api.updateGanttTask(taskId, { duration: newDuration });

                    // Обновляем локально в Gantt
                    // Используем getEndByStart для корректного расчета с учетом рабочего календаря
                    task.duration = newDuration;
                    task.end_date = gantt.calculateEndDate(task.start_date, newDuration);

                    gantt.updateTask(taskId);
                    gantt.render();

                    // Перерисовываем список ресурсов (интенсивности пересчитаются)
                    await this.loadAndShowResourcesForTask(taskId);

                    UI.showNotification(`Срок изменен: ${newDuration} дн. Ресурсы пересчитаны.`, 'success');
                } catch (err) {
                    console.error('Failed to update duration', err);
                    UI.showNotification('Ошибка при обновлении срока', 'error');
                }
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            pane.querySelectorAll('.custom-shift-options').forEach(o => o.style.display = 'none');
        }, { once: true });
    },

    async loadTaskDetails(taskId) {
        if (!taskId) return;

        // Load data for all panes that need it
        this.loadAndShowResourcesForTask(taskId);
        this.loadAndShowSettingsForTask(taskId);
        this.renderTaskDetailsPanel(taskId);
        await this.renderExecutionPane(taskId);

        // Ensure current active tab is set
        if (!this.bottomPanel.activeTab) {
            this.bottomPanel.activeTab = 'resources';
        }

        // Open the panel to show details
        this.setBottomPanelState(true, this.bottomPanel.activeTab);
    },

    renderTaskDetailsPanel(taskId) {
        const container = document.getElementById('task-details-content');
        if (!container) return;

        if (!taskId || typeof gantt === 'undefined') {
            container.innerHTML = `
                <div style="color: var(--gray-500); font-size: 13px; text-align: center; padding: 24px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 8px;">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                    </svg>
                    <div>Выберите задачу для просмотра деталей</div>
                </div>
            `;
            return;
        }

        try {
            const task = gantt.getTask(taskId);
            if (!task) return;

            const formatDate = (d) => {
                if (!d) return '—';
                const date = new Date(d);
                return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            };

            const progress = Math.round((task.progress || 0) * 100);
            const duration = task.duration || 0;
            const taskType = task.type === 'project' ? 'Сводная' : 'Задача';
            const quantity = task.quantity ? this.formatQty(task.quantity) : '—';
            const unit = task.unit || '';

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Название -->
                    <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                        <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Название</div>
                        <div style="font-size: 13px; font-weight: 600; color: var(--gray-900);">${this.escapeHtml(task.text)}</div>
                    </div>
                    
                    <!-- Даты -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Начало</div>
                            <div style="font-size: 13px; font-weight: 500; color: var(--gray-900);">${formatDate(task.start_date)}</div>
                        </div>
                        <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Окончание</div>
                            <div style="font-size: 13px; font-weight: 500; color: var(--gray-900);">${formatDate(task.end_date)}</div>
                        </div>
                    </div>
                    
                    <!-- Длительность и Прогресс -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Длительность</div>
                            <div style="font-size: 13px; font-weight: 500; color: var(--gray-900);">${duration} дн.</div>
                        </div>
                        <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Прогресс</div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="flex: 1; height: 6px; background: var(--gray-200); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${progress}%; background: ${progress >= 100 ? 'var(--accent-green)' : 'var(--primary)'}; border-radius: 3px;"></div>
                                </div>
                                <span style="font-size: 12px; font-weight: 600; color: ${progress >= 100 ? 'var(--accent-green)' : 'var(--gray-900)'};">${progress}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Тип и Объем -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Тип</div>
                            <div style="font-size: 13px; font-weight: 500; color: var(--gray-900);">${taskType}</div>
                        </div>
                        <div style="padding: 8px; background: var(--white); border-radius: 6px; border: 1px solid var(--gray-200);">
                            <div style="font-size: 11px; color: var(--gray-500); margin-bottom: 4px;">Объем</div>
                            <div style="font-size: 13px; font-weight: 500; color: var(--gray-900);">${quantity} ${this.escapeHtml(unit)}</div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('renderTaskDetailsPanel error:', e);
        }
    },

    async renderExecutionPane(taskId) {
        const pane = document.getElementById('execution-pane');
        if (!pane) return;

        if (!taskId || typeof gantt === 'undefined') {
            pane.innerHTML = `
                <div style="color: var(--gray-500); text-align: center; padding: 24px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 8px;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <div>Выберите задачу для учета выполнения</div>
                </div>
            `;
            return;
        }

        try {
            const task = gantt.getTask(taskId);
            if (!task || task.type === 'project') {
                pane.innerHTML = `
                    <div style="color: var(--gray-500); text-align: center; padding: 24px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 8px;">
                            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                        </svg>
                        <div>Учет выполнения доступен только для видов работ</div>
                    </div>
                `;
                return;
            }

            // Загружаем историю из бекенда
            let history = [];
            try {
                history = await api.getGanttTaskHistory(taskId);
            } catch (e) {
                console.warn('Failed to fetch history:', e);
            }

            const rawQty = Number(task.quantity || 0);
            const unit = task.unit || 'ед.';
            const physicalVolume = this.calculatePhysicalVolume(rawQty, unit);
            const completed = Number(task.completedQuantity || 0);
            const remaining = Math.max(0, physicalVolume - completed);
            const progress = physicalVolume > 0 ? Math.round((completed / physicalVolume) * 100) : 0;
            const cleanUnit = unit.replace(/^\d+\s*/, '').trim() || 'ед.';
            const dailyPlan = Number(task.dailyPlan || 0);

            pane.innerHTML = `
                <div style="display: flex; height: 100%; gap: 20px; padding: 4px;">
                    <!-- Левая часть: "Баночка" (Круговой прогресс) и Статистика -->
                    <div style="width: 140px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; border-right: 1px solid var(--gray-100); padding-right: 15px;">
                        <!-- Круг -->
                        <div style="position: relative; width: 100px; height: 100px; margin-bottom: 16px;">
                            <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f3f3f3" stroke-width="3" />
                                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${progress >= 100 ? 'var(--accent-green)' : 'var(--primary)'}" stroke-width="3" 
                                        stroke-dasharray="${progress} 100" stroke-linecap="round" />
                            </svg>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; font-weight: 700; color: var(--gray-900);">
                                ${progress}%
                            </div>
                        </div>
                        
                        <!-- Статистика снизу (миниатюрная) -->
                        <div style="width: 100%; display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
                            <div style="display: flex; justify-content: space-between; gap: 4px;">
                                <span style="color: var(--gray-500);">Всего</span>
                                <span style="font-weight: 600; color: var(--gray-900); white-space: nowrap;">${this.formatQty(physicalVolume)} ${cleanUnit}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 4px;">
                                <span style="color: var(--accent-green);">Выполнено</span>
                                <span style="font-weight: 600; color: var(--accent-green); white-space: nowrap;">${this.formatQty(completed)} ${cleanUnit}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 4px;">
                                <span style="color: var(--accent-orange);">Остаток</span>
                                <span style="font-weight: 600; color: var(--accent-orange); white-space: nowrap;">${this.formatQty(remaining)} ${cleanUnit}</span>
                            </div>
                            <!-- План/сутки -->
                            <div style="display: flex; justify-content: space-between; gap: 4px; border-top: 1px solid var(--gray-50); padding-top: 4px; margin-top: 2px;">
                                <span style="color: var(--primary);">План/сутки</span>
                                <span style="font-weight: 600; color: var(--primary); white-space: nowrap;">${this.formatQty(dailyPlan > 0 ? dailyPlan : (task.duration > 0 ? physicalVolume / task.duration : 0))} ${cleanUnit}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Правая часть: Название, Форма, История -->
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0;">
                        <!-- Название задачи (title) -->
                        <div style="font-size: 11px; font-weight: 600; color: var(--gray-600); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-bottom: 4px; border-bottom: 1px solid var(--gray-100);">
                            ${this.escapeHtml(task.text)}
                        </div>
                        
                        <!-- Форма ввода (в одну строку) -->
                        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; gap: 8px; align-items: flex-end;">
                            <div style="flex: 1; min-width: 0;">
                                <label style="font-size: 10px; color: var(--gray-500); display: block; margin-bottom: 2px;">Кол-во (${cleanUnit})</label>
                                <div style="display: flex; gap: 4px; align-items: center;">
                                    <input type="number" id="execution-qty-input" placeholder="0" step="0.01" 
                                           style="width: 100%; padding: 4px 8px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 13px; height: 30px;">
                                    ${dailyPlan > 0 ? `
                                    <button id="execution-daily-plan-btn" title="Подставить норму/сутки (${this.formatQty(dailyPlan)})" 
                                            style="padding: 4px; background: white; border: 1px solid var(--gray-300); border-radius: 4px; cursor: pointer; height: 30px; display: flex; align-items: center;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                            <div style="width: 50px;">
                                <label style="font-size: 10px; color: var(--gray-500); display: block; margin-bottom: 2px;">%</label>
                                <input type="number" id="execution-percent-input" placeholder="0" min="0" max="100" step="0.1" 
                                       style="width: 100%; padding: 4px 4px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 13px; height: 30px; text-align: center;">
                            </div>
                            <div style="width: 110px;">
                                <label style="font-size: 10px; color: var(--gray-500); display: block; margin-bottom: 2px;">Дата</label>
                                <input type="date" id="execution-date-input" value="${new Date().toISOString().split('T')[0]}" 
                                       style="width: 100%; padding: 4px 6px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 12px; height: 30px;">
                            </div>
                            <button id="execution-save-btn" style="padding: 0 16px; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; height: 30px; white-space: nowrap;">
                                Записать
                            </button>
                        </div>
                        
                        <!-- История (Таблица) -->
                        <div style="flex: 1; overflow-y: auto; border: 1px solid var(--gray-100); border-radius: 4px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                <thead style="background: var(--gray-50); border-bottom: 1px solid var(--gray-200); position: sticky; top: 0;">
                                    <tr>
                                        <th style="text-align: left; padding: 6px 10px; color: var(--gray-500); font-weight: 500;">Дата</th>
                                        <th style="text-align: right; padding: 6px 10px; color: var(--gray-500); font-weight: 500;">Кол-во</th>
                                        <th style="text-align: right; padding: 6px 10px; color: var(--gray-500); font-weight: 500;">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${history.length === 0 ? `
                                    <tr>
                                        <td colspan="3" style="text-align: center; color: var(--gray-400); padding: 20px;">История пуста</td>
                                    </tr>
                                    ` : history.map(h => `
                                    <tr style="border-bottom: 1px solid var(--gray-100);">
                                        <td style="padding: 6px 10px;">${new Date(h.date).toLocaleDateString('ru-RU')}</td>
                                        <td style="text-align: right; padding: 6px 10px; font-weight: 500;">+${this.formatQty(h.quantity)} ${cleanUnit}</td>
                                        <td style="text-align: right; padding: 6px 10px; color: var(--gray-500);">${(h.progress * 100).toFixed(1)}%</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Обработчики событий
            const dailyBtn = document.getElementById('execution-daily-plan-btn');
            const qtyInp = document.getElementById('execution-qty-input');
            const pctInp = document.getElementById('execution-percent-input');
            const dateInp = document.getElementById('execution-date-input');
            const saveBtn = document.getElementById('execution-save-btn');

            if (dailyBtn && qtyInp) {
                dailyBtn.addEventListener('click', () => {
                    qtyInp.value = dailyPlan;
                    if (pctInp && physicalVolume > 0) {
                        pctInp.value = ((dailyPlan / physicalVolume) * 100).toFixed(1);
                    }
                });
            }

            if (qtyInp && pctInp && physicalVolume > 0) {
                qtyInp.addEventListener('input', () => {
                    const q = parseFloat(qtyInp.value) || 0;
                    pctInp.value = q > 0 ? ((q / physicalVolume) * 100).toFixed(1) : '';
                });
                pctInp.addEventListener('input', () => {
                    const p = parseFloat(pctInp.value) || 0;
                    qtyInp.value = p > 0 ? ((p / 100) * physicalVolume).toFixed(2) : '';
                });
            }

            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const val = parseFloat(qtyInp.value);
                    const executionDate = dateInp.value;

                    if (isNaN(val) || val <= 0) {
                        UI.showNotification('Введите количество', 'error');
                        return;
                    }

                    const newComp = completed + val;
                    const newProg = physicalVolume > 0 ? Math.min(1, newComp / physicalVolume) : 0;

                    try {
                        UI.showNotification('Сохранение...', 'info');
                        await api.updateGanttTask(taskId, {
                            completedQuantity: newComp,
                            progress: newProg,
                            addedQuantity: val,
                            executionDate: executionDate
                        });
                        task.completedQuantity = newComp;
                        task.progress = newProg;
                        gantt.updateTask(taskId);
                        gantt.render();
                        this.renderExecutionPane(taskId);
                        this.renderTaskDetailsPanel(taskId);
                        UI.showNotification('Выполнение записано', 'success');
                    } catch (e) {
                        console.error(e);
                        UI.showNotification('Ошибка сохранения', 'error');
                    }
                });
            }
        } catch (e) {
            console.error('renderExecutionPane error:', e);
        }
    },

    async renderAnalyticsPane(taskId) {
        const pane = document.getElementById('analytics-pane');
        if (!pane || !taskId || typeof gantt === 'undefined') return;

        try {
            const task = gantt.getTask(taskId);
            if (!task || task.type === 'project') {
                pane.innerHTML = `
                    <div style="color: var(--gray-500); text-align: center; padding: 24px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 8px;">
                            <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                        </svg>
                        <div>Аналитика доступна только для видов работ</div>
                    </div>
                `;
                return;
            }

            // If resources aren't loaded, load them
            if (!this.currentTaskResources || this.resourcesPane.selectedTaskId !== taskId) {
                const workTypeId = this.extractWorkTypeIdFromTaskId(taskId);
                if (workTypeId) {
                    this.currentTaskResources = await api.getResources(workTypeId);
                    this.resourcesPane.selectedTaskId = taskId;
                }
            }

            const resources = this.currentTaskResources || [];
            const taskQty = Number(task.quantity || 0);
            const duration = Number(task.duration || 1);

            // Расчет плановой интенсивности для каждого дня
            const getGroupIntensity = (type) => {
                return resources
                    .filter(r => r.resourceType === type)
                    .reduce((sum, r) => {
                        const norm = r.normPerUnit !== null ? Number(r.normPerUnit) : 0;
                        const totalHours = norm * taskQty;
                        const resShifts = Number(r.shiftsPerDay || 1);
                        const shiftHrs = Number(r.shiftDuration) || Number(task.shiftDuration) || (this.projectSettings?.shiftDuration) || 8;

                        if (duration > 0 && resShifts > 0 && shiftHrs > 0) {
                            const rawIntensity = totalHours / (duration * resShifts * shiftHrs);
                            return sum + Math.ceil(rawIntensity);
                        }
                        return sum;
                    }, 0);
            };

            const plannedLabor = getGroupIntensity('labor');
            const plannedEquip = getGroupIntensity('equipment');

            // Подготовка данных для графиков (простая константа на весь срок для плана)
            const labels = [];
            const laborData = [];
            const equipData = [];

            for (let i = 0; i < duration; i++) {
                let d;
                if (typeof gantt !== 'undefined' && typeof gantt.addDays === 'function') {
                    d = gantt.addDays(task.start_date, i);
                } else {
                    d = new Date(task.start_date);
                    d.setDate(d.getDate() + i);
                }

                const label = d.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                labels.push(label);
                laborData.push(plannedLabor);
                equipData.push(plannedEquip);
            }

            // Рендер чартов
            this.renderCharts(labels, laborData, equipData);

        } catch (e) {
            console.error('renderAnalyticsPane error:', e);
        }
    },

    renderCharts(labels, laborData, equipData) {
        if (typeof Chart === 'undefined') {
            const pane = document.getElementById('analytics-pane');
            if (pane) pane.innerHTML = '<div style="padding:20px; color:red;">Ошибка: Библиотека Chart.js не загружена</div>';
            return;
        }

        const ctxLabor = document.getElementById('chart-labor');
        const ctxEquip = document.getElementById('chart-equipment');
        if (!ctxLabor || !ctxEquip) return;

        // Destroy previous instances
        if (this.charts.labor) this.charts.labor.destroy();
        if (this.charts.equipment) this.charts.equipment.destroy();

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f1f1' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        };

        this.charts.labor = new Chart(ctxLabor, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'План (чел)',
                    data: laborData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0,
                    pointRadius: 2
                }]
            },
            options: commonOptions
        });

        this.charts.equipment = new Chart(ctxEquip, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'План (маш)',
                    data: equipData,
                    borderColor: '#ca5010',
                    backgroundColor: 'rgba(202, 80, 16, 0.1)',
                    fill: true,
                    tension: 0,
                    pointRadius: 2
                }]
            },
            options: commonOptions
        });
    },

    async loadAndShowResourcesForTask(taskId) {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            const task = gantt.getTask(taskId);
            if (!task) return;

            if (task.type !== 'task') {
                this.resourcesPane.selectedTaskId = null;
                this.resourcesPane.selectedWorkTypeId = null;
                this.renderResourcesPlaceholder('Выберите вид работ (задачу), чтобы увидеть ресурсы');
                return;
            }

            const workTypeId = this.extractWorkTypeIdFromTaskId(task.id);
            this.resourcesPane.selectedTaskId = task.id;
            this.resourcesPane.selectedWorkTypeId = workTypeId;

            // Открываем нижнюю панель только если это явно вызвано действием пользователя, 
            // а не автоматическим выбором при загрузке.
            // Но в данном случае оставим как есть, раз пользователь выбрал задачу - пусть видит детали.

            if (!workTypeId) {
                this.renderResourcesPlaceholder('Не удалось определить WorkTypeId для выбранной задачи');
                return;
            }

            const token = ++this.resourcesPane.token;
            this.renderResourcesLoading(task.text);

            const resources = await api.getResources(workTypeId);
            if (token !== this.resourcesPane.token) return; // stale

            this.currentTaskResources = resources;
            this.renderResourcesList(task.text, resources);
        } catch (e) {
            console.error('loadAndShowResourcesForTask failed', e);
            this.renderResourcesPlaceholder('Ошибка загрузки ресурсов');
        }
    },

    expandAll() {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            gantt.batchUpdate(() => {
                gantt.eachTask((task) => {
                    if (gantt.hasChild(task.id)) gantt.open(task.id);
                });
            });
            gantt.render();
        } catch (err) {
            console.error('expandAll error', err);
        }
    },

    toggleEstimateColumns(show) {
        this.showEstimate = !!show;
        this.updateColumns();
    },

    toggleVolumeColumns(show) {
        this.showVolume = !!show;
        this.updateColumns();
    },

    updateColumns() {
        if (!this.isInitialized || typeof gantt === 'undefined') return;

        try {
            // Базовые колонки (всегда видны)
            const baseColumns = [
                { name: "text", label: "Название задачи", tree: true, width: 360, resize: true },
                { name: "start_date", label: "Начало", align: "center", width: 120, resize: true },
                { name: "end_date", label: "Окончание", align: "center", width: 120, resize: true },
                { name: "duration", label: "Длит.", align: "center", width: 60, resize: true, template: (obj) => obj.type === 'project' ? '' : obj.duration },
                {
                    name: "progress", label: "%", align: "center", width: 50, resize: true,
                    template: (obj) => Math.round(obj.progress * 100) + "%"
                }
            ];

            // Детальные колонки сметы (показываем только если showEstimate = true)
            const estimateColumns = this.showEstimate ? [
                {
                    name: "quantity", label: "Объем", align: "center", width: 70, resize: true,
                    template: (obj) => obj.type === 'project' ? '' : (obj.quantity || '')
                },
                {
                    name: "unit", label: "Ед.изм.", align: "center", width: 100, resize: true,
                    template: (obj) => obj.type === 'project' ? '' : (obj.unit || '')
                }
            ] : [];

            // Колонки объемов и выполнения (показываем только если showVolume = true)
            const volumeColumns = [];

            if (this.showVolume) {
                // Колонка физического объема
                volumeColumns.push({
                    name: "total_qty",
                    label: "Физ. объем",
                    align: "center",
                    width: 130,
                    resize: true,
                    template: (obj) => {
                        if (obj.type === 'project' || !obj.quantity) return '';
                        const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                        if (!total) return '';
                        const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                        return `${this.formatQty(total)} ${cleanUnit}`;
                    }
                });

                // Колонка Выполнено
                volumeColumns.push({
                    name: "completed_qty",
                    label: "Выполнено",
                    align: "center",
                    width: 100,
                    resize: true,
                    template: (obj) => {
                        if (obj.type === 'project') return '';
                        const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                        const completed = Number(obj.completedQuantity || 0);
                        if (!total && !completed) return '';
                        const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                        return `<span style="color: var(--success); font-weight: 500;">${this.formatQty(completed)}</span> <span style="font-size: 10px; opacity: 0.7;">${cleanUnit}</span>`;
                    }
                });

                // Колонка Остаток
                volumeColumns.push({
                    name: "remaining_qty",
                    label: "Остаток",
                    align: "center",
                    width: 100,
                    resize: true,
                    template: (obj) => {
                        if (obj.type === 'project') return '';
                        const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                        const completed = Number(obj.completedQuantity || 0);
                        const remaining = Math.max(0, total - completed);
                        if (!total && !remaining) return '';
                        const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                        return `<span style="color: var(--accent-orange); font-weight: 500;">${this.formatQty(remaining)}</span> <span style="font-size: 10px; opacity: 0.7;">${cleanUnit}</span>`;
                    }
                });

                // Колонка План/сутки
                volumeColumns.push({
                    name: "daily_plan",
                    label: "План/сутки",
                    align: "center",
                    width: 100,
                    resize: true,
                    template: (obj) => {
                        if (obj.type === 'project' || !obj.quantity || !obj.duration) return '';
                        const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                        if (!total) return '';
                        const daily = total / obj.duration;
                        const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                        return `<span style="font-weight: 600; color: var(--primary);"> ${this.formatQty(daily)}</span> <span style="font-size: 11px; opacity: 0.7;">${cleanUnit}</span>`;
                    }
                });
            }

            // Колонка "добавить"
            const addColumn = { name: "add", label: "", width: 44 };

            // Собираем финальный массив колонок
            gantt.config.columns = [
                ...baseColumns,
                ...estimateColumns,
                ...volumeColumns,
                addColumn
            ];

            // Перерисовываем (без полной переинициализации init, чтобы не ломать layout)
            gantt.render();
            this.ensureTodayMarker();

            console.log(`✓ Columns updated: Estimate=${this.showEstimate}, Volumes=${this.showVolume}`);
        } catch (err) {
            console.error('updateColumns error:', err);
        }
    },

    collapseAll() {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            const rootIds = [];
            gantt.eachTask((task) => {
                if (task.parent === 0 || task.parent === '0' || task.parent == null || task.parent === '') {
                    rootIds.push(task.id);
                }
            });

            gantt.batchUpdate(() => {
                gantt.eachTask((task) => {
                    if (gantt.hasChild(task.id)) gantt.close(task.id);
                });
                // Держим верхний уровень видимым
                rootIds.forEach((id) => {
                    try { gantt.open(id); } catch (_) { }
                });
            });
            gantt.render();
        } catch (err) {
            console.error('collapseAll error', err);
        }
    },

    ensureTodayMarker() {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined' || typeof gantt.addMarker !== 'function') return;

            if (this.todayMarkerId) {
                try { gantt.deleteMarker(this.todayMarkerId); } catch (_) { }
                this.todayMarkerId = null;
            }

            this.todayMarkerId = gantt.addMarker({
                start_date: new Date(),
                css: 'today',
                text: 'Сегодня',
                title: 'Сегодня'
            });
        } catch (err) {
            console.error('ensureTodayMarker error', err);
        }
    },

    computeChildrenBounds(parentId) {
        try {
            if (!parentId || parentId === 0 || parentId === '0') return null;
            const childIds = (typeof gantt.getChildren === 'function') ? gantt.getChildren(parentId) : [];
            if (!childIds || childIds.length === 0) return null;

            let minStart = null;
            let maxEnd = null;
            let totalDuration = 0;
            let weightedProgress = 0;
            let totalQty = 0;
            let totalCompletedQty = 0;

            for (const childId of childIds) {
                const child = gantt.getTask(childId);
                if (!child || !child.start_date) continue;
                const start = child.start_date;
                const dur = Number(child.duration || 0);
                const end = child.end_date
                    ? child.end_date
                    : (typeof gantt.calculateEndDate === 'function')
                        ? gantt.calculateEndDate(start, dur)
                        : new Date(start.getTime() + (dur * 24 * 60 * 60 * 1000));

                if (!minStart || start < minStart) minStart = start;
                if (!maxEnd || end > maxEnd) maxEnd = end;

                totalDuration += dur;
                weightedProgress += (child.progress || 0) * dur;
                totalQty += Number(child.quantity || 0);
                totalCompletedQty += Number(child.completedQuantity || 0);
            }

            if (!minStart || !maxEnd) return null;

            const duration = (typeof gantt.calculateDuration === 'function')
                ? Math.max(1, gantt.calculateDuration(minStart, maxEnd))
                : Math.max(1, Math.ceil((maxEnd.getTime() - minStart.getTime()) / (24 * 60 * 60 * 1000)));

            const progress = totalDuration > 0 ? (weightedProgress / totalDuration) : 0;

            return {
                start_date: minStart,
                duration,
                progress,
                quantity: totalQty,
                completedQuantity: totalCompletedQty
            };
        } catch (err) {
            console.error('computeChildrenBounds error', err);
            return null;
        }
    },

    async rollupFromNode(nodeId, persist = true) {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            if (!nodeId || nodeId === 0 || nodeId === '0') return;
            if (this.isAutoUpdatingParents) return;

            const updates = [];
            const visited = new Set();
            let currentId = nodeId;

            while (currentId && currentId !== 0 && currentId !== '0' && !visited.has(currentId)) {
                visited.add(currentId);
                const bounds = this.computeChildrenBounds(currentId);
                if (bounds) {
                    const t = gantt.getTask(currentId);
                    const startChanged = !t.start_date || t.start_date.getTime() !== bounds.start_date.getTime();
                    const durationChanged = Number(t.duration || 0) !== Number(bounds.duration || 0);
                    if (startChanged || durationChanged) {
                        updates.push({ id: currentId, start_date: bounds.start_date, duration: bounds.duration });
                    }
                }
                const t = gantt.getTask(currentId);
                currentId = t ? t.parent : null;
            }

            if (updates.length === 0) return;

            this.isAutoUpdatingParents = true;
            gantt.batchUpdate(() => {
                updates.forEach((u) => {
                    const t = gantt.getTask(u.id);
                    t.start_date = u.start_date;
                    t.duration = u.duration;
                    if (typeof gantt.calculateEndDate === 'function') {
                        t.end_date = gantt.calculateEndDate(t.start_date, t.duration);
                    }
                    gantt.updateTask(u.id);
                });
            });
            this.isAutoUpdatingParents = false;
            gantt.render();

            if (persist) {
                for (const u of updates) {
                    try {
                        await api.updateGanttTask(u.id, { start_date: u.start_date, duration: u.duration });
                    } catch (e) {
                        console.warn('Failed to persist parent rollup', u.id, e);
                    }
                }
            }
        } catch (err) {
            this.isAutoUpdatingParents = false;
            console.error('rollupFromNode error', err);
        }
    },

    async rollupParentChainFrom(taskId, persist = true) {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            if (this.isAutoUpdatingParents) return;

            const task = gantt.getTask(taskId);
            if (!task) return;

            const updates = [];
            const visited = new Set();
            let parentId = task.parent;

            while (parentId && parentId !== 0 && parentId !== '0' && !visited.has(parentId)) {
                visited.add(parentId);
                const bounds = this.computeChildrenBounds(parentId);
                if (bounds) {
                    const parent = gantt.getTask(parentId);
                    const startChanged = !parent.start_date || parent.start_date.getTime() !== bounds.start_date.getTime();
                    const durationChanged = Number(parent.duration || 0) !== Number(bounds.duration || 0);
                    const progressChanged = Math.abs((parent.progress || 0) - (bounds.progress || 0)) > 0.001;
                    const qtyChanged = Number(parent.quantity || 0) !== Number(bounds.quantity || 0);
                    const compChanged = Number(parent.completedQuantity || 0) !== Number(bounds.completedQuantity || 0);

                    if (startChanged || durationChanged || progressChanged || qtyChanged || compChanged) {
                        updates.push({
                            id: parentId,
                            start_date: bounds.start_date,
                            duration: bounds.duration,
                            progress: bounds.progress,
                            quantity: bounds.quantity,
                            completedQuantity: bounds.completedQuantity
                        });
                    }
                }

                const parentTask = gantt.getTask(parentId);
                parentId = parentTask ? parentTask.parent : null;
            }

            if (updates.length === 0) return;

            this.isAutoUpdatingParents = true;
            // Обновляем UI (используем batchUpdate, чтобы гарантировать перерисовку)
            gantt.batchUpdate(() => {
                updates.forEach((u) => {
                    const t = gantt.getTask(u.id);
                    t.start_date = u.start_date;
                    t.duration = u.duration;
                    t.progress = u.progress;
                    t.quantity = u.quantity;
                    t.completedQuantity = u.completedQuantity;

                    if (typeof gantt.calculateEndDate === 'function') {
                        t.end_date = gantt.calculateEndDate(t.start_date, t.duration);
                    }
                    gantt.updateTask(u.id);
                });
            });
            this.isAutoUpdatingParents = false;
            gantt.render();

            if (persist) {
                // Сохраняем пересчитанные родительские задачи на backend
                for (const u of updates) {
                    try {
                        await api.updateGanttTask(u.id, {
                            start_date: u.start_date,
                            duration: u.duration,
                            progress: u.progress,
                            quantity: u.quantity,
                            completedQuantity: u.completedQuantity
                        });
                    } catch (e) {
                        // Не ломаем UX, просто логируем
                        console.warn('Failed to persist parent rollup', u.id, e);
                    }
                }
            }
        } catch (err) {
            this.isAutoUpdatingParents = false;
            console.error('rollupParentChainFrom error', err);
        }
    },

    async rollupAllParents() {
        try {
            if (!this.isInitialized || typeof gantt === 'undefined') return;
            const all = [];
            gantt.eachTask((t) => {
                if (t && t.parent && t.parent !== 0 && t.parent !== '0') {
                    all.push(t.id);
                }
            });
            // UI-only: поправляем вид для старых данных, без сохранения на сервер.
            for (const id of all) {
                await this.rollupParentChainFrom(id, false);
            }
        } catch (err) {
            console.error('rollupAllParents error', err);
        }
    },

    async init(projectId) {
        this.currentProjectId = projectId;

        // Load project settings
        try {
            const project = await api.getProject(projectId);
            this.projectSettings = {
                shiftDuration: project.shiftDuration || 8,
                workWeek: project.workWeek || '5_2'
            };
        } catch (e) {
            console.error('Failed to load project settings:', e);
            this.projectSettings = { shiftDuration: 8, workWeek: '5_2' };
        }

        // Очищаем контейнер
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="schedule-root">
                <div class="toolbar" style="padding: 8px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #fff;">
                    <div class="gantt-legend" title="Легенда цветов">
                        <div class="legend-item"><span class="legend-swatch phase"></span><span>Очередь</span></div>
                        <div class="legend-item"><span class="legend-swatch block"></span><span>Блок</span></div>
                        <div class="legend-item"><span class="legend-swatch floor"></span><span>Этаж</span></div>
                    </div>

                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="font-size: 14px; color: var(--gray-600);">Масштаб:</span>
                        <select onchange="ScheduleManager.setScale(this.value)" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color);">
                            <option value="day">День</option>
                            <option value="week">Неделя</option>
                            <option value="month" selected>Месяц</option>
                            <option value="year">Год</option>
                        </select>
                    </div>
                </div>
                <div class="schedule-main">
                    <div id="gantt_here" class="schedule-gantt"></div>
                </div>
            </div>
            <div id="schedule-bottom" class="schedule-bottom-panel" aria-label="Нижняя панель">
                <!-- Вертикальный ресайзер -->
                <div class="schedule-bottom-resizer" id="bottom-panel-resizer"></div>
                
                <div class="schedule-bottom-header">
                    <div class="schedule-bottom-tabs" role="tablist" aria-label="Нижние вкладки">
                        <button type="button" class="schedule-bottom-tab" data-tab="resources" role="tab" aria-selected="false">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap-icon lucide-zap"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
                            <span>Ресурсы</span>
                        </button>
                        <button type="button" class="schedule-bottom-tab" data-tab="execution" role="tab" aria-selected="false">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            <span>Выполнение</span>
                        </button>
                        <button type="button" class="schedule-bottom-tab" data-tab="analytics" role="tab" aria-selected="false">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                            <span>Аналитика</span>
                        </button>
                        <button type="button" class="schedule-bottom-tab" data-tab="contractors" role="tab" aria-selected="false">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pickaxe-icon lucide-pickaxe"><path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/><path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/><path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/></svg>
                            <span>Подрядчики</span>
                        </button>
                        <button type="button" class="schedule-bottom-tab" data-tab="monitoring" role="tab" aria-selected="false">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                            <span>Мониторинг 3D</span>
                        </button>
                    </div>
                    <button type="button" class="schedule-bottom-toggle" aria-label="Свернуть/развернуть панель" title="Свернуть/развернуть">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="schedule-bottom-content" role="region" aria-label="Содержимое нижней панели">
                    <div style="display: flex; height: 100%; gap: 12px;">
                        <!-- Левая колонка: Ресурсы / Выполнение / Подрядчики -->
                        <div style="flex: 1; min-width: 0; overflow: auto;">
                            <div class="schedule-bottom-pane" data-pane="resources">
                                <div style="color: var(--gray-700);">Ресурсы (в разработке)</div>
                            </div>
                            <div class="schedule-bottom-pane" data-pane="execution" id="execution-pane">
                                <div style="color: var(--gray-500); text-align: center; padding: 24px;">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 8px;">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                    </svg>
                                    <div>Выберите задачу для учета выполнения</div>
                                </div>
                            </div>
                            <div class="schedule-bottom-pane" data-pane="analytics" id="analytics-pane">
                                <div style="display: flex; height: 100%; gap: 16px; padding: 8px;">
                                    <div style="flex: 1; min-width: 0; background: #fff; border-radius: 8px; border: 1px solid var(--gray-200); padding: 12px; display: flex; flex-direction: column;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Трудовые ресурсы (чел.)</div>
                                        <div style="flex: 1; position: relative;">
                                            <canvas id="chart-labor"></canvas>
                                        </div>
                                    </div>
                                    <div style="flex: 1; min-width: 0; background: #fff; border-radius: 8px; border: 1px solid var(--gray-200); padding: 12px; display: flex; flex-direction: column;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Механизмы (маш.)</div>
                                        <div style="flex: 1; position: relative;">
                                            <canvas id="chart-equipment"></canvas>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="schedule-bottom-pane" data-pane="contractors">
                                <div style="color: var(--gray-700);">Подрядчики (в разработке)</div>
                            </div>
                            <div class="schedule-bottom-pane" data-pane="monitoring" id="monitoring-pane">
                                <div style="color: var(--gray-700);">Загрузка мониторинга...</div>
                            </div>
                        </div>
                        
                        <!-- Правая колонка: Детали задачи -->
                        <div class="task-details-panel" style="width: 320px; flex-shrink: 0; background: var(--gray-50); border-radius: 8px; border: 1px solid var(--gray-200); overflow: auto;">
                            <div style="padding: 12px; border-bottom: 1px solid var(--gray-200); background: var(--white); border-radius: 8px 8px 0 0;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <line x1="10" y1="9" x2="8" y2="9"/>
                                    </svg>
                                    <span style="font-weight: 600; color: var(--gray-900);">Детали задачи</span>
                                </div>
                            </div>
                            <div id="task-details-content" style="padding: 12px;">
                                <div style="color: var(--gray-500); font-size: 13px; text-align: center; padding: 24px;">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom: 8px;">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 16v-4"/>
                                        <path d="M12 8h.01"/>
                                    </svg>
                                    <div>Выберите задачу для просмотра деталей</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initBottomPanel();
        this.initFilters();

        // Инициализация DHTMLX Gantt
        this.initGantt();

        // Загрузка данных
        await this.loadData();
    },

    initBottomPanel() {
        const bottom = document.getElementById('schedule-bottom');
        if (!bottom) return;

        const tabs = Array.from(bottom.querySelectorAll('.schedule-bottom-tab'));
        tabs.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (!tab) return;
                this.toggleBottomPanel(tab);
            });
        });

        // Toggle button handler
        const toggleBtn = bottom.querySelector('.schedule-bottom-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                // Toggle open/close state
                this.setBottomPanelState(!this.bottomPanel.isOpen, this.bottomPanel.activeTab);
            });
        }

        // --- ВЕРТИКАЛЬНЫЙ РЕСАЙЗЕР НИЖНЕЙ ПАНЕЛИ ---
        const resizer = document.getElementById('bottom-panel-resizer');
        if (resizer) {
            let startY, startHeight;

            const onMouseMove = (e) => {
                const dy = startY - e.clientY;
                const newHeight = Math.max(100, Math.min(window.innerHeight - 100, startHeight + dy));
                this.bottomPanel.openHeightPx = newHeight;
                bottom.style.height = `${newHeight}px`;
                gantt.setSizes();
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            };

            resizer.addEventListener('mousedown', (e) => {
                if (!this.bottomPanel.isOpen) return; // Не ресайзим закрытую панель
                startY = e.clientY;
                startHeight = bottom.offsetHeight;

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });
        }
        // Начальное состояние: скрыто (только строка вкладок)
        this.setBottomPanelState(false, this.bottomPanel.activeTab);

        // Плейсхолдер для ресурсов
        this.renderResourcesPlaceholder();
    },

    installContextMenu() {
        if (this.contextMenu.isInstalled) return;
        this.contextMenu.isInstalled = true;

        const ensureMenuEl = () => {
            if (this.contextMenu.el) return this.contextMenu.el;
            let el = document.getElementById('gantt-context-menu');
            if (!el) {
                el = document.createElement('div');
                el.id = 'gantt-context-menu';
                el.className = 'gantt-context-menu hidden';
                el.innerHTML = `
                    <button type="button" class="gantt-context-menu-item" data-action="edit">Редактировать</button>
                    <button type="button" class="gantt-context-menu-item danger" data-action="delete">Удалить</button>
                `;
                document.body.appendChild(el);
            }
            this.contextMenu.el = el;

            el.addEventListener('click', async (evt) => {
                const btn = evt.target?.closest?.('.gantt-context-menu-item');
                if (!btn) return;
                const action = btn.dataset.action;
                const taskId = this.contextMenu.activeTaskId;
                this.hideContextMenu();
                if (!taskId) return;

                if (action === 'edit') {
                    try {
                        // Минимально: открываем стандартный lightbox
                        if (typeof gantt !== 'undefined' && typeof gantt.showLightbox === 'function') {
                            gantt.showLightbox(taskId);
                        } else {
                            UI.showNotification('Редактирование недоступно', 'error');
                        }
                    } catch (e) {
                        console.error('edit action failed', e);
                    }
                }

                if (action === 'delete') {
                    try {
                        const task = gantt.getTask(taskId);
                        // Удаляем только "виды работ" (обычные задачи)
                        if (task?.type === 'project') {
                            UI.showNotification('Удаление доступно только для видов работ', 'info');
                            return;
                        }
                        const ok = await UI.showConfirmDialog('Удалить задачу', 'Вы уверены, что хотите удалить этот вид работ?', 'Удалить', 'Отмена');
                        if (!ok) return;

                        const parentId = task?.parent;

                        await api.deleteGanttTask(taskId);
                        gantt.deleteTask(taskId);
                        gantt.render();

                        if (parentId && parentId !== 0 && parentId !== '0') {
                            await this.rollupFromNode(parentId, true);
                        }

                        UI.showNotification('Задача удалена', 'success');
                    } catch (e) {
                        console.error('delete action failed', e);
                        UI.showNotification('Не удалось удалить задачу', 'error');
                    }
                }
            });

            return el;
        };

        const onDocClick = (e) => {
            const el = this.contextMenu.el;
            if (!el || el.classList.contains('hidden')) return;
            if (e.target && (el === e.target || el.contains(e.target))) return;
            this.hideContextMenu();
        };

        const onEsc = (e) => {
            if (e.key === 'Escape') this.hideContextMenu();
        };

        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onEsc);

        const ganttRoot = document.getElementById('gantt_here');
        if (!ganttRoot) return;

        ganttRoot.addEventListener('contextmenu', (e) => {
            try {
                if (typeof gantt === 'undefined') return;
                if (typeof gantt.locate !== 'function') return;
                const taskId = gantt.locate(e);
                if (!taskId) return;
                e.preventDefault();

                const task = gantt.getTask(taskId);
                ensureMenuEl();

                // Показываем/скрываем кнопку удаления для project-строк
                const delBtn = this.contextMenu.el.querySelector('[data-action="delete"]');
                if (delBtn) {
                    delBtn.style.display = (task?.type === 'project') ? 'none' : 'block';
                }

                this.showContextMenu(taskId, e.pageX, e.pageY);
            } catch (err) {
                console.error('contextmenu handler error', err);
            }
        });
    },

    showContextMenu(taskId, x, y) {
        const el = this.contextMenu.el || document.getElementById('gantt-context-menu');
        if (!el) return;
        this.contextMenu.el = el;
        this.contextMenu.activeTaskId = taskId;
        el.classList.remove('hidden');

        // Clamp to viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = el.getBoundingClientRect();
        const left = Math.max(8, Math.min(x, vw - rect.width - 8));
        const top = Math.max(8, Math.min(y, vh - rect.height - 8));
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    },

    hideContextMenu() {
        const el = this.contextMenu.el || document.getElementById('gantt-context-menu');
        if (!el) return;
        el.classList.add('hidden');
        this.contextMenu.activeTaskId = null;
    },

    computeBottomOpenHeightPx() {
        // Возвращаем динамическую высоту, если она была изменена ресайзером
        return this.bottomPanel.openHeightPx || 300;
    },

    setBottomPanelState(isOpen, activeTab) {
        const bottom = document.getElementById('schedule-bottom');
        if (!bottom) return;

        this.bottomPanel.isOpen = !!isOpen;
        if (activeTab) this.bottomPanel.activeTab = activeTab;

        const h = this.computeBottomOpenHeightPx();

        // Активная вкладка
        const tabs = Array.from(bottom.querySelectorAll('.schedule-bottom-tab'));
        tabs.forEach((b) => {
            // Highlight active tab only if the panel is open
            const isActive = this.bottomPanel.isOpen && (b.dataset.tab === this.bottomPanel.activeTab);
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const panes = Array.from(bottom.querySelectorAll('.schedule-bottom-pane'));
        panes.forEach((p) => {
            const isActive = p.dataset.pane === this.bottomPanel.activeTab;
            p.classList.toggle('active', isActive);
        });

        // Если открываем вкладку выполнения или аналитики, удостоверимся что она актуальна
        if (this.bottomPanel.isOpen && (this.bottomPanel.activeTab === 'execution' || this.bottomPanel.activeTab === 'analytics') && typeof gantt !== 'undefined') {
            const selId = gantt.getSelectedId();
            if (selId) {
                if (this.bottomPanel.activeTab === 'execution') this.renderExecutionPane(selId);
                if (this.bottomPanel.activeTab === 'analytics') this.renderAnalyticsPane(selId);
            }
        }

        if (this.bottomPanel.isOpen && this.bottomPanel.activeTab === 'monitoring') {
            if (window.MonitoringManager) {
                window.MonitoringManager.init(this.currentProjectId);
            }
        }

        if (this.bottomPanel.isOpen) {
            bottom.classList.add('is-open');
            this.bottomPanel.openHeightPx = h;
            bottom.style.height = `${h}px`;
        } else {
            bottom.classList.remove('is-open');
            bottom.style.height = 'var(--schedule-bottom-tabs-height)';
        }

        // Прячем боковую панель деталей, если открыта вкладка "Выполнение"
        // Она заменяется на внутренний макет вкладки
        const detailsPanel = bottom.querySelector('.task-details-panel');
        if (detailsPanel) {
            const hideDetails = this.bottomPanel.isOpen && (this.bottomPanel.activeTab === 'execution' || this.bottomPanel.activeTab === 'analytics');
            detailsPanel.style.display = hideDetails ? 'none' : 'block';
        }

        // Пересчитать размеры ганта
        try {
            requestAnimationFrame(() => {
                if (typeof gantt !== 'undefined' && typeof gantt.setSizes === 'function') {
                    gantt.setSizes();
                }
            });
        } catch (_) { }
    },

    toggleBottomPanel(tab) {
        const isSameTab = this.bottomPanel.activeTab === tab;
        if (this.bottomPanel.isOpen && isSameTab) {
            // повторное нажатие на ту же вкладку -> скрыть вниз
            this.setBottomPanelState(false, tab);
            return;
        }
        // открыть (если закрыто) или переключить вкладку
        this.setBottomPanelState(true, tab);
    },

    initGantt() {
        try { console.log('[ScheduleManager]', this.version); } catch (_) { }
        // ============= ВСЕ КОНФИГУРАЦИИ ДО gantt.init() =============

        // Русификация
        gantt.i18n.setLocale("ru");

        // Включаем плагины
        gantt.plugins({
            marker: true,
            critical_path: true,
            tooltip: true,
            inline_editors: true
        });

        // Регистрируем инлайн-редакторы явно (для совместимости с разными версиями)
        if (gantt.ext && gantt.ext.inlineEditors && typeof gantt.ext.inlineEditors.attach === 'function') {
            gantt.ext.inlineEditors.attach({
                text: { type: "text", map_to: "text" },
                start_date: { type: "date", map_to: "start_date" },
                end_date: { type: "date", map_to: "end_date" },
                duration: { type: "number", map_to: "duration", min: 0, max: 100000 },
                quantity: { type: "number", map_to: "quantity", min: 0, max: 1e12, step: 0.01 },
                unit: { type: "text", map_to: "unit" }
            });
        }

        // Work Time Configuration
        gantt.config.work_time = true;
        const week = this.projectSettings?.workWeek || '5_2';
        if (week === '6_1') {
            gantt.setWorkTime({ day: 0, hours: false }); // Sun Off
            gantt.setWorkTime({ day: 6, hours: true });  // Sat On
        } else if (week === '7_0') {
            gantt.setWorkTime({ day: 0, hours: true });  // Sun On
            gantt.setWorkTime({ day: 6, hours: true });  // Sat On
        } else {
            gantt.setWorkTime({ day: 0, hours: false }); // Sun Off
            gantt.setWorkTime({ day: 6, hours: false }); // Sat Off
        }

        // Настройки шкалы времени (двухуровневая): Месяц+Год сверху, Дни снизу
        // -----------------------------------------------------------------------
        // КОМПАКТНЫЙ РЕЖИМ (по запросу пользователя)
        // -----------------------------------------------------------------------
        gantt.config.scale_height = 40; // Чуть меньше шапка
        gantt.config.row_height = 24;   // Высота строки (было 30)
        gantt.config.bar_height = 16;   // Высота полоски задачи (чтобы влезала)
        gantt.config.min_column_width = 25;

        // Совместимо с новыми версиями (gantt.config.scales) и со старыми (scale_unit + subscales)
        gantt.config.scales = [
            { unit: "month", step: 1, format: "%F %Y" },
            { unit: "day", step: 1, format: "%d" }
        ];

        // Старый API на случай, если scales игнорируется
        gantt.config.scale_unit = "month";
        gantt.config.date_scale = "%F %Y";
        gantt.config.subscales = [
            { unit: "day", step: 1, date: "%d" }
        ];

        // Формат даты, приходящей с сервера (YYYY-MM-DD HH:mm)
        gantt.config.xml_date = "%Y-%m-%d %H:%i";

        // Формат даты в таблице
        gantt.config.date_grid = "%d.%m.%Y";

        // Разрешаем перетягивание колонок сетки
        gantt.config.reorder_grid_columns = true;
        gantt.config.reorder_grid_columns_keep_nav_buttons = true;

        // Разрешаем изменение размера колонок сетки мышкой
        gantt.config.grid_resize = true;
        gantt.config.grid_elastic_columns = false;

        // Ресайзер между таблицей (grid) и колбасками (timeline)
        // ВАЖНО: Определяем layout прямо перед init, чтобы перебить дефолты
        gantt.config.layout = {
            css: "gantt_container",
            rows: [
                {
                    cols: [
                        { view: "grid", scrollX: "scrollHor", scrollY: "scrollVer" },
                        { resizer: true, width: 10 },
                        { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
                        { view: "scrollbar", id: "scrollVer" }
                    ]
                },
                { view: "scrollbar", id: "scrollHor" }
            ]
        };

        // Разрешаем изменение ширины грида
        gantt.config.keep_grid_width = false;
        gantt.config.grid_resize = true;

        // Фильтрация задач
        gantt.attachEvent("onBeforeTaskDisplay", (id, task) => {
            const noSectionFilter = this.filters.sections.length === 0;
            const noFloorFilter = this.filters.floors.length === 0;
            if (noSectionFilter && noFloorFilter) return true;

            // Проверяем саму задачу и всех её родителей
            let current = task;
            while (current) {
                const text = current.text || '';
                const isSectionNode = (text.includes('Секция') || text.includes('Блок')) && !text.includes('Этаж');
                const isFloorNode = text.includes('Этаж') || text.match(/Level|Storey/i);

                if (isSectionNode && !noSectionFilter && !this.filters.sections.includes(text)) {
                    return false;
                }
                if (isFloorNode && !noFloorFilter && !this.filters.floors.includes(text)) {
                    return false;
                }

                if (!current.parent || current.parent === 0 || current.parent === '0') break;
                try {
                    current = gantt.getTask(current.parent);
                } catch (e) { break; }
            }

            return true;
        });

        // Отключаем стандартное редактирование через Lightbox по двойному клику
        gantt.config.details_on_dblclick = false;
        gantt.config.details_on_create = false;

        // Конфигурация колонок (БЕЗ editor для text — добавим программно только для task-строк)
        gantt.config.columns = [
            { name: "text", label: "Название задачи", tree: true, width: 360, resize: true },
            { name: "start_date", label: "Начало", align: "center", width: 120, resize: true },
            { name: "end_date", label: "Окончание", align: "center", width: 120, resize: true },
            { name: "duration", label: "Длит.", align: "center", width: 60, resize: true, template: (obj) => obj.type === 'project' ? '' : obj.duration },
            {
                name: "progress", label: "%", align: "center", width: 50, resize: true, template: function (obj) {
                    return Math.round(obj.progress * 100) + "%";
                }
            },
            {
                name: "quantity", label: "Объем", align: "center", width: 70, resize: true, hide: true,
                template: (obj) => obj.type === 'project' ? '' : (obj.quantity || '')
            },
            {
                name: "unit", label: "Ед.изм.", align: "center", width: 100, resize: true, hide: true,
                template: (obj) => obj.type === 'project' ? '' : (obj.unit || '')
            },
            {
                name: "total_qty",
                label: "Физ. объем",
                align: "center",
                width: 130,
                resize: true,
                template: (obj) => {
                    if (obj.type === 'project' || !obj.quantity) return '';
                    const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                    if (!total) return '';

                    // Убираем множитель из единицы измерения для отображения, например "100 м2" -> "м2"
                    const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                    return `${this.formatQty(total)} ${cleanUnit}`;
                }
            },
            {
                name: "completed_qty",
                label: "Выполнено",
                align: "center",
                width: 100,
                resize: true,
                template: (obj) => {
                    if (obj.type === 'project') return '';
                    const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                    const completed = Number(obj.completedQuantity || 0);
                    if (!total && !completed) return '';
                    const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                    return `<span style="color: var(--success); font-weight: 500;">${this.formatQty(completed)}</span> <span style="font-size: 10px; opacity: 0.7;">${cleanUnit}</span>`;
                }
            },
            {
                name: "remaining_qty",
                label: "Остаток",
                align: "center",
                width: 100,
                resize: true,
                template: (obj) => {
                    if (obj.type === 'project') return '';
                    const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                    const completed = Number(obj.completedQuantity || 0);
                    const remaining = Math.max(0, total - completed);
                    if (!total && !remaining) return '';
                    const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                    return `<span style="color: var(--accent-orange); font-weight: 500;">${this.formatQty(remaining)}</span> <span style="font-size: 10px; opacity: 0.7;">${cleanUnit}</span>`;
                }
            },
            {
                name: "daily_plan",
                label: "План/сутки",
                align: "center",
                width: 100,
                resize: true,
                template: (obj) => {
                    if (obj.type === 'project' || !obj.quantity || !obj.duration) return '';
                    const total = this.calculatePhysicalVolume(obj.quantity, obj.unit);
                    if (!total) return '';

                    const daily = total / obj.duration;
                    const cleanUnit = String(obj.unit || '').replace(/^\d+\s*/, '').trim();
                    return `<span style="font-weight: 600; color: var(--primary);">${this.formatQty(daily)}</span> <span style="font-size: 11px; opacity: 0.7;">${cleanUnit}</span>`;
                }
            },
            { name: "add", label: "", width: 44 }
        ];

        // Настройка Lightbox (окна свойств) - хоть и не используем, но на всякий случай
        gantt.config.lightbox.sections = [
            { name: "description", height: 38, map_to: "text", type: "textarea", focus: true },
            { name: "quantity", height: 30, map_to: "quantity", type: "textarea" },
            { name: "unit", height: 30, map_to: "unit", type: "textarea" },
            { name: "time", height: 72, type: "duration", map_to: "auto" }
        ];

        gantt.locale.labels.section_description = "Название";
        gantt.locale.labels.section_quantity = "Объем";
        gantt.locale.labels.section_unit = "Ед. изм.";
        gantt.locale.labels.section_time = "Время";

        // Стилизация строк (заливка фона) — и в таблице, и в шкале
        const rowClass = function (start, end, task) {
            const classes = [];

            // Добавляем класс уровня вложенности для P6-стиля
            if (typeof task.$level !== 'undefined') {
                classes.push("level_" + task.$level);
            }

            if (task.type === 'project') {
                // Проверяем СНАЧАЛА этаж (более специфичное условие), потом блок
                // Этаж (manual: id starts with floor-; bim: name contains Level/Storey/Этаж...)
                if (task.id.toString().includes('floor') || (task.text && (task.text.includes('Этаж') || task.text.match(/Level|Storey|План|Отм/i)))) {
                    classes.push("row_floor");
                }
                // Очередь строительства
                else if (task.text && task.text.includes('Очередь')) classes.push("row_phase");
                // Блок (если есть blockId и это НЕ этаж)
                else if (task.blockId) classes.push("row_block");
                // Прочие группировки
                else classes.push("row_stage");

                // Для всех project-строк кроме этажей скрываем кнопку "+"
                const isFloor = task.id.toString().includes('floor') || (task.text && (task.text.includes('Этаж') || task.text.match(/Level|Storey|План|Отм/i)));
                if (!isFloor) classes.push("hide_add_button");
            } else {
                // Для обычных задач (виды работ) тоже скрываем "+"
                classes.push("hide_add_button");
            }
            return classes.join(" ");
        };

        gantt.templates.grid_row_class = rowClass;
        gantt.templates.task_row_class = rowClass;

        // CSS для скрытия кнопки "+" у не-этажей
        if (!document.getElementById('gantt-hide-add-style')) {
            const style = document.createElement('style');
            style.id = 'gantt-hide-add-style';
            style.innerHTML = `
                .gantt_row.hide_add_button .gantt_add,
                .gantt_task_line.hide_add_button .gantt_add {
                    display: none !important;
                    visibility: hidden !important;
                }
            `;
            document.head.appendChild(style);
        }

        // ============= СОБЫТИЯ (attachEvent) =============

        // При любом изменении задачи пересчитываем родителей (этаж/блок/очередь/проект)
        gantt.attachEvent("onAfterTaskUpdate", (id) => {
            // Не пересчитываем во время наших автоправок
            if (this.isAutoUpdatingParents) return true;

            // Sync progress with completedQuantity locally for immediate table update
            const task = gantt.getTask(id);
            if (task && task.type !== 'project' && task.quantity) {
                const total = this.calculatePhysicalVolume(task.quantity, task.unit);
                if (total > 0) {
                    const expectedComp = Number((task.progress * total).toFixed(4));
                    // Update only if difference is significant to avoid infinite loops or jitter
                    if (Math.abs((task.completedQuantity || 0) - expectedComp) > 0.001) {
                        task.completedQuantity = expectedComp;
                        // refreshTask instead of updateTask to avoid triggering another onAfterTaskUpdate if possible
                        // or just rely on isAutoUpdatingParents if we used updateTask
                        gantt.refreshTask(id);
                    }
                }
            }

            this.rollupParentChainFrom(id);
            return true;
        });

        // Выбор задачи: показываем ресурсы выбранного вида работ в нижней вкладке
        // Примечание: в разных версиях DHTMLX событие выбора может отличаться,
        // поэтому дополнительно дергаем логику на обычный клик по задаче.
        gantt.attachEvent("onAfterTaskSelect", (id) => {
            this.loadTaskDetails(id);
            return true;
        });

        gantt.attachEvent("onAfterTaskDrag", (id) => {
            if (this.isAutoUpdatingParents) return true;
            this.rollupParentChainFrom(id);
            return true;
        });

        // Блокируем двойной клик
        gantt.attachEvent("onTaskDblClick", () => false);

        // Inline-редактирование по клику в ячейку таблицы
        gantt.attachEvent("onGridClick", (id, e) => {
            try {
                if (!id || !e) return true;

                const target = e.target || e.srcElement;
                // Не перехватываем клик по "+" и по иконкам дерева
                if (target?.classList?.contains('gantt_add') || target?.closest?.('.gantt_add')) return true;
                if (target?.closest?.('.gantt_tree_icon') || target?.closest?.('.gantt_open') || target?.closest?.('.gantt_close')) return true;

                const cell = target?.closest ? target.closest('.gantt_cell') : null;
                if (!cell) return true;

                const row = cell.parentNode;
                if (!row || !row.children) return true;

                const idx = Array.prototype.indexOf.call(row.children, cell);
                const cols = gantt.getGridColumns();
                const col = cols && cols[idx] ? cols[idx] : null;
                if (!col || col.name === 'add') return true;

                const task = gantt.getTask(id);

                // Запрещаем редактирование названий для всех групповых строк (type === 'project')
                if (task.type === 'project' && col.name === 'text') {
                    return true;
                }

                // Запрещаем редактирование дат для групповых строк (type === 'project')
                // Разрешаем редактирование дат только для обычных задач
                if (task.type === 'project' && (col.name === 'start_date' || col.name === 'end_date')) {
                    return true;
                }

                // Для дат начала и окончания используем только кастомный редактор
                // Стандартный inlineEditor может работать некорректно для дат
                if (col.name === 'start_date' || col.name === 'end_date') {
                    // Пропускаем стандартный редактор, используем кастомный
                } else if (gantt.ext?.inlineEditors?.startEdit) {
                    // Для остальных полей пробуем стандартный редактор
                    const started = gantt.ext.inlineEditors.startEdit(id, col.name);
                    if (started === false) {
                        // если редактор не открылся — пойдём на кастомный
                    } else {
                        e.preventDefault?.();
                        return false;
                    }
                }

                // Кастомный простой inline-редактор (fallback, если встроенный не сработал)
                const createInput = () => {
                    const input = document.createElement('input');
                    input.style.width = '100%';
                    input.style.boxSizing = 'border-box';
                    input.style.height = '100%';
                    input.style.border = '1px solid var(--gray-300)';
                    input.style.padding = '2px 4px';
                    input.style.fontSize = '13px';
                    input.style.fontFamily = 'inherit';
                    return input;
                };

                const commitAndRefresh = () => {
                    // Обновляем задачу в gantt
                    gantt.updateTask(id);
                    // Обновляем отображение
                    gantt.refreshTask(id);
                    // DataProcessor автоматически сохранит изменения через api.updateGanttTask
                };

                const formatDateISO = gantt.date.date_to_str("%Y-%m-%d");
                const parseDate = (val) => {
                    if (!val) return null;
                    // val в формате YYYY-MM-DD
                    const d = new Date(val + 'T00:00:00');
                    return isNaN(d.getTime()) ? null : d;
                };

                const openEditor = (type) => {
                    const input = createInput();
                    const revert = cell.innerHTML;
                    cell.innerHTML = '';
                    cell.appendChild(input);

                    let initialValue = '';
                    if (type === 'start_date' && task.start_date) initialValue = formatDateISO(task.start_date);
                    if (type === 'end_date' && task.end_date) initialValue = formatDateISO(task.end_date);
                    if (type === 'duration') initialValue = Number(task.duration || 0);
                    if (type === 'quantity') initialValue = Number(task.quantity || 0);
                    if (type === 'unit') initialValue = task.unit || '';
                    if (type === 'text') initialValue = task.text || '';

                    if (type === 'start_date' || type === 'end_date') {
                        input.type = 'date';
                    } else if (type === 'duration') {
                        input.type = 'number';
                        input.step = '1';
                        input.min = '0';
                    } else if (type === 'quantity') {
                        input.type = 'number';
                        input.step = '0.01';
                        input.min = '0';
                    } else {
                        input.type = 'text';
                    }

                    input.value = initialValue;
                    input.focus();
                    input.select();

                    const cancel = () => {
                        cell.innerHTML = revert;
                    };

                    const save = () => {
                        if (type === 'start_date') {
                            const d = parseDate(input.value);
                            if (!d) return cancel();
                            // Проверяем, что дата начала не позже даты окончания (если она есть)
                            if (task.end_date && d > task.end_date) {
                                UI.showNotification('Дата начала не может быть позже даты окончания', 'error');
                                return cancel();
                            }
                            // Сохраняем текущую дату окончания для пересчета длительности
                            const oldEndDate = task.end_date;
                            task.start_date = d;
                            // Если есть длительность, пересчитываем дату окончания
                            if (task.duration && task.duration > 0) {
                                task.end_date = gantt.calculateEndDate(task.start_date, task.duration);
                            } else if (oldEndDate) {
                                // Если длительности нет, но была дата окончания, пересчитываем длительность
                                task.duration = gantt.calculateDuration(task.start_date, oldEndDate);
                            }
                        } else if (type === 'end_date') {
                            const d = parseDate(input.value);
                            if (!d) return cancel();
                            // Проверяем, что дата окончания не раньше даты начала
                            if (task.start_date && d < task.start_date) {
                                UI.showNotification('Дата окончания не может быть раньше даты начала', 'error');
                                return cancel();
                            }
                            task.end_date = d;
                            // Пересчитываем длительность на основе дат
                            if (task.start_date) {
                                task.duration = gantt.calculateDuration(task.start_date, task.end_date);
                            }
                        } else if (type === 'duration') {
                            const v = parseFloat(input.value);
                            if (isNaN(v) || v < 0) return cancel();
                            task.duration = v;
                            if (task.start_date) {
                                task.end_date = gantt.calculateEndDate(task.start_date, task.duration);
                            }
                        } else if (type === 'quantity') {
                            const v = parseFloat(input.value);
                            if (isNaN(v) || v < 0) return cancel();
                            task.quantity = v;
                        } else if (type === 'unit') {
                            task.unit = input.value;
                        } else if (type === 'text') {
                            task.text = input.value || '';
                        }
                        commitAndRefresh();
                    };

                    input.addEventListener('keydown', (evt) => {
                        if (evt.key === 'Enter') {
                            save();
                            evt.preventDefault();
                        } else if (evt.key === 'Escape') {
                            cancel();
                        }
                    });

                    input.addEventListener('blur', () => {
                        save();
                    });
                };

                // Открываем кастомный редактор только для допустимых столбцов
                const editable = ['text', 'start_date', 'end_date', 'duration', 'quantity', 'unit'];
                if (editable.includes(col.name)) {
                    openEditor(col.name);
                    e.preventDefault?.();
                    return false;
                }

                return true;
            } catch (err) {
                console.error('onGridClick inline edit error', err);
                return true;
            }
        });

        // Инициализация DataProcessor для сохранения изменений
        // В разных версиях DHTMLX сигнатуры отличаются:
        // - update(data)
        // - update(id, data, mode)
        // Делаем совместимо и всегда извлекаем корректный id.
        const dpOk = (action, extra = {}) => ({ action, ...extra });
        const dp = gantt.createDataProcessor({
            task: {
                update: (idOrData, dataMaybe, mode) => {
                    const task = (dataMaybe && typeof dataMaybe === 'object') ? dataMaybe : idOrData;
                    const id = (typeof idOrData === 'object' && idOrData !== null)
                        ? (idOrData.id ?? task?.id)
                        : (idOrData ?? task?.id);
                    return api.updateGanttTask(id, task).then(() => dpOk('updated', { id: String(id) }));
                },
                create: () => {
                    return Promise.resolve(dpOk('inserted'));
                },
                delete: () => {
                    return Promise.resolve(dpOk('deleted'));
                }
            },
            link: {
                update: () => {
                    return Promise.resolve(dpOk('updated'));
                },
                create: (idOrData, dataMaybe) => {
                    const link = (dataMaybe && typeof dataMaybe === 'object') ? dataMaybe : idOrData;
                    return api.createGanttLink(link).then((resp) => {
                        const newId = resp?.tid ?? resp?.id;
                        return dpOk('inserted', newId ? { tid: String(newId) } : {});
                    });
                },
                delete: (idOrData, dataMaybe) => {
                    const id = (typeof idOrData === 'object' && idOrData !== null)
                        ? (idOrData.id ?? dataMaybe?.id)
                        : (idOrData ?? dataMaybe?.id);
                    return api.deleteGanttLink(id).then(() => dpOk('deleted', { id: String(id) }));
                }
            }
        });

        // Перехват клика по колонке "+" (add): на этажах открываем выбор сметы -> этап -> виды работ
        gantt.attachEvent("onTaskClick", (id, e) => {
            try {
                const target = e && e.target ? e.target : null;
                const isAddCell = !!(target && (target.classList?.contains('gantt_add') || target.closest?.('.gantt_add')));
                if (!isAddCell) return true;

                const task = gantt.getTask(id);
                const isFloor = (task.id && task.id.toString().startsWith('floor-')) || (task.text && task.text.includes('Этаж'));
                if (!isFloor) {
                    UI.showNotification('Добавление доступно только на уровне "Этаж"', 'info');
                    e.preventDefault?.();
                    return false;
                }

                ScheduleManager.showAssignWorkTypeModal(task);
                e.preventDefault?.();
                return false;
            } catch (err) {
                console.error('onTaskClick handler error', err);
                return true;
            }
        });

        // Любой клик по задаче (включая bars) — подгружаем ресурсы для worktype задач.
        gantt.attachEvent("onTaskClick", (id, e) => {
            try {
                const target = e && e.target ? e.target : null;
                const isAddCell = !!(target && (target.classList?.contains('gantt_add') || target.closest?.('.gantt_add')));
                if (!isAddCell) {
                    this.loadTaskDetails(id);
                }
                return true;
            } catch (_) {
                return true;
            }
        });

        // Обновляем ресурсы при перетаскивании или ресайзе задачи на Ганте
        gantt.attachEvent("onAfterTaskDrag", (id) => {
            if (this.bottomPanel.isOpen && this.bottomPanel.activeTab === 'resources' && this.resourcesPane.selectedTaskId === id) {
                console.log('[Gantt Drag] Updating intensities for task:', id);
                this.loadAndShowResourcesForTask(id);
            }
        });

        gantt.attachEvent("onAfterTaskUpdate", (id) => {
            if (this.bottomPanel.isOpen && this.bottomPanel.activeTab === 'resources' && this.resourcesPane.selectedTaskId === id) {
                this.loadAndShowResourcesForTask(id);
            }
        });

        // ============= ИНИЦИАЛИЗАЦИЯ (ПОСЛЕДНИЙ ШАГ) =============
        gantt.init("gantt_here");
        this.ensureTodayMarker();
        gantt.render();

        this.isInitialized = true;

        // По умолчанию скрываем детальные сметные колонки
        this.toggleEstimateColumns(false);

        // Контекстное меню (ПКМ: Редактировать/Удалить)
        this.installContextMenu();
    },

    async showAssignWorkTypeModal(floorTask) {
        // Находим blockId (у этажей он должен приходить с бэка, но подстрахуемся и поднимемся по родителям)
        const getBlockId = (task) => {
            if (task.blockId) return task.blockId;
            let current = task;
            const visited = new Set();
            while (current && current.parent && !visited.has(current.parent)) {
                visited.add(current.parent);
                const parent = gantt.getTask(current.parent);
                if (parent && parent.blockId) return parent.blockId;
                current = parent;
            }
            return null;
        };

        const blockId = getBlockId(floorTask);
        if (!blockId) {
            UI.showNotification('Не удалось определить блок для этажа', 'error');
            return;
        }

        UI.showLoading(true, 'Загрузка сметы...');
        let tree;
        try {
            tree = await api.getEstimateTreeForBlock(blockId);
        } catch (e) {
            UI.showLoading(false);
            UI.showNotification('Ошибка загрузки структуры сметы', 'error');
            return;
        } finally {
            UI.showLoading(false);
        }

        const estimates = (tree && tree.estimates) ? tree.estimates : [];
        const hasMultipleEstimates = estimates.length > 1;
        const singleEstimateName = estimates.length === 1 ? (estimates[0].name || '—') : '—';

        const content = `
            <div class="form-group">
                <label>Этаж</label>
                <input type="text" value="${(floorTask.text || '').replace(/\"/g, '&quot;')}" disabled />
            </div>

            ${hasMultipleEstimates ? `
                <div class="form-group">
                    <label>Смета</label>
                    <select id="assign-estimate"></select>
                </div>
            ` : `
                <div class="form-group">
                    <label>Смета</label>
                    <input type="text" value="${String(singleEstimateName).replace(/\"/g, '&quot;')}" disabled />
                </div>
            `}

            <div class="form-group">
                <label>Этап</label>
                <select id="assign-stage"></select>
            </div>
            <div class="form-group">
                <label>Вид работ (общий объем)</label>
                <select id="assign-worktype"></select>
            </div>
            <div class="form-group">
                <label>Объем для этого этажа</label>
                <input type="number" id="assign-qty" step="0.01" min="0" value="0" />
                <div id="assign-unit" style="margin-top: 6px; font-size: 12px; color: var(--gray-600);"></div>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="assign-save-btn">Закрепить</button>
        `;

        UI.showModal('Закрепить вид работ за этажом', content, buttons);

        const $estimate = hasMultipleEstimates ? document.getElementById('assign-estimate') : null;
        const $stage = document.getElementById('assign-stage');
        const $workType = document.getElementById('assign-worktype');
        const $unit = document.getElementById('assign-unit');
        const $qty = document.getElementById('assign-qty');

        const setOptions = (el, options, placeholder = '— выберите —') => {
            el.innerHTML = '';
            const p = document.createElement('option');
            p.value = '';
            p.textContent = placeholder;
            el.appendChild(p);
            for (const opt of options) {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                el.appendChild(o);
            }
        };

        const getSelectedEstimateId = () => {
            if (hasMultipleEstimates) return $estimate.value;
            if (estimates.length === 1) return estimates[0].id;
            return '';
        };

        const findEstimate = () => estimates.find(e => e.id === getSelectedEstimateId());
        const findStage = () => {
            const est = findEstimate();
            const stages = est?.stages || est?.sections?.flatMap(s => s.stages || []) || [];
            return stages.find(st => st.id === $stage.value);
        };
        const findWorkType = () => {
            const st = findStage();
            return st?.workTypes?.find(wt => wt.id === $workType.value);
        };

        if (hasMultipleEstimates) {
            setOptions($estimate, estimates.map(e => ({ value: e.id, label: e.name })));
        }

        const refreshStages = () => {
            const est = findEstimate();
            const stages = est?.stages || est?.sections?.flatMap(s => s.stages || []) || [];
            const sts = stages.map(st => ({ value: st.id, label: st.name }));
            setOptions($stage, sts);
            setOptions($workType, []);
            $unit.textContent = '';

            // Auto-select first stage if available
            if (sts.length === 1) {
                $stage.value = sts[0].value;
                refreshWorkTypes();
            }
        };

        const refreshWorkTypes = () => {
            const st = findStage();
            const wts = (st?.workTypes || []).map(wt => ({
                value: wt.id,
                label: `${wt.name} — ${wt.quantity || 0} ${wt.unit || ''}`.trim()
            }));
            setOptions($workType, wts);
            $unit.textContent = '';

            // Auto-select first work type if available
            if (wts.length === 1) {
                $workType.value = wts[0].value;
                refreshUnit();
            }
        };

        const refreshUnit = () => {
            const wt = findWorkType();
            if (!wt) {
                $unit.textContent = '';
                return;
            }
            $unit.textContent = `Ед. изм.: ${wt.unit || '—'} | Общий объем: ${wt.quantity || 0}`;
        };

        if (hasMultipleEstimates) {
            $estimate.addEventListener('change', refreshStages);
        }
        $stage.addEventListener('change', refreshWorkTypes);
        $workType.addEventListener('change', refreshUnit);

        // Инициализация: выбрать первый доступный уровень, чтобы сразу заполнить каскад
        if (estimates.length === 0) {
            setOptions($stage, []);
            setOptions($workType, []);
        } else if (hasMultipleEstimates) {
            $estimate.value = estimates[0].id;
            refreshStages();
        } else {
            refreshStages();
        }

        document.getElementById('assign-save-btn').addEventListener('click', async () => {
            const wt = findWorkType();
            if (!wt) {
                UI.showNotification('Выберите вид работ', 'error');
                return;
            }
            const q = parseFloat($qty.value);
            if (!Number.isFinite(q) || q < 0) {
                UI.showNotification('Введите корректный объем', 'error');
                return;
            }

            try {
                UI.showLoading(true);
                await api.assignWorkTypeToFloor(ScheduleManager.currentProjectId, floorTask.id, wt.id, q, 'set');
                UI.closeModal();
                await ScheduleManager.loadData();
                UI.showNotification('Вид работ закреплен за этажом', 'success');
            } catch (e) {
                console.error(e);
                UI.showNotification('Ошибка закрепления вида работ', 'error');
            } finally {
                UI.showLoading(false);
            }
        });
    },

    async showWorkDistributionWizard() {
        if (!this.currentProjectId) {
            UI.showNotification('Сначала выберите проект', 'error');
            return;
        }

        // Styles (scoped)
        if (!document.getElementById('work-distribution-styles')) {
            const style = document.createElement('style');
            style.id = 'work-distribution-styles';
            style.innerHTML = `
                .wdw { display: flex; gap: 12px; height: 70vh; }
                .wdw-panel { flex: 1; border: 1px solid var(--gray-300); border-radius: 8px; background: var(--white); display: flex; flex-direction: column; min-width: 0; }
                .wdw-head { padding: 10px 12px; border-bottom: 1px solid var(--gray-300); font-weight: 600; }
                .wdw-body { padding: 8px; overflow: auto; }
                .wdw-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 6px; cursor: pointer; }
                .wdw-item:hover { background: var(--gray-100); }
                .wdw-item.active { background: var(--primary-light); }
                .wdw-item.disabled { opacity: 0.55; cursor: not-allowed; }
                .wdw-sub { margin-left: 18px; margin-top: 4px; }
                .wdw-row { display: flex; align-items: center; gap: 8px; }
                .wdw-muted { color: var(--gray-600); font-size: 12px; }
                .wdw-stage { border: 1px solid var(--gray-300); border-radius: 8px; margin-bottom: 8px; }
                .wdw-stage-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; cursor: pointer; background: var(--gray-50); }
                .wdw-stage-body { padding: 6px 10px; }
                .wdw-wt { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; }
                .wdw-wt label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
                .wdw-btn-link { background: transparent; border: none; color: var(--primary); cursor: pointer; font-size: 12px; padding: 0; }
                .wdw-btn-link:disabled { opacity: 0.6; cursor: not-allowed; }

                /* Block Group Styles */
                .block-group { border-bottom: 1px solid var(--gray-300); }
                .block-group-header { padding: 10px 12px; background: var(--gray-100); font-weight: 600; font-size: 13px; color: var(--gray-900); border-bottom: 1px solid var(--gray-200); cursor: pointer; display: flex; align-items: center; gap: 8px; user-select: none; transition: background 0.15s; }
                .block-group-header:hover { background: var(--gray-200); }
                .block-group-header .chevron { width: 16px; height: 16px; transition: transform 0.2s; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
                .block-group-header .chevron svg { width: 100%; height: 100%; }
                .block-group-header.collapsed .chevron { transform: rotate(-90deg); }
                .block-estimates { overflow: hidden; transition: max-height 0.3s ease-out; }
                .block-estimates.collapsed { max-height: 0 !important; }
                .estimate-item { padding: 8px 12px 8px 24px; cursor: pointer; border-bottom: 1px solid var(--gray-200); font-size: 12px; color: var(--gray-700); transition: background 0.1s; }
                .estimate-item:hover { background: var(--gray-100); color: var(--gray-900); }
                .estimate-item.active { background: var(--primary-lighter); color: var(--primary); font-weight: 500; }

                /* Table Styles for Content */
                .wdw-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
                .wdw-table th { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--gray-300); background: var(--gray-50); color: var(--gray-600); font-weight: 500; position: sticky; top: 0; z-index: 10; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .wdw-table td { padding: 8px 12px; border-bottom: 1px solid var(--gray-200); vertical-align: top; word-wrap: break-word; }
                .wdw-table tr:last-child td { border-bottom: none; }
                .wdw-table .stage-header-row { background: var(--gray-100); cursor: pointer; user-select: none; }
                .wdw-table .stage-header-row:hover { background: var(--gray-200); }
                .wdw-table .stage-header-cell { font-weight: 600; color: var(--gray-800); display: flex; align-items: center; gap: 8px; }
                .wdw-table .chevron { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
                .wdw-table .stage-header-row.collapsed .chevron { transform: rotate(-90deg); }
                .wdw-table .select-all-btn { margin-left: auto; font-size: 11px; color: var(--primary); background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
                .wdw-table .select-all-btn:hover { background: rgba(var(--primary-rgb), 0.1); }
                .wdw-table .row-disabled { opacity: 0.5; background: var(--gray-50); }
            `;
            document.head.appendChild(style);
        }

        UI.showLoading(true, 'Загрузка данных...');
        let sources;
        try {
            const pid = this.currentProjectId || ScheduleManager.currentProjectId;
            if (!pid) {
                console.error('[WDW] No project ID found');
                throw new Error('Project ID not set');
            }
            sources = await api.getAssignmentSources(pid);
            console.log('[WDW] Sources loaded:', sources);
        } catch (e) {
            console.error('[WDW] Init error:', e);
            UI.showLoading(false);
            UI.showNotification('Ошибка загрузки данных: ' + (e.message || 'Неизвестная ошибка'), 'error');
            return;
        } finally {
            UI.showLoading(false);
        }

        const content = `
            <div class="wdw">
                <div class="wdw-panel" style="flex: 0 0 280px;">
                    <div class="wdw-head">Источник данных</div>
                    <div class="wdw-body" id="wdw-source" style="padding: 0;"></div>
                </div>

                <div class="wdw-panel" style="flex: 1;">
                    <div class="wdw-head">Состав работ</div>
                    <div class="wdw-body" id="wdw-content"></div>
                </div>

                <div class="wdw-panel" style="flex: 0 0 280px;">
                    <div class="wdw-head">Целевое назначение</div>
                    <div class="wdw-body" id="wdw-target"></div>
                </div>
            </div>
            <div class="wdw-muted" style="margin-top: 10px;">
                Выберите блок и смету слева, отметьте виды работ и этажи, затем сохраните.
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="wdw-save" disabled>Распределить</button>
        `;

        UI.showModal('Распределение работ по этажам', content, buttons, {
            width: '98vw',
            maxWidth: '1800px',
            maxHeight: '92vh'
        });

        const state = {
            blocks: sources.blocks || [],
            activeBlockId: null,
            activeEstimateId: null,
            estimateData: null,
            selectedWorkTypeIds: new Set(),
            selectedFloorIds: new Set(),
            stageExpanded: new Set(),
            blockExpanded: new Set(),
        };

        const $source = document.getElementById('wdw-source');
        const $content = document.getElementById('wdw-content');
        const $target = document.getElementById('wdw-target');
        const $save = document.getElementById('wdw-save');

        const getFloorsByBlock = () => {
            const data = gantt.serialize().data || [];
            const floors = data.filter(t => (t.id || '').toString().startsWith('floor-'));
            const map = new Map();
            for (const f of floors) {
                const bId = f.blockId || null;
                if (!map.has(bId)) map.set(bId, []);
                map.get(bId).push(f);
            }
            for (const [k, arr] of map.entries()) {
                arr.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            }
            return map;
        };

        const recalcSaveEnabled = () => {
            const ok = !!state.activeBlockId && !!state.activeEstimateId && state.selectedWorkTypeIds.size > 0 && state.selectedFloorIds.size > 0;
            $save.disabled = !ok;
        };

        const renderSource = () => {
            const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';

            $source.innerHTML = state.blocks.map(block => {
                const isExpanded = state.blockExpanded.has(block.id);
                const estimates = block.estimates || [];
                const maxHeight = isExpanded ? (estimates.length * 40 + 20) + 'px' : '0';

                return `
                    <div class="block-group" data-block-id="${block.id}">
                        <div class="block-group-header ${!isExpanded ? 'collapsed' : ''}" data-block-id="${block.id}">
                            <span class="chevron">${chevronSvg}</span>
                            <span>${block.name}</span>
                            <span style="margin-left:auto; font-size:11px; color:var(--gray-500); font-weight:400;">Смет: ${estimates.length}</span>
                        </div>
                        <div class="block-estimates ${!isExpanded ? 'collapsed' : ''}" style="max-height: ${maxHeight}">
                            ${estimates.map(est => `
                                <div class="estimate-item ${state.activeEstimateId === est.id ? 'active' : ''}" 
                                     data-block-id="${block.id}" 
                                     data-estimate-id="${est.id}">
                                    ${est.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            // Attach listeners
            $source.querySelectorAll('.block-group-header').forEach(el => {
                el.onclick = () => {
                    const bId = el.dataset.blockId;
                    if (state.blockExpanded.has(bId)) {
                        state.blockExpanded.delete(bId);
                    } else {
                        state.blockExpanded.add(bId);
                    }
                    renderSource();
                };
            });

            $source.querySelectorAll('.estimate-item').forEach(el => {
                el.onclick = async () => {
                    const bId = el.dataset.blockId;
                    const eId = el.dataset.estimateId;
                    state.activeBlockId = bId;
                    state.activeEstimateId = eId;
                    state.selectedWorkTypeIds.clear();
                    state.stageExpanded.clear();
                    renderSource();
                    await loadEstimateData();
                    renderContent();
                    renderTarget();
                    recalcSaveEnabled();
                };
            });
        };

        const loadEstimateData = async () => {
            if (!state.activeBlockId || !state.activeEstimateId) {
                state.estimateData = null;
                return;
            }
            UI.showLoading(true, 'Загрузка состава работ...');
            try {
                state.estimateData = await api.getAssignmentEstimate(this.currentProjectId, state.activeBlockId, state.activeEstimateId);
            } catch (e) {
                console.error(e);
                UI.showNotification('Ошибка загрузки состава работ', 'error');
                state.estimateData = null;
            } finally {
                UI.showLoading(false);
            }
        };

        const renderContent = () => {
            $content.innerHTML = '';
            if (!state.activeEstimateId || !state.estimateData) {
                $content.innerHTML = `<div class="wdw-muted" style="padding: 12px;">Выберите смету в левом окне.</div>`;
                return;
            }

            const stages = state.estimateData.stages || [];
            if (stages.length === 0) {
                $content.innerHTML = `<div class="wdw-muted" style="padding: 12px;">В смете нет этапов.</div>`;
                return;
            }

            const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';

            let html = `
                <table class="wdw-table">
                    <thead>
                        <tr>
                            <th style="width: 30px;"></th>
                            <th style="width: 40px;">№</th>
                            <th style="width: 80px;">Шифр</th>
                            <th>Наименование работ</th>
                            <th style="width: 60px;">Ед.изм</th>
                            <th style="width: 80px; text-align: right;">Кол-во</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            stages.forEach(stage => {
                const expanded = state.stageExpanded.has(stage.id);

                html += `
                    <tr class="stage-header-row ${!expanded ? 'collapsed' : ''}" data-stage-id="${stage.id}">
                        <td colspan="6">
                            <div class="stage-header-cell">
                                <span class="chevron">${chevronSvg}</span>
                                <span>${stage.name}</span>
                                <button class="select-all-btn" data-stage-id="${stage.id}">Выбрать все</button>
                            </div>
                        </td>
                    </tr>
                `;

                if (expanded) {
                    (stage.workTypes || []).forEach(wt => {
                        const remaining = Number(wt.remainingQty || 0);
                        const unit = wt.unit || '';
                        const disabled = remaining <= 0;
                        const checked = state.selectedWorkTypeIds.has(wt.id);
                        const code = wt.code || '';
                        const cipher = wt.cipher || '';

                        html += `
                            <tr class="${disabled ? 'row-disabled' : ''}">
                                <td style="text-align: center;">
                                    <input type="checkbox" class="wt-checkbox" 
                                        data-wt-id="${wt.id}" 
                                        ${checked ? 'checked' : ''} 
                                        ${disabled ? 'disabled' : ''} />
                                </td>
                                <td style="font-size: 11px; color: var(--gray-600);">${code}</td>
                                <td style="font-size: 11px; color: var(--gray-600);">${cipher}</td>
                                <td style="white-space: normal; line-height: 1.3;">${wt.name}</td>
                                <td style="font-size: 11px; color: var(--gray-600);">${unit}</td>
                                <td style="text-align: right;">${remaining}</td>
                            </tr>
                        `;
                    });
                }
            });

            html += `</tbody></table>`;
            $content.innerHTML = html;

            // Attach listeners
            $content.querySelectorAll('.stage-header-row').forEach(row => {
                row.onclick = (e) => {
                    // Don't trigger if clicked on button
                    if (e.target.closest('.select-all-btn')) return;

                    const sId = row.dataset.stageId;
                    if (state.stageExpanded.has(sId)) state.stageExpanded.delete(sId);
                    else state.stageExpanded.add(sId);
                    renderContent();
                };
            });

            $content.querySelectorAll('.select-all-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const sId = btn.dataset.stageId;
                    const stage = stages.find(s => s.id == sId);
                    if (stage) {
                        stage.workTypes.forEach(wt => {
                            if ((wt.remainingQty || 0) > 0) {
                                state.selectedWorkTypeIds.add(wt.id);
                            }
                        });
                        renderContent();
                        recalcSaveEnabled();
                    }
                };
            });

            $content.querySelectorAll('.wt-checkbox').forEach(cb => {
                cb.onchange = () => {
                    const wtId = cb.dataset.wtId;
                    if (cb.checked) state.selectedWorkTypeIds.add(wtId);
                    else state.selectedWorkTypeIds.delete(wtId);
                    recalcSaveEnabled();
                };
            });
        };

        const renderTarget = () => {
            $target.innerHTML = '';

            if (!state.activeBlockId) {
                $target.innerHTML = `<div class="wdw-muted" style="padding: 12px;">Выберите блок слева, чтобы выбрать этажи.</div>`;
                return;
            }

            const block = state.blocks.find(b => b.id === state.activeBlockId);
            if (!block) return;

            // Генерируем список этажей на основе параметров блока
            const floors = [];
            const underground = block.undergroundFloors || 0;
            const aboveground = block.floors || 1;

            // Подземные этажи (от -N до -1)
            for (let i = underground; i >= 1; i--) {
                floors.push({
                    id: `floor-${block.id}-minus-${i}`,
                    text: `Этаж -${i}`,
                    sortOrder: -i
                });
            }

            // Надземные этажи (от 1 до N)
            for (let i = 1; i <= aboveground; i++) {
                floors.push({
                    id: `floor-${block.id}-${i}`,
                    text: `Этаж ${i}`,
                    sortOrder: i
                });
            }

            const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';

            if (!state.targetExpanded) state.targetExpanded = new Set(['floors-group']);
            const expanded = state.targetExpanded.has('floors-group');

            let html = `
                <table class="wdw-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;"></th>
                            <th>Наименование</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="stage-header-row ${!expanded ? 'collapsed' : ''}" id="target-floors-header">
                            <td colspan="2">
                                <div class="stage-header-cell">
                                    <span class="chevron">${chevronSvg}</span>
                                    <span>Этажи (${floors.length})</span>
                                    <button class="select-all-btn" id="target-select-all">Выбрать все</button>
                                </div>
                            </td>
                        </tr>
            `;

            if (expanded) {
                if (floors.length === 0) {
                    html += `
                        <tr>
                            <td colspan="2" class="wdw-muted" style="text-align:center; padding: 12px;">
                                Нет этажей в параметрах блока.
                            </td>
                        </tr>
                    `;
                } else {
                    floors.forEach(floor => {
                        const checked = state.selectedFloorIds.has(floor.id);
                        html += `
                            <tr>
                                <td style="text-align: center;">
                                    <input type="checkbox" class="floor-checkbox" 
                                        data-floor-id="${floor.id}" 
                                        ${checked ? 'checked' : ''} />
                                </td>
                                <td>${floor.text}</td>
                            </tr>
                        `;
                    });
                }
            }

            html += `</tbody></table>`;
            $target.innerHTML = html;

            // Listeners
            const header = $target.querySelector('#target-floors-header');
            if (header) {
                header.onclick = (e) => {
                    if (e.target.closest('.select-all-btn')) return;
                    if (state.targetExpanded.has('floors-group')) state.targetExpanded.delete('floors-group');
                    else state.targetExpanded.add('floors-group');
                    renderTarget();
                };
            }

            const btnSelectAll = $target.querySelector('#target-select-all');
            if (btnSelectAll) {
                btnSelectAll.onclick = (e) => {
                    e.stopPropagation();
                    floors.forEach(f => state.selectedFloorIds.add(f.id));
                    renderTarget();
                    recalcSaveEnabled();
                };
            }

            $target.querySelectorAll('.floor-checkbox').forEach(cb => {
                cb.onchange = () => {
                    const fId = cb.dataset.floorId;
                    if (cb.checked) state.selectedFloorIds.add(fId);
                    else state.selectedFloorIds.delete(fId);
                    recalcSaveEnabled();
                };
            });
        };

        const getSelectedWorkTypes = () => {
            const map = new Map();
            const stages = state.estimateData?.stages || [];
            for (const st of stages) {
                for (const wt of (st.workTypes || [])) {
                    map.set(wt.id, wt);
                }
            }
            return Array.from(state.selectedWorkTypeIds).map(id => map.get(id)).filter(Boolean);
        };

        $save.addEventListener('click', async () => {
            if ($save.disabled) return;

            const floors = Array.from(state.selectedFloorIds);

            if (!state.activeBlockId || !state.activeEstimateId) {
                UI.showNotification('Выберите блок и смету', 'error');
                return;
            }

            if (floors.length === 0 || state.selectedWorkTypeIds.size === 0) {
                UI.showNotification('Выберите виды работ и этажи', 'error');
                return;
            }

            // Распределяем по ровну остаток на выбранные этажи
            try {
                const pid = ScheduleManager.currentProjectId;
                if (!pid) throw new Error('Project ID lost');

                UI.showLoading(true, 'Проверка остатков...');

                // Всегда переполучаем актуальные остатки перед записью
                const latest = await api.getAssignmentEstimate(pid, state.activeBlockId, state.activeEstimateId);
                state.estimateData = latest;
                const wts = getSelectedWorkTypes();

                const noRemaining = wts.filter(wt => Number(wt.remainingQty || 0) <= 0);
                if (noRemaining.length > 0) {
                    UI.showNotification('Для некоторых видов работ нет остатка объема', 'error');
                    return;
                }

                UI.showLoading(true, 'Распределение...');
                for (const wt of wts) {
                    const remaining = Number(wt.remainingQty || 0);
                    const base = remaining / floors.length;

                    // Предварительно рассчитываем округленные значения так, чтобы сумма == remaining
                    const quantities = [];
                    let sum = 0;
                    for (let i = 0; i < floors.length; i++) {
                        let q = (i === floors.length - 1) ? (remaining - sum) : base;
                        q = Math.round(q * 100) / 100;
                        if (q < 0) q = 0;
                        quantities.push(q);
                        sum = Math.round((sum + q) * 100) / 100;
                    }

                    if (sum - remaining > 0.01) {
                        UI.showNotification('Назначенный объем превышает остаток. Операция отменена.', 'error');
                        return;
                    }

                    for (let i = 0; i < floors.length; i++) {
                        const floorId = floors[i];
                        const q = quantities[i];
                        await api.assignWorkTypeToFloor(ScheduleManager.currentProjectId, floorId, wt.id, q, 'add');
                    }
                }

                await ScheduleManager.loadData();
                UI.closeModal();
                UI.showNotification('Распределение выполнено', 'success');
            } catch (e) {
                console.error(e);
                UI.showNotification('Ошибка распределения', 'error');
            } finally {
                UI.showLoading(false);
            }
        });

        // Initial render
        renderSource();
        renderContent();
        renderTarget();
        recalcSaveEnabled();
    },

    setScale(scale) {
        switch (scale) {
            case "day":
                // День: Сверху Месяц+Год, снизу Дни (как в Primavera)
                gantt.config.scale_unit = "month";
                gantt.config.date_scale = "%F %Y";
                gantt.config.subscales = [
                    { unit: "day", step: 1, date: "%d" }
                ];
                gantt.config.scale_height = 50;
                gantt.config.min_column_width = 30;
                break;
            case "week":
                // Неделя: Сверху Месяц+Год, снизу Недели
                gantt.config.scale_unit = "month";
                gantt.config.date_scale = "%F %Y";
                gantt.config.subscales = [
                    { unit: "week", step: 1, date: "Нед. %W" }
                ];
                gantt.config.scale_height = 50;
                gantt.config.min_column_width = 60;
                break;
            case "month":
                // Месяц (по умолчанию): Сверху Месяц+Год, снизу Дни (как в Primavera P6)
                gantt.config.scale_unit = "month";
                gantt.config.date_scale = "%F %Y";
                gantt.config.subscales = [
                    { unit: "day", step: 1, date: "%d" }
                ];
                gantt.config.scale_height = 50;
                gantt.config.min_column_width = 25;
                break;
            case "year":
                // Год: Сверху Год, снизу Месяцы
                gantt.config.scale_unit = "year";
                gantt.config.date_scale = "%Y";
                gantt.config.subscales = [
                    { unit: "month", step: 1, date: "%M" }
                ];
                gantt.config.scale_height = 50;
                gantt.config.min_column_width = 50;
                break;
        }
        gantt.render();
    },

    async loadData() {
        try {
            gantt.clearAll();
            const data = await api.getGanttData(this.currentProjectId);

            if (data.data && data.data.length > 0) {
                gantt.parse(data);
                this.ensureTodayMarker();
                // Подтягиваем даты родителей сразу после загрузки
                await this.rollupAllParents();
                this.populateFilters();
            } else {
                UI.showNotification('График пуст. Нажмите "Сформировать из сметы"', 'info');
                this.ensureTodayMarker();
            }
        } catch (error) {
            console.error('Error loading gantt data:', error);
            UI.showNotification('Ошибка загрузки графика', 'error');
        }
    },


    async clearSchedule() {
        if (!confirm('Вы уверены, что хотите полностью очистить график? Это действие нельзя отменить.')) {
            return;
        }

        try {
            UI.showLoading(true);
            await api.clearGanttSchedule(this.currentProjectId);
            gantt.clearAll();
            UI.showNotification('График очищен', 'success');
        } catch (error) {
            console.error('Error clearing schedule:', error);
            UI.showNotification('Ошибка очистки графика: ' + error.message, 'error');
        } finally {
            UI.showLoading(false);
        }
    },

    initFilters() {
        const filterBtn = document.getElementById('schedule-filter-btn');
        const dropdown = document.getElementById('schedule-filter-dropdown');
        const resetBtn = document.getElementById('schedule-filter-reset-btn');
        const applyBtn = document.getElementById('schedule-filter-apply-btn');

        if (!filterBtn || !dropdown) return;

        filterBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        if (resetBtn) {
            resetBtn.onclick = () => {
                this.filters.sections = [];
                this.filters.floors = [];
                this.populateFilters();
                if (typeof gantt !== 'undefined') {
                    gantt.render();
                }
                dropdown.classList.add('hidden');
            };
        }

        if (applyBtn) {
            applyBtn.onclick = () => {
                const sectionChecks = document.querySelectorAll('#filter-sections-list input[type="checkbox"]:checked');
                const floorChecks = document.querySelectorAll('#filter-floors-list input[type="checkbox"]:checked');

                // If all are checked, we treat it as no filter
                const allSections = document.querySelectorAll('#filter-sections-list input[type="checkbox"]');
                const allFloors = document.querySelectorAll('#filter-floors-list input[type="checkbox"]');

                if (sectionChecks.length === allSections.length) {
                    this.filters.sections = [];
                } else {
                    this.filters.sections = Array.from(sectionChecks).map(c => c.value);
                }

                if (floorChecks.length === allFloors.length) {
                    this.filters.floors = [];
                } else {
                    this.filters.floors = Array.from(floorChecks).map(c => c.value);
                }

                if (typeof gantt !== 'undefined') {
                    gantt.render();
                }
                dropdown.classList.add('hidden');
            };
        }
    },

    populateFilters() {
        if (typeof gantt === 'undefined') return;

        const sectionsMap = new Map();
        const floorsMap = new Map();

        gantt.eachTask((task) => {
            if (!task) return;
            const text = task.text || '';

            // Only consider project types for filters (Queue, Section, Floor)
            if (task.type !== 'project') return;

            const isSection = (text.includes('Секция') || text.includes('Блок')) && !text.includes('Этаж');
            const isFloor = text.includes('Этаж') || text.match(/Level|Storey/i);

            if (isSection) {
                sectionsMap.set(text, text);
            } else if (isFloor) {
                floorsMap.set(text, text);
            }
        });

        const sectionsList = document.getElementById('filter-sections-list');
        const floorsList = document.getElementById('filter-floors-list');

        if (sectionsList) {
            if (sectionsMap.size === 0) {
                sectionsList.innerHTML = '<div style="padding: 4px 8px; color: var(--gray-400); font-size: 12px;">Секции не найдены</div>';
            } else {
                const sorted = Array.from(sectionsMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                sectionsList.innerHTML = sorted.map(name => `
                    <label class="dropdown-item">
                        <input type="checkbox" value="${this.escapeHtml(name)}" ${this.filters.sections.includes(name) || this.filters.sections.length === 0 ? 'checked' : ''}>
                        <span class="dropdown-label">${this.escapeHtml(name)}</span>
                    </label>
                `).join('');
            }
        }

        if (floorsList) {
            if (floorsMap.size === 0) {
                floorsList.innerHTML = '<div style="padding: 4px 8px; color: var(--gray-400); font-size: 12px;">Этажи не найдены</div>';
            } else {
                const sorted = Array.from(floorsMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                floorsList.innerHTML = sorted.map(name => `
                    <label class="dropdown-item">
                        <input type="checkbox" value="${this.escapeHtml(name)}" ${this.filters.floors.includes(name) || this.filters.floors.length === 0 ? 'checked' : ''}>
                        <span class="dropdown-label">${this.escapeHtml(name)}</span>
                    </label>
                `).join('');
            }
        }
    }
};
window.ScheduleManager = ScheduleManager;
