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
    }

    getInitialRibbonTab() {
        const allowed = new Set(['dashboard', 'estimate', 'schedule', 'supply', 'finance', 'analytics', 'otitb', 'settings']);

        // Очищаем хеш estimate при загрузке (legacy)
        const hash = (window.location.hash || '').replace('#', '').trim();
        if (hash === 'estimate') {
            window.history.replaceState(null, '', window.location.pathname);
        } else if (hash && allowed.has(hash)) {
            return hash;
        }

        const saved = (localStorage.getItem('probim_active_ribbon_tab') || '').trim();
        if (saved && allowed.has(saved)) return saved;

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

    async init() {
        console.log('🚀 ProBIM Application Starting...');

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
            html += `
                <li class="${isSelected ? 'selected' : ''}" onclick="app.selectProject('${project.id}')" title="${safeName}" aria-label="${safeName}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
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
                        <button onclick="event.stopPropagation(); app.deleteProject('${project.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Удалить
                        </button>
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
        } else {
            ribbon.classList.remove('disabled');
        }
    }

    async selectProject(projectId, isRestoring = false) {
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
            return;
        }

        switch (this.currentRibbonTab) {
            case 'dashboard':
                this.loadDashboardTab();
                break;
            case 'estimate':
                if (isRestoring && EstimateManager.restoreState) {
                    await EstimateManager.restoreState(this.currentProjectId);
                } else {
                    await EstimateManager.renderEstimateTree(this.currentProjectId);
                }
                break;
            case 'schedule':
                this.loadScheduleTab();
                break;
            case 'supply':
                this.loadSupplyTab();
                break;
            case 'finance':
                this.loadFinanceTab();
                break;
            case 'analytics':
                this.loadAnalyticsTab();
                break;
            case 'otitb':
                this.setOTiTBActive('instructions');
                InstructionsManager.show();
                break;
            case 'settings':
                await SettingsManager.showProjectSettings(this.currentProjectId);
                this.setSettingsActive('project');
                break;
            case 'norms-settings':
                await SettingsManager.showNormsSettings(this.currentProjectId);
                break;
        }
    }

    loadScheduleTab() {
        if (this.currentProjectId) {
            ScheduleManager.init(this.currentProjectId);
        }
    }

    loadSupplyTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2>Снабжение</h2>
                <p style="margin-top: 16px; color: var(--gray-600);">Функционал в разработке...</p>
            </div>
        `;
    }

    loadDashboardTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2 style="margin-bottom: 24px;">Дашборд</h2>
                
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
            subcontractors: document.getElementById('subcontractors-btn')
        };
        Object.entries(map).forEach(([key, btn]) => {
            if (!btn) return;
            btn.classList.toggle('active', key === mode);
        });
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
                            <div class="permit-filter-row"><input type="text" placeholder="Название" data-filter-field="title" data-status="${col.key}" value="${(this.permitFilters[col.key]?.title || '').replace(/"/g,'&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="НД номер" data-filter-field="issueId" data-status="${col.key}" value="${(this.permitFilters[col.key]?.issueId || '').replace(/"/g,'&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="Субподрядчик" data-filter-field="contractor" data-status="${col.key}" value="${(this.permitFilters[col.key]?.contractor || '').replace(/"/g,'&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="Дата выдачи" data-filter-field="date" data-status="${col.key}" value="${(this.permitFilters[col.key]?.date || '').replace(/"/g,'&quot;')}"></div>
                            <div class="permit-filter-row"><input type="text" placeholder="ФИО" data-filter-field="issuer" data-status="${col.key}" value="${(this.permitFilters[col.key]?.issuer || '').replace(/"/g,'&quot;')}"></div>
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

        // Schedule buttons
        document.getElementById('generate-schedule-btn')?.addEventListener('click', () => {
            ScheduleManager.showGenerationWizard();
        });

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
            ScheduleManager.showWorkDistributionWizard();
        });

        document.getElementById('export-schedule-btn')?.addEventListener('click', () => {
            ScheduleManager.exportToPDF();
        });

        // Schedule view tools (expand/collapse all)
        document.getElementById('schedule-expand-all-btn')?.addEventListener('click', () => {
            if (this.currentRibbonTab !== 'schedule') return;
            ScheduleManager.expandAll();
        });

        document.getElementById('schedule-collapse-all-btn')?.addEventListener('click', () => {
            if (this.currentRibbonTab !== 'schedule') return;
            ScheduleManager.collapseAll();
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

        document.getElementById('expand-worktypes-btn')?.addEventListener('click', async () => {
            if (!EstimateManager.currentEstimateId && !EstimateManager.currentSectionId) {
                UI.showNotification('Сначала откройте смету', 'error');
                return;
            }
            await EstimateManager.expandToWorkTypes();
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

        document.getElementById('permit-board-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.setOTiTBActive('permit');
            this.showPermitBoard();
        });

        document.getElementById('norms-settings-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            this.currentRibbonTab = 'norms-settings';
            this.loadCurrentTab();
        });

        const ribbonToggle = document.getElementById('ribbon-collapse-toggle');
        if (ribbonToggle) {
            ribbonToggle.addEventListener('click', () => {
                this.toggleRibbonCollapsed();
            });
        }

        const sidebarToggle = document.getElementById('sidebar-collapse-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebarCollapsed();
            });
        }

        const addStageBtn = document.getElementById('add-stage-btn');
        if (addStageBtn) {
            addStageBtn.addEventListener('click', () => {
                if (!EstimateManager.currentEstimateId) {
                    UI.showNotification('Сначала откройте смету', 'error');
                    return;
                }
                EstimateManager.createStageForEstimate(EstimateManager.currentEstimateId);
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
}

// Инициализация приложения
const app = new ProBIMApp();
window.app = app; // Делаем доступным глобально для других модулей

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
