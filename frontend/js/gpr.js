// ========================================
// GPR Manager - ГПР (DHTMLX Gantt) - Separate Tab
// ========================================

const GPRManager = {
    version: '20251230-2',
    currentProjectId: null,
    isInitialized: false,
    todayMarkerId: null,

    // Bottom panel state
    bottomPanel: {
        activeTab: 'resources',
        isOpen: false,
    },

    /**
     * Helper to escape HTML to prevent XSS
     */
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Helper to format numbers
     */
    formatQty(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    },

    /**
     * Extract workTypeId from composite taskId (worktype-<wtId>-floor-<floorId>)
     */
    extractWorkTypeIdFromTaskId(taskId) {
        const id = String(taskId ?? '');
        if (!id.startsWith('worktype-')) return null;
        const rest = id.slice('worktype-'.length);
        const idx = rest.indexOf('-floor-');
        if (idx > 0) return rest.slice(0, idx);

        // Fallback for UUID prefix
        if (rest.length >= 36) return rest.slice(0, 36);
        return null;
    },

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async init(projectId) {
        console.log('GPRManager.init for project:', projectId);
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

        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        // Reset content area with a fresh skeleton
        contentArea.innerHTML = `
            <div class="schedule-root" style="height: 100%; display: flex; flex-direction: column;">
                <div class="toolbar" style="padding: 8px 24px; border-bottom: 1px solid var(--gray-300); display: flex; justify-content: space-between; align-items: center; background: #fff; flex-shrink: 0;">
                    <div class="gantt-legend">
                        <div class="legend-item"><span class="legend-swatch phase"></span><span>Очередь</span></div>
                        <div class="legend-item"><span class="legend-swatch block"></span><span>Блок</span></div>
                        <div class="legend-item"><span class="legend-swatch floor"></span><span>Этаж</span></div>
                    </div>

                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="font-size: 13px; color: var(--gray-600);">Масштаб:</span>
                        <select onchange="GPRManager.setScale(this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--gray-300); font-size: 13px;">
                            <option value="day">День</option>
                            <option value="week">Неделя</option>
                            <option value="month" selected>Месяц</option>
                            <option value="year">Год</option>
                        </select>
                    </div>
                </div>
                <div class="schedule-main" style="flex: 1; position: relative; min-height: 0;">
                    <div id="gpr_gantt_here" style="width: 100%; height: 100%;"></div>
                </div>
            </div>
            <div id="gpr-bottom" class="schedule-bottom-panel">
                <div class="schedule-bottom-header">
                    <div class="schedule-bottom-tabs">
                        <button type="button" class="schedule-bottom-tab active" data-tab="resources">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
                            <span>Ресурсы</span>
                        </button>
                    </div>
                    <button type="button" class="schedule-bottom-toggle">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </button>
                </div>
                <div class="schedule-bottom-content">
                    <div class="schedule-bottom-pane active" data-pane="resources">
                        <div style="color: var(--gray-500); text-align: center; padding: 20px;">Выберите вид работ, чтобы увидеть ресурсы</div>
                    </div>
                </div>
            </div>
        `;

        this.initBottomPanel();
        this.initGantt();
        await this.loadData();
    },

    initBottomPanel() {
        const bottom = document.getElementById('gpr-bottom');
        if (!bottom) return;

        bottom.querySelector('.schedule-bottom-toggle').onclick = () => {
            this.setBottomPanelState(!this.bottomPanel.isOpen);
        };

        bottom.querySelectorAll('.schedule-bottom-tab').forEach(btn => {
            btn.onclick = () => {
                const tab = btn.dataset.tab;
                this.bottomPanel.activeTab = tab;
                this.setBottomPanelState(true);
            };
        });
    },

    setBottomPanelState(isOpen) {
        const bottom = document.getElementById('gpr-bottom');
        if (!bottom) return;
        this.bottomPanel.isOpen = isOpen;
        bottom.classList.toggle('is-open', isOpen);
    },

    initGantt() {
        console.log('GPRManager.initGantt...');

        // Reset global gantt state
        gantt.clearAll();
        // Reset some common configs that might be set by ScheduleManager
        gantt.templates.grid_row_class = null;
        gantt.templates.task_row_class = null;
        gantt.templates.task_class = null;

        // Global Localization (Russian)
        if (gantt.i18n) gantt.i18n.setLocale("ru");

        // Plugins
        gantt.plugins({
            marker: true,
            tooltip: true,
            critical_path: true
        });

        // Config
        gantt.config.date_format = "%Y-%m-%d %H:%i";
        gantt.config.xml_date = "%Y-%m-%d %H:%i";
        gantt.config.readonly = false;
        gantt.config.order_branch = true;
        gantt.config.open_tree_initially = true;
        gantt.config.scale_height = 50;
        gantt.config.grid_width = 900;
        gantt.config.root_id = 0; // Use numeric 0 for root

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

        const durationTypeLabels = {
            fixed_units: "Фикс. Объем",
            fixed_duration: "Фикс. Срок",
            fixed_intensity: "Фикс. Интесив.",
            fixed_units_time: "Фикс. Ресурс"
        };
        const durationTypeOptions = [
            { key: "fixed_units", label: "Фиксированный Объем (Units)" },
            { key: "fixed_duration", label: "Фиксированный Срок (Duration)" },
            { key: "fixed_intensity", label: "Фиксированная Интенсивность" }
        ];

        // Define Columns
        gantt.config.columns = [
            { name: "text", label: "Наименование", tree: true, width: 250, resize: true },
            { name: "start_date", label: "Начало", align: "center", width: 90, resize: true },
            { name: "duration", label: "Длит.", align: "center", width: 50, resize: true },
            { name: "plannedWork", label: "Трудозат. (ч/ч)", align: "right", width: 90, resize: true, template: (t) => t.plannedWork ? Math.round(t.plannedWork * 10) / 10 : '—' },
            {
                name: "resourceIntensity", label: "Ресурс (ч/д)", align: "right", width: 110, resize: true, template: (t) => {
                    if (!t.resourceIntensity) return '—';
                    const shift = GPRManager.projectSettings?.shiftDuration || 8;
                    const people = Math.round(t.resourceIntensity / shift * 10) / 10;
                    return `${Math.round(t.resourceIntensity * 10) / 10} (${people} чел)`;
                }
            },
            { name: "durationType", label: "Режим", align: "center", width: 100, resize: true, template: (t) => durationTypeLabels[t.durationType] || "Фикс. Срок" },
            { name: "quantity", label: "Объем (физ)", align: "right", width: 80, resize: true },
            { name: "unit", label: "Ед.", align: "center", width: 50, resize: true },
            { name: "add", label: "", width: 44 }
        ];

        // Lightbox (Edit Modal)
        gantt.config.lightbox.sections = [
            { name: "description", height: 70, map_to: "text", type: "textarea", focus: true },
            { name: "type", type: "typeselect", map_to: "type" },
            {
                name: "scheduling", height: 110, type: "template", map_to: "my_template", template: (id, task) => {
                    const shift = GPRManager.projectSettings?.shiftDuration || 8;
                    const peopleCount = ((task.resourceIntensity || 8) / shift).toFixed(1);
                    return `
                    <div class="gantt-lightbox-scheduling" style="padding: 10px; background: #f8f9fa; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="grid-column: span 2;">
                            <label style="display:block; font-size:11px; color:#666">Режим планирования</label>
                            <select id="lb_durationType" style="width:100%; padding:4px; border: 1px solid #ccc; border-radius:4px;">
                                ${durationTypeOptions.map(o => `<option value="${o.key}" ${task.durationType === o.key ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; color:#666">Трудозатраты (чел-час)</label>
                            <input id="lb_plannedWork" type="number" step="0.1" value="${task.plannedWork || 0}" style="width:100%; padding:4px; border: 1px solid #ccc; border-radius:4px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; color:#666">Длительность смены (ч)</label>
                            <input id="lb_shiftDuration" type="number" readonly value="${shift}" style="width:100%; padding:4px; border: 1px solid #ccc; border-radius:4px; background:#eee; cursor:not-allowed;">
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; color:#666; font-weight:bold; color:var(--primary);">Кол-во рабочих</label>
                            <input id="lb_peopleCount" type="number" step="0.1" value="${peopleCount}" style="width:100%; padding:4px; border: 2px solid var(--primary); border-radius:4px;" 
                                oninput="document.getElementById('lb_resourceIntensity').value = (this.value * ${shift}).toFixed(1)">
                        </div>
                        <div>
                            <label style="display:block; font-size:11px; color:#666">Интенсивность (ч-ч/день)</label>
                            <input id="lb_resourceIntensity" type="number" step="0.1" value="${task.resourceIntensity || 8}" style="width:100%; padding:4px; border: 1px solid #ccc; border-radius:4px;" 
                                oninput="document.getElementById('lb_peopleCount').value = (this.value / ${shift}).toFixed(1)">
                        </div>
                    </div>
                `;
                }
            },
            { name: "time", type: "duration", map_to: "auto" }
        ];

        // Capture values from custom lightbox fields on save
        gantt.attachEvent("onLightboxSave", (id, task, is_new) => {
            const mode = document.getElementById("lb_durationType")?.value;
            const work = parseFloat(document.getElementById("lb_plannedWork")?.value);
            const intensity = parseFloat(document.getElementById("lb_resourceIntensity")?.value);

            if (mode) task.durationType = mode;
            if (!isNaN(work)) task.plannedWork = work;
            if (!isNaN(intensity)) task.resourceIntensity = intensity;

            return true;
        });

        // Row Classes (IMPORTANT: Matches gantt-colors.css)
        const rowClass = (start, end, task) => {
            if (task.type === 'project') {
                const idStr = String(task.id);
                if (idStr.startsWith('phase-')) return 'row_phase';
                if (idStr.startsWith('block-')) return 'row_block';
                if (idStr.startsWith('floor-')) return 'row_floor';

                // Fallback by name heuristics for project-typed tasks
                if (task.text.includes('Очередь')) return 'row_phase';
                if (task.text.includes('Блок')) return 'row_block';
                if (task.text.includes('Этаж')) return 'row_floor';

                return 'row_stage';
            }
            return 'row_task';
        };

        gantt.templates.grid_row_class = rowClass;
        gantt.templates.task_row_class = rowClass;

        // Task Bar Class
        gantt.templates.task_class = (start, end, task) => {
            if (task.type === 'project') return 'gantt-project-bar';
            return 'gantt-task-bar';
        };

        // Events
        gantt.attachEvent("onAfterTaskUpdate", async (id, task) => {
            try {
                await api.updateGanttTask(id, {
                    text: task.text,
                    start_date: task.start_date,
                    duration: task.duration,
                    progress: task.progress,
                    parent: task.parent,
                    quantity: task.quantity,
                    unit: task.unit,
                    plannedWork: task.plannedWork,
                    resourceIntensity: task.resourceIntensity,
                    durationType: task.durationType
                });
                // Reload to see the results of backend calculations
                // (Optional: we could avoid full reload if we trust the triangle logic on front, 
                // but for now, full reload ensures consistency)
                await this.loadData();
            } catch (error) {
                console.error('Failed to sync task:', error);
                UI.showNotification('Ошибка при сохранении задачи', 'error');
            }
        });

        gantt.attachEvent("onTaskClick", (id, e) => {
            const target = e?.target;
            const isAddCell = target?.classList?.contains('gantt_add') || target?.closest('.gantt_add');

            if (!isAddCell) {
                this.loadAndShowResourcesForTask(id);
            }
            return true;
        });

        // Initialize Gantt in the new container
        gantt.init("gpr_gantt_here");
        this.ensureTodayMarker();
        this.isInitialized = true;
    },

    // ============================================================
    // DATA LOADING
    // ============================================================

    async loadData() {
        if (!this.currentProjectId) {
            console.error('GPRManager.loadData: No currentProjectId');
            return;
        }
        try {
            console.log('--- GPR DEBUG START ---');
            console.log('Project ID:', this.currentProjectId);

            const container = document.getElementById('gpr_gantt_here');
            if (container) {
                console.log('Container Dimensions:', container.offsetWidth, 'x', container.offsetHeight);
                if (container.offsetHeight === 0) {
                    console.error('Gantt container has 0 height!');
                }
            }

            UI.showLoading(true, 'Загрузка ГПР...');

            const data = await api.getGanttData(this.currentProjectId);
            console.log('Raw Data from API:', JSON.parse(JSON.stringify(data)));

            if (!data || !data.data || data.data.length === 0) {
                console.warn('GPR data is empty');
                gantt.clearAll();
                UI.showNotification('ГПР пуст. Используйте "Распределить работы"', 'info');
                this.ensureTodayMarker();
                gantt.render();
                return;
            }

            console.log('Number of tasks from API:', data.data.length);

            // 1. Create a set of all IDs for orphan detection
            const taskIds = new Set();
            data.data.forEach(t => taskIds.add(String(t.id)));

            // 2. Normalize and check for orphans
            data.data.forEach(t => {
                const idStr = String(t.id);
                t.id = idStr;

                // Root tasks point to 0 or null
                let p = t.parent;
                if (!p || p === 0 || p === "0" || p === "" || p === this.currentProjectId) {
                    t.parent = 0;
                } else {
                    const pidStr = String(p);
                    if (!taskIds.has(pidStr)) {
                        console.warn(`[FIX] Task "${t.text}" (id:${idStr}) points to missing parent ${pidStr}. Moving to root.`);
                        t.parent = 0;
                    } else {
                        t.parent = pidStr;
                    }
                }

                t.open = true;
                if (!t.start_date) {
                    t.start_date = new Date().toISOString().replace('T', ' ').substring(0, 16);
                }
            });

            console.log('Clearing Gantt before parse...');
            gantt.clearAll();

            console.log('Calling gantt.parse...');
            gantt.parse(data);

            const count = gantt.getTaskCount();
            console.log('Final Task Count in Gantt:', count);

            if (count === 0 && data.data.length > 0) {
                console.error('CRITICAL: parse() added 0 tasks! Trying fallback parse individual objects...');
                gantt.batchUpdate(() => {
                    data.data.forEach(t => {
                        try { gantt.addTask(t, t.parent); } catch (e) { console.error('addTask failed for', t.id, e); }
                    });
                });
                console.log('Task Count after fallback:', gantt.getTaskCount());
            }

            this.ensureTodayMarker();
            gantt.render();

            console.log('--- GPR DEBUG END ---');
        } catch (error) {
            console.error('Error loading GPR data:', error);
            UI.showNotification('Ошибка загрузки ГПР', 'error');
        } finally {
            UI.showLoading(false);
        }
    },

    ensureTodayMarker() {
        if (!gantt.addMarker) return;
        if (this.todayMarkerId) {
            try { gantt.deleteMarker(this.todayMarkerId); } catch (e) { }
        }
        this.todayMarkerId = gantt.addMarker({
            start_date: new Date(),
            css: 'today',
            text: 'Сегодня'
        });
    },

    setScale(scale) {
        switch (scale) {
            case "day":
                gantt.config.scale_unit = "month";
                gantt.config.date_scale = "%F %Y";
                gantt.config.subscales = [{ unit: "day", step: 1, date: "%d" }];
                gantt.config.min_column_width = 30;
                break;
            case "week":
                gantt.config.scale_unit = "month";
                gantt.config.date_scale = "%F %Y";
                gantt.config.subscales = [{ unit: "week", step: 1, date: "Нед. %W" }];
                gantt.config.min_column_width = 60;
                break;
            case "month":
                gantt.config.scale_unit = "month";
                gantt.config.date_scale = "%F %Y";
                gantt.config.subscales = [{ unit: "day", step: 1, date: "%d" }];
                gantt.config.min_column_width = 25;
                break;
            case "year":
                gantt.config.scale_unit = "year";
                gantt.config.date_scale = "%Y";
                gantt.config.subscales = [{ unit: "month", step: 1, date: "%M" }];
                gantt.config.min_column_width = 50;
                break;
        }
        gantt.render();
    },

    expandAll() {
        console.log('GPRManager.expandAll...');
        gantt.batchUpdate(() => {
            gantt.eachTask(task => { gantt.open(task.id); });
        });
        gantt.render();
    },

    collapseAll() {
        gantt.batchUpdate(() => {
            gantt.eachTask(task => { if (gantt.hasChild(task.id)) gantt.close(task.id); });
        });
    },

    async clearGPR() {
        if (!confirm('Вы уверены, что хотите полностью очистить ГПР?')) return;
        try {
            UI.showLoading(true, 'Очистка...');
            await api.clearGanttSchedule(this.currentProjectId);
            await this.loadData();
            UI.showNotification('ГПР очищен', 'success');
        } catch (e) {
            UI.showNotification('Ошибка очистки', 'error');
        } finally {
            UI.showLoading(false);
        }
    },

    // ============================================================
    // RESOURCES PANE
    // ============================================================

    async loadAndShowResourcesForTask(taskId) {
        const task = gantt.getTask(taskId);
        if (!task || task.type === 'project') return;

        const workTypeId = this.extractWorkTypeIdFromTaskId(taskId);
        if (!workTypeId) return;

        const pane = document.querySelector('[data-pane="resources"]');
        if (!pane) return;

        pane.innerHTML = `<div style="text-align:center; padding: 20px;">Загрузка ресурсов для <b>${this.escapeHtml(task.text)}</b>...</div>`;
        this.setBottomPanelState(true);

        try {
            const resources = await api.getResources(workTypeId);
            if (!resources || resources.length === 0) {
                pane.innerHTML = `<div style="text-align:center; padding: 20px;">Ресурсы не найдены для <b>${this.escapeHtml(task.text)}</b></div>`;
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

            const rows = resources.map((r, idx) => {
                const b = getBadge(r.resourceType);
                const displayNo = r.code || (idx + 1);
                const norm = r.normPerUnit !== null ? this.formatQty(r.normPerUnit) : '—';
                return `
                    <tr>
                        <td style="width: 40px; color: var(--gray-500); text-align: center; font-size: 11px;">${this.escapeHtml(displayNo)}</td>
                        <td style="width: 24px; text-align: center;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; background: ${b.bg}; color: ${b.color}; border: 1px solid ${b.border};">
                                ${b.icon}
                            </span>
                        </td>
                        <td style="color: ${b.color}; font-weight: 500;">${this.escapeHtml(r.name)}</td>
                        <td style="color: var(--gray-600); font-size: 12px; white-space:nowrap;">${this.escapeHtml(r.unit)}</td>
                        <td style="text-align:right; font-weight:600; color: ${b.color}; white-space:nowrap;">${norm}</td>
                        <td style="text-align:right; font-weight:600; color: ${b.color}; white-space:nowrap;">${this.formatQty(r.quantity)}</td>
                    </tr>
                `;
            }).join('');

            pane.innerHTML = `
                <div style="font-weight:600; margin-bottom: 12px; font-size: 14px; padding: 0 4px; display: flex; align-items: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    Состав ресурсов: ${this.escapeHtml(task.text)}
                </div>
                <table class="schedule-resources-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">№</th>
                            <th style="width: 24px;"></th>
                            <th>Название</th>
                            <th style="width: 60px;">Ед.</th>
                            <th style="text-align:right;">Норма</th>
                            <th style="text-align:right;">Кол-во</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        } catch (e) {
            console.error(e);
            pane.innerHTML = `<div style="color:var(--accent-red); text-align:center; padding: 20px;">Ошибка загрузки ресурсов</div>`;
        }
    },

    // ============================================================
    // DISTRIBUTION WIZARD
    // ============================================================

    async showWorkDistributionWizard() {
        if (!this.currentProjectId) return;

        // Ensure styles
        if (!document.getElementById('wdw-styles')) {
            const s = document.createElement('style');
            s.id = 'wdw-styles';
            s.innerHTML = `
                .wdw { display: flex; gap: 16px; height: 75vh; }
                .wdw-panel { flex: 1; border: 1px solid var(--gray-300); border-radius: 8px; background: #fff; display: flex; flex-direction: column; overflow: hidden; }
                .wdw-h { background: var(--gray-50); padding: 12px; border-bottom: 1px solid var(--gray-300); font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
                .wdw-b { flex: 1; overflow-y: auto; padding: 0; }
                
                .wdw-list-item { padding: 10px 16px; border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: 0.2s; font-size: 13px; }
                .wdw-list-item:hover { background: var(--gray-50); }
                .wdw-list-item.active { background: var(--primary-lighter); color: var(--primary); font-weight: 600; }
                
                .wdw-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .wdw-table th { position: sticky; top: 0; background: var(--gray-50); padding: 10px; text-align: left; border-bottom: 1px solid var(--gray-300); z-index: 5; font-weight: 600; }
                .wdw-table td { padding: 10px; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
                .wdw-table tr.stage-row { background: var(--gray-50); font-weight: 600; cursor: pointer; }
                .wdw-table tr.stage-row:hover { background: var(--gray-100); }
                
                .wdw-block-group { border-bottom: 1px solid var(--gray-200); }
                .wdw-block-title { padding: 10px; background: var(--gray-100); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; }
            `;
            document.head.appendChild(s);
        }

        UI.showLoading(true, 'Подготовка мастера...');
        let sources;
        try {
            sources = await api.getAssignmentSources(this.currentProjectId);
        } catch (e) {
            UI.showNotification('Ошибка загрузки данных', 'error');
            return;
        } finally {
            UI.showLoading(false);
        }

        const state = {
            activeBlockId: null,
            activeEstimateId: null,
            selectedWorkTypeIds: new Set(),
            selectedFloorIds: new Set(),
            estimateData: null,
            expandedBlocks: new Set(),
            expandedStages: new Set(),
        };

        const modalHtml = `
            <div class="wdw">
                <div class="wdw-panel" style="max-width: 320px;">
                    <div class="wdw-h">Источник данных</div>
                    <div class="wdw-b" id="wdw-p1"></div>
                </div>
                <div class="wdw-panel">
                    <div class="wdw-h">
                        <span>Состав работ</span>
                        <button class="btn-link" id="wdw-sel-all-wt" style="font-size: 12px;">Выбрать все</button>
                    </div>
                    <div class="wdw-b" id="wdw-p2"></div>
                </div>
                <div class="wdw-panel" style="max-width: 300px;">
                    <div class="wdw-h">
                        <span>Целевые этажи</span>
                        <button class="btn-link" id="wdw-sel-all-fl" style="font-size: 12px;">Выбрать все</button>
                    </div>
                    <div class="wdw-b" id="wdw-p3"></div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="wdw-btn-save" disabled>Распределить</button>
        `;

        UI.showModal('Мастер распределения работ', modalHtml, footer, { width: '95vw', maxWidth: '1600px' });

        const $p1 = document.getElementById('wdw-p1');
        const $p2 = document.getElementById('wdw-p2');
        const $p3 = document.getElementById('wdw-p3');
        const $btnSave = document.getElementById('wdw-btn-save');

        const renderP1 = () => {
            $p1.innerHTML = sources.blocks.map(b => {
                const isExp = state.expandedBlocks.has(b.id);
                return `
                    <div class="wdw-block-group">
                        <div class="wdw-block-title" data-id="${b.id}">
                            <span style="display:inline-block; width:12px; transform: rotate(${isExp ? 0 : -90}deg); transition: 0.2s">▼</span>
                            ${this.escapeHtml(b.name)}
                        </div>
                        ${isExp ? (b.estimates || []).map(est => `
                            <div class="wdw-list-item ${state.activeEstimateId === est.id ? 'active' : ''}" 
                                 data-bid="${b.id}" data-eid="${est.id}">
                                ${this.escapeHtml(est.name)}
                            </div>
                        `).join('') : ''}
                    </div>
                `;
            }).join('');

            $p1.querySelectorAll('.wdw-block-title').forEach(el => {
                el.onclick = () => {
                    const id = el.dataset.id;
                    if (state.expandedBlocks.has(id)) state.expandedBlocks.delete(id);
                    else state.expandedBlocks.add(id);
                    renderP1();
                };
            });

            $p1.querySelectorAll('.wdw-list-item').forEach(el => {
                el.onclick = async () => {
                    state.activeBlockId = el.dataset.bid;
                    state.activeEstimateId = el.dataset.eid;
                    state.selectedWorkTypeIds.clear();
                    renderP1();
                    await loadEstimateData();
                    renderP2();
                    renderP3();
                    updateSaveButton();
                };
            });
        };

        const loadEstimateData = async () => {
            UI.showLoading(true, 'Загрузка ведомости...');
            try {
                state.estimateData = await api.getAssignmentEstimate(this.currentProjectId, state.activeBlockId, state.activeEstimateId);
            } finally {
                UI.showLoading(false);
            }
        };

        const renderP2 = () => {
            if (!state.estimateData) {
                $p2.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">Выберите смету в левой панели.</div>';
                return;
            }
            let html = `<table class="wdw-table"><thead><tr><th width="40"></th><th>Вид работ</th><th width="80" style="text-align:right">Остаток</th></tr></thead><tbody>`;

            (state.estimateData.stages || []).forEach(st => {
                const isExp = state.expandedStages.has(st.id);
                html += `
                    <tr class="stage-row" data-id="${st.id}">
                        <td colspan="3">
                            <span style="display:inline-block; width:12px; font-size: 10px; margin-right: 4px; transform: rotate(${isExp ? 0 : -90}deg); transition: 0.2s">▼</span>
                            ${this.escapeHtml(st.name)}
                        </td>
                    </tr>
                `;
                if (isExp) {
                    const wts = (st.workTypes || []);
                    if (wts.length === 0) {
                        html += `<tr><td></td><td colspan="2" style="color:#999; font-style:italic">Нет видов работ</td></tr>`;
                    }
                    wts.forEach(wt => {
                        const rem = Math.round(Number(wt.remainingQty || 0) * 100) / 100;
                        const checked = state.selectedWorkTypeIds.has(wt.id);
                        html += `
                            <tr style="${rem <= 0 ? 'opacity: 0.5' : ''}">
                                <td><input type="checkbox" class="wdw-wt-cb" data-id="${wt.id}" ${checked ? 'checked' : ''} ${rem <= 0 ? 'disabled' : ''}></td>
                                <td>${this.escapeHtml(wt.name)} <span style="color:#999; font-size:11px">(${wt.unit})</span></td>
                                <td style="text-align:right; font-weight:600">${rem}</td>
                            </tr>
                        `;
                    });
                }
            });
            $p2.innerHTML = html + '</tbody></table>';

            $p2.querySelectorAll('.stage-row').forEach(tr => {
                tr.onclick = () => {
                    const id = tr.dataset.id;
                    if (state.expandedStages.has(id)) state.expandedStages.delete(id);
                    else state.expandedStages.add(id);
                    renderP2();
                };
            });

            $p2.querySelectorAll('.wdw-wt-cb').forEach(cb => {
                cb.onchange = () => {
                    if (cb.checked) state.selectedWorkTypeIds.add(cb.dataset.id);
                    else state.selectedWorkTypeIds.delete(cb.dataset.id);
                    updateSaveButton();
                };
            });
        };

        const renderP3 = () => {
            const block = sources.blocks.find(b => b.id === state.activeBlockId);
            if (!block) {
                $p3.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">Выберите блок.</div>';
                return;
            }

            const floors = [];
            for (let i = block.undergroundFloors; i >= 1; i--) floors.push({ id: `floor-${block.id}-minus-${i}`, text: `Этаж -${i}` });
            for (let i = 1; i <= block.floors; i++) floors.push({ id: `floor-${block.id}-${i}`, text: `Этаж ${i}` });

            $p3.innerHTML = floors.map(f => `
                <div class="wdw-list-item" style="display:flex; gap:12px; align-items:center;">
                    <input type="checkbox" class="wdw-fl-cb" data-id="${f.id}" ${state.selectedFloorIds.has(f.id) ? 'checked' : ''}>
                    <span>${f.text}</span>
                </div>
            `).join('');

            $p3.querySelectorAll('.wdw-fl-cb').forEach(cb => {
                cb.onchange = () => {
                    if (cb.checked) state.selectedFloorIds.add(cb.dataset.id);
                    else state.selectedFloorIds.delete(cb.dataset.id);
                    updateSaveButton();
                };
            });
        };

        const updateSaveButton = () => {
            $btnSave.disabled = !(state.activeEstimateId && state.selectedWorkTypeIds.size > 0 && state.selectedFloorIds.size > 0);
        };

        document.getElementById('wdw-sel-all-wt').onclick = () => {
            if (!state.estimateData) return;
            let added = 0;
            state.estimateData.stages.forEach(st => st.workTypes.forEach(wt => {
                if ((wt.remainingQty || 0) > 0) {
                    state.selectedWorkTypeIds.add(wt.id);
                    added++;
                }
            }));
            if (added > 0) {
                state.expandedStages = new Set(state.estimateData.stages.map(s => s.id));
                renderP2(); updateSaveButton();
            }
        };

        document.getElementById('wdw-sel-all-fl').onclick = () => {
            const block = sources.blocks.find(b => b.id === state.activeBlockId);
            if (!block) return;
            for (let i = block.undergroundFloors; i >= 1; i--) state.selectedFloorIds.add(`floor-${block.id}-minus-${i}`);
            for (let i = 1; i <= block.floors; i++) state.selectedFloorIds.add(`floor-${block.id}-${i}`);
            renderP3(); updateSaveButton();
        };

        $btnSave.onclick = async () => {
            const wts = [];
            state.estimateData.stages.forEach(st => st.workTypes.forEach(wt => {
                if (state.selectedWorkTypeIds.has(wt.id)) wts.push(wt);
            }));

            const floors = Array.from(state.selectedFloorIds);
            UI.showLoading(true, 'Распределение...');

            try {
                for (const wt of wts) {
                    const totalQty = Number(wt.remainingQty || 0);
                    const perFloor = totalQty / floors.length;

                    for (let i = 0; i < floors.length; i++) {
                        let q = (i === floors.length - 1) ? (totalQty - (Math.round(perFloor * 100) / 100 * (floors.length - 1))) : perFloor;
                        q = Math.round(q * 100) / 100;
                        if (q <= 0) continue;

                        await api.assignWorkTypeToFloor(this.currentProjectId, floors[i], wt.id, q, 'add');
                    }
                }
                UI.closeModal();
                UI.showNotification('Распределение успешно завершено', 'success');
                await this.loadData();
            } catch (e) {
                console.error(e);
                UI.showNotification('Ошибка при распределении', 'error');
            } finally {
                UI.showLoading(false);
            }
        };

        renderP1();
    },

    async showProjectSettingsModal() {
        if (!this.currentProjectId) {
            UI.showNotification('Сначала выберите проект', 'error');
            return;
        }

        UI.showLoading(true, 'Загрузка настроек...');
        let project;
        try {
            project = await api.getProject(this.currentProjectId);
        } catch (e) {
            UI.showNotification('Ошибка загрузки данных проекта', 'error');
            return;
        } finally {
            UI.showLoading(false);
        }

        const modalHtml = `
            <div style="padding: 10px;">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Длительность смены (часов)</label>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        ${[8, 10, 12, 24].map(h => `
                            <label style="border: 1px solid var(--gray-300); padding: 10px; border-radius: 6px; text-align: center; cursor: pointer; transition: 0.2s; display: block;" class="shift-option ${project.shiftDuration === h ? 'active-opt' : ''}">
                                <input type="radio" name="shiftDuration" value="${h}" ${project.shiftDuration === h ? 'checked' : ''} style="display: none;">
                                <span style="font-size: 16px; font-weight: 700; display: block;">${h}</span>
                                <span style="font-size: 11px; color: var(--gray-500);">часов</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Рабочая неделя</label>
                    <select id="set_workWeek" class="form-control" style="width: 100%; height: 40px; font-size: 14px;">
                        <option value="5_2" ${project.workWeek === '5_2' ? 'selected' : ''}>Пятидневка (5/2)</option>
                        <option value="6_1" ${project.workWeek === '6_1' ? 'selected' : ''}>Шестидневка (6/1)</option>
                        <option value="7_0" ${project.workWeek === '7_0' ? 'selected' : ''}>Без выходных (7/0)</option>
                    </select>
                </div>

                <style>
                    .shift-option.active-opt { border-color: var(--primary) !important; background: var(--primary-lighter) !important; color: var(--primary) !important; }
                    .shift-option:hover { border-color: var(--primary); }
                </style>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="btn-save-project-settings">Сохранить</button>
        `;

        UI.showModal('Глобальные настройки проекта', modalHtml, footer, { width: '450px' });

        const modalEl = document.querySelector('.modal');
        modalEl.querySelectorAll('.shift-option').forEach(opt => {
            opt.onclick = () => {
                modalEl.querySelectorAll('.shift-option').forEach(o => o.classList.remove('active-opt'));
                opt.classList.add('active-opt');
                opt.querySelector('input').checked = true;
            };
        });

        document.getElementById('btn-save-project-settings').onclick = async () => {
            const shiftDuration = parseInt(modalEl.querySelector('input[name="shiftDuration"]:checked')?.value || 8);
            const workWeek = document.getElementById('set_workWeek').value;

            UI.showLoading(true, 'Сохранение...');
            try {
                await api.updateProject(this.currentProjectId, { shiftDuration, workWeek });
                UI.closeModal();
                UI.showNotification('Настройки проекта обновлены', 'success');
                // Refresh logic if needed
                await this.loadData();
            } catch (e) {
                UI.showNotification('Ошибка сохранения настроек', 'error');
            } finally {
                UI.showLoading(false);
            }
        };
    }
};
