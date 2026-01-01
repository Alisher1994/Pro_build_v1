// ========================================
// ProBIM - Authentication Manager
// ========================================

class AuthManager {
    constructor() {
        this.loginOverlay = document.getElementById('login-overlay');
        this.loginForm = document.getElementById('login-form');
        this.emailInput = document.getElementById('login-email');
        this.passwordInput = document.getElementById('login-password');
        this.loginBtn = document.getElementById('login-btn');
        this.loginError = document.getElementById('login-error');
        this.mainApp = document.body; // We'll toggle class on body or main container

        this.user = null;
        this.init();
    }

    async init() {
        console.log('🔐 AuthManager initializing...');

        // Add event listeners
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Check for existing session
        const token = localStorage.getItem('probim_token');
        if (token) {
            try {
                const data = await api.verifyToken();
                if (data && data.user) {
                    this.onAuthenticated(data.user);
                } else {
                    this.showLogin();
                }
            } catch (err) {
                console.error('Token verification failed:', err);
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    async handleLogin() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        if (!email || !password) {
            this.showError('Введите email и пароль');
            return;
        }

        this.setLoading(true);
        this.hideError();

        try {
            const data = await api.login(email, password);
            if (data && data.token) {
                this.onAuthenticated(data.user);
            }
        } catch (err) {
            console.error('Login error:', err);
            this.showError(err.message || 'Ошибка входа');
        } finally {
            this.setLoading(false);
        }
    }

    onAuthenticated(user) {
        this.user = user;
        console.log('✅ Authenticated as:', user.email);

        // Hide login, show app
        if (this.loginOverlay) {
            this.loginOverlay.style.display = 'none';
        }

        // Show main app content
        document.querySelectorAll('.auth-hidden').forEach(el => {
            el.classList.remove('auth-hidden');
        });

        // Update user info in UI
        this.updateUserUI();

        // Initialize the main app if not already done
        if (window.app && typeof window.app.init === 'function') {
            window.app.init();
        }
    }

    showLogin() {
        if (this.loginOverlay) {
            this.loginOverlay.style.display = 'flex';
        }
        // Ensure app content is hidden
        document.querySelectorAll('.sidebar, .main-content').forEach(el => {
            el.classList.add('auth-hidden');
        });
    }

    logout() {
        api.setToken(null);
        this.user = null;
        window.location.reload();
    }

    updateUserUI() {
        const userEmailEls = document.querySelectorAll('.user-email');
        const userNameEls = document.querySelectorAll('.user-name');
        const userPhotoEls = document.querySelectorAll('.user-photo');

        userEmailEls.forEach(el => el.textContent = this.user.email);
        userNameEls.forEach(el => el.textContent = `${this.user.firstName} ${this.user.lastName}`);

        if (this.user.photo) {
            userPhotoEls.forEach(el => {
                if (el.tagName === 'IMG') el.src = this.user.photo;
                else el.style.backgroundImage = `url(${this.user.photo})`;
            });
        }
    }

    showError(msg) {
        if (this.loginError) {
            this.loginError.textContent = msg;
            this.loginError.style.display = 'block';
        }
    }

    hideError() {
        if (this.loginError) {
            this.loginError.style.display = 'none';
        }
    }

    setLoading(isLoading) {
        if (this.loginBtn) {
            this.loginBtn.disabled = isLoading;
            this.loginBtn.textContent = isLoading ? 'Вход...' : 'Войти';
        }
    }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.auth = new AuthManager();
});
