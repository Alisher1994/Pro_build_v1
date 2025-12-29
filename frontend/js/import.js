// ========================================
// Import Module - Импорт файлов Excel/CSV
// ========================================

const ImportManager = {
    currentStep: 1,
    selectedFile: null,
    parsedData: [],
    documentType: null,
    estimateId: null,
    sectionId: null,
    hadSectionAtStart: false,

    // Подгружаем XLSX с CDN, если по какой-то причине глобал не инициализировался
    async ensureXLSXLoaded() {
        if (typeof window !== 'undefined' && window.XLSX) return;

        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-import="xlsx"]');

            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('Не удалось загрузить библиотеку XLSX')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.async = true;
            script.dataset.import = 'xlsx';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Не удалось загрузить библиотеку XLSX'));
            document.head.appendChild(script);
        });

        if (!window.XLSX) {
            throw new Error('Библиотека XLSX недоступна после загрузки');
        }
    },

    mapResourceType(value) {
        const raw = (value ?? '').toString().trim();
        if (!raw) return 'material';
        const normalized = raw.toLowerCase();

        if (['material', 'labor', 'equipment'].includes(normalized)) return normalized;

        if (normalized.includes('мат')) return 'material';
        if (normalized.includes('обор') || normalized.includes('маш')) return 'equipment';
        if (normalized.includes('труд') || normalized.includes('работ') || normalized.includes('чел')) return 'labor';

        return 'material';
    },

    parseNumber(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') {
            return isNaN(value) ? '' : value;
        }

        const normalized = String(value)
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, '')
            .replace(',', '.');

        const num = parseFloat(normalized);
        return isNaN(num) ? '' : num;
    },

    normalizeUnit(unit = '') {
        const u = String(unit || '').trim().toUpperCase();
        if (u.includes('МАШ-Ч') || u.includes('МАШ.Ч') || u.includes('МАШ. Ч')) return 'МАШ.-Ч';
        if (u.includes('ЧЕЛ-Ч') || u.includes('ЧЕЛ.Ч') || u.includes('ЧЕЛ. Ч')) return 'ЧЕЛ.-Ч';
        return unit;
    },

    detectResourceType(name = '', code = '', unit = '') {
        const u = String(unit || '').toUpperCase();
        if (u === 'ЧЕЛ.-Ч') return 'labor';
        if (u === 'МАШ.-Ч') return 'equipment';

        const source = `${name} ${code}`.toLowerCase();
        if (source.includes('затраты труда') || source.includes('рабоч')) return 'labor';
        if (source.includes('машинист') || source.includes('маш.') || source.includes('кран') || source.includes('оборуд')) return 'equipment';
        if (source.includes('автомобил') || source.includes('транспорт')) return 'equipment';
        return 'material';
    },

    // Показать модальное окно импорта
    showImportModal() {
        // Проверяем наличие хотя бы сметы
        if (!EstimateManager.currentEstimateId) {
            alert('Пожалуйста, откройте смету для импорта данных');
            return;
        }

        this.estimateId = EstimateManager.currentEstimateId;
        this.sectionId = EstimateManager?.currentSectionId || window.currentSectionId; // Может быть null, проверим позже
        this.hadSectionAtStart = !!this.sectionId;
        this.currentStep = 1;
        this.selectedFile = null;
        this.parsedData = [];
        this.documentType = null;

        const modalHTML = `
            <div class="modal-overlay" id="import-modal-overlay">
                <div class="modal import-modal">
                    <div class="modal-header">
                        <h3>Импорт данных из файла</h3>
                        <button class="modal-close" onclick="ImportManager.closeModal()">&times;</button>
                    </div>
                    
                    <!-- Steps Indicator -->
                    <div class="import-steps">
                        <div class="step-item active" data-step="1">
                            <div class="step-number">1</div>
                            <div class="step-label">Выбор типа</div>
                        </div>
                        <div class="step-connector"></div>
                        <div class="step-item" data-step="2">
                            <div class="step-number">2</div>
                            <div class="step-label">Форматирование</div>
                        </div>
                        <div class="step-connector"></div>
                        <div class="step-item" data-step="3">
                            <div class="step-number">3</div>
                            <div class="step-label">Импорт</div>
                        </div>
                    </div>
                    
                    <div class="modal-body">
                        <div id="import-step-content">
                            ${this.renderStep1()}
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="ImportManager.closeModal()">Отмена</button>
                        <div class="footer-actions">
                            <button class="btn btn-secondary" id="import-prev-btn" onclick="ImportManager.previousStep()" style="display: none;">Назад</button>
                            <button class="btn btn-primary" id="import-next-btn" onclick="ImportManager.nextStep()">Далее</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.getElementById('modal-container');
        container.innerHTML = modalHTML;

        // Close on overlay click
        document.getElementById('import-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'import-modal-overlay') {
                this.closeModal();
            }
        });

        // Setup drag and drop
        setTimeout(() => this.setupDragAndDrop(), 100);
    },

    // Закрыть модальное окно
    closeModal() {
        const container = document.getElementById('modal-container');
        container.innerHTML = '';
    },

    // Рендер Шаг 1: Выбор типа документа и загрузка файла
    renderStep1() {
        return `
            <div class="import-step-1">
                <h4>Выберите тип документа и загрузите файл</h4>
                
                <div class="document-types">
                    <div class="document-type-card" onclick="ImportManager.selectDocumentType(1)">
                        <input type="radio" name="doc-type" id="doc-type-1" value="1">
                        <label for="doc-type-1">
                            <div class="card-header">Тип 1: Упрощенный</div>
                            <div class="card-content">
                                <div class="column-list">
                                    <div class="column-item">№</div>
                                    <div class="column-item">Тип ресурса</div>
                                    <div class="column-item">Название</div>
                                    <div class="column-item">Ед.изм</div>
                                    <div class="column-item">Кол-во</div>
                                    <div class="column-item">Цена</div>
                                    <div class="column-item">Сумма (авто)</div>
                                </div>
                            </div>
                        </label>
                    </div>
                    
                    <div class="document-type-card" onclick="ImportManager.selectDocumentType(2)">
                        <input type="radio" name="doc-type" id="doc-type-2" value="2">
                        <label for="doc-type-2">
                            <div class="card-header">Тип 2: Нормативная форма (шифр)</div>
                            <div class="card-content">
                                <div class="column-list">
                                    <div class="column-item">№</div>
                                    <div class="column-item">Код ресурса</div>
                                    <div class="column-item">Название</div>
                                    <div class="column-item">Ед.изм</div>
                                    <div class="column-item">Норма на ед.</div>
                                    <div class="column-item">Кол-во по проекту</div>
                                    <div class="column-item">Цена (опц.)</div>
                                    <div class="column-item">Сумма (авто)</div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="file-upload-section" id="file-upload-section" style="display: none;">
                    <h4>Загрузите файл</h4>
                    <div class="file-upload-area" id="file-upload-area">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p>Перетащите файл сюда или <span class="upload-link" onclick="document.getElementById('file-input').click()">выберите файл</span></p>
                        <p class="file-format-hint">Поддерживаемые форматы: XLS, XLSX, CSV</p>
                        <input type="file" id="file-input" accept=".xls,.xlsx,.csv" style="display: none;" onchange="ImportManager.handleFileSelect(event)">
                    </div>
                    <div id="file-info" class="file-info" style="display: none;">
                        <div class="file-icon">📄</div>
                        <div class="file-details">
                            <div class="file-name" id="file-name"></div>
                            <div class="file-size" id="file-size"></div>
                        </div>
                        <button class="btn-icon" onclick="ImportManager.removeFile()" title="Удалить файл">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="import-info">
                    <h5>Как определяются элементы:</h5>
                    <ul>
                        <li><strong>Этап:</strong> Определяется по объединенным ячейкам или строки без номера</li>
                        <li><strong>Вид работ:</strong> Строки с целым числом в первой колонке (1, 2, 3...)</li>
                        <li><strong>Ресурсы:</strong> Строки с номером через точку (1.1, 1.2, 2.1...) или начинающиеся с точки (.1, .2...)</li>
                    </ul>
                    <p style="margin-top: 12px; font-size: 12px; color: var(--gray-600);">
                        <strong>Подсказка:</strong> Подготовьте файл согласно выбранному типу. После загрузки вы сможете проверить и отредактировать данные перед импортом.
                    </p>
                </div>
            </div>
        `;
    },

    // Выбор типа документа
    selectDocumentType(type) {
        this.documentType = type;
        document.getElementById('doc-type-' + type).checked = true;
        document.getElementById('file-upload-section').style.display = 'block';

        // Обновляем кнопку "Далее"
        this.updateNavigationButtons();
    },

    // Обработка выбора файла
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const validExtensions = ['xls', 'xlsx', 'csv'];
        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (!validExtensions.includes(fileExtension)) {
            alert('Пожалуйста, выберите файл формата XLS, XLSX или CSV');
            return;
        }

        this.selectedFile = file;

        // Показываем информацию о файле
        document.getElementById('file-upload-area').style.display = 'none';
        document.getElementById('file-info').style.display = 'flex';
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = this.formatFileSize(file.size);

        this.updateNavigationButtons();
    },

    // Удалить файл
    removeFile() {
        this.selectedFile = null;
        document.getElementById('file-upload-area').style.display = 'flex';
        document.getElementById('file-info').style.display = 'none';
        document.getElementById('file-input').value = '';
        this.updateNavigationButtons();
    },

    // Форматирование размера файла
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    // Рендер Шаг 2: Форматирование данных
    renderStep2() {
        const stats = this.getDataStats();

        return `
            <div class="import-step-2">
                <div class="step2-header">
                    <h4>Проверьте и отредактируйте данные</h4>
                    <div class="stats-badge">
                        <span class="stat-item"><strong>${stats.stages}</strong> этапов</span>
                        <span class="stat-separator">•</span>
                        <span class="stat-item"><strong>${stats.works}</strong> видов работ</span>
                        <span class="stat-separator">•</span>
                        <span class="stat-item"><strong>${stats.resources}</strong> ресурсов</span>
                    </div>
                </div>
                
                <div class="data-preview-table" id="data-preview-table">
                    ${this.renderDataPreviewTable()}
                </div>
            </div>
        `;
    },

    // Рендер таблицы предпросмотра
    renderDataPreviewTable() {
        if (!this.parsedData || this.parsedData.length === 0) {
            return '<p>Нет данных для отображения</p>';
        }

        let html = '<table class="preview-table"><thead><tr>';

        // Заголовки в зависимости от типа документа
        if (this.documentType === 1) {
            html += '<th>Действие</th><th>Тип</th><th>№</th><th>Тип ресурса</th><th>Название</th><th>Ед.изм</th><th>Кол-во</th><th>Цена</th><th>Сумма</th>';
        } else {
            html += '<th>Действие</th><th>Тип</th><th>№</th><th>Код</th><th>Название</th><th>Ед.изм</th><th>Норма на ед.</th><th>Кол-во (проект)</th><th>Цена</th><th>Сумма</th>';
        }
        html += '</tr></thead><tbody>';

        // Данные
        this.parsedData.forEach((row, index) => {
            if (row.deleted) return; // Пропускаем удаленные строки

            let rowClass = '';
            let typeLabel = '';

            if (row.type === 'stage') {
                rowClass = 'row-stage';
                typeLabel = 'Этап';
            } else if (row.type === 'work') {
                rowClass = 'row-work';
                typeLabel = 'Вид работ';
            } else if (row.type === 'resource') {
                rowClass = 'row-resource';
                typeLabel = 'Ресурс';
            }

            html += `<tr class="${rowClass}" data-index="${index}">`;
            html += `<td><button class="btn-icon btn-delete" onclick="ImportManager.deleteRow(${index})" title="Удалить строку">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                </svg>
            </button></td>`;
            html += `<td><span class="type-badge">${typeLabel}</span></td>`;
            html += `<td>${row.number || ''}</td>`;

            if (this.documentType === 1) {
                html += `<td>${row.resourceType || ''}</td>`;
                html += `<td>${row.name || ''}</td>`;
                html += `<td>${row.unit || ''}</td>`;
                html += `<td>${row.quantity || ''}</td>`;
                html += `<td>${row.price || ''}</td>`;
                html += `<td>${row.total || ''}</td>`;
            } else {
                html += `<td>${row.cipher || ''}</td>`;
                html += `<td>${row.name || ''}</td>`;
                html += `<td>${row.unit || ''}</td>`;
                html += `<td>${row.type === 'work' ? '' : (row.normPerUnit ?? '')}</td>`;
                html += `<td>${row.quantity ?? ''}</td>`;
                html += `<td>${row.price ?? ''}</td>`;
                html += `<td>${row.total ?? ''}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    // Удалить строку
    deleteRow(index) {
        this.parsedData[index].deleted = true;
        // Перерисовываем таблицу
        document.getElementById('data-preview-table').innerHTML = this.renderDataPreviewTable();
    },

    // Рендер Шаг 3: Прогресс импорта
    renderStep3() {
        return `
            <div class="import-step-3">
                <h4>Импорт данных</h4>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" id="import-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text" id="import-progress-text">0%</div>
                </div>
                <div class="import-status" id="import-status">
                    Подготовка к импорту...
                </div>
                <div class="import-log" id="import-log"></div>
            </div>
        `;
    },

    // Переход к следующему шагу
    async nextStep() {
        if (this.currentStep === 1) {
            // Валидация шага 1
            if (!this.documentType) {
                alert('Пожалуйста, выберите тип документа');
                return;
            }
            if (!this.selectedFile) {
                alert('Пожалуйста, выберите файл для импорта');
                return;
            }

            // Парсим файл
            try {
                await this.parseFile();
                this.currentStep = 2;
                this.renderCurrentStep();
            } catch (error) {
                alert('Ошибка при чтении файла: ' + error.message);
                return;
            }
        } else if (this.currentStep === 2) {
            // Переход к импорту
            this.currentStep = 3;
            this.renderCurrentStep();
            // Запускаем импорт
            setTimeout(() => this.executeImport(), 500);
        }
    },

    // Переход к предыдущему шагу
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderCurrentStep();
        }
    },

    // Отрисовка текущего шага
    renderCurrentStep() {
        let content = '';

        if (this.currentStep === 1) {
            content = this.renderStep1();
        } else if (this.currentStep === 2) {
            content = this.renderStep2();
        } else if (this.currentStep === 3) {
            content = this.renderStep3();
        }

        document.getElementById('import-step-content').innerHTML = content;
        this.updateStepIndicator();
        this.updateNavigationButtons();
    },

    // Обновление индикатора шагов
    updateStepIndicator() {
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((item, index) => {
            const stepNum = index + 1;
            if (stepNum < this.currentStep) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (stepNum === this.currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });

        const connectors = document.querySelectorAll('.step-connector');
        connectors.forEach((conn, idx) => {
            conn.classList.remove('active', 'completed');
            if (this.currentStep - 1 > idx + 1) {
                conn.classList.add('completed');
            } else if (this.currentStep - 1 === idx + 1) {
                conn.classList.add('active');
            }
        });
    },

    // Обновление кнопок навигации
    updateNavigationButtons() {
        const prevBtn = document.getElementById('import-prev-btn');
        const nextBtn = document.getElementById('import-next-btn');

        if (this.currentStep === 1) {
            prevBtn.style.display = 'none';
            nextBtn.textContent = 'Далее';
            nextBtn.disabled = !this.documentType || !this.selectedFile;
        } else if (this.currentStep === 2) {
            prevBtn.style.display = 'inline-block';
            nextBtn.textContent = 'Импортировать';
            nextBtn.disabled = false;
        } else if (this.currentStep === 3) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    },

    // Парсинг файла
    async parseFile() {
        await this.ensureXLSXLoaded();

        return new Promise((resolve, reject) => {
            const fileExtension = this.selectedFile.name.split('.').pop().toLowerCase();

            // Для CSV файлов читаем как текст с UTF-8
            if (fileExtension === 'csv') {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const text = e.target.result;
                        const workbook = XLSX.read(text, {
                            type: 'string',
                            raw: false,
                            codepage: 65001 // UTF-8
                        });

                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                            header: 1,
                            defval: '',
                            raw: false
                        });

                        if (!jsonData || jsonData.length === 0) {
                            reject(new Error('Файл пуст или не содержит данных'));
                            return;
                        }

                        this.parsedData = this.processRawData(jsonData);

                        if (this.parsedData.length === 0) {
                            reject(new Error('Не удалось распознать данные в файле. Проверьте формат файла.'));
                            return;
                        }

                        resolve();
                    } catch (error) {
                        console.error('Parse error:', error);
                        reject(new Error('Ошибка при чтении файла: ' + error.message));
                    }
                };

                reader.onerror = (error) => reject(new Error('Ошибка при чтении файла'));
                reader.readAsText(this.selectedFile, 'UTF-8');

            } else {
                // Для Excel файлов (XLS, XLSX)
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, {
                            type: 'array',
                            codepage: 65001 // UTF-8
                        });

                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                            header: 1,
                            defval: '',
                            raw: false
                        });

                        if (!jsonData || jsonData.length === 0) {
                            reject(new Error('Файл пуст или не содержит данных'));
                            return;
                        }

                        this.parsedData = this.processRawData(jsonData);

                        if (this.parsedData.length === 0) {
                            reject(new Error('Не удалось распознать данные в файле. Проверьте формат файла.'));
                            return;
                        }

                        resolve();
                    } catch (error) {
                        console.error('Parse error:', error);
                        reject(new Error('Ошибка при чтении файла: ' + error.message));
                    }
                };

                reader.onerror = (error) => reject(new Error('Ошибка при чтении файла'));
                reader.readAsArrayBuffer(this.selectedFile);
            }
        });
    },

    // Обработка сырых данных из Excel/CSV
    processRawData(rawData) {
        const processed = [];
        let currentStage = null;
        let currentWorkNumber = null;

        rawData.forEach((row, index) => {
            // Пропускаем полностью пустые строки (все ячейки пустые)
            if (row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) return;

            const firstCell = String(row[0] || '').trim();
            const normalizedRow = row.map(cell => String(cell || '').toLowerCase());
            const joinedRow = normalizedRow.join(' ');

            // Проверяем, является ли строка работой или ресурсом (по первой колонке)
            const isWork = /^\d+$/.test(firstCell);
            const isResource = firstCell.startsWith('.') || firstCell.startsWith(',') || /^\d+[\.,]\d+$/.test(firstCell);

            const looksLikeHeader = (
                (!isWork && !isResource && (
                    firstCell.toLowerCase().includes('№') ||
                    firstCell.toLowerCase().includes('n п.п') ||
                    joinedRow.includes('шифр номера нормативов') ||
                    joinedRow.includes('наименование работ') ||
                    joinedRow.includes('единица измерения') ||
                    joinedRow.includes('количество')
                )) ||
                (normalizedRow[0] === '1' && normalizedRow[1] === '2' && normalizedRow[2] === '3')
            );

            if (looksLikeHeader) {
                return;
            }

            // Определяем тип строки
            let rowType = 'unknown';

            // Ресурс - число с точкой (1.1, 2.3) или начинается с точки (.1, .2)
            if (isResource) {
                rowType = 'resource';
            }
            // Вид работ - целое число (1, 2, 3...)
            else if (isWork) {
                rowType = 'work';
                currentWorkNumber = firstCell;
            }
            // Этап - все остальное (текст, пустая строка, или ЭТАП в названии)
            else {
                rowType = 'stage';
                // Берем название из разных колонок в зависимости от типа
                currentStage = row[1] || row[2] || row[0] || 'Без названия';
            }

            // Формируем объект в зависимости от типа документа
            const rowData = {
                type: rowType,
                number: firstCell,
                deleted: false,
                stage: currentStage
            };

            if (this.documentType === 1) {
                // Тип 1: № ТипРесурса Название Ед.изм Кол-во Цена
                rowData.resourceType = row[1] || '';
                rowData.name = row[2] || '';
                rowData.unit = this.normalizeUnit(row[3] || '');
                rowData.quantity = this.parseNumber(row[4]);
                rowData.price = this.parseNumber(row[5]);

                // Нумерация (колонка №) для типа 1 — это и есть "код" позиции (1, 1.1, 2.3 ...)
                if (rowType === 'work') {
                    rowData.code = firstCell;
                } else if (rowType === 'resource') {
                    if ((firstCell.startsWith('.') || firstCell.startsWith(',')) && currentWorkNumber) {
                        const suffix = firstCell.replace(',', '.');
                        rowData.code = `${currentWorkNumber}${suffix}`;
                    } else {
                        rowData.code = firstCell;
                    }
                }

                rowData.total = (rowData.quantity !== '' && rowData.price !== '') ?
                    (Number(rowData.quantity) * Number(rowData.price)) : '';
            } else {
                // Тип 2: № Код ресурса Название Ед.изм Норма на ед. Кол-во по проекту Цена
                const codeCell = row[1] || '';
                const nameCell = row[2] || '';
                const unitCell = row[3] || '';
                const normValue = this.parseNumber(row[4]);
                const projectQuantity = this.parseNumber(row[5]);
                const priceValue = this.parseNumber(row[6]);

                // № п.п. (Колонка A) сохраняем в поле code
                rowData.code = firstCell; 
                // Шифр (Колонка B) сохраняем в поле cipher
                rowData.cipher = codeCell;
                // Название (Колонка C) сохраняем в поле name
                rowData.name = nameCell;
                rowData.unit = this.normalizeUnit(unitCell);
                rowData.resourceType = rowType === 'resource' ? this.detectResourceType(nameCell, codeCell, rowData.unit) : '';

                if (rowType === 'resource') {
                    rowData.normPerUnit = normValue === '' ? null : normValue;
                    rowData.quantity = projectQuantity !== '' ? projectQuantity : (normValue === '' ? '' : normValue);
                } else if (rowType === 'work') {
                    rowData.normPerUnit = normValue === '' ? null : normValue;
                    rowData.quantity = projectQuantity !== '' ? projectQuantity : (normValue === '' ? '' : normValue);
                }

                rowData.price = priceValue;
                rowData.total = (rowData.quantity !== '' && rowData.price !== '') ?
                    (Number(rowData.quantity) * Number(rowData.price)) : '';
            }

            processed.push(rowData);
        });

        return processed;
    },

    // Выполнение импорта
    async executeImport() {
        const progressFill = document.getElementById('import-progress-fill');
        const progressText = document.getElementById('import-progress-text');
        const statusText = document.getElementById('import-status');
        const logContainer = document.getElementById('import-log');

        // Получаем актуальный sectionId напрямую из EstimateManager
        // window.currentSectionId может быть устаревшим после миграций БД
        let sectionId = EstimateManager?.currentSectionId;

        console.log('=== Import Debug Info ===');
        console.log('EstimateManager:', EstimateManager);
        console.log('EstimateManager.currentSectionId:', EstimateManager?.currentSectionId);
        console.log('Type of EstimateManager.currentSectionId:', typeof EstimateManager?.currentSectionId);
        console.log('window.currentSectionId:', window.currentSectionId);
        console.log('Type of window.currentSectionId:', typeof window.currentSectionId);
        console.log('sectionId to use:', sectionId);
        console.log('Type of sectionId:', typeof sectionId);
        console.log('Boolean check !sectionId:', !sectionId);
        console.log('EstimateManager.currentEstimateId:', EstimateManager?.currentEstimateId);

        // Если раздел не выбран: сначала пытаемся использовать существующий раздел сметы,
        // чтобы не плодить "раздел внутри раздела".
        if (!sectionId || sectionId === 'null' || sectionId === 'undefined') {
            try {
                const existingSections = await api.getSections(EstimateManager.currentEstimateId);
                const firstSection = existingSections?.[0];
                if (firstSection?.id) {
                    sectionId = firstSection.id;
                    this.addLog(`ℹ Раздел не выбран. Используем существующий раздел: ${firstSection.name}`, 'info');
                }
            } catch (e) {
                // ignore, fallback below
            }
        }

        // Если вообще нет разделов — создаем один (технический контейнер)
        if (!sectionId || sectionId === 'null' || sectionId === 'undefined') {
            statusText.textContent = 'Создание раздела...';
            this.addLog('ℹ В смете нет разделов. Создаем базовый раздел...', 'info');

            try {
                const newSection = await api.createSection({
                    estimateId: EstimateManager.currentEstimateId,
                    code: '01',
                    name: 'Раздел сметы',
                    description: 'Создан автоматически при импорте',
                    orderIndex: 0,
                });

                sectionId = newSection.id;
                this.addLog(`✓ Создан раздел: ${newSection.name} (ID: ${sectionId})`, 'success');

                window.currentSectionId = sectionId;
                localStorage.setItem('probim_current_section_id', sectionId);
                if (EstimateManager) {
                    EstimateManager.currentSectionId = sectionId;
                }
            } catch (error) {
                statusText.textContent = 'Ошибка создания раздела';
                this.addLog(`✗ Ошибка создания раздела: ${error.message}`, 'error');
                alert('Не удалось создать раздел для импорта.\n\nПожалуйста, создайте раздел вручную и повторите импорт.');
                return;
            }
        }

        // Сохраняем для использования в методе
        this.sectionId = sectionId;

        // Фильтруем удаленные строки
        const dataToImport = this.parsedData.filter(row => !row.deleted);
        const total = dataToImport.length;
        let processed = 0;

        statusText.textContent = 'Импорт данных...';

        // Группируем данные по этапам и видам работ
        const structured = this.structureData(dataToImport);

        console.log('Structured data:', structured);

        try {
            // Группируем данные для массового импорта
            const structured = this.structureData(dataToImport);

            // Подготавливаем ресурсы (мапим типы)
            structured.forEach(stage => {
                stage.works.forEach(work => {
                    work.resources.forEach(res => {
                        res.resourceType = this.mapResourceType(res.resourceType);
                    });
                });
            });

            this.addLog('Отправка данных на сервер (массовый импорт)...', 'info');

            const importResult = await api.bulkImport(this.sectionId, {
                stages: structured
            });

            this.addLog('✓ Данные успешно загружены и обработаны сервером', 'success');

            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            statusText.textContent = 'Импорт завершен успешно!';

            this.addLog(`\n✓ Импорт завершен!`, 'success');

            // Обновляем данные в интерфейсе
            setTimeout(() => {
                this.closeModal();
                if (this.hadSectionAtStart && EstimateManager.currentSectionId) {
                    EstimateManager.openSection(EstimateManager.currentSectionId);
                } else if (EstimateManager.currentEstimateId) {
                    EstimateManager.openEstimate(EstimateManager.currentEstimateId);
                }
            }, 1500);

        } catch (error) {
            statusText.textContent = 'Ошибка при импорте';
            this.addLog(`✗ Ошибка: ${error.message}`, 'error');
            console.error('Import error:', error);

            // Показываем детальное сообщение пользователю
            setTimeout(() => {
                alert(`Ошибка импорта: ${error.message}\n\nПроверьте:\n1. Открыт ли раздел сметы\n2. Правильность формата файла\n3. Консоль браузера для деталей`);
            }, 1000);
        }
    },

    // Структурирование данных
    structureData(data) {
        const stages = [];
        let currentStage = null;
        let currentWork = null;

        let stageCounter = 0;
        let workCounter = 0;
        let resourceCounter = 0;

        console.log('=== Structuring data, total rows:', data.length);

        data.forEach((row, index) => {
            if (row.type === 'stage') {
                currentStage = {
                    name: row.stage || 'Без названия',
                    orderIndex: stageCounter++,
                    works: []
                };
                stages.push(currentStage);
                workCounter = 0;
            } else if (row.type === 'work') {
                if (!currentStage) {
                    currentStage = {
                        name: 'Основной этап',
                        orderIndex: stageCounter++,
                        works: []
                    };
                    stages.push(currentStage);
                    workCounter = 0;
                }
                currentWork = {
                    code: row.code || row.number || '',
                    cipher: row.cipher || '',
                    name: row.name || 'Без названия',
                    unit: row.unit,
                    quantity: row.quantity,
                    normPerUnit: row.normPerUnit,
                    orderIndex: workCounter++,
                    resources: []
                };
                currentStage.works.push(currentWork);
                resourceCounter = 0;
            } else if (row.type === 'resource') {
                if (!currentWork) {
                    if (!currentStage) {
                        currentStage = {
                            name: 'Основной этап',
                            orderIndex: stageCounter++,
                            works: []
                        };
                        stages.push(currentStage);
                        workCounter = 0;
                    }
                    currentWork = {
                        name: 'Прочие работы',
                        unit: 'шт',
                        quantity: 1,
                        orderIndex: workCounter++,
                        resources: []
                    };
                    currentStage.works.push(currentWork);
                    resourceCounter = 0;
                }

                // Добавляем индекс порядка ресурсу
                row.orderIndex = resourceCounter++;
                currentWork.resources.push(row);
            }
        });

        return stages;
    },

    // Получить статистику данных
    getDataStats() {
        const activeData = this.parsedData.filter(row => !row.deleted);
        return {
            stages: activeData.filter(row => row.type === 'stage').length,
            works: activeData.filter(row => row.type === 'work').length,
            resources: activeData.filter(row => row.type === 'resource').length
        };
    },

    // Добавить запись в лог
    addLog(message, type = 'info') {
        const logContainer = document.getElementById('import-log');
        if (!logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = message;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    },

    // Setup drag and drop
    setupDragAndDrop() {
        const dropArea = document.getElementById('file-upload-area');
        if (!dropArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.style.borderColor = 'var(--primary)';
                dropArea.style.background = 'var(--primary-lighter)';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.style.borderColor = 'var(--gray-400)';
                dropArea.style.background = 'var(--gray-50)';
            });
        });

        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const validExtensions = ['xls', 'xlsx', 'csv'];
                const fileExtension = file.name.split('.').pop().toLowerCase();

                if (validExtensions.includes(fileExtension)) {
                    this.selectedFile = file;
                    document.getElementById('file-upload-area').style.display = 'none';
                    document.getElementById('file-info').style.display = 'flex';
                    document.getElementById('file-name').textContent = file.name;
                    document.getElementById('file-size').textContent = this.formatFileSize(file.size);
                    this.updateNavigationButtons();
                } else {
                    alert('Пожалуйста, выберите файл формата XLS, XLSX или CSV');
                }
            }
        });
    }
};
