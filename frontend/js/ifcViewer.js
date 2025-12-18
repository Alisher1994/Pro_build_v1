// ========================================
// IFC Viewer Module - интеграция xeokit
// ========================================

const XEOKIT_READY_EVENT = 'xeokit:ready';

const IFCViewerManager = {
    viewer: null,
    xktLoader: null,
    currentModel: null,
    selectedElements: [],
    lastSelectedElements: [],
    onElementSelected: null,
    sdkReadyPromise: null,
    displayMode: 'default',
    selectionColor: [0.97, 0.58, 0.15],
    persistentHighlightIds: new Set(),
    persistentHighlightColor: null,

    waitForXeokit() {
        if (typeof window !== 'undefined' && window.xeokit) {
            return Promise.resolve(window.xeokit);
        }

        if (!this.sdkReadyPromise) {
            this.sdkReadyPromise = new Promise((resolve, reject) => {
                if (typeof window === 'undefined') {
                    reject(new Error('Глобальный объект window недоступен'));
                    return;
                }

                let timeoutId = null;
                const onReady = () => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                    window.removeEventListener(XEOKIT_READY_EVENT, onReady);
                    resolve(window.xeokit);
                };

                timeoutId = setTimeout(() => {
                    window.removeEventListener(XEOKIT_READY_EVENT, onReady);
                    reject(new Error('xeokit SDK не загрузился в течение 15 секунд'));
                }, 15000);

                window.addEventListener(XEOKIT_READY_EVENT, onReady);
            }).finally(() => {
                this.sdkReadyPromise = null;
            });
        }

        return this.sdkReadyPromise;
    },

    // Инициализация viewer
    async init(canvasId, onElementSelectedCallback) {
        this.onElementSelected = onElementSelectedCallback;

        let xeokitSdk;
        try {
            xeokitSdk = await this.waitForXeokit();
        } catch (error) {
            console.error('❌ xeokit SDK не загружен! Проверьте подключение библиотеки.', error);
            return false;
        }

        if (!xeokitSdk) {
            console.error('❌ xeokit SDK не найден в window.xeokit');
            return false;
        }

        const canvasElement = document.getElementById(canvasId);
        if (!canvasElement) {
            console.error('Canvas element not found:', canvasId);
            return false;
        }

        try {
            // Создаём Viewer
            this.viewer = new xeokitSdk.Viewer({
                canvasId: canvasId,
                transparent: false,
                saoEnabled: true, // Ambient occlusion
                pbrEnabled: false, // Physically-based rendering
                dtxEnabled: false, // Double-sided triangles
            });

            // Настройка камеры
            this.viewer.camera.eye = [1841982.93, 10.03, -5173303.73];
            this.viewer.camera.look = [1842011.49, 10.03, -5173299.85];
            this.viewer.camera.up = [0, 1, 0];

            // XKT Loader Plugin
            this.xktLoader = new xeokitSdk.XKTLoaderPlugin(this.viewer);

            const sceneInput = this.viewer.scene.input;
            if (!sceneInput) {
                console.warn('⚠️ scene.input недоступен – выбор элементов работать не будет');
            } else {
                const attemptPickSelection = (canvasCoords) => {
                    if (!canvasCoords) {
                        return;
                    }

                    const pickResult = this.viewer.scene.pick({
                        canvasPos: canvasCoords,
                        pickSurface: true
                    });

                    if (pickResult?.entity) {
                        this.handleElementClick(pickResult.entity.id);
                    } else {
                        this.clearSelection(true);
                    }
                };

                sceneInput.on("mouseclicked", (canvasCoords) => {
                    attemptPickSelection(canvasCoords);
                });

                sceneInput.on("touchend", (touchParams) => {
                    const canvasCoords = Array.isArray(touchParams) ? touchParams[1] : null;
                    attemptPickSelection(canvasCoords);
                });
            }

            console.log('✅ IFC Viewer инициализирован');
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации xeokit viewer:', error);
            return false;
        }
    },

    // Загрузка XKT модели
    async loadXKT(url, modelId = 'model') {
        try {
            if (!this.viewer || !this.xktLoader) {
                throw new Error('IFC viewer не инициализирован');
            }
            
            console.log('Загрузка XKT:', url);
            
            // Удаляем предыдущую модель
            if (this.currentModel) {
                this.currentModel.destroy();
            }

            // Загружаем новую модель
            this.currentModel = this.xktLoader.load({
                id: modelId,
                src: url,
                edges: true, // Показывать рёбра
                backfaces: false,
            });

            this.currentModel.on("loaded", () => {
                console.log('✓ XKT модель загружена');
                this.viewer.cameraFlight.flyTo(this.viewer.scene);
                this.setDisplayMode(this.displayMode || 'default');
                
                // Автоматически скрываем помещения (IfcSpace) при загрузке
                this.hideSpaces();
                
                this.refreshViewport();
            });

            this.currentModel.on("error", (error) => {
                console.error('Ошибка загрузки XKT:', error);
            });

            return this.currentModel;
        } catch (error) {
            console.error('Ошибка при загрузке модели:', error);
            throw error;
        }
    },

    // Скрыть все помещения (IfcSpace)
    hideSpaces() {
        if (!this.viewer || !this.viewer.metaScene) return;
        
        const spaceIds = [];
        const metaObjects = this.viewer.metaScene.metaObjects;
        
        for (const id in metaObjects) {
            const metaObject = metaObjects[id];
            if (metaObject.type === 'IfcSpace') {
                spaceIds.push(metaObject.id);
            }
        }
        
        if (spaceIds.length > 0) {
            this.viewer.scene.setObjectsVisible(spaceIds, false);
            console.log(`Скрыто помещений: ${spaceIds.length}`);
        }
    },

    // Показать все помещения (IfcSpace)
    showSpaces() {
        if (!this.viewer || !this.viewer.metaScene) return;
        
        const spaceIds = [];
        const metaObjects = this.viewer.metaScene.metaObjects;
        
        for (const id in metaObjects) {
            const metaObject = metaObjects[id];
            if (metaObject.type === 'IfcSpace') {
                spaceIds.push(metaObject.id);
            }
        }
        
        if (spaceIds.length > 0) {
            this.viewer.scene.setObjectsVisible(spaceIds, true);
            console.log(`Показано помещений: ${spaceIds.length}`);
        }
    },

    // Переключить видимость помещений
    toggleSpaces() {
        if (!this.viewer || !this.viewer.metaScene) return false;
        
        const spaceIds = [];
        const metaObjects = this.viewer.metaScene.metaObjects;
        
        for (const id in metaObjects) {
            const metaObject = metaObjects[id];
            if (metaObject.type === 'IfcSpace') {
                spaceIds.push(metaObject.id);
            }
        }
        
        if (spaceIds.length > 0) {
            // Проверяем видимость первого помещения
            const firstSpace = this.viewer.scene.objects[spaceIds[0]];
            const currentlyVisible = firstSpace ? firstSpace.visible : true;
            
            // Переключаем видимость всех помещений
            this.viewer.scene.setObjectsVisible(spaceIds, !currentlyVisible);
            console.log(`Помещения ${!currentlyVisible ? 'показаны' : 'скрыты'}: ${spaceIds.length}`);
            
            return !currentlyVisible;
        }
        
        return false;
    },

    // Форсируем пересчёт размеров canvas/viewport (полезно после динамической перерисовки DOM)
    refreshViewport() {
        if (!this.viewer) {
            return;
        }

        try {
            if (typeof this.viewer.resize === 'function') {
                this.viewer.resize();
            }
        } catch (error) {
            console.warn('viewer.resize() failed:', error);
        }

        try {
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new Event('resize'));
            }
        } catch (error) {
            console.warn('Dispatch resize failed:', error);
        }
    },

    // Загрузка IFC модели напрямую (требует конвертации на backend)
    async loadIFC(url, modelId = 'ifc-model') {
        try {
            console.log('Прямая загрузка IFC не поддерживается');
            console.log('Используйте конвертацию IFC → XKT на backend');
            throw new Error('Конвертируйте IFC в XKT формат');
        } catch (error) {
            console.error('Ошибка загрузки IFC:', error);
            throw error;
        }
    },

    // Обработка клика по элементу
    handleElementClick(elementId) {
        if (!this.viewer?.scene) {
            return;
        }

        const sceneInput = this.viewer.scene.input;
        const keyDownMap = sceneInput?.keyDown || [];
        const isCtrlPressed = !!(
            sceneInput?.ctrlDown ||
            (sceneInput?.KEY_CTRL !== undefined && keyDownMap[sceneInput.KEY_CTRL]) ||
            (sceneInput?.KEY_LEFT_WINDOW !== undefined && keyDownMap[sceneInput.KEY_LEFT_WINDOW]) ||
            (sceneInput?.KEY_RIGHT_WINDOW !== undefined && keyDownMap[sceneInput.KEY_RIGHT_WINDOW])
        );
        const isShiftPressed = !!(
            sceneInput?.shiftDown ||
            (sceneInput?.KEY_SHIFT !== undefined && keyDownMap[sceneInput.KEY_SHIFT])
        );
        const isMultiSelect = isCtrlPressed || isShiftPressed;

        if (isMultiSelect) {
            // Ctrl/Shift + Click - множественный выбор
            const index = this.selectedElements.indexOf(elementId);
            if (index > -1) {
                // Убираем из выбора
                this.selectedElements.splice(index, 1);
                this.viewer.scene.setObjectsSelected([elementId], false);
            } else {
                // Добавляем в выбор
                this.selectedElements.push(elementId);
                this.viewer.scene.setObjectsSelected([elementId], true);
            }
        } else {
            // Обычный клик - одиночный выбор
            const currentlySelected = [...(this.viewer.scene.selectedObjectIds || [])];
            if (currentlySelected.length) {
                this.viewer.scene.setObjectsSelected(currentlySelected, false);
            }
            this.selectedElements = [elementId];
            this.viewer.scene.setObjectsSelected([elementId], true);
        }

        this.updateSelectionVisuals();

        console.log('Выбрано элементов:', this.selectedElements.length);

        // Получаем свойства элемента
        const entity = this.viewer.scene.objects[elementId];
        const properties = this.getElementProperties(entity);

        // Вызываем callback
        if (this.onElementSelected) {
            this.onElementSelected(elementId, this.selectedElements, properties);
        }
    },

    // Получение свойств элемента
    getElementProperties(entity) {
        if (!entity) return null;

        const metaObject = this.viewer.metaScene.metaObjects[entity.id];
        if (!metaObject) return null;

        let aabb = null;
        try {
            if (entity.aabb && entity.aabb.length === 6 && Number.isFinite(entity.aabb[0])) {
                aabb = Array.from(entity.aabb);
            } else if (this.viewer?.scene) {
                const computedAABB = this.viewer.scene.getAABB([entity.id]);
                if (computedAABB && computedAABB.length === 6) {
                    aabb = Array.from(computedAABB);
                }
            }
        } catch (error) {
            console.warn('Не удалось получить AABB для элемента', entity.id, error);
        }
        
        // Собираем все атрибуты из propertySets
        const attributes = { ...(metaObject.attributes || {}) };
        attributes['GlobalId'] = entity.id;
        attributes['GUID'] = entity.id;
        
        if (metaObject.propertySets) {
            metaObject.propertySets.forEach(pset => {
                if (pset.properties) {
                    pset.properties.forEach(prop => {
                        // Добавляем свойство напрямую для удобства поиска
                        attributes[prop.name] = prop.value;
                        // И с префиксом набора свойств для точности
                        attributes[`${pset.name}.${prop.name}`] = prop.value;
                    });
                }
            });
        }

        // Поиск этажа (IfcBuildingStorey) через родителей
        let current = metaObject;
        while (current) {
            if (current.type === 'IfcBuildingStorey') {
                attributes['Level'] = current.name;
                attributes['Storey'] = current.name;
                attributes['Этаж'] = current.name;
                break;
            }
            // metaObject.parent хранит ID родителя
            current = current.parent ? this.viewer.metaScene.metaObjects[current.parent] : null;
        }

        return {
            id: entity.id,
            name: metaObject.name || entity.id,
            type: metaObject.type || 'Unknown',
            attributes: attributes,
            // Геометрические свойства
            aabb,
            // Дополнительные свойства из IFC
            ifcType: metaObject.type,
            ifcGuid: entity.id,
        };
    },

    // Получить суммарный объем и площадь для списка элементов
    getElementsVolumeAndArea(elementIds) {
        let totalVolume = 0;
        let totalArea = 0;
        let totalLength = 0;

        if (!this.viewer || !elementIds || elementIds.length === 0) {
            return { volume: 0, area: 0, length: 0 };
        }

        elementIds.forEach(id => {
            const entity = this.viewer.scene.objects[id];
            if (!entity) return;

            // Попытка получить AABB
            let aabb = entity.aabb;
            if (!aabb || aabb.length < 6) {
                 try {
                     const computedAABB = this.viewer.scene.getAABB([id]);
                     if (computedAABB && computedAABB.length === 6) {
                         aabb = computedAABB;
                     }
                 } catch (e) {
                     console.warn('Failed to get AABB for', id);
                 }
            }

            if (aabb) {
                const length = Math.abs(aabb[3] - aabb[0]); // X axis
                const height = Math.abs(aabb[4] - aabb[1]); // Y axis
                const depth = Math.abs(aabb[5] - aabb[2]);  // Z axis

                // Логика должна совпадать с estimate.js computeElementDimensions
                const volume = length * height * depth;
                const area = length * depth; // Площадь проекции (как в estimate.js)
                
                totalVolume += volume;
                totalArea += area;
                totalLength += length;
            }
        });

        return {
            volume: parseFloat(totalVolume.toFixed(3)),
            area: parseFloat(totalArea.toFixed(3)),
            length: parseFloat(totalLength.toFixed(3))
        };
    },

    // Получить все ID объектов
    getAllObjectIds() {
        if (!this.viewer || !this.viewer.scene) return [];
        return Object.keys(this.viewer.scene.objects);
    },

    // Установить прозрачность для элементов
    setElementsOpacity(elementIds, opacity) {
        if (!this.viewer || !elementIds || elementIds.length === 0) return;
        this.viewer.scene.setObjectsOpacity(elementIds, opacity);
    },

    // Установить цвет для элементов
    setElementsColor(elementIds, color) {
        if (!this.viewer || !elementIds || elementIds.length === 0) return;
        this.viewer.scene.setObjectsColorized(elementIds, color);
    },

    // Получить выбранные элементы
    getSelectedElements() {
        return this.selectedElements;
    },

    // Очистить выбор
    clearSelection(notify = false) {
        if (!this.viewer?.scene) return;

        const selectedInScene = [...(this.viewer.scene.selectedObjectIds || [])];
        if (selectedInScene.length) {
            this.viewer.scene.setObjectsSelected(selectedInScene, false);
        }
        this.selectedElements = [];
        this.updateSelectionVisuals();

        if (notify && this.onElementSelected) {
            this.onElementSelected(null, [], null);
        }
    },

    updateSelectionVisuals() {
        if (!this.viewer) return;

        if (this.lastSelectedElements.length) {
            this.viewer.scene.setObjectsColorized(this.lastSelectedElements, null);
        }

        if (this.selectedElements.length) {
            this.viewer.scene.setObjectsColorized(this.selectedElements, this.selectionColor);
            this.viewer.scene.setObjectsOpacity(this.selectedElements, 1.0);
        }

        this.lastSelectedElements = [...this.selectedElements];
        this.applyPersistentHighlights();
    },

    // Подсветить элементы (для показа связанных ресурсов)
    highlightElements(elementIds, color = [0.1, 0.5, 1.0]) {
        if (!elementIds || elementIds.length === 0) return;
        
        this.viewer.scene.setObjectsColorized(elementIds, color);
        this.viewer.scene.setObjectsOpacity(elementIds, 1.0);
    },

    setPersistentHighlights(elementIds = [], color = [0.1, 0.5, 1.0]) {
        if (!this.viewer) return;

        if (this.persistentHighlightIds.size) {
            this.viewer.scene.setObjectsColorized(Array.from(this.persistentHighlightIds), null);
        }

        this.persistentHighlightIds = new Set(elementIds);
        this.persistentHighlightColor = color;
        this.applyPersistentHighlights();
    },

    applyPersistentHighlights() {
        if (!this.viewer) return;
        if (!this.persistentHighlightColor || this.persistentHighlightIds.size === 0) return;

        const ids = Array.from(this.persistentHighlightIds).filter(
            (id) => !this.selectedElements.includes(id)
        );

        if (ids.length === 0) {
            return;
        }

        this.viewer.scene.setObjectsColorized(ids, this.persistentHighlightColor);
        this.viewer.scene.setObjectsOpacity(ids, 1.0);
    },

    clearPersistentHighlights() {
        if (!this.viewer || this.persistentHighlightIds.size === 0) return;

        const ids = Array.from(this.persistentHighlightIds);
        this.viewer.scene.setObjectsColorized(ids, null);
        this.persistentHighlightIds.clear();
        this.persistentHighlightColor = null;
    },

    // Убрать подсветку
    unhighlightElements(elementIds) {
        if (!elementIds || elementIds.length === 0) return;
        
        this.viewer.scene.setObjectsColorized(elementIds, null);
        this.viewer.scene.setObjectsOpacity(elementIds, 1.0);
    },

    // Сбросить все цвета
    resetColors() {
        const allIds = Object.keys(this.viewer.scene.objects);
        this.viewer.scene.setObjectsColorized(allIds, null);
        this.viewer.scene.setObjectsOpacity(allIds, 1.0);
    },

    // Показать только выбранные элементы (изоляция)
    isolateElements(elementIds) {
        const allIds = Object.keys(this.viewer.scene.objects);
        this.viewer.scene.setObjectsVisible(allIds, false);
        this.viewer.scene.setObjectsVisible(elementIds, true);
    },

    // Показать все элементы
    showAllElements() {
        const allIds = Object.keys(this.viewer.scene.objects);
        this.viewer.scene.setObjectsVisible(allIds, true);
    },

    // Показать элементы
    showElements(elementIds) {
        if (!this.viewer || !elementIds || elementIds.length === 0) return;
        this.viewer.scene.setObjectsVisible(elementIds, true);
    },

    // Скрыть элементы
    hideElements(elementIds) {
        if (!this.viewer || !elementIds || elementIds.length === 0) return;
        this.viewer.scene.setObjectsVisible(elementIds, false);
    },

    // Zoom на элементы
    zoomToElements(elementIds) {
        if (!elementIds || elementIds.length === 0) return;
        
        this.viewer.cameraFlight.flyTo({
            aabb: this.viewer.scene.getAABB(elementIds),
            duration: 0.5
        });
    },

    // Fit to view (вся модель)
    fitToView() {
        this.viewer.cameraFlight.flyTo(this.viewer.scene);
    },

    zoom(delta = 5) {
        if (!this.viewer || !this.viewer.camera) {
            return;
        }

        try {
            this.viewer.camera.zoom(delta);
        } catch (error) {
            console.error('Ошибка масштабирования камеры:', error);
        }
    },

    zoomIn() {
        this.zoom(-5);
    },

    zoomOut() {
        this.zoom(5);
    },

    // Получить количество элементов
    getElementCount() {
        return Object.keys(this.viewer.scene.objects).length;
    },

    // Получить все элементы определённого типа
    getElementsByType(ifcType) {
        const metaObjects = this.viewer.metaScene.metaObjects;
        const elementIds = [];
        
        for (const id in metaObjects) {
            const metaObject = metaObjects[id];
            if (metaObject.type === ifcType) {
                elementIds.push(id);
            }
        }
        
        return elementIds;
    },

    // Режимы отображения
    setDisplayMode(mode) {
        if (!this.viewer) {
            return;
        }

        const normalizedMode = mode === 'textured' ? 'default' : mode;
        this.displayMode = normalizedMode;
        const allIds = Object.keys(this.viewer.scene.objects);
        this.viewer.scene.setObjectsXRayed(allIds, false);
        
        switch (normalizedMode) {
            case 'transparent':
                this.viewer.scene.setObjectsOpacity(allIds, 0.3);
                this.viewer.scene.setObjectsColorized(allIds, null);
                break;
            
            case 'monochrome':
                this.viewer.scene.setObjectsOpacity(allIds, 1.0);
                this.viewer.scene.setObjectsColorized(allIds, [0.8, 0.8, 0.8]);
                break;
            
            case 'xray':
                this.viewer.scene.setObjectsOpacity(allIds, 0.5);
                this.viewer.scene.setObjectsXRayed(allIds, true);
                break;
            
            case 'default':
            default:
                this.viewer.scene.setObjectsOpacity(allIds, 1.0);
                this.viewer.scene.setObjectsColorized(allIds, null);
                this.viewer.scene.setObjectsXRayed(allIds, false);
                break;
        }
    },

    // Уничтожить viewer
    destroy() {
        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
        }
        this.selectedElements = [];
        this.lastSelectedElements = [];
        this.currentModel = null;
        this.displayMode = 'default';
        this.persistentHighlightIds.clear();
        this.persistentHighlightColor = null;
    }
};
