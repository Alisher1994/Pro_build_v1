// ========================================
// ProBIM - Shared Utility Functions
// ========================================

const Utils = {
    // --- Formatting ---

    /**
     * Форматирование числа (например, 1 000 000)
     */
    formatNumber(num, fractionDigits = 0) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('ru-RU', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        });
    },

    /**
     * Форматирование валюты
     */
    formatCurrency(amount, currencyCode = 'RUB') {
        if (amount === null || amount === undefined) amount = 0;
        let symbol = '₽';
        if (currencyCode === 'USD') symbol = '$';
        else if (currencyCode === 'EUR') symbol = '€';
        else if (currencyCode === 'UZS') symbol = 'сум';
        else if (currencyCode === 'KGS') symbol = 'сом';
        else if (currencyCode !== 'RUB' && currencyCode) symbol = currencyCode;
        
        return `${this.formatNumber(amount, 2)} ${symbol}`;
    },

    /**
     * Форматирование даты (DD.MM.YYYY)
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('ru-RU');
    },

    // --- UI Helpers ---

    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container') || this._createNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-triangle';
        if (type === 'warning') icon = 'exclamation-circle';

        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <div class="notification-content">${message}</div>
            <button class="notification-close">&times;</button>
        `;

        container.appendChild(notification);

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.onclick = () => this._hideNotification(notification);

        setTimeout(() => this._hideNotification(notification), 5000);
    },

    _createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
        return container;
    },

    _hideNotification(notification) {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    },

    /**
     * Универсальное модальное окно (Core)
     */
    showModal(title, content, buttons, options = {}) {
        // Закрыть текущее, если есть
        this.closeModal();

        const modalHtml = `
            <div id="common-modal-overlay" class="modal-overlay">
                <div class="modal ${options.wide ? 'modal-wide' : ''}" style="${options.width ? `width: ${options.width}` : ''}">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${buttons || `<button class="btn btn-secondary" onclick="Utils.closeModal()">Закрыть</button>`}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('common-modal-overlay');
        const closeBtn = overlay.querySelector('.modal-close');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        closeBtn.addEventListener('click', () => this.closeModal());

        // Фокус на первом инпуте
        setTimeout(() => {
            overlay.querySelector('input, select, textarea')?.focus();
        }, 100);
    },

    closeModal() {
        const modal = document.getElementById('common-modal-overlay');
        if (modal) modal.remove();
    },

    /**
     * Подтверждение действия
     */
    async confirm(title, message, confirmText = 'Да', cancelText = 'Нет') {
        return new Promise((resolve) => {
            const buttons = `
                <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
                <button class="btn btn-primary" id="confirm-ok">${confirmText}</button>
            `;
            this.showModal(title, `<p>${message}</p>`, buttons, { width: '400px' });

            document.getElementById('confirm-ok').onclick = () => {
                this.closeModal();
                resolve(true);
            };
            document.getElementById('confirm-cancel').onclick = () => {
                this.closeModal();
                resolve(false);
            };
        });
    }
};

// Экспорт для использования в глобальной области (совместимость с текущими скриптами)
window.Utils = Utils;

// Добавление стилей, если они отсутствуют
if (!document.getElementById('utils-styles')) {
    const style = document.createElement('style');
    style.id = 'utils-styles';
    style.textContent = `
        .notification { 
            min-width: 300px; 
            padding: 15px; 
            border-radius: 8px; 
            background: white; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
            display: flex; 
            align-items: center; 
            gap: 12px; 
            animation: slideIn 0.3s ease forwards; 
        }
        .notification-success { border-left: 4px solid #28a745; }
        .notification-error { border-left: 4px solid #dc3545; }
        .notification-warning { border-left: 4px solid #ffc107; }
        .notification-info { border-left: 4px solid #17a2b8; }
        .notification-close { margin-left: auto; background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
        
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(style);
}
