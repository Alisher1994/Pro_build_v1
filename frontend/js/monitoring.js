// ========================================
// Monitoring Manager - 3D Object Monitoring
// ========================================

const MonitoringManager = {
    projectId: null,
    data: null, // { tasks, workTypes, estimates }
    viewer: null,
    currentXktUrl: null,

    async init(projectId) {
        this.projectId = projectId;

        try {
            UI.showTurboLoader();
            this.data = await api.getMonitoringData(projectId);

            // ДИАГНОСТИКА: проверяем что получили от API
            console.log('[Monitoring Init] Данные получены:', {
                tasks: this.data.tasks?.length || 0,
                workTypes: this.data.workTypes?.length || 0,
                estimates: this.data.estimates?.length || 0
            });
            if (this.data.tasks?.length > 0) {
                console.log('[Monitoring Init] Пример задачи:', this.data.tasks[0]);
            }
            if (this.data.workTypes?.length > 0) {
                console.log('[Monitoring Init] Пример WorkType:', this.data.workTypes[0]);
            }

            this.renderEstimateSelector();

            // Инициализация ссылки на вьювер
            this.viewer = window.IFCViewerManager;

            if (!this.viewer) {
                console.error('IFCViewerManager not found on window');
            }
        } catch (error) {
            console.error('Failed to init monitoring:', error);
            UI.showNotification('Ошибка загрузки данных мониторинга', 'error');
        } finally {
            UI.hideTurboLoader();
        }
    },

    renderEstimateSelector() {
        const pane = document.getElementById('monitoring-pane');
        if (!pane) return;

        const estimates = this.data.estimates || [];
        if (estimates.length === 0) {
            pane.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--gray-500);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.5;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <h3>Нет IFC моделей</h3>
                    <p>Загрузите IFC файл в разделе "Смета" для визуализации прогресса</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="padding: 12px; height: 100%; display: flex; flex-direction: column; background: var(--gray-50);">
                <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid var(--gray-200);">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase;">Модель IFC / Смета</label>
                        <select id="monitoring-estimate-select" style="padding: 6px 12px; border-radius: 4px; border: 1px solid var(--gray-300); background: #f9fafb; font-size: 13px; min-width: 240px;">
                            ${estimates.map(e => `<option value="${e.xktUrl}">${this.escapeHtml(e.name)}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="MonitoringManager.loadModel()" style="margin-top: 18px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Загрузить
                    </button>

                    <div style="margin-left: auto; display: flex; gap: 20px; background: var(--gray-50); padding: 8px 16px; border-radius: 6px; border: 1px solid var(--gray-200);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 3px; box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);"></span>
                            <span style="font-size: 13px; font-weight: 500; color: var(--gray-700);">Готово (100%)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 12px; height: 12px; background: #f97316; border-radius: 3px; box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);"></span>
                            <span style="font-size: 13px; font-weight: 500; color: var(--gray-700);">В работе (>0%)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);"></span>
                            <span style="font-size: 13px; font-weight: 500; color: var(--gray-700);">Не начато</span>
                        </div>
                    </div>
                </div>
                <div id="monitoring-viewer-container" style="flex: 1; min-height: 0; border-radius: 8px; position: relative; overflow: hidden;">
                    <canvas id="monitoring-viewer-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
                    <div id="monitoring-loader" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: none; flex-direction: column; align-items: center; justify-content: center; color: #fff; z-index: 10;">
                        <div class="turbo-loader-spinner" style="width: 40px; height: 40px; border-width: 3px; margin-bottom: 12px;"></div>
                        <div id="monitoring-loader-text">Загрузка модели...</div>
                    </div>
                </div>
            </div>
        `;
        pane.innerHTML = html;
    },

    async loadModel() {
        if (!this.viewer) {
            this.viewer = window.IFCViewerManager;
        }

        if (!this.viewer) {
            UI.showNotification('3D Viewer не инициализирован', 'error');
            return;
        }

        const select = document.getElementById('monitoring-estimate-select');
        const url = select.value;
        if (!url) return;

        const loader = document.getElementById('monitoring-loader');
        const loaderText = document.getElementById('monitoring-loader-text');
        if (loader) loader.style.display = 'flex';

        try {
            // Если вьювер уже инициализирован на другом канвасе - пересоздаем
            if (this.viewer.viewer && this.viewer.viewer.scene.canvas.canvas.id !== 'monitoring-viewer-canvas') {
                console.log('Пересоздание вьювера для мониторинга...');
                this.viewer.destroy();
            }

            // Инициализируем вьювер если нужно
            if (!this.viewer.viewer) {
                const success = await this.viewer.init('monitoring-viewer-canvas');
                if (!success) {
                    throw new Error('Не удалось инициализировать 3D вьювер');
                }
            }

            await this.viewer.loadXKT(url, 'monitoring-model', (progress) => {
                if (loaderText) loaderText.textContent = `Загрузка: ${Math.round(progress)}%`;
            });

            this.currentXktUrl = url;

            // Даем немного времени на отрисовку перед покраской
            setTimeout(() => {
                this.applyStatusColors();
            }, 500);

        } catch (error) {
            console.error('Error loading model:', error);
            UI.showNotification('Ошибка загрузки модели', 'error');
        } finally {
            if (loader) loader.style.display = 'none';
        }
    },

    applyStatusColors() {
        if (!this.viewer || !this.viewer.viewer || !this.data) return;

        console.log('--- Начинаю покраску объектов по прогрессу ---');

        const allIds = this.viewer.getAllObjectIds();
        console.log(`Всего объектов во вьювере (allIds): ${allIds.length}`);

        const guidToLevel = {};
        let levelFoundCount = 0;

        // 1. Build GUID -> Level map
        const metaScene = this.viewer.viewer.metaScene;

        // 1. Build GUID -> Level map using both props and metaScene hierarchy
        allIds.forEach(id => {
            const obj = this.viewer.viewer.scene.objects[id];
            if (!obj) return;

            let floorNum = null;

            // Strategy A: Direct Properties
            const props = this.viewer.getElementProperties(obj);
            if (props && props.attributes) {
                const floorStr = props.attributes.Level || props.attributes.Storey || props.attributes['Этаж'] || "";
                const match = String(floorStr).match(/\d+/);
                if (match) floorNum = parseInt(match[0], 10);
            }

            // Strategy B: Hierarchy (IfcBuildingStorey)
            if (floorNum === null && metaScene) {
                const metaObject = metaScene.metaObjects[id];
                if (metaObject) {
                    let current = metaObject;
                    // Walk up until we find a storey or run out of parents
                    while (current && current.type !== 'IfcBuildingStorey') {
                        current = current.parent;
                    }
                    if (current && current.type === 'IfcBuildingStorey') {
                        // Extract number from storey name (e.g. "Level 2", "Storey_04", "Этаж 5")
                        const match = (current.name || '').match(/\d+/);
                        if (match) floorNum = parseInt(match[0], 10);
                    }
                }
            }

            if (floorNum !== null) {
                guidToLevel[id] = floorNum;
                levelFoundCount++;
            }
        });
        console.log(`Этажи найдены для: ${levelFoundCount} объектов`);

        // 2. Build WorkType map for fast lookup: GUID (lowercase) -> Array of WorkType IDs
        const guidToWtIds = {};
        let totalIfcElementsInDb = 0;
        if (this.data.workTypes) {
            console.log(`Всего типов работ в данных: ${this.data.workTypes.length}`);
            this.data.workTypes.forEach(wt => {
                const elements = Array.isArray(wt.ifcElements) ? wt.ifcElements : [];
                totalIfcElementsInDb += elements.length;
                elements.forEach(guid => {
                    const g = String(guid).toLowerCase();
                    if (!guidToWtIds[g]) guidToWtIds[g] = [];
                    guidToWtIds[g].push(wt.id);
                });
            });
        }
        const uniqueGuidedElements = Object.keys(guidToWtIds).length;
        console.log(`Всего привязок GUID в БД: ${totalIfcElementsInDb}, уникальных GUID: ${uniqueGuidedElements}`);

        // ДИАГНОСТИКА: показать первые 10 объектов с этажами
        const sampleObjsWithFloors = allIds.slice(0, 10).map(id => ({ id, floor: guidToLevel[id] }));
        console.log('[DEBUG] Примеры объектов с этажами:', sampleObjsWithFloors);

        const select = document.getElementById('monitoring-estimate-select');
        const selectedUrl = select.value;
        const selectedEstimate = (this.data.estimates || []).find(e => e.xktUrl === selectedUrl);
        // Normalize blockId to 'no-block' if missing, to match taskProg keys
        const currentBlockId = (selectedEstimate && selectedEstimate.blockId) ? selectedEstimate.blockId : 'no-block';

        console.log(`[Monitoring] Начинаю покраску. Выбран блок: ${currentBlockId || 'не определен'}`);

        // 3. Status map: (workTypeId, blockId, floor) -> progress
        const taskProg = {};
        if (this.data.tasks) {
            this.data.tasks.forEach(t => {
                const parts = t.id.split('-floor-');
                if (parts.length === 2) {
                    const wtid = parts[0].replace('worktype-', '');
                    // parts[1] = "BLOCK_ID-FLOOR", нужно взять последнее число после последнего дефиса
                    const floorMatch = parts[1].match(/(\d+)$/);
                    const floor = floorMatch ? parseInt(floorMatch[1], 10) : null;
                    if (floor !== null) {
                        // Ключ теперь включает blockId для точности
                        const bid = t.blockId || 'no-block';
                        const key = `${wtid}-${bid}-${floor}`;
                        taskProg[key] = t.progress;
                    }
                }
            });
        }


        const taskProgKeys = Object.keys(taskProg);
        console.log(`[Monitoring] Мапа прогресса (wt-bid-floor): ${taskProgKeys.length} записей`);

        // 🔍 РАСШИРЕННАЯ ДИАГНОСТИКА
        console.log('🔑 ВСЕ КЛЮЧИ В taskProg:', taskProgKeys);
        console.log('📊 ВСЕ ЗНАЧЕНИЯ taskProg:', taskProgKeys.map(k => ({
            key: k,
            progress: taskProg[k]
        })));
        console.log('📋 Пример задачи Gantt:', this.data.tasks?.[0]);

        if (taskProgKeys.length > 0) {
            console.log('[DEBUG] Первые 10 ключей прогресса:', taskProgKeys.slice(0, 10).map(k => ({ key: k, prog: taskProg[k] })));
        } else {
            console.warn('[WARNING] Нет ни одной задачи с прогрессом! Проверьте, есть ли задачи в Gantt с ID вида worktype-XXX-floor-N');
        }


        if (Object.keys(guidToWtIds).length === 0) {
            console.warn('[WARNING] Нет ни одного WorkType с привязанными IFC элементами! Проверьте связи в Смете.');
        }

        // 4. Update colors
        const COLOR_GREEN = [0.13, 0.77, 0.37]; // #22c55e
        const COLOR_ORANGE = [0.98, 0.45, 0.09]; // #f97316
        const COLOR_RED = [0.94, 0.27, 0.27]; // #ef4444

        const updates = {
            completed: [],
            inProgress: [],
            notStarted: []
        };

        let guidMatchCount = 0;
        let finalMatchCount = 0;
        let debugCounter = 0;

        allIds.forEach(id => {
            const lowId = String(id).toLowerCase();
            const wts = guidToWtIds[lowId];
            if (!wts) return;

            guidMatchCount++;
            const floor = guidToLevel[id];

            // ДИАГНОСТИКА первых 5 объектов с совпадением по GUID
            if (debugCounter < 5) {
                console.log(`[DEBUG #${debugCounter}] GUID: ${id}, Floor: ${floor}, WorkTypes: [${wts.join(', ')}]`);
                debugCounter++;
            }

            if (floor === undefined || floor === null) return;

            let maxProg = -1;
            let minProg = 101;
            let found = false;

            wts.forEach(wtid => {
                // Ищем задачу именно для ТЕКУЩЕГО блока
                const key = `${wtid}-${currentBlockId}-${floor}`;
                const prog = taskProg[key];

                if (debugCounter <= 5 && wts === guidToWtIds[lowId]) {
                    console.log(`[DEBUG] Проверка ключа: "${key}", Прогресс: ${prog !== undefined ? prog : 'НЕ НАЙДЕНО'}`);
                }

                if (prog !== undefined) {
                    found = true;
                    if (finalMatchCount < 5) console.log(`[Mapping Debug] Найдено совпадение! GUID: ${id}, Key: ${key}, Progress: ${prog}`);

                    // Gantt progress is 0..1 usually, let's normalize to %
                    let p = Number(prog);
                    if (p <= 1 && p > 0) p = p * 100;

                    maxProg = Math.max(maxProg, p);
                    minProg = Math.min(minProg, p);
                }
            });

            if (found) {
                finalMatchCount++;
                if (minProg >= 100) {
                    updates.completed.push(id);
                } else if (maxProg > 0) {
                    updates.inProgress.push(id);
                } else {
                    updates.notStarted.push(id);
                }
            }
        });

        console.log(`Маппинг: Совпало по GUID=${guidMatchCount}, Совпало GUID+Блок+Этаж=${finalMatchCount}`);
        console.log(`Результат: Готово=${updates.completed.length}, В работе=${updates.inProgress.length}, Не начато=${updates.notStarted.length}`);

        // ДИАГНОСТИКА: если ничего не совпало
        if (finalMatchCount === 0) {
            console.error('═══════════════════════════════════════════════════');
            console.error('❌ ДИАГНОСТИКА: Ни один объект не был сопоставлен!');
            console.error('═══════════════════════════════════════════════════');
            console.table({
                'Всего объектов в модели': allIds.length,
                'Объектов с этажами': levelFoundCount,
                'Объектов с привязкой к WorkType (GUID)': guidMatchCount,
                'WorkType с IFC элементами': Object.keys(guidToWtIds).length,
                'Задач с прогрессом': Object.keys(taskProg).length,
                'Текущий BlockID': currentBlockId
            });
            console.error('Возможные причины:');
            console.error('1. У задач в Gantt другой BlockID (проверьте taskProg ключи выше)');
            console.error('2. У IFC объектов не определяются этажи (проверьте примеры объектов выше)');
            console.error('3. WorkType ID в задачах не совпадают с теми, что привязаны к IFC');
            console.error('═══════════════════════════════════════════════════');
        }

        if (updates.completed.length) this.viewer.viewer.scene.setObjectsColorized(updates.completed, COLOR_GREEN);
        if (updates.inProgress.length) this.viewer.viewer.scene.setObjectsColorized(updates.inProgress, COLOR_ORANGE);
        if (updates.notStarted.length) this.viewer.viewer.scene.setObjectsColorized(updates.notStarted, COLOR_RED);

        const mappedIds = [...updates.completed, ...updates.inProgress, ...updates.notStarted];

        if (mappedIds.length > 0) {
            const unmappedIds = allIds.filter(id => !mappedIds.includes(id));
            if (unmappedIds.length) {
                this.viewer.viewer.scene.setObjectsOpacity(unmappedIds, 0.4);
                this.viewer.viewer.scene.setObjectsColorized(unmappedIds, [0.9, 0.9, 0.9]);
            }
        } else {
            console.warn('Ни один объект не был сопоставлен с задачами ГПР. Сбрасываю цвета.');
            this.viewer.viewer.scene.setObjectsOpacity(allIds, 1.0);
            this.viewer.viewer.scene.setObjectsColorized(allIds, [1, 1, 1]);
        }
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

window.MonitoringManager = MonitoringManager;
