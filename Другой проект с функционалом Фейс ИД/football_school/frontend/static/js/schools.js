// Управление школами

const AVAILABLE_FEATURES = [
    { name: 'telegram_bot', label: 'Telegram бот' },
    { name: 'rewards', label: 'Система вознаграждений' },
    { name: 'cards', label: 'Система карточек' },
    { name: 'face_recognition', label: 'Распознавание лиц' },
    { name: 'attendance', label: 'Посещаемость' },
    { name: 'payments', label: 'Платежи' },
    { name: 'finances', label: 'Финансы' }
];

// Загрузить список школ
async function loadSchools() {
    try {
        console.log('Fetching schools from /api/schools...');
        const response = await fetch('/api/schools');
        
        if (!response.ok) {
            if (response.status === 403) {
                alert('Доступ запрещён. Убедитесь, что вы вошли как супер-администратор.');
                console.error('Access denied. User role:', response.status);
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Schools data received:', data);
        
        if (data.success) {
            renderSchoolsList(data.schools);
        } else {
            console.error('Failed to load schools:', data.message);
            document.getElementById('schoolsList').innerHTML = 
                `<p style="text-align: center; color: var(--theme-text-danger);">Ошибка: ${data.message || 'Не удалось загрузить школы'}</p>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки школ:', error);
        document.getElementById('schoolsList').innerHTML = 
            `<p style="text-align: center; color: var(--theme-text-danger);">Ошибка загрузки: ${error.message}</p>`;
    }
}

// Отобразить текущую школу (для супер-админа - только просмотр)
function renderCurrentSchool(school) {
    // Эта функция больше не используется для супер-админа
    // Супер-админ не переключается между школами, он только управляет ими
}

// Отобразить список школ
function renderSchoolsList(schools) {
    const container = document.getElementById('schoolsList');
    if (!container) {
        console.error('[Schools] Container schoolsList not found!');
        return;
    }
    
    console.log('[Schools] Rendering schools list, count:', schools ? schools.length : 0);
    
        if (!schools || schools.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 60px 40px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🏫</div>
                    <h3 style="color: var(--theme-text-primary); margin: 0 0 12px 0; font-size: 1.25rem;">Школы не найдены</h3>
                    <p style="color: var(--theme-text-tertiary); margin-bottom: 24px; font-size: 0.95rem;">
                        Нажмите кнопку "+ Добавить школу" чтобы создать первую школу.
                    </p>
                    <button class="btn-primary" onclick="openAddSchoolModal()">➕ Добавить школу</button>
                </td>
            </tr>`;
        return;
    }
    
    const html = schools.map(school => {
        // Подсчитать включенные функции
        const enabledFeatures = school.features.filter(f => f.enabled).length;
        const totalFeatures = school.features.length;
        
        // Сформировать список функций (первые 3, остальные "+N")
        const featuresList = school.features
            .filter(f => f.enabled)
            .slice(0, 3)
            .map(f => {
                const featureLabel = AVAILABLE_FEATURES.find(af => af.name === f.feature_name)?.label || f.feature_name;
                return featureLabel;
            });
        const remainingCount = enabledFeatures - featuresList.length;
        
        return `
            <tr>
                <td>
                    <strong style="color: var(--theme-text-primary); font-size: 0.95rem;">${school.name}</strong>
                    <div style="color: var(--theme-text-tertiary); font-size: 0.85rem; margin-top: 4px;">ID: ${school.id}</div>
                </td>
                <td>
                    ${school.contact_person ? `<span style="color: var(--theme-text-primary);">${school.contact_person}</span>` : '<span style="color: var(--theme-text-tertiary);">—</span>'}
                </td>
                <td>
                    ${school.address ? `<span style="color: var(--theme-text-primary);">${school.address}</span>` : '<span style="color: var(--theme-text-tertiary);">—</span>'}
                </td>
                <td>
                    ${school.phone ? `<span style="color: var(--theme-text-primary);">${school.phone}</span>` : '<span style="color: var(--theme-text-tertiary);">—</span>'}
                </td>
                <td>
                    ${school.is_active 
                        ? '<span style="padding: 4px 12px; background: rgba(16, 185, 129, 0.15); color: #10b981; border-radius: 12px; font-size: 0.85rem; font-weight: 500;">Активна</span>'
                        : '<span style="padding: 4px 12px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border-radius: 12px; font-size: 0.85rem; font-weight: 500;">Заблокирована</span>'}
                </td>
                <td>
                    ${school.owner_username 
                        ? `<span style="font-family: monospace; color: var(--theme-text-primary); font-size: 0.9rem;">${school.owner_username}</span>`
                        : '<span style="color: var(--theme-text-tertiary);">—</span>'}
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 300px;">
                        ${school.features.map(f => {
                            const featureLabel = AVAILABLE_FEATURES.find(af => af.name === f.feature_name)?.label || f.feature_name;
                            return `
                                <span style="padding: 4px 10px; background: ${f.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${f.enabled ? '#10b981' : '#ef4444'}; border-radius: 12px; font-size: 0.75rem; font-weight: 500; white-space: nowrap;">
                                    ${f.enabled ? '✓' : '✗'} ${featureLabel}
                                </span>
                            `;
                        }).join('')}
                    </div>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-secondary" onclick="editSchool(${school.id})" style="padding: 6px 12px; font-size: 0.85rem; white-space: nowrap;">Редактировать</button>
                        <button class="${school.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleSchoolStatus(${school.id}, ${!school.is_active})" style="padding: 6px 12px; font-size: 0.85rem; white-space: nowrap;">
                            ${school.is_active ? 'Отключить' : 'Включить'}
                        </button>
                        <button class="btn-danger delete-school-btn" data-school-id="${school.id}" data-school-name="${school.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" style="padding: 6px 12px; font-size: 0.85rem; white-space: nowrap;">🗑️ Удалить</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Добавить обработчики событий для кнопок удаления
    document.querySelectorAll('.delete-school-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const schoolId = parseInt(this.getAttribute('data-school-id'));
            const schoolName = this.getAttribute('data-school-name');
            deleteSchool(schoolId, schoolName);
        });
    });
}

// Открыть модальное окно добавления школы
function openAddSchoolModal() {
    document.getElementById('modalTitle').textContent = 'Добавить школу';
    document.getElementById('schoolForm').reset();
    document.getElementById('schoolId').value = '';
    document.getElementById('schoolStatus').value = 'true';
    
    // Показать поля логина/пароля при создании
    document.getElementById('adminUsernameCard').style.display = 'block';
    document.getElementById('adminPasswordCard').style.display = 'block';
    document.getElementById('adminUsername').required = true;
    document.getElementById('adminPassword').required = true;
    document.getElementById('passwordHint').style.display = 'none'; // Скрываем подсказку при создании
    
    renderFeaturesList();
    document.getElementById('schoolModal').style.display = 'flex';
}

// Открыть модальное окно редактирования школы
async function editSchool(schoolId) {
    try {
        const response = await fetch(`/api/schools/${schoolId}`);
        const data = await response.json();
        
        if (data.success) {
            const school = data.school;
            console.log('[Edit School] School data:', school);
            console.log('[Edit School] Admin info:', school.admin_info);
            
            // Сбрасываем форму перед заполнением
            document.getElementById('schoolForm').reset();
            
            document.getElementById('modalTitle').textContent = 'Редактировать школу';
            document.getElementById('schoolId').value = school.id;
            document.getElementById('schoolName').value = school.name || '';
            document.getElementById('schoolContactPerson').value = school.contact_person || '';
            document.getElementById('schoolAddress').value = school.address || '';
            document.getElementById('schoolPhone').value = school.phone || '';
            document.getElementById('schoolStatus').value = school.is_active ? 'true' : 'false';
            
            // При редактировании показываем поля логина/пароля, но делаем пароль необязательным
            document.getElementById('adminUsernameCard').style.display = 'block';
            document.getElementById('adminPasswordCard').style.display = 'block';
            document.getElementById('adminUsername').required = true;
            document.getElementById('adminPassword').required = false; // Пароль необязателен при редактировании
            document.getElementById('passwordHint').style.display = 'block';
            
            // Заполняем логин владельца
            const adminUsernameField = document.getElementById('adminUsername');
            if (school.owner_username) {
                adminUsernameField.value = school.owner_username;
                console.log('[Edit School] Set owner username to:', school.owner_username);
            } else {
                adminUsernameField.value = '';
                console.log('[Edit School] No owner username found, cleared username field');
            }
            document.getElementById('adminPassword').value = ''; // Пароль не показываем
            
            renderFeaturesList(school.features);
            document.getElementById('schoolModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Ошибка загрузки школы:', error);
        alert('Не удалось загрузить данные школы');
    }
}

// Отобразить список функций с переключателями
function renderFeaturesList(existingFeatures = []) {
    const container = document.getElementById('featuresList');
    
    const html = AVAILABLE_FEATURES.map(feature => {
        const existing = existingFeatures.find(f => f.feature_name === feature.name);
        const enabled = existing ? existing.enabled : true;
        
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--theme-bg-secondary); border-radius: 12px; border: 1px solid var(--theme-border);">
                <span style="font-weight: 500; color: var(--theme-text-primary); font-size: 0.95rem;">${feature.label}</span>
                <label class="toggle-switch">
                    <input type="checkbox" data-feature="${feature.name}" ${enabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Закрыть модальное окно
function closeSchoolModal() {
    document.getElementById('schoolModal').style.display = 'none';
}

// Сохранить школу
async function saveSchool() {
    const form = document.getElementById('schoolForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const schoolId = document.getElementById('schoolId').value;
    const name = document.getElementById('schoolName').value.trim();
    const contactPerson = document.getElementById('schoolContactPerson').value.trim() || null;
    const address = document.getElementById('schoolAddress').value.trim() || null;
    const phone = document.getElementById('schoolPhone').value.trim() || null;
    const isActive = document.getElementById('schoolStatus').value === 'true';
    
    // Данные админа (при создании обязательны, при редактировании опциональны)
    const adminUsername = document.getElementById('adminUsername').value.trim();
    const adminPassword = document.getElementById('adminPassword').value;
    
    // Собираем функции
    const features = {};
    AVAILABLE_FEATURES.forEach(feature => {
        const checkbox = document.querySelector(`input[data-feature="${feature.name}"]`);
        features[feature.name] = checkbox.checked;
    });
    
    try {
        const url = schoolId ? `/api/schools/${schoolId}` : '/api/schools';
        const method = schoolId ? 'PUT' : 'POST';
        
        const body = {
            name,
            contact_person: contactPerson,
            address,
            phone,
            is_active: isActive,
            features
        };
        
        // Добавляем данные владельца
        if (!schoolId) {
            // При создании - обязательны
            body.owner_username = adminUsername;
            body.owner_password = adminPassword;
        } else {
            // При редактировании - опциональны (только если заполнены)
            if (adminUsername) {
                body.owner_username = adminUsername;
            }
            if (adminPassword) {
                body.owner_password = adminPassword;
            }
        }
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeSchoolModal();
            loadSchools();
            
            // При создании показываем сообщение
            if (!schoolId) {
                alert(`Школа "${name}" создана успешно!\n\nЛогин владельца: ${adminUsername}\n\nСохраните эти данные!`);
            } else {
                alert('Школа сохранена успешно');
            }
        } else {
            alert('Ошибка: ' + (data.message || 'Не удалось сохранить школу'));
        }
    } catch (error) {
        console.error('Ошибка сохранения школы:', error);
        alert('Ошибка при сохранении школы');
    }
}

// Включить/отключить школу
async function toggleSchoolStatus(schoolId, newStatus) {
    const action = newStatus ? 'включить' : 'отключить';
    if (!confirm(`Вы уверены, что хотите ${action} эту школу?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/schools/${schoolId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Школа ${newStatus ? 'включена' : 'отключена'} успешно`);
            loadSchools();
        } else {
            alert('Ошибка: ' + (data.message || 'Не удалось изменить статус школы'));
        }
    } catch (error) {
        console.error('Ошибка изменения статуса школы:', error);
        alert('Ошибка при изменении статуса школы');
    }
}

// Удалить школу
async function deleteSchool(schoolId, schoolName) {
    const confirmMessage = `⚠️ ВНИМАНИЕ! ⚠️\n\n` +
        `Вы собираетесь удалить школу "${schoolName}".\n\n` +
        `Это действие НЕОБРАТИМО и удалит:\n` +
        `• Всех учеников школы\n` +
        `• Все группы\n` +
        `• Всех пользователей школы\n` +
        `• Все платежи и финансовые данные\n` +
        `• Все настройки и конфигурации\n\n` +
        `Вы уверены, что хотите продолжить?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Дополнительное подтверждение
    if (!confirm('Это последнее предупреждение! Нажмите OK для окончательного удаления школы.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/schools/${schoolId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message || 'Школа успешно удалена');
            loadSchools();
        } else {
            alert('Ошибка: ' + (data.message || 'Не удалось удалить школу'));
        }
    } catch (error) {
        console.error('Ошибка удаления школы:', error);
        alert('Ошибка при удалении школы: ' + error.message);
    }
}

// Закрытие модального окна при клике вне его
document.getElementById('schoolModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeSchoolModal();
    }
});

// Проверка, что мы на странице школ
function isSchoolsPage() {
    return window.location.pathname === '/schools' || window.location.pathname.includes('schools');
}

// Загрузить при старте страницы
if (isSchoolsPage()) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[Schools] Page loaded, initializing...');
        console.log('[Schools] Current URL:', window.location.href);
        console.log('[Schools] Add button exists:', !!document.getElementById('addSchoolBtn'));
        
        // Загрузить список школ
        loadSchools();
        
        // Проверить, что функции доступны
        console.log('[Schools] Functions available:', {
            loadSchools: typeof loadSchools,
            openAddSchoolModal: typeof openAddSchoolModal,
            renderSchoolsList: typeof renderSchoolsList
        });
    });
    
    // Также попробовать загрузить сразу (на случай если DOM уже загружен)
    if (document.readyState === 'loading') {
        // DOM ещё загружается
    } else {
        // DOM уже загружен
        console.log('[Schools] DOM already loaded, loading schools immediately...');
        loadSchools();
    }
}

