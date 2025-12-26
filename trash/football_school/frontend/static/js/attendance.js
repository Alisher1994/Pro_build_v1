let allAttendance = [];
let allGroups = [];
let allStudents = [];
let availableYears = [];
let selectedStudentId = '';
let selectedStudentName = 'Все ученики';

// Загрузка данных для фильтров
async function loadFilterData() {
    try {
        const [groupsResponse, studentsResponse, yearsResponse] = await Promise.all([
            fetch('/api/groups'),
            fetch('/api/students'),
            fetch('/api/attendance/years')
        ]);
        
        allGroups = await groupsResponse.json();
        const groupSelect = document.getElementById('filterGroup');
        groupSelect.innerHTML = '<option value="">Все группы</option>' + 
            allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        
        const studentsData = await studentsResponse.json();
        allStudents = studentsData.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
        setupStudentSearch();
        const searchInput = document.getElementById('filterStudentSearch');
        searchInput.value = '';
        selectedStudentId = '';
        selectedStudentName = 'Все ученики';
        
        const yearsData = await yearsResponse.json();
        availableYears = yearsData.years || [];
        const yearSelect = document.getElementById('filterYear');
        yearSelect.innerHTML = '<option value="">Все годы</option>';
        availableYears.forEach(year => {
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        });
        
        if (availableYears.length > 0) {
            const currentYear = yearsData.current_year;
            const defaultYear = availableYears.includes(currentYear) ? currentYear : availableYears[0];
            yearSelect.value = defaultYear;
        } else {
            yearSelect.value = '';
        }
        
        const now = new Date();
        document.getElementById('filterMonth').value = now.getMonth() + 1;
        
    } catch (error) {
        console.error('Ошибка загрузки фильтров:', error);
    }
}

// Настройка поиска учеников
function setupStudentSearch() {
    const searchInput = document.getElementById('filterStudentSearch');
    const dropdown = document.getElementById('studentDropdown');
    
    // Показать dropdown при клике на поле
    searchInput.addEventListener('click', function() {
        const searchText = searchInput.value === 'Все ученики' ? '' : searchInput.value;
        updateStudentDropdown(searchText);
    });
    
    // Показать dropdown при фокусе
    searchInput.addEventListener('focus', function() {
        const searchText = searchInput.value === 'Все ученики' ? '' : searchInput.value;
        updateStudentDropdown(searchText);
    });
    
    // Поиск при вводе
    searchInput.addEventListener('input', function(e) {
        const searchText = e.target.value;
        updateStudentDropdown(searchText);
    });

    // Выбор по Enter (первый найденный)
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = searchInput.value.trim();
            if (!value || value.toLowerCase() === 'все ученики') {
                selectStudent('', 'Все ученики');
                return;
            }
            const match = allStudents.find(s => s.full_name.toLowerCase().includes(value.toLowerCase()));
            if (match) {
                selectStudent(match.id, match.full_name);
            }
        }
    });
    
    // Скрыть dropdown при клике вне
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Обновление выпадающего списка учеников
function updateStudentDropdown(searchText) {
    const dropdown = document.getElementById('studentDropdown');
    
    let filtered = allStudents;
    if (searchText && searchText !== 'все ученики') {
        filtered = allStudents.filter(s => 
            s.full_name.toLowerCase().includes(searchText.toLowerCase())
        );
    }
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 10px; color: #999;">Ученики не найдены</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    dropdown.innerHTML = `
        <div onclick="selectStudent('', 'Все ученики')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee; background: ${!selectedStudentId ? '#e3f2fd' : 'white'}" 
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='${!selectedStudentId ? '#e3f2fd' : 'white'}'">
            Все ученики
        </div>
    ` + filtered.map(s => `
        <div onclick="selectStudent('${s.id}', '${s.full_name.replace(/'/g, "\\'")}')" 
            style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee; background: ${selectedStudentId == s.id ? '#e3f2fd' : 'white'}"
            onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='${selectedStudentId == s.id ? '#e3f2fd' : 'white'}'">
            ${s.full_name}
        </div>
    `).join('');
    
    dropdown.style.display = 'block';
}

// Выбор ученика
function selectStudent(id, name) {
    selectedStudentId = id;
    selectedStudentName = name;
    document.getElementById('filterStudentSearch').value = name;
    document.getElementById('studentDropdown').style.display = 'none';
}

// Загрузка посещаемости с фильтрами
async function loadAttendance() {
    try {
        const year = document.getElementById('filterYear').value;
        const month = document.getElementById('filterMonth').value;
        const groupId = document.getElementById('filterGroup').value;
        const studentId = selectedStudentId; // Используем выбранного ученика
        
        let url = '/api/attendance/all?';
        if (year) url += `year=${year}&`;
        if (month) url += `month=${month}&`;
        if (groupId) url += `group_id=${groupId}&`;
        if (studentId) url += `student_id=${studentId}&`;
        
        const response = await fetch(url);
        allAttendance = await response.json();
        
        renderAttendance();
    } catch (error) {
        console.error('Ошибка загрузки посещаемости:', error);
    }
}

// Отображение данных
function renderAttendance() {
    const tbody = document.getElementById('attendanceTableBody');
    
    if (allAttendance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="info-text">Записей не найдено</td></tr>';
        return;
    }
    
    // Таблица
    tbody.innerHTML = allAttendance.map(record => {
        const date = new Date(record.check_in_time);
        const dateStr = date.toLocaleDateString('ru-RU');
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${record.student_name}</td>
                <td>${record.group_name || '-'}</td>
                <td>
                    <span class="balance-badge ${record.balance <= 2 ? 'low' : ''}">
                        ${record.balance}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Применить фильтры
function applyFilters() {
    const searchValue = document.getElementById('filterStudentSearch').value.trim();
    if (searchValue && searchValue.toLowerCase() !== 'все ученики' && !selectedStudentId) {
        const match = allStudents.find(s => s.full_name.toLowerCase() === searchValue.toLowerCase());
        if (match) {
            selectedStudentId = match.id;
            selectedStudentName = match.full_name;
        }
    }
    loadAttendance();
}

// Сбросить фильтры
function resetFilters() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    document.getElementById('filterYear').value = availableYears.length > 0 ? availableYears[0] : '';
    document.getElementById('filterMonth').value = currentMonth;
    document.getElementById('filterGroup').value = '';
    
    selectedStudentId = '';
    selectedStudentName = 'Все ученики';
    const searchInput = document.getElementById('filterStudentSearch');
    searchInput.value = '';
    document.getElementById('studentDropdown').style.display = 'none';
    
    loadAttendance();
}

// Инициализация
// Переключение фильтра для посещаемости
function toggleAttendanceFilter() {
    const filterPanel = document.getElementById('attendanceFilterPanel');
    const filterToggleBtn = document.getElementById('attendanceFilterToggleBtn');
    const filterToggleText = document.getElementById('attendanceFilterToggleText');
    
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

async function initAttendancePage() {
    await loadFilterData();
    await loadAttendance();
    
    // Инициализация кнопки фильтра
    const attendanceFilterToggleBtn = document.getElementById('attendanceFilterToggleBtn');
    if (attendanceFilterToggleBtn) {
        attendanceFilterToggleBtn.addEventListener('click', toggleAttendanceFilter);
    }
}

initAttendancePage();

