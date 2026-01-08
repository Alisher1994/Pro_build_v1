document.querySelectorAll('.viewer-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.viewerMode;
        EstimateManager.setViewerDisplayMode(mode);
    });
});

document.getElementById('isolate-btn')?.addEventListener('click', () => {
    EstimateManager.isolateSelected();
});
document.getElementById('unisolate-btn')?.addEventListener('click', () => {
    EstimateManager.showAllElements();
});
// ========================================
// ProBIM - Main Application
// ========================================

class ProBIMApp {
    constructor() {
        this.currentProjectId = null;
        this.currentRibbonTab = 'estimate';
        this.projects = [];
        this.ribbonCollapsed = false;
        this.sidebarCollapsed = false;
        this.navigationHistory = []; // История навигации внутри системы
        this.otitbActive = null;
        this.currentDashboardSubTab = 'statistics';
        this.scheduleMode = 'gantt'; // 'gantt' or '3d'
        this.userSettings = {
            showBreadcrumbs: false,
            showWeather: true,
            showAQI: true
        };
        this.currentLegalSubTab = 'inbox';
        this.legalStatusFilter = 'all';
        this.legalSearchQuery = '';
        this.legalFilterPanelVisible = false;
        this.legalFilters = {
            docType: 'all',
            status: 'all',
            priceFrom: '',
            priceTo: '',
            contractNo: '',
            inn: '',
            docDate: ''
        };
        this.legalDropdowns = {
            docType: false,
            status: false
        };
        this.lastLegalKeyPressTime = 0;
        this.lastLegalKey = '';
        this.legalTemplateEditorVisible = false;
        this.selectedLegalTemplateType = 'contract_nk';
        this.legalTemplateSections = [
            { id: 1, title: '1. ПРЕДМЕТ ДОГОВОРА', text: '' },
            { id: 2, title: '2. СТОИМОСТЬ РАБОТ И ПОРЯДОК РАСЧЕТА', text: '' },
            { id: 3, title: '3. ОБЯЗАТЕЛЬСТВА СТОРОН', text: '' },
            { id: 4, title: '4. ОТВЕТСТВЕННОСТЬ СТОРОН', text: '' },
            { id: 5, title: '5. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ', text: '' },
            { id: 6, title: '6. ПРОЧИЕ УСЛОВИЯ', text: '' },
            { id: 7, title: '7. ЮРИДИЧЕСКИЕ АДРЕСА, БАНКОВСКИЕ РЕКВИЗИТЫ И ПОДПИСИ СТОРОН', text: '' }
        ];
        this.editingLegalTemplateId = null;
        this.legalTemplateData = {
            name: '',
            city: 'г. Ташкент',
            docType: 'contract_nk',
            partyA: { name: 'OOO "PROBIM"', inn: '309272383', mfo: '01095', bank: 'ТОШКЕНТ Ш., "ASIA ALLIANCE BANK"' },
            partyB: { name: '', inn: '', mfo: '', bank: '' }
        };
        this.legalEditorDropdowns = {
            docType: false,
            city: false
        };
        this.uzbekistanCities = [
            'г. Ташкент', 'Самарканд', 'Бухара', 'Хива', 'Андижан',
            'Наманган', 'Фергана', 'Нукус', 'Карши', 'Термез',
            'Джизак', 'Гулистан', 'Навои'
        ];
    }

    getInitialRibbonTab() {
        // Убрали 'analytics' из списка разрешенных
        const allowed = new Set(['dashboard', 'estimate', 'tender', 'schedule', 'supply', 'finance', 'otitb', 'timesheet', 'settings', 'ui-kit', 'legal']);

        // Принудительно открываем Дашборд при обновлении
        // Если в URL есть хеш, его можно оставить для глубокой навигации, 
        // но если пользователь хочет "по умолчанию Дашборд", лучше игнорировать сохраненное состояние.

        const hash = (window.location.hash || '').replace('#', '').trim();
        if (hash && allowed.has(hash)) {
            return hash;
        }

        // Игнорируем localStorage для того, чтобы всегда был Дашборд при чистом заходе/F5
        return 'dashboard';
    }

    applyRibbonTabToUI(ribbonName) {
        try {
            document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.remove('active'));

            const tabBtn = document.querySelector(`.ribbon-tab[data-ribbon="${ribbonName}"]`);
            const panel = document.querySelector(`[data-panel="${ribbonName}"]`);
            if (tabBtn) tabBtn.classList.add('active');
            if (panel) panel.classList.add('active');

            if (ribbonName !== 'otitb') {
                ['tolerance-settings-btn', 'worktypes-settings-btn', 'permit-board-btn'].forEach(id => {
                    const btn = document.getElementById(id);
                    if (btn) btn.classList.remove('active');
                });
            }

            localStorage.setItem('probim_active_ribbon_tab', ribbonName);
            // Обновляем хеш, но для дашборда очищаем
            if (ribbonName === 'dashboard') {
                window.history.replaceState(null, '', window.location.pathname);
            } else {
                window.location.hash = `#${ribbonName}`;
            }
        } catch (e) {
            console.warn('applyRibbonTabToUI failed', e);
        }
    }

    loadUserSettings() {
        if (!window.auth || !window.auth.user) return;
        const userId = window.auth.user.id;
        const saved = localStorage.getItem(`probim_settings_${userId}`);
        if (saved) {
            try {
                this.userSettings = { ...this.userSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to parse user settings', e);
            }
        }
    }

    saveUserSettings() {
        if (!window.auth || !window.auth.user) return;
        const userId = window.auth.user.id;
        localStorage.setItem(`probim_settings_${userId}`, JSON.stringify(this.userSettings));
    }

    applyUserSettings() {
        const breadcrumbs = document.getElementById('breadcrumbs-bar');
        const weather = document.getElementById('weather-widget');
        const aqi = document.getElementById('aqi-widget');

        if (breadcrumbs) breadcrumbs.style.display = this.userSettings.showBreadcrumbs ? 'flex' : 'none';
        if (weather) weather.style.display = this.userSettings.showWeather ? 'flex' : 'none';
        if (aqi) aqi.style.display = this.userSettings.showAQI ? 'flex' : 'none';

        this.updateSettingsButtonsUI();
        this.updateChatPosition();
    }

    updateChatPosition() {
        const headerHeight = 48;
        const tabsHeight = 32;
        const panelHeight = this.ribbonCollapsed ? 0 : 102;
        const breadcrumbsHeight = (this.userSettings && this.userSettings.showBreadcrumbs) ? 33 : 0;

        const total = headerHeight + tabsHeight + panelHeight + breadcrumbsHeight;
        document.documentElement.style.setProperty('--chat-top-offset', `${total}px`);
    }

    updateSettingsButtonsUI() {
        const btns = {
            'toggle-breadcrumbs-btn': this.userSettings.showBreadcrumbs,
            'toggle-weather-btn': this.userSettings.showWeather,
            'toggle-aqi-btn': this.userSettings.showAQI
        };

        for (const [id, active] of Object.entries(btns)) {
            const btn = document.getElementById(id);
            if (btn) {
                if (active) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        }
    }

    async init() {
        console.log('🚀 ProBIM Application Starting...');

        // Загружаем настройки пользователя
        this.loadUserSettings();
        this.applyUserSettings();
        this.updateChatPosition();

        // Восстанавливаем активную вкладку ДО загрузки проекта,
        // чтобы после F5 оставаться на той же странице.
        this.currentRibbonTab = this.getInitialRibbonTab();
        this.applyRibbonTabToUI(this.currentRibbonTab);

        // Загрузка проектов
        await this.loadProjects();

        // Восстанавливаем состояние интерфейса
        this.restoreRibbonState();
        this.restoreSidebarState();

        // Инициализация обработчиков
        this.initEventHandlers();
        this.setEstimateRibbonContext('blocks');

        // Повторно применяем UI вкладки (на случай, если обработчики/DOM обновились)
        this.applyRibbonTabToUI(this.currentRibbonTab);

        // Обновляем состояние ribbon
        this.updateRibbonState();

        // Инициализируем погоду
        this.initWeather();

        console.log('✅ ProBIM Application Ready');
    }

    async loadProjects() {
        try {
            console.log('Fetching projects from API...');
            this.projects = await api.getProjects();
            console.log('Projects loaded:', this.projects);
            this.renderProjectList();

            // Пытаемся восстановить последний активный проект
            const lastProjectId = localStorage.getItem('probim_last_project_id');
            const projectToSelect = this.projects.find(p => p.id === lastProjectId) || this.projects[0];

            if (projectToSelect?.name === 'Главный офис') {
                this.currentRibbonTab = 'settings';
                this.applyRibbonTabToUI('settings');
            }

            if (projectToSelect) {
                // Передаем true вторым параметром, чтобы сигнализировать о восстановлении состояния
                this.selectProject(projectToSelect.id, true);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            console.error('Error details:', error.message, error.stack);

            // Показываем пустой список при ошибке
            this.projects = [];
            this.renderProjectList();

            UI.showNotification('Не удалось подключиться к серверу. Убедитесь, что backend запущен на порту 3001.', 'error');
        }
    }

    renderProjectList() {
        const list = document.getElementById('project-list');

        if (this.projects.length === 0) {
            list.classList.add('empty');
            list.innerHTML = `
                <li style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; color: var(--gray-600); cursor: default;">
                    <div style="margin-bottom: 12px;">Нет проектов</div>
                    <button class="btn btn-primary" style="min-width: 180px;" onclick="app.createProject()">
                        Добавить проект
                    </button>
                </li>
            `;
            return;
        }

        let html = '';
        this.projects.forEach(project => {
            const isSelected = project.id === this.currentProjectId;
            const projectName = project.name || 'Без названия';
            const safeName = this.escapeHtml(projectName);
            const isMainOffice = project.name === 'Главный офис';

            const iconHtml = isMainOffice ? `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/>
                    <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/>
                    <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>
                </svg>` : `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>`;

            html += `
                <li class="${isSelected ? 'selected' : ''}" onclick="app.selectProject('${project.id}')" title="${safeName}" aria-label="${safeName}">
                    ${iconHtml}
                    <span>${safeName}</span>
                    <button class="project-menu-btn" onclick="event.stopPropagation(); app.toggleProjectMenu('${project.id}', event)" title="Меню">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"/>
                            <circle cx="12" cy="5" r="1"/>
                            <circle cx="12" cy="19" r="1"/>
                        </svg>
                    </button>
                    <div class="project-menu" id="project-menu-${project.id}">
                        <button onclick="event.stopPropagation(); app.editProject('${project.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Изменить
                        </button>
                        ${!isMainOffice ? `
                        <button onclick="event.stopPropagation(); app.deleteProject('${project.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Удалить
                        </button>
                        ` : ''}
                    </div>
                </li>
            `;
        });

        list.classList.remove('empty');
        list.innerHTML = html;

        // Обновляем состояние ribbon
        this.updateRibbonState();
    }

    updateRibbonState() {
        const ribbon = document.getElementById('office-ribbon');
        if (!ribbon) return;

        if (!this.currentProjectId) {
            ribbon.classList.add('disabled');
            return;
        }

        ribbon.classList.remove('disabled');

        const project = this.projects.find(p => p.id === this.currentProjectId);
        const isMainOffice = project?.name === 'Главный офис';

        // Ribbon tabs visibility: для "Главный офис" оставляем только Настройки
        document.querySelectorAll('.ribbon-tab').forEach(tab => {
            const tabName = tab.dataset.ribbon;

            // Скрываем ГПР по просьбе пользователя
            if (tabName === 'gpr') {
                tab.style.display = 'none';
                return;
            }

            if (isMainOffice) {
                tab.style.display = tabName === 'settings' ? '' : 'none';
            } else {
                tab.style.display = '';
            }
        });

        // Specific buttons visibility inside the Settings ribbon panel
        const projectBtn = document.getElementById('project-settings-btn');
        const hrBtn = document.getElementById('hr-management-btn');
        const subconBtn = document.getElementById('subcontractors-btn');

        if (projectBtn) {
            const group = projectBtn.closest('.ribbon-group');
            const sep = group?.nextElementSibling;
            if (isMainOffice) {
                if (group) group.style.display = 'none';
                if (sep && sep.classList.contains('ribbon-separator')) sep.style.display = 'none';
            } else {
                if (group) group.style.display = '';
                if (sep && sep.classList.contains('ribbon-separator')) sep.style.display = '';
            }
        }

        if (hrBtn) {
            const group = hrBtn.closest('.ribbon-group');
            // Find the separator that comes AFTER this group (handling HR being first)
            const sep = group?.nextElementSibling;
            if (isMainOffice) {
                if (group) group.style.display = '';
                if (sep && sep.classList.contains('ribbon-separator')) sep.style.display = '';
            } else {
                if (group) group.style.display = 'none';
                if (sep && sep.classList.contains('ribbon-separator')) sep.style.display = 'none';
            }
        }

        if (subconBtn) {
            const group = subconBtn.closest('.ribbon-group');
            // For Subcontractors (usually last in current HTML), we might have a separator BEFORE it
            const sep = group?.previousElementSibling;
            if (isMainOffice) {
                if (group) group.style.display = '';
                // Don't touch the separator here; it belongs to the previous group (Project), 
                // which handles its own visibility.
            } else {
                if (group) group.style.display = 'none';
                if (sep && sep.classList.contains('ribbon-separator')) sep.style.display = 'none';
            }
        }

        // Auto-switch tab if necessary
        if (isMainOffice && this.currentRibbonTab !== 'settings') {
            this.currentRibbonTab = 'settings';
            this.applyRibbonTabToUI('settings');
        }
    }

    async selectProject(projectId, isRestoring = false) {
        // Expand sidebar if clicking manually (not restoring)
        if (!isRestoring && this.sidebarCollapsed) {
            this.setSidebarCollapsed(false);
        }

        this.currentProjectId = projectId;
        localStorage.setItem('probim_last_project_id', projectId);

        // Обновляем UI
        this.renderProjectList();

        // Обновляем название в title bar
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            const projectNameEl = document.getElementById('selected-project-name');
            if (projectNameEl) {
                projectNameEl.textContent = project.name;
            }

            // Если выбран Главный офис, сразу переключаемся на вкладку настроек
            if (project.name === 'Главный офис') {
                this.currentRibbonTab = 'settings';
                this.applyRibbonTabToUI('settings');
            } else if (!isRestoring) {
                // При переключении на обычный проект открываем Главную
                this.currentRibbonTab = 'dashboard';
                this.applyRibbonTabToUI('dashboard');
            }
        }

        // Скрываем welcome screen
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        // Загружаем содержимое в зависимости от активной вкладки
        this.loadCurrentTab(isRestoring);
    }

    async loadCurrentTab(isRestoring = false) {
        UI.showTurboLoader();

        if (!this.currentProjectId) {
            document.getElementById('content-area').innerHTML = `
                <div id="welcome-screen" class="welcome-screen">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <h2>Добро пожаловать в ProBIM</h2>
                    <p>Выберите проект из списка слева или добавьте новый</p>
                    <button class="primary-btn" onclick="app.createProject()">Добавить первый проект</button>
                </div>
            `;
            UI.hideTurboLoader();
            return;
        }

        const contentArea = document.getElementById('content-area');
        // Reset padding by default (restore CSS value)
        contentArea.style.padding = '';

        switch (this.currentRibbonTab) {
            case 'dashboard':
                if (this.currentDashboardSubTab === 'org-structure') {
                    await this.loadOrgStructureTab();
                } else if (this.currentDashboardSubTab === 'cameras') {
                    await this.loadCamerasTab();
                } else {
                    await this.loadStatisticsTab();
                }
                break;
            case 'estimate':
                if (isRestoring && EstimateManager.restoreState) {
                    await EstimateManager.restoreState(this.currentProjectId);
                } else {
                    await EstimateManager.renderEstimateTree(this.currentProjectId);
                }
                break;
            case 'tender':
                // Remove padding for tender tab so iframe can be full width
                contentArea.style.padding = '0';
                this.loadTenderTab();
                break;
            case 'schedule':
                this.loadScheduleTab();
                break;
            case 'gpr':
                this.loadGPRTab();
                break;
            case 'supply':
                this.loadSupplyTab();
                break;
            case 'finance':
                await this.loadFinanceTab();
                break;
            case 'legal':
                this.loadLegalTab();
                break;
            case 'analytics':
                this.loadAnalyticsTab();
                break;
            case 'otitb':
                this.showPermitBoard();
                break;
            case 'timesheet':
                this.loadTimesheetTab();
                break;
            case 'ui-kit':
                // UI Kit should be full width like other iframe-based tabs
                contentArea.style.padding = '0';
                this.loadUiKitTab();
                break;
            case 'settings':
                const project = this.projects.find(p => p.id === this.currentProjectId);
                if (project?.name === 'Главный офис') {
                    SettingsManager.showStaffManagement(this.currentProjectId);
                    this.setSettingsActive('hr');
                } else {
                    await SettingsManager.showProjectSettings(this.currentProjectId);
                    this.setSettingsActive('project');
                }
                break;
        }

        this.updateBreadcrumbs();
        UI.hideTurboLoader();
    }

    updateBreadcrumbs(extraItems = []) {
        const breadcrumbs = document.getElementById('breadcrumbs-bar');
        if (!breadcrumbs) return;

        // Если мы на вкладке "Смета" и нет явных элементов, попробуем взять кэш из EstimateManager
        if (this.currentRibbonTab === 'estimate' && (!extraItems || extraItems.length === 0)) {
            if (window.EstimateManager?.cachedBreadcrumbItems?.length) {
                extraItems = window.EstimateManager.cachedBreadcrumbItems;
            } else {
                // Пробуем взять из localStorage, чтобы восстановить после полной перезагрузки
                try {
                    const raw = localStorage.getItem('probim_breadcrumb_cache');
                    const parsed = raw ? JSON.parse(raw) : [];
                    if (Array.isArray(parsed) && parsed.length) {
                        extraItems = parsed;
                        if (window.EstimateManager) window.EstimateManager.cachedBreadcrumbItems = parsed;
                    }
                } catch (e) {
                    console.warn('Could not restore breadcrumbs cache', e);
                }
            }
        }

        const project = this.projects.find(p => p.id === this.currentProjectId);
        const projectName = project?.name || 'Проект';
        const isMainOffice = project?.name === 'Главный офис';

        const projectIcon = isMainOffice ? `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: text-bottom; opacity: 0.8;">
                <path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/>
                <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/>
                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>
            </svg>` : '';

        let html = '';

        // 1. Project Name (Static)
        html += `<span class="breadcrumb-item" style="color: var(--gray-500); cursor: default; display: flex; align-items: center;">${projectIcon}${projectName}</span>`;
        html += `<span class="breadcrumb-separator">/</span>`;

        // 2. Main (Главная)
        const isDashboardStats = this.currentRibbonTab === 'dashboard' && this.currentDashboardSubTab === 'statistics';

        if (isDashboardStats) {
            html += `<span class="breadcrumb-item active">Главная</span>`;
        } else {
            // "Главная" click -> Go to Dashboard Statistics
            html += `<span class="breadcrumb-item clickable" onclick="app.loadStatisticsTab()" style="cursor: pointer; color: var(--primary-color);">Главная</span>`;
        }

        // 3. Tab / Sub-tab Logic
        if (!isDashboardStats) {
            html += `<span class="breadcrumb-separator">/</span>`;

            let label = '';
            let isLast = extraItems.length === 0;

            if (this.currentRibbonTab === 'dashboard') {
                if (this.currentDashboardSubTab === 'org-structure') label = 'Структура';
                else if (this.currentDashboardSubTab === 'cameras') label = 'Камеры';
            }
            else if (this.currentRibbonTab === 'estimate') {
                label = 'Смета';
            }
            else if (this.currentRibbonTab === 'tender') label = 'Тендер';
            else if (this.currentRibbonTab === 'schedule') label = 'График';
            else if (this.currentRibbonTab === 'legal') label = 'Юридический отдел';
            else if (this.currentRibbonTab === 'monitoring') label = 'Мониторинг 3Д';
            else if (this.currentRibbonTab === 'gpr') label = 'ГПР';
            else if (this.currentRibbonTab === 'supply') label = 'Снабжение';
            else if (this.currentRibbonTab === 'finance') label = 'Финансы';
            else if (this.currentRibbonTab === 'otitb') {
                if (this.otitbActive === 'permit') label = 'Наряд допуск';
                else if (this.otitbActive === 'instructions') label = 'Инструкции';
                else if (this.otitbActive === 'worktypes') label = 'Виды работ';
                else label = 'ОТ и ТБ';
            }
            else if (this.currentRibbonTab === 'timesheet') {
                label = 'Табель';
            }
            else if (this.currentRibbonTab === 'ui-kit') {
                label = 'UI Kit';
            }
            else if (this.currentRibbonTab === 'settings') {
                if (document.getElementById('subcontractors-btn')?.classList.contains('active')) label = 'Субподряд';
                else if (document.getElementById('hr-management-btn')?.classList.contains('active')) label = 'Штат (Кадры)';
                else label = isMainOffice ? 'Настройки компании' : 'Настройки проекта';
            }
            else if (this.currentRibbonTab === 'norms-settings') {
                label = 'Настройки норм';
            }

            if (label) {
                // Для вкладки "Смета" делаем кликабельным только если это не последний элемент и есть дерево смет
                if (this.currentRibbonTab === 'estimate' && !isLast) {
                    html += `<span class="breadcrumb-item clickable" onclick="EstimateManager.renderEstimateTree(app.currentProjectId)" style="cursor: pointer; color: var(--primary-color);">${label}</span>`;
                } else {
                    html += `<span class="breadcrumb-item ${isLast ? 'active' : ''}">${label}</span>`;
                }
            }
        }

        // 4. Extra Items (from nested managers)
        extraItems.forEach((item, index) => {
            html += `<span class="breadcrumb-separator">/</span>`;
            const isItemLast = index === extraItems.length - 1;

            if (item.onClick && !isItemLast) {
                // We need to attach the handler globally or use a closure.
                // Since this re-renders, a global handler id is safest.
                const handlerId = `bc_handler_${Date.now()}_${index}`;
                window[handlerId] = item.onClick;
                html += `<span class="breadcrumb-item clickable" onclick="window['${handlerId}']()" style="cursor: pointer; color: var(--primary-color);">${item.text}</span>`;
            } else {
                html += `<span class="breadcrumb-item active">${item.text}</span>`;
            }
        });

        breadcrumbs.innerHTML = html;
    }

    async loadScheduleTab() {
        if (!this.currentProjectId) return;

        const contentArea = document.getElementById('content-area');

        // Update ribbon button states
        const ganttBtn = document.getElementById('schedule-mode-gantt-btn');
        const mode3dBtn = document.getElementById('schedule-mode-3d-btn');

        if (ganttBtn) ganttBtn.classList.toggle('active', this.scheduleMode === 'gantt');
        if (mode3dBtn) mode3dBtn.classList.toggle('active', this.scheduleMode === '3d');

        if (this.scheduleMode === '3d') {
            contentArea.style.padding = '0';
            contentArea.innerHTML = `<div id="monitoring-pane" style="width:100%; height:100%;"></div>`;
            if (window.MonitoringManager) {
                await MonitoringManager.init(this.currentProjectId);
            }
        } else {
            contentArea.style.padding = '';
            ScheduleManager.init(this.currentProjectId);
        }

        this.updateBreadcrumbs();
    }

    loadGPRTab() {
        if (this.currentProjectId) {
            GPRManager.init(this.currentProjectId);
        }
        this.updateBreadcrumbs();
    }

    loadTenderTab() {
        const contentArea = document.getElementById('content-area');
        const projectId = this.currentProjectId;
        const iframe = document.createElement('iframe');
        iframe.id = 'tender-frame';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

        iframe.onload = () => {
            if (iframe.contentWindow.initApi) {
                iframe.contentWindow.initApi({
                    getBlocks: () => window.api.getBlocks(projectId),
                    getEstimates: (blockId) => window.api.getEstimates(projectId, blockId),
                    getSections: (estimateId) => window.api.getSections(estimateId),
                    getStages: (sectionId) => window.api.getStages(sectionId),
                    getWorkTypes: (stageId) => window.api.getWorkTypes(stageId),
                    getResources: (workTypeId) => window.api.getResources(workTypeId),
                    getSubcontractors: () => window.api.getSubcontractors(projectId),
                    getTenders: () => window.api.getTenders(projectId),
                    createTender: (data) => window.api.createTender({ ...data, projectId: projectId }),
                    createTenderInvite: (tenderId, subcontractorId) => window.api.createTenderInvite(tenderId, subcontractorId),
                    toggleBidBlock: (bidId, blocked, reason) => window.api.toggleBidBlock(bidId, blocked, reason),
                    selectWinner: (bidId) => window.api.selectWinner(bidId),
                    createContract: (bidId) => window.api.createContract(bidId),
                    cancelContract: (bidId) => window.api.cancelContract(bidId),
                    deleteTender: (id) => window.api.deleteTender(id),
                    getProject: (id) => window.api.getProject(id)
                });
            }
        };

        iframe.src = 'tender-prototype.html';
        contentArea.innerHTML = '';
        contentArea.appendChild(iframe);
        this.updateBreadcrumbs();
    }

    setTenderFilter(filter) {
        // Update ribbon UI
        const buttons = {
            'all': 'ribbon-tender-all',
            'open': 'ribbon-tender-open',
            'closed': 'ribbon-tender-closed'
        };

        Object.keys(buttons).forEach(key => {
            const btn = document.getElementById(buttons[key]);
            if (btn) {
                if (key === filter) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });

        // Call iframe
        const iframe = document.getElementById('tender-frame');
        if (iframe && iframe.contentWindow && typeof iframe.contentWindow.updateLotFilter === 'function') {
            iframe.contentWindow.updateLotFilter(filter);
        }
    }

    loadUiKitTab() {
        this.currentRibbonTab = 'ui-kit';
        this.applyRibbonTabToUI('ui-kit');

        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.style.padding = '0';
            contentArea.innerHTML = `
                <iframe id="ui-kit-frame" src="ui-kit.html" style="width: 100%; height: 100%; border: none;"></iframe>
            `;
        }

        this.updateBreadcrumbs();
    }

    loadSupplyTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2>Снабжение</h2>
                <p style="margin-top: 16px; color: var(--gray-600);">Функционал в разработке...</p>
            </div>
        `;
        this.updateBreadcrumbs();
    }

    setLegalSubTab(subTab) {
        this.currentLegalSubTab = subTab;

        // Update ribbon UI
        const btnIds = {
            'inbox': 'btn-legal-inbox',
            'outbox': 'btn-legal-outbox',
            'drafts': 'btn-legal-drafts',
            'templates': 'btn-legal-templates',
            'contracts': 'btn-legal-contracts',
            'base': 'btn-legal-base'
        };

        Object.values(btnIds).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('active');
        });

        const activeBtn = document.getElementById(btnIds[subTab]);
        if (activeBtn) activeBtn.classList.add('active');

        // Reset filter when switching sub-tabs
        this.legalStatusFilter = 'all';

        this.loadLegalTab();
    }

    setLegalStatusFilter(filter) {
        this.legalStatusFilter = filter;
        this.loadLegalTab();
    }

    handleLegalSearch() {
        const input = document.getElementById('legal-search-input');
        if (input) {
            this.legalSearchQuery = input.value.trim();
            this.loadLegalTab();
            // Focus back to input after re-render
            setTimeout(() => {
                const newInput = document.getElementById('legal-search-input');
                if (newInput) {
                    newInput.focus();
                    newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
                }
            }, 10);
        }
    }

    toggleLegalFilterPanel() {
        this.legalFilterPanelVisible = !this.legalFilterPanelVisible;
        // Close dropdowns when closing panel
        if (!this.legalFilterPanelVisible) {
            this.legalDropdowns.docType = false;
            this.legalDropdowns.status = false;
        }
        this.loadLegalTab();

        // Focus on INN input if panel opened
        if (this.legalFilterPanelVisible) {
            setTimeout(() => {
                const innInput = document.getElementById('legal-filter-inn');
                if (innInput) {
                    innInput.focus();
                    // Move cursor to end if there's already a value
                    innInput.selectionStart = innInput.selectionEnd = innInput.value.length;
                }
            }, 300); // Wait for slide animation to start/complete a bit
        }
    }

    toggleLegalDropdown(name, event) {
        if (event) event.stopPropagation();
        // Close others
        for (let key in this.legalDropdowns) {
            if (key !== name) this.legalDropdowns[key] = false;
        }
        this.legalDropdowns[name] = !this.legalDropdowns[name];
        this.loadLegalTab();
    }

    setLegalFilterValue(key, value) {
        this.legalFilters[key] = value;
        this.legalDropdowns.docType = false;
        this.legalDropdowns.status = false;
        this.loadLegalTab();
    }

    resetLegalFilters() {
        this.legalFilters = {
            docType: 'all',
            status: 'all',
            priceFrom: '',
            priceTo: '',
            contractNo: '',
            inn: '',
            docDate: ''
        };
        this.legalSearchQuery = '';
        this.loadLegalTab();
        UI.showNotification('Фильтры сброшены', 'info');
    }

    openLegalTemplateEditor() {
        this.editingLegalTemplateId = null;
        this.legalTemplateData = {
            name: '',
            city: 'г. Ташкент',
            docType: 'contract_nk',
            partyA: { name: 'OOO "PROBIM"', inn: '309272383', mfo: '01095', bank: 'ТОШКЕНТ Ш., "ASIA ALLIANCE BANK"' },
            partyB: { name: '', inn: '', mfo: '', bank: '' }
        };
        this.legalEditorDropdowns = {
            docType: false,
            city: false
        };
        this.legalTemplateSections = [
            { id: 1, title: '1. ПРЕДМЕТ ДОГОВОРА', text: '' },
            { id: 2, title: '2. СТОИМОСТЬ РАБОТ И ПОРЯДОК РАСЧЕТА', text: '' },
            { id: 3, title: '3. ОБЯЗАТЕЛЬСТВА СТОРОН', text: '' },
            { id: 4, title: '4. ОТВЕТСТВЕННОСТЬ СТОРОН', text: '' },
            { id: 5, title: '5. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ', text: '' },
            { id: 6, title: '6. ПРОЧИЕ УСЛОВИЯ', text: '' },
            { id: 7, title: '7. ЮРИДИЧЕСКИЕ АДРЕСА, БАНКОВСКИЕ РЕКВИЗИТЫ И ПОДПИСИ СТОРОН', text: '' }
        ];
        this.legalTemplateEditorVisible = true;
        this.loadLegalTab();
    }

    toggleLegalEditorDropdown(dropdown, event) {
        if (event) event.stopPropagation();
        this.legalEditorDropdowns[dropdown] = !this.legalEditorDropdowns[dropdown];
        this.renderLegalTemplateEditor();
    }

    setLegalTemplateDocType(type) {
        this.legalTemplateData.docType = type;
        this.legalEditorDropdowns.docType = false;
        this.renderLegalTemplateEditor();
    }

    setLegalTemplateCity(city) {
        this.legalTemplateData.city = city;
        this.legalEditorDropdowns.city = false;
        this.renderLegalTemplateEditor();
    }

    async editLegalTemplate(templateId) {
        try {
            const template = await api.getLegalTemplate(templateId);
            this.editingLegalTemplateId = templateId;
            this.legalTemplateData = {
                name: template.name,
                city: template.city || 'г. Ташкент',
                docType: template.docType || 'contract_nk',
                partyA: {
                    name: template.partyAName || 'OOO "PROBIM"',
                    inn: template.partyAinn || '309272383',
                    mfo: template.partyAmfo || '01095',
                    bank: template.partyAbank || 'ТОШКЕНТ Ш., "ASIA ALLIANCE BANK"'
                },
                partyB: {
                    name: template.partyBName || '',
                    inn: template.partyBinn || '',
                    mfo: template.partyBmfo || '',
                    bank: template.partyBbank || ''
                }
            };

            // Parse sections if it's a JSON string
            if (typeof template.sections === 'string') {
                try {
                    this.legalTemplateSections = JSON.parse(template.sections);
                } catch (e) {
                    console.error('Error parsing template sections:', e);
                    this.legalTemplateSections = [];
                }
            } else {
                this.legalTemplateSections = template.sections || [];
            }

            this.legalTemplateEditorVisible = true;
            this.loadLegalTab();
        } catch (error) {
            console.error('Error loading template for edit:', error);
            UI.showNotification('Ошибка при загрузке шаблона: ' + error.message, 'error');
        }
    }

    closeLegalTemplateEditor() {
        this.legalTemplateEditorVisible = false;
        this.editingLegalTemplateId = null;
        this.loadLegalTab();
    }

    selectLegalTemplateType(type) {
        this.selectedLegalTemplateType = type;
        this.loadLegalTab();
    }

    addLegalTemplateSection(afterId) {
        const newId = Date.now();
        const newSection = {
            id: newId,
            title: `НОВЫЙ РАЗДЕЛ`,
            text: ''
        };

        if (afterId) {
            const index = this.legalTemplateSections.findIndex(s => s.id === afterId);
            if (index !== -1) {
                this.legalTemplateSections.splice(index + 1, 0, newSection);
            } else {
                this.legalTemplateSections.push(newSection);
            }
        } else {
            this.legalTemplateSections.push(newSection);
        }

        this.renderLegalTemplateEditor();

        // Scroll to new section
        setTimeout(() => {
            const el = document.getElementById(`section-${newId}`);
            if (el) {
                // Use block: 'center' with behavior smooth, but ensure container doesn't jump
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.boxShadow = '0 0 0 3px rgba(32, 115, 69, 0.2)';
                el.style.borderRadius = '4px';
                setTimeout(() => { if (el) el.style.boxShadow = 'none'; }, 2000);
            }
        }, 50);
    }

    removeLegalTemplateSection(id) {
        if (this.legalTemplateSections.length <= 1) {
            UI.showNotification('Должен быть хотя бы один раздел', 'warning');
            return;
        }
        this.legalTemplateSections = this.legalTemplateSections.filter(s => s.id !== id);
        this.renderLegalTemplateEditor();
    }

    async saveLegalTemplate() {
        try {
            const data = {
                projectId: this.currentProjectId,
                name: document.getElementById('legal-doc-name')?.value || 'БЕЗ НАЗВАНИЯ',
                city: this.legalTemplateData.city || 'г. Ташкент',
                docType: this.legalTemplateData.docType || 'contract_nk',
                partyA: {
                    name: document.getElementById('legal-party-a-name')?.value || '',
                    inn: document.getElementById('legal-party-a-inn')?.value || '',
                    mfo: document.getElementById('legal-party-a-mfo')?.value || '',
                    bank: document.getElementById('legal-party-a-bank')?.value || ''
                },
                partyB: {
                    name: document.getElementById('legal-party-b-name')?.value || '',
                    inn: document.getElementById('legal-party-b-inn')?.value || '',
                    mfo: document.getElementById('legal-party-b-mfo')?.value || '',
                    bank: document.getElementById('legal-party-b-bank')?.value || ''
                },
                sections: this.legalTemplateSections
            };

            UI.showNotification('Сохранение...', 'info');

            if (this.editingLegalTemplateId) {
                await api.updateLegalTemplate(this.editingLegalTemplateId, data);
                UI.showNotification('Шаблон успешно обновлен', 'success');
            } else {
                await api.createLegalTemplate(data);
                UI.showNotification('Шаблон успешно сохранен', 'success');
            }

            // Close modal if open
            const modal = document.getElementById('legal-preview-modal');
            if (modal) modal.remove();

            this.closeLegalTemplateEditor();
        } catch (error) {
            console.error('Error saving template:', error);
            UI.showNotification('Ошибка при сохранении: ' + error.message, 'error');
        }
    }

    previewLegalTemplate() {
        const data = {
            name: document.getElementById('legal-doc-name')?.value || 'БЕЗ НАЗВАНИЯ',
            city: this.legalTemplateData.city || 'г. Ташкент',
            partyA: {
                name: document.getElementById('legal-party-a-name')?.value || '',
                inn: document.getElementById('legal-party-a-inn')?.value || '',
                mfo: document.getElementById('legal-party-a-mfo')?.value || '',
                bank: document.getElementById('legal-party-a-bank')?.value || ''
            },
            partyB: {
                name: document.getElementById('legal-party-b-name')?.value || '',
                inn: document.getElementById('legal-party-b-inn')?.value || '',
                mfo: document.getElementById('legal-party-b-mfo')?.value || '',
                bank: document.getElementById('legal-party-b-bank')?.value || ''
            },
            sections: this.legalTemplateSections
        };

        this.showLegalPreviewModal(data);
    }

    showLegalPreviewModal(data) {
        const modal = document.createElement('div');
        modal.id = 'legal-preview-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); z-index: 9999; display: flex; 
            align-items: center; justify-content: center; backdrop-filter: blur(4px);
        `;

        const content = `
            <div style="background: #fff; width: 90%; max-width: 800px; height: 90%; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
                <!-- Modal Header -->
                <div style="padding: 16px 24px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 400; color: #1a202c;">Предварительный просмотр документа</h3>
                    <button onclick="document.getElementById('legal-preview-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #a0aec0;">&times;</button>
                </div>
                
                <!-- Modal Body (Continuous White Paper) -->
                <div style="flex: 1; overflow-y: auto; background: #fff; display: flex; justify-content: center;">
                    <div style="width: 100%; max-width: 800px; padding: 60px 80px; font-family: 'Times New Roman', serif; color: #000; line-height: 1.6; background: #fff;">
                        <!-- Doc Header -->
                        <div style="text-align: center; margin-bottom: 40px;">
                            <h1 style="font-size: 15px; font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #000; display: inline-block; padding-bottom: 8px; margin-bottom: 20px;">${data.name}</h1>
                            <div style="display: flex; justify-content: space-between; font-size: 15px; margin-top: 10px;">
                                <span>${data.city}</span>
                                <span>«___» __________ 202___ г.</span>
                            </div>
                        </div>

                        <!-- Sections -->
                        <div style="font-size: 15px; margin-bottom: 80px;">
                            ${data.sections.map(s => `
                                <div style="margin-bottom: 32px;">
                                    <h4 style="margin: 0 0 15px 0; font-size: 15px; text-transform: uppercase; text-align: center; font-weight: bold;">${s.title}</h4>
                                    <div style="text-align: justify; white-space: pre-wrap; font-size: 15px;">${s.text}</div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Parties Requisites -->
                        <div style="display: flex; justify-content: space-between; gap: 60px; margin-bottom: 30px; font-size: 14px; border-top: 1.5px solid #000; padding-top: 30px;">
                            <div style="flex: 1;">
                                <strong style="display: block; margin-bottom: 15px; text-transform: uppercase;">Заказчик:</strong>
                                <div style="line-height: 1.8;">
                                    ${data.partyA.name}<br>
                                    ИНН: ${data.partyA.inn}<br>
                                    Банк: ${data.partyA.bank}<br>
                                    МФО: ${data.partyA.mfo}
                                </div>
                            </div>
                            <div style="flex: 1;">
                                <strong style="display: block; margin-bottom: 15px; text-transform: uppercase;">Исполнитель:</strong>
                                <div style="line-height: 1.8;">
                                    ${data.partyB.name || '___________'}<br>
                                    ИНН: ${data.partyB.inn || '___________'}<br>
                                    Банк: ${data.partyB.bank || '___________'}<br>
                                    МФО: ${data.partyB.mfo || '___________'}
                                </div>
                            </div>
                        </div>

                        <!-- Signatures -->
                        <div style="display: flex; justify-content: space-between; gap: 60px;">
                            <div style="flex: 1; border-top: 1px solid #000; padding-top: 15px; font-size: 13px; text-align: center;">
                                (Подпись ЗАКАЗЧИКА)
                            </div>
                            <div style="flex: 1; border-top: 1px solid #000; padding-top: 15px; font-size: 13px; text-align: center;">
                                (Подпись ИСПОЛНИТЕЛЯ)
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div style="padding: 16px 24px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px; background: #fff;">
                    <button onclick="document.getElementById('legal-preview-modal').remove()" style="padding: 10px 24px; border-radius: 4px; border: 1px solid #d1d5db; background: #fff; font-weight: 700; cursor: pointer; color: #4b5563;">Закрыть</button>
                    <button onclick="app.saveLegalTemplate()" style="padding: 10px 24px; border-radius: 4px; border: none; background: #207245; color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 4px 10px rgba(32, 114, 69, 0.2);">Сохранить документ</button>
                </div>
            </div>
        `;

        modal.innerHTML = content;
        document.body.appendChild(modal);
    }

    async viewLegalTemplate(templateId) {
        try {
            const template = await api.getLegalTemplate(templateId);
            const sections = JSON.parse(template.sections);

            const data = {
                name: template.name,
                city: template.city || 'г. Ташкент',
                partyA: {
                    name: template.partyAName || '',
                    inn: template.partyAinn || '',
                    mfo: template.partyAmfo || '',
                    bank: template.partyAbank || ''
                },
                partyB: {
                    name: template.partyBName || '',
                    inn: template.partyBinn || '',
                    mfo: template.partyBmfo || '',
                    bank: template.partyBbank || ''
                },
                sections: sections
            };

            this.showLegalPreviewModal(data);
        } catch (error) {
            console.error('Error viewing template:', error);
            UI.showNotification('Ошибка загрузки шаблона: ' + error.message, 'error');
        }
    }

    async deleteLegalTemplate(templateId) {
        if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) {
            return;
        }

        try {
            await api.deleteLegalTemplate(templateId);
            UI.showNotification('Шаблон успешно удален', 'success');
            this.loadLegalTab();
        } catch (error) {
            console.error('Error deleting template:', error);
            UI.showNotification('Ошибка при удалении шаблона: ' + error.message, 'error');
        }
    }

    renderLegalTemplateEditor() {
        const contentArea = document.getElementById('content-area');
        contentArea.style.padding = '0';

        // Only Contract (NK) for now
        const templateTypes = [
            { id: 'contract_nk', name: 'Договор (НК)', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>' }
        ];

        const selectedType = templateTypes.find(t => t.id === this.selectedLegalTemplateType) || templateTypes[0];

        contentArea.innerHTML = `
            <div id="legal-template-editor-container" style="display: flex; height: 100%; background: #fdfdfd; overflow: hidden; font-family: 'Inter', sans-serif;">
                <style>
                    #legal-template-editor-container {
                        font-family: 'Inter', sans-serif !important;
                        color: #2d3748;
                    }
                    #legal-template-editor-container input, 
                    #legal-template-editor-container textarea {
                        font-family: 'Inter', sans-serif !important;
                        font-size: 13px !important;
                        padding: 10px 14px !important;
                        border: 1.5px solid #e2e8f0 !important;
                        border-radius: 4px !important;
                        color: #2d3748 !important;
                        outline: none !important;
                        transition: border-color 0.2s !important;
                    }
                    #legal-template-editor-container input:focus, 
                    #legal-template-editor-container textarea:focus {
                        border-color: var(--primary) !important;
                    }
                    #legal-template-editor-container label {
                        font-family: 'Inter', sans-serif !important;
                        font-size: 11px !important;
                        font-weight: 700 !important;
                        color: #718096 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.02em !important;
                    }
                    #legal-template-editor-container .section-title-input {
                        font-weight: 700 !important;
                        font-size: 14px !important;
                    }
                    #legal-template-editor-container .card-panel {
                        background: #fff;
                        border: 1px solid #edf2f7;
                        border-radius: 4px;
                        padding: 24px;
                        margin-bottom: 24px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    }
                </style>
                <!-- Main Editor Area -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; background: #fff;">
                    
                    <!-- Header Actions -->
                    <div style="height: 56px; border-bottom: 1px solid #edf2f7; display: flex; align-items: center; padding: 0 24px; justify-content: space-between; flex-shrink: 0; background: #fff;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <button onclick="app.closeLegalTemplateEditor()" style="display: flex; align-items: center; gap: 8px; background: none; border: none; color: #718096; cursor: pointer; font-size: 13px; font-weight: 600; padding: 6px 10px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                Назад
                            </button>
                            <div style="height: 20px; width: 1px; background: #e2e8f0;"></div>
                            <h2 style="margin: 0; font-size: 13px; font-weight: 400; color: #4a5568;">Тип документа: <span style="color: var(--primary);">${selectedType.name}</span></h2>
                        </div>
                        
                        <!-- Top Action Buttons -->
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button style="padding: 8px 18px; font-weight: 700; border-radius: 4px; background: #207245; color: #fff; border: none; box-shadow: 0 4px 10px rgba(32, 114, 69, 0.2); cursor: pointer; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 5px 14px rgba(32, 114, 69, 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 10px rgba(32, 114, 69, 0.2)'" onclick="app.previewLegalTemplate()">Предварительный просмотр и сохранить</button>
                        </div>
                    </div>

                    <!-- Scrollable Content -->
                    <div style="flex: 1; overflow-y: auto; padding: 24px; background: #f8fafc;">
                        <div style="width: 100%; margin: 0 auto; max-width: 1200px;">

                             <!-- Document Meta Form -->
                            <div class="card-panel" style="padding: 20px;">
                                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
                                    <div style="position: relative;">
                                        <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px; color: var(--primary); z-index: 1;">Наименование документа*</label>
                                        <input type="text" id="legal-doc-name" placeholder="Введите название..." style="width: 100%;" value="${this.legalTemplateData.name || ''}">
                                    </div>
                                    <div style="position: relative;">
                                        <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px; color: var(--primary); z-index: 1;">Город</label>
                                        <div onclick="app.toggleLegalEditorDropdown('city', event)" style="width: 100%; height: 41px; border: 1.5px solid #e2e8f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; cursor: pointer; background: #fff; font-size: 13px;">
                                            <span>${this.legalTemplateData.city || 'Выберите город...'}</span>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                        
                                        <div style="display: ${this.legalEditorDropdowns.city ? 'block' : 'none'}; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; padding: 4px 0; max-height: 250px; overflow-y: auto;">
                                            ${this.uzbekistanCities.map(city => `
                                                <div onclick="app.setLegalTemplateCity('${city}')" style="padding: 10px 14px; font-size: 13px; cursor: pointer; transition: background 0.2s; background: ${this.legalTemplateData.city === city ? '#f8fafc' : 'transparent'}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${this.legalTemplateData.city === city ? '#f8fafc' : 'transparent'}'">${city}</div>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div style="position: relative;">
                                        <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px; color: var(--primary); z-index: 1;">Тип документа</label>
                                        <div onclick="app.toggleLegalEditorDropdown('docType', event)" style="width: 100%; height: 41px; border: 1.5px solid #e2e8f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; cursor: pointer; background: #fff; font-size: 13px;">
                                            <span>${this.legalTemplateData.docType === 'contract_nk' ? 'Договор (НК)' : this.legalTemplateData.docType}</span>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                        
                                        <div id="legal-editor-doctype-menu" style="display: ${this.legalEditorDropdowns.docType ? 'block' : 'none'}; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; padding: 4px 0;">
                                            <div onclick="app.setLegalTemplateDocType('contract_nk')" style="padding: 10px 14px; font-size: 13px; cursor: pointer; transition: background 0.2s; background: ${this.legalTemplateData.docType === 'contract_nk' ? '#f8fafc' : 'transparent'}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${this.legalTemplateData.docType === 'contract_nk' ? '#f8fafc' : 'transparent'}'">Договор (НК)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Parties Information -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                                <!-- Party A (Your Company) -->
                                <div class="card-panel" style="margin-bottom: 0;">
                                    <h4 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 800; color: #2d3748;">Ваши сведения</h4>
                                    <div style="flex-direction: column; display: flex; gap: 20px;">
                                        <div style="position: relative;">
                                            <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px;">ИНН/ПИНФЛ</label>
                                            <input type="text" id="legal-party-a-inn" value="${this.legalTemplateData.partyA.inn}" style="width: 100%; background: #f8fafc; border-color: #f1f5f9 !important;" readonly>
                                        </div>
                                        <div style="position: relative;">
                                            <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px;">Наименование организации</label>
                                            <input type="text" id="legal-party-a-name" value='${this.legalTemplateData.partyA.name}' style="width: 100%; background: #f8fafc; border-color: #f1f5f9 !important;" readonly>
                                        </div>
                                        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 16px;">
                                            <div style="position: relative;">
                                                <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px;">МФО</label>
                                                <input type="text" id="legal-party-a-mfo" value="${this.legalTemplateData.partyA.mfo}" style="width: 100%;">
                                            </div>
                                            <div style="position: relative;">
                                                <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px;">Банк</label>
                                                <input type="text" id="legal-party-a-bank" value='${this.legalTemplateData.partyA.bank}' style="width: 100%;">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Party B (Partner) -->
                                <div class="card-panel" style="margin-bottom: 0;">
                                    <h4 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 800; color: #2d3748;">Сведения партнера</h4>
                                    <div style="flex-direction: column; display: flex; gap: 20px;">
                                        <div style="position: relative;">
                                            <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px; color: var(--primary);">ИНН/ПИНФЛ*</label>
                                            <input type="text" id="legal-party-b-inn" placeholder="Введите ИНН..." style="width: 100%;" value="${this.legalTemplateData.partyB.inn || ''}">
                                        </div>
                                        <div style="position: relative;">
                                            <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px; color: var(--primary);">Наименование организации*</label>
                                            <input type="text" id="legal-party-b-name" placeholder="Введите название..." style="width: 100%;" value="${this.legalTemplateData.partyB.name || ''}">
                                        </div>
                                        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 16px;">
                                            <div style="position: relative;">
                                                <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px;">МФО</label>
                                                <input type="text" id="legal-party-b-mfo" placeholder="..." style="width: 100%;" value="${this.legalTemplateData.partyB.mfo || ''}">
                                            </div>
                                            <div style="position: relative;">
                                                <label style="position: absolute; top: -8px; left: 12px; background: #fff; padding: 0 6px;">Банк</label>
                                                <input type="text" id="legal-party-b-bank" placeholder="..." style="width: 100%;" value="${this.legalTemplateData.partyB.bank || ''}">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Document Content Sections -->
                            <div class="card-panel" style="padding: 32px;">
                                <h4 style="margin: 0 0 24px 0; font-size: 16px; font-weight: 800; color: #1a202c;">Содержание договора</h4>
                                
                                <div style="display: flex; flex-direction: column; gap: 24px;">
                                    ${this.legalTemplateSections.map(section => `
                                        <div id="section-${section.id}" style="position: relative; padding: 20px; border: 1.5px solid #edf2f7; border-radius: 4px; background: #fdfdfd; transition: all 0.2s;">
                                            <div style="display: flex; gap: 12px; align-items: flex-end; margin-bottom: 16px;">
                                                <div style="flex: 1;">
                                                    <label style="display: block; margin-bottom: 8px; padding-left: 4px;">Заголовок раздела</label>
                                                    <input type="text" class="section-title-input" value="${section.title}" oninput="const s = app.legalTemplateSections.find(x => x.id === ${section.id}); if(s) s.title = this.value" style="width: 100%;">
                                                </div>
                                                <div style="display: flex; gap: 6px;">
                                                    <button onclick="app.addLegalTemplateSection(${section.id})" title="Добавить раздел" style="width: 38px; height: 38px; border-radius: 4px; border: 1.5px solid #207245; background: #fff; color: #207245; font-size: 18px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#207245'; this.style.color='#fff'" onmouseout="this.style.background='#fff'; this.style.color='#207245'">+</button>
                                                    <button onclick="app.removeLegalTemplateSection(${section.id})" title="Удалить раздел" style="width: 38px; height: 38px; border-radius: 4px; border: 1.5px solid #fca5a5; background: #fff; color: #ef4444; font-size: 18px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff'" onmouseout="this.style.background='#fff'; this.style.color='#ef4444'">-</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label style="display: block; margin-bottom: 8px; padding-left: 4px;">Текст раздела</label>
                                                <textarea oninput="const s = app.legalTemplateSections.find(x => x.id === ${section.id}); if(s) s.text = this.value" style="width: 100%; font-size: 13px; line-height: 1.6; min-height: 100px; resize: vertical; background: #fff;">${section.text}</textarea>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Extra Padding -->
                            <div style="height: 60px;"></div>

                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    toggleLegalActionsMenu(event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById('legal-actions-menu');
        if (menu) {
            const isVisible = menu.style.display === 'block';
            menu.style.display = isVisible ? 'none' : 'block';
        }
    }

    toggleAllLegalDocuments(master) {
        const checkboxes = document.querySelectorAll('.legal-row-checkbox');
        checkboxes.forEach(cb => cb.checked = master.checked);
        UI.showNotification(master.checked ? 'Выбраны все документы' : 'Выбор снят', 'info');
    }

    copyToClipboard(text, label = 'Текст') {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            UI.showNotification(`${label} скопирован в буфер обмена`, 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            UI.showNotification('Ошибка копирования', 'error');
        });
    }

    async loadLegalTab() {
        if (!this.currentProjectId) return;

        if (this.legalTemplateEditorVisible) {
            this.renderLegalTemplateEditor();
            return;
        }

        const subTitles = {
            'inbox': 'Входящие документы',
            'outbox': 'Исходящие документы',
            'drafts': 'Черновики',
            'templates': 'Шаблоны документов',
            'contracts': 'Реестр договоров',
            'base': 'Правовая база'
        };

        const contentArea = document.getElementById('content-area');
        contentArea.style.padding = '24px';

        if (this.currentLegalSubTab === 'inbox' || this.currentLegalSubTab === 'outbox') {
            const title = this.currentLegalSubTab === 'inbox' ? 'Входящие' : 'Исходящие';
            contentArea.innerHTML = `
                <div style="background: var(--white); border-radius: 4px; height: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-200); overflow: hidden;">
                    <style>
                        .legal-table-row { cursor: pointer; transition: all 0.2s ease; }
                        .legal-table-row:hover { background-color: rgba(34, 197, 94, 0.05) !important; }
                        
                        /* Custom Checkbox Styling */
                        .legal-row-checkbox, #legal-select-all {
                            appearance: none;
                            -webkit-appearance: none;
                            width: 16px;
                            height: 16px;
                            border: 1px solid transparent; /* Transparent by default */
                            border-radius: 2px;
                            background: #fff;
                            cursor: pointer;
                            position: relative;
                            transition: border-color 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 auto;
                            outline: none;
                        }

                        /* Header checkbox border always visible slightly or also transparent? 
                           User said "границы checkbox будет прозрачным" - likely applies to all inbox checkboxes. */
                        
                        .legal-table-row:hover .legal-row-checkbox,
                        #legal-actions-toggle:hover,
                        #legal-select-all:hover {
                            border-color: var(--gray-300);
                        }

                        .legal-row-checkbox:checked, #legal-select-all:checked {
                            background: var(--primary);
                            border-color: var(--primary);
                        }

                        .legal-row-checkbox:checked::after, #legal-select-all:checked::after {
                            content: '';
                            position: absolute;
                            width: 4px;
                            height: 8px;
                            border: solid white;
                            border-width: 0 2px 2px 0;
                            transform: rotate(45deg);
                            top: 2px;
                        }

                        /* Search Modern Styling */
                        .legal-search-container {
                            flex: 1;
                            max-width: 500px;
                            position: relative;
                            display: flex;
                            align-items: center;
                            background: #f8f9fb;
                            border: 1px solid var(--gray-200);
                            border-radius: 8px;
                            padding: 0 14px;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        }

                        .legal-search-container:hover {
                            border-color: var(--gray-300);
                            background: #f1f3f7;
                        }

                        .legal-search-container:focus-within {
                            background: #fff;
                            border-color: var(--primary);
                            box-shadow: 0 0 0 3px rgba(32, 115, 69, 0.1);
                        }

                        .legal-search-container svg {
                            transition: stroke 0.2s;
                        }

                        .legal-search-container:focus-within svg {
                            stroke: var(--primary);
                        }

                        .legal-search-input {
                            flex: 1;
                            height: 38px;
                            border: none;
                            background: transparent;
                            padding: 0 12px;
                            font-size: 13px;
                            color: var(--gray-900);
                            outline: none;
                        }

                        .legal-search-input::placeholder {
                            color: var(--gray-400);
                        }
                    </style>
                    
                    <!-- Fixed Top Header Section -->
                    <div style="padding: 24px 24px 0 24px; background: var(--white); z-index: 10;">
                        <!-- Header Row: Title + Search (Expanding) + Actions (Right Aligned) -->
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--gray-900); white-space: nowrap; margin-right: 8px;">${title}</h2>
                            
                            <div class="legal-search-container">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input type="text" id="legal-search-input" class="legal-search-input" 
                                    placeholder="Поиск по контрагенту, ИНН или номеру договора..." 
                                    value="${this.legalSearchQuery}"
                                    onkeypress="if(event.key === 'Enter') app.handleLegalSearch()">
                            </div>

                            ${this.currentLegalSubTab === 'outbox' ? `
                            <button class="btn btn-primary" onclick="app.openLegalTemplateEditor()" style="height: 38px; padding: 0 16px; display: flex; align-items: center; gap: 8px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap; transition: all 0.2s;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Создать
                            </button>
                            ` : ''}

                            <button class="btn btn-secondary" onclick="app.toggleLegalFilterPanel()" style="height: 38px; padding: 0 16px; display: flex; align-items: center; gap: 8px; border-radius: 8px; border: 1px solid ${this.legalFilterPanelVisible ? 'var(--primary)' : 'var(--gray-300)'}; font-weight: 500; font-size: 13px; background: ${this.legalFilterPanelVisible ? 'rgba(32, 115, 69, 0.05)' : '#fff'}; cursor: pointer; color: ${this.legalFilterPanelVisible ? 'var(--primary)' : 'var(--gray-700)'}; white-space: nowrap; transition: all 0.2s;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                                Фильтр
                            </button>

                            <div style="position: relative; display: flex; align-items: center;">
                                <button id="legal-actions-toggle" class="btn btn-secondary" onclick="app.toggleLegalActionsMenu(event)" style="width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid var(--gray-300); background: #fff; cursor: pointer; color: var(--gray-700);">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                                </button>
                                
                                <div id="legal-actions-menu" style="display: none; position: absolute; top: calc(100% + 8px); right: 0; background: white; border: 1px solid var(--gray-200); border-radius: 4px; box-shadow: var(--shadow-lg); min-width: 220px; z-index: 1000; padding: 6px 0;">
                                    <div onclick="UI.showNotification('Синхронизация запущена...', 'info'); app.toggleLegalActionsMenu()" style="padding: 10px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; font-size: 13px; color: var(--gray-700);" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background='white'">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                        Синхронизация с НК
                                    </div>
                                    <div onclick="UI.showNotification('Генерация реестра...', 'info'); app.toggleLegalActionsMenu()" style="padding: 10px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; font-size: 13px; color: var(--gray-700);" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background='white'">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                        Реестр
                                    </div>
                                    <div style="height: 1px; background: var(--gray-100); margin: 4px 0;"></div>
                                    <div onclick="UI.showNotification('Настройки списка', 'info'); app.toggleLegalActionsMenu()" style="padding: 10px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; font-size: 13px; color: var(--gray-700);" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background='white'">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                        Настройки списка
                                    </div>
                                </div>
                            </div>

                        </div>

                        <!-- Filter Panel (Animated) -->
                        <div style="max-height: ${this.legalFilterPanelVisible ? '500px' : '0'}; overflow: ${this.legalFilterPanelVisible ? 'visible' : 'hidden'}; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: ${this.legalFilterPanelVisible ? '1' : '0'}; pointer-events: ${this.legalFilterPanelVisible ? 'auto' : 'none'}; margin-bottom: ${this.legalFilterPanelVisible ? '24px' : '0'};">
                            <div style="background: #f8f9fb; border: 1px solid var(--gray-200); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 20px;">
                                <!-- Filters Row -->
                                <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                                    
                                    <!-- Custom Dropdown: Document Type -->
                                    <div style="flex: 1; min-width: 200px; position: relative;">
                                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Тип документа</label>
                                        <div onclick="app.toggleLegalDropdown('docType', event)" style="height: 38px; background: #fff; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                                            <span>${{ all: 'Все типы', contract: 'Договор', act: 'Акт работ', invoice: 'Счет-фактура', appendix: 'Доп. соглашение' }[this.legalFilters.docType]}</span>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s; transform: ${this.legalDropdowns.docType ? 'rotate(180deg)' : 'none'}"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </div>
                                        <div style="display: ${this.legalDropdowns.docType ? 'block' : 'none'}; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: #fff; border: 1px solid var(--gray-200); border-radius: 6px; box-shadow: var(--shadow-md); z-index: 100; padding: 4px 0;">
                                            ${['all', 'contract', 'act', 'invoice', 'appendix'].map(val => `
                                                <div onclick="app.setLegalFilterValue('docType', '${val}')" style="padding: 8px 12px; font-size: 13px; cursor: pointer; background: ${this.legalFilters.docType === val ? 'rgba(32, 115, 69, 0.05)' : 'transparent'}; color: ${this.legalFilters.docType === val ? 'var(--primary)' : 'var(--gray-700)'};" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background='${this.legalFilters.docType === val ? 'rgba(32, 115, 69, 0.05)' : 'transparent'}'">
                                                    ${{ all: 'Все типы', contract: 'Договор', act: 'Акт работ', invoice: 'Счет-фактура', appendix: 'Доп. соглашение' }[val]}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- Custom Dropdown: Status -->
                                    <div style="flex: 1; min-width: 160px; position: relative;">
                                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Статус документа</label>
                                        <div onclick="app.toggleLegalDropdown('status', event)" style="height: 38px; background: #fff; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                                            <span>${{ all: 'Все статусы', pending: 'Ожидает подписи', signed: 'Подписан', rejected: 'Отказ в подписи', deleted: 'Удален' }[this.legalFilters.status]}</span>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s; transform: ${this.legalDropdowns.status ? 'rotate(180deg)' : 'none'}"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </div>
                                        <div style="display: ${this.legalDropdowns.status ? 'block' : 'none'}; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: #fff; border: 1px solid var(--gray-200); border-radius: 6px; box-shadow: var(--shadow-md); z-index: 100; padding: 4px 0;">
                                            ${['all', 'pending', 'signed', 'rejected', 'deleted'].map(val => `
                                                <div onclick="app.setLegalFilterValue('status', '${val}')" style="padding: 8px 12px; font-size: 13px; cursor: pointer; background: ${this.legalFilters.status === val ? 'rgba(32, 115, 69, 0.05)' : 'transparent'}; color: ${this.legalFilters.status === val ? 'var(--primary)' : 'var(--gray-700)'};" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background='${this.legalFilters.status === val ? 'rgba(32, 115, 69, 0.05)' : 'transparent'}'">
                                                    ${{ all: 'Все статусы', pending: 'Ожидает подписи', signed: 'Подписан', rejected: 'Отказ в подписи', deleted: 'Удален' }[val]}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- INN -->
                                    <div style="flex: 0.6; min-width: 110px;">
                                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">ИНН</label>
                                        <input type="text" id="legal-filter-inn" placeholder="770 123 456" 
                                            maxlength="11" 
                                            value="${this.legalFilters.inn}" 
                                            oninput="let v = this.value.replace(/[^0-9]/g, ''); if(v.length > 3) v = v.substring(0,3) + ' ' + v.substring(3); if(v.length > 7) v = v.substring(0,7) + ' ' + v.substring(7,10); this.value = v; app.legalFilters.inn = v;" 
                                            style="width: 100%; height: 38px; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; background: #fff;">
                                    </div>

                                    <!-- Contract Number -->
                                    <div style="flex: 0.6; min-width: 110px;">
                                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Номер дог.</label>
                                        <input type="text" placeholder="№ 123" value="${this.legalFilters.contractNo}" oninput="app.legalFilters.contractNo = this.value" style="width: 100%; height: 38px; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; background: #fff;">
                                    </div>

                                    <!-- Document Date -->
                                    <div style="flex: 1; min-width: 150px;">
                                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Дата документа</label>
                                        <input type="date" value="${this.legalFilters.docDate}" oninput="app.legalFilters.docDate = this.value" style="width: 100%; height: 38px; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; background: #fff;">
                                    </div>

                                    <!-- Price Range -->
                                    <div style="flex: 1.8; min-width: 240px;">
                                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 8px;">Сумма (₽)</label>
                                        <div style="display: flex; gap: 6px;">
                                            <input type="text" placeholder="От" value="${this.legalFilters.priceFrom}" 
                                                oninput="this.value = this.value.replace(/\\D/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' '); app.legalFilters.priceFrom = this.value;" 
                                                style="flex: 1; height: 38px; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; background: #fff;">
                                            <input type="text" placeholder="До" value="${this.legalFilters.priceTo}" 
                                                oninput="this.value = this.value.replace(/\\D/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' '); app.legalFilters.priceTo = this.value;" 
                                                style="flex: 1; height: 38px; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0 12px; font-size: 13px; background: #fff;">
                                        </div>
                                    </div>
                                </div>

                                <!-- Reset & Apply -->
                                <div style="width: 100%; display: flex; justify-content: flex-end; gap: 12px; margin-top: 4px; padding-top: 16px; border-top: 1px solid var(--gray-200);">
                                    <button onclick="app.resetLegalFilters()" style="background: none; border: none; color: var(--gray-500); cursor: pointer; font-size: 13px; font-weight: 500;">Сбросить</button>
                                    <button onclick="app.toggleLegalFilterPanel()" class="btn btn-primary" style="height: 38px; padding: 0 24px; border-radius: 8px; font-size: 13px;">Применить</button>
                                </div>
                            </div>
                        </div>

                        <!-- Status Tabs -->
                        <div style="display: flex; gap: 24px; border-bottom: 1px solid var(--gray-100); margin-bottom: 12px; padding-bottom: 2px; overflow-x: auto;">
                            <div onclick="app.setLegalStatusFilter('all')" style="padding: 10px 0; border-bottom: 2px solid ${this.legalStatusFilter === 'all' ? 'var(--primary)' : 'transparent'}; color: ${this.legalStatusFilter === 'all' ? 'var(--primary)' : 'var(--gray-600)'}; font-weight: ${this.legalStatusFilter === 'all' ? '600' : '400'}; display: flex; align-items: center; gap: 8px; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
                                Все статусы <span style="background: rgba(32, 115, 69, 0.1); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">114</span>
                            </div>
                            <div onclick="app.setLegalStatusFilter('pending')" style="padding: 10px 0; border-bottom: 2px solid ${this.legalStatusFilter === 'pending' ? '#f59e0b' : 'transparent'}; color: ${this.legalStatusFilter === 'pending' ? '#f59e0b' : 'var(--gray-600)'}; font-weight: ${this.legalStatusFilter === 'pending' ? '600' : '400'}; display: flex; align-items: center; gap: 8px; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
                                Ожидают вашей подписи <span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">2</span>
                            </div>
                            <div onclick="app.setLegalStatusFilter('signed')" style="padding: 10px 0; border-bottom: 2px solid ${this.legalStatusFilter === 'signed' ? '#22c55e' : 'transparent'}; color: ${this.legalStatusFilter === 'signed' ? '#22c55e' : 'var(--gray-600)'}; font-weight: ${this.legalStatusFilter === 'signed' ? '600' : '400'}; display: flex; align-items: center; gap: 8px; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
                                Подписан <span style="background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">104</span>
                            </div>
                            <div onclick="app.setLegalStatusFilter('rejected')" style="padding: 10px 0; border-bottom: 2px solid ${this.legalStatusFilter === 'rejected' ? '#ef4444' : 'transparent'}; color: ${this.legalStatusFilter === 'rejected' ? '#ef4444' : 'var(--gray-600)'}; font-weight: ${this.legalStatusFilter === 'rejected' ? '600' : '400'}; display: flex; align-items: center; gap: 8px; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
                                Отказ от подписи <span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">7</span>
                            </div>
                            <div onclick="app.setLegalStatusFilter('deleted')" style="padding: 10px 0; border-bottom: 2px solid ${this.legalStatusFilter === 'deleted' ? '#111827' : 'transparent'}; color: ${this.legalStatusFilter === 'deleted' ? '#111827' : 'var(--gray-600)'}; font-weight: ${this.legalStatusFilter === 'deleted' ? '600' : '400'}; display: flex; align-items: center; gap: 8px; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
                                Удаленные <span style="background: rgba(17, 24, 39, 0.1); color: #111827; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">1</span>
                            </div>
                        </div>
                    </div>

                    <!-- Scrollable Table Area -->
                    <div style="flex: 1; overflow: auto; padding: 0 24px;">
                        <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;">
                            <thead style="position: sticky; top: 0; background: var(--white); z-index: 5; border-top: 1px solid var(--gray-100); border-bottom: 1px solid var(--gray-100);">
                                <tr style="text-align: left; color: var(--gray-500); text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
                                    <th style="padding: 16px; width: 40px; text-align: center;">
                                        <input type="checkbox" id="legal-select-all" onclick="app.toggleAllLegalDocuments(this)">
                                    </th>
                                    <th style="padding: 16px; width: 30px;"></th>
                                    <th style="padding: 16px;">Тип документа</th>
                                    <th style="padding: 16px;">Дата обновления</th>
                                    <th style="padding: 16px;">Контрагент</th>
                                    <th style="padding: 16px;">ИНН</th>
                                    <th style="padding: 16px;">Номер и дата договора</th>
                                    <th style="padding: 16px;">Стоимость поставки</th>
                                    <th style="padding: 16px;">Сумма НДС</th>
                                    <th style="padding: 16px;">Стоимость с НДС</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                    // Mock data generation
                    const mockDocs = [];
                    const statuses = ['signed', 'pending', 'rejected', 'deleted'];
                    const statusColors = {
                        'signed': '#86efac',    // Pastel green
                        'pending': '#fde047',   // Pastel yellow
                        'rejected': '#fca5a5',  // Pastel red/pink
                        'deleted': '#d1d5db'    // Pastel gray
                    };

                    for (let i = 0; i < 50; i++) {
                        const status = statuses[i % statuses.length];
                        mockDocs.push({
                            id: i,
                            type: i % 3 === 0 ? 'Договор подряда' : 'Договор поставки',
                            updated: `1${i % 9}.05.2024 1${i % 8}:45`,
                            contractant: i % 2 === 0 ? 'ООО "ТехноПром"' : 'ИП Иванов А.В.',
                            inn: `770123${560 + i}`,
                            contract: `№ ${100 + i} от 01.05.2024`,
                            price: '500 000,00',
                            vat: '100 000,00',
                            total: '600 000,00',
                            status: status
                        });
                    }

                    // Filter data
                    let filtered = this.legalStatusFilter === 'all'
                        ? mockDocs
                        : mockDocs.filter(d => d.status === this.legalStatusFilter);

                    // Search filtering
                    if (this.legalSearchQuery) {
                        const q = this.legalSearchQuery.toLowerCase();
                        filtered = filtered.filter(d =>
                            d.contractant.toLowerCase().includes(q) ||
                            d.inn.toLowerCase().includes(q) ||
                            d.contract.toLowerCase().includes(q) ||
                            d.type.toLowerCase().includes(q)
                        );
                    }

                    if (filtered.length === 0) {
                        return `
                                            <tr>
                                                <td colspan="10" style="padding: 48px; text-align: center; color: var(--gray-500);">
                                                    Нет документов в данном статусе
                                                </td>
                                            </tr>
                                        `;
                    }

                    return filtered.map(doc => `
                                        <tr class="legal-table-row" onclick="UI.showNotification('Открытие документа...', 'info')" style="border-bottom: 1px solid var(--gray-50);">
                                            <td onclick="event.stopPropagation()" style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50); text-align: center;">
                                                <input type="checkbox" class="legal-row-checkbox">
                                            </td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50); width: 30px; vertical-align: middle;">
                                                <div style="width: 14px; height: 14px; background: ${statusColors[doc.status]}; border-radius: 4px; margin: 0 auto;"></div>
                                            </td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.type}</td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.updated}</td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.contractant}</td>
                                            <td onclick="event.stopPropagation(); app.copyToClipboard('${doc.inn}', 'ИНН')" title="Нажмите, чтобы скопировать ИНН" style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50); color: var(--gray-900); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--gray-900)'">
                                                ${doc.inn.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
                                            </td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.contract}</td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.price}</td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.vat}</td>
                                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--gray-50);">${doc.total}</td>
                                        </tr>
                                    `).join('');
                })()}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination (Fixed at Bottom) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid var(--gray-100); background: var(--white); border-radius: 0 0 4px 4px;">
                        <div style="display: flex; align-items: center; gap: 24px; font-size: 13px; color: var(--gray-600);">
                            <div>1 - 20 из 114</div>
                            <div style="height: 16px; width: 1px; background: var(--gray-200);"></div>
                            <div>
                                Отображать по: 
                                <select onchange="UI.showNotification('Настройка сохранена', 'success')" style="border: none; background: transparent; font-weight: 600; color: var(--gray-900); cursor: pointer; outline: none;">
                                    <option>20</option>
                                    <option>50</option>
                                    <option>100</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <button onclick="UI.showNotification('Первая страница', 'info')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); background: white; border-radius: 4px; color: var(--gray-600); cursor: pointer;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"></path></svg>
                            </button>
                            <button onclick="UI.showNotification('Предыдущая страница', 'info')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); background: white; border-radius: 4px; color: var(--gray-600); cursor: pointer;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"></path></svg>
                            </button>
                            <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--primary); color: white; border-radius: 4px; font-weight: 600; font-size: 13px;">1</div>
                            <button onclick="UI.showNotification('Страница 2', 'info')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); background: white; border-radius: 4px; color: var(--gray-600); cursor: pointer; font-size: 13px;">2</button>
                            <button onclick="UI.showNotification('Страница 3', 'info')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); background: white; border-radius: 4px; color: var(--gray-600); cursor: pointer; font-size: 13px;">3</button>
                            <button onclick="UI.showNotification('Следующая страница', 'info')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); background: white; border-radius: 4px; color: var(--gray-600); cursor: pointer;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>
                            </button>
                            <button onclick="UI.showNotification('Последняя страница', 'info')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); background: white; border-radius: 4px; color: var(--gray-600); cursor: pointer;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.currentLegalSubTab === 'base') {
            contentArea.style.padding = '0';
            contentArea.innerHTML = `
                <div style="width: 100%; height: 100%; background: #fff; overflow: hidden; position: relative;">
                    <iframe src="https://lex.uz" 
                        style="width: 100%; height: calc(100% + 264px); border: none; position: absolute; top: -264px; left: 0;" 
                        allowfullscreen></iframe>
                </div>
            `;
        } else if (this.currentLegalSubTab === 'templates') {
            // Load and display saved templates
            try {
                const templates = await api.getLegalTemplates(this.currentProjectId);
                const title = 'Шаблоны документов';

                // Filter templates based on search query
                const filteredTemplates = this.legalSearchQuery
                    ? templates.filter(t => t.name.toLowerCase().includes(this.legalSearchQuery.toLowerCase()))
                    : templates;

                contentArea.innerHTML = `
                    <div style="background: var(--white); border-radius: 4px; height: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-200); overflow: hidden;">
                        <style>
                            .legal-table-row { cursor: pointer; transition: all 0.2s ease; }
                            .legal-table-row:hover { background-color: rgba(34, 197, 94, 0.05) !important; }
                            
                            /* Search Modern Styling */
                            .legal-search-container {
                                flex: 1;
                                max-width: 500px;
                                position: relative;
                                display: flex;
                                align-items: center;
                                background: #f8f9fb;
                                border: 1px solid var(--gray-200);
                                border-radius: 8px;
                                padding: 0 14px;
                                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                            }

                            .legal-search-container:hover {
                                border-color: var(--gray-300);
                                background: #f1f3f7;
                            }

                            .legal-search-container:focus-within {
                                background: #fff;
                                border-color: var(--primary);
                                box-shadow: 0 0 0 3px rgba(32, 115, 69, 0.1);
                            }

                            .legal-search-container svg {
                                transition: stroke 0.2s;
                            }

                            .legal-search-container:focus-within svg {
                                stroke: var(--primary);
                            }

                            .legal-search-input {
                                flex: 1;
                                height: 38px;
                                border: none;
                                background: transparent;
                                padding: 0 12px;
                                font-size: 13px;
                                color: var(--gray-900);
                                outline: none;
                            }

                            .legal-search-input::placeholder {
                                color: var(--gray-400);
                            }
                        </style>

                        <!-- Fixed Top Header Section -->
                        <div style="padding: 24px 24px 0 24px; background: var(--white); z-index: 10;">
                            <!-- Header Row: Title + Search (Expanding) + Actions (Right Aligned) -->
                            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                                <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--gray-900); white-space: nowrap; margin-right: 8px;">${title}</h2>
                                
                                <div class="legal-search-container">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input type="text" id="legal-search-input" class="legal-search-input" 
                                        placeholder="Поиск по названию..." 
                                        value="${this.legalSearchQuery || ''}"
                                        oninput="app.legalSearchQuery = this.value; app.loadLegalTab()">
                                </div>

                                <button class="btn btn-primary" onclick="app.openLegalTemplateEditor()" style="height: 38px; padding: 0 16px; display: flex; align-items: center; gap: 8px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap; transition: all 0.2s;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Создать
                                </button>
                            </div>
                        </div>

                        <!-- Scrollable Table Area -->
                        <div style="flex: 1; overflow: auto; padding: 0 24px;">
                            ${templates.length === 0 ? `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--gray-500);">
                                    <div style="width: 64px; height: 64px; background: rgba(32, 115, 69, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
                                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                                        </svg>
                                    </div>
                                    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: var(--gray-900);">Нет сохраненных шаблонов</h3>
                                    <p style="margin: 0; font-size: 14px;">Создайте первый шаблон для начала работы</p>
                                </div>
                            ` : `
                                <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;">
                                    <thead style="position: sticky; top: 0; background: var(--white); z-index: 5; border-top: 1px solid var(--gray-100); border-bottom: 1px solid var(--gray-100);">
                                        <tr style="text-align: left; color: var(--gray-500); text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
                                            <th style="padding: 16px; width: 40px; text-align: center;">#</th>
                                            <th style="padding: 16px;">Название шаблона</th>
                                            <th style="padding: 16px;">Тип документа</th>
                                            <th style="padding: 16px;">Дата создания</th>
                                            <th style="padding: 16px; width: 120px; text-align: right;">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${filteredTemplates.map((template, index) => {
                    const createdDate = new Date(template.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const docTypeLabels = {
                        'contract_nk': 'Договор (НК)'
                    };

                    return `
                                                <tr class="legal-table-row" style="border-bottom: 1px solid var(--gray-50);">
                                                    <td style="padding: 12px 16px; text-align: center; color: var(--gray-400);">${index + 1}</td>
                                                    <td style="padding: 12px 16px;">
                                                        <div style="color: var(--gray-900);">${template.name}</div>
                                                    </td>
                                                    <td style="padding: 12px 16px;">
                                                        <span style="background: rgba(32, 115, 69, 0.05); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                                            ${docTypeLabels[template.docType] || template.docType}
                                                        </span>
                                                    </td>
                                                    <td style="padding: 12px 16px; color: var(--gray-600);">${createdDate}</td>
                                                    <td style="padding: 12px 16px; text-align: right;">
                                                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                                            <button onclick="event.stopPropagation(); app.viewLegalTemplate('${template.id}')" title="Просмотр" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); border-radius: 4px; background: #fff; color: var(--gray-600); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.color='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'; this.style.color='var(--gray-600)'">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                            </button>
                                                            <button onclick="event.stopPropagation(); app.editLegalTemplate('${template.id}')" title="Изменить" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); border-radius: 4px; background: #fff; color: var(--gray-600); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.color='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'; this.style.color='var(--gray-600)'">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                            </button>
                                                            <button onclick="event.stopPropagation(); app.deleteLegalTemplate('${template.id}')" title="Удалить" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gray-200); border-radius: 4px; background: #fff; color: var(--gray-600); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#ef4444'; this.style.color='#ef4444'; this.style.background='#fef2f2'" onmouseout="this.style.borderColor='var(--gray-200)'; this.style.color='var(--gray-600)'; this.style.background='#fff'">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                }).join('')}
                                    </tbody>
                                </table>
                            `}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Error loading templates:', error);
                contentArea.innerHTML = `
                    <div style="background: var(--white); border-radius: 4px; height: 100%; padding: 24px; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-200); display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center;">
                            <p style="color: var(--gray-600); margin-bottom: 16px;">Ошибка загрузки шаблонов</p>
                            <button class="btn btn-primary" onclick="app.loadLegalTab()">Повторить</button>
                        </div>
                    </div>
                `;
            }
        } else if (['drafts', 'contracts'].includes(this.currentLegalSubTab)) {
            const icons = {
                'drafts': '<path d="M15 12h-5"></path><path d="M15 8h-5"></path><path d="M19 17V5a2 2 0 0 0-2-2H4"></path><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"></path>',
                'contracts': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'
            };

            const currentTitle = subTitles[this.currentLegalSubTab] || 'Юридический отдел';
            const currentIcon = icons[this.currentLegalSubTab];

            contentArea.innerHTML = `
                <div style="background: var(--white); border-radius: 4px; height: 100%; padding: 24px; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-200); position: relative; overflow: auto;">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: rgba(32, 115, 69, 0.05); border-radius: 4px; color: var(--primary); margin-bottom: 24px;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                ${currentIcon}
                            </svg>
                        </div>
                        <h3 style="margin-bottom: 12px; font-size: 20px; color: var(--gray-800); font-weight: 600;">${currentTitle}</h3>
                        <p style="color: var(--gray-500); max-width: 440px; margin: 0 auto 32px auto; font-size: 15px; line-height: 1.6;">
                            Раздел находится в стадии активной разработки. В ближайшее время здесь появится функционал для полноценной работы с документами.
                        </p>
                        <button class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; padding: 12px 32px; font-weight: 600; border-radius: 4px; gap: 8px;" onclick="app.openLegalTemplateEditor()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                            <span>Создать документ</span>
                        </button>
                    </div>
                </div>
            `;
        }

        // Update Breadcrumbs
        const currentTitle = subTitles[this.currentLegalSubTab] || 'Юридический отдел';
        const extraItems = [{ text: currentTitle }];
        this.updateBreadcrumbs(extraItems);
    }

    loadDashboardTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2 style="margin-bottom: 24px;">Главная</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                    <div style="background: var(--white); padding: 24px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                        <h3 style="margin-bottom: 16px; font-size: 18px;">Обзор проекта</h3>
                        <p style="color: var(--gray-600);">Общая информация о текущем проекте...</p>
                    </div>
                    
                    <div style="background: var(--white); padding: 24px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                        <h3 style="margin-bottom: 16px; font-size: 18px;">Статистика</h3>
                        <p style="color: var(--gray-600);">Ключевые показатели проекта...</p>
                    </div>
                    
                    <div style="background: var(--white); padding: 24px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                        <h3 style="margin-bottom: 16px; font-size: 18px;">Последние действия</h3>
                        <p style="color: var(--gray-600);">История изменений...</p>
                    </div>
                </div>
            </div>
        `;
    }

    async loadFinanceTab() {
        if (!this.currentProjectId) return;

        try {
            const summary = await api.getFinanceSummary(this.currentProjectId);

            document.getElementById('content-area').innerHTML = `
                <div style="padding: 24px;">
                    <h2 style="margin-bottom: 24px;">Финансы</h2>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
                        <div style="background: var(--white); padding: 20px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                            <div style="color: var(--gray-600); font-size: 14px; margin-bottom: 8px;">Приход</div>
                            <div style="font-size: 24px; font-weight: 600; color: var(--accent-green);">
                                ${UI.formatCurrency(summary.totalIncome, UI.getCurrentCurrency())}
                            </div>
                        </div>
                        <div style="background: var(--white); padding: 20px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                            <div style="color: var(--gray-600); font-size: 14px; margin-bottom: 8px;">Расход</div>
                            <div style="font-size: 24px; font-weight: 600; color: var(--accent-red);">
                                ${UI.formatCurrency(summary.totalExpense, UI.getCurrentCurrency())}
                            </div>
                        </div>
                        <div style="background: var(--white); padding: 20px; border-radius: 8px; box-shadow: var(--shadow-sm);">
                            <div style="color: var(--gray-600); font-size: 14px; margin-bottom: 8px;">Баланс</div>
                            <div style="font-size: 24px; font-weight: 600; color: ${summary.balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                                ${UI.formatCurrency(summary.balance, UI.getCurrentCurrency())}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                        <button class="btn btn-primary" onclick="app.addIncome()">+ Приход</button>
                        <button class="btn btn-secondary" onclick="app.addExpense()">- Расход</button>
                    </div>

                    <p style="color: var(--gray-600);">Детальная история операций в разработке...</p>
                </div>
            `;
        } catch (error) {
            console.error('Error loading finances:', error);
            UI.showNotification('Ошибка загрузки финансов', 'error');
        }
    }

    async loadStatisticsTab() {
        if (!this.currentProjectId) return;
        UI.showTurboLoader();
        this.currentRibbonTab = 'dashboard';
        this.currentDashboardSubTab = 'statistics';
        this.applyRibbonTabToUI('dashboard');
        this.setDashboardActive('statistics');

        const contentArea = document.getElementById('content-area');
        contentArea.style.padding = '0';
        contentArea.style.overflow = 'auto';

        try {
            const response = await fetch('dashboard.html');
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const dashboardContent = doc.querySelector('.dashboard-container');
            const styles = doc.querySelector('style');

            if (dashboardContent) {
                contentArea.innerHTML = '';
                if (styles) {
                    contentArea.appendChild(styles.cloneNode(true));
                }
                contentArea.appendChild(dashboardContent.cloneNode(true));

                const scripts = doc.querySelectorAll('script');
                scripts.forEach(script => {
                    if (script.textContent && !script.src) {
                        const newScript = document.createElement('script');
                        newScript.textContent = script.textContent;
                        contentArea.appendChild(newScript);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading dashboard statistics:', error);
            contentArea.innerHTML = `<div style="padding: 24px;"><h2>Ошибка загрузки</h2></div>`;
        }
        UI.hideTurboLoader();
    }

    async loadOrgStructureTab() {
        if (!this.currentProjectId) return;
        UI.showTurboLoader();
        this.currentRibbonTab = 'dashboard';
        this.currentDashboardSubTab = 'org-structure';
        this.applyRibbonTabToUI('dashboard');
        this.setDashboardActive('org-structure');

        const contentArea = document.getElementById('content-area');
        contentArea.style.padding = '0';
        contentArea.style.overflow = 'hidden';

        contentArea.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <iframe src="org-structure.html" style="flex: 1; border: none; width: 100%; height: 100%;" title="Структура объекта"></iframe>
            </div>
        `;
        UI.hideTurboLoader();
    }

    async loadCamerasTab() {
        if (!this.currentProjectId) return;
        UI.showTurboLoader();
        this.currentRibbonTab = 'dashboard';
        this.currentDashboardSubTab = 'cameras';
        this.applyRibbonTabToUI('dashboard');
        this.setDashboardActive('cameras');

        const contentArea = document.getElementById('content-area');
        contentArea.style.padding = '0';
        contentArea.style.overflow = 'hidden';

        contentArea.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <iframe src="cameras.html" style="flex: 1; border: none; width: 100%; height: 100%;" title="Камеры"></iframe>
            </div>
        `;
        UI.hideTurboLoader();
    }

    loadTimesheetTab() {
        if (!this.currentProjectId) return;
        this.currentRibbonTab = 'timesheet';
        this.applyRibbonTabToUI('timesheet');

        // Setup listeners for the new buttons
        const kppBtn = document.getElementById('timesheet-kpp-btn');
        const tableBtn = document.getElementById('timesheet-table-btn');

        if (kppBtn) {
            kppBtn.onclick = () => this.setTimesheetSubTab('kpp');
        }
        if (tableBtn) {
            tableBtn.onclick = () => this.setTimesheetSubTab('table');
        }

        // Default to KPP (Checkpoint) view
        this.setTimesheetSubTab('kpp');
    }

    setTimesheetSubTab(tab) {
        // Toggle active class
        document.getElementById('timesheet-kpp-btn')?.classList.toggle('active', tab === 'kpp');
        document.getElementById('timesheet-table-btn')?.classList.toggle('active', tab === 'table');

        const contentArea = document.getElementById('content-area');
        contentArea.style.padding = '0';
        contentArea.style.overflow = 'hidden';

        // Update breadcrumbs
        // Base label 'Табель' is added by updateBreadcrumbs logic when currentRibbonTab is timesheet.
        // We add the sub-section as extra item.
        const subName = tab === 'kpp' ? 'КПП' : 'Табель';
        this.updateBreadcrumbs([{ text: subName }]);

        if (tab === 'kpp') {
            contentArea.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <iframe src="timesheet.html?t=${Date.now()}" allow="camera *; microphone *" style="flex: 1; border: none; width: 100%; height: 100%;" title="КПП"></iframe>
                </div>
            `;
        } else {
            // Load Timesheet Table view
            contentArea.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <iframe src="timesheet-table.html?t=${Date.now()}" allow="camera *; microphone *" style="flex: 1; border: none; width: 100%; height: 100%;" title="Табель"></iframe>
                </div>
            `;
        }
    }

    setDashboardActive(tab) {
        document.querySelectorAll('[data-panel="dashboard"] .ribbon-btn').forEach(btn => btn.classList.remove('active'));
        if (tab === 'statistics') {
            document.getElementById('btn-stats-tab')?.classList.add('active');
        } else if (tab === 'org-structure') {
            document.getElementById('btn-structure-tab')?.classList.add('active');
        } else if (tab === 'cameras') {
            document.getElementById('btn-cameras-tab')?.classList.add('active');
        }
    }

    loadAnalyticsTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2>Аналитика</h2>
                <p style="margin-top: 16px; color: var(--gray-600);">Функционал аналитики в разработке...</p>
            </div>
        `;
    }



    setOTiTBActive(mode) {
        this.otitbActive = mode;
        const map = {
            instructions: document.getElementById('tolerance-settings-btn'),
            worktypes: document.getElementById('worktypes-settings-btn'),
            permit: document.getElementById('permit-board-btn')
        };
        Object.entries(map).forEach(([key, btn]) => {
            if (!btn) return;
            btn.classList.toggle('active', key === mode);
        });
    }

    setSettingsActive(mode) {
        const map = {
            project: document.getElementById('project-settings-btn'),
            subcontractors: document.getElementById('subcontractors-btn'),
            hr: document.getElementById('hr-management-btn')
        };
        Object.entries(map).forEach(([key, btn]) => {
            if (!btn) return;
            btn.classList.toggle('active', key === mode);
        });

        this.updateBreadcrumbs();
    }

    showPermitBoard() {
        this.setOTiTBActive('permit');
        if (this.permitResizeHandler) {
            window.removeEventListener('resize', this.permitResizeHandler);
        }

        const columns = [
            { key: 'new', title: 'Новые', canAdd: true },
            { key: 'pending', title: 'В ожидании' },
            { key: 'issued', title: 'Выдано' },
            { key: 'expired', title: 'Срок истек' },
            { key: 'revoked', title: 'Отозвано' }
        ];

        if (!this.permitFilters) {
            this.permitFilters = {};
        }
        if (!this.permitFilterOpen) {
            this.permitFilterOpen = {};
        }
        if (this.permitCountdownInterval) {
            clearInterval(this.permitCountdownInterval);
        }

        if (!this.permitCards) {
            this.permitCards = [
                {
                    id: 'permit-001',
                    title: 'Монтаж конструкций фасада',
                    code: 'НД-001',
                    date: '22.12',
                    issueId: 'НД-001',
                    issuedAt: '22.12.2025',
                    contractor: 'ООО Субподрядчик',
                    workName: 'Монтаж конструкций фасада',
                    issuedBy: 'Иванов И.И.',
                    position: 'Инженер ОТ и ТБ',
                    queue: '1',
                    section: 'Блок Б',
                    floor: '12',
                    validFrom: '22.12.2025',
                    validTo: '26.12.2025',
                    status: 'new'
                },
                {
                    id: 'permit-002',
                    title: 'Сварка в машинном отделении',
                    code: 'НД-002',
                    date: '22.12',
                    issueId: 'НД-002',
                    issuedAt: '21.12.2025',
                    contractor: 'ООО Субподрядчик',
                    workName: 'Сварка трубопроводов',
                    issuedBy: 'Петров П.П.',
                    position: 'Главный инженер',
                    queue: '2',
                    section: 'Секция 4',
                    floor: '3',
                    validFrom: '21.12.2025',
                    validTo: '24.12.2025',
                    status: 'pending'
                },
                {
                    id: 'permit-003',
                    title: 'Горячие работы в цехе 3',
                    code: 'НД-003',
                    date: '21.12',
                    issueId: 'НД-003',
                    issuedAt: '21.12.2025',
                    contractor: 'ООО Субподрядчик',
                    workName: 'Пайка медных труб',
                    issuedBy: 'Сидоров С.С.',
                    position: 'Мастер участка',
                    queue: '1',
                    section: 'Линия 2',
                    floor: '1',
                    validFrom: '21.12.2025',
                    validTo: '22.12.2025',
                    status: 'issued'
                },
                {
                    id: 'permit-004',
                    title: 'Работы в замкнутом пространстве',
                    code: 'НД-004',
                    date: '21.12',
                    issueId: 'НД-004',
                    issuedAt: '20.12.2025',
                    contractor: 'ООО Субподрядчик',
                    workName: 'Обслуживание резервуара',
                    issuedBy: 'Кузнецов К.К.',
                    position: 'Инженер по безопасности',
                    queue: '3',
                    section: 'Секция 2',
                    floor: '-1',
                    validFrom: '20.12.2025',
                    validTo: '23.12.2025',
                    status: 'pending'
                },
                {
                    id: 'permit-005',
                    title: 'Высотные работы с люльки',
                    code: 'НД-005',
                    date: '20.12',
                    issueId: 'НД-005',
                    issuedAt: '18.12.2025',
                    contractor: 'ООО Субподрядчик',
                    workName: 'Мойка фасада',
                    issuedBy: 'Федоров Ф.Ф.',
                    position: 'Прораб',
                    queue: '1',
                    section: 'Секция 1',
                    floor: '20',
                    validFrom: '18.12.2025',
                    validTo: '20.12.2025',
                    status: 'expired'
                },
                {
                    id: 'permit-006',
                    title: 'Работа с люльки в сложных условиях',
                    code: 'НД-006',
                    date: '20.12',
                    issueId: 'НД-006',
                    issuedAt: '17.12.2025',
                    contractor: 'ООО Субподрядчик',
                    workName: 'Монтаж витражей',
                    issuedBy: 'Лебедев Л.Л.',
                    position: 'Инженер проекта',
                    queue: '1',
                    section: 'Секция 3',
                    floor: '15',
                    validFrom: '17.12.2025',
                    validTo: '19.12.2025',
                    status: 'revoked'
                }
            ];
        }

        const toEndOfDay = (dateStr) => {
            if (!dateStr) return null;
            const parts = dateStr.split('.').map(p => parseInt(p, 10));
            if (parts.length !== 3 || parts.some(isNaN)) return null;
            const [day, month, year] = parts;
            return new Date(year, month - 1, day, 23, 59, 59, 999);
        };

        const pad2 = (value) => String(value).padStart(2, '0');

        const formatCountdownText = (card) => {
            const end = toEndOfDay(card.validTo);
            if (!end) return '';
            const diff = end.getTime() - Date.now();
            if (diff <= 0) return 'Срок истек';
            const totalSeconds = Math.floor(diff / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `Осталось ${days} дн ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
        };

        const applyExpiryTransition = () => {
            const now = Date.now();
            this.permitCards = this.permitCards.map(card => {
                if (card.status === 'issued') {
                    const end = toEndOfDay(card.validTo);
                    if (end && end.getTime() < now) {
                        return { ...card, status: 'expired' };
                    }
                }
                return card;
            });
        };

        applyExpiryTransition();

        const statusCounts = columns.reduce((acc, col) => {
            acc[col.key] = this.permitCards.filter(c => c.status === col.key).length;
            return acc;
        }, {});

        const statusLabel = {
            new: 'Новый',
            pending: 'В ожидании',
            issued: 'Выдано',
            expired: 'Срок истек',
            revoked: 'Отозвано'
        };

        const filterCards = (cards, status) => {
            const f = this.permitFilters[status] || {};
            const qTitle = (f.title || '').toLowerCase();
            const qId = (f.issueId || '').toLowerCase();
            const qContractor = (f.contractor || '').toLowerCase();
            const qDate = (f.date || '').toLowerCase();
            const qIssuer = (f.issuer || '').toLowerCase();
            return cards.filter(card => {
                if (qTitle && !card.title.toLowerCase().includes(qTitle)) return false;
                if (qId && !card.issueId.toLowerCase().includes(qId)) return false;
                if (qContractor && !card.contractor.toLowerCase().includes(qContractor)) return false;
                if (qDate && !card.issuedAt.toLowerCase().includes(qDate)) return false;
                if (qIssuer && !card.issuedBy.toLowerCase().includes(qIssuer)) return false;
                return true;
            });
        };

        const actionIcons = {
            download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12" /><path d="M6 11l6 6 6-6" /><path d="M5 19h14" /></svg>',
            confirm: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 13 4 4L19 7" /><path d="M5 7h7" /></svg>',
            edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>',
            delete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18" /><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>'
        };

        const cardHtml = (card) => {
            const sectionDisplay = (card.section || '').replace(/^(?:Блок|Линия|Секция)\s+/i, '') || card.section;
            return `
            <div class="permit-card" draggable="true" data-card-id="${card.id}">
                <div class="permit-card-top">
                    <div class="permit-logo">PB</div>
                    <div class="permit-card-top-text">
                        <div class="permit-card-contract">${card.contractor}</div>
                        <div class="permit-card-field">Выдан: ${card.issuedBy}</div>
                        <div class="permit-card-field">Должность: ${card.position}</div>
                        <div class="permit-card-meta-line">${card.issueId}</div>
                    </div>
                </div>
                <div class="permit-card-title">${card.title}</div>
                <div class="permit-pill-row">
                    <span class="permit-pill">Очередь ${card.queue}</span>
                    <span class="permit-pill">Секция ${sectionDisplay}</span>
                    <span class="permit-pill">Этаж ${card.floor}</span>
                </div>
                <div class="permit-card-field">Срок действия: ${card.validFrom} — ${card.validTo}</div>
                <div class="permit-card-field permit-countdown" data-card-id="${card.id}" data-valid-to="${card.validTo}">${formatCountdownText(card)}</div>
                <div class="permit-card-footer">
                    <span class="permit-card-status status-${card.status}">${statusLabel[card.status] || ''}</span>
                    <div class="permit-card-actions">
                        <button class="permit-action-btn" data-action="confirm" data-card-id="${card.id}" title="Подтвердить">${actionIcons.confirm}</button>
                        <button class="permit-action-btn" data-action="download" data-card-id="${card.id}" title="Скачать">${actionIcons.download}</button>
                        <button class="permit-action-btn" data-action="edit" data-card-id="${card.id}" title="Изменить">${actionIcons.edit}</button>
                        <button class="permit-action-btn danger" data-action="delete" data-card-id="${card.id}" title="Удалить">${actionIcons.delete}</button>
                    </div>
                </div>
            </div>
        `;
        };

        const content = `
            <div class="permit-board" id="permit-board">
                ${columns.map(col => `
                    <div class="permit-column" data-status="${col.key}">
                        <div class="permit-column-header">
                            <div class="permit-column-title">
                                <span class="permit-status-dot status-${col.key}"></span>
                                    <span>${col.title} - ${statusCounts[col.key] ?? 0}</span>
                            </div>
                            <div class="permit-column-actions">
                                <button class="permit-filter-btn" data-status="${col.key}" title="Фильтр">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16l-6 8v6l-4-2v-4z" /></svg>
                                </button>
                                ${col.canAdd ? '<button class="permit-add-btn" id="add-permit-btn" title="Добавить">\n                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>\n                                </button>' : ''}
                            </div>
                        </div>
                        <div class="permit-filter-panel ${this.permitFilterOpen[col.key] ? 'open' : ''}" data-status="${col.key}">
                            <div class="permit-filter-row"><input type="text" placeholder="Название" data-filter-field="title" data-status="${col.key}" value="${(this.permitFilters[col.key]?.title || '').replace(/"/g, '&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="НД номер" data-filter-field="issueId" data-status="${col.key}" value="${(this.permitFilters[col.key]?.issueId || '').replace(/"/g, '&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="Субподрядчик" data-filter-field="contractor" data-status="${col.key}" value="${(this.permitFilters[col.key]?.contractor || '').replace(/"/g, '&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="Дата выдачи" data-filter-field="date" data-status="${col.key}" value="${(this.permitFilters[col.key]?.date || '').replace(/"/g, '&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="ФИО" data-filter-field="issuer" data-status="${col.key}" value="${(this.permitFilters[col.key]?.issuer || '').replace(/"/g, '&quot;')}"></div>
                        </div>
                        <div class="permit-column-cards">
                            ${filterCards(this.permitCards.filter(c => c.status === col.key), col.key).map(cardHtml).join('') || '<div class="permit-empty">Нет записей</div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = content;

        const updateCountdowns = () => {
            const now = Date.now();
            let moved = false;
            contentArea.querySelectorAll('.permit-countdown').forEach(el => {
                const validTo = el.dataset.validTo;
                const cardId = el.dataset.cardId;
                const card = this.permitCards.find(c => c.id === cardId);
                const end = toEndOfDay(validTo);
                if (!end) {
                    el.textContent = '';
                    el.classList.remove('expired');
                    return;
                }
                const diff = end.getTime() - now;
                if (diff <= 0) {
                    el.textContent = 'Срок истек';
                    el.classList.add('expired');
                    if (card && card.status === 'issued') {
                        card.status = 'expired';
                        moved = true;
                    }
                    return;
                }
                const totalSeconds = Math.floor(diff / 1000);
                const days = Math.floor(totalSeconds / 86400);
                const hours = Math.floor((totalSeconds % 86400) / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                el.textContent = `Осталось ${days} дн ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
                el.classList.remove('expired');
            });

            if (moved) {
                this.showPermitBoard();
            }
        };

        updateCountdowns();
        this.permitCountdownInterval = setInterval(updateCountdowns, 1000);

        this.permitResizeHandler = () => this.updatePermitBoardHeight();
        window.addEventListener('resize', this.permitResizeHandler);
        this.updatePermitBoardHeight();

        // Filter toggles
        contentArea.querySelectorAll('.permit-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const status = btn.dataset.status;
                this.permitFilterOpen[status] = !this.permitFilterOpen[status];
                this.showPermitBoard();
            });
        });

        // Filter inputs
        contentArea.querySelectorAll('.permit-filter-panel input').forEach(input => {
            input.addEventListener('input', () => {
                const status = input.dataset.status;
                const field = input.dataset.filterField;
                if (!this.permitFilters[status]) this.permitFilters[status] = {};
                this.permitFilters[status][field] = input.value;
                this.showPermitBoard();
            });
        });

        // Drag & drop
        const cards = contentArea.querySelectorAll('.permit-card');
        cards.forEach(cardEl => {
            cardEl.addEventListener('dragstart', (e) => {
                e.dataTransfer?.setData('text/plain', cardEl.dataset.cardId);
                cardEl.classList.add('dragging');
            });
            cardEl.addEventListener('dragend', () => {
                cardEl.classList.remove('dragging');
            });
        });

        const columnsEls = contentArea.querySelectorAll('.permit-column');
        columnsEls.forEach(colEl => {
            colEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                colEl.classList.add('drag-over');
            });
            colEl.addEventListener('dragleave', () => {
                colEl.classList.remove('drag-over');
            });
            colEl.addEventListener('drop', (e) => {
                e.preventDefault();
                colEl.classList.remove('drag-over');
                const cardId = e.dataTransfer?.getData('text/plain');
                if (cardId) {
                    this.movePermitCard(cardId, colEl.dataset.status);
                }
            });
        });

        // Actions
        contentArea.querySelectorAll('.permit-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const cardId = btn.dataset.cardId;
                if (action === 'delete') {
                    this.deletePermitCard(cardId);
                } else if (action === 'edit') {
                    console.log('Edit permit', cardId);
                } else if (action === 'download') {
                    console.log('Download permit', cardId);
                } else if (action === 'confirm') {
                    console.log('Confirm permit', cardId);
                }
            });
        });

        const addBtn = document.getElementById('add-permit-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addPermitCard());
        }
    }

    updatePermitBoardHeight() {
        const contentArea = document.getElementById('content-area');
        const boardEl = document.getElementById('permit-board');
        if (!contentArea || !boardEl) return;

        const styles = window.getComputedStyle(contentArea);
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const availableHeight = contentArea.clientHeight - paddingTop - paddingBottom;

        if (availableHeight > 0) {
            boardEl.style.setProperty('--permit-board-height', `${availableHeight}px`);
        } else {
            boardEl.style.removeProperty('--permit-board-height');
        }
    }

    movePermitCard(cardId, targetStatus) {
        if (!this.permitCards) return;
        const card = this.permitCards.find(c => c.id === cardId);
        if (!card || card.status === targetStatus) return;
        card.status = targetStatus;
        this.showPermitBoard();
    }

    deletePermitCard(cardId) {
        if (!this.permitCards) return;
        this.permitCards = this.permitCards.filter(c => c.id !== cardId);
        this.showPermitBoard();
    }

    addPermitCard() {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const shortDate = `${dd}.${mm}`;
        const fullDate = `${dd}.${mm}.${yyyy}`;
        const idSuffix = Math.floor(Math.random() * 900 + 100);
        const newCard = {
            id: `permit-${Date.now()}`,
            title: 'Новый наряд-допуск',
            code: `НД-${idSuffix}`,
            date: shortDate,
            issueId: `НД-${idSuffix}`,
            issuedAt: fullDate,
            contractor: 'ООО Субподрядчик',
            workName: 'Укажите работы',
            issuedBy: 'ФИО ответственного',
            position: 'Должность',
            queue: '-',
            section: '-',
            floor: '-',
            validFrom: fullDate,
            validTo: fullDate,
            status: 'new'
        };
        this.permitCards = [newCard, ...(this.permitCards || [])];
        this.showPermitBoard();
    }

    initEventHandlers() {
        // Закрытие кастомных дропдаунов при клике вне их области
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.status-dropdown')) {
                document.querySelectorAll('.status-dropdown.active').forEach(d => d.classList.remove('active'));
            }
        });

        // Добавить проект
        document.getElementById('add-project').addEventListener('click', () => {
            this.createProject();
        });

        // Создать первый проект (welcome screen)
        const createFirstBtn = document.getElementById('create-first-project');
        if (createFirstBtn) {
            createFirstBtn.addEventListener('click', () => {
                this.createProject();
            });
        }

        // Ribbon tabs
        document.getElementById('btn-stats-tab')?.addEventListener('click', () => {
            this.loadStatisticsTab();
        });

        document.getElementById('btn-structure-tab')?.addEventListener('click', () => {
            this.loadOrgStructureTab();
        });

        document.getElementById('btn-cameras-tab')?.addEventListener('click', () => {
            this.loadCamerasTab();
        });

        document.querySelectorAll('.ribbon-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Убираем активный класс со всех вкладок
                document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.remove('active'));

                // Добавляем активный класс к выбранной вкладке
                e.target.classList.add('active');
                const ribbonName = e.target.dataset.ribbon;
                document.querySelector(`[data-panel="${ribbonName}"]`).classList.add('active');

                // Загружаем содержимое
                this.currentRibbonTab = ribbonName;
                this.applyRibbonTabToUI(ribbonName);
                this.loadCurrentTab();
            });
        });

        // Ribbon buttons
        document.getElementById('add-block-btn')?.addEventListener('click', () => {
            EstimateManager.createBlock();
        });

        document.getElementById('add-section-btn')?.addEventListener('click', () => {
            if (!EstimateManager.currentBlockId) {
                UI.showNotification('Сначала откройте блок', 'error');
                return;
            }
            EstimateManager.createEstimate(EstimateManager.currentBlockId);
        });

        // Import button
        document.getElementById('import-estimate-btn')?.addEventListener('click', () => {
            ImportManager.showImportModal();
        });

        // Export button
        document.getElementById('export-estimate-csv-btn')?.addEventListener('click', () => {
            EstimateManager.exportToCSV();
        });

        // Schedule buttons

        document.getElementById('clear-schedule-btn')?.addEventListener('click', () => {
            ScheduleManager.clearSchedule();
        });

        // Закрытие меню проектов при клике вне его
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.project-menu') && !e.target.closest('.project-menu-btn')) {
                this.closeAllProjectMenus();
            }
        });

        document.getElementById('assign-work-wizard-btn')?.addEventListener('click', () => {
            if (this.currentProjectId) {
                ScheduleManager.currentProjectId = this.currentProjectId;
            }
            ScheduleManager.showWorkDistributionWizard();
        });

        document.getElementById('gpr-assign-work-wizard-btn')?.addEventListener('click', () => {
            if (this.currentProjectId) {
                GPRManager.currentProjectId = this.currentProjectId;
            }
            GPRManager.showWorkDistributionWizard();
        });
        document.getElementById('schedule-toggle-volumes-btn')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const isActive = btn.classList.toggle('active');
            ScheduleManager.toggleVolumeColumns(isActive);
        });

        document.getElementById('schedule-toggle-estimate-btn')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const isActive = btn.classList.toggle('active');
            ScheduleManager.toggleEstimateColumns(isActive);
        });

        document.getElementById('schedule-expand-all-btn')?.addEventListener('click', () => {
            ScheduleManager.expandAll();
        });

        document.getElementById('schedule-collapse-all-btn')?.addEventListener('click', () => {
            ScheduleManager.collapseAll();
        });

        // Schedule Mode Toggle
        document.getElementById('schedule-mode-gantt-btn')?.addEventListener('click', () => {
            if (this.scheduleMode === 'gantt') return;
            this.scheduleMode = 'gantt';
            this.loadScheduleTab();
        });

        document.getElementById('schedule-mode-3d-btn')?.addEventListener('click', () => {
            if (this.scheduleMode === '3d') return;
            this.scheduleMode = '3d';
            this.loadScheduleTab();
        });

        document.getElementById('schedule-project-settings-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            if (typeof GPRManager !== 'undefined') {
                GPRManager.currentProjectId = this.currentProjectId;
            }
            GPRManager.showProjectSettingsModal();
        });

        // GPR buttons
        document.getElementById('gpr-project-settings-btn')?.addEventListener('click', () => {
            if (this.currentProjectId) {
                GPRManager.currentProjectId = this.currentProjectId;
            }
            GPRManager.showProjectSettingsModal();
        });

        document.getElementById('gpr-clear-btn')?.addEventListener('click', () => {
            GPRManager.clearGPR();
        });

        document.getElementById('gpr-expand-all-btn')?.addEventListener('click', () => {
            if (this.currentRibbonTab !== 'gpr') return;
            GPRManager.expandAll();
        });

        document.getElementById('gpr-collapse-all-btn')?.addEventListener('click', () => {
            if (this.currentRibbonTab !== 'gpr') return;
            GPRManager.collapseAll();
        });

        // IFC upload button (duplicate of existing binding logic)
        document.getElementById('upload-ifc-btn')?.addEventListener('click', async () => {
            if (!EstimateManager.currentEstimateId) {
                UI.showNotification('Сначала откройте смету', 'error');
                return;
            }
            await EstimateManager.uploadIFCForEstimate(EstimateManager.currentEstimateId);
        });

        // View tools (expand/collapse all)
        document.getElementById('expand-all-btn')?.addEventListener('click', async () => {
            if (!EstimateManager.currentEstimateId && !EstimateManager.currentSectionId) {
                UI.showNotification('Сначала откройте смету', 'error');
                return;
            }
            await EstimateManager.expandAllTree();
        });

        document.getElementById('collapse-all-btn')?.addEventListener('click', async () => {
            if (!EstimateManager.currentEstimateId && !EstimateManager.currentSectionId) {
                UI.showNotification('Сначала откройте смету', 'error');
                return;
            }
            await EstimateManager.collapseAllTree();
        });

        // Settings buttons
        document.getElementById('project-settings-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.currentRibbonTab = 'settings';
            this.applyRibbonTabToUI('settings');
            this.setSettingsActive('project');
            SettingsManager.showProjectSettings(this.currentProjectId);
        });

        document.getElementById('tolerance-settings-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.setOTiTBActive('instructions');
            InstructionsManager.show();
        });

        document.getElementById('worktypes-settings-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.setOTiTBActive('worktypes');
            WorkTypeGroupsManager.show();
        });

        document.getElementById('subcontractors-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.currentRibbonTab = 'settings';
            this.applyRibbonTabToUI('settings');
            this.setSettingsActive('subcontractors');
            SettingsManager.showSubcontractors(this.currentProjectId);
        });

        document.getElementById('hr-management-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.currentRibbonTab = 'settings';
            this.applyRibbonTabToUI('settings');
            this.setSettingsActive('hr');
            SettingsManager.showStaffManagement(this.currentProjectId);
        });

        // Interface toggles
        document.getElementById('toggle-breadcrumbs-btn')?.addEventListener('click', (e) => {
            this.userSettings.showBreadcrumbs = !this.userSettings.showBreadcrumbs;
            this.saveUserSettings();
            this.applyUserSettings();
        });

        document.getElementById('toggle-weather-btn')?.addEventListener('click', (e) => {
            this.userSettings.showWeather = !this.userSettings.showWeather;
            this.saveUserSettings();
            this.applyUserSettings();
        });

        document.getElementById('toggle-aqi-btn')?.addEventListener('click', (e) => {
            this.userSettings.showAQI = !this.userSettings.showAQI;
            this.saveUserSettings();
            this.applyUserSettings();
        });

        document.getElementById('permit-board-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.setOTiTBActive('permit');
            this.showPermitBoard();
        });


        const ribbonToggle = document.getElementById('ribbon-collapse-toggle');
        if (ribbonToggle) {
            ribbonToggle.addEventListener('click', () => {
                this.toggleRibbonCollapsed();
            });
        }

        const sidebarToggle = document.getElementById('sidebar-collapse-toggle');
        const sidebar = document.getElementById('sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent sidebar click event
                this.toggleSidebarCollapsed();
            });

            // Click sidebar to expand if collapsed
            sidebar.addEventListener('click', (e) => {
                if (this.sidebarCollapsed) {
                    this.setSidebarCollapsed(false);
                }
            });

            // Robust expanding for project list items (capturing phase)
            const projectList = document.getElementById('project-list');
            if (projectList) {
                projectList.addEventListener('click', (e) => {
                    if (this.sidebarCollapsed) {
                        this.setSidebarCollapsed(false);
                    }
                }, true); // Capture phase to ensure it runs before other handlers
            }

            // Click outside to collapse if expanded
            document.addEventListener('click', (e) => {
                if (!this.sidebarCollapsed &&
                    !sidebar.contains(e.target) &&
                    !sidebarToggle.contains(e.target)) {
                    this.setSidebarCollapsed(true);
                }
            });
        }

        document.getElementById('btn-filter-linked')?.addEventListener('click', () => {
            EstimateManager.filterResources('linked');
        });
        document.getElementById('btn-filter-unlinked')?.addEventListener('click', () => {
            EstimateManager.filterResources('unlinked');
        });
        document.getElementById('btn-filter-reset')?.addEventListener('click', () => {
            EstimateManager.filterResources('all');
        });

        document.querySelectorAll('.viewer-mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.viewerMode;
                EstimateManager.setViewerDisplayMode(mode);
            });
        });

        document.getElementById('isolate-btn')?.addEventListener('click', () => {
            EstimateManager.isolateSelected();
        });
        document.getElementById('unisolate-btn')?.addEventListener('click', () => {
            EstimateManager.showAllElements();
        });

        // Global click to close dropdowns
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('legal-actions-menu');
            const toggle = document.getElementById('legal-actions-toggle');
            if (menu && menu.style.display === 'block' && !menu.contains(e.target) && !toggle?.contains(e.target)) {
                menu.style.display = 'none';
            }

            // Global click to close legal filter dropdowns
            if (!e.target.closest('[onclick*="toggleLegalDropdown"]')) {
                const app = window.app;
                if (app && (app.legalDropdowns.docType || app.legalDropdowns.status)) {
                    app.legalDropdowns.docType = false;
                    app.legalDropdowns.status = false;
                    app.loadLegalTab();
                }
            }
        });

        // Keyboard Shortcut for Legal/Estimate Filter (Double press F or А)
        document.addEventListener('keydown', (e) => {
            // Handle escape key to blur active input
            if (e.key === 'Escape') {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                }
                return;
            }

            const isLegalInbox = this.currentRibbonTab === 'legal' && this.currentLegalSubTab === 'inbox';
            const isEstimateTree = this.currentRibbonTab === 'estimate' && document.getElementById('tree-filter-btn');

            if (!isLegalInbox && !isEstimateTree) return;

            // Don't trigger toggle if inside an input/textarea
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (['input', 'textarea', 'select'].includes(activeTag) || document.activeElement?.isContentEditable) return;

            const key = e.key.toLowerCase();
            if (key === 'f' || key === 'а') { // English 'f' or Russian 'а'
                const now = Date.now();
                if (key === this.lastLegalKey && (now - this.lastLegalKeyPressTime) < 500) {
                    if (isLegalInbox) {
                        this.toggleLegalFilterPanel();
                    } else if (isEstimateTree && typeof EstimateManager !== 'undefined') {
                        EstimateManager.toggleFilterPanel(e);
                    }
                    this.lastLegalKeyPressTime = 0; // Reset
                } else {
                    this.lastLegalKeyPressTime = now;
                    this.lastLegalKey = key;
                }
            }
        });
    }

    setEstimateRibbonContext(context) {
        const blocksGroup = document.getElementById('ribbon-group-add-block');
        const estimatesGroup = document.getElementById('ribbon-group-add-estimate');
        const importGroup = document.getElementById('ribbon-group-import');
        const viewGroup = document.getElementById('ribbon-group-view-tools');
        const stageGroup = document.getElementById('ribbon-group-stage-actions');
        const resourceGroup = document.getElementById('ribbon-group-resource-filters');
        const viewerGroup = document.getElementById('ribbon-group-viewer-modes');
        const sepAfterBlocks = document.getElementById('ribbon-separator-after-blocks');
        const sepAfterEstimates = document.getElementById('ribbon-separator-after-estimates');
        const sepAfterImport = document.getElementById('ribbon-separator-after-import');
        const sepAfterView = document.getElementById('ribbon-separator-after-view');
        const sepAfterStage = document.getElementById('ribbon-separator-after-stage');
        const sepAfterResources = document.getElementById('ribbon-separator-after-resources');

        const contexts = {
            blocks: {
                show: [blocksGroup],
                hide: [estimatesGroup, importGroup, viewGroup, stageGroup, resourceGroup, viewerGroup, sepAfterBlocks, sepAfterEstimates, sepAfterImport, sepAfterView, sepAfterStage, sepAfterResources],
            },
            block: {
                show: [estimatesGroup],
                hide: [blocksGroup, importGroup, viewGroup, stageGroup, resourceGroup, viewerGroup, sepAfterBlocks, sepAfterEstimates, sepAfterImport, sepAfterView, sepAfterStage, sepAfterResources],
            },
            estimate: {
                show: [importGroup, sepAfterImport, viewGroup, sepAfterView, stageGroup, sepAfterStage, resourceGroup, sepAfterResources, viewerGroup],
                hide: [blocksGroup, estimatesGroup, sepAfterBlocks, sepAfterEstimates],
            },
        };

        const target = contexts[context] || contexts.blocks;
        this.toggleRibbonElements(target.show, false);
        this.toggleRibbonElements(target.hide, true);
    }

    toggleRibbonElements(elements = [], hidden = true) {
        elements.forEach((el) => {
            if (!el) return;
            el.classList.toggle('hidden', hidden);
        });
    }

    createProject() {
        UI.showCreateProjectModal(async (data) => {
            try {
                const project = await api.createProject(data);
                UI.closeModal();
                UI.showNotification('Проект создан успешно', 'success');

                // Перезагружаем список проектов
                await this.loadProjects();

                // Выбираем новый проект
                this.selectProject(project.id);
            } catch (error) {
                UI.showNotification('Ошибка создания проекта: ' + error.message, 'error');
            }
        });
    }

    toggleProjectMenu(projectId, event) {
        // Закрываем все открытые меню
        document.querySelectorAll('.project-menu.active').forEach(menu => {
            if (menu.id !== `project-menu-${projectId}`) {
                menu.classList.remove('active');
            }
        });

        // Переключаем текущее меню
        const menu = document.getElementById(`project-menu-${projectId}`);
        if (menu) {
            menu.classList.toggle('active');
        }
    }

    editProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        UI.showCreateProjectModal(async (data) => {
            try {
                await api.updateProject(projectId, data);
                UI.closeModal();
                UI.showNotification('Проект обновлен успешно', 'success');

                // Перезагружаем список проектов
                await this.loadProjects();
            } catch (error) {
                UI.showNotification('Ошибка обновления проекта: ' + error.message, 'error');
            }
        }, project);

        // Закрываем меню
        this.closeAllProjectMenus();
    }

    async deleteProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        if (!confirm(`Вы уверены, что хотите удалить проект "${project.name}"?`)) {
            return;
        }

        try {
            await api.deleteProject(projectId);
            UI.showNotification('Проект удален успешно', 'success');

            // Если удаляем текущий проект, сбрасываем выбор
            if (this.currentProjectId === projectId) {
                this.currentProjectId = null;
                localStorage.removeItem('probim_last_project_id');
            }

            // Перезагружаем список проектов
            await this.loadProjects();
        } catch (error) {
            UI.showNotification('Ошибка удаления проекта: ' + error.message, 'error');
        }

        // Закрываем меню
        this.closeAllProjectMenus();
    }

    closeAllProjectMenus() {
        document.querySelectorAll('.project-menu.active').forEach(menu => {
            menu.classList.remove('active');
        });
    }

    addIncome() {
        UI.showNotification('Функционал в разработке', 'info');
    }

    addExpense() {
        UI.showNotification('Функционал в разработке', 'info');
    }

    escapeHtml(value = '') {
        return String(value).replace(/[&<>"']/g, (char) => {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            };
            return map[char] || char;
        });
    }

    restoreRibbonState() {
        const saved = localStorage.getItem('probim.ribbonCollapsed');
        const shouldCollapse = saved === 'true';
        this.setRibbonCollapsed(shouldCollapse);
    }

    toggleRibbonCollapsed() {
        this.setRibbonCollapsed(!this.ribbonCollapsed);
    }

    setRibbonCollapsed(collapsed) {
        const ribbon = document.querySelector('.office-ribbon');
        const toggle = document.getElementById('ribbon-collapse-toggle');
        if (!ribbon || !toggle) {
            this.ribbonCollapsed = collapsed;
            return;
        }

        this.ribbonCollapsed = Boolean(collapsed);
        ribbon.classList.toggle('collapsed', this.ribbonCollapsed);
        toggle.classList.toggle('is-collapsed', this.ribbonCollapsed);

        const title = this.ribbonCollapsed ? 'Развернуть ленту' : 'Свернуть ленту';
        toggle.setAttribute('aria-expanded', (!this.ribbonCollapsed).toString());
        toggle.setAttribute('aria-label', title);
        toggle.setAttribute('title', title);

        try {
            localStorage.setItem('probim.ribbonCollapsed', this.ribbonCollapsed ? 'true' : 'false');
        } catch (error) {
            console.warn('Failed to persist ribbon state:', error);
        }

        this.updateChatPosition();
    }

    restoreSidebarState() {
        const saved = localStorage.getItem('probim.sidebarCollapsed');
        const shouldCollapse = saved === 'true';
        this.setSidebarCollapsed(shouldCollapse, false);
    }

    toggleSidebarCollapsed() {
        this.setSidebarCollapsed(!this.sidebarCollapsed);
    }

    setSidebarCollapsed(collapsed, persist = true) {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-collapse-toggle');
        if (!sidebar || !toggle) {
            this.sidebarCollapsed = collapsed;
            return;
        }

        this.sidebarCollapsed = Boolean(collapsed);
        sidebar.classList.toggle('collapsed', this.sidebarCollapsed);

        const title = this.sidebarCollapsed ? 'Развернуть список объектов' : 'Свернуть список объектов';
        toggle.setAttribute('aria-expanded', (!this.sidebarCollapsed).toString());
        toggle.setAttribute('aria-label', title);
        toggle.setAttribute('title', title);

        if (persist) {
            try {
                localStorage.setItem('probim.sidebarCollapsed', this.sidebarCollapsed ? 'true' : 'false');
            } catch (error) {
                console.warn('Failed to persist sidebar state:', error);
            }
        }
    }

    // Добавить точку навигации в историю
    pushNavigationState(type, params = {}) {
        this.navigationHistory.push({
            type: type, // 'project', 'block', 'estimate', 'section'
            params: params,
            timestamp: Date.now()
        });
        // Ограничиваем историю последними 50 шагами
        if (this.navigationHistory.length > 50) {
            this.navigationHistory.shift();
        }
    }

    // Вернуться назад в навигации
    async goBack() {
        // Если истории нет или только один элемент, используем логику на основе текущего состояния
        if (this.navigationHistory.length <= 1) {
            return await this.goBackFromCurrentState();
        }

        // Удаляем текущее состояние из истории
        this.navigationHistory.pop();

        // Получаем предыдущее состояние
        const previousState = this.navigationHistory[this.navigationHistory.length - 1];

        if (!previousState) {
            // Если истории больше нет, возвращаемся к списку проектов
            if (this.currentProjectId && this.currentRibbonTab === 'estimate') {
                EstimateManager._isRestoring = true; // Помечаем как восстановление, чтобы не добавлять в историю
                await EstimateManager.renderEstimateTree(this.currentProjectId);
                EstimateManager._isRestoring = false;
                return;
            }
            return;
        }

        // Восстанавливаем предыдущее состояние (не добавляем в историю)
        EstimateManager._isRestoring = true;
        await this.restoreNavigationState(previousState);
        EstimateManager._isRestoring = false;
    }

    // Вернуться назад на основе текущего состояния
    async goBackFromCurrentState() {
        if (this.currentRibbonTab !== 'estimate') {
            // Если не на вкладке сметы, просто возвращаемся к списку проектов
            if (this.currentProjectId) {
                this.currentRibbonTab = 'estimate';
                this.applyRibbonTabToUI('estimate');
                EstimateManager._isRestoring = true;
                await EstimateManager.renderEstimateTree(this.currentProjectId);
                EstimateManager._isRestoring = false;
            }
            return;
        }

        // Проверяем текущий уровень в EstimateManager
        EstimateManager._isRestoring = true; // Помечаем как восстановление

        if (EstimateManager.currentSectionId) {
            // Находимся в разделе -> возвращаемся к смете
            if (EstimateManager.currentEstimateId) {
                await EstimateManager.openEstimate(EstimateManager.currentEstimateId);
            }
        } else if (EstimateManager.currentEstimateId) {
            // Находимся в смете -> возвращаемся к блоку
            if (EstimateManager.currentBlockId) {
                await EstimateManager.openBlock(EstimateManager.currentBlockId);
            }
        } else if (EstimateManager.currentBlockId) {
            // Находимся в блоке -> возвращаемся к списку блоков
            if (EstimateManager.currentProjectId) {
                await EstimateManager.renderEstimateTree(EstimateManager.currentProjectId);
            }
        }

        EstimateManager._isRestoring = false;
    }

    // Восстановить состояние навигации
    async restoreNavigationState(state) {
        if (this.currentRibbonTab !== 'estimate') {
            // Если не на вкладке сметы, переключаемся на неё
            this.currentRibbonTab = 'estimate';
            this.applyRibbonTabToUI('estimate');
        }

        switch (state.type) {
            case 'project':
                if (state.params.projectId) {
                    await EstimateManager.renderEstimateTree(state.params.projectId);
                }
                break;
            case 'block':
                if (state.params.blockId) {
                    await EstimateManager.openBlock(state.params.blockId);
                }
                break;
            case 'estimate':
                if (state.params.estimateId) {
                    await EstimateManager.openEstimate(state.params.estimateId);
                }
                break;
            case 'section':
                if (state.params.sectionId) {
                    await EstimateManager.openSection(state.params.sectionId);
                }
                break;
        }
    }

    async initWeather() {
        const widget = document.getElementById('weather-widget');
        const aqiWidget = document.getElementById('aqi-widget');
        if (!widget) return;

        const tempEl = widget.querySelector('.weather-temp');
        const cityEl = widget.querySelector('.weather-city');
        const iconContainer = widget.querySelector('.weather-icon');

        const aqiValueEl = document.getElementById('aqi-value');
        const aqiIndicator = document.getElementById('aqi-indicator');

        const updateUI = (temp, city, weatherCode, isDay) => {
            if (tempEl) tempEl.textContent = `${temp > 0 ? '+' : ''}${Math.round(temp)}°C`;
            if (cityEl) cityEl.textContent = city;

            if (iconContainer) {
                const getIconPath = (code, day) => {
                    const base = 'src/animated icons/';
                    if (code === 0) return day ? base + 'day.svg' : base + 'night.svg';
                    if (code >= 1 && code <= 3) return day ? base + 'cloudy-day-1.svg' : base + 'cloudy-night-1.svg';
                    if (code >= 45 && code <= 48) return base + 'cloudy.svg';
                    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return base + 'rainy-6.svg';
                    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return base + 'snowy-6.svg';
                    if (code >= 95) return base + 'thunder.svg';
                    return base + 'cloudy.svg';
                };

                const iconPath = getIconPath(weatherCode, isDay);
                iconContainer.innerHTML = `<img src="${iconPath}" alt="Weather Icon" />`;
            }
        };

        const aqiToPm25 = (aqi) => {
            // Официальная формула US EPA (инвертированная) для PM2.5
            if (aqi <= 50) return (aqi - 0) * (12.0 - 0) / (50 - 0) + 0;
            if (aqi <= 100) return (aqi - 51) * (35.4 - 12.1) / (100 - 51) + 12.1;
            if (aqi <= 150) return (aqi - 101) * (55.4 - 35.5) / (150 - 101) + 35.5;
            if (aqi <= 200) return (aqi - 151) * (150.4 - 55.5) / (200 - 151) + 55.5;
            if (aqi <= 300) return (aqi - 201) * (250.4 - 150.5) / (300 - 201) + 150.5;
            if (aqi <= 400) return (aqi - 301) * (350.4 - 250.5) / (400 - 301) + 250.5;
            return (aqi - 401) * (500.4 - 350.5) / (500 - 401) + 350.5;
        };

        const updateAQIUI = (aqi) => {
            if (!aqiValueEl || !aqiIndicator) return;

            const aqiNum = Math.round(aqi);
            aqiValueEl.textContent = aqiNum;

            // Вычисляем физический вес из индекса
            const pm25 = aqiToPm25(aqiNum);
            const pmEl = document.getElementById('pm-value');
            if (pmEl) {
                pmEl.textContent = Math.round(pm25);
            }

            aqiIndicator.className = 'aqi-indicator';

            if (aqiNum <= 50) {
                // Good
            } else if (aqiNum <= 100) {
                aqiIndicator.classList.add('moderate');
            } else if (aqiNum <= 150) {
                aqiIndicator.classList.add('sensitive');
            } else if (aqiNum <= 200) {
                aqiIndicator.classList.add('unhealthy');
            } else if (aqiNum <= 300) {
                aqiIndicator.style.background = '#8f3f97';
                aqiIndicator.style.color = '#8f3f97';
            } else {
                aqiIndicator.classList.add('hazardous');
            }

            const widget = document.getElementById('aqi-widget');
            if (widget) {
                widget.title = `Индекс AQI: ${aqiNum}\nКонцентрация PM2.5: ${pm25.toFixed(1)} мкг/м³`;
            }
        };

        const fetchWeatherAndAQI = async (lat, lon, city = 'Локация') => {
            try {
                // Fetch Weather (Open-Meteo ок для погоды)
                const weatherResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const weatherData = await weatherResp.json();
                if (weatherData.current_weather) {
                    const cw = weatherData.current_weather;
                    updateUI(cw.temperature, city, cw.weathercode, cw.is_day === 1);
                }

                // Fetch AQI from WAQI (World Air Quality Index)
                // Используем локацию "tashkent" или ближайшую станцию
                // Токен "demo" официальный для небольших нагрузок
                const aqiResp = await fetch(`https://api.waqi.info/feed/tashkent/?token=demo`);
                const aqiData = await aqiResp.json();

                if (aqiData.status === 'ok') {
                    updateAQIUI(aqiData.data.aqi);
                }
            } catch (e) {
                console.error('Environmental data fetch failed', e);
            }
        };

        // Геолокацию не запрашиваем (политика браузера), сразу дефолтный город
        await fetchWeatherAndAQI(41.3111, 69.2406, 'Ташкент');
    }
}

// Инициализация приложения
const app = new ProBIMApp();
window.app = app; // Делаем доступным глобально для других модулей

// Запуск при загрузке DOM
// document.addEventListener('DOMContentLoaded', () => {
//     app.init();
// });
