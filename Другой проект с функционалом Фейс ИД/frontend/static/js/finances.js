// Сохранение активной вкладки в localStorage
function saveActiveFinancesTab(tabName) {
    localStorage.setItem('finances_active_tab', tabName);
}

// Восстановление активной вкладки из localStorage
function restoreActiveFinancesTab() {
    const savedTab = localStorage.getItem('finances_active_tab');
    if (savedTab) {
        // Небольшая задержка для загрузки DOM
        setTimeout(() => {
            const tab = document.querySelector(`.tab[data-tab="${savedTab}"]`);
            if (tab) {
                // Убрать активный класс со всех вкладок
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                
                // Активировать сохраненную вкладку
                tab.classList.add('active');
                const tabName = savedTab;
                const actualTabName = tabName === 'balance' ? 'balance' : tabName;
                const tabElement = document.getElementById(`${actualTabName}-tab`);
                if (tabElement) {
                    tabElement.classList.add('active');
                }
                
                // Показать/скрыть кнопки в зависимости от активной вкладки
                const incomeButtons = document.getElementById('income-tab-buttons');
                if (incomeButtons) {
                    incomeButtons.style.display = tabName === 'income' ? 'flex' : 'none';
                }
                
                const expensesButtons = document.getElementById('expenses-tab-buttons');
                if (expensesButtons) {
                    expensesButtons.style.display = tabName === 'expenses' ? 'flex' : 'none';
                }
                
                const cashButtons = document.getElementById('cash-tab-buttons');
                if (cashButtons) {
                    cashButtons.style.display = tabName === 'cash' ? 'flex' : 'none';
                }
                
                // Загрузить данные для вкладки, если нужно
                if (tabName === 'cash' && typeof loadCashTransfers === 'function' && typeof loadCashBalance === 'function') {
                    setTimeout(() => {
                        loadCashBalance();
                        loadCashTransfers();
                    }, 100);
                } else if (tabName === 'debtors' && typeof loadDebtors === 'function') {
                    setTimeout(() => {
                        loadDebtors();
                    }, 100);
                }
            }
        }, 100);
    }
}

// Переключение вкладок
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        
        // Сохранить активную вкладку
        saveActiveFinancesTab(tabName);
        
        // Убрать активный класс со всех вкладок
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        
        // Активировать выбранную вкладку
        tab.classList.add('active');
        
        // Обработать вкладку "balance" как "debtors" для совместимости
        const actualTabName = tabName === 'balance' ? 'balance' : tabName;
        const tabElement = document.getElementById(`${actualTabName}-tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }
        
        // Показать/скрыть кнопки в зависимости от активной вкладки
        const incomeButtons = document.getElementById('income-tab-buttons');
        if (incomeButtons) {
            incomeButtons.style.display = tabName === 'income' ? 'flex' : 'none';
        }
        
        const expensesButtons = document.getElementById('expenses-tab-buttons');
        if (expensesButtons) {
            expensesButtons.style.display = tabName === 'expenses' ? 'flex' : 'none';
        }
        
        const cashButtons = document.getElementById('cash-tab-buttons');
        if (cashButtons) {
            cashButtons.style.display = tabName === 'cash' ? 'flex' : 'none';
        }
        
        // Загрузить данные кассы при переключении на вкладку
        if (tabName === 'cash' && typeof loadCashTransfers === 'function' && typeof loadCashBalance === 'function') {
            setTimeout(() => {
                loadCashBalance();
                loadCashTransfers();
            }, 100);
        }
    });
});

// Показать кнопки при загрузке страницы, если активна соответствующая вкладка
document.addEventListener('DOMContentLoaded', () => {
    // Проверить хэш в URL для автоматического переключения на вкладку
    const hash = window.location.hash.substring(1); // убираем #
    let activeTabName = null;
    
    // Сначала проверить сохраненную вкладку, если нет хэша в URL
    if (!hash) {
        restoreActiveFinancesTab();
        // Получить активную вкладку после восстановления
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            activeTabName = activeTab.getAttribute('data-tab');
        }
    } else if (hash === 'cash') {
        activeTabName = 'cash';
        // Переключить на вкладку cash
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        
        const cashTab = document.querySelector('.tab[data-tab="cash"]');
        const cashContent = document.getElementById('cash-tab');
        if (cashTab && cashContent) {
            cashTab.classList.add('active');
            cashContent.classList.add('active');
        }
        saveActiveFinancesTab('cash');
    }
    
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabName = activeTab.getAttribute('data-tab');
        const incomeButtons = document.getElementById('income-tab-buttons');
        const expensesButtons = document.getElementById('expenses-tab-buttons');
        const cashButtons = document.getElementById('cash-tab-buttons');
        
        if (tabName === 'income' && incomeButtons) {
            incomeButtons.style.display = 'flex';
        }
        if (tabName === 'expenses' && expensesButtons) {
            expensesButtons.style.display = 'flex';
        }
        if (tabName === 'cash' && cashButtons) {
            cashButtons.style.display = 'flex';
        }
    }
});

// Хранилище данных прихода/расходов
let allIncomeData = [];
let allExpenseData = [];

// Загрузка данных прихода
async function loadIncome() {
    try {
        const response = await fetch('/api/finances/income');
        const data = await response.json();
        
        // Статистика (элементы удалены из UI, но данные остаются для возможного использования)
        const incomeTodayEl = document.getElementById('income-today');
        const incomeMonthEl = document.getElementById('income-month');
        const incomeTotalEl = document.getElementById('income-total');
        if (incomeTodayEl) incomeTodayEl.textContent = data.today.toLocaleString('ru-RU') + ' сум';
        if (incomeMonthEl) incomeMonthEl.textContent = data.month.toLocaleString('ru-RU') + ' сум';
        if (incomeTotalEl) incomeTotalEl.textContent = data.total.toLocaleString('ru-RU') + ' сум';
        
        renderIncomeTable(data.payments || []);
    } catch (error) {
        console.error('Ошибка загрузки прихода:', error);
    }
}

// Загрузка должников
async function loadDebtors() {
    try {
        const response = await fetch('/api/finances/debtors');
        const data = await response.json();
        
        // Статистика
        document.getElementById('total-debt').textContent = data.total_debt.toLocaleString('ru-RU') + ' сум';
        document.getElementById('debtors-count').textContent = data.count;
        
        // Таблица
        const tbody = document.getElementById('debtors-table-body');
        if (data.debtors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #27ae60;">Нет должников 🎉</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.debtors.map(d => {
            return `
                <tr>
                    <td><strong>${d.student_name}</strong></td>
                    <td>${d.student_phone}</td>
                    <td>${d.tariff_name}</td>
                    <td><span style="background: #fff3cd; padding: 4px 8px; border-radius: 4px;">${d.month_label}</span></td>
                    <td>${d.amount_paid.toLocaleString('ru-RU')} сум</td>
                    <td><span class="debt-badge">${d.amount_due.toLocaleString('ru-RU')} сум</span></td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка загрузки должников:', error);
    }
}

function renderExpenseStats(expenses) {
    const today = new Date();
    const todaySum = expenses
        .filter(e => {
            const d = new Date(e.expense_date);
            return d.toDateString() === today.toDateString();
        })
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    const monthSum = expenses
        .filter(e => {
            const d = new Date(e.expense_date);
            return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
        })
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    const totalSum = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Статистика (элементы удалены из UI, но данные остаются для возможного использования)
    const expenseTodayEl = document.getElementById('expense-today');
    const expenseMonthEl = document.getElementById('expense-month');
    const expenseTotalEl = document.getElementById('expense-total');
    if (expenseTodayEl) expenseTodayEl.textContent = todaySum.toLocaleString('ru-RU') + ' сум';
    if (expenseMonthEl) expenseMonthEl.textContent = monthSum.toLocaleString('ru-RU') + ' сум';
    if (expenseTotalEl) expenseTotalEl.textContent = totalSum.toLocaleString('ru-RU') + ' сум';
}

function renderExpenseTable(expenses) {
    const tbody = document.getElementById('expense-table-body');
    if (!expenses || expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #95a5a6;">Нет расходов</td></tr>';
        return;
    }

    tbody.innerHTML = expenses.map(e => {
        const date = e.expense_date ? new Date(e.expense_date).toLocaleDateString('ru-RU') : '-';
        return `
            <tr>
                <td>${date}</td>
                <td><span style="color: #e74c3c;">${e.category}</span></td>
                <td><strong>${Number(e.amount || 0).toLocaleString('ru-RU')} сум</strong></td>
                <td>${e.description || '-'}</td>
                <td>
                    <button class="btn-small btn-info edit-expense-btn" 
                            data-expense-id="${e.id}"
                            data-category="${e.category}"
                            data-amount="${e.amount}"
                            data-description="${e.description || ''}">
                        ✏️
                    </button>
                    <button class="btn-small btn-danger delete-expense-btn" 
                            data-expense-id="${e.id}">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Загрузка расходов
async function loadExpenses() {
    try {
        const response = await fetch('/api/finances/expenses');
        const data = await response.json();
        allExpenseData = data.expenses || [];
        renderExpenseStats(allExpenseData);
        renderExpenseTable(allExpenseData);
    } catch (error) {
        console.error('Ошибка загрузки расходов:', error);
    }
}

// Загрузка аналитики
async function loadAnalytics() {
    try {
        const response = await fetch('/api/finances/analytics');
        const data = await response.json();
        
        // Таблица
        const tbody = document.getElementById('analytics-table-body');
        if (data.months.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #95a5a6;">Нет данных</td></tr>';
            return;
        }
        
        // Подсчёт итогов
        const totalIncome = data.months.reduce((acc, m) => acc + Number(m.income || 0), 0);
        const totalExpense = data.months.reduce((acc, m) => acc + Number(m.expense || 0), 0);
        const totalBalance = totalIncome - totalExpense;

        const rows = data.months.map(m => {
            const balance = m.income - m.expense;
            const balanceColor = balance >= 0 ? '#27ae60' : '#e74c3c';
            
            return `
                <tr>
                    <td><strong>${m.month_name}</strong></td>
                    <td style="color: #27ae60;">${m.income.toLocaleString('ru-RU')} сум</td>
                    <td style="color: #e74c3c;">${m.expense.toLocaleString('ru-RU')} сум</td>
                    <td style="color: ${balanceColor}; font-weight: bold;">
                        ${balance >= 0 ? '+' : ''}${balance.toLocaleString('ru-RU')} сум
                    </td>
                </tr>
            `;
        }).join('');

        const totalRow = `
            <tr style="background: #f8f9fa; font-weight: bold;">
                <td>Итого за 12 мес.</td>
                <td style="color: #27ae60;">${totalIncome.toLocaleString('ru-RU')} сум</td>
                <td style="color: #e74c3c;">${totalExpense.toLocaleString('ru-RU')} сум</td>
                <td style="color: ${totalBalance >= 0 ? '#27ae60' : '#e74c3c'};">
                    ${totalBalance >= 0 ? '+' : ''}${totalBalance.toLocaleString('ru-RU')} сум
                </td>
            </tr>
        `;

        tbody.innerHTML = rows + totalRow;
        
        // График (простая визуализация без Chart.js)
        drawSimpleChart(data.months);
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
    }
}

// Простой график на Canvas
function drawSimpleChart(months) {
    const canvas = document.getElementById('financeChart');
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (months.length === 0) {
        ctx.fillStyle = '#95a5a6';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных для отображения', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const padding = 25;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    
    const maxValueRaw = Math.max(...months.map(m => Math.max(m.income, m.expense)));
    const maxValue = maxValueRaw > 0 ? maxValueRaw : 1; // избежать деления на 0
    const barWidth = chartWidth / (months.length * 2 + 1);
    
    months.forEach((m, i) => {
        const x = padding + i * barWidth * 2 + barWidth / 2;
        
        // Приход (зелёный)
        const incomeHeight = (m.income / maxValue) * chartHeight;
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(x, padding + chartHeight - incomeHeight, barWidth * 0.8, incomeHeight);
        
        // Расход (красный)
        const expenseHeight = (m.expense / maxValue) * chartHeight;
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + barWidth, padding + chartHeight - expenseHeight, barWidth * 0.8, expenseHeight);
        
        // Подпись месяца
        ctx.fillStyle = '#2c3e50';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(m.month_name, x + barWidth, canvas.height - 5);
    });
    
    // Легенда
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(padding, 6, 12, 10);
    ctx.fillStyle = '#2c3e50';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Приход', padding + 18, 14);
    
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(padding + 70, 6, 12, 10);
    ctx.fillText('Расход', padding + 88, 14);
}

// Загрузить группы для фильтра прихода
async function loadIncomeGroups() {
    try {
        const response = await fetch('/api/groups');
        const groups = await response.json();
        const groupSelect = document.getElementById('income-group-filter');
        if (groupSelect) {
            groupSelect.innerHTML = '<option value="">Выберите группу</option>' +
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки групп:', error);
    }
}

// Загрузить учеников выбранной группы
async function loadGroupStudents(groupId) {
    const studentInput = document.getElementById('income-student-filter');
    const studentsList = document.getElementById('income-students-list');
    
    if (!groupId) {
        studentInput.disabled = true;
        studentInput.placeholder = 'Сначала выберите группу...';
        studentsList.innerHTML = '';
        studentInput.value = '';
        return;
    }
    
    try {
        const response = await fetch('/api/students');
        const students = await response.json();
        const groupStudents = students.filter(s => s.group_id == groupId && s.status === 'active');
        
        studentsList.innerHTML = groupStudents.map(s => 
            `<option value="${s.full_name}">${s.full_name} (${s.student_number})</option>`
        ).join('');
        
        studentInput.disabled = false;
        studentInput.placeholder = 'Поиск по имени...';
    } catch (error) {
        console.error('Ошибка загрузки учеников:', error);
        studentInput.disabled = true;
        studentInput.placeholder = 'Ошибка загрузки...';
    }
}

// Обработчик изменения группы
document.addEventListener('DOMContentLoaded', () => {
    const groupFilter = document.getElementById('income-group-filter');
    if (groupFilter) {
        groupFilter.addEventListener('change', (e) => {
            loadGroupStudents(e.target.value);
            // Сбросить выбор ученика при смене группы
            document.getElementById('income-student-filter').value = '';
        });
    }
});

// ==================== FILTER TOGGLE FUNCTIONALITY ====================

// Переключение фильтра для прихода
function toggleIncomeFilter() {
    const filterPanel = document.getElementById('incomeFilterPanel');
    const filterToggleBtn = document.getElementById('incomeFilterToggleBtn');
    const filterToggleText = document.getElementById('incomeFilterToggleText');
    
    if (filterPanel && filterToggleBtn && filterToggleText) {
        if (filterPanel.style.display === 'none') {
            filterPanel.style.display = 'block';
            filterToggleText.textContent = 'Скрыть фильтр';
            filterToggleBtn.classList.add('active');
        } else {
            filterPanel.style.display = 'none';
            filterToggleText.textContent = 'Фильтр';
            filterToggleBtn.classList.remove('active');
        }
    }
}

// Переключение фильтра для расходов
function toggleExpenseFilter() {
    const filterPanel = document.getElementById('expenseFilterPanel');
    const filterToggleBtn = document.getElementById('expenseFilterToggleBtn');
    const filterToggleText = document.getElementById('expenseFilterToggleText');
    
    if (filterPanel && filterToggleBtn && filterToggleText) {
        if (filterPanel.style.display === 'none') {
            filterPanel.style.display = 'block';
            filterToggleText.textContent = 'Скрыть фильтр';
            filterToggleBtn.classList.add('active');
        } else {
            filterPanel.style.display = 'none';
            filterToggleText.textContent = 'Фильтр';
            filterToggleBtn.classList.remove('active');
        }
    }
}

// Инициализация кнопок фильтров
document.addEventListener('DOMContentLoaded', () => {
    const incomeFilterToggleBtn = document.getElementById('incomeFilterToggleBtn');
    if (incomeFilterToggleBtn) {
        incomeFilterToggleBtn.addEventListener('click', toggleIncomeFilter);
    }
    
    const expenseFilterToggleBtn = document.getElementById('expenseFilterToggleBtn');
    if (expenseFilterToggleBtn) {
        expenseFilterToggleBtn.addEventListener('click', toggleExpenseFilter);
    }
});

// Загрузить все данные при открытии страницы
loadIncomeGroups();
loadIncome();
loadDebtors();
loadExpenses();

// ==================== ADD INCOME MODAL ====================
const addIncomeModal = document.getElementById('addIncomeModal');
const addIncomeBtn = document.getElementById('addIncomeBtn');
const addIncomeForm = document.getElementById('addIncomeForm');

let allStudentsData = {}; // Хранилище данных учеников для доступа к фото

// Скрыть все поля кроме группы при открытии
function resetIncomeForm() {
    const studentSelectGroup = document.getElementById('student-select-group');
    const yearMonthSelectGroup = document.getElementById('year-month-select-group');
    const dateSelectGroup = document.getElementById('date-select-group');
    const paymentMethodGroup = document.getElementById('payment-method-group');
    const incomePaymentAmountGroup = document.getElementById('income-payment-amount-group');
    const notesInputGroup = document.getElementById('notes-input-group');
    
    if (studentSelectGroup) studentSelectGroup.style.display = 'none';
    if (yearMonthSelectGroup) yearMonthSelectGroup.style.display = 'none';
    if (dateSelectGroup) dateSelectGroup.style.display = 'none';
    if (paymentMethodGroup) paymentMethodGroup.style.display = 'none';
    if (incomePaymentAmountGroup) incomePaymentAmountGroup.style.display = 'none';
    if (notesInputGroup) notesInputGroup.style.display = 'none';
    
    document.getElementById('add-income-student').value = '';
    document.getElementById('add-income-year').value = '';
    document.getElementById('add-income-month').value = '';
    document.getElementById('add-income-amount').value = '';
    document.getElementById('add-income-payment-type').value = 'cash';
    document.getElementById('add-income-notes').value = '';
    
    // Сбросить кнопки типа оплаты и активировать "Наличные"
    document.querySelectorAll('.finances-payment-type-btn').forEach(btn => {
        btn.classList.remove('active');
        const border = '2px solid var(--theme-input-border)';
        const bg = 'var(--theme-input-bg)';
        const color = 'var(--theme-text-primary)';
        btn.style.border = border;
        btn.style.background = bg;
        btn.style.color = color;
    });
    
    // Активировать кнопку "Наличные"
    const cashBtn = document.querySelector('.finances-payment-type-btn[data-payment-type="cash"]');
    if (cashBtn) {
        cashBtn.classList.add('active');
        cashBtn.style.border = '2px solid #667eea';
        cashBtn.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
        cashBtn.style.color = '#667eea';
    }
    
    document.getElementById('student-photo-container').style.display = 'none';
    document.getElementById('student-photo-img').style.display = 'none';
    document.getElementById('student-photo-placeholder').style.display = 'flex';
    const maxAmountElement = document.getElementById('add-income-max-amount');
    if (maxAmountElement) {
        maxAmountElement.style.display = 'none';
    }
    document.getElementById('month-debt-info').style.display = 'none';
    
    // Установить дату оплаты по умолчанию на сегодня
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('add-income-date').value = today;
}

// Загрузить группы в модальное окно добавления прихода
async function loadIncomeModalGroups() {
    try {
        const response = await fetch('/api/groups');
        const groups = await response.json();
        const groupSelect = document.getElementById('add-income-group');
        if (groupSelect) {
            groupSelect.innerHTML = '<option value="">Выберите группу</option>' +
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            // Убедимся, что обработчик события привязан
            if (!groupSelect.hasAttribute('data-listener-attached')) {
                groupSelect.setAttribute('data-listener-attached', 'true');
                groupSelect.addEventListener('change', (e) => {
                    resetIncomeForm();
                    loadIncomeModalStudents(e.target.value);
                });
            }
        } else {
            console.error('Элемент add-income-group не найден');
        }
    } catch (error) {
        console.error('Ошибка загрузки групп:', error);
    }
}

// Загрузить учеников выбранной группы в модальное окно
async function loadIncomeModalStudents(groupId) {
    const studentSelect = document.getElementById('add-income-student');
    
    if (!groupId) {
        document.getElementById('student-select-group').style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch('/api/students');
        const students = await response.json();
        const groupStudents = students.filter(s => s.group_id == groupId && s.status === 'active');
        
        // Сохранить данные учеников для доступа к фото
        allStudentsData = {};
        groupStudents.forEach(s => {
            allStudentsData[s.id] = s;
        });
        
        studentSelect.innerHTML = '<option value="">Выберите ученика</option>' +
            groupStudents.map(s => `<option value="${s.id}" data-photo="${s.photo_path || ''}">${s.full_name} (№${s.student_number || s.id})</option>`).join('');
        
        document.getElementById('student-select-group').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки учеников:', error);
        document.getElementById('student-select-group').style.display = 'none';
    }
}

// Отобразить фото ученика
function displayStudentPhoto(studentId) {
    const student = allStudentsData[studentId];
    const photoContainer = document.getElementById('student-photo-container');
    const photoImg = document.getElementById('student-photo-img');
    const photoPlaceholder = document.getElementById('student-photo-placeholder');
    
    if (student && student.photo_path) {
        const photoPath = student.photo_path.replace('frontend/static/', '').replace(/\\/g, '/');
        photoImg.src = `/static/${photoPath}`;
        photoImg.style.display = 'block';
        photoPlaceholder.style.display = 'none';
        photoContainer.style.display = 'flex';
    } else {
        photoImg.style.display = 'none';
        photoPlaceholder.style.display = 'flex';
        photoContainer.style.display = 'flex';
    }
}

// Загрузить доступные годы и месяцы для ученика
async function loadAvailableMonths(studentId) {
    if (!studentId) {
        document.getElementById('year-month-select-group').style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/students/${studentId}/monthly-payments`);
        const data = await response.json();
        const paymentsByMonth = data.payments_by_month || {};
        const tariffPrice = data.tariff_price || 0;
        
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // Получить дату поступления ученика
        const student = allStudentsData[studentId];
        let admissionDate = null;
        let admissionYear = null;
        let admissionMonth = null;
        
        if (student && student.admission_date) {
            admissionDate = new Date(student.admission_date);
            admissionYear = admissionDate.getFullYear();
            admissionMonth = admissionDate.getMonth() + 1;
        }
        
        // Инициализация года - только текущий год
        const yearSelect = document.getElementById('add-income-year');
        yearSelect.innerHTML = '<option value="">Выберите год</option>';
        
        // Только текущий год
        yearSelect.innerHTML += `<option value="${currentYear}" selected>${currentYear}</option>`;
        
        document.getElementById('year-month-select-group').style.display = 'block';
        
        // Сохранить данные для использования при выборе месяца
        window.currentStudentPaymentData = { 
            paymentsByMonth, 
            tariffPrice, 
            currentYear, 
            currentMonth,
            admissionYear,
            admissionMonth
        };
        
        // Автоматически загрузить месяцы для текущего года
        setTimeout(() => {
            loadAvailableMonthsForYear(currentYear);
        }, 100);
    } catch (error) {
        console.error('Ошибка загрузки информации об оплате:', error);
        document.getElementById('year-month-select-group').style.display = 'none';
    }
}

// Загрузить доступные месяцы для выбранного года
function loadAvailableMonthsForYear(year) {
    if (!year || !window.currentStudentPaymentData) {
        return;
    }
    
    const { paymentsByMonth, tariffPrice, currentYear, currentMonth, admissionYear, admissionMonth } = window.currentStudentPaymentData;
    const monthSelect = document.getElementById('add-income-month');
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    monthSelect.innerHTML = '<option value="">Выберите месяц</option>';
    
    const selectedYear = parseInt(year);
    const maxMonth = (selectedYear === currentYear) ? currentMonth : 12;
    
    // Определить минимальный месяц с учетом даты поступления
    let minMonth = 1;
    if (admissionYear !== null && admissionMonth !== null) {
        // Если ученик поступил в выбранном году, начинаем с месяца поступления
        if (selectedYear === admissionYear) {
            minMonth = admissionMonth;
        }
        // Если ученик поступил позже выбранного года, не показываем месяцы
        else if (selectedYear < admissionYear) {
            document.getElementById('month-select-group').style.display = 'none';
            alert('Ученик поступил позже выбранного года');
            return;
        }
        // Если выбранный год позже года поступления, показываем все месяцы с начала года
    }
    
    for (let month = minMonth; month <= maxMonth; month++) {
        const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
        const monthData = paymentsByMonth[monthKey];
        const paidAmount = monthData ? monthData.total_paid : 0;
        const remainder = tariffPrice - paidAmount;
        
        // Пропускаем полностью оплаченные месяцы
        if (remainder <= 0) {
            continue;
        }
        
        const option = document.createElement('option');
        option.value = month;
        option.textContent = monthNames[month - 1];
        option.dataset.remainder = remainder;
        option.dataset.paid = paidAmount;
        monthSelect.appendChild(option);
    }
    
    if (monthSelect.options.length <= 1) {
        alert('Нет доступных месяцев для оплаты');
    }
}

// Обновить информацию о долге при выборе месяца
function updateMonthDebtInfo() {
    const monthSelect = document.getElementById('add-income-month');
    const selectedOption = monthSelect.options[monthSelect.selectedIndex];
    const debtInfo = document.getElementById('month-debt-info');
    
    if (selectedOption && selectedOption.value) {
        const remainder = parseFloat(selectedOption.dataset.remainder || 0);
        const paid = parseFloat(selectedOption.dataset.paid || 0);
        const tariffPrice = window.currentStudentPaymentData?.tariffPrice || 0;
        
        if (remainder > 0) {
            debtInfo.style.display = 'block';
            debtInfo.style.color = '#f39c12';
            debtInfo.textContent = `Долг: ${remainder.toLocaleString('ru-RU')} сум (Оплачено: ${paid.toLocaleString('ru-RU')} / Тариф: ${tariffPrice.toLocaleString('ru-RU')} сум)`;
            
            // Показать поля для даты, способа оплаты и суммы
            document.getElementById('date-select-group').style.display = 'block';
            document.getElementById('payment-method-group').style.display = 'block';
            document.getElementById('income-payment-amount-group').style.display = 'block';
            document.getElementById('notes-input-group').style.display = 'block';
            
            // Обновить максимальную сумму для поля суммы
            const amountInput = document.getElementById('add-income-amount');
            if (amountInput) {
                amountInput.setAttribute('max', remainder);
            }
            
            const maxAmountElement = document.getElementById('add-income-max-amount');
            if (maxAmountElement) {
                maxAmountElement.style.display = 'block';
                maxAmountElement.textContent = `Максимальная сумма: ${remainder.toLocaleString('ru-RU')} сум`;
            }
        }
    } else {
        debtInfo.style.display = 'none';
        document.getElementById('date-select-group').style.display = 'none';
        document.getElementById('payment-method-group').style.display = 'none';
        document.getElementById('income-payment-amount-group').style.display = 'none';
        document.getElementById('notes-input-group').style.display = 'none';
    }
}

// Инициализация ограничения даты оплаты
function initPaymentDateLimits() {
    const dateInput = document.getElementById('add-income-date');
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 14);
    const minDateStr = minDate.toISOString().split('T')[0];
    
    dateInput.setAttribute('max', maxDate);
    dateInput.setAttribute('min', minDateStr);
    // Значение по умолчанию устанавливается в resetIncomeForm()
}

// Открыть модальное окно добавления прихода
if (addIncomeBtn) {
    addIncomeBtn.addEventListener('click', () => {
        addIncomeModal.style.display = 'block';
        addIncomeForm.reset();
        resetIncomeForm();
        loadIncomeModalGroups();
        initPaymentDateLimits();
    });
}

// Обработчик изменения группы
document.addEventListener('DOMContentLoaded', () => {
    const groupSelect = document.getElementById('add-income-group');
    if (groupSelect) {
        // Обработчик будет привязан в loadIncomeModalGroups() после загрузки групп
        // Это предотвращает дублирование обработчиков
    }
    
    // Обработчик изменения ученика
    const studentSelect = document.getElementById('add-income-student');
    if (studentSelect) {
        studentSelect.addEventListener('change', (e) => {
            const studentId = e.target.value;
            if (studentId) {
                displayStudentPhoto(parseInt(studentId));
                loadAvailableMonths(parseInt(studentId));
            } else {
                document.getElementById('year-month-select-group').style.display = 'none';
                document.getElementById('student-photo-container').style.display = 'none';
            }
        });
    }
    
    // Обработчик изменения года
    const yearSelect = document.getElementById('add-income-year');
    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadAvailableMonthsForYear(parseInt(e.target.value));
            }
        });
    }
    
    // Обработчик изменения месяца
    const monthSelect = document.getElementById('add-income-month');
    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            updateMonthDebtInfo();
        });
    }
});

// Закрыть модальное окно добавления прихода
// Кнопка "Отмена" теперь находится в modal-header-actions и использует onclick
// Обработчик закрытия при клике вне модального окна остается ниже

// Закрыть при клике вне окна
window.addEventListener('click', (e) => {
    if (e.target === addIncomeModal) {
        addIncomeModal.style.display = 'none';
        resetIncomeForm();
    }
});

// Обработчики для кнопок выбора типа оплаты в финансах
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.finances-payment-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Убрать активное состояние со всех кнопок
            document.querySelectorAll('.finances-payment-type-btn').forEach(b => {
                b.classList.remove('active');
                const border = '2px solid var(--theme-input-border)';
                const bg = 'var(--theme-input-bg)';
                const color = 'var(--theme-text-primary)';
                b.style.border = border;
                b.style.background = bg;
                b.style.color = color;
            });
            
            // Активировать выбранную кнопку
            this.classList.add('active');
            this.style.border = '2px solid #667eea';
            this.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
            this.style.color = '#667eea';
            
            // Обновить скрытое поле
            const paymentType = this.getAttribute('data-payment-type');
            document.getElementById('add-income-payment-type').value = paymentType;
            
            // Обновить стили неактивных кнопок для светлой темы
            document.querySelectorAll('.finances-payment-type-btn:not(.active)').forEach(b => {
                if (document.body.classList.contains('theme-light')) {
                    b.style.border = '2px solid #e2e8f0';
                    b.style.background = 'white';
                    b.style.color = '#4a5568';
                } else {
                    const border = '2px solid var(--theme-input-border)';
                    const bg = 'var(--theme-input-bg)';
                    const color = 'var(--theme-text-primary)';
                    b.style.border = border;
                    b.style.background = bg;
                    b.style.color = color;
                }
            });
        });
    });
});

// Отправить форму добавления прихода
if (addIncomeForm) {
    addIncomeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const studentId = document.getElementById('add-income-student').value;
        const month = document.getElementById('add-income-month').value;
        const year = document.getElementById('add-income-year').value;
        const paymentDate = document.getElementById('add-income-date').value;
        const notes = document.getElementById('add-income-notes').value || '';
        
        // Получить тип оплаты и сумму
        const paymentType = document.getElementById('add-income-payment-type').value;
        const amount = parseFloat(document.getElementById('add-income-amount').value);
        
        if (!studentId || !month || !year || !paymentDate) {
            alert('Заполните все обязательные поля');
            return;
        }
        
        if (!amount || amount <= 0) {
            alert('Введите корректную сумму оплаты');
            return;
        }
        
        if (!paymentType) {
            alert('Выберите тип оплаты');
            return;
        }
        
        // Проверка максимальной суммы
        const maxAmount = parseFloat(document.getElementById('add-income-amount').getAttribute('max'));
        if (maxAmount !== null && !isNaN(maxAmount) && amount > maxAmount) {
            alert(`Сумма превышает остаток по тарифу. Доступно не более ${maxAmount.toLocaleString('ru-RU')} сум`);
            return;
        }
        
        // Проверка даты
        const today = new Date();
        const selectedDate = new Date(paymentDate);
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - 14);
        
        if (selectedDate > today) {
            alert('Нельзя выбрать будущую дату');
            return;
        }
        
        if (selectedDate < minDate) {
            alert('Дата оплаты не может быть раньше чем 14 дней назад');
            return;
        }
        
        try {
            const response = await fetch('/api/students/add-monthly-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    student_id: parseInt(studentId),
                    month: parseInt(month),
                    year: parseInt(year),
                    payment_date: paymentDate,
                    amount: amount,
                    payment_type: paymentType,
                    notes: notes
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                addIncomeModal.style.display = 'none';
                resetIncomeForm();
                // Перезагрузить данные прихода
                await loadIncome();
                await loadDebtors();
                alert('Оплата успешно добавлена!');
            } else {
                alert('Ошибка: ' + (result.message || 'Не удалось добавить оплату'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ошибка при добавлении оплаты');
        }
    });
}

// ==================== FILTER FUNCTIONS ====================

// Функция фильтрации прихода
async function filterIncome() {
    const dateFrom = document.getElementById('income-date-from').value;
    const dateTo = document.getElementById('income-date-to').value;
    const studentFilter = document.getElementById('income-student-filter').value.toLowerCase();
    const groupFilter = document.getElementById('income-group-filter').value;
    
    try {
        const response = await fetch('/api/finances/income');
        const data = await response.json();
        allIncomeData = data.payments;
        
        let filtered = allIncomeData.filter(p => {
            const paymentDate = new Date(p.payment_date);
            const matchDate = (!dateFrom || paymentDate >= new Date(dateFrom)) && 
                            (!dateTo || paymentDate <= new Date(dateTo));
            const matchStudent = !studentFilter || (p.student_name || '').toLowerCase().includes(studentFilter);
            const matchGroup = !groupFilter || String(p.group_id || '') === String(groupFilter);
            
            return matchDate && matchStudent && matchGroup;
        });
        
        renderIncomeTable(filtered);
    } catch (error) {
        console.error('Ошибка фильтрации прихода:', error);
    }
}

// Функция сброса фильтров прихода
function resetIncomeFilters() {
    document.getElementById('income-date-from').value = '';
    document.getElementById('income-date-to').value = '';
    const groupSelect = document.getElementById('income-group-filter');
    if (groupSelect) {
        groupSelect.value = '';
        loadGroupStudents(''); // Сбросить список учеников
    }
    const studentInput = document.getElementById('income-student-filter');
    if (studentInput) {
        studentInput.value = '';
    }
    loadIncome();
}

// Рендер таблицы прихода
function renderIncomeTable(payments) {
    const tbody = document.getElementById('income-table-body');
    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #95a5a6;">Нет данных</td></tr>';
        return;
    }
    
    // Маппинг типов оплаты на русские названия
    const paymentTypeMap = {
        'cash': 'Наличные',
        'card': 'Карта',
        'click': 'Click',
        'payme': 'Payme',
        'uzum': 'Uzum'
    };
    
    tbody.innerHTML = payments.map(p => {
        const date = new Date(p.payment_date).toLocaleDateString('ru-RU');
        const paymentType = paymentTypeMap[p.payment_type] || p.payment_type || 'Наличные';
        
        return `
            <tr>
                <td>${date}</td>
                <td>${p.student_name}</td>
                <td>${p.group_name || '-'}</td>
                <td>${p.tariff_name || '-'}</td>
                <td><strong>${p.amount_paid.toLocaleString('ru-RU')} сум</strong></td>
                <td>${paymentType}</td>
                <td>${p.notes || '-'}</td>
                <td>
                    <button class="btn-small btn-info edit-income-btn" 
                            data-payment-id="${p.id}"
                            data-student-id="${p.student_id || ''}"
                            data-amount="${p.amount_paid}"
                            data-notes="${p.notes || ''}">
                        ✏️
                    </button>
                    <button class="btn-small btn-danger delete-income-btn" 
                            data-payment-id="${p.id}">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Функция фильтрации расходов
async function filterExpenses() {
    const dateFrom = document.getElementById('expense-date-from').value;
    const dateTo = document.getElementById('expense-date-to').value;
    const category = document.getElementById('expense-category-filter').value;
    
    try {
        let source = allExpenseData || [];
        
        let filtered = source.filter(e => {
            const expenseDate = new Date(e.expense_date);
            const matchDate = (!dateFrom || expenseDate >= new Date(dateFrom)) && 
                            (!dateTo || expenseDate <= new Date(dateTo));
            const matchCategory = !category || e.category === category;
            
            return matchDate && matchCategory;
        });
        
        renderExpenseStats(filtered);
        renderExpenseTable(filtered);
    } catch (error) {
        console.error('Ошибка фильтрации расходов:', error);
    }
}

// Функция сброса фильтров расходов
function resetExpenseFilters() {
    document.getElementById('expense-date-from').value = '';
    document.getElementById('expense-date-to').value = '';
    document.getElementById('expense-category-filter').value = '';
    renderExpenseStats(allExpenseData || []);
    renderExpenseTable(allExpenseData || []);
}

// ==================== END FILTER FUNCTIONS ====================


// Модальное окно добавления расхода
const addExpenseModal = document.getElementById('addExpenseModal');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const addExpenseForm = document.getElementById('addExpenseForm');

// Открыть модальное окно
if (addExpenseBtn) {
    addExpenseBtn.addEventListener('click', () => {
        addExpenseModal.style.display = 'block';
        addExpenseForm.reset();
    });
}

// Закрыть модальное окно
const closeButtons = addExpenseModal.querySelectorAll('.close');
closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        addExpenseModal.style.display = 'none';
    });
});

// Закрыть при клике вне окна
window.addEventListener('click', (e) => {
    if (e.target === addExpenseModal) {
        addExpenseModal.style.display = 'none';
    }
});

// Отправить форму добавления расхода
addExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(addExpenseForm);
    const data = {
        category: formData.get('category'),
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description') || ''
    };
    
    try {
        const response = await fetch('/api/expenses/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            addExpenseModal.style.display = 'none';
            addExpenseForm.reset();
            // Перезагрузить данные расходов
            loadExpenses();
            alert('Расход успешно добавлен!');
        } else {
            const error = await response.json();
            alert('Ошибка: ' + (error.error || 'Не удалось добавить расход'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка при добавлении расхода');
    }
});

// ==================== EDIT EXPENSE MODAL ====================
const editExpenseModal = document.getElementById('editExpenseModal');
const editExpenseForm = document.getElementById('editExpenseForm');

// Открыть модальное окно редактирования при клике на кнопку
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-expense-btn')) {
        const btn = e.target;
        const expenseId = btn.dataset.expenseId;
        const category = btn.dataset.category;
        const amount = btn.dataset.amount;
        const description = btn.dataset.description;
        
        // Заполнить форму данными
        document.getElementById('edit-expense-id').value = expenseId;
        document.getElementById('edit-category').value = category;
        document.getElementById('edit-amount').value = amount;
        document.getElementById('edit-description').value = description;
        
        // Показать модальное окно
        editExpenseModal.style.display = 'block';
    }
});

// Закрыть модальное окно редактирования
const editCloseButtons = editExpenseModal.querySelectorAll('.close');
editCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        editExpenseModal.style.display = 'none';
    });
});

// Закрыть при клике вне окна
window.addEventListener('click', (e) => {
    if (e.target === editExpenseModal) {
        editExpenseModal.style.display = 'none';
    }
});

// Отправить форму редактирования расхода
editExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const expenseId = document.getElementById('edit-expense-id').value;
    const category = document.getElementById('edit-category').value;
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const description = document.getElementById('edit-description').value || '';
    
    const data = {
        category: category,
        amount: amount,
        description: description
    };
    
    try {
        const response = await fetch(`/api/expenses/${expenseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            editExpenseModal.style.display = 'none';
            editExpenseForm.reset();
            // Перезагрузить данные расходов
            loadExpenses();
            alert('Расход успешно обновлен!');
        } else {
            const error = await response.json();
            alert('Ошибка: ' + (error.error || 'Не удалось обновить расход'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка при обновлении расхода');
    }
});

// ==================== DELETE EXPENSE ====================
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-expense-btn');
    if (!btn) return;

    const expenseId = btn.dataset.expenseId;
    if (!expenseId) {
        console.error('Нет ID расхода для удаления');
        return;
    }
    
    if (!confirm('Удалить этот расход без возможности восстановления?')) {
        return;
    }

    try {
        const response = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok && result.success) {
            await loadExpenses();
            alert('Расход удалён');
        } else {
            alert('Ошибка: ' + (result.message || 'Не удалось удалить расход'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка при удалении расхода');
    }
});

// ==================== DELETE INCOME ====================
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-income-btn')) {
        const btn = e.target;
        const paymentId = btn.dataset.paymentId;
        
        if (!confirm('Вы уверены, что хотите удалить этот платеж?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/payments/${paymentId}/delete`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await loadIncome();
                await loadDebtors();
                alert('Платеж успешно удален!');
            } else {
                const error = await response.json();
                alert('Ошибка: ' + (error.error || 'Не удалось удалить платеж'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ошибка при удалении платежа');
        }
    }
});

// ==================== EDIT INCOME MODAL ====================
const editIncomeModal = document.getElementById('editIncomeModal');
const editIncomeForm = document.getElementById('editIncomeForm');

// Открыть модальное окно редактирования прихода
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-income-btn')) {
        const btn = e.target;
        const paymentId = btn.dataset.paymentId;
        const studentId = btn.dataset.studentId;
        const amount = btn.dataset.amount;
        const notes = btn.dataset.notes;
        
        // Заполнить форму данными
        document.getElementById('edit-payment-id').value = paymentId;
        document.getElementById('edit-student-id').value = studentId;
        document.getElementById('edit-payment-amount').value = amount;
        document.getElementById('edit-payment-notes').value = notes;
        
        // Показать модальное окно
        editIncomeModal.style.display = 'block';
    }
});

// Закрыть модальное окно редактирования прихода
const editIncomeCloseButtons = editIncomeModal.querySelectorAll('.close');
editIncomeCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        editIncomeModal.style.display = 'none';
    });
});

// Закрыть при клике вне окна
window.addEventListener('click', (e) => {
    if (e.target === editIncomeModal) {
        editIncomeModal.style.display = 'none';
    }
});

// Отправить форму редактирования прихода
editIncomeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const paymentId = document.getElementById('edit-payment-id').value;
    const studentId = document.getElementById('edit-student-id').value;
    const amount = parseFloat(document.getElementById('edit-payment-amount').value);
    const notes = document.getElementById('edit-payment-notes').value || '';
    
    const data = {
        student_id: parseInt(studentId),
        amount: amount,
        notes: notes
    };
    
    try {
        const response = await fetch(`/api/payments/${paymentId}/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            editIncomeModal.style.display = 'none';
            editIncomeForm.reset();
            // Перезагрузить данные прихода
            loadIncome();
            alert('Платеж успешно обновлен!');
        } else {
            const error = await response.json();
            alert('Ошибка: ' + (error.error || 'Не удалось обновить платеж'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка при обновлении платежа');
    }
});
