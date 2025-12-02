// ========================================
// Settings Module - Управление настройками проекта
// ========================================

const SettingsManager = {
    currentProjectId: null,

    async showProjectSettings(projectId) {
        this.currentProjectId = projectId;
        
        try {
            // Получаем данные проекта
            const project = await api.getProject(projectId);
            
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h1 style="margin-bottom: 32px; color: var(--gray-900); font-size: 28px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 12px;">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"/>
                        </svg>
                        Настройки проекта
                    </h1>
                    
                    <div style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <form id="project-settings-form">
                            <!-- Название объекта -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Название объекта *
                                </label>
                                <input 
                                    type="text" 
                                    id="project-name" 
                                    name="name"
                                    value="${project.name || ''}"
                                    required
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Адрес объекта -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Адрес объекта
                                </label>
                                <input 
                                    type="text" 
                                    id="project-address" 
                                    name="address"
                                    value="${project.address || ''}"
                                    placeholder="Введите адрес объекта"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Заказчик -->
                            <div style="margin-bottom: 24px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Заказчик
                                </label>
                                <input 
                                    type="text" 
                                    id="project-client" 
                                    name="client"
                                    value="${project.client || ''}"
                                    placeholder="Название организации заказчика"
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                />
                            </div>

                            <!-- Валюта -->
                            <div style="margin-bottom: 32px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                    Валюта проекта *
                                </label>
                                <select 
                                    id="project-currency" 
                                    name="currency"
                                    required
                                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; background: white; cursor: pointer; transition: border-color 0.2s;"
                                    onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                    onblur="this.style.borderColor='var(--gray-300)';"
                                >
                                    <option value="RUB" ${(project.currency || 'RUB') === 'RUB' ? 'selected' : ''}>🇷🇺 Российский рубль (₽)</option>
                                    <option value="UZS" ${project.currency === 'UZS' ? 'selected' : ''}>🇺🇿 Узбекский сум (сўм)</option>
                                    <option value="USD" ${project.currency === 'USD' ? 'selected' : ''}>🇺🇸 Доллар США ($)</option>
                                    <option value="EUR" ${project.currency === 'EUR' ? 'selected' : ''}>🇪🇺 Евро (€)</option>
                                    <option value="KGS" ${project.currency === 'KGS' ? 'selected' : ''}>🇰🇬 Киргизский сом (сом)</option>
                                    <option value="KZT" ${project.currency === 'KZT' ? 'selected' : ''}>🇰🇿 Казахский тенге (₸)</option>
                                    <option value="TJS" ${project.currency === 'TJS' ? 'selected' : ''}>🇹🇯 Таджикский сомони (ЅМ)</option>
                                    <option value="TMT" ${project.currency === 'TMT' ? 'selected' : ''}>🇹🇲 Туркменский манат (m)</option>
                                    <option value="AZN" ${project.currency === 'AZN' ? 'selected' : ''}>🇦🇿 Азербайджанский манат (₼)</option>
                                    <option value="BYN" ${project.currency === 'BYN' ? 'selected' : ''}>🇧🇾 Белорусский рубль (Br)</option>
                                    <option value="UAH" ${project.currency === 'UAH' ? 'selected' : ''}>🇺🇦 Украинская гривна (₴)</option>
                                    <option value="GBP" ${project.currency === 'GBP' ? 'selected' : ''}>🇬🇧 Фунт стерлингов (£)</option>
                                    <option value="CNY" ${project.currency === 'CNY' ? 'selected' : ''}>🇨🇳 Китайский юань (¥)</option>
                                    <option value="TRY" ${project.currency === 'TRY' ? 'selected' : ''}>🇹🇷 Турецкая лира (₺)</option>
                                    <option value="AED" ${project.currency === 'AED' ? 'selected' : ''}>🇦🇪 Дирхам ОАЭ (د.إ)</option>
                                </select>
                            </div>

                            <!-- Дополнительная информация -->
                            <div style="border-top: 1px solid var(--gray-200); padding-top: 24px; margin-bottom: 24px;">
                                <h3 style="margin-bottom: 16px; color: var(--gray-800); font-size: 16px;">Дополнительная информация</h3>
                                
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 14px;">
                                        Описание проекта
                                    </label>
                                    <textarea 
                                        id="project-description" 
                                        name="description"
                                        rows="4"
                                        placeholder="Краткое описание проекта"
                                        style="width: 100%; padding: 10px 12px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 14px; font-family: 'Segoe UI', sans-serif; resize: vertical; transition: border-color 0.2s;"
                                        onfocus="this.style.borderColor='var(--primary-color)'; this.style.outline='none';"
                                        onblur="this.style.borderColor='var(--gray-300)';"
                                    >${project.description || ''}</textarea>
                                </div>
                            </div>

                            <!-- Кнопки действий -->
                            <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center; padding-top: 16px; border-top: 1px solid var(--gray-200);">
                                <button 
                                    type="button" 
                                    onclick="window.location.reload()"
                                    class="btn btn-secondary"
                                    style="padding: 10px 24px;"
                                >
                                    Отмена
                                </button>
                                <button 
                                    type="submit" 
                                    class="btn btn-primary"
                                    style="padding: 10px 32px;"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                        <polyline points="17 21 17 13 7 13 7 21"/>
                                        <polyline points="7 3 7 8 15 8"/>
                                    </svg>
                                    Сохранить изменения
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Дополнительные настройки -->
                    <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 24px; margin-top: 24px;">
                        <h3 style="margin-bottom: 12px; color: var(--gray-800); font-size: 16px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            Информация о проекте
                        </h3>
                        <div style="color: var(--gray-600); font-size: 13px; line-height: 1.6;">
                            <p style="margin: 4px 0;"><strong>ID проекта:</strong> ${project.id}</p>
                            <p style="margin: 4px 0;"><strong>Дата создания:</strong> ${new Date(project.createdAt).toLocaleString('ru-RU')}</p>
                            <p style="margin: 4px 0;"><strong>Последнее обновление:</strong> ${new Date(project.updatedAt).toLocaleString('ru-RU')}</p>
                        </div>
                    </div>
                </div>
            `;

            // Добавляем обработчик отправки формы
            document.getElementById('project-settings-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProjectSettings();
            });
            
        } catch (error) {
            console.error('Error loading project settings:', error);
            UI.showNotification('Ошибка загрузки настроек проекта: ' + error.message, 'error');
        }
    },

    async saveProjectSettings() {
        try {
            const formData = {
                name: document.getElementById('project-name').value.trim(),
                address: document.getElementById('project-address').value.trim(),
                client: document.getElementById('project-client').value.trim(),
                currency: document.getElementById('project-currency').value,
                description: document.getElementById('project-description').value.trim()
            };

            if (!formData.name) {
                UI.showNotification('Введите название объекта', 'error');
                return;
            }

            // Обновляем проект через API
            const updatedProject = await api.updateProject(this.currentProjectId, formData);
            
            UI.showNotification('Настройки проекта сохранены', 'success');
            
            // Обновляем название в селекторе проектов
            const projectNameElement = document.getElementById('selected-project-name');
            if (projectNameElement) {
                projectNameElement.textContent = updatedProject.name;
            }
            
            // Обновляем название компании в header
            const companyNameElement = document.getElementById('header-company-name');
            if (companyNameElement && formData.client) {
                companyNameElement.textContent = formData.client;
            }

            // Обновляем EstimateManager с новыми данными проекта
            if (typeof EstimateManager !== 'undefined') {
                EstimateManager.currentProject = updatedProject;
            }
            
        } catch (error) {
            console.error('Error saving project settings:', error);
            UI.showNotification('Ошибка сохранения настроек: ' + error.message, 'error');
        }
    }
};
