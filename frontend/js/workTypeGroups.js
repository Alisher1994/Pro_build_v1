// ========================================
// Work Type Groups Module - Справочник "Виды работ"
// ========================================

const WorkTypeGroupsManager = {
    selectedGroupId: null,

    async show() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding: 40px; max-width: 1400px; margin: 0 auto;">
                <h1 style="margin-bottom: 32px; color: var(--gray-900); font-size: 28px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 12px;">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        <path d="M9 12h6m-6 4h6"/>
                    </svg>
                    Справочник "Виды работ"
                </h1>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; height: calc(100vh - 200px);">
                    <!-- Левая панель: Группы работ -->
                    <div style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 8px; padding: 24px; display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--gray-800);">Группы работ</h2>
                            <button onclick="WorkTypeGroupsManager.showAddGroupModal()" class="btn btn-primary btn-sm">
                                + Добавить группу
                            </button>
                        </div>
                        <div id="groups-list" style="flex: 1; overflow-y: auto; border-top: 1px solid var(--gray-200); padding-top: 16px;">
                            <div style="text-align: center; color: var(--gray-500); padding: 40px;">Загрузка...</div>
                        </div>
                    </div>

                    <!-- Правая панель: Виды работ -->
                    <div style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 8px; padding: 24px; display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--gray-800);">Виды работ</h2>
                            <button id="add-item-btn" onclick="WorkTypeGroupsManager.showAddItemModal()" class="btn btn-primary btn-sm" disabled>
                                + Добавить вид работ
                            </button>
                        </div>
                        <div id="items-list" style="flex: 1; overflow-y: auto; border-top: 1px solid var(--gray-200); padding-top: 16px;">
                            <div style="text-align: center; color: var(--gray-500); padding: 40px;">Выберите группу работ</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadGroups();
    },

    async loadGroups() {
        try {
            const response = await fetch('/api/work-type-groups');
            const groups = await response.json();

            const groupsList = document.getElementById('groups-list');
            
            if (groups.length === 0) {
                groupsList.innerHTML = '<div style="text-align: center; color: var(--gray-500); padding: 40px;">Нет групп работ</div>';
                return;
            }

            groupsList.innerHTML = groups.map(group => `
                <div class="group-item ${this.selectedGroupId === group.id ? 'selected' : ''}" 
                     data-id="${group.id}"
                     onclick="WorkTypeGroupsManager.selectGroup('${group.id}')"
                     style="padding: 12px 16px; margin-bottom: 8px; border: 1px solid var(--gray-200); border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                        <span style="font-weight: 500; color: var(--gray-800);">${group.name}</span>
                        <span style="font-size: 12px; color: var(--gray-500);">Видов работ: ${group.workTypeItems?.length || 0}</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="event.stopPropagation(); WorkTypeGroupsManager.showEditGroupModal('${group.id}')" 
                            class="btn btn-secondary" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Редактировать">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                            </svg>
                        </button>
                        <button onclick="event.stopPropagation(); WorkTypeGroupsManager.deleteGroup('${group.id}')" 
                            class="btn btn-danger" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Удалить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');

            // Добавляем CSS для выделенной группы
            const existingStyle = document.getElementById('work-type-groups-style');
            if (existingStyle) {
                existingStyle.remove();
            }
            const style = document.createElement('style');
            style.id = 'work-type-groups-style';
            style.textContent = `
                .group-item:hover { background: var(--gray-50); }
                .group-item.selected { 
                    background: var(--primary-lighter) !important; 
                    border-color: var(--primary) !important;
                }
                .group-item.selected span { 
                    color: var(--primary) !important;
                    font-weight: 600;
                }
                .item-row:hover { background: var(--gray-50); }
            `;
            document.head.appendChild(style);

            // Если была выбрана группа, загружаем виды работ
            if (this.selectedGroupId) {
                await this.loadItems(this.selectedGroupId);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            document.getElementById('groups-list').innerHTML = '<div style="text-align: center; color: var(--danger-color); padding: 40px;">Ошибка загрузки групп</div>';
        }
    },

    async selectGroup(groupId) {
        this.selectedGroupId = groupId;
        document.getElementById('add-item-btn').disabled = false;
        await this.loadGroups(); // Перерисовываем для обновления выделения
        await this.loadItems(groupId);
    },

    async loadItems(groupId) {
        try {
            const response = await fetch(`/api/work-type-groups/${groupId}/items`);
            const items = await response.json();

            const itemsList = document.getElementById('items-list');
            
            if (items.length === 0) {
                itemsList.innerHTML = '<div style="text-align: center; color: var(--gray-500); padding: 40px;">Нет видов работ в этой группе</div>';
                return;
            }

            itemsList.innerHTML = items.map(item => `
                <div class="item-row" style="padding: 12px 16px; margin-bottom: 8px; border: 1px solid var(--gray-200); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
                    <div>
                        <div style="font-weight: 500; color: var(--gray-800); margin-bottom: 4px;">${item.name}</div>
                        <div style="font-size: 12px; color: var(--gray-600);">Единица измерения: ${item.unit}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="WorkTypeGroupsManager.showEditItemModal('${groupId}', '${item.id}')" 
                            class="btn btn-secondary" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Редактировать">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                            </svg>
                        </button>
                        <button onclick="WorkTypeGroupsManager.deleteItem('${groupId}', '${item.id}')" 
                            class="btn btn-danger" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Удалить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading items:', error);
            document.getElementById('items-list').innerHTML = '<div style="text-align: center; color: var(--danger-color); padding: 40px;">Ошибка загрузки видов работ</div>';
        }
    },

    showAddGroupModal() {
        this.showGroupModal('Добавить группу работ', '', null);
    },

    async showEditGroupModal(groupId) {
        try {
            const response = await fetch(`/api/work-type-groups/${groupId}`);
            const group = await response.json();
            this.showGroupModal('Редактировать группу работ', group.name, groupId);
        } catch (error) {
            console.error('Error loading group:', error);
            alert('Ошибка загрузки группы');
        }
    },

    showGroupModal(title, name = '', groupId = null) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 32px; width: 500px; max-width: 90%;">
                <h2 style="margin: 0 0 24px 0; font-size: 20px; color: var(--gray-900);">${title}</h2>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                        Название группы *
                    </label>
                    <input type="text" id="group-name-input" value="${name}" 
                        style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px;" 
                        placeholder="Введите название группы"/>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button onclick="this.closest('div[style*=fixed]').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                    <button onclick="WorkTypeGroupsManager.saveGroup('${groupId}')" class="btn btn-primary">
                        Сохранить
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('group-name-input').focus();
    },

    async saveGroup(groupId) {
        const name = document.getElementById('group-name-input').value.trim();
        
        if (!name) {
            alert('Название группы обязательно');
            return;
        }

        try {
            // Проверяем что groupId не null и не строка 'null'
            const isEdit = groupId && groupId !== 'null';
            const url = isEdit ? `/api/work-type-groups/${groupId}` : '/api/work-type-groups';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения группы');
            }

            document.querySelector('div[style*=fixed]').remove();
            await this.loadGroups();
        } catch (error) {
            console.error('Error saving group:', error);
            alert('Ошибка сохранения группы');
        }
    },

    async deleteGroup(groupId) {
        if (!confirm('Удалить группу работ?')) return;

        try {
            const response = await fetch(`/api/work-type-groups/${groupId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка удаления');
            }

            if (this.selectedGroupId === groupId) {
                this.selectedGroupId = null;
                document.getElementById('items-list').innerHTML = '<div style="text-align: center; color: var(--gray-500); padding: 40px;">Выберите группу работ</div>';
                document.getElementById('add-item-btn').disabled = true;
            }

            await this.loadGroups();
        } catch (error) {
            console.error('Error deleting group:', error);
            alert(error.message || 'Ошибка удаления группы');
        }
    },

    showAddItemModal() {
        if (!this.selectedGroupId) {
            alert('Выберите группу работ');
            return;
        }
        this.showItemModal('Добавить вид работ', '', '', null);
    },

    async showEditItemModal(groupId, itemId) {
        try {
            const response = await fetch(`/api/work-type-groups/${groupId}/items`);
            const items = await response.json();
            const item = items.find(i => i.id === itemId);
            
            if (!item) {
                throw new Error('Вид работ не найден');
            }
            
            this.showItemModal('Редактировать вид работ', item.name, item.unit, itemId);
        } catch (error) {
            console.error('Error loading item:', error);
            alert('Ошибка загрузки вида работ');
        }
    },

    showItemModal(title, name = '', unit = '', itemId = null) {
        const units = ['м', 'м²', 'м³', 'шт', 'т', 'км', 'л', 'комплект', 'маш.-ч', 'чел.-ч'];
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 32px; width: 500px; max-width: 90%;">
                <h2 style="margin: 0 0 24px 0; font-size: 20px; color: var(--gray-900);">${title}</h2>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                        Наименование вида работ *
                    </label>
                    <input type="text" id="item-name-input" value="${name}" 
                        style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px;" 
                        placeholder="Введите наименование"/>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                        Единица измерения *
                    </label>
                    <select id="item-unit-input" 
                        style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; background: white;">
                        <option value="">Выберите единицу измерения</option>
                        ${units.map(u => `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button onclick="this.closest('div[style*=fixed]').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                    <button onclick="WorkTypeGroupsManager.saveItem('${itemId}')" class="btn btn-primary">
                        Сохранить
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('item-name-input').focus();
    },

    async saveItem(itemId) {
        const name = document.getElementById('item-name-input').value.trim();
        const unit = document.getElementById('item-unit-input').value;
        
        if (!name) {
            alert('Наименование вида работ обязательно');
            return;
        }

        if (!unit) {
            alert('Единица измерения обязательна');
            return;
        }

        try {
            const groupId = this.selectedGroupId;
            // Проверяем что itemId не null и не строка 'null'
            const isEdit = itemId && itemId !== 'null';
            const url = isEdit
                ? `/api/work-type-groups/${groupId}/items/${itemId}` 
                : `/api/work-type-groups/${groupId}/items`;
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, unit })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения вида работ');
            }

            document.querySelector('div[style*=fixed]').remove();
            await this.loadItems(groupId);
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Ошибка сохранения вида работ');
        }
    },

    async deleteItem(groupId, itemId) {
        if (!confirm('Удалить вид работ?')) return;

        try {
            const response = await fetch(`/api/work-type-groups/${groupId}/items/${itemId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка удаления');
            }

            await this.loadItems(groupId);
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(error.message || 'Ошибка удаления вида работ');
        }
    }
};
