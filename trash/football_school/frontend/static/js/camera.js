const video = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startCamera');

let stream = null;
let recognitionInterval = null;
let isProcessing = false;

// Запуск камеры
startBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 }
        });
        video.srcObject = stream;
        startBtn.disabled = true;
        startBtn.textContent = '✓ Автосканирование активно';
        
        // Добавить визуальный эффект сканирования
        video.classList.add('scanning');
        
        // Запустить автоматическое распознавание каждые 2 секунды
        recognitionInterval = setInterval(autoRecognize, 2000);
        
        document.getElementById('recognitionResult').innerHTML = 
            '<p class="info-text">🔍 Автоматическое сканирование активно...</p>';
    } catch (error) {
        alert('Не удалось получить доступ к камере: ' + error.message);
    }
});

// Автоматическое распознавание
async function autoRecognize() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    // Захватить кадр
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Конвертировать в blob
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');
        
        try {
            const response = await fetch('/api/recognize_multiple', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success && data.count > 0) {
                // Автоматически отметить всех распознанных учеников
                for (const student of data.students) {
                    await autoCheckInStudent(student);
                }
                
                // Пауза 5 секунд перед продолжением сканирования
                setTimeout(() => {
                    if (stream) {
                        isProcessing = false;
                    }
                }, 5000);
                return;
            }
        } catch (error) {
            console.error('Ошибка распознавания:', error);
        }
        
        isProcessing = false;
    }, 'image/jpeg');
}

// Автоматическая отметка прихода ученика
async function autoCheckInStudent(student) {
    try {
        const response = await fetch('/api/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: student.student_id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Звуковое уведомление
            playBeep();
            
            // Показать уведомление
            if (data.low_balance) {
                showNotification(student.student_name, student.balance, data.remaining_balance, 'low');
            } else {
                showNotification(student.student_name, student.balance, data.remaining_balance, 'success');
            }
            
            loadTodayAttendance();
            return true;
        } else if (data.message === 'Уже отмечен сегодня') {
            // Тихо пропустить - ученик уже был сегодня
            console.log(`${student.student_name} уже отмечен сегодня`);
            return false;
        } else {
            console.error('Ошибка отметки:', data.message);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при отметке:', error);
        return false;
    }
}

// Показать уведомление о регистрации
function showNotification(name, oldBalance, newBalance, type) {
    const resultDiv = document.getElementById('recognitionResult');
    resultDiv.style.display = 'block';
    
    if (type === 'success') {
        resultDiv.innerHTML = `
            <div style="background: #27ae60; color: white; padding: 20px; border-radius: 8px; text-align: center; animation: slideIn 0.3s ease;">
                <h2 style="margin: 0; font-size: 2rem;">✓ ${name}</h2>
                <p style="font-size: 1.3rem; margin: 10px 0; font-weight: bold;">Приход зафиксирован!</p>
                <p style="margin: 0; font-size: 1.1rem;">Баланс: ${oldBalance} → <strong style="font-size: 1.5rem;">${newBalance}</strong> занятий</p>
            </div>
        `;
    } else if (type === 'low') {
        resultDiv.innerHTML = `
            <div style="background: #f39c12; color: white; padding: 20px; border-radius: 8px; text-align: center; animation: slideIn 0.3s ease;">
                <h2 style="margin: 0; font-size: 2rem;">⚠️ ${name}</h2>
                <p style="font-size: 1.1rem; margin: 8px 0;">Недостаточно занятий, но вход разрешён.</p>
                <p style="margin: 0; font-size: 1.1rem;">Баланс: ${oldBalance} → <strong style="font-size: 1.5rem;">${newBalance}</strong></p>
                <p style="margin-top: 8px; font-size: 0.95rem; opacity: 0.9;">После оплаты отрицательные занятия спишутся автоматически</p>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div style="background: #e74c3c; color: white; padding: 20px; border-radius: 8px; text-align: center; animation: slideIn 0.3s ease;">
                <h2 style="margin: 0; font-size: 2rem;">⚠️ ${name}</h2>
                <p style="font-size: 1.3rem; margin: 10px 0; font-weight: bold;">Недостаточно занятий!</p>
                <p style="margin: 0; font-size: 1.1rem;">Баланс: <strong style="font-size: 1.5rem;">${oldBalance}</strong></p>
            </div>
        `;
    }
    
    // Скрыть через 4 секунды
    setTimeout(() => {
        resultDiv.innerHTML = '<p class="info-text">🔍 Автоматическое сканирование активно...</p>';
    }, 4000);
}

// Звуковой сигнал
function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

// Загрузить список присутствующих сегодня
async function loadTodayAttendance() {
    try {
        const response = await fetch('/api/attendance/today');
        const data = await response.json();
        
        const list = document.getElementById('todayList');
        const counter = document.getElementById('todayCounter');
        counter.textContent = `${data.length} ${data.length === 1 ? 'человек' : 'человека'}`;
        
        if (data.length === 0) {
            list.innerHTML = '<div class="info-text">Пока никого нет</div>';
            return;
        }
        
        list.innerHTML = data.map(record => `
            <div class="today-item ${record.low_balance ? 'blacklisted' : ''}">
                <div class="today-avatar">
                    ${record.photo_url 
                        ? `<img src="${record.photo_url}" alt="${record.student_name}">`
                        : '<div class="avatar-placeholder">👤</div>'}
                </div>
                <div class="today-time">${record.check_in}</div>
                <div class="today-info">
                    <span class="today-name">${record.student_name}</span>
                </div>
                <div class="today-group">${record.group_name || 'Без группы'}</div>
                <div class="today-actions">
                    <span class="balance-badge ${record.balance <= 2 ? 'low' : ''}">${record.balance}</span>
                    <button onclick="deleteAttendance(${record.id})" class="today-delete" title="Удалить запись">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки посещаемости:', error);
    }
}

// Удалить запись посещаемости
async function deleteAttendance(attendanceId) {
    if (!confirm('Удалить эту запись прихода?')) return;
    
    try {
        const response = await fetch(`/api/attendance/delete/${attendanceId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadTodayAttendance();
            alert('✓ ' + data.message);
        } else {
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка при удалении записи');
    }
}

// Загрузить при старте
loadTodayAttendance();

// Обновлять каждые 30 секунд
setInterval(loadTodayAttendance, 30000);
