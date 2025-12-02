// ========================================
// UI Helper Functions
// ========================================

const UI = {
    // Показать модальное окно
    showModal(title, content, options = {}) {
        const modalHTML = `
            <div class="modal-overlay" id="modal-overlay">
                <div class="modal" style="max-width: ${options.width || '600px'};">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" onclick="UI.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${options.buttons || ''}
                    </div>
                </div>
            </div>
        `;
        
        const container = document.getElementById('modal-container');
        container.innerHTML = modalHTML;
        
        // Close on overlay click
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                UI.closeModal();
            }
        });
    },

    closeModal() {
        const container = document.getElementById('modal-container');
        container.innerHTML = '';
    },

    // Показать уведомление (toast)
    showToast(message, type = 'info') {
        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Показать форму создания проекта
    showCreateProjectModal(callback) {
        const content = `
            <div class="form-group">
                <label>Название проекта *</label>
                <input type="text" id="project-name" placeholder="Введите название" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="project-description" placeholder="Введите описание"></textarea>
            </div>
            <div class="form-group">
                <label>Адрес</label>
                <input type="text" id="project-address" placeholder="Введите адрес">
            </div>
            <div class="form-group">
                <label>Дата начала</label>
                <input type="date" id="project-start-date">
            </div>
            <div class="form-group">
                <label>Дата окончания</label>
                <input type="date" id="project-end-date">
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-project-btn">Создать</button>
        `;

        UI.showModal('Новый проект', content, { buttons });

        setTimeout(() => {
            document.getElementById('save-project-btn').addEventListener('click', () => {
                const data = {
                    name: document.getElementById('project-name').value.trim(),
                    description: document.getElementById('project-description').value.trim(),
                    address: document.getElementById('project-address').value.trim(),
                    startDate: document.getElementById('project-start-date').value || null,
                    endDate: document.getElementById('project-end-date').value || null,
                };

                if (!data.name) {
                    alert('Пожалуйста, введите название проекта');
                    return;
                }

                callback(data);
            });
        }, 100);
    },

    // Показать форму создания блока
    showCreateBlockModal(projectId, callback) {
        const content = `
            <div class="form-group">
                <label>Название блока *</label>
                <input type="text" id="block-name" placeholder="Блок А, Корпус 1 и т.д." required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="block-description" placeholder="Описание блока"></textarea>
            </div>
            <div class="form-group">
                <label>Количество этажей</label>
                <input type="number" id="block-floors" value="1" min="1">
            </div>
            <div class="form-group">
                <label>Площадь (м²)</label>
                <input type="number" id="block-area" step="0.01" min="0">
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-block-btn">Создать</button>
        `;

        UI.showModal('Новый блок', content, { buttons });

        setTimeout(() => {
            document.getElementById('save-block-btn').addEventListener('click', () => {
                const data = {
                    projectId,
                    name: document.getElementById('block-name').value.trim(),
                    description: document.getElementById('block-description').value.trim(),
                    floors: parseInt(document.getElementById('block-floors').value) || 1,
                    area: parseFloat(document.getElementById('block-area').value) || null,
                };

                if (!data.name) {
                    alert('Пожалуйста, введите название блока');
                    return;
                }

                callback(data);
            });
        }, 100);
    },

    // Показать форму создания раздела сметы
    showCreateSectionModal(estimateId, callback) {
        const content = `
            <div class="form-group">
                <label>Код раздела *</label>
                <select id="section-code">
                    <option value="">-- Выберите раздел --</option>
                    <option value="АР">АР - Архитектурные решения</option>
                    <option value="КЖ">КЖ - Конструкции железобетонные</option>
                    <option value="КМ">КМ - Конструкции металлические</option>
                    <option value="ОВ">ОВ - Отопление и вентиляция</option>
                    <option value="ВК">ВК - Водоснабжение и канализация</option>
                    <option value="ЭОМ">ЭОМ - Электрооборудование и электроосвещение</option>
                    <option value="СС">СС - Сети связи</option>
                    <option value="БЛАГ">БЛАГ - Благоустройство территории</option>
                    <option value="ПОС">ПОС - Проект организации строительства</option>
                </select>
            </div>
            <div class="form-group">
                <label>Название раздела *</label>
                <input type="text" id="section-name" placeholder="Полное название раздела">
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="section-description" placeholder="Описание раздела"></textarea>
            </div>
        `;

        const buttons = `
            <button class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button>
            <button class="btn btn-primary" id="save-section-btn">Создать</button>
        `;

        UI.showModal('Новый раздел сметы', content, { buttons });

        setTimeout(() => {
            // Auto-fill name based on code selection
            document.getElementById('section-code').addEventListener('change', (e) => {
                const selected = e.target.selectedOptions[0].text;
                if (selected !== '-- Выберите раздел --') {
                    document.getElementById('section-name').value = selected;
                }
            });

            document.getElementById('save-section-btn').addEventListener('click', () => {
                const data = {
                    estimateId,
                    code: document.getElementById('section-code').value,
                    name: document.getElementById('section-name').value.trim(),
                    description: document.getElementById('section-description').value.trim(),
                };

                if (!data.code || !data.name) {
                    alert('Пожалуйста, заполните обязательные поля');
                    return;
                }

                callback(data);
            });
        }, 100);
    },

    // Форматирование числа (1 000 000)
    formatNumber(num) {
        if (num === null || num === undefined) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    // Форматирование валюты с символом
    formatCurrency(amount, currencyCode = 'RUB') {
        if (amount === null || amount === undefined) return '';
        
        const formatted = this.formatNumber(amount);
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
        
        const symbol = symbols[currencyCode] || currencyCode;
        
        // Для некоторых валют символ ставится перед суммой
        if (['USD', 'EUR', 'GBP', 'CNY'].includes(currencyCode)) {
            return `${symbol}${formatted}`;
        }
        
        return `${formatted} ${symbol}`;
    },

    // Получить текущую валюту проекта
    getCurrentCurrency() {
        // Получаем из EstimateManager или используем RUB по умолчанию
        if (typeof EstimateManager !== 'undefined' && EstimateManager.currentProject) {
            return EstimateManager.currentProject.currency || 'RUB';
        }
        return 'RUB';
    },

    // Форматирование даты
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    },

    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'error' ? '#D13438' : type === 'success' ? '#107C10' : '#0078D4'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // Подтверждение удаления
    confirmDelete(message, callback) {
        if (confirm(message)) {
            callback();
        }
    }
};

// CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
