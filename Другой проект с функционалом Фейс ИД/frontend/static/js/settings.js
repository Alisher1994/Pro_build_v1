document.addEventListener('DOMContentLoaded', initSettings);

async function initSettings() {
    attachWorkingDayToggles();
    await loadSettings();
    
    const form = document.getElementById('settingsForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveSettings();
        });
    }
    
    // Обработчик формы Telegram
    const telegramForm = document.getElementById('telegramSettingsForm');
    if (telegramForm) {
        telegramForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveTelegramSettings();
        });
    }
}

function attachWorkingDayToggles() {
    const container = document.getElementById('working-days');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.day-toggle');
        if (!btn) return;
        btn.classList.toggle('active');
    });
}

function collectWorkingDays() {
    return Array.from(document.querySelectorAll('.day-toggle.active'))
        .map(btn => parseInt(btn.dataset.day, 10));
}

function setWorkingDays(days) {
    const set = new Set(days || []);
    document.querySelectorAll('.day-toggle').forEach(btn => {
        const day = parseInt(btn.dataset.day, 10);
        if (set.has(day)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function loadSettings() {
    try {
        const resp = await fetch('/api/club-settings');
        if (!resp.ok) {
            const errorData = await resp.json().catch(() => ({}));
            console.error('Ошибка загрузки настроек:', errorData.message || resp.statusText);
            // Используем дефолтные настройки при ошибке
            const data = {
                system_name: 'FK QORASUV',
                working_days: [1, 2, 3, 4, 5],
                work_start_time: '09:00',
                work_end_time: '21:00',
                max_groups_per_slot: 4,
                block_future_payments: false,
                rewards_reset_period_months: 1,
                podium_display_count: 20
            };
            populateSettingsForm(data);
            return;
        }
        const data = await resp.json();
        populateSettingsForm(data);
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        // Используем дефолтные настройки при ошибке
        populateSettingsForm({
            system_name: 'FK QORASUV',
            working_days: [1, 2, 3, 4, 5],
            work_start_time: '09:00',
            work_end_time: '21:00',
            max_groups_per_slot: 4,
            block_future_payments: false,
            rewards_reset_period_months: 1,
            podium_display_count: 20
        });
    }
}

function populateSettingsForm(data) {
    const systemNameEl = document.getElementById('system_name');
    if (systemNameEl) systemNameEl.value = data.system_name || '';
    
    setWorkingDays(data.working_days || []);
    
    const workStartTimeEl = document.getElementById('work_start_time');
    if (workStartTimeEl) workStartTimeEl.value = data.work_start_time || '09:00';
    
    const workEndTimeEl = document.getElementById('work_end_time');
    if (workEndTimeEl) workEndTimeEl.value = data.work_end_time || '21:00';
    
    const maxGroupsEl = document.getElementById('max_groups_per_slot');
    if (maxGroupsEl) maxGroupsEl.value = data.max_groups_per_slot || 1;
    
    const blockFutureEl = document.getElementById('block_future_payments');
    if (blockFutureEl) blockFutureEl.checked = !!data.block_future_payments;
    
    const rewardsResetEl = document.getElementById('rewards_reset_period_months');
    if (rewardsResetEl) rewardsResetEl.value = data.rewards_reset_period_months || 1;
    
    // Убедимся, что значение кратно 5 и в диапазоне 5-50
    const podiumValue = data.podium_display_count || 20;
    const normalizedPodiumValue = Math.max(5, Math.min(50, Math.round(podiumValue / 5) * 5));
    const podiumEl = document.getElementById('podium_display_count');
    if (podiumEl) podiumEl.value = normalizedPodiumValue;
        // Загружаем настройки Telegram (если элементы существуют)
        const telegramTokenEl = document.getElementById('telegram_bot_token');
        const telegramNotificationEl = document.getElementById('telegram_notification_template');
        const telegramRewardEl = document.getElementById('telegram_reward_template');
        const telegramCardEl = document.getElementById('telegram_card_template');
        
        if (telegramTokenEl) {
            telegramTokenEl.value = data.telegram_bot_token || '';
        }
        if (telegramNotificationEl) {
            telegramNotificationEl.value = data.telegram_notification_template || '📅 Напоминание: занятие группы {group_name} через 3 часа в {time}.\n\n{additional_text}';
        }
        if (telegramRewardEl) {
            telegramRewardEl.value = data.telegram_reward_template || '⭐ Вам выдано вознаграждение!\n\nТип: {reward_name}\nБаллы: +{points}\nВсего баллов за месяц: {total_points}\n\n{reason}';
        }
        if (telegramCardEl) {
            telegramCardEl.value = data.telegram_card_template || '🟨 Вам выдана карточка!\n\nТип: {card_name}\nПричина: {reason}';
        }
        const telegramPaymentEl = document.getElementById('telegram_payment_template');
        if (telegramPaymentEl) {
            telegramPaymentEl.value = data.telegram_payment_template || '💳 Оплата получена!\n\nФИО: {full_name}\nДата оплаты: {payment_date}\nМесяц: {month}\nТип оплаты: {payment_type}\nСумма оплаты: {amount_paid} сум{debt_info}';
        }
        const notificationHoursEl = document.getElementById('notification_hours_before');
        if (notificationHoursEl) {
            notificationHoursEl.value = data.notification_hours_before || '';
        }
}

async function saveSettings() {
    const system_name = document.getElementById('system_name').value.trim();
    const working_days = collectWorkingDays();
    const work_start_time = document.getElementById('work_start_time').value;
    const work_end_time = document.getElementById('work_end_time').value;
    const max_groups_per_slot = parseInt(document.getElementById('max_groups_per_slot').value, 10);
    const block_future_payments = document.getElementById('block_future_payments').checked;
    const rewards_reset_period_months = parseInt(document.getElementById('rewards_reset_period_months').value, 10);
        const podium_display_count = parseInt(document.getElementById('podium_display_count').value, 10);
        
        // Получаем настройки Telegram (если элементы существуют)
        const telegramTokenEl = document.getElementById('telegram_bot_token');
        const telegramNotificationEl = document.getElementById('telegram_notification_template');
        const telegramRewardEl = document.getElementById('telegram_reward_template');
        const telegramCardEl = document.getElementById('telegram_card_template');
        
        const telegram_bot_token = telegramTokenEl ? telegramTokenEl.value.trim() : '';
        const telegram_notification_template = telegramNotificationEl ? telegramNotificationEl.value.trim() : '';
        const telegram_reward_template = telegramRewardEl ? telegramRewardEl.value.trim() : '';
        const telegram_card_template = telegramCardEl ? telegramCardEl.value.trim() : '';
        const telegramPaymentEl = document.getElementById('telegram_payment_template');
        const telegram_payment_template = telegramPaymentEl ? telegramPaymentEl.value.trim() : '';
        const notificationHoursEl = document.getElementById('notification_hours_before');
        const notification_hours_before = notificationHoursEl ? (notificationHoursEl.value || null) : null;

    if (!system_name) {
        alert('Введите название системы');
        return;
    }

    if (rewards_reset_period_months < 1 || rewards_reset_period_months > 12) {
        alert('Период сброса вознаграждений должен быть от 1 до 12 месяцев');
        return;
    }

    if (podium_display_count < 5 || podium_display_count > 50 || podium_display_count % 5 !== 0) {
        alert('Отображение пьедестала должно быть от 5 до 50 учеников с шагом 5');
        return;
    }

    try {
        const resp = await fetch('/api/club-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_name,
                working_days,
                work_start_time,
                work_end_time,
                max_groups_per_slot,
                block_future_payments,
                rewards_reset_period_months,
                podium_display_count,
                telegram_bot_token,
                telegram_notification_template,
                telegram_reward_template,
                telegram_card_template,
                telegram_payment_template,
                notification_hours_before: notification_hours_before ? parseInt(notification_hours_before, 10) : null
            })
        });
        
        let data;
        try {
            data = await resp.json();
        } catch (e) {
            // Если ответ не JSON
            if (!resp.ok) {
                alert('Ошибка сохранения настроек: ' + resp.statusText);
                return;
            }
            data = { success: true };
        }
        
        if (resp.ok && data.success) {
            alert('Настройки сохранены');
        } else {
            alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        alert('Не удалось сохранить настройки: ' + (error.message || 'неизвестная ошибка'));
    }
}

// Функция для сохранения настроек Telegram
async function saveTelegramSettings() {
    const telegram_bot_token = document.getElementById('telegram_bot_token').value.trim();
    const telegram_notification_template = document.getElementById('telegram_notification_template').value.trim();
    const telegram_reward_template = document.getElementById('telegram_reward_template').value.trim();
    const telegram_card_template = document.getElementById('telegram_card_template').value.trim();
    const telegram_payment_template = document.getElementById('telegram_payment_template').value.trim();

    try {
        const resp = await fetch('/api/club-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_name: document.getElementById('system_name').value.trim() || 'FK QORASUV',
                working_days: collectWorkingDays(),
                work_start_time: document.getElementById('work_start_time').value,
                work_end_time: document.getElementById('work_end_time').value,
                max_groups_per_slot: parseInt(document.getElementById('max_groups_per_slot').value, 10),
                block_future_payments: document.getElementById('block_future_payments').checked,
                rewards_reset_period_months: parseInt(document.getElementById('rewards_reset_period_months').value, 10),
                podium_display_count: parseInt(document.getElementById('podium_display_count').value, 10),
                telegram_bot_token,
                telegram_notification_template,
                telegram_reward_template,
                telegram_card_template,
                telegram_payment_template
            })
        });

        let result;
        try {
            result = await resp.json();
        } catch (e) {
            // Если ответ не JSON
            if (!resp.ok) {
                alert('Ошибка сохранения настроек Telegram: ' + resp.statusText);
                return;
            }
            result = { success: true };
        }
        
        if (resp.ok && result.success) {
            alert('Настройки Telegram сохранены!');
        } else {
            alert('Ошибка: ' + (result.message || 'Не удалось сохранить настройки'));
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек Telegram:', error);
        alert('Не удалось сохранить настройки Telegram: ' + (error.message || 'неизвестная ошибка'));
    }
}


