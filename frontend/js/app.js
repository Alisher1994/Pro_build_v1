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
    }

    async init() {
        console.log('🚀 ProBIM Application Starting...');
        
        // Загрузка проектов
        await this.loadProjects();

        // Восстанавливаем состояние интерфейса
        this.restoreRibbonState();
        this.restoreSidebarState();
        
        // Инициализация обработчиков
        this.initEventHandlers();
        this.setEstimateRibbonContext('blocks');
        
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
            list.innerHTML = `
                <li style="text-align: center; padding: 20px; color: var(--gray-600);">
                    <div style="margin-bottom: 12px;">Нет проектов</div>
                    <button class="btn btn-primary" style="width: 100%;" onclick="app.createProject()">
                        Создать проект
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
                </li>
            `;
        });

        list.innerHTML = html;
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
                    <p>Выберите проект из списка слева или создайте новый</p>
                    <button class="primary-btn" onclick="app.createProject()">Создать первый проект</button>
                </div>
            `;
            return;
        }

        switch (this.currentRibbonTab) {
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
            case 'settings':
                await SettingsManager.showProjectSettings(this.currentProjectId);
                break;
        }
    }

    loadScheduleTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2>График производства работ (ГПР)</h2>
                <p style="margin-top: 16px; color: var(--gray-600);">Функционал в разработке...</p>
            </div>
        `;
    }

    loadSupplyTab() {
        document.getElementById('content-area').innerHTML = `
            <div style="padding: 24px;">
                <h2>Снабжение</h2>
                <p style="margin-top: 16px; color: var(--gray-600);">Функционал в разработке...</p>
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

        // Settings button
        document.getElementById('project-settings-btn')?.addEventListener('click', () => {
            if (!this.currentProjectId) {
                UI.showNotification('Сначала выберите проект', 'error');
                return;
            }
            SettingsManager.showProjectSettings(this.currentProjectId);
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
        const viewGroup = document.getElementById('ribbon-group-view-tools');
        const stageGroup = document.getElementById('ribbon-group-stage-actions');
        const resourceGroup = document.getElementById('ribbon-group-resource-filters');
        const viewerGroup = document.getElementById('ribbon-group-viewer-modes');
        const sepAfterBlocks = document.getElementById('ribbon-separator-after-blocks');
        const sepAfterEstimates = document.getElementById('ribbon-separator-after-estimates');
        const sepAfterView = document.getElementById('ribbon-separator-after-view');
        const sepAfterStage = document.getElementById('ribbon-separator-after-stage');
        const sepAfterResources = document.getElementById('ribbon-separator-after-resources');

        const contexts = {
            blocks: {
                show: [blocksGroup],
                hide: [estimatesGroup, viewGroup, stageGroup, resourceGroup, viewerGroup, sepAfterBlocks, sepAfterEstimates, sepAfterView, sepAfterStage, sepAfterResources],
            },
            block: {
                show: [estimatesGroup],
                hide: [blocksGroup, viewGroup, stageGroup, resourceGroup, viewerGroup, sepAfterBlocks, sepAfterEstimates, sepAfterView, sepAfterStage, sepAfterResources],
            },
            estimate: {
                show: [viewGroup, sepAfterView, stageGroup, sepAfterStage, resourceGroup, sepAfterResources, viewerGroup],
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
}

// Инициализация приложения
const app = new ProBIMApp();

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
