// ========================================
// IFC Viewer Module - интеграция xeokit
// ========================================

const XEOKIT_READY_EVENT = 'xeokit:ready';

const IFCViewerManager = {
    viewer: null,
    xktLoader: null,
    navCube: null,
    groundGrid: null,
    sectionPlanes: null,
    sectionPlaneId: 'ifc-section-plane',
    sectionCutEnabled: false,
    distanceMeasurements: null,
    distanceMeasurementsControl: null,
    distanceMeasureEnabled: false,
    currentModel: null,
    selectedElements: [],
    lastSelectedElements: [],
    onElementSelected: null,
    sdkReadyPromise: null,
    displayMode: 'default',
    selectionColor: [0.97, 0.58, 0.15],
    persistentHighlightIds: new Set(),
    persistentHighlightColor: null,

    // Idle auto-rotate (когда нет выбранных элементов)
    autoRotateEnabled: true,
    autoRotateIdleDelayMs: 2500,
    autoRotateSpeedDegPerSec: 10,
    lastInteractionTs: 0,
    _autoRotateRafId: null,
    _autoRotateLastFrameTs: 0,

    // Ground grid (как в 3D программах)
    groundGridEnabled: true,
    groundGridOpacity: 0.35,
    groundGridColor: null,

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
                // Прозрачный канвас, чтобы фон задавался CSS-градиентом.
                transparent: true,
                saoEnabled: true, // Ambient occlusion
                pbrEnabled: false, // Physically-based rendering
                dtxEnabled: false, // Double-sided triangles
            });

            // Любое взаимодействие с канвасом должно сразу останавливать auto-rotate
            // и сбрасывать таймер бездействия.
            this.markInteraction();
            const interactionEvents = ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'mousedown'];
            interactionEvents.forEach((evt) => {
                canvasElement.addEventListener(
                    evt,
                    () => {
                        this.markInteraction();
                    },
                    { passive: true }
                );
            });

            // Важно для ноутбуков/тачпадов: pinch-zoom часто приходит как Ctrl+Wheel,
            // из-за чего браузер зумит страницу. Когда курсор над 3D-окном, глушим
            // дефолтный зум/скролл страницы, оставляя xeokit управление камерой.
            canvasElement.addEventListener(
                'wheel',
                (e) => {
                    this.markInteraction();

                    // Ctrl+wheel / Meta+wheel = браузерный zoom (тачпад pinch) — блокируем
                    // Также блокируем прокрутку страницы при wheel над канвасом.
                    try {
                        e.preventDefault();
                    } catch (err) {
                        // ignore
                    }
                },
                { passive: false }
            );

            // Safari/iOS gesture events (не мешают на Windows, просто на всякий случай)
            const preventGesture = (e) => {
                this.markInteraction();
                try {
                    e.preventDefault();
                } catch (err) {
                    // ignore
                }
            };
            canvasElement.addEventListener('gesturestart', preventGesture, { passive: false });
            canvasElement.addEventListener('gesturechange', preventGesture, { passive: false });
            canvasElement.addEventListener('gestureend', preventGesture, { passive: false });

            // Настройка камеры
            this.viewer.camera.eye = [1841982.93, 10.03, -5173303.73];
            this.viewer.camera.look = [1842011.49, 10.03, -5173299.85];
            this.viewer.camera.up = [0, 1, 0];

            // XKT Loader Plugin
            this.xktLoader = new xeokitSdk.XKTLoaderPlugin(this.viewer);

            // Distance measurements (замеры)
            if (typeof xeokitSdk.DistanceMeasurementsPlugin === 'function') {
                try {
                    this.distanceMeasurements = new xeokitSdk.DistanceMeasurementsPlugin(this.viewer);
                } catch (e) {
                    console.warn('⚠️ Не удалось инициализировать DistanceMeasurementsPlugin:', e);
                    this.distanceMeasurements = null;
                }
            }

            if (this.distanceMeasurements && typeof xeokitSdk.DistanceMeasurementsMouseControl === 'function') {
                try {
                    this.distanceMeasurementsControl = new xeokitSdk.DistanceMeasurementsMouseControl(this.distanceMeasurements, {
                        snapping: true
                    });
                } catch (e) {
                    console.warn('⚠️ Не удалось инициализировать DistanceMeasurementsMouseControl:', e);
                    this.distanceMeasurementsControl = null;
                }
            }

            // Section planes (разрез)
            if (typeof xeokitSdk.SectionPlanesPlugin === 'function') {
                try {
                    this.sectionPlanes = new xeokitSdk.SectionPlanesPlugin(this.viewer, {
                        // Без overview canvas - только 3D gizmo control
                    });
                } catch (e) {
                    console.warn('⚠️ Не удалось инициализировать SectionPlanesPlugin:', e);
                    this.sectionPlanes = null;
                }
            }

            // Navigation Cube (Top/Bottom/Left/Right etc.)
            // Canvas создаётся в шаблоне сметы (estimate.js) внутри панели 3D.
            const navCubeCanvas = document.getElementById('ifc-navcube-canvas');
            if (navCubeCanvas && typeof xeokitSdk.NavCubePlugin === 'function') {
                try {
                    const themeValue = (name, fallback) => {
                        try {
                            const v = getComputedStyle(document.documentElement).getPropertyValue(name);
                            return (v || '').trim() || fallback;
                        } catch (e) {
                            return fallback;
                        }
                    };

                    const navTop = themeValue('--accent-blue', '#0078D4');
                    const navBottom = themeValue('--primary', '#207345');
                    const navLeft = themeValue('--accent-red', '#D13438');
                    const navRight = themeValue('--accent-green', '#107C10');
                    const navFront = themeValue('--gray-300', '#E1DFDD');
                    const navBack = themeValue('--gray-500', '#C8C6C4');
                    const navText = themeValue('--gray-900', '#201F1E');

                    this.navCube = new xeokitSdk.NavCubePlugin(this.viewer, {
                        canvasId: 'ifc-navcube-canvas',
                        cameraFly: true,
                        cameraFlyDuration: 0.5,
                        synchProjection: true,
                        topColor: navTop,
                        bottomColor: navBottom,
                        leftColor: navLeft,
                        rightColor: navRight,
                        frontColor: navFront,
                        backColor: navBack,
                        textColor: navText
                    });
                } catch (e) {
                    console.warn('⚠️ Не удалось инициализировать NavCubePlugin:', e);
                    this.navCube = null;
                }
            }

            // Обработчик клавиши Tab для выбора похожих элементов
            if (typeof window !== 'undefined') {
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault(); // Предотвращаем смену фокуса браузера
                        this.handleTabSelection();
                    }
                });
            }

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

                    // Режим замера: управление кликами берёт на себя DistanceMeasurementsMouseControl.
                    // Здесь ничего не делаем, чтобы не мешать.
                    if (this.distanceMeasureEnabled) {
                        return;
                    }

                    // Режим разреза: клик по поверхности задаёт/переориентирует плоскость,
                    // и не должен триггерить выделение.
                    if (this.sectionCutEnabled && this.sectionPlanes) {
                        if (pickResult?.worldPos && pickResult?.worldNormal) {
                            this.applySectionCutFromSurfacePick(pickResult);
                        }
                        return;
                    }

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

            // Запускаем loop для авто-вращения (он сам решит, крутить или нет)
            this.ensureAutoRotateLoop();

            console.log('✅ IFC Viewer инициализирован');
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации xeokit viewer:', error);
            return false;
        }
    },

    toggleSectionCut() {
        if (!this.viewer || !this.sectionPlanes) {
            return false;
        }

        try {
            // выключаем
            if (this.sectionCutEnabled) {
                if (typeof this.sectionPlanes.hideControl === 'function') {
                    this.sectionPlanes.hideControl();
                }
                if (typeof this.sectionPlanes.destroySectionPlane === 'function') {
                    this.sectionPlanes.destroySectionPlane(this.sectionPlaneId);
                }
                this.sectionCutEnabled = false;
                this.markInteraction();
                return false;
            }

            // включаем
            const aabb = this.currentModel?.aabb || this.viewer.scene?.aabb || this.viewer.scene?.getAABB?.();
            if (!aabb || aabb.length < 6) {
                console.warn('⚠️ Разрез: AABB недоступен (модель ещё не загружена)');
                return false;
            }

            const centerX = (aabb[0] + aabb[3]) / 2;
            const centerY = (aabb[1] + aabb[4]) / 2;
            const centerZ = (aabb[2] + aabb[5]) / 2;

            // Плоскость по умолчанию: горизонтальная (режем по Y), через центр модели
            // dir = нормаль плоскости
            if (typeof this.sectionPlanes.createSectionPlane === 'function') {
                this.sectionPlanes.createSectionPlane({
                    id: this.sectionPlaneId,
                    pos: [centerX, centerY, centerZ],
                    dir: [0, -1, 0]
                });
            }

            if (typeof this.sectionPlanes.showControl === 'function') {
                this.sectionPlanes.showControl(this.sectionPlaneId);
            }

            this.sectionCutEnabled = true;
            this.markInteraction();
            return true;
        } catch (e) {
            console.error('❌ Ошибка включения разреза:', e);
            return this.sectionCutEnabled;
        }
    },

    toggleDistanceMeasure() {
        if (!this.viewer || !this.distanceMeasurementsControl) {
            return false;
        }

        try {
            if (this.distanceMeasureEnabled) {
                if (typeof this.distanceMeasurementsControl.deactivate === 'function') {
                    this.distanceMeasurementsControl.deactivate();
                }

                // По повторному нажатию: выключаем режим и очищаем все размеры с экрана.
                if (this.distanceMeasurements) {
                    if (typeof this.distanceMeasurements.clear === 'function') {
                        this.distanceMeasurements.clear();
                    } else if (typeof this.distanceMeasurements.destroyMeasurement === 'function' && this.distanceMeasurements.measurements) {
                        Object.keys(this.distanceMeasurements.measurements).forEach((id) => {
                            try {
                                this.distanceMeasurements.destroyMeasurement(id);
                            } catch (e) {
                                // ignore
                            }
                        });
                    }
                }

                this.distanceMeasureEnabled = false;
                this.markInteraction();
                return false;
            }

            // Включаем режим замера: он сам обрабатывает 2 клика и рисует размер.
            if (typeof this.distanceMeasurementsControl.activate === 'function') {
                this.distanceMeasurementsControl.activate();
            }
            this.distanceMeasureEnabled = true;
            this.markInteraction();
            return true;
        } catch (e) {
            console.error('❌ Ошибка переключения режима замера:', e);
            return this.distanceMeasureEnabled;
        }
    },

    applySectionCutFromSurfacePick(pickResult) {
        if (!this.viewer || !this.sectionPlanes || !this.sectionCutEnabled) {
            return false;
        }

        const worldPos = pickResult?.worldPos;
        const worldNormal = pickResult?.worldNormal;
        if (!worldPos || !worldNormal || worldPos.length < 3 || worldNormal.length < 3) {
            return false;
        }

        const pos = [worldPos[0], worldPos[1], worldPos[2]];
        let dir = [worldNormal[0], worldNormal[1], worldNormal[2]];

        const len = Math.hypot(dir[0], dir[1], dir[2]);
        if (!Number.isFinite(len) || len <= 0) {
            return false;
        }
        dir = [dir[0] / len, dir[1] / len, dir[2] / len];

        // Стараемся сделать направление плоскости «к камере», чтобы поведение было предсказуемым.
        // (Если окажется, что режется “не та сторона” — можно будет инвертировать логику.)
        try {
            const eye = this.viewer.camera?.eye;
            if (eye && eye.length >= 3) {
                const toEye = [eye[0] - pos[0], eye[1] - pos[1], eye[2] - pos[2]];
                const dot = dir[0] * toEye[0] + dir[1] * toEye[1] + dir[2] * toEye[2];
                if (dot < 0) {
                    dir = [-dir[0], -dir[1], -dir[2]];
                }
            }
        } catch (e) {
            // ignore
        }

        try {
            if (typeof this.sectionPlanes.destroySectionPlane === 'function') {
                this.sectionPlanes.destroySectionPlane(this.sectionPlaneId);
            }

            if (typeof this.sectionPlanes.createSectionPlane === 'function') {
                this.sectionPlanes.createSectionPlane({
                    id: this.sectionPlaneId,
                    pos,
                    dir
                });
            }

            if (typeof this.sectionPlanes.showControl === 'function') {
                this.sectionPlanes.showControl(this.sectionPlaneId);
            }

            this.markInteraction();
            return true;
        } catch (e) {
            console.error('❌ Ошибка позиционирования разреза по грани:', e);
            return false;
        }
    },

    _parseCssColorToRgb01(color) {
        if (!color || typeof color !== 'string') {
            return null;
        }

        const c = color.trim();
        if (!c) {
            return null;
        }

        if (c[0] === '#' && (c.length === 7 || c.length === 4)) {
            const hex = c.length === 7
                ? c.slice(1)
                : (c[1] + c[1] + c[2] + c[2] + c[3] + c[3]);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            if ([r, g, b].some((v) => Number.isNaN(v))) {
                return null;
            }
            return [r / 255, g / 255, b / 255];
        }

        const m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (m) {
            const r = Number(m[1]);
            const g = Number(m[2]);
            const b = Number(m[3]);
            if ([r, g, b].some((v) => !Number.isFinite(v))) {
                return null;
            }
            return [
                Math.max(0, Math.min(1, r / 255)),
                Math.max(0, Math.min(1, g / 255)),
                Math.max(0, Math.min(1, b / 255))
            ];
        }

        return null;
    },

    _getGroundGridColorRgb01() {
        if (Array.isArray(this.groundGridColor) && this.groundGridColor.length === 3) {
            return this.groundGridColor;
        }

        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue('--gray-400');
            const parsed = this._parseCssColorToRgb01((v || '').trim() || '#B3B0AD');
            return parsed || [0.7, 0.7, 0.7];
        } catch (e) {
            return [0.7, 0.7, 0.7];
        }
    },

    ensureGroundGrid() {
        if (!this.groundGridEnabled || !this.viewer) {
            return;
        }

        const xeokitSdk = (typeof window !== 'undefined' && window.xeokit) ? window.xeokit : null;
        if (!xeokitSdk || typeof xeokitSdk.LineSet !== 'function' || typeof xeokitSdk.buildGridGeometry !== 'function') {
            return;
        }

        // Пересоздаём grid, чтобы он подстраивался под размеры/положение модели
        if (this.groundGrid && typeof this.groundGrid.destroy === 'function') {
            try {
                this.groundGrid.destroy();
            } catch (e) {
                // ignore
            }
            this.groundGrid = null;
        }

        const aabb = this.currentModel?.aabb || this.viewer.scene?.getAABB?.();
        if (!aabb || aabb.length < 6) {
            return;
        }

        const sizeX = Math.abs(aabb[3] - aabb[0]);
        const sizeZ = Math.abs(aabb[5] - aabb[2]);
        const baseSize = Math.max(sizeX, sizeZ);
        const gridSize = Math.max(20, (Number.isFinite(baseSize) && baseSize > 0 ? baseSize * 2 : 100));
        const divisions = Math.min(80, Math.max(10, Math.round(gridSize / 3)));

        const centerX = (aabb[0] + aabb[3]) / 2;
        const centerZ = (aabb[2] + aabb[5]) / 2;

        // "Нулевая отметка" берётся как низ модели (AABB minY), слегка приподнимаем, чтобы не мерцала
        const gridY = (Number.isFinite(aabb[1]) ? aabb[1] : 0) + 0.001;

        const geometryArrays = xeokitSdk.buildGridGeometry({
            size: gridSize,
            divisions
        });

        const srcPositions = geometryArrays.positions || [];
        const positions = new Float32Array(srcPositions.length);
        for (let i = 0; i < srcPositions.length; i += 3) {
            positions[i] = srcPositions[i] + centerX;
            positions[i + 1] = srcPositions[i + 1] + gridY;
            positions[i + 2] = srcPositions[i + 2] + centerZ;
        }

        const color = this._getGroundGridColorRgb01();

        this.groundGrid = new xeokitSdk.LineSet(this.viewer.scene, {
            id: 'ifc-ground-grid',
            positions,
            indices: geometryArrays.indices,
            color,
            opacity: this.groundGridOpacity,
            visible: true,
            collidable: false,
            clippable: false
        });
    },

    markInteraction() {
        this.lastInteractionTs = Date.now();
    },

    ensureAutoRotateLoop() {
        if (!this.autoRotateEnabled) {
            return;
        }
        if (this._autoRotateRafId) {
            return;
        }

        this._autoRotateLastFrameTs = 0;
        const tick = (ts) => {
            // Stop conditions
            if (!this.viewer || !this.autoRotateEnabled) {
                this._autoRotateRafId = null;
                this._autoRotateLastFrameTs = 0;
                return;
            }

            if (!this._autoRotateLastFrameTs) {
                this._autoRotateLastFrameTs = ts;
            }
            const dtMs = Math.min(100, Math.max(0, ts - this._autoRotateLastFrameTs));
            this._autoRotateLastFrameTs = ts;

            const isIdle = Date.now() - (this.lastInteractionTs || 0) >= this.autoRotateIdleDelayMs;
            const hasSelection = Array.isArray(this.selectedElements) && this.selectedElements.length > 0;
            const hasModel = !!this.currentModel;

            // Grid показываем только в перспективе (если камера сообщает тип проекции)
            if (this.groundGrid) {
                const proj = this.viewer?.camera?.projection;
                const isPerspective = !proj || proj === 'perspective';
                try {
                    this.groundGrid.visible = isPerspective;
                } catch (e) {
                    // ignore
                }
            }

            if (isIdle && !hasSelection && hasModel) {
                // Вращаем камеру вокруг look/pivot. Это визуально выглядит как вращение модели вокруг оси.
                const yawFn = this.viewer.camera?.orbitYaw || this.viewer.camera?.orbitYaw === 0 ? this.viewer.camera.orbitYaw : null;
                if (typeof this.viewer.camera?.orbitYaw === 'function') {
                    const yawDeg = (this.autoRotateSpeedDegPerSec * dtMs) / 1000;
                    try {
                        this.viewer.camera.orbitYaw(-yawDeg);
                    } catch (e) {
                        // Если orbitYaw недоступен в конкретной сборке, просто отключим автоповорот.
                        console.warn('⚠️ auto-rotate выключен: viewer.camera.orbitYaw failed', e);
                        this.autoRotateEnabled = false;
                    }
                } else if (typeof this.viewer.camera?.yaw === 'function') {
                    // Fallback на yaw(), если он есть
                    const yawDeg = (this.autoRotateSpeedDegPerSec * dtMs) / 1000;
                    try {
                        this.viewer.camera.yaw(-yawDeg);
                    } catch (e) {
                        console.warn('⚠️ auto-rotate выключен: viewer.camera.yaw failed', e);
                        this.autoRotateEnabled = false;
                    }
                }
            }

            this._autoRotateRafId = requestAnimationFrame(tick);
        };

        this._autoRotateRafId = requestAnimationFrame(tick);
    },

    // Загрузка XKT модели
    async loadXKT(url, modelId = 'model', onProgress = null) {
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

            // Отслеживание прогресса загрузки
            let lastProgress = 0;
            const progressInterval = setInterval(() => {
                // Симулируем прогресс от 0 до 90% до полной загрузки
                if (lastProgress < 90) {
                    lastProgress += Math.random() * 15;
                    if (lastProgress > 90) lastProgress = 90;
                    if (onProgress) onProgress(lastProgress);
                }
            }, 200);

            this.currentModel.on("loaded", () => {
                clearInterval(progressInterval);
                if (onProgress) onProgress(100);

                console.log('✓ XKT модель загружена');
                this.viewer.cameraFlight.flyTo(this.viewer.scene);

                // Сетка по земле (появляется в перспективе)
                this.ensureGroundGrid();

                this.setDisplayMode(this.displayMode || 'default');

                // Автоматически скрываем помещения (IfcSpace) при загрузке
                this.hideSpaces();

                this.refreshViewport();

                // После автопозиционирования даём пользователю паузу, затем (если нет выделения)
                // модель начнёт плавно вращаться.
                this.markInteraction();
                this.ensureAutoRotateLoop();
            });

            this.currentModel.on("error", (error) => {
                clearInterval(progressInterval);
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

        // Любое выделение — это активность пользователя, авто-вращение должно остановиться.
        this.markInteraction();

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

        this.markInteraction();

        const selectedInScene = [...(this.viewer.scene.selectedObjectIds || [])];
        if (selectedInScene.length) {
            this.viewer.scene.setObjectsSelected(selectedInScene, false);
        }
        this.selectedElements = [];
        this.updateSelectionVisuals();

        if (notify && this.onElementSelected) {
            this.onElementSelected(null, [], null);
        }

        // Включаем loop обратно (если был остановлен) — крутиться начнет только после idleDelay
        this.ensureAutoRotateLoop();
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

    // Обработка нажатия Tab для выбора похожих элементов
    handleTabSelection() {
        if (!this.viewer || this.selectedElements.length === 0) {
            return;
        }

        // Берем последний выбранный элемент как образец
        const lastSelectedId = this.selectedElements[this.selectedElements.length - 1];
        const metaObject = this.viewer.metaScene.metaObjects[lastSelectedId];

        if (!metaObject) {
            console.warn('Metadata not found for element:', lastSelectedId);
            return;
        }

        const targetType = metaObject.type;
        let targetNamePrefix = metaObject.name;

        // Эвристика для Revit: имя часто содержит ID в конце (например "Family:Type:12345")
        // Попробуем найти общую часть имени, чтобы выделить всё семейство/тип
        if (targetNamePrefix && targetNamePrefix.includes(':')) {
            // Отбрасываем последнюю часть после двоеточия, считая её ID экземпляра
            const lastColonIndex = targetNamePrefix.lastIndexOf(':');
            if (lastColonIndex > 0) {
                targetNamePrefix = targetNamePrefix.substring(0, lastColonIndex);
            }
        }

        console.log(`Tab pressed. Type: ${targetType}, Name Prefix: ${targetNamePrefix}`);

        // Находим все элементы того же типа и с похожим именем
        const metaObjects = this.viewer.metaScene.metaObjects;
        const similarElementIds = [];

        for (const id in metaObjects) {
            const obj = metaObjects[id];
            // Обязательно совпадение по типу IFC
            if (obj.type !== targetType) continue;

            // Если у образца есть имя, требуем совпадения начала имени
            if (targetNamePrefix) {
                if (obj.name && obj.name.startsWith(targetNamePrefix)) {
                    similarElementIds.push(id);
                }
            } else {
                // Если имени нет, берем все элементы этого типа (fallback)
                similarElementIds.push(id);
            }
        }

        if (similarElementIds.length > 0) {
            // Очищаем текущий выбор, чтобы показать группу
            this.clearSelection(false);

            // Выделяем все найденные
            this.selectedElements = similarElementIds;
            this.viewer.scene.setObjectsSelected(similarElementIds, true);
            this.updateSelectionVisuals();

            UI.showNotification(`Выбрано ${similarElementIds.length} элементов типа ${targetType} (семейство: ${targetNamePrefix || 'Все'})`, 'info');

            // Вызываем callback для обновления UI (свойств и т.д.)
            if (this.onElementSelected) {
                // Передаем первый элемент как "активный" для свойств, но список всех выбранных
                const firstEntity = this.viewer.scene.objects[similarElementIds[0]];
                const properties = this.getElementProperties(firstEntity);
                this.onElementSelected(similarElementIds[0], similarElementIds, properties);
            }
        }
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
        if (this.distanceMeasurementsControl && typeof this.distanceMeasurementsControl.deactivate === 'function') {
            try {
                this.distanceMeasurementsControl.deactivate();
            } catch (e) {
                // ignore
            }
        }
        if (this.distanceMeasurementsControl && typeof this.distanceMeasurementsControl.destroy === 'function') {
            try {
                this.distanceMeasurementsControl.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.distanceMeasurementsControl = null;
        this.distanceMeasureEnabled = false;

        if (this.distanceMeasurements && typeof this.distanceMeasurements.destroy === 'function') {
            try {
                this.distanceMeasurements.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.distanceMeasurements = null;

        if (this.sectionPlanes && typeof this.sectionPlanes.destroy === 'function') {
            try {
                this.sectionPlanes.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.sectionPlanes = null;
        this.sectionCutEnabled = false;

        if (this.groundGrid && typeof this.groundGrid.destroy === 'function') {
            try {
                this.groundGrid.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.groundGrid = null;

        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
        }
        if (this.navCube && typeof this.navCube.destroy === 'function') {
            try {
                this.navCube.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.navCube = null;

        if (this._autoRotateRafId) {
            try {
                cancelAnimationFrame(this._autoRotateRafId);
            } catch (e) {
                // ignore
            }
        }
        this._autoRotateRafId = null;
        this._autoRotateLastFrameTs = 0;
        this.lastInteractionTs = 0;

        this.selectedElements = [];
        this.lastSelectedElements = [];
        this.currentModel = null;
        this.displayMode = 'default';
        this.persistentHighlightIds.clear();
        this.persistentHighlightColor = null;
    }
};
