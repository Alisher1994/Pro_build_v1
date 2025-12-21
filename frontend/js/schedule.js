// ========================================
// Schedule Manager - ГПР (DHTMLX Gantt)
// ========================================

const ScheduleManager = {
    version: '20251219-2',
    currentProjectId: null,
    isInitialized: false,
    todayMarkerId: null,
    isAutoUpdatingParents: false,
    bottomPanel: {
        activeTab: 'resources',
        isOpen: false,
        openHeightPx: null,
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

    renderResourcesList(taskName, resources) {
        const pane = this.getResourcesPaneEl();
        if (!pane) return;

        const safeTask = this.escapeHtml(taskName || 'Вид работ');
        const list = Array.isArray(resources) ? resources : [];

        if (list.length === 0) {
            pane.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="font-weight:600; color: var(--gray-900);">${safeTask}</div>
                    <div style="color: var(--gray-700);">Ресурсы не найдены</div>
                </div>
            `;
            return;
        }

        const rows = list.map((r) => {
            const name = this.escapeHtml(r?.name || '—');
            const qty = this.escapeHtml(this.formatQty(r?.quantity));
            const unit = this.escapeHtml(r?.unit || '');
            return `
                <tr>
                    <td>${name}</td>
                    <td style="text-align:right; white-space:nowrap;">${qty}</td>
                    <td style="white-space:nowrap;">${unit}</td>
                </tr>
            `;
        }).join('');

        pane.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="font-weight:600; color: var(--gray-900);">${safeTask}</div>
                <table class="schedule-resources-table">
                    <thead>
                        <tr>
                            <th>Ресурс</th>
                            <th style="text-align:right;">Кол-во</th>
                            <th>Ед.изм</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
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

            // Открываем нижнюю панель на вкладке "Ресурсы", чтобы пользователь сразу видел результат
            this.setBottomPanelState(true, 'resources');

            if (!workTypeId) {
                this.renderResourcesPlaceholder('Не удалось определить WorkTypeId для выбранной задачи');
                return;
            }

            const token = ++this.resourcesPane.token;
            this.renderResourcesLoading(task.text);

            const resources = await api.getResources(workTypeId);
            if (token !== this.resourcesPane.token) return; // stale

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
                    try { gantt.open(id); } catch (_) {}
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
                try { gantt.deleteMarker(this.todayMarkerId); } catch (_) {}
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

            for (const childId of childIds) {
                const child = gantt.getTask(childId);
                if (!child || !child.start_date) continue;
                const start = child.start_date;
                const end = child.end_date
                    ? child.end_date
                    : (typeof gantt.calculateEndDate === 'function')
                        ? gantt.calculateEndDate(start, child.duration || 0)
                        : new Date(start.getTime() + (Number(child.duration || 0) * 24 * 60 * 60 * 1000));

                if (!minStart || start < minStart) minStart = start;
                if (!maxEnd || end > maxEnd) maxEnd = end;
            }

            if (!minStart || !maxEnd) return null;

            const duration = (typeof gantt.calculateDuration === 'function')
                ? Math.max(1, gantt.calculateDuration(minStart, maxEnd))
                : Math.max(1, Math.ceil((maxEnd.getTime() - minStart.getTime()) / (24 * 60 * 60 * 1000)));

            return { start_date: minStart, duration };
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
                    if (startChanged || durationChanged) {
                        updates.push({ id: parentId, start_date: bounds.start_date, duration: bounds.duration });
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
                        await api.updateGanttTask(u.id, { start_date: u.start_date, duration: u.duration });
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
                    <div id="schedule-bottom" class="schedule-bottom" aria-label="Нижняя панель">
                        <div class="schedule-bottom-tabs" role="tablist" aria-label="Нижние вкладки">
                            <button type="button" class="schedule-bottom-tab" data-tab="resources" role="tab" aria-selected="false">Ресурсы</button>
                            <button type="button" class="schedule-bottom-tab" data-tab="contractors" role="tab" aria-selected="false">Подрядчики</button>
                        </div>
                        <div class="schedule-bottom-content" role="region" aria-label="Содержимое нижней панели">
                            <div class="schedule-bottom-pane" data-pane="resources">
                                <div style="color: var(--gray-700);">Ресурсы (в разработке)</div>
                            </div>
                            <div class="schedule-bottom-pane" data-pane="contractors">
                                <div style="color: var(--gray-700);">Подрядчики (в разработке)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initBottomPanel();

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
        // Максимум 30% от доступной высоты области графика
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return 220;
        const rect = contentArea.getBoundingClientRect();
        const total = Math.max(0, rect.height);
        const open = Math.max(0, Math.floor(total * 0.30));
        // Не даём открыть меньше чем высота вкладок + 1px
        const tabsHeight = 38;
        return Math.max(tabsHeight + 1, open);
    },

    setBottomPanelState(isOpen, activeTab) {
        const bottom = document.getElementById('schedule-bottom');
        if (!bottom) return;

        this.bottomPanel.isOpen = !!isOpen;
        if (activeTab) this.bottomPanel.activeTab = activeTab;

        // Активная вкладка
        const tabs = Array.from(bottom.querySelectorAll('.schedule-bottom-tab'));
        tabs.forEach((b) => {
            const isActive = b.dataset.tab === this.bottomPanel.activeTab;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const panes = Array.from(bottom.querySelectorAll('.schedule-bottom-pane'));
        panes.forEach((p) => {
            const isActive = p.dataset.pane === this.bottomPanel.activeTab;
            p.classList.toggle('active', isActive);
        });

        if (this.bottomPanel.isOpen) {
            bottom.classList.add('is-open');
            const h = this.computeBottomOpenHeightPx();
            this.bottomPanel.openHeightPx = h;
            bottom.style.height = `${h}px`;
        } else {
            bottom.classList.remove('is-open');
            bottom.style.height = 'var(--schedule-bottom-tabs-height)';
        }

        // Пересчитать размеры ганта
        try {
            requestAnimationFrame(() => {
                if (typeof gantt !== 'undefined' && typeof gantt.setSizes === 'function') {
                    gantt.setSizes();
                }
            });
        } catch (_) {}
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
        try { console.log('[ScheduleManager]', this.version); } catch (_) {}
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

        // Настройки шкалы времени (двухуровневая): Месяц+Год сверху, Дни снизу
        gantt.config.scale_height = 50;
        gantt.config.row_height = 30;
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

        // Разрешаем изменение размера колонок сетки мышкой
        gantt.config.grid_resize = true;
        gantt.config.grid_elastic_columns = false;

        // Ресайзер между таблицей (grid) и колбасками (timeline)
        // Делает явно видимую "перетаскиваемую" границу.
        gantt.config.layout = {
            css: 'gantt_container',
            rows: [
                {
                    cols: [
                        { view: 'grid', scrollX: 'scrollHor', scrollY: 'scrollVer' },
                        { resizer: true, width: 6 },
                        { view: 'timeline', scrollX: 'scrollHor', scrollY: 'scrollVer' },
                        { view: 'scrollbar', id: 'scrollVer' }
                    ]
                },
                { view: 'scrollbar', id: 'scrollHor' }
            ]
        };

        // Отключаем стандартное редактирование через Lightbox по двойному клику
        gantt.config.details_on_dblclick = false;
        gantt.config.details_on_create = false;
        
        // Конфигурация колонок (БЕЗ editor для text — добавим программно только для task-строк)
        gantt.config.columns = [
            { name: "text", label: "Название задачи", tree: true, width: 360, resize: true },
            { name: "start_date", label: "Начало", align: "center", width: 120, resize: true },
            { name: "end_date", label: "Окончание", align: "center", width: 120, resize: true },
            { name: "duration", label: "Длит.", align: "center", width: 60, resize: true },
            { name: "quantity", label: "Объем", align: "center", width: 70, resize: true },
            { name: "unit", label: "Ед.изм.", align: "center", width: 60, resize: true },
            { name: "progress", label: "%", align: "center", width: 50, resize: true, template: function(obj) {
                return Math.round(obj.progress * 100) + "%";
            }},
            { name: "add", label: "", width: 44 }
        ];

        // Настройка Lightbox (окна свойств) - хоть и не используем, но на всякий случай
        gantt.config.lightbox.sections = [
            {name: "description", height: 38, map_to: "text", type: "textarea", focus: true},
            {name: "quantity", height: 30, map_to: "quantity", type: "textarea"},
            {name: "unit", height: 30, map_to: "unit", type: "textarea"},
            {name: "time", height: 72, type: "duration", map_to: "auto"}
        ];
        
        gantt.locale.labels.section_description = "Название";
        gantt.locale.labels.section_quantity = "Объем";
        gantt.locale.labels.section_unit = "Ед. изм.";
        gantt.locale.labels.section_time = "Время";
        
        // Стилизация строк (заливка фона) — и в таблице, и в шкале
        const rowClass = function(start, end, task){
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
            this.rollupParentChainFrom(id);
            return true;
        });

        // Выбор задачи: показываем ресурсы выбранного вида работ в нижней вкладке
        // Примечание: в разных версиях DHTMLX событие выбора может отличаться,
        // поэтому дополнительно дергаем логику на обычный клик по задаче.
        gantt.attachEvent("onAfterTaskSelect", (id) => {
            this.loadAndShowResourcesForTask(id);
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
                    this.loadAndShowResourcesForTask(id);
                }
                return true;
            } catch (_) {
                return true;
            }
        });

        // ============= ИНИЦИАЛИЗАЦИЯ (ПОСЛЕДНИЙ ШАГ) =============
        gantt.init("gantt_here");
        this.ensureTodayMarker();
        gantt.render();

        this.isInitialized = true;

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
            `;
            document.head.appendChild(style);
        }

        UI.showLoading(true, 'Загрузка данных...');
        let sources;
        try {
            sources = await api.getAssignmentSources(this.currentProjectId);
        } catch (e) {
            UI.showLoading(false);
            UI.showNotification('Ошибка загрузки блоков/смет', 'error');
            return;
        } finally {
            UI.showLoading(false);
        }

        const content = `
            <div class="wdw">
                <div class="wdw-panel">
                    <div class="wdw-head">Источник данных</div>
                    <div class="wdw-body" id="wdw-source"></div>
                </div>

                <div class="wdw-panel">
                    <div class="wdw-head">Состав работ</div>
                    <div class="wdw-body" id="wdw-content"></div>
                </div>

                <div class="wdw-panel">
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
            width: '95%',
            maxWidth: '1200px',
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
            $source.innerHTML = '';
            state.blocks.forEach(block => {
                const isExpanded = state.blockExpanded.has(block.id);
                const isActiveBlock = state.activeBlockId === block.id;

                const blockRow = document.createElement('div');
                blockRow.className = `wdw-item ${isActiveBlock ? 'active' : ''}`;
                blockRow.innerHTML = `
                    <div class="wdw-row">
                        <span style="width: 14px; display: inline-block;">${isExpanded ? '▾' : '▸'}</span>
                        <span>${block.name}</span>
                    </div>
                    <span class="wdw-muted">Смет: ${block.estimates?.length || 0}</span>
                `;
                blockRow.addEventListener('click', () => {
                    if (state.blockExpanded.has(block.id)) state.blockExpanded.delete(block.id); else state.blockExpanded.add(block.id);
                    state.activeBlockId = block.id;
                    // При смене блока сбрасываем выбор сметы/работ/этажей
                    state.activeEstimateId = null;
                    state.estimateData = null;
                    state.selectedWorkTypeIds.clear();
                    state.selectedFloorIds.clear();
                    state.stageExpanded.clear();
                    renderSource();
                    renderContent();
                    renderTarget();
                    recalcSaveEnabled();
                });
                $source.appendChild(blockRow);

                if (isExpanded) {
                    const sub = document.createElement('div');
                    sub.className = 'wdw-sub';

                    (block.estimates || []).forEach(est => {
                        const isActiveEstimate = state.activeEstimateId === est.id;
                        const estRow = document.createElement('div');
                        estRow.className = `wdw-item ${isActiveEstimate ? 'active' : ''}`;
                        estRow.innerHTML = `
                            <div class="wdw-row">
                                <span style="width: 14px; display: inline-block;"></span>
                                <span>${est.name}</span>
                            </div>
                        `;
                        estRow.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (!state.activeBlockId) return;
                            state.activeEstimateId = est.id;
                            state.selectedWorkTypeIds.clear();
                            state.stageExpanded.clear();
                            renderSource();
                            await loadEstimateData();
                            renderContent();
                            renderTarget();
                            recalcSaveEnabled();
                        });
                        sub.appendChild(estRow);
                    });

                    $source.appendChild(sub);
                }
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
                $content.innerHTML = `<div class="wdw-muted" style="padding: 8px;">Выберите смету в левом окне.</div>`;
                return;
            }

            const stages = state.estimateData.stages || [];
            if (stages.length === 0) {
                $content.innerHTML = `<div class="wdw-muted" style="padding: 8px;">В смете нет этапов.</div>`;
                return;
            }

            stages.forEach(stage => {
                const expanded = state.stageExpanded.has(stage.id);
                const stageBox = document.createElement('div');
                stageBox.className = 'wdw-stage';

                const head = document.createElement('div');
                head.className = 'wdw-stage-head';
                head.innerHTML = `
                    <div class="wdw-row">
                        <span style="width: 14px; display: inline-block;">${expanded ? '▾' : '▸'}</span>
                        <span>${stage.name}</span>
                    </div>
                    <button class="wdw-btn-link" type="button">Выбрать все</button>
                `;

                const btnSelectAll = head.querySelector('button');
                btnSelectAll.addEventListener('click', (e) => {
                    e.stopPropagation();
                    (stage.workTypes || []).forEach(wt => {
                        if ((wt.remainingQty || 0) <= 0) return;
                        state.selectedWorkTypeIds.add(wt.id);
                    });
                    renderContent();
                    recalcSaveEnabled();
                });

                head.addEventListener('click', () => {
                    if (state.stageExpanded.has(stage.id)) state.stageExpanded.delete(stage.id); else state.stageExpanded.add(stage.id);
                    renderContent();
                });

                stageBox.appendChild(head);

                if (expanded) {
                    const body = document.createElement('div');
                    body.className = 'wdw-stage-body';

                    (stage.workTypes || []).forEach(wt => {
                        const remaining = Number(wt.remainingQty || 0);
                        const unit = wt.unit || '';
                        const disabled = remaining <= 0;
                        const checked = state.selectedWorkTypeIds.has(wt.id);

                        const row = document.createElement('div');
                        row.className = `wdw-wt ${disabled ? 'disabled' : ''}`;
                        row.innerHTML = `
                            <label>
                                <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
                                <span>${wt.name}</span>
                            </label>
                            <span class="wdw-muted">Остаток: ${remaining} ${unit}</span>
                        `;
                        const cb = row.querySelector('input');
                        cb.addEventListener('change', () => {
                            if (cb.checked) state.selectedWorkTypeIds.add(wt.id); else state.selectedWorkTypeIds.delete(wt.id);
                            recalcSaveEnabled();
                        });
                        body.appendChild(row);
                    });

                    stageBox.appendChild(body);
                }

                $content.appendChild(stageBox);
            });
        };

        const renderTarget = () => {
            $target.innerHTML = '';
            const floorsByBlock = getFloorsByBlock();

            if (!state.activeBlockId) {
                $target.innerHTML = `<div class="wdw-muted" style="padding: 8px;">Выберите блок слева, чтобы выбрать этажи.</div>`;
                return;
            }

            state.blocks.forEach(block => {
                const floors = floorsByBlock.get(block.id) || [];
                const isActiveBlock = block.id === state.activeBlockId;

                const group = document.createElement('div');
                group.className = 'wdw-stage';
                const head = document.createElement('div');
                head.className = 'wdw-stage-head';
                head.style.cursor = 'default';
                head.innerHTML = `
                    <div class="wdw-row">
                        <span style="width: 14px; display: inline-block;">▸</span>
                        <span>${block.name}</span>
                    </div>
                    <span class="wdw-muted">Этажей: ${floors.length}</span>
                `;
                group.appendChild(head);

                const body = document.createElement('div');
                body.className = 'wdw-stage-body';

                if (floors.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'wdw-muted';
                    empty.textContent = 'Нет этажей в ГПР (сначала сгенерируйте этажи).';
                    body.appendChild(empty);
                } else {
                    floors.forEach(floor => {
                        const checked = state.selectedFloorIds.has(floor.id);
                        const disabled = !isActiveBlock;
                        const row = document.createElement('div');
                        row.className = `wdw-wt ${disabled ? 'disabled' : ''}`;
                        row.innerHTML = `
                            <label title="${disabled ? 'Можно выбирать этажи только активного блока' : ''}">
                                <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
                                <span>${floor.text}</span>
                            </label>
                            <span class="wdw-muted"></span>
                        `;
                        const cb = row.querySelector('input');
                        cb.addEventListener('change', () => {
                            if (cb.checked) state.selectedFloorIds.add(floor.id); else state.selectedFloorIds.delete(floor.id);
                            recalcSaveEnabled();
                        });
                        body.appendChild(row);
                    });
                }

                group.appendChild(body);
                $target.appendChild(group);
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
                UI.showLoading(true, 'Проверка остатков...');

                // Всегда переполучаем актуальные остатки перед записью
                const latest = await api.getAssignmentEstimate(this.currentProjectId, state.activeBlockId, state.activeEstimateId);
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
            } else {
                UI.showNotification('График пуст. Нажмите "Сформировать из сметы"', 'info');
                this.ensureTodayMarker();
            }
        } catch (error) {
            console.error('Error loading gantt data:', error);
            UI.showNotification('Ошибка загрузки графика', 'error');
        }
    },

    async generateSchedule() {
        if (!confirm('Это действие полностью перезапишет текущий график данными из сметы. Продолжить?')) {
            return;
        }

        try {
            UI.showLoading(true);
            await api.generateGanttSchedule(this.currentProjectId);
            await this.loadData();
            UI.showNotification('График успешно сформирован', 'success');
        } catch (error) {
            console.error('Error generating schedule:', error);
            UI.showNotification('Ошибка генерации графика: ' + error.message, 'error');
        } finally {
            UI.showLoading(false);
        }
    },

    exportToPDF() {
        gantt.exportToPDF({
            name: "schedule.pdf",
            header: "График производства работ",
            footer: "Сгенерировано в ProBIM"
        });
    },

    showGenerationWizard() {
        const content = `
            <div class="wizard-step">
                <p>Выберите способ формирования структуры графика:</p>
                
                <div class="generation-option" onclick="ScheduleManager.selectGenerationMode('manual', false)">
                    <h4>🏗️ Вручную (по параметрам блока)</h4>
                    <p>Структура этажей будет создана на основе количества этажей, указанных в свойствах блока.</p>
                </div>

                <div class="generation-option" onclick="ScheduleManager.selectGenerationMode('bim', false)">
                    <h4>🏢 Из BIM модели (IFC)</h4>
                    <p>Структура будет взята из IFC файла (IfcBuildingStorey). Требуется загруженная модель.</p>
                </div>

                <div class="generation-option" onclick="ScheduleManager.selectGenerationModeWithAI()">
                    <h4>🤖 С ИИ ассистентом</h4>
                    <p>ИИ сопоставит виды работ из сметы с нормативной базой и автоматически рассчитает длительность задач.</p>
                    <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 4px; font-size: 12px; color: #0369a1;">
                        ⚡ Работает только при наличии нормативов в нормативной базе
                    </div>
                </div>
            </div>
        `;
        
        if (!document.getElementById('wizard-styles')) {
            const style = document.createElement('style');
            style.id = 'wizard-styles';
            style.innerHTML = `
                .generation-option {
                    border: 1px solid #ddd;
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .generation-option:hover {
                    background: #f5f9ff;
                    border-color: #2196F3;
                }
                .generation-option h4 { margin: 0 0 5px 0; color: #333; }
                .generation-option p { margin: 0; color: #666; font-size: 0.9em; }
            `;
            document.head.appendChild(style);
        }

        UI.showModal('Мастер генерации графика', content, '<button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>');
    },

    selectGenerationModeWithAI() {
        const content = `
            <div style="margin-bottom: 16px;">
                <p>Выберите источник структуры графика:</p>
            </div>
            <div class="generation-option" onclick="ScheduleManager.selectGenerationMode('manual', true)" style="margin-bottom: 12px;">
                <h4>🏗️ Вручную + ИИ ассистент</h4>
                <p>Структура создается по параметрам блока, нормативы применяются через ИИ</p>
            </div>
            <div class="generation-option" onclick="ScheduleManager.selectGenerationMode('bim', true)">
                <h4>🏢 Из BIM + ИИ ассистент</h4>
                <p>Структура из IFC модели, нормативы применяются через ИИ</p>
            </div>
        `;
        UI.showModal('Генерация с ИИ ассистентом', content, '<button class="btn btn-secondary" onclick="ScheduleManager.showGenerationWizard()">Назад</button>');
    },

    async selectGenerationMode(mode, useAI = false) {
        UI.closeModal();
        
        if (!confirm('Внимание! Текущий график будет полностью перезаписан. Продолжить?')) {
            return;
        }

        try {
            UI.showLoading(true);
            const options = { mode, useAI };
            await api.generateGanttSchedule(this.currentProjectId, mode, useAI);
            await this.loadData();
            UI.showNotification(
                useAI 
                    ? 'График успешно сформирован с применением нормативов через ИИ ассистента' 
                    : 'График успешно сформирован', 
                'success'
            );
        } catch (error) {
            console.error('Error generating schedule:', error);
            UI.showNotification('Ошибка генерации графика: ' + error.message, 'error');
        } finally {
            UI.showLoading(false);
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
    }
};
window.ScheduleManager = ScheduleManager;
