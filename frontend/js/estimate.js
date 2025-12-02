// ========================================
// Estimate Module - Управление сметами
// ========================================

const EstimateManager = {
    currentProjectId: null,
    currentProject: null,
    currentBlockId: null,
    currentBlock: null,
    currentEstimateId: null,
    currentEstimate: null,
    currentSectionId: null,
    currentSection: null,
    currentStageId: null,

    // Получить символ текущей валюты проекта
    getCurrencySymbol() {
        const currency = this.currentProject?.currency || 'RUB';
        const symbols = {
            'RUB': '₽',
            'UZS': 'сўм',
            'USD': '$',
            'EUR': '€',
            'KGS': 'сом',
            'KZT': '₸',
            'TJS': 'ЅМ',
            'TMT': 'm',
            'AZN': '₼',
            'BYN': 'Br',
            'UAH': '₴',
            'GBP': '£',
            'CNY': '¥',
            'TRY': '₺',
            'AED': 'د.إ'
        };
        return symbols[currency] || currency;
    },

    // Восстановление состояния (открытый блок или смета)
    async restoreState(projectId) {
        this.currentProjectId = projectId;
        
        try {
            // Получаем данные проекта (нужно для валюты и контекста)
            this.currentProject = await api.getProject(projectId);

            const lastEstimateId = localStorage.getItem('probim_last_estimate_id');
            const lastBlockId = localStorage.getItem('probim_last_block_id');

            if (lastEstimateId) {
                // Если была открыта смета, проверяем, принадлежит ли она текущему проекту (косвенно через блок)
                // Но проще просто попробовать открыть. Если ошибка (404) - сбросим.
                console.log('Restoring estimate:', lastEstimateId);
                // Нам нужно знать blockId для openEstimate, но openEstimate сам его подтянет если мы сохраним его в this.currentBlockId?
                // Нет, openEstimate принимает estimateId. Но ему нужен currentBlockId для breadcrumbs.
                // Давайте сначала восстановим блок.
                
                if (lastBlockId) {
                    this.currentBlockId = lastBlockId;
                    await this.openEstimate(lastEstimateId);
                    return;
                }
            }

            if (lastBlockId) {
                console.log('Restoring block:', lastBlockId);
                await this.openBlock(lastBlockId);
                return;
            }

            // Если ничего не сохранено, рендерим дерево блоков
            await this.renderEstimateTree(projectId);

        } catch (error) {
            console.error('Error restoring state:', error);
            // В случае ошибки сбрасываем состояние и показываем корень
            localStorage.removeItem('probim_last_estimate_id');
            localStorage.removeItem('probim_last_block_id');
            await this.renderEstimateTree(projectId);
        }
    },

    async renderEstimateTree(projectId) {
        this.currentProjectId = projectId;
        
        // Если мы рендерим дерево блоков явно, значит мы вышли на уровень вверх
        // Очищаем сохраненное состояние глубины
        localStorage.removeItem('probim_last_block_id');
        localStorage.removeItem('probim_last_estimate_id');
        
        try {
            // Получаем данные проекта
            this.currentProject = await api.getProject(projectId);
            
            // Получаем блоки проекта
            const blocks = await api.getBlocks(projectId);
            
            const contentArea = document.getElementById('content-area');
            
            if (blocks.length === 0) {
                contentArea.innerHTML = `
                    <div class="welcome-screen">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="7" height="7"/>
                            <rect x="14" y="3" width="7" height="7"/>
                            <rect x="14" y="14" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/>
                        </svg>
                        <h2>Блоки не созданы</h2>
                        <p>Создайте первый блок для начала работы со сметами</p>
                        <button class="primary-btn" onclick="EstimateManager.createBlock()">Создать блок</button>
                    </div>
                `;
                return;
            }

            // Строим дерево блоков и смет
            let html = '<div class="estimate-tree">';
            
            for (const block of blocks) {
                html += this.renderBlockItem(block);
            }
            
            html += '</div>';
            
            contentArea.innerHTML = html;
            
            // Добавляем обработчики событий
            this.attachEventHandlers();

            if (typeof app !== 'undefined' && typeof app.setEstimateRibbonContext === 'function') {
                app.setEstimateRibbonContext('blocks');
            }
            
        } catch (error) {
            console.error('Error rendering estimate tree:', error);
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    renderBlockItem(block) {
        return `
            <div class="tree-item block-item" data-block-id="${block.id}" onclick="EstimateManager.openBlock('${block.id}')" style="cursor: pointer;">
                <div class="tree-item-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span style="flex: 1; margin-left: 12px; font-weight: 600; font-size: 15px;">${block.name}</span>
                    <span style="color: var(--gray-600); font-size: 13px; margin-right: 12px;">${block.floors} эт., ${block.area || 0} м²</span>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); EstimateManager.editBlock('${block.id}')" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; margin-right: 4px;" title="Редактировать">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-danger" onclick="event.stopPropagation(); EstimateManager.deleteBlock('${block.id}')" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px;" title="Удалить">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    async openBlock(blockId) {
        this.currentBlockId = blockId;
        
        // Сохраняем состояние
        localStorage.setItem('probim_last_block_id', blockId);
        localStorage.removeItem('probim_last_estimate_id');
        
        try {
            const block = await api.getBlock(blockId);
            const estimates = await api.getEstimates(this.currentProjectId, blockId);
            
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div style="font-size: 10px; color: var(--gray-600);">
                            <span style="color: var(--gray-500);">${this.currentProject.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.renderEstimateTree('${this.currentProjectId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к блокам">Блоки</span>
                            <span style="margin: 0 8px;">/</span>
                            <span style="font-weight: 700; color: var(--gray-900);">${block.name}</span>
                        </div>
                        <h2 style="margin: 0;">Сметы</h2>
                    </div>
                    <div id="estimates-container"></div>
                </div>
            `;

            if (typeof app !== 'undefined' && typeof app.setEstimateRibbonContext === 'function') {
                app.setEstimateRibbonContext('block');
            }

            await this.loadEstimates(blockId);
            
        } catch (error) {
            UI.showNotification('Ошибка загрузки блока: ' + error.message, 'error');
        }
    },

    async loadEstimates(blockId) {
        try {
            const estimates = await api.getEstimates(this.currentProjectId, blockId);
            const container = document.getElementById('estimates-container');
            
            if (estimates.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 16px;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <h3 style="color: var(--gray-600); margin-bottom: 8px;">Сметы не созданы</h3>
                        <p style="color: var(--gray-500); font-size: 14px;">Добавьте первую смету для этого блока</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="data-table"><table><thead><tr>';
            html += '<th>Название сметы</th><th>Описание</th><th>Стоимость</th><th style="width: 28%;">IFC модель</th><th>Действия</th>';
            html += '</tr></thead><tbody>';

            for (const estimate of estimates) {
                const hasIfc = Boolean(estimate.xktFileUrl);
                const fileName = estimate.ifcFileUrl ? estimate.ifcFileUrl.split('/').pop() : '';
                html += `
                    <tr style="cursor: pointer;" onclick="EstimateManager.openEstimate('${estimate.id}')">
                        <td><strong>${estimate.name}</strong></td>
                        <td>${estimate.description || '-'}</td>
                        <td style="font-weight: 600; color: var(--primary);">${UI.formatCurrency(estimate.totalCost, this.currentProject?.currency)}</td>
                        <td>
                            <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                                <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                                    <span style="width: 32px; height: 32px; border-radius: 50%; background: ${hasIfc ? 'rgba(16,124,16,0.12)' : 'rgba(96,94,92,0.15)'}; display: flex; align-items: center; justify-content: center;">
                                        ${hasIfc ? `
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        ` : `
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" stroke-width="2" stroke-linecap="round">
                                                <circle cx="12" cy="12" r="9" />
                                            </svg>
                                        `}
                                    </span>
                                    <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                                        <span style="font-size: 12px; font-weight: 600; color: ${hasIfc ? 'var(--accent-green)' : 'var(--gray-600)'};">
                                            ${hasIfc ? 'IFC модель привязана' : 'IFC не загружена'}
                                        </span>
                                        <span style="font-size: 12px; color: var(--gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${hasIfc ? fileName || '' : ''}">
                                            ${hasIfc ? `Файл: ${fileName || '—'}` : 'Нет файла'}
                                        </span>
                                    </div>
                                </div>
                                <button onclick="event.stopPropagation(); EstimateManager.uploadIFCForEstimate('${estimate.id}', { stayOnList: true })" class="btn btn-secondary" style="width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;" title="${hasIfc ? 'Обновить IFC' : 'Загрузить IFC'}" aria-label="${hasIfc ? 'Обновить IFC' : 'Загрузить IFC'}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="23 4 23 10 17 10" />
                                        <polyline points="1 20 1 14 7 14" />
                                        <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" />
                                        <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14" />
                                    </svg>
                                </button>
                            </div>
                        </td>
                        <td>
                            <button onclick="event.stopPropagation(); EstimateManager.editEstimate('${estimate.id}')" class="btn btn-secondary" style="width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; margin-right: 6px;" title="Редактировать" aria-label="Редактировать">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                </svg>
                            </button>
                            <button onclick="event.stopPropagation(); EstimateManager.deleteEstimate('${estimate.id}')" class="btn btn-danger" style="width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Удалить" aria-label="Удалить">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            </button>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;
            
        } catch (error) {
            UI.showNotification('Ошибка загрузки смет: ' + error.message, 'error');
        }
    },

    attachEventHandlers() {
        // Event handlers are now attached inline in renderEstimateTree
    },

    async createEstimate(blockId) {
        const content = `
            <div class="form-group">
                <label>Название сметы *</label>
                <input type="text" id="estimate-name" placeholder="Например: Основная смета" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="estimate-description" placeholder="Описание сметы"></textarea>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-estimate-btn">Создать</button>
        `;

        UI.showModal('Новая смета', content, buttons);

        setTimeout(() => {
            document.getElementById('save-estimate-btn').addEventListener('click', async () => {
                const data = {
                    projectId: this.currentProjectId,
                    blockId: blockId,
                    name: document.getElementById('estimate-name').value.trim(),
                    description: document.getElementById('estimate-description').value.trim(),
                };

                if (!data.name) {
                    alert('Введите название сметы');
                    return;
                }

                try {
                    await api.createEstimate(data);
                    UI.closeModal();
                    UI.showNotification('Смета создана', 'success');
                    this.loadEstimates(blockId);
                } catch (error) {
                    UI.showNotification('Ошибка: ' + error.message, 'error');
                }
            });
        }, 100);
    },

    async editEstimate(estimateId) {
        try {
            const estimate = await api.getEstimate(estimateId);
            
            const content = `
                <div class="form-group">
                    <label>Название сметы *</label>
                    <input type="text" id="estimate-name" value="${estimate.name}" required>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="estimate-description">${estimate.description || ''}</textarea>
                </div>
            `;

            const buttons = `
                <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
                <button class="btn btn-primary" id="save-estimate-btn">Сохранить</button>
            `;

            UI.showModal('Редактировать смету', content, buttons);

            setTimeout(() => {
                document.getElementById('save-estimate-btn').addEventListener('click', async () => {
                    const data = {
                        name: document.getElementById('estimate-name').value.trim(),
                        description: document.getElementById('estimate-description').value.trim(),
                    };

                    if (!data.name) {
                        alert('Введите название сметы');
                        return;
                    }

                    try {
                        await api.updateEstimate(estimateId, data);
                        UI.closeModal();
                        UI.showNotification('Смета обновлена', 'success');
                        this.loadEstimates(this.currentBlockId);
                    } catch (error) {
                        UI.showNotification('Ошибка: ' + error.message, 'error');
                    }
                });
            }, 100);
        } catch (error) {
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    async deleteEstimate(estimateId) {
        UI.confirmDelete('Удалить эту смету и все её разделы?', async () => {
            try {
                await api.deleteEstimate(estimateId);
                UI.showNotification('Смета удалена', 'success');
                this.loadEstimates(this.currentBlockId);
            } catch (error) {
                UI.showNotification('Ошибка удаления: ' + error.message, 'error');
            }
        });
    },

    async openEstimate(estimateId) {
        this.currentEstimateId = estimateId;
        
        // Сохраняем состояние
        localStorage.setItem('probim_last_estimate_id', estimateId);

        try {
            const estimate = await api.getEstimate(estimateId);
            
            // Если currentBlockId не установлен, берем его из сметы
            if (!this.currentBlockId && estimate.blockId) {
                this.currentBlockId = estimate.blockId;
            }
            
            // Сохраняем block_id
            if (this.currentBlockId) {
                localStorage.setItem('probim_last_block_id', this.currentBlockId);
            }

            // Если block уже пришел с estimate (благодаря include: { block: true }), используем его
            // Иначе запрашиваем отдельно
            let block = estimate.block;
            if (!block && this.currentBlockId) {
                block = await api.getBlock(this.currentBlockId);
            }
            
            const hasIfc = Boolean(estimate.xktFileUrl);
            const ifcFileName = estimate.ifcFileUrl ? estimate.ifcFileUrl.split('/').pop() : null;

            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                    <!-- Заголовок -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: var(--white); border-bottom: 1px solid var(--gray-300); flex-shrink: 0;">
                        <div style="font-size: 10px; color: var(--gray-600);">
                            <span style="color: var(--gray-500);">${this.currentProject.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.renderEstimateTree('${this.currentProjectId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к блокам">Блоки</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openBlock('${this.currentBlockId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к сметам">${block.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span style="font-weight: 700; color: var(--gray-900);">${estimate.name}</span>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="text-align: right; display: flex; flex-direction: column; gap: 4px;">
                                <span style="font-size: 12px; font-weight: 600; color: ${hasIfc ? 'var(--accent-green)' : 'var(--gray-600)'};">
                                    ${hasIfc ? 'IFC модель привязана к этой смете' : 'IFC модель не прикреплена'}
                                </span>
                                <span style="font-size: 11px; color: var(--gray-500);">
                                    ${hasIfc ? `Файл: ${ifcFileName || '—'} (доступен справа)` : 'Добавьте IFC в списке смет, чтобы активировать 3D просмотр'}
                                </span>
                            </div>
                            <div id="selection-info" style="display: none; flex: 0 0 auto; padding: 8px 12px; background: var(--primary-lighter); border: 1px solid var(--primary); border-radius: 6px; font-size: 12px; color: var(--primary);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="16" x2="12" y2="12"/>
                                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                                </svg>
                                <span id="selection-info-text">Выберите ресурсы (Ctrl+Click) и элементы в 3D модели, затем нажмите "Связать"</span>
                            </div>
                            <button id="btn-link-resource" onclick="EstimateManager.linkSelectedResource()" class="btn btn-success" style="display: none;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                </svg>
                                <span id="link-btn-text">Связать</span>
                            </button>
                            <button id="btn-unlink-resource" onclick="EstimateManager.unlinkSelectedResource()" class="btn btn-warning" style="display: none;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                                    <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/>
                                    <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/>
                                    <line x1="8" x2="8" y1="2" y2="5"/>
                                    <line x1="2" x2="5" y1="8" y2="8"/>
                                    <line x1="16" x2="16" y1="19" y2="22"/>
                                    <line x1="19" x2="22" y1="16" y2="16"/>
                                </svg>
                                <span id="unlink-btn-text">Отвязать</span>
                            </button>
                        </div>
                    </div>

                    <!-- Трехпанельный интерфейс -->
                    <div style="flex: 1; display: flex; overflow: hidden;">
                        <!-- Левая панель: Структура сметы -->
                        <div id="left-panel" style="width: 70%; background: var(--white); border-right: 1px solid var(--gray-300); display: flex; flex-direction: column; overflow: hidden;">
                            <div style="padding: 12px 16px; background: var(--gray-50); border-bottom: 1px solid var(--gray-300);">
                                <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-700);">Структура сметы</h3>
                            </div>
                            <div id="estimate-tree-container" style="flex: 1; overflow-y: auto; padding: 16px;">
                                <div style="text-align: center; padding: 40px; color: var(--gray-600);">
                                    Загрузка этапов...
                                </div>
                            </div>
                        </div>

                        <!-- Разделитель (resizable) -->
                        <div id="resize-divider" style="width: 4px; background: var(--gray-300); cursor: col-resize; flex-shrink: 0;"></div>

                        <!-- Правая часть: 3D модель и свойства -->
                        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                            <!-- 3D Viewer -->
                            <div id="ifc-viewer-panel" style="flex: 60; background: var(--gray-900); position: relative; overflow: hidden;">
                                <canvas id="ifc-canvas" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;"></canvas>
                                <div id="ifc-viewer-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); display: flex; align-items: center; justify-content: center; pointer-events: none;">
                                    <div style="text-align: center; color: var(--gray-400);">
                                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px;">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                            <line x1="12" y1="22.08" x2="12" y2="12"/>
                                        </svg>
                                        <p style="font-size: 16px; margin-bottom: 8px;">3D Просмотр IFC модели</p>
                                            <p id="ifc-status-text" style="font-size: 13px; color: var(--gray-500);">IFC модель отсутствует. Загрузите её на экране списка смет</p>
                                    </div>
                                </div>
                                <!-- Панель управления viewer -->
                                <div id="viewer-controls" class="viewer-controls">
                                    <div class="viewer-control-row">
                                        <button onclick="EstimateManager.viewerZoomIn()" class="viewer-btn" title="Приблизить">
                                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                                                <circle cx="12" cy="12" r="8"/>
                                                <line x1="12" y1="8" x2="12" y2="16"/>
                                                <line x1="8" y1="12" x2="16" y2="12"/>
                                            </svg>
                                        </button>
                                        <button onclick="EstimateManager.viewerZoomOut()" class="viewer-btn" title="Отдалить">
                                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                                                <circle cx="12" cy="12" r="8"/>
                                                <line x1="8" y1="12" x2="16" y2="12"/>
                                            </svg>
                                        </button>
                                        <button onclick="EstimateManager.viewerFitToView()" class="viewer-btn" title="Центрировать модель">
                                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                                                <circle cx="12" cy="12" r="9"/>
                                                <line x1="12" y1="5" x2="12" y2="19"/>
                                                <line x1="5" y1="12" x2="19" y2="12"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Нижняя панель: Свойства элемента -->
                            <div id="properties-panel" style="flex: 40; background: var(--white); overflow-y: auto; border-top: 1px solid var(--gray-300); display: flex; flex-direction: column;">
                                <div style="padding: 12px 16px; background: var(--gray-50); border-bottom: 1px solid var(--gray-300); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-700);">Свойства выбранного элемента</h3>
                                    <div class="properties-tab-controls" style="display: flex; gap: 6px;">
                                        <button class="properties-tab-btn active" data-properties-tab="all" style="border: 1px solid var(--gray-300); background: var(--white); padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                                            Все параметры
                                        </button>
                                        <button class="properties-tab-btn" data-properties-tab="norms" style="border: 1px solid var(--gray-300); background: var(--white); padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                                            Нормативы
                                        </button>
                                    </div>
                                </div>
                                <div style="flex: 1; overflow-y: auto;">
                                    <div id="element-properties" class="properties-tab-pane" data-properties-tab="all" style="padding: 16px;">
                                        ${this.getEmptyPropertiesMarkup()}
                                    </div>
                                    <div id="element-norms" class="properties-tab-pane" data-properties-tab="norms" style="padding: 16px; display: none;">
                                        <div style="padding: 24px; text-align: center; color: var(--gray-600); border: 1px dashed var(--gray-300); border-radius: 8px; background: var(--gray-50);">
                                            Нормативы
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.updateViewerDisplayModeButtons();
            await this.loadEstimateStructure(estimateId);

            if (typeof app !== 'undefined' && typeof app.setEstimateRibbonContext === 'function') {
                app.setEstimateRibbonContext('estimate');
            }

            if (typeof app !== 'undefined' && typeof app.setEstimateRibbonContext === 'function') {
                app.setEstimateRibbonContext('estimate');
            }
            
            // Инициализируем xeokit viewer
            await this.initializeViewer();
            
            // Добавляем resizable divider
            this.initResizablePanels();
            this.initPropertiesTabs();

            if (hasIfc && estimate.xktFileUrl) {
                await this.loadIfcViewer(estimate.id, `http://localhost:3001/${estimate.xktFileUrl}`);
            } else {
                const statusText = document.getElementById('ifc-status-text');
                const overlay = document.getElementById('ifc-viewer-overlay');
                const controls = document.getElementById('viewer-controls');
                if (statusText) {
                    statusText.textContent = 'IFC модель отсутствует. Загрузите её на экране списка смет';
                }
                if (overlay) {
                    overlay.style.display = 'flex';
                }
                if (controls) {
                    controls.classList.remove('is-visible');
                }
            }
            
        } catch (error) {
            UI.showNotification('Ошибка загрузки сметы: ' + error.message, 'error');
        }
    },

    initResizablePanels() {
        const divider = document.getElementById('resize-divider');
        const leftPanel = document.getElementById('left-panel');
        
        if (!divider || !leftPanel) return;
        
        let isResizing = false;
        
        divider.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const container = leftPanel.parentElement;
            const containerRect = container.getBoundingClientRect();
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            
            if (newWidth > 20 && newWidth < 85) {
                leftPanel.style.width = newWidth + '%';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    },

    initPropertiesTabs() {
        const tabButtons = document.querySelectorAll('.properties-tab-btn');
        if (!tabButtons.length) {
            return;
        }

        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.propertiesTab;
                this.setPropertiesTab(targetTab);
            });
        });

        this.setPropertiesTab(this.activePropertiesTab || 'all');
    },

    setPropertiesTab(tab) {
        if (!tab) {
            return;
        }

        this.activePropertiesTab = tab;

        const buttons = document.querySelectorAll('.properties-tab-btn');
        buttons.forEach((btn) => {
            const isActive = btn.dataset.propertiesTab === tab;
            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? 'var(--primary)' : 'var(--white)';
            btn.style.color = isActive ? '#fff' : 'var(--gray-700)';
            btn.style.borderColor = isActive ? 'var(--primary)' : 'var(--gray-300)';
        });

        const panes = document.querySelectorAll('.properties-tab-pane');
        panes.forEach((pane) => {
            pane.style.display = pane.dataset.propertiesTab === tab ? 'block' : 'none';
        });
    },

    getEmptyPropertiesMarkup() {
        return `
            <div style="text-align: center; padding: 40px 20px; color: var(--gray-500);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 12px;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <p style="font-size: 14px;">Выберите элемент в 3D модели или дереве слева</p>
            </div>
        `;
    },

    escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    extractAttributePrimitive(value) {
        if (value && typeof value === 'object') {
            if (Object.prototype.hasOwnProperty.call(value, 'value')) {
                return value.value;
            }
            if (Object.prototype.hasOwnProperty.call(value, 'Value')) {
                return value.Value;
            }
        }
        return value;
    },

    formatAttributeValue(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        const primitiveValue = this.extractAttributePrimitive(value);
        if (primitiveValue === null || primitiveValue === undefined || primitiveValue === '') {
            return '—';
        }

        if (typeof primitiveValue === 'object') {
            try {
                return JSON.stringify(primitiveValue);
            } catch (error) {
                console.warn('Не удалось сериализовать значение атрибута', error);
                return String(primitiveValue);
            }
        }

        return String(primitiveValue);
    },

    formatMeasure(value, unit = 'м', fractionDigits = 3) {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return '—';
        }
        return `${value.toFixed(fractionDigits)} ${unit}`;
    },

    computeElementDimensions(aabb) {
        if (!Array.isArray(aabb) || aabb.length < 6) {
            return null;
        }

        const length = Math.abs(aabb[3] - aabb[0]); // X axis
        const height = Math.abs(aabb[4] - aabb[1]); // Y axis
        const depth = Math.abs(aabb[5] - aabb[2]);  // Z axis

        return {
            length,
            height,
            depth,
            width: length,
            side: depth,
            area: length * depth,
            volume: length * height * depth,
        };
    },

    findAttributeValue(attributes = {}, aliases = []) {
        if (!attributes || typeof attributes !== 'object') {
            return undefined;
        }

        const loweredAliases = aliases
            .filter(Boolean)
            .map((alias) => alias.toLowerCase());

        for (const [key, value] of Object.entries(attributes)) {
            if (loweredAliases.includes(key.toLowerCase())) {
                return this.extractAttributePrimitive(value);
            }
        }

        return undefined;
    },

    async copyTextToClipboard(text, label = 'значение') {
        if (text === undefined || text === null || text === '' || text === '—') {
            UI?.showNotification?.(`Нет данных для копирования (${label})`, 'warning');
            return;
        }

        const stringValue = String(text);

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(stringValue);
            } else {
                const tempInput = document.createElement('textarea');
                tempInput.value = stringValue;
                tempInput.style.position = 'fixed';
                tempInput.style.opacity = '0';
                document.body.appendChild(tempInput);
                tempInput.focus();
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
            }
            UI?.showNotification?.(`Скопировано: ${label}`, 'success');
        } catch (error) {
            console.error('Clipboard copy failed', error);
            UI?.showNotification?.('Не удалось скопировать значение', 'error');
        }
    },

    getCopyButtonHtml(value, label = 'Скопировать', extraClass = '') {
        const icon = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;

        return `
            <button class="property-copy-btn ${extraClass}" data-copy-value="${this.escapeHtml(value ?? '')}" data-copy-label="${this.escapeHtml(label)}" title="${this.escapeHtml(label)}" type="button" style="border: none; background: transparent; padding: 2px; cursor: pointer; color: var(--primary); display: inline-flex; align-items: center; justify-content: center;">
                ${icon}
            </button>
        `;
    },

    bindCopyButtons(rootEl = document) {
        const buttons = rootEl.querySelectorAll('.property-copy-btn');
        buttons.forEach((btn) => {
            if (btn.dataset.copyBound === 'true') return;
            btn.dataset.copyBound = 'true';
            btn.addEventListener('click', () => {
                const value = btn.dataset.copyValue;
                const label = btn.dataset.copyLabel || 'значение';
                this.copyTextToClipboard(value, label);
            });
        });
    },

    async loadEstimateStructure(estimateId) {
        try {
            // Sections = Этапы в нашем случае
            const sections = await api.getSections(estimateId);
            const container = document.getElementById('estimate-tree-container');

            if (sections.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 12px;">
                            <path d="M12 2v20M2 12h20"/>
                        </svg>
                        <p style="color: var(--gray-600); font-size: 14px; margin-bottom: 12px;">Этапы не созданы</p>
                        <button onclick="EstimateManager.createStageForEstimate('${estimateId}')" class="btn btn-primary btn-sm">
                            Создать первый этап
                        </button>
                    </div>
                `;
                return;
            }

            // Рендерим этапы (sections) которые содержат виды работ (stages)
            let html = '<div class="tree-structure">';
            for (const section of sections) {
                html += await this.renderStageTree(section);
            }
            html += '</div>';
            container.innerHTML = html;
            this.highlightResourceElements([]);
            
            // Сбрасываем фильтр на "все" после загрузки
            this.currentResourceFilter = 'all';
            const btnReset = document.getElementById('btn-filter-reset');
            const btnLinked = document.getElementById('btn-filter-linked');
            const btnUnlinked = document.getElementById('btn-filter-unlinked');
            if (btnReset) btnReset.classList.add('active');
            if (btnLinked) btnLinked.classList.remove('active');
            if (btnUnlinked) btnUnlinked.classList.remove('active');
            
        } catch (error) {
            console.error('Error loading estimate structure:', error);
            const container = document.getElementById('estimate-tree-container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--red-600);">
                        <p>Ошибка загрузки структуры</p>
                    </div>
                `;
            }
        }
    },

    async renderStageTree(section) {
        // section = это наш ЭТАП (EstimateSection в БД)
        const stages = await api.getStages(section.id);  // stages = виды работ
        
        // Вычисляем сумму всех видов работ для этого этапа
        let calculatedSectionTotal = 0;
        for (const stage of stages) {
            // Получаем ресурсы для каждого вида работ
            const workTypes = await api.getWorkTypes(stage.id);
            let stageTotal = 0;
            for (const wt of workTypes) {
                stageTotal += (wt.totalCost || 0);
            }
            calculatedSectionTotal += stageTotal > 0 ? stageTotal : (stage.totalCost || 0);
        }
        
        // Используем вычисленную сумму, если она больше 0
        const displaySectionTotal = calculatedSectionTotal > 0 ? calculatedSectionTotal : (section.totalCost || 0);
        
        let html = `
            <div class="tree-item stage-item" data-stage-id="${section.id}" style="margin-bottom: 6px; background: var(--white); border: 1px solid var(--gray-200); border-radius: 6px; overflow: hidden;">
                <div class="stage-header" style="display: flex; align-items: center; padding: 10px 12px; background: linear-gradient(to bottom, #f8f9fa, #e9ecef); border-bottom: 1px solid var(--gray-300);">
                    <span class="collapse-icon" onclick="EstimateManager.toggleStageInTree('${section.id}')" style="margin-right: 10px; cursor: pointer; font-size: 14px; user-select: none;">▶</span>
                    <span class="stage-name-editable" data-stage-id="${section.id}" style="flex: 1; cursor: text; font-weight: 600; font-size: 13px; color: var(--gray-900); padding: 2px 6px; border-radius: 3px; transition: background 0.2s;" onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background='transparent'">${section.name}</span>
                    <span class="stage-total-cost" style="font-size: 12px; color: var(--primary); font-weight: 600; margin-right: 8px;">${UI.formatCurrency(displaySectionTotal, this.currentProject?.currency)}</span>
                    <button onclick="EstimateManager.createWorkTypeForStage('${section.id}'); event.stopPropagation();" class="btn-icon-small" style="width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--primary); background: var(--white); color: var(--primary); cursor: pointer; display: flex; align-items: center; justify-content: center; margin-right: 4px; font-size: 16px; font-weight: bold;" title="Добавить вид работ">+</button>
                    <button onclick="EstimateManager.deleteStageFromEstimate('${section.id}'); event.stopPropagation();" class="btn-icon-small" style="width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--red-500); background: var(--white); color: var(--red-500); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px;" title="Удалить этап">×</button>
                </div>
                <div id="stage-tree-${section.id}" class="tree-children" style="display: none; padding: 8px 12px;">
        `;

        if (stages.length === 0) {
            html += `
                <div style="padding: 16px 8px; text-align: center; color: var(--gray-500); font-size: 13px;">
                    Виды работ не созданы
                    <div style="margin-top: 8px;">
                        <button onclick="EstimateManager.createWorkTypeForStage('${section.id}')" class="btn btn-primary btn-sm">Создать первый вид работ</button>
                    </div>
                </div>
            `;
        } else {
            html += '<div class="work-types-list" style="display: flex; flex-direction: column; gap: 4px;">';
            for (const stage of stages) {
                html += await this.renderWorkTypeRow(stage, section.id);
            }
            html += '</div>';
        }

        html += `
                </div>
            </div>
        `;
        
        // Добавляем обработчик inline редактирования для названия этапа
        setTimeout(() => {
            const nameElement = document.querySelector(`[data-stage-id="${section.id}"].stage-name-editable`);
            if (nameElement) {
                this.makeEditable(nameElement, section.name, async (newValue) => {
                    await api.updateSection(section.id, { name: newValue });
                    nameElement.textContent = newValue;
                    UI.showNotification('Этап обновлен', 'success');
                });
            }
        }, 50);
        
        return html;
    },

    async renderWorkTypeRow(stage, sectionId) {
        // stage = это наш ВИД РАБОТ (EstimateStage в БД)
        // Получаем ресурсы напрямую для stage (пока через workTypes, но логически это ресурсы)
        const workTypes = await api.getWorkTypes(stage.id);
        
        // WorkTypes здесь - это фактически ресурсы
        let allResources = [];
        let calculatedTotal = 0; // Вычисляем сумму на фронтенде
        
        for (const wt of workTypes) {
            // WorkType тут используется как Resource
            const parsedIfcElements = this.parseIfcElements(wt.ifcElements);
            const resourceTotal = wt.totalCost || 0;
            calculatedTotal += resourceTotal;
            
            allResources.push({
                id: wt.id,
                name: wt.name,
                description: wt.description || '',
                quantity: wt.quantity || 0,
                unitCost: wt.unitCost || 0,
                totalCost: resourceTotal,
                unit: wt.unit || 'шт',
                type: 'material', // по умолчанию
                ifcElements: parsedIfcElements,
                ifcProperties: wt.ifcProperties || null,
            });
        }
        
        // Используем вычисленную сумму, если она больше 0, иначе берем из stage
        const displayTotal = calculatedTotal > 0 ? calculatedTotal : (stage.totalCost || 0);
        
        const UNITS = ['шт', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'комплект', 'услуга'];
        
        let html = `
            <div class="work-type-item" data-worktype-id="${stage.id}" style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 4px; padding: 8px 10px; transition: all 0.2s;">
                <div class="work-type-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                    <span class="collapse-icon-wt" onclick="EstimateManager.toggleWorkTypeInTree('${stage.id}')" style="cursor: pointer; font-size: 12px; user-select: none; width: 16px; text-align: center;">${allResources.length > 0 ? '▶' : '•'}</span>
                    <span class="wt-name-editable" data-wt-id="${stage.id}" style="flex: 1; cursor: text; font-size: 13px; padding: 2px 4px; border-radius: 3px;" onmouseover="this.style.background='var(--gray-200)'" onmouseout="this.style.background='transparent'">${stage.name}</span>
                    <span class="wt-total-cost" style="font-size: 11px; color: var(--primary); font-weight: 600; min-width: 80px; text-align: right;">${UI.formatCurrency(displayTotal, this.currentProject?.currency)}</span>
                    <button onclick="EstimateManager.createResourceForStage('${stage.id}'); event.stopPropagation();" class="btn-icon-tiny" style="width: 20px; height: 20px; border-radius: 3px; border: 1px solid var(--primary); background: var(--white); color: var(--primary); cursor: pointer; font-size: 14px; font-weight: bold;" title="Добавить ресурс">+</button>
                    <button onclick="EstimateManager.deleteWorkTypeFromStage('${stage.id}'); event.stopPropagation();" class="btn-icon-tiny" style="width: 20px; height: 20px; border-radius: 3px; border: 1px solid var(--red-500); background: var(--white); color: var(--red-500); cursor: pointer; font-size: 16px;" title="Удалить вид работ">×</button>
                </div>
                <div id="worktype-resources-${stage.id}" class="resources-container" style="display: none; margin-left: 26px; margin-top: 6px;">
        `;

        if (allResources.length === 0) {
            html += `
                <div style="padding: 8px; color: var(--gray-500); font-size: 11px; font-style: italic;">
                    Ресурсы не добавлены
                </div>
            `;
        } else {
            for (const resource of allResources) {
                html += this.renderResourceRow(resource, stage.id);
            }
        }

        html += `
                </div>
            </div>
        `;

        // Добавляем обработчики inline редактирования для вида работ
        setTimeout(() => {
            const nameEl = document.querySelector(`[data-wt-id="${stage.id}"].wt-name-editable`);
            if (nameEl) {
                this.makeEditable(nameEl, stage.name, async (newValue) => {
                    await api.updateStage(stage.id, { name: newValue });
                    nameEl.textContent = newValue;
                    UI.showNotification('Вид работ обновлен', 'success');
                });
            }
        }, 50);

        return html;
    },

    renderResourceRow(resource, stageId) {
        // resource - это WorkType который мы используем как ресурс
        const UNITS = ['шт', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'комплект', 'услуга'];
        const TYPES = ['material', 'labor', 'equipment', 'service'];
        const TYPE_ICONS = {
            'material': '📦',
            'labor': '👷',
            'equipment': '⚙️',
            'service': '🔧'
        };

        const typeIcon = TYPE_ICONS[resource.type] || '📦';
        const totalCost = (resource.quantity || 0) * (resource.unitCost || 0);
        
        // Проверяем наличие связи с IFC элементами
        const parsedIfcElements = this.parseIfcElements(resource.ifcElements);
        const hasIfcLink = parsedIfcElements.length > 0;
        const ifcElementsJson = JSON.stringify(parsedIfcElements);
        const linkIcon = hasIfcLink 
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-green);"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--gray-400);"><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/></svg>`;

        let html = `
            <div class="resource-item" data-resource-id="${resource.id}" data-has-ifc-link="${hasIfcLink}" data-ifc-elements='${ifcElementsJson}' style="background: var(--white); border: 1px solid var(--gray-200); border-radius: 3px; padding: 6px 8px; margin-bottom: 3px; font-size: 11px; cursor: pointer; transition: all 0.15s ease;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" class="resource-checkbox" data-resource-id="${resource.id}" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);" title="Ctrl+Click для выбора">
                    <span class="res-link-icon" data-res-id="${resource.id}" style="display: flex; align-items: center; cursor: help;" title="${hasIfcLink ? 'Связано с IFC элементами' : 'Не связано с IFC'}">${linkIcon}</span>
                    <span class="res-type-editable" data-res-id="${resource.id}" style="font-size: 16px; cursor: pointer;" title="Тип: ${resource.type}">${typeIcon}</span>
                    <span class="res-name-editable" data-res-id="${resource.id}" style="flex: 1; cursor: text; padding: 2px 4px; border-radius: 2px;" onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background='transparent'">${resource.name}</span>
                    <span class="res-unit-editable" data-res-id="${resource.id}" style="cursor: pointer; padding: 2px 4px; background: var(--gray-100); border-radius: 2px; min-width: 30px; text-align: center;">${resource.unit}</span>
                    <span class="res-quantity-editable" data-res-id="${resource.id}" style="cursor: text; padding: 2px 4px; background: var(--gray-100); border-radius: 2px; min-width: 40px; text-align: right;">${UI.formatNumber(resource.quantity)}</span>
                    <span class="res-unitcost-editable" data-res-id="${resource.id}" style="cursor: text; padding: 2px 4px; background: var(--gray-100); border-radius: 2px; min-width: 60px; text-align: right;">${UI.formatCurrency(resource.unitCost, this.currentProject?.currency)}</span>
                    <span style="font-weight: 600; color: var(--primary); min-width: 70px; text-align: right;">${UI.formatCurrency(totalCost, this.currentProject?.currency)}</span>
                    <button onclick="EstimateManager.deleteResourceFromWorkType('${resource.id}'); event.stopPropagation();" class="btn-icon-tiny" style="width: 18px; height: 18px; border-radius: 2px; border: 1px solid var(--red-400); background: var(--white); color: var(--red-500); cursor: pointer; font-size: 14px;" title="Удалить ресурс">×</button>
                </div>
            </div>
        `;

        // Добавляем обработчики после рендера
        setTimeout(() => {
            const typeEl = document.querySelector(`[data-res-id="${resource.id}"].res-type-editable`);
            if (typeEl) {
                const TYPE_NAMES = ['material', 'labor', 'equipment', 'service'];
                const TYPE_LABELS = {
                    'material': '📦 Материал',
                    'labor': '👷 Работа',
                    'equipment': '⚙️ Оборудование',
                    'service': '🔧 Услуга'
                };
                typeEl.onclick = async (e) => {
                    e.stopPropagation();
                    if (typeEl.querySelector('select')) return;
                    
                    const select = document.createElement('select');
                    select.style.cssText = 'padding: 2px; border: 2px solid var(--primary); border-radius: 3px; font-size: 14px;';
                    
                    TYPE_NAMES.forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = TYPE_LABELS[type];
                        if (type === resource.type) option.selected = true;
                        select.appendChild(option);
                    });
                    
                    select.onchange = async () => {
                        const newType = select.value;
                        await api.updateWorkType(resource.id, { description: newType });
                        typeEl.textContent = TYPE_ICONS[newType];
                        typeEl.title = 'Тип: ' + newType;
                        UI.showNotification('Тип ресурса изменен', 'success');
                    };
                    
                    select.onblur = () => {
                        typeEl.innerHTML = TYPE_ICONS[resource.type];
                    };
                    
                    typeEl.innerHTML = '';
                    typeEl.appendChild(select);
                    select.focus();
                };
            }

            const nameEl = document.querySelector(`[data-res-id="${resource.id}"].res-name-editable`);
            if (nameEl) {
                this.makeEditable(nameEl, resource.name, async (newValue) => {
                    await api.updateWorkType(resource.id, { name: newValue });
                    nameEl.textContent = newValue;
                    UI.showNotification('Ресурс обновлен', 'success');
                });
            }

            const unitEl = document.querySelector(`[data-res-id="${resource.id}"].res-unit-editable`);
            if (unitEl) {
                this.makeEditableSelect(unitEl, resource.unit, UNITS, async (newValue) => {
                    await api.updateWorkType(resource.id, { unit: newValue });
                    unitEl.textContent = newValue;
                });
            }

            const quantityEl = document.querySelector(`[data-res-id="${resource.id}"].res-quantity-editable`);
            if (quantityEl) {
                this.makeEditable(quantityEl, resource.quantity.toString(), async (newValue) => {
                    const numValue = parseFloat(newValue.replace(/\s/g, '')) || 0;
                    await api.updateWorkType(resource.id, { quantity: numValue });
                    quantityEl.textContent = UI.formatNumber(numValue);
                    // Обновляем только сумму без перезагрузки
                    const totalCost = numValue * resource.unitCost;
                    const parent = quantityEl.closest('.resource-item');
                    const totalEl = parent.querySelector('span[style*="font-weight: 600"]');
                    if (totalEl) totalEl.textContent = UI.formatCurrency(totalCost, this.currentProject?.currency);
                    
                    // Запускаем каскадный пересчет вверх по иерархии
                    await this.recalculateHierarchyFixed(resource.id);
                    // Обновляем суммы в DOM без перезагрузки структуры
                    await this.updateHierarchySumsFixed(resource.id);
                });
            }

            const unitCostEl = document.querySelector(`[data-res-id="${resource.id}"].res-unitcost-editable`);
            if (unitCostEl) {
                this.makeEditable(unitCostEl, resource.unitCost.toString(), async (newValue) => {
                    const numValue = parseFloat(newValue.replace(/\s/g, '').replace(/[^\d.]/g, '')) || 0;
                    await api.updateWorkType(resource.id, { unitCost: numValue });
                    unitCostEl.textContent = UI.formatCurrency(numValue, this.currentProject?.currency);
                    // Обновляем только сумму без перезагрузки
                    const totalCost = resource.quantity * numValue;
                    const parent = unitCostEl.closest('.resource-item');
                    const totalEl = parent.querySelector('span[style*="font-weight: 600"]');
                    if (totalEl) totalEl.textContent = UI.formatCurrency(totalCost, this.currentProject?.currency);
                    
                    // Запускаем каскадный пересчет вверх по иерархии
                    await this.recalculateHierarchyFixed(resource.id);
                    // Обновляем суммы в DOM без перезагрузки структуры
                    await this.updateHierarchySumsFixed(resource.id);
                });
            }
            
            // Обработчик клика по чекбоксу
            const checkbox = document.querySelector(`.resource-checkbox[data-resource-id="${resource.id}"]`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.selectResource(resource.id);
                });
            }
            
            // Обработчик клика по строке ресурса для выбора (Ctrl+Click или обычный клик)
            const resourceItem = document.querySelector(`[data-resource-id="${resource.id}"]`);
            if (resourceItem) {
                resourceItem.addEventListener('click', (e) => {
                    // Игнорируем клики по чекбоксу и редактируемым элементам
                    if (e.target.classList.contains('resource-checkbox') || 
                        e.target.classList.contains('res-type-editable') ||
                        e.target.classList.contains('res-name-editable') ||
                        e.target.classList.contains('res-unit-editable') ||
                        e.target.classList.contains('res-quantity-editable') ||
                        e.target.classList.contains('res-unitcost-editable') ||
                        e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'SELECT' ||
                        e.target.tagName === 'INPUT') {
                        return;
                    }
                    
                    // Ctrl+Click или обычный клик переключает выбор
                    if (e.ctrlKey || e.metaKey || true) {
                        e.stopPropagation();
                        this.selectResource(resource.id);
                    }
                });
            }
        }, 50);

        return html;
    },

    toggleWorkTypeInTree(workTypeId) {
        const element = document.getElementById(`worktype-resources-${workTypeId}`);
        const icon = document.querySelector(`#worktype-resources-${workTypeId}`).previousElementSibling.querySelector('.collapse-icon-wt');
        
        if (element.style.display === 'none') {
            element.style.display = 'block';
            if (icon) icon.textContent = '▼';
        } else {
            element.style.display = 'none';
            if (icon) icon.textContent = '▶';
        }
    },

    toggleSection(sectionId) {
        const element = document.getElementById(`section-${sectionId}`);
        const header = element.previousElementSibling;
        const arrow = header.querySelector('span');
        
        if (element.style.display === 'none') {
            element.style.display = 'block';
            arrow.textContent = '▼';
        } else {
            element.style.display = 'none';
            arrow.textContent = '▶';
        }
    },

    toggleStageInTree(stageId) {
        const element = document.getElementById(`stage-tree-${stageId}`);
        const header = element.previousElementSibling;
        const arrow = header.querySelector('span');
        
        if (element.style.display === 'none') {
            element.style.display = 'block';
            arrow.textContent = '▼';
        } else {
            element.style.display = 'none';
            arrow.textContent = '▶';
        }
    },

    async selectWorkTypeInTree(workTypeId) {
        try {
            const workType = await api.getWorkType(workTypeId);
            const resources = await api.getResources(workTypeId);
            
            const propertiesPanel = document.getElementById('element-properties');
            
            let html = `
                <div style="padding: 16px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 16px; color: var(--gray-900);">${workType.name}</h3>
                    
                    <div style="background: var(--gray-50); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                            <div>
                                <div style="color: var(--gray-600); margin-bottom: 4px;">Единица</div>
                                <div style="font-weight: 600;">${workType.unit}</div>
                            </div>
                            <div>
                                <div style="color: var(--gray-600); margin-bottom: 4px;">Количество</div>
                                <div style="font-weight: 600;">${UI.formatNumber(workType.quantity)}</div>
                            </div>
                            <div>
                                <div style="color: var(--gray-600); margin-bottom: 4px;">Цена за ед.</div>
                                <div style="font-weight: 600;">${UI.formatCurrency(workType.unitCost, this.currentProject?.currency)}</div>
                            </div>
                            <div>
                                <div style="color: var(--gray-600); margin-bottom: 4px;">Общая стоимость</div>
                                <div style="font-weight: 600; color: var(--primary); font-size: 15px;">${UI.formatCurrency(workType.totalCost, this.currentProject?.currency)}</div>
                            </div>
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 12px 0; font-size: 14px; color: var(--gray-700);">Ресурсы (${resources.length})</h4>
            `;

            if (resources.length === 0) {
                html += `
                    <div style="text-align: center; padding: 20px; color: var(--gray-500); font-size: 13px;">
                        Ресурсы не добавлены
                    </div>
                `;
            } else {
                for (const resource of resources) {
                    const typeIcon = resource.type === 'material' ? '📦' : resource.type === 'labor' ? '👷' : '⚙️';
                    html += `
                        <div style="padding: 10px; background: var(--white); border: 1px solid var(--gray-200); border-radius: 4px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                                <div style="font-size: 13px; font-weight: 600;">${typeIcon} ${resource.name}</div>
                                <div style="font-size: 13px; color: var(--primary); font-weight: 600;">${UI.formatCurrency(resource.totalCost, this.currentProject?.currency)}</div>
                            </div>
                            <div style="font-size: 12px; color: var(--gray-600);">
                                ${UI.formatNumber(resource.quantity)} ${resource.unit} × ${UI.formatCurrency(resource.unitCost, this.currentProject?.currency)}
                            </div>
                        </div>
                    `;
                }
            }

            html += `
                    <div style="margin-top: 20px; display: flex; gap: 8px;">
                        <button onclick="EstimateManager.editWorkType('${workTypeId}')" class="btn btn-secondary btn-sm" style="flex: 1;">Редактировать</button>
                        <button onclick="EstimateManager.createResource('${workTypeId}')" class="btn btn-primary btn-sm" style="flex: 1;">+ Ресурс</button>
                    </div>
                </div>
            `;

            propertiesPanel.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading work type details:', error);
        }
    },

    async loadSections(estimateId) {
        try {
            const sections = await api.getSections(estimateId);
            const container = document.getElementById('sections-container');

            if (sections.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 16px;">
                            <rect x="3" y="3" width="7" height="7"/>
                            <rect x="14" y="3" width="7" height="7"/>
                            <rect x="14" y="14" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/>
                        </svg>
                        <h3 style="color: var(--gray-600); margin-bottom: 8px;">Этапы не созданы</h3>
                        <p style="color: var(--gray-500); font-size: 14px;">Добавьте первый этап сметы (АР, КЖ, ОВ и т.д.)</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="data-table"><table><thead><tr>';
            html += '<th>Код</th><th>Название раздела</th><th>Описание</th><th>Стоимость</th><th>IFC модель</th><th>Действия</th>';
            html += '</tr></thead><tbody>';

            for (const section of sections) {
                const ifcStatus = section.ifcFileUrl 
                    ? `<span style="color: var(--accent-green); font-weight: 600;">✓ Загружен</span>` 
                    : `<span style="color: var(--gray-500);">Не загружен</span>`;
                
                const ifcButton = section.ifcFileUrl
                    ? `<button onclick="EstimateManager.replaceIFC('${section.id}')" class="btn btn-secondary" style="padding: 4px 12px; height: auto; margin-right: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <polyline points="1 4 1 10 7 10"/>
                            <polyline points="23 20 23 14 17 14"/>
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        Заменить IFC
                    </button>`
                    : `<button onclick="EstimateManager.uploadIFC('${section.id}')" class="btn btn-primary" style="padding: 4px 12px; height: auto; margin-right: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Загрузить IFC
                    </button>`;
                
                html += `
                    <tr>
                        <td><strong>${section.code}</strong></td>
                        <td><a href="#" onclick="EstimateManager.openSection('${section.id}'); return false;" style="color: var(--primary); text-decoration: none;">${section.name}</a></td>
                        <td>${section.description || '-'}</td>
                        <td style="font-weight: 600; color: var(--primary);">${UI.formatCurrency(section.totalCost, this.currentProject?.currency)}</td>
                        <td>${ifcStatus}</td>
                        <td>
                            ${ifcButton}
                            ${section.ifcFileUrl ? `<button onclick="EstimateManager.viewIFC('${section.id}')" class="btn btn-secondary" style="padding: 4px 12px; height: auto; margin-right: 4px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                                Просмотр
                            </button>` : ''}
                            <button onclick="EstimateManager.deleteSection('${section.id}')" class="btn btn-danger" style="padding: 4px 12px; height: auto;">
                                Удалить
                            </button>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading sections:', error);
        }
    },

    async createSection(estimateId) {
        try {
            const data = {
                estimateId: estimateId,
                code: 'Этап ' + (new Date().getTime() % 1000),
                name: 'Новый этап'
            };
            await api.createSection(data);
            UI.showNotification('Этап создан', 'success');
            await this.loadEstimateStructure(estimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    async deleteBlock(blockId) {
        UI.confirmDelete('Вы уверены, что хотите удалить этот блок? Все сметы будут удалены.', async () => {
            try {
                await api.deleteBlock(blockId);
                UI.showNotification('Блок удален', 'success');
                this.renderEstimateTree(this.currentProjectId);
            } catch (error) {
                UI.showNotification('Ошибка удаления: ' + error.message, 'error');
            }
        });
    },

    async editBlock(blockId) {
        try {
            const block = await api.getBlock(blockId);
            
            const content = `
                <div class="form-group">
                    <label>Название блока *</label>
                    <input type="text" id="block-name" value="${block.name}" required>
                </div>
                <div class="form-group">
                    <label>Количество этажей *</label>
                    <input type="number" id="block-floors" value="${block.floors}" required>
                </div>
                <div class="form-group">
                    <label>Площадь (м²)</label>
                    <input type="number" id="block-area" value="${block.area || ''}" step="0.01">
                </div>
            `;

            const buttons = `
                <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
                <button class="btn btn-primary" id="save-block-btn">Сохранить</button>
            `;

            UI.showModal('Редактировать блок', content, buttons);

            setTimeout(() => {
                document.getElementById('save-block-btn').addEventListener('click', async () => {
                    const data = {
                        name: document.getElementById('block-name').value.trim(),
                        floors: parseInt(document.getElementById('block-floors').value),
                        area: parseFloat(document.getElementById('block-area').value) || null
                    };

                    if (!data.name || !data.floors) {
                        alert('Заполните обязательные поля');
                        return;
                    }

                    try {
                        await api.updateBlock(blockId, data);
                        UI.closeModal();
                        UI.showNotification('Блок обновлен', 'success');
                        this.renderEstimateTree(this.currentProjectId);
                    } catch (error) {
                        UI.showNotification('Ошибка: ' + error.message, 'error');
                    }
                });
            }, 100);
        } catch (error) {
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    async deleteSection(sectionId) {
        UI.confirmDelete('Удалить этот раздел сметы?', async () => {
            try {
                await api.deleteSection(sectionId);
                UI.showNotification('Раздел удален', 'success');
                this.loadSections(this.currentEstimateId);
            } catch (error) {
                UI.showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    },

    // ========================================
    // Работа с разделом - этапы, виды работ, ресурсы
    // ========================================

    async openSection(sectionId) {
        this.currentSectionId = sectionId;
        
        try {
            const section = await api.getSection(sectionId);
            const estimate = await api.getEstimate(this.currentEstimateId);
            const block = await api.getBlock(this.currentBlockId);
            
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                    <!-- Заголовок -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: var(--white); border-bottom: 1px solid var(--gray-300); flex-shrink: 0;">
                        <div style="font-size: 10px; color: var(--gray-600);">
                            <span style="color: var(--gray-500);">${this.currentProject.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.renderEstimateTree('${this.currentProjectId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к блокам">Блоки</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openBlock('${this.currentBlockId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к сметам">${block.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openEstimate('${this.currentEstimateId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к разделам">${estimate.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span style="font-weight: 700; color: var(--gray-900);">${section.code} - ${section.name}</span>
                        </div>
                        <button onclick="EstimateManager.createStage('${sectionId}')" class="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                <path d="M12 5v14"/>
                                <path d="M5 12h14"/>
                            </svg>
                            Добавить этап
                        </button>
                    </div>

                    <!-- Трехпанельный интерфейс -->
                    <div style="flex: 1; display: flex; overflow: hidden;">
                        <!-- Левая панель: Таблица этапов/работ/ресурсов -->
                        <div id="left-panel" style="width: 35%; background: var(--white); border-right: 1px solid var(--gray-300); display: flex; flex-direction: column; overflow: hidden;">
                            <div style="padding: 12px 16px; background: var(--gray-50); border-bottom: 1px solid var(--gray-300);">
                                <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-700);">Структура сметы</h3>
                            </div>
                            <div id="stages-tree-container" style="flex: 1; overflow-y: auto; padding: 16px;">
                                <div style="text-align: center; padding: 40px; color: var(--gray-600);">
                                    Загрузка этапов...
                                </div>
                            </div>
                        </div>

                        <!-- Правая часть: 3D модель и свойства -->
                        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                            <!-- 3D Viewer -->
                            <div id="ifc-viewer-panel" style="flex: 60; background: var(--gray-900); position: relative; overflow: hidden;">
                                ${section.ifcFileUrl ? `
                                    <div id="ifc-viewer" style="width: 100%; height: 100%; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); display: flex; align-items: center; justify-content: center;">
                                        <div style="text-align: center; color: var(--gray-400);">
                                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px;">
                                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                                            </svg>
                                            <p style="font-size: 16px; margin-bottom: 8px;">3D Просмотр IFC модели</p>
                                            <p style="font-size: 13px; color: var(--gray-500);">Интеграция с xeokit в разработке</p>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--gray-400);">
                                        <div style="text-align: center;">
                                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px;">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="17 8 12 3 7 8"/>
                                                <line x1="12" y1="3" x2="12" y2="15"/>
                                            </svg>
                                            <p style="font-size: 16px; margin-bottom: 8px;">IFC модель не загружена</p>
                                            <button onclick="EstimateManager.uploadIFC('${sectionId}')" class="btn btn-primary" style="margin-top: 16px;">
                                                Загрузить IFC файл
                                            </button>
                                        </div>
                                    </div>
                                `}
                            </div>

                            <!-- Нижняя панель: Свойства элемента -->
                            <div id="properties-panel" style="flex: 40; background: var(--white); overflow-y: auto; border-top: 1px solid var(--gray-300);">
                                <div style="padding: 12px 16px; background: var(--gray-50); border-bottom: 1px solid var(--gray-300);">
                                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-700);">Свойства выбранного элемента</h3>
                                </div>
                                <div id="element-properties" style="padding: 16px;">
                                    <div style="text-align: center; padding: 40px 20px; color: var(--gray-500);">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 12px;">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="12" y1="16" x2="12" y2="12"/>
                                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                                        </svg>
                                        <p style="font-size: 14px;">Выберите элемент в 3D модели</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            await this.loadStagesTree(sectionId);
            
        } catch (error) {
            UI.showNotification('Ошибка загрузки раздела: ' + error.message, 'error');
        }
    },

    async loadStagesTree(sectionId) {
        try {
            const stages = await api.getStages(sectionId);
            const container = document.getElementById('stages-tree-container');

            if (stages.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 12px;">
                            <path d="M12 2v20M2 12h20"/>
                        </svg>
                        <p style="color: var(--gray-600); font-size: 14px; margin-bottom: 12px;">Этапы не созданы</p>
                        <button onclick="EstimateManager.createStage('${sectionId}')" class="btn btn-primary btn-sm">
                            Создать первый этап
                        </button>
                    </div>
                `;
                return;
            }

            // Древовидная структура
            let html = '<div class="tree-structure">';
            for (const stage of stages) {
                html += `
                    <div class="tree-node" style="margin-bottom: 8px;">
                        <div onclick="EstimateManager.toggleStage('${stage.id}')" style="padding: 8px 12px; background: var(--gray-50); border-left: 3px solid var(--primary); cursor: pointer; border-radius: 4px;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <svg id="stage-icon-${stage.id}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="9 18 15 12 9 6"/>
                                    </svg>
                                    <strong>${stage.name}</strong>
                                </div>
                                <span style="font-size: 12px; color: var(--primary);">${UI.formatCurrency(stage.totalCost, this.currentProject?.currency)}</span>
                            </div>
                        </div>
                        <div id="stage-${stage.id}-content" style="display: none; margin-left: 20px; margin-top: 4px;"></div>
                    </div>
                `;
            }
            html += '</div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading stages tree:', error);
        }
    },

    async toggleStage(stageId) {
        const content = document.getElementById(`stage-${stageId}-content`);
        const icon = document.getElementById(`stage-icon-${stageId}`);
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
            await this.loadWorkTypesTree(stageId);
        } else {
            content.style.display = 'none';
            icon.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
        }
    },

    async loadWorkTypesTree(stageId) {
        try {
            const workTypes = await api.getWorkTypes(stageId);
            const container = document.getElementById(`stage-${stageId}-content`);

            if (workTypes.length === 0) {
                container.innerHTML = `<div style="padding: 8px; color: var(--gray-500); font-size: 13px;">Нет видов работ</div>`;
                return;
            }

            let html = '';
            for (const workType of workTypes) {
                html += `
                    <div style="padding: 6px 10px; background: var(--white); border: 1px solid var(--gray-300); border-radius: 4px; margin-bottom: 4px; font-size: 13px; cursor: pointer;" onclick="EstimateManager.selectWorkType('${workType.id}')">
                        <div style="display: flex; justify-content: space-between;">
                            <span>${workType.name}</span>
                            <span style="color: var(--primary); font-weight: 600;">${UI.formatCurrency(workType.totalCost, this.currentProject?.currency)}</span>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading work types:', error);
        }
    },

    async selectWorkType(workTypeId) {
        // Выделяем выбранный элемент
        document.querySelectorAll('#stages-tree-container [onclick*="selectWorkType"]').forEach(el => {
            el.style.background = 'var(--white)';
            el.style.borderColor = 'var(--gray-300)';
        });
        event.target.closest('[onclick*="selectWorkType"]').style.background = 'var(--primary-light)';
        event.target.closest('[onclick*="selectWorkType"]').style.borderColor = 'var(--primary)';

        // Загружаем свойства в нижнюю панель
        try {
            const workType = await api.getWorkType(workTypeId);
            const resources = await api.getResources(workTypeId);
            
            const propertiesPanel = document.getElementById('element-properties');
            let html = `
                <div>
                    <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--gray-800);">${workType.name}</h4>
                    <div style="background: var(--gray-50); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 14px;">
                            <span style="color: var(--gray-600);">Единица:</span>
                            <strong>${workType.unit}</strong>
                            <span style="color: var(--gray-600);">Объем:</span>
                            <strong>${UI.formatNumber(workType.quantity)}</strong>
                            <span style="color: var(--gray-600);">Цена за ед.:</span>
                            <strong>${UI.formatCurrency(workType.unitCost, this.currentProject?.currency)}</strong>
                            <span style="color: var(--gray-600);">Стоимость:</span>
                            <strong style="color: var(--primary); font-size: 16px;">${UI.formatCurrency(workType.totalCost, this.currentProject?.currency)}</strong>
                        </div>
                    </div>
                    <h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--gray-700);">Ресурсы (${resources.length})</h5>
                    <div style="max-height: 300px; overflow-y: auto;">
            `;

            if (resources.length === 0) {
                html += `<p style="color: var(--gray-500); font-size: 13px; padding: 20px; text-align: center;">Нет ресурсов</p>`;
            } else {
                for (const resource of resources) {
                    const typeLabels = {
                        'material': 'Материал',
                        'labor': 'Труд',
                        'equipment': 'Оборудование'
                    };
                    html += `
                        <div style="padding: 10px; background: var(--white); border: 1px solid var(--gray-300); border-radius: 4px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                                <strong style="font-size: 13px;">${resource.name}</strong>
                                <span style="padding: 2px 8px; background: var(--primary-light); color: var(--primary); border-radius: 3px; font-size: 11px;">${typeLabels[resource.type] || resource.type}</span>
                            </div>
                            <div style="font-size: 12px; color: var(--gray-600); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                                <span>Кол-во: ${UI.formatNumber(resource.quantity)} ${resource.unit}</span>
                                <span style="text-align: right; color: var(--primary); font-weight: 600;">${UI.formatCurrency(resource.totalCost, this.currentProject?.currency)}</span>
                            </div>
                        </div>
                    `;
                }
            }

            html += `</div></div>`;
            propertiesPanel.innerHTML = html;

        } catch (error) {
            console.error('Error loading work type details:', error);
        }
    },

    async loadStages(sectionId) {
        try {
            const stages = await api.getStages(sectionId);
            const container = document.getElementById('stages-container');

            if (stages.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 16px;">
                            <path d="M12 2v20M2 12h20"/>
                        </svg>
                        <h3 style="color: var(--gray-600); margin-bottom: 8px;">Этапы не созданы</h3>
                        <p style="color: var(--gray-500); font-size: 14px;">Добавьте первый этап работ</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="data-table"><table><thead><tr>';
            html += '<th>Этап</th><th>Порядок</th><th>Описание</th><th>Стоимость</th><th>Действия</th>';
            html += '</tr></thead><tbody>';

            for (const stage of stages) {
                html += `
                    <tr>
                        <td><a href="#" onclick="EstimateManager.openStage('${stage.id}'); return false;" style="color: var(--primary); text-decoration: none; font-weight: 600;">${stage.name}</a></td>
                        <td>${stage.order}</td>
                        <td>${stage.description || '-'}</td>
                        <td style="font-weight: 600; color: var(--primary);">${UI.formatCurrency(stage.totalCost, this.currentProject?.currency)}</td>
                        <td>
                            <button onclick="EstimateManager.editStage('${stage.id}')" class="btn btn-secondary" style="padding: 4px 12px; height: auto; margin-right: 4px;">
                                Изменить
                            </button>
                            <button onclick="EstimateManager.deleteStage('${stage.id}')" class="btn btn-danger" style="padding: 4px 12px; height: auto;">
                                Удалить
                            </button>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading stages:', error);
        }
    },

    async openStage(stageId) {
        this.currentStageId = stageId;
        
        try {
            const stage = await api.getStage(stageId);
            const section = await api.getSection(this.currentSectionId);
            
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div style="font-size: 10px; color: var(--gray-600);">
                            <span style="color: var(--gray-500);">${this.currentProject.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.renderEstimateTree('${this.currentProjectId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к блокам">Блоки</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openBlock('${this.currentBlockId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к сметам">${block.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openEstimate('${this.currentEstimateId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к разделам">${estimate.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openSection('${this.currentSectionId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к этапам">${section.code} - ${section.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span style="font-weight: 700; color: var(--gray-900);">${stage.name}</span>
                        </div>
                        <h2 style="margin: 0;">Виды работ</h2>
                        <button onclick="EstimateManager.createWorkType('${stageId}')" class="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                <path d="M12 5v14"/>
                                <path d="M5 12h14"/>
                            </svg>
                            Добавить вид работ
                        </button>
                    </div>
                    <div id="work-types-container">
                        <div style="text-align: center; padding: 40px; color: var(--gray-600);">
                            Загрузка видов работ...
                        </div>
                    </div>
                </div>
            `;

            await this.loadWorkTypes(stageId);
            
        } catch (error) {
            UI.showNotification('Ошибка загрузки этапа: ' + error.message, 'error');
        }
    },

    async loadWorkTypes(stageId) {
        try {
            const workTypes = await api.getWorkTypes(stageId);
            const container = document.getElementById('work-types-container');

            if (workTypes.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 16px;">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                        </svg>
                        <h3 style="color: var(--gray-600); margin-bottom: 8px;">Виды работ не созданы</h3>
                        <p style="color: var(--gray-500); font-size: 14px;">Добавьте первый вид работ</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="data-table"><table><thead><tr>';
            html += '<th>Название работы</th><th>Единица измерения</th><th>Объем</th><th>Цена за ед.</th><th>Стоимость</th><th>Действия</th>';
            html += '</tr></thead><tbody>';

            for (const workType of workTypes) {
                html += `
                    <tr>
                        <td><a href="#" onclick="EstimateManager.openWorkType('${workType.id}'); return false;" style="color: var(--primary); text-decoration: none; font-weight: 600;">${workType.name}</a></td>
                        <td>${workType.unit}</td>
                        <td>${UI.formatNumber(workType.quantity)}</td>
                        <td>${UI.formatCurrency(workType.unitCost, this.currentProject?.currency)}</td>
                        <td style="font-weight: 600; color: var(--primary);">${UI.formatCurrency(workType.totalCost, this.currentProject?.currency)}</td>
                        <td>
                            <button onclick="EstimateManager.editWorkType('${workType.id}')" class="btn btn-secondary" style="padding: 4px 12px; height: auto; margin-right: 4px;">
                                Изменить
                            </button>
                            <button onclick="EstimateManager.deleteWorkType('${workType.id}')" class="btn btn-danger" style="padding: 4px 12px; height: auto;">
                                Удалить
                            </button>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading work types:', error);
        }
    },

    async openWorkType(workTypeId) {
        this.currentWorkTypeId = workTypeId; // Сохраняем для последующего использования
        
        try {
            const workType = await api.getWorkType(workTypeId);
            const stage = await api.getStage(this.currentStageId);
            
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <div style="font-size: 10px; color: var(--gray-600);">
                            <span style="color: var(--gray-500);">${this.currentProject.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.renderEstimateTree('${this.currentProjectId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к блокам">Блоки</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openBlock('${this.currentBlockId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к сметам">${block.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openEstimate('${this.currentEstimateId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к разделам">${estimate.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openSection('${this.currentSectionId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к этапам">${section.code} - ${section.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span onclick="EstimateManager.openStage('${this.currentStageId}')" style="cursor: pointer; color: var(--primary-color);" title="Вернуться к видам работ">${stage.name}</span>
                            <span style="margin: 0 8px;">/</span>
                            <span style="font-weight: 700; color: var(--gray-900);">${workType.name}</span>
                        </div>
                        <h2 style="margin: 0;">Ресурсы</h2>
                        <button onclick="EstimateManager.createResource('${workTypeId}')" class="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                <path d="M12 5v14"/>
                                <path d="M5 12h14"/>
                            </svg>
                            Добавить ресурс
                        </button>
                    </div>
                    <div id="resources-container">
                        <div style="text-align: center; padding: 40px; color: var(--gray-600);">
                            Загрузка ресурсов...
                        </div>
                    </div>
                </div>
            `;

            await this.loadResources(workTypeId);
            
        } catch (error) {
            UI.showNotification('Ошибка загрузки вида работ: ' + error.message, 'error');
        }
    },

    async loadResources(workTypeId) {
        try {
            const resources = await api.getResources(workTypeId);
            const container = document.getElementById('resources-container');

            if (resources.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 16px;">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <h3 style="color: var(--gray-600); margin-bottom: 8px;">Ресурсы не добавлены</h3>
                        <p style="color: var(--gray-500); font-size: 14px;">Добавьте материалы, оборудование или трудозатраты</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="data-table"><table><thead><tr>';
            html += '<th>Тип</th><th>Название</th><th>Единица</th><th>Количество</th><th>Цена за ед.</th><th>Стоимость</th><th>IFC элемент</th><th>Действия</th>';
            html += '</tr></thead><tbody>';

            for (const resource of resources) {
                const typeLabels = {
                    'material': 'Материал',
                    'labor': 'Труд',
                    'equipment': 'Оборудование'
                };
                
                html += `
                    <tr>
                        <td><span style="padding: 4px 8px; background: var(--primary-light); color: var(--primary); border-radius: 4px; font-size: 12px;">${typeLabels[resource.type] || resource.type}</span></td>
                        <td>${resource.name}</td>
                        <td>${resource.unit}</td>
                        <td>${UI.formatNumber(resource.quantity)}</td>
                        <td>${UI.formatCurrency(resource.unitCost, this.currentProject?.currency)}</td>
                        <td style="font-weight: 600; color: var(--primary);">${UI.formatCurrency(resource.totalCost, this.currentProject?.currency)}</td>
                        <td>${resource.ifcElementId || '-'}</td>
                        <td>
                            <button onclick="EstimateManager.editResource('${resource.id}')" class="btn btn-secondary" style="padding: 4px 12px; height: auto; margin-right: 4px;">
                                Изменить
                            </button>
                            <button onclick="EstimateManager.deleteResource('${resource.id}')" class="btn btn-danger" style="padding: 4px 12px; height: auto;">
                                Удалить
                            </button>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading resources:', error);
        }
    },

    // ========================================
    // CRUD операции для этапов
    // ========================================

    async createStage(sectionId) {
        const content = `
            <div class="form-group">
                <label>Название этапа *</label>
                <input type="text" id="stage-name" placeholder="Например: Подготовительный этап" required>
            </div>
            <div class="form-group">
                <label>Порядок выполнения *</label>
                <input type="number" id="stage-order" value="1" min="1" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="stage-description" placeholder="Описание этапа"></textarea>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-stage-btn">Создать</button>
        `;

        UI.showModal('Новый этап', content, buttons);

        setTimeout(() => {
            document.getElementById('save-stage-btn').addEventListener('click', async () => {
                const data = {
                    sectionId: sectionId,
                    name: document.getElementById('stage-name').value.trim(),
                    order: parseInt(document.getElementById('stage-order').value),
                    description: document.getElementById('stage-description').value.trim(),
                };

                if (!data.name) {
                    alert('Введите название этапа');
                    return;
                }

                try {
                    await api.createStage(data);
                    UI.closeModal();
                    UI.showNotification('Этап создан', 'success');
                    this.loadStages(sectionId);
                } catch (error) {
                    UI.showNotification('Ошибка: ' + error.message, 'error');
                }
            });
        }, 100);
    },

    async deleteStage(stageId) {
        UI.confirmDelete('Удалить этот этап и все виды работ?', async () => {
            try {
                await api.deleteStage(stageId);
                UI.showNotification('Этап удален', 'success');
                this.loadStages(this.currentSectionId);
            } catch (error) {
                UI.showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    },

    async editStage(stageId) {
        try {
            const stage = await api.getStage(stageId);
            
            const content = `
                <div class="form-group">
                    <label>Название этапа *</label>
                    <input type="text" id="stage-name" value="${stage.name}" required>
                </div>
                <div class="form-group">
                    <label>Порядок выполнения *</label>
                    <input type="number" id="stage-order" value="${stage.order}" min="1" required>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="stage-description">${stage.description || ''}</textarea>
                </div>
            `;

            const buttons = `
                <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
                <button class="btn btn-primary" id="save-stage-btn">Сохранить</button>
            `;

            UI.showModal('Редактировать этап', content, buttons);

            setTimeout(() => {
                document.getElementById('save-stage-btn').addEventListener('click', async () => {
                    const data = {
                        name: document.getElementById('stage-name').value.trim(),
                        order: parseInt(document.getElementById('stage-order').value),
                        description: document.getElementById('stage-description').value.trim(),
                    };

                    if (!data.name) {
                        alert('Введите название этапа');
                        return;
                    }

                    try {
                        await api.updateStage(stageId, data);
                        UI.closeModal();
                        UI.showNotification('Этап обновлен', 'success');
                        this.loadStages(this.currentSectionId);
                    } catch (error) {
                        UI.showNotification('Ошибка: ' + error.message, 'error');
                    }
                });
            }, 100);
        } catch (error) {
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    // ========================================
    // CRUD операции для видов работ
    // ========================================

    async createWorkType(stageId) {
        const content = `
            <div class="form-group">
                <label>Название работы *</label>
                <input type="text" id="work-name" placeholder="Например: Кирпичная кладка" required>
            </div>
            <div class="form-group">
                <label>Единица измерения *</label>
                <input type="text" id="work-unit" placeholder="м³, м², шт" required>
            </div>
            <div class="form-group">
                <label>Объем *</label>
                <input type="number" id="work-quantity" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label>Цена за единицу (${this.getCurrencySymbol()}) *</label>
                <input type="number" id="work-unit-cost" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="work-description" placeholder="Описание работы"></textarea>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-work-btn">Создать</button>
        `;

        UI.showModal('Новый вид работ', content, buttons);

        setTimeout(() => {
            document.getElementById('save-work-btn').addEventListener('click', async () => {
                const data = {
                    stageId: stageId,
                    name: document.getElementById('work-name').value.trim(),
                    unit: document.getElementById('work-unit').value.trim(),
                    quantity: parseFloat(document.getElementById('work-quantity').value),
                    unitCost: parseFloat(document.getElementById('work-unit-cost').value),
                    description: document.getElementById('work-description').value.trim(),
                };

                if (!data.name || !data.unit) {
                    alert('Заполните обязательные поля');
                    return;
                }

                try {
                    await api.createWorkType(data);
                    UI.closeModal();
                    UI.showNotification('Вид работ создан', 'success');
                    this.loadWorkTypes(stageId);
                } catch (error) {
                    UI.showNotification('Ошибка: ' + error.message, 'error');
                }
            });
        }, 100);
    },

    async deleteWorkType(workTypeId) {
        UI.confirmDelete('Удалить этот вид работ и все ресурсы?', async () => {
            try {
                await api.deleteWorkType(workTypeId);
                UI.showNotification('Вид работ удален', 'success');
                this.loadWorkTypes(this.currentStageId);
            } catch (error) {
                UI.showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    },

    async editWorkType(workTypeId) {
        try {
            const workType = await api.getWorkType(workTypeId);
            
            const content = `
                <div class="form-group">
                    <label>Название работы *</label>
                    <input type="text" id="work-name" value="${workType.name}" required>
                </div>
                <div class="form-group">
                    <label>Единица измерения *</label>
                    <input type="text" id="work-unit" value="${workType.unit}" required>
                </div>
                <div class="form-group">
                    <label>Объем *</label>
                    <input type="number" id="work-quantity" value="${workType.quantity}" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label>Цена за единицу (${this.getCurrencySymbol()}) *</label>
                    <input type="number" id="work-unit-cost" value="${workType.unitCost}" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="work-description">${workType.description || ''}</textarea>
                </div>
            `;

            const buttons = `
                <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
                <button class="btn btn-primary" id="save-work-btn">Сохранить</button>
            `;

            UI.showModal('Редактировать вид работ', content, buttons);

            setTimeout(() => {
                document.getElementById('save-work-btn').addEventListener('click', async () => {
                    const data = {
                        name: document.getElementById('work-name').value.trim(),
                        unit: document.getElementById('work-unit').value.trim(),
                        quantity: parseFloat(document.getElementById('work-quantity').value),
                        unitCost: parseFloat(document.getElementById('work-unit-cost').value),
                        description: document.getElementById('work-description').value.trim(),
                    };

                    if (!data.name || !data.unit) {
                        alert('Заполните обязательные поля');
                        return;
                    }

                    try {
                        await api.updateWorkType(workTypeId, data);
                        UI.closeModal();
                        UI.showNotification('Вид работ обновлен', 'success');
                        this.loadWorkTypes(this.currentStageId);
                    } catch (error) {
                        UI.showNotification('Ошибка: ' + error.message, 'error');
                    }
                });
            }, 100);
        } catch (error) {
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    // ========================================
    // CRUD операции для ресурсов
    // ========================================

    async createResource(workTypeId) {
        const content = `
            <div class="form-group">
                <label>Тип ресурса *</label>
                <select id="resource-type" required>
                    <option value="material">Материал</option>
                    <option value="labor">Труд</option>
                    <option value="equipment">Оборудование</option>
                </select>
            </div>
            <div class="form-group">
                <label>Название *</label>
                <input type="text" id="resource-name" placeholder="Например: Кирпич красный" required>
            </div>
            <div class="form-group">
                <label>Единица измерения *</label>
                <input type="text" id="resource-unit" placeholder="шт, м³, кг" required>
            </div>
            <div class="form-group">
                <label>Количество *</label>
                <input type="number" id="resource-quantity" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label>Цена за единицу (${this.getCurrencySymbol()}) *</label>
                <input type="number" id="resource-unit-cost" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label>ID элемента IFC (опционально)</label>
                <input type="text" id="resource-ifc" placeholder="Например: 0ABC123XYZ">
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-resource-btn">Создать</button>
        `;

        UI.showModal('Новый ресурс', content, buttons);

        setTimeout(() => {
            document.getElementById('save-resource-btn').addEventListener('click', async () => {
                const data = {
                    workTypeId: workTypeId,
                    resourceType: document.getElementById('resource-type').value,
                    name: document.getElementById('resource-name').value.trim(),
                    unit: document.getElementById('resource-unit').value.trim(),
                    quantity: parseFloat(document.getElementById('resource-quantity').value),
                    unitPrice: parseFloat(document.getElementById('resource-unit-cost').value),
                    ifcElementId: document.getElementById('resource-ifc').value.trim() || null,
                };

                if (!data.name || !data.unit) {
                    alert('Заполните обязательные поля');
                    return;
                }

                try {
                    await api.createResource(data);
                    // Каскадный пересчет после создания ресурса
                    await this.recalculateHierarchy(workTypeId);
                    UI.closeModal();
                    UI.showNotification('Ресурс создан', 'success');
                    this.loadResources(workTypeId);
                } catch (error) {
                    UI.showNotification('Ошибка: ' + error.message, 'error');
                }
            });
        }, 100);
    },

    async deleteResource(resourceId) {
        UI.confirmDelete('Удалить этот ресурс?', async () => {
            try {
                // Получаем ресурс для получения workTypeId перед удалением
                const resource = await api.getWorkType(resourceId);
                const workTypeId = resource.stageId;
                
                await api.deleteResource(resourceId);
                
                // Каскадный пересчет после удаления ресурса
                if (workTypeId) {
                    await this.recalculateHierarchy(workTypeId);
                }
                
                UI.showNotification('Ресурс удален', 'success');
                // Перезагружаем ресурсы для текущего вида работ
                if (this.currentWorkTypeId) {
                    this.loadResources(this.currentWorkTypeId);
                }
            } catch (error) {
                UI.showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    },

    async editResource(resourceId) {
        try {
            const resource = await api.getResource(resourceId);
            
            const content = `
                <div class="form-group">
                    <label>Тип ресурса *</label>
                    <select id="resource-type" required>
                        <option value="material" ${resource.type === 'material' ? 'selected' : ''}>Материал</option>
                        <option value="labor" ${resource.type === 'labor' ? 'selected' : ''}>Труд</option>
                        <option value="equipment" ${resource.type === 'equipment' ? 'selected' : ''}>Оборудование</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Название *</label>
                    <input type="text" id="resource-name" value="${resource.name}" required>
                </div>
                <div class="form-group">
                    <label>Единица измерения *</label>
                    <input type="text" id="resource-unit" value="${resource.unit}" required>
                </div>
                <div class="form-group">
                    <label>Количество *</label>
                    <input type="number" id="resource-quantity" value="${resource.quantity}" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label>Цена за единицу (${this.getCurrencySymbol()}) *</label>
                    <input type="number" id="resource-unit-cost" value="${resource.unitCost}" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label>ID элемента IFC (опционально)</label>
                    <input type="text" id="resource-ifc" value="${resource.ifcElementId || ''}" placeholder="Например: 0ABC123XYZ">
                </div>
            `;

            const buttons = `
                <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
                <button class="btn btn-primary" id="save-resource-btn">Сохранить</button>
            `;

            UI.showModal('Редактировать ресурс', content, buttons);

            setTimeout(() => {
                document.getElementById('save-resource-btn').addEventListener('click', async () => {
                const data = {
                    resourceType: document.getElementById('resource-type').value,
                    name: document.getElementById('resource-name').value.trim(),
                    unit: document.getElementById('resource-unit').value.trim(),
                    quantity: parseFloat(document.getElementById('resource-quantity').value),
                    unitPrice: parseFloat(document.getElementById('resource-unit-cost').value),
                    ifcElementId: document.getElementById('resource-ifc').value.trim() || null,
                };                    if (!data.name || !data.unit) {
                        alert('Заполните обязательные поля');
                        return;
                    }

                    try {
                        await api.updateResource(resourceId, data);
                        // Каскадный пересчет после обновления ресурса
                        await this.recalculateHierarchy(resourceId);
                        UI.closeModal();
                        UI.showNotification('Ресурс обновлен', 'success');
                        this.loadResources(this.currentWorkTypeId);
                    } catch (error) {
                        UI.showNotification('Ошибка: ' + error.message, 'error');
                    }
                });
            }, 100);
        } catch (error) {
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    // ========================================
    // Загрузка IFC файлов
    // ========================================

    async uploadIFC(sectionId) {
        const content = `
            <div class="form-group">
                <label>IFC файл *</label>
                <input type="file" id="ifc-file" accept=".ifc" required>
                <p style="color: var(--gray-600); font-size: 13px; margin-top: 8px;">
                    Поддерживаются файлы формата IFC (Industry Foundation Classes)
                </p>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="upload-ifc-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Загрузить
            </button>
        `;

        UI.showModal('Загрузка IFC модели', content, buttons);

        setTimeout(() => {
            document.getElementById('upload-ifc-btn').addEventListener('click', async () => {
                const fileInput = document.getElementById('ifc-file');
                const file = fileInput.files[0];

                if (!file) {
                    alert('Выберите IFC файл');
                    return;
                }

                try {
                    UI.showNotification('Загрузка файла...', 'info');
                    await api.uploadIFC(sectionId, file);
                    UI.closeModal();
                    UI.showNotification('IFC файл успешно загружен', 'success');
                    this.loadSections(this.currentEstimateId);
                } catch (error) {
                    UI.showNotification('Ошибка загрузки: ' + error.message, 'error');
                }
            });
        }, 100);
    },

    async replaceIFC(sectionId) {
        const content = `
            <div style="margin-bottom: 20px; padding: 12px; background: var(--primary-lighter); border-left: 4px solid var(--primary); border-radius: 4px;">
                <p style="color: var(--gray-700); font-size: 14px;">
                    <strong>Внимание!</strong> Текущий IFC файл будет заменён новым.
                </p>
            </div>
            <div class="form-group">
                <label>Новый IFC файл *</label>
                <input type="file" id="ifc-file" accept=".ifc" required>
                <p style="color: var(--gray-600); font-size: 13px; margin-top: 8px;">
                    Поддерживаются файлы формата IFC (Industry Foundation Classes)
                </p>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="replace-ifc-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                    <polyline points="1 4 1 10 7 10"/>
                    <polyline points="23 20 23 14 17 14"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Заменить
            </button>
        `;

        UI.showModal('Замена IFC модели', content, buttons);

        setTimeout(() => {
            document.getElementById('replace-ifc-btn').addEventListener('click', async () => {
                const fileInput = document.getElementById('ifc-file');
                const file = fileInput.files[0];

                if (!file) {
                    alert('Выберите новый IFC файл');
                    return;
                }

                try {
                    UI.showNotification('Замена файла...', 'info');
                    await api.uploadIFC(sectionId, file);
                    UI.closeModal();
                    UI.showNotification('IFC файл успешно заменён', 'success');
                    this.loadSections(this.currentEstimateId);
                } catch (error) {
                    UI.showNotification('Ошибка замены: ' + error.message, 'error');
                }
            });
        }, 100);
    },

    async viewIFC(sectionId) {
        try {
            const section = await api.getSection(sectionId);
            
            if (!section.ifcFileUrl) {
                UI.showNotification('IFC файл не загружен', 'error');
                return;
            }

            const content = `
                <div style="margin-bottom: 16px;">
                    <p style="color: var(--gray-700); font-size: 14px; margin-bottom: 8px;">
                        <strong>Файл:</strong> ${section.ifcFileUrl.split('/').pop()}
                    </p>
                    <p style="color: var(--gray-600); font-size: 13px;">
                        <strong>Раздел:</strong> ${section.code} - ${section.name}
                    </p>
                </div>
                <div style="padding: 60px 20px; background: var(--gray-100); border-radius: 8px; text-align: center;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color: var(--gray-400); margin-bottom: 16px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    <h3 style="color: var(--gray-600); margin-bottom: 8px;">3D просмотр IFC модели</h3>
                    <p style="color: var(--gray-500); font-size: 14px; margin-bottom: 16px;">
                        Функция 3D просмотра будет доступна в следующей версии
                    </p>
                    <a href="${section.ifcFileUrl}" download class="btn btn-primary" style="display: inline-block; text-decoration: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Скачать IFC файл
                    </a>
                </div>
            `;

            const buttons = `
                <button class="btn btn-secondary" onclick="UI.closeModal()">Закрыть</button>
            `;

            UI.showModal('Просмотр IFC модели', content, buttons);

        } catch (error) {
            UI.showNotification('Ошибка загрузки данных: ' + error.message, 'error');
        }
    },

    // ========================================
    // Inline редактирование (как в MyBuilding)
    // ========================================

    makeEditable(element, currentValue, onSave) {
        element.onclick = async function(e) {
            e.stopPropagation();
            
            // Если уже редактируется - выходим
            if (element.querySelector('input')) return;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue;
            input.className = 'inline-edit-input';
            input.style.cssText = 'width: 100%; padding: 4px 8px; border: 2px solid var(--primary); border-radius: 4px; font: inherit;';

            const save = async () => {
                const newValue = input.value.trim();
                if (newValue && newValue !== currentValue) {
                    await onSave(newValue);
                } else {
                    element.textContent = currentValue;
                }
            };

            input.onblur = save;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    element.textContent = currentValue;
                }
            };

            element.textContent = '';
            element.appendChild(input);
            input.focus();
            input.select();
        };
    },

    makeEditableSelect(element, currentValue, options, onSave) {
        element.onclick = async function(e) {
            e.stopPropagation();
            
            if (element.querySelector('select')) return;
            
            const select = document.createElement('select');
            select.className = 'inline-edit-select';
            select.style.cssText = 'width: 100%; padding: 4px 8px; border: 2px solid var(--primary); border-radius: 4px; font: inherit;';

            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (opt === currentValue) option.selected = true;
                select.appendChild(option);
            });

            select.onchange = async () => {
                const newValue = select.value;
                if (newValue && newValue !== currentValue) {
                    await onSave(newValue);
                } else {
                    element.textContent = currentValue;
                }
            };

            select.onblur = () => {
                element.textContent = select.value || currentValue;
            };

            element.textContent = '';
            element.appendChild(select);
            select.focus();
        };
    },

    // ========================================
    // Функции создания (адаптированные под новую структуру)
    // Section = Этап, Stage = Вид работ, Resource = Ресурс
    // ========================================

    // Создание этапа для сметы (Section)
    async createStageForEstimate(estimateId) {
        try {
            const data = {
                estimateId: estimateId,
                code: 'Этап ' + (new Date().getTime() % 1000),
                name: 'Новый этап'
            };
            await api.createSection(data);
            UI.showNotification('Этап создан', 'success');
            await this.loadEstimateStructure(estimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Создание вида работ для этапа (Stage внутри Section)
    async createWorkTypeForStage(sectionId) {
        try {
            const data = {
                sectionId: sectionId,
                name: 'Новый вид работ'
            };
            const newStage = await api.createStage(data);
            UI.showNotification('Вид работ создан', 'success');
            
            // Добавляем новый элемент в DOM без перезагрузки всего дерева
            const treeContainer = document.getElementById(`stage-tree-${sectionId}`);
            if (treeContainer) {
                // Раскрываем группу если она была закрыта
                if (treeContainer.style.display === 'none') {
                    treeContainer.style.display = 'block';
                    const collapseIcon = treeContainer.previousElementSibling?.querySelector('.collapse-icon');
                    if (collapseIcon) collapseIcon.textContent = '▼';
                }
                
                // Находим или создаем контейнер для списка видов работ
                let workTypesList = treeContainer.querySelector('.work-types-list');
                if (!workTypesList) {
                    // Убираем сообщение "Виды работ не созданы"
                    treeContainer.innerHTML = '';
                    workTypesList = document.createElement('div');
                    workTypesList.className = 'work-types-list';
                    workTypesList.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
                    treeContainer.appendChild(workTypesList);
                }
                
                // Создаем HTML для нового вида работ
                const newHtml = await this.renderWorkTypeRow(newStage, sectionId);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newHtml;
                workTypesList.appendChild(tempDiv.firstElementChild);
            }
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Создание ресурса для вида работ (создаём WorkType внутри Stage, который содержит ресурсы)
    async createResourceForStage(stageId) {
        try {
            // Создаём WorkType который будет служить как ресурс
            const data = {
                stageId: stageId,
                name: 'Новый ресурс',
                description: 'material' // используем description для типа
            };
            const newResource = await api.createWorkType(data);
            
            // Каскадный пересчет после создания ресурса (передаем ID нового ресурса)
            await this.recalculateHierarchy(newResource.id);
            
            UI.showNotification('Ресурс создан', 'success');
            
            // Добавляем новый ресурс в DOM без перезагрузки всего дерева
            const resourcesContainer = document.getElementById(`worktype-resources-${stageId}`);
            if (resourcesContainer) {
                // Раскрываем группу если она была закрыта
                if (resourcesContainer.style.display === 'none') {
                    resourcesContainer.style.display = 'block';
                    const collapseIcon = resourcesContainer.previousElementSibling?.querySelector('.collapse-icon-wt');
                    if (collapseIcon) collapseIcon.textContent = '▼';
                }
                
                // Убираем сообщение "Ресурсы не добавлены" если оно есть
                const emptyMsg = resourcesContainer.querySelector('[style*="font-style: italic"]');
                if (emptyMsg) {
                    emptyMsg.remove();
                }
                
                // Создаем HTML для нового ресурса
                const resource = {
                    id: newResource.id,
                    name: newResource.name,
                    description: newResource.description || 'material',
                    quantity: newResource.quantity || 0,
                    unitCost: newResource.unitCost || 0,
                    totalCost: newResource.totalCost || 0,
                    unit: newResource.unit || 'шт',
                    type: newResource.description || 'material'
                };
                
                const newHtml = this.renderResourceRow(resource);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newHtml;
                resourcesContainer.appendChild(tempDiv.firstElementChild);
            }
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Удаление этапа (Section)
    async deleteStageFromEstimate(sectionId) {
        if (!confirm('Удалить этап и все его виды работ?')) return;
        
        try {
            await api.deleteSection(sectionId);
            UI.showNotification('Этап удален', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Удаление вида работ (Stage)
    async deleteWorkTypeFromStage(stageId) {
        if (!confirm('Удалить вид работ и все его ресурсы?')) return;
        
        try {
            await api.deleteStage(stageId);
            UI.showNotification('Вид работ удален', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Удаление ресурса (WorkType)
    async deleteResourceFromWorkType(workTypeId) {
        if (!confirm('Удалить ресурс?')) return;
        
        try {
            await api.deleteWorkType(workTypeId);
            UI.showNotification('Ресурс удален', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // ========================================
    // Старые функции (сохраняем для совместимости)
    // ========================================

    // Создание этапа (как в MyBuilding - без модального окна)
    async createStage(sectionId) {
        try {
            const data = {
                sectionId: sectionId,
                name: 'Новый этап работ',
                description: ''
            };
            await api.createStage(data);
            UI.showNotification('Этап создан', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Создание вида работ (без модального окна)
    async createWorkType(stageId) {
        try {
            const data = {
                stageId: stageId,
                name: 'Новый вид работ',
                unit: 'шт',
                quantity: 0,
                unitCost: 0
            };
            await api.createWorkType(data);
            UI.showNotification('Вид работ создан', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Создание ресурса (без модального окна)
    async createResource(workTypeId) {
        try {
            const data = {
                workTypeId: workTypeId,
                resourceType: 'material',
                name: 'Новый ресурс',
                unit: 'шт',
                quantity: 0,
                unitPrice: 0
            };
            const newResource = await api.createResource(data);
            // Каскадный пересчет после создания ресурса (передаем ID нового ресурса)
            if (newResource && newResource.id) {
                await this.recalculateHierarchy(newResource.id);
            }
            UI.showNotification('Ресурс создан', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Удаление этапа с подтверждением
    async deleteStage(stageId) {
        if (!confirm('Удалить этап и все его виды работ?')) return;
        
        try {
            await api.deleteStage(stageId);
            UI.showNotification('Этап удален', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Удаление вида работ с подтверждением
    async deleteWorkType(workTypeId) {
        if (!confirm('Удалить вид работ и все его ресурсы?')) return;
        
        try {
            await api.deleteWorkType(workTypeId);
            UI.showNotification('Вид работ удален', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // Удаление ресурса с подтверждением
    async deleteResource(resourceId) {
        if (!confirm('Удалить ресурс?')) return;
        
        try {
            await api.deleteResource(resourceId);
            UI.showNotification('Ресурс удален', 'success');
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    // ========================================
    // Работа с IFC моделями и xeokit viewer
    // ========================================
    
    viewerInitialized: false,
    viewerInitPromise: null,
    viewerDisplayMode: 'textured',
    activePropertiesTab: 'all',

    // Инициализация xeokit viewer
    async initializeViewer() {
        if (this.viewerInitialized) return true;
        if (this.viewerInitPromise) return this.viewerInitPromise;

        this.viewerInitPromise = (async () => {
            const success = await IFCViewerManager.init('ifc-canvas', (elementId, selectedElements, properties) => {
                this.handleIfcElementSelected(elementId, selectedElements, properties);
            });

            if (success) {
                this.viewerInitialized = true;
                this.updateIsolationButtons();
                console.log('✓ xeokit viewer инициализирован');
            } else {
                console.error('❌ Не удалось инициализировать xeokit viewer');
            }

            return success;
        })();

        try {
            return await this.viewerInitPromise;
        } finally {
            this.viewerInitPromise = null;
        }
    },

    // Обработка выбора элемента в IFC модели
    handleIfcElementSelected(elementId, selectedElements, properties) {
        console.log('Выбран элемент IFC:', elementId);
        console.log('Всего выбрано:', selectedElements.length);
        console.log('Свойства:', properties);
        
        // Сохраняем выбранные элементы
        this.selectedIfcElements = selectedElements;
        
        // Обновляем панель свойств
        this.updatePropertiesPanel(properties);
        
        // Обновляем кнопки связать/отвязать
        this.updateLinkButtons();
        
        // Обновляем кнопки изоляции
        this.updateIsolationButtons();
    },

    // Обновление панели свойств элемента
    updatePropertiesPanel(properties) {
        const panel = document.getElementById('element-properties');
        if (!panel) {
            return;
        }

        if (!properties) {
            panel.innerHTML = this.getEmptyPropertiesMarkup();
            return;
        }

        const attributes = properties.attributes || {};
        const attrEntries = Object.entries(attributes);
        const dims = this.computeElementDimensions(properties.aabb);

        const elementName = properties.name || this.findAttributeValue(attributes, ['name', 'ifcname', 'objectname']) || 'Элемент без названия';
        const elementId = properties.id || '—';
        const materialValue = this.findAttributeValue(attributes, ['material', 'materialname', 'ifcmaterial', 'материал', 'finish', 'matname']);
        const materialDisplay = materialValue ? this.formatAttributeValue(materialValue) : '—';
        const floorValue = this.findAttributeValue(attributes, ['level', 'storey', 'floor', 'этаж', 'ifcbuildingstorey', 'buildingstorey']);
        const manufacturerValue = this.findAttributeValue(attributes, ['manufacturer', 'brand', 'producer', 'vendor', 'supplier', 'производитель']);
        const guidValue = properties.ifcGuid || this.findAttributeValue(attributes, ['guid', 'ifcguid']);

        const rawPrice = this.findAttributeValue(attributes, ['price', 'cost', 'unitcost', 'totalcost', 'стоимость', 'цена']);
        let priceDisplay = '—';
        if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
            const parsedPrice = Number(String(rawPrice).replace(/[^0-9.,-]/g, '').replace(',', '.'));
            if (!Number.isNaN(parsedPrice) && parsedPrice !== 0) {
                priceDisplay = UI.formatCurrency(parsedPrice, this.currentProject?.currency) || `${parsedPrice}`;
            } else {
                priceDisplay = this.formatAttributeValue(rawPrice);
            }
        }

        const dimensionBlock = dims ? {
            volume: this.formatMeasure(dims.volume, 'м³'),
            area: this.formatMeasure(dims.area, 'м²'),
            depth: this.formatMeasure(dims.depth, 'м'),
            side: this.formatMeasure(dims.side, 'м'),
            length: this.formatMeasure(dims.length, 'м'),
            height: this.formatMeasure(dims.height, 'м'),
        } : {
            volume: '—',
            area: '—',
            depth: '—',
            side: '—',
            length: '—',
            height: '—',
        };

        const sortedAttributes = attrEntries.sort(([keyA], [keyB]) => keyA.localeCompare(keyB, 'ru', { sensitivity: 'base' }));
        const attributeRows = sortedAttributes.length ? sortedAttributes.map(([key, value]) => {
            const safeKey = this.escapeHtml(key);
            const formattedValue = this.formatAttributeValue(value);
            const safeValue = this.escapeHtml(formattedValue);
            return `
                <tr>
                    <td style="padding: 6px 8px; border-bottom: 1px solid var(--gray-200); font-size: 12px; color: var(--gray-700); width: 35%; display: flex; align-items: center; gap: 6px; justify-content: space-between;">
                        <span>${safeKey}</span>
                        ${this.getCopyButtonHtml(key, `Скопировать название параметра ${safeKey}`)}
                    </td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid var(--gray-200); font-size: 12px; color: var(--gray-900); display: flex; align-items: center; gap: 6px; justify-content: space-between;">
                        <span>${safeValue}</span>
                        ${this.getCopyButtonHtml(formattedValue, `Скопировать значение ${safeKey}`)}
                    </td>
                </tr>
            `;
        }).join('') : `
            <tr>
                <td colspan="2" style="padding: 16px; text-align: center; color: var(--gray-500); font-size: 12px;">Нет дополнительных атрибутов</td>
            </tr>
        `;

        const safe = (value) => this.escapeHtml(value === undefined || value === null || value === '' ? '—' : value);

        panel.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="padding-bottom: 8px; border-bottom: 1px solid var(--gray-200);">
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; color: var(--gray-900);">${safe(elementName)}</h3>
                    <div style="font-size: 13px; color: var(--gray-600);">Тип IFC: ${safe(properties.ifcType || 'Unknown')}</div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                    <div class="property-card" style="border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 6px;">ID элемента</div>
                        <div style="font-family: monospace; font-size: 13px; color: var(--gray-900);">${safe(elementId)}</div>
                    </div>
                    <div class="property-card" style="border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 6px;">Название материала</div>
                        <div style="font-size: 13px; color: var(--gray-900);">${safe(materialDisplay)}</div>
                    </div>
                    <div class="property-card" style="border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 6px;">Этаж (привязка)</div>
                        <div style="font-size: 13px; color: var(--gray-900);">${safe(this.formatAttributeValue(floorValue))}</div>
                    </div>
                    <div class="property-card" style="border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 6px;">Цена</div>
                        <div style="font-size: 13px; color: var(--gray-900);">${safe(priceDisplay)}</div>
                    </div>
                    <div class="property-card" style="border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 6px;">Производитель</div>
                        <div style="font-size: 13px; color: var(--gray-900);">${safe(this.formatAttributeValue(manufacturerValue))}</div>
                    </div>
                    <div class="property-card" style="border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 6px;">GUID</div>
                        <div style="font-family: monospace; font-size: 12px; color: var(--gray-900);">${safe(guidValue || '—')}</div>
                    </div>
                </div>

                <div style="margin-top: 4px;">
                    <div style="font-weight: 600; color: var(--gray-800); margin-bottom: 8px;">Габаритные данные</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">
                        ${[
                            { label: 'Объём', value: dimensionBlock.volume },
                            { label: 'Площадь', value: dimensionBlock.area },
                            { label: 'Глубина', value: dimensionBlock.depth },
                            { label: 'Сторона', value: dimensionBlock.side },
                            { label: 'Длина', value: dimensionBlock.length },
                            { label: 'Высота', value: dimensionBlock.height },
                        ].map(({ label, value }) => `
                            <div style="border: 1px dashed var(--gray-200); border-radius: 6px; padding: 8px 10px;">
                                <div style="font-size: 11px; color: var(--gray-500); text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                                    <span>${label}</span>
                                    ${this.getCopyButtonHtml(value, `Скопировать ${label}`)}
                                </div>
                                <div style="font-size: 13px; color: var(--gray-900);">${safe(value)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div>
                    <div style="font-weight: 600; color: var(--gray-800); margin-bottom: 8px;">Все атрибуты элемента</div>
                    <div style="border: 1px solid var(--gray-200); border-radius: 8px; max-height: 260px; overflow: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                ${attributeRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="EstimateManager.zoomToSelected()" class="btn btn-sm btn-secondary" style="width: 100%;">
                        Приблизить выбранное
                    </button>
                    <button onclick="EstimateManager.clearIfcSelection()" class="btn btn-sm btn-secondary" style="width: 100%; background: var(--gray-100); color: var(--gray-700); border-color: var(--gray-200);">
                        Снять выделение
                    </button>
                </div>
            </div>
        `;

        this.bindCopyButtons(panel);
    },

    // Функции управления viewer
    viewerFitToView() {
        if (IFCViewerManager.viewer) {
            IFCViewerManager.fitToView();
        }
    },

    viewerZoomIn() {
        if (IFCViewerManager.viewer) {
            IFCViewerManager.zoomIn();
        }
    },

    viewerZoomOut() {
        if (IFCViewerManager.viewer) {
            IFCViewerManager.zoomOut();
        }
    },

    viewerResetColors() {
        this.setViewerDisplayMode('textured');
    },

    setViewerDisplayMode(mode) {
        this.viewerDisplayMode = mode;
        const normalizedMode = mode === 'textured' ? 'default' : mode;

        if (IFCViewerManager.viewer) {
            IFCViewerManager.setDisplayMode(normalizedMode);
        }

        this.updateViewerDisplayModeButtons();
    },

    updateViewerDisplayModeButtons() {
        const buttons = document.querySelectorAll('[data-viewer-mode]');
        buttons.forEach((button) => {
            const isActive = button.dataset.viewerMode === this.viewerDisplayMode;
            button.classList.toggle('active', isActive);
        });
    },

    zoomToSelected() {
        if (IFCViewerManager.viewer && this.selectedIfcElements.length > 0) {
            IFCViewerManager.zoomToElements(this.selectedIfcElements);
        }
    },

    clearIfcSelection() {
        if (IFCViewerManager.viewer) {
            IFCViewerManager.clearSelection();
            this.selectedIfcElements = [];
            this.updateLinkButtons();
            this.updateIsolationButtons();
            
            // Очищаем панель свойств
            const panel = document.getElementById('element-properties');
            if (panel) {
                panel.innerHTML = this.getEmptyPropertiesMarkup();
            }
        }
    },

    isolateSelected() {
        if (IFCViewerManager.viewer && this.selectedIfcElements.length > 0) {
            IFCViewerManager.isolateElements(this.selectedIfcElements);
            this.updateIsolationButtons();
            UI.showNotification(`Изолировано элементов: ${this.selectedIfcElements.length}`, 'success');
        }
    },

    showAllElements() {
        if (IFCViewerManager.viewer) {
            IFCViewerManager.showAllElements();
            this.updateIsolationButtons();
            UI.showNotification('Все элементы показаны', 'success');
        }
    },

    updateIsolationButtons() {
        const isolateBtn = document.getElementById('isolate-btn');
        const unisolateBtn = document.getElementById('unisolate-btn');
        
        if (isolateBtn) {
            isolateBtn.disabled = this.selectedIfcElements.length === 0;
        }
        
        if (unisolateBtn) {
            // Кнопка активна когда есть viewer
            unisolateBtn.disabled = !IFCViewerManager.viewer;
        }
    },
    
    // Переменные для хранения выбранных элементов
    selectedResources: [],
    selectedIfcElements: [],
    currentEstimateWithIfc: null,
    currentResourceFilter: 'all', // 'all', 'linked', 'unlinked'
    lastResourceHighlightElements: [],

    parseIfcElements(rawValue) {
        if (!rawValue && rawValue !== 0) {
            return [];
        }

        let source = rawValue;

        if (typeof rawValue === 'string') {
            try {
                source = JSON.parse(rawValue);
            } catch (error) {
                console.warn('Failed to parse IFC elements:', error);
                return [];
            }
        }

        if (!Array.isArray(source)) {
            return [];
        }

        return source
            .map((id) => {
                if (typeof id === 'string') return id.trim();
                if (typeof id === 'number') return String(id);
                return null;
            })
            .filter((id) => Boolean(id));
    },

    highlightResourceElements(elementIds = []) {
        if (!IFCViewerManager.viewer) {
            return;
        }

        const idsToClear = this.lastResourceHighlightElements.filter(
            (id) => !this.selectedIfcElements.includes(id)
        );

        if (idsToClear.length) {
            IFCViewerManager.unhighlightElements(idsToClear);
            if (typeof IFCViewerManager.applyPersistentHighlights === 'function') {
                IFCViewerManager.applyPersistentHighlights();
            }
        }

        if (!elementIds || elementIds.length === 0) {
            this.lastResourceHighlightElements = [];
            return;
        }

        IFCViewerManager.highlightElements(elementIds, [0.95, 0.7, 0.2]);
        IFCViewerManager.zoomToElements(elementIds);
        this.lastResourceHighlightElements = [...elementIds];
    },

    // Загрузка IFC модели для сметы
    async uploadIFCForEstimate(estimateId, options = {}) {
        const { stayOnList = false } = options;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ifc';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                UI.showNotification('Загрузка IFC файла...', 'info');
                const formData = new FormData();
                formData.append('ifc', file);
                
                const response = await fetch(`${API_BASE_URL}/estimates/${estimateId}/upload-ifc`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Ошибка загрузки IFC');
                
                const result = await response.json();
                UI.showNotification('IFC модель успешно загружена и конвертирована', 'success');
                
                // Автоматически открываем 3D viewer с загруженной моделью, если находимся внутри раздела
                if (!stayOnList && result.estimate.xktFileUrl) {
                    const fullXktUrl = `http://localhost:3001/${result.estimate.xktFileUrl}`;
                    await this.loadIfcViewer(estimateId, fullXktUrl);
                }
                
                if (stayOnList) {
                    await this.loadEstimates(this.currentBlockId);
                } else {
                    await this.openEstimate(estimateId);
                }
            } catch (error) {
                UI.showNotification('Ошибка: ' + error.message, 'error');
            }
        };
        
        input.click();
    },

    // Загрузка IFC модели в просмотрщик
    async loadIfcViewer(estimateId, xktUrl) {
        this.currentEstimateWithIfc = estimateId;
        
        console.log('🎬 Загрузка IFC viewer для сметы:', estimateId);
        console.log('📦 XKT URL:', xktUrl);

        const viewerReady = await this.initializeViewer();
        if (!viewerReady) {
            throw new Error('3D viewer не инициализирован');
        }
        
        try {
            const overlay = document.getElementById('ifc-viewer-overlay');
            const statusText = document.getElementById('ifc-status-text');
            const controls = document.getElementById('viewer-controls');
            
            if (statusText) statusText.textContent = 'Загрузка модели...';
            
            const fullUrl = xktUrl.startsWith('http') ? xktUrl : `http://localhost:3001${xktUrl}`;
            await IFCViewerManager.loadXKT(fullUrl, `estimate-${estimateId}`);
            
            if (overlay) overlay.style.display = 'none';
            if (controls) controls.classList.add('is-visible');
            this.setViewerDisplayMode(this.viewerDisplayMode || 'textured');
            
            UI.showNotification('3D модель загружена', 'success');
            await this.highlightLinkedResources(estimateId);
            
        } catch (error) {
            console.error('Ошибка загрузки IFC:', error);
            const statusText = document.getElementById('ifc-status-text');
            if (statusText) statusText.textContent = 'Ошибка загрузки модели';
            UI.showNotification('Ошибка загрузки модели: ' + error.message, 'error');
            const controls = document.getElementById('viewer-controls');
            if (controls) controls.classList.remove('is-visible');
            const overlay = document.getElementById('ifc-viewer-overlay');
            if (overlay) overlay.style.display = 'flex';
        }
    },

    // Подсветка связанных элементов
    async highlightLinkedResources(estimateId) {
        try {
            const sections = await api.getSections(estimateId);
            const linkedElements = new Set();
            
            for (const section of sections) {
                const stages = await api.getStages(section.id);
                for (const stage of stages) {
                    const workTypes = await api.getWorkTypes(stage.id);
                    for (const wt of workTypes) {
                        const elements = this.parseIfcElements(wt.ifcElements);
                        if (elements.length) {
                            elements.forEach((el) => linkedElements.add(el));
                        }
                    }
                }
            }
            
            if (linkedElements.size > 0) {
                IFCViewerManager.setPersistentHighlights(Array.from(linkedElements), [0.1, 0.8, 0.3]);
                console.log(`✓ Подсвечено ${linkedElements.size} связанных элементов`);
            } else {
                IFCViewerManager.clearPersistentHighlights();
            }
            
        } catch (error) {
            console.error('Ошибка подсветки связанных элементов:', error);
        }
    },

    // Клик по ресурсу для выбора
    selectResource(resourceId) {
        const resourceEl = document.querySelector(`[data-resource-id="${resourceId}"]`);
        const checkbox = document.querySelector(`.resource-checkbox[data-resource-id="${resourceId}"]`);
        if (!resourceEl) return;
        
        // Toggle выбора
        const index = this.selectedResources.indexOf(resourceId);
        if (index > -1) {
            this.selectedResources.splice(index, 1);
            resourceEl.style.background = 'var(--white)';
            resourceEl.style.borderColor = 'var(--gray-200)';
            if (checkbox) checkbox.checked = false;
        } else {
            this.selectedResources.push(resourceId);
            resourceEl.style.background = 'var(--primary-lighter)';
            resourceEl.style.borderColor = 'var(--primary)';
            resourceEl.style.borderWidth = '2px';
            if (checkbox) checkbox.checked = true;
        }
        
        const linkedElements = this.parseIfcElements(resourceEl.dataset?.ifcElements);
        this.highlightResourceElements(linkedElements);

        // Обновляем видимость кнопок связать/отвязать
        this.updateLinkButtons();
    },

    // Обновление видимости кнопок связать/отвязать
    updateLinkButtons() {
        const btnLink = document.getElementById('btn-link-resource');
        const btnUnlink = document.getElementById('btn-unlink-resource');
        const linkBtnText = document.getElementById('link-btn-text');
        const unlinkBtnText = document.getElementById('unlink-btn-text');
        const selectionInfo = document.getElementById('selection-info');
        const selectionInfoText = document.getElementById('selection-info-text');
        
        if (!btnLink || !btnUnlink) return;
        
        const hasResourceSelection = this.selectedResources.length > 0;
        const hasIfcSelection = this.selectedIfcElements.length > 0;
        
        // Обновляем текст кнопок с количеством выбранных элементов
        if (linkBtnText && hasResourceSelection) {
            const resourceText = this.selectedResources.length === 1 ? 'ресурс' : 'ресурсов';
            const ifcText = this.selectedIfcElements.length === 1 ? 'элемент' : 'элементов';
            linkBtnText.textContent = `Связать (${this.selectedResources.length} ${resourceText} → ${this.selectedIfcElements.length} ${ifcText})`;
        } else if (linkBtnText) {
            linkBtnText.textContent = 'Связать';
        }
        
        if (unlinkBtnText && hasResourceSelection) {
            unlinkBtnText.textContent = `Отвязать (${this.selectedResources.length})`;
        } else if (unlinkBtnText) {
            unlinkBtnText.textContent = 'Отвязать';
        }
        
        // Показываем кнопки и информацию
        if (hasResourceSelection) {
            btnLink.style.display = 'flex';
            btnUnlink.style.display = 'flex';
            
            // Показываем информационную подсказку
            if (selectionInfo && selectionInfoText) {
                selectionInfo.style.display = 'flex';
                
                if (!hasIfcSelection) {
                    selectionInfoText.innerHTML = `Выбрано ресурсов: <strong>${this.selectedResources.length}</strong>. Теперь выберите элементы в 3D модели (кликайте по элементам)`;
                } else {
                    selectionInfoText.innerHTML = `Готово к связыванию: <strong>${this.selectedResources.length}</strong> ресурсов → <strong>${this.selectedIfcElements.length}</strong> элементов`;
                }
            }
            
            // Активность кнопки "Связать" зависит от наличия выбранных IFC элементов
            btnLink.disabled = !hasIfcSelection;
            if (!hasIfcSelection) {
                btnLink.style.opacity = '0.5';
                btnLink.style.cursor = 'not-allowed';
            } else {
                btnLink.style.opacity = '1';
                btnLink.style.cursor = 'pointer';
            }
        } else {
            btnLink.style.display = 'none';
            btnUnlink.style.display = 'none';
            if (selectionInfo) {
                selectionInfo.style.display = 'none';
            }
        }
    },

    // Фильтрация ресурсов по статусу связи с IFC
    filterResources(filterType) {
        this.currentResourceFilter = filterType;
        
        // Обновляем активность кнопок фильтра
        const btnLinked = document.getElementById('btn-filter-linked');
        const btnUnlinked = document.getElementById('btn-filter-unlinked');
        const btnReset = document.getElementById('btn-filter-reset');
        const filterButtons = [btnLinked, btnUnlinked, btnReset];
        filterButtons.forEach((btn) => btn?.classList.remove('active')); 
        if (filterType === 'linked') btnLinked?.classList.add('active');
        if (filterType === 'unlinked') btnUnlinked?.classList.add('active');
        if (filterType === 'all') btnReset?.classList.add('active');
        
        // Названия фильтров
        const filterNames = {
            'all': 'Все ресурсы',
            'linked': 'Связанные с IFC',
            'unlinked': 'Не связанные с IFC'
        };
        
        // Применяем фильтр ко всем ресурсам
        const allResources = document.querySelectorAll('.resource-item');
        let visibleCount = 0;
        let hiddenCount = 0;
        let linkedIfcElements = []; // Собираем все IFC элементы связанных ресурсов
        
        allResources.forEach(resourceEl => {
            const hasIfcLink = resourceEl.dataset.hasIfcLink === 'true';
            
            let shouldShow = true;
            
            if (filterType === 'linked') {
                shouldShow = hasIfcLink;
                // Если ресурс связан и мы фильтруем связанные, собираем IFC элементы
                if (shouldShow && hasIfcLink) {
                    const elements = this.parseIfcElements(resourceEl.dataset.ifcElements);
                    if (elements.length) {
                        linkedIfcElements.push(...elements);
                    }
                }
            } else if (filterType === 'unlinked') {
                shouldShow = !hasIfcLink;
            }
            
            if (shouldShow) {
                resourceEl.style.display = '';
                visibleCount++;
            } else {
                resourceEl.style.display = 'none';
                hiddenCount++;
            }
        });
        
        // Изолируем элементы в 3D если фильтр "связанные" и есть элементы
        if (filterType === 'linked' && linkedIfcElements.length > 0 && IFCViewerManager.viewer) {
            // Убираем дубликаты
            linkedIfcElements = [...new Set(linkedIfcElements)];
            IFCViewerManager.isolateElements(linkedIfcElements);
            UI.showNotification(`${filterNames[filterType]}: ${visibleCount} показано, ${linkedIfcElements.length} элементов изолировано в 3D`, 'success');
        } else if (filterType === 'all' && IFCViewerManager.viewer) {
            // Показываем все элементы в 3D при сбросе фильтра
            IFCViewerManager.showAllElements();
            UI.showNotification(`${filterNames[filterType]}: ${visibleCount} показано${hiddenCount > 0 ? `, ${hiddenCount} скрыто` : ''}`, 'success');
        } else {
            UI.showNotification(`${filterNames[filterType]}: ${visibleCount} показано${hiddenCount > 0 ? `, ${hiddenCount} скрыто` : ''}`, 'success');
        }
        
        // Обновляем кнопки изоляции
        this.updateIsolationButtons();
    },

    // Связать выбранные ресурсы с элементами IFC
    async linkSelectedResource() {
        if (this.selectedResources.length === 0) {
            UI.showNotification('Выберите ресурс для связывания', 'warning');
            return;
        }
        
        if (this.selectedIfcElements.length === 0) {
            UI.showNotification('Выберите элементы в IFC модели', 'warning');
            return;
        }
        
        try {
            const elementsToLink = [...this.selectedIfcElements];

            // Связываем каждый выбранный ресурс с выбранными элементами IFC
            for (const resourceId of this.selectedResources) {
                await api.updateWorkType(resourceId, {
                    ifcElements: elementsToLink,
                });
            }
            
            UI.showNotification(`Связано ресурсов: ${this.selectedResources.length}`, 'success');
            
            // Сбрасываем визуальное состояние выбранных ресурсов
            for (const resourceId of this.selectedResources) {
                const resourceEl = document.querySelector(`[data-resource-id="${resourceId}"]`);
                const checkbox = document.querySelector(`.resource-checkbox[data-resource-id="${resourceId}"]`);
                if (resourceEl) {
                    resourceEl.style.background = 'var(--white)';
                    resourceEl.style.borderColor = 'var(--gray-200)';
                    resourceEl.style.borderWidth = '1px';
                }
                if (checkbox) checkbox.checked = false;
            }
            
            // Очищаем выбор IFC элементов
            if (IFCViewerManager.viewer) {
                IFCViewerManager.clearSelection();
            }
            
            // Сбрасываем выбор
            this.selectedResources = [];
            this.selectedIfcElements = [];
            this.updateLinkButtons();
            this.updateIsolationButtons();
            
            // Перезагружаем структуру
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка связывания: ' + error.message, 'error');
        }
    },

    // Отвязать выбранные ресурсы от IFC элементов
    async unlinkSelectedResource() {
        if (this.selectedResources.length === 0) {
            UI.showNotification('Выберите ресурс для отвязки', 'warning');
            return;
        }
        
        if (!confirm(`Отвязать ${this.selectedResources.length} ресурс(ов) от IFC элементов?`)) {
            return;
        }
        
        try {
            // Убираем связь с IFC элементами
            for (const resourceId of this.selectedResources) {
                await api.updateWorkType(resourceId, {
                    ifcElements: null
                });
            }
            
            UI.showNotification('Связь удалена', 'success');
            
            // Сбрасываем визуальное состояние выбранных ресурсов
            for (const resourceId of this.selectedResources) {
                const resourceEl = document.querySelector(`[data-resource-id="${resourceId}"]`);
                const checkbox = document.querySelector(`.resource-checkbox[data-resource-id="${resourceId}"]`);
                if (resourceEl) {
                    resourceEl.style.background = 'var(--white)';
                    resourceEl.style.borderColor = 'var(--gray-200)';
                    resourceEl.style.borderWidth = '1px';
                }
                if (checkbox) checkbox.checked = false;
            }
            
            // Сбрасываем выбор
            this.selectedResources = [];
            this.updateLinkButtons();
            
            // Перезагружаем структуру
            await this.loadEstimateStructure(this.currentEstimateId);
        } catch (error) {
            UI.showNotification('Ошибка отвязки: ' + error.message, 'error');
        }
    },

    // ========================================
    // Каскадный пересчет сумм вверх по иерархии (FIXED)
    // ========================================
    async recalculateHierarchyFixed(workTypeId) {
        try {
            // ВНИМАНИЕ: В UI "Ресурс" это DB WorkType, "Вид работ" это DB EstimateStage, "Этап" это DB EstimateSection
            
            // 1. Получаем WorkType (UI "Ресурс")
            const workType = await api.getWorkType(workTypeId);
            if (!workType || !workType.stageId) return;

            console.log('Recalculating hierarchy for WorkType (UI Resource):', workTypeId);

            // 2. Пересчитываем Stage (UI "Вид работ") - это родитель WorkType
            await api.recalculateStage(workType.stageId);

            // 3. Получаем обновленный Stage чтобы найти Section ID
            const stage = await api.getStage(workType.stageId);
            if (!stage || !stage.sectionId) return;

            // 4. Пересчитываем Section (UI "Этап")
            await api.recalculateSection(stage.sectionId);

            // 5. Получаем обновленный Section чтобы найти Estimate ID
            const section = await api.getSection(stage.sectionId);
            if (!section || !section.estimateId) return;

            // 6. Пересчитываем Estimate
            await api.recalculateEstimate(section.estimateId);

            console.log('✓ Cascade recalculation completed');
        } catch (error) {
            console.error('Ошибка каскадного пересчета:', error);
        }
    },

    // Обновление сумм в DOM без перезагрузки структуры (FIXED)
    async updateHierarchySumsFixed(workTypeId) {
        try {
            // 1. Получаем обновленный WorkType (UI "Ресурс")
            const workType = await api.getWorkType(workTypeId);
            if (!workType || !workType.stageId) return;

            // 2. Получаем обновленный Stage (UI "Вид работ")
            const stage = await api.getStage(workType.stageId);
            if (!stage || !stage.sectionId) return;

            // 3. Получаем обновленный Section (UI "Этап")
            const section = await api.getSection(stage.sectionId);
            if (!section || !section.estimateId) return;

            // 4. Получаем обновленный Estimate
            const estimate = await api.getEstimate(section.estimateId);

            // Обновляем сумму UI "Вид работ" (это DB Stage)
            const uiWorkTypeContainer = document.querySelector(`[data-worktype-id="${stage.id}"]`);
            if (uiWorkTypeContainer) {
                const sumSpan = uiWorkTypeContainer.querySelector('.wt-total-cost');
                if (sumSpan) {
                    sumSpan.textContent = UI.formatCurrency(stage.totalCost, this.currentProject?.currency);
                    // Анимация обновления
                    sumSpan.style.transition = 'color 0.3s';
                    sumSpan.style.color = 'var(--accent-green)';
                    setTimeout(() => sumSpan.style.color = 'var(--primary)', 500);
                }
            }

            // Обновляем сумму UI "Этап" (это DB Section)
            const uiStageContainer = document.querySelector(`[data-stage-id="${section.id}"]`);
            if (uiStageContainer) {
                const sumSpan = uiStageContainer.querySelector('.stage-total-cost');
                if (sumSpan) {
                    sumSpan.textContent = UI.formatCurrency(section.totalCost, this.currentProject?.currency);
                    // Анимация обновления
                    sumSpan.style.transition = 'color 0.3s';
                    sumSpan.style.color = 'var(--accent-green)';
                    setTimeout(() => sumSpan.style.color = 'var(--primary)', 500);
                }
            }

            console.log('✓ DOM sums updated:', {
                stage: stage.totalCost,
                section: section.totalCost
            });
        } catch (error) {
            console.error('Ошибка обновления сумм в DOM:', error);
        }
    },

    // Старые функции оставлены для совместимости, но не используются
    async recalculateHierarchy(resourceId) {
        return this.recalculateHierarchyFixed(resourceId);
    },
    async updateHierarchySums(resourceId) {
        return this.updateHierarchySumsFixed(resourceId);
    }
};
