// ========================================
// Instructions Module - Модуль "Инструкции"
// ========================================

const InstructionsManager = {
    async show() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding: 40px; max-width: 1400px; margin: 0 auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                    <h1 style="margin: 0; color: var(--gray-900); font-size: 28px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 12px;">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="M9 12l2 2 4-4" />
                        </svg>
                        Инструкции
                    </h1>
                    <button onclick="InstructionsManager.showAddModal()" class="btn btn-primary">
                        + Добавить инструкцию
                    </button>
                </div>
                
                <div style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 8px; overflow: hidden;">
                    <div id="instructions-table" style="overflow-x: auto;">
                        <div style="text-align: center; color: var(--gray-500); padding: 40px;">Загрузка...</div>
                    </div>
                </div>
            </div>
        `;

        await this.loadInstructions();
    },

    async loadInstructions() {
        try {
            const response = await fetch('/api/instructions');
            const instructions = await response.json();

            const table = document.getElementById('instructions-table');

            if (instructions.length === 0) {
                table.innerHTML = '<div style="text-align: center; color: var(--gray-500); padding: 40px;">Нет инструкций</div>';
                return;
            }

            table.innerHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--gray-50); border-bottom: 2px solid var(--gray-200);">
                            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--gray-700); font-size: 14px;">Код</th>
                            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--gray-700); font-size: 14px;">Название</th>
                            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--gray-700); font-size: 14px;">Виды работ</th>
                            <th style="padding: 12px 16px; text-align: right; font-weight: 600; color: var(--gray-700); font-size: 14px; width: 150px;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${instructions.map(instr => `
                            <tr style="border-bottom: 1px solid var(--gray-200);">
                                <td style="padding: 12px 16px; color: var(--gray-800); font-family: monospace;">${instr.code}</td>
                                <td style="padding: 12px 16px; color: var(--gray-900); font-weight: 500;">${instr.name}</td>
                                <td style="padding: 12px 16px; color: var(--gray-600); font-size: 13px;">
                                    ${instr.workTypes.length > 0
                    ? instr.workTypes.map(wt => wt.workTypeItem.name).join(', ')
                    : '<span style="color: var(--gray-400);">Не привязаны</span>'}
                                </td>
                                <td style="padding: 12px 16px; text-align: right;">
                                    <button onclick="InstructionsManager.showEditModal('${instr.id}')" 
                                        class="btn btn-secondary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; margin-right: 6px;" title="Редактировать">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M12 20h9"/>
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                        </svg>
                                    </button>
                                    <button onclick="InstructionsManager.deleteInstruction('${instr.id}')" 
                                        class="btn btn-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Удалить">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('Error loading instructions:', error);
            document.getElementById('instructions-table').innerHTML = '<div style="text-align: center; color: var(--danger-color); padding: 40px;">Ошибка загрузки инструкций</div>';
        }
    },

    showAddModal() {
        this.showModal('Добавить инструкцию', '', '', '', [], null);
    },

    async showEditModal(instructionId) {
        try {
            const response = await fetch(`/api/instructions/${instructionId}`);
            const instruction = await response.json();

            const selectedWorkTypeIds = instruction.workTypes.map(wt => wt.workTypeItemId);

            this.showModal(
                'Редактировать инструкцию',
                instruction.code,
                instruction.name,
                instruction.text,
                selectedWorkTypeIds,
                instructionId
            );
        } catch (error) {
            console.error('Error loading instruction:', error);
            alert('Ошибка загрузки инструкции');
        }
    },

    async showModal(title, code = '', name = '', text = '', selectedWorkTypeIds = [], instructionId = null) {
        // Загружаем группы и виды работ
        const groupsResponse = await fetch('/api/work-type-groups');
        const groups = await groupsResponse.json();

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 32px; width: 1200px; max-width: 95%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 24px 0; font-size: 20px; color: var(--gray-900);">${title}</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                    <!-- Левая колонка: Код, Название, Текст -->
                    <div>
                        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 16px;">
                            <div>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Код *
                                </label>
                                <input type="text" id="instruction-code-input" value="${code}" 
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px;" 
                                    placeholder="Код"/>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Наименование *
                                </label>
                                <input type="text" id="instruction-name-input" value="${name}" 
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px;" 
                                    placeholder="Введите название инструкции"/>
                            </div>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                Текст инструкции * <span style="font-weight: normal; color: var(--gray-500);">(макс. 20 000 символов)</span>
                            </label>
                            <textarea id="instruction-text-input" 
                                style="width: 100%; min-height: 400px; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; resize: vertical;" 
                                placeholder="Введите текст инструкции"
                                maxlength="20000">${text}</textarea>
                            <div style="text-align: right; font-size: 12px; color: var(--gray-500); margin-top: 4px;">
                                <span id="char-counter">${text.length}</span> / 20 000
                            </div>
                        </div>
                    </div>

                    <!-- Правая колонка: Виды работ -->
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                            Виды работ
                        </label>
                        
                        <!-- Поле поиска -->
                        <div style="margin-bottom: 8px;">
                            <input type="text" 
                                id="work-types-search" 
                                placeholder="Поиск видов работ..."
                                style="width: 100%; padding: 8px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px;"
                                oninput="InstructionsManager.filterWorkTypes(this.value)">
                        </div>
                        
                        <div id="work-types-list" style="border: 1px solid var(--gray-300); border-radius: 4px; height: 460px; overflow-y: auto; padding: 8px;">
                            ${groups.length === 0
                ? '<div style="text-align: center; color: var(--gray-500); padding: 20px;">Нет доступных видов работ. Сначала создайте их в справочнике.</div>'
                : groups.map(group => `
                                    <div class="work-type-group-block" data-group-id="${group.id}" style="margin-bottom: 12px;">
                                        <div style="background: #b7d5c4; padding: 8px 12px; font-weight: 600; color: var(--gray-800); border-radius: 4px; margin-bottom: 4px;">
                                            ${group.name}
                                        </div>
                                        ${group.workTypeItems.length === 0
                        ? '<div style="padding: 8px 12px; color: var(--gray-500); font-size: 13px;">Нет видов работ в группе</div>'
                        : group.workTypeItems.map(item => `
                                                <div class="work-type-item" data-item-name="${item.name.toLowerCase()}" style="padding: 4px 12px;">
                                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                                        <input type="checkbox" class="work-type-checkbox" value="${item.id}" 
                                                            ${selectedWorkTypeIds.includes(item.id) ? 'checked' : ''}
                                                            style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer; accent-color: #207345;"/>
                                                        <span style="font-size: 14px; color: var(--gray-800);">${item.name} (${item.unit})</span>
                                                    </label>
                                                </div>
                                            `).join('')}
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: space-between; margin-top: 24px;">
                    <button onclick="InstructionsManager.generateInstructionText()" class="btn btn-secondary" style="background: var(--primary); color: white; border-color: var(--primary);">
                        🤖 Генерация текст инструкции
                    </button>
                    <div style="display: flex; gap: 12px;">
                        <button onclick="this.closest('div[style*=fixed]').remove()" class="btn btn-secondary">
                            Отмена
                        </button>
                        <button onclick="InstructionsManager.saveInstruction('${instructionId}')" class="btn btn-primary">
                            Сохранить
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Добавляем счетчик символов
        const textInput = document.getElementById('instruction-text-input');
        const charCounter = document.getElementById('char-counter');
        textInput.addEventListener('input', () => {
            charCounter.textContent = textInput.value.length;
        });

        document.getElementById('instruction-code-input').focus();
    },

    async saveInstruction(instructionId) {
        const code = document.getElementById('instruction-code-input').value.trim();
        const name = document.getElementById('instruction-name-input').value.trim();
        const text = document.getElementById('instruction-text-input').value.trim();

        const checkboxes = document.querySelectorAll('.work-type-checkbox:checked');
        const workTypeItemIds = Array.from(checkboxes).map(cb => cb.value);

        if (!code) {
            alert('Код инструкции обязателен');
            return;
        }

        if (!name) {
            alert('Название инструкции обязательно');
            return;
        }

        if (!text) {
            alert('Текст инструкции обязателен');
            return;
        }

        if (text.length > 20000) {
            alert('Текст инструкции не должен превышать 20 000 символов');
            return;
        }

        try {
            // Проверяем что instructionId не null и не строка 'null'
            const isEdit = instructionId && instructionId !== 'null';
            const url = isEdit ? `/api/instructions/${instructionId}` : '/api/instructions';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name, text, workTypeItemIds })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сохранения');
            }

            document.querySelector('div[style*=fixed]').remove();
            await this.loadInstructions();
        } catch (error) {
            console.error('Error saving instruction:', error);
            alert(error.message || 'Ошибка сохранения инструкции');
        }
    },

    async deleteInstruction(instructionId) {
        if (!confirm('Удалить инструкцию?')) return;

        try {
            const response = await fetch(`/api/instructions/${instructionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Ошибка удаления');
            }

            await this.loadInstructions();
        } catch (error) {
            console.error('Error deleting instruction:', error);
            alert('Ошибка удаления инструкции');
        }
    },

    filterWorkTypes(searchText) {
        const search = searchText.toLowerCase().trim();
        const groups = document.querySelectorAll('.work-type-group-block');

        groups.forEach(group => {
            const items = group.querySelectorAll('.work-type-item');
            let hasVisibleItems = false;

            items.forEach(item => {
                const itemName = item.getAttribute('data-item-name');
                const matches = !search || itemName.includes(search);

                item.style.display = matches ? '' : 'none';
                if (matches) hasVisibleItems = true;
            });

            // Скрываем группу, если в ней нет видимых элементов
            group.style.display = hasVisibleItems ? '' : 'none';
        });
    },

    async generateInstructionText() {
        const codeInput = document.getElementById('instruction-code-input');
        const nameInput = document.getElementById('instruction-name-input');
        const textInput = document.getElementById('instruction-text-input');
        const charCounter = document.getElementById('char-counter');

        const code = codeInput.value.trim();
        const name = nameInput.value.trim();

        if (!name) {
            alert('Введите наименование инструкции перед генерацией');
            nameInput.focus();
            return;
        }

        // Получаем выбранные виды работ
        const checkboxes = document.querySelectorAll('.work-type-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Выберите хотя бы один вид работ для генерации инструкции');
            return;
        }

        // Собираем названия видов работ из текста label
        const worktypeNames = Array.from(checkboxes).map(cb => {
            const label = cb.closest('label');
            const span = label.querySelector('span');
            return span.textContent.trim();
        });

        // Сохраняем исходный текст, чтобы вернуть его при ошибке
        const originalText = textInput.value;

        try {
            // Показываем индикатор загрузки
            textInput.value = 'Генерация текста инструкции... Пожалуйста, подождите...';
            textInput.disabled = true;

            const response = await fetch('http://localhost:3001/api/instructions/generate-excerpt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    worktypeNames: worktypeNames,
                    instructionName: name,
                    code: code
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка генерации текста');
            }

            const data = await response.json();

            // Вставляем сгенерированный текст
            textInput.value = data.excerpt || '';
            charCounter.textContent = textInput.value.length;
            textInput.disabled = false;
            textInput.focus();

        } catch (error) {
            console.error('Error generating instruction text:', error);
            alert('Ошибка генерации текста инструкции. Убедитесь, что Ollama запущен.');
            textInput.value = originalText;
            textInput.disabled = false;
        }
    }
};
