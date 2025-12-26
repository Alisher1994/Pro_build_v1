document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Проверить, есть ли специальный редирект для роли
            if (data.redirect) {
                window.location.href = data.redirect;
            } else {
                window.location.href = '/dashboard';
            }
        } else {
            errorDiv.textContent = data.message || 'Ошибка входа';
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
    }
});
