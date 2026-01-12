// ========================================
// ProBIM - Authentication Manager
// ========================================

class AuthManager {
    constructor() {
        this.loginOverlay = document.getElementById('login-overlay');
        this.loginForm = document.getElementById('login-form');
        this.loginBtn = document.getElementById('login-btn');
        this.loginError = document.getElementById('login-error');
        this.mainApp = document.body;

        this.currentMethod = 'phone';
        this.eimzoInitialized = false;
        this.selectedKey = null;

        this.user = null;
        this.init();
    }

    async init() {
        console.log('🔐 AuthManager initializing...');

        // --- Tabs Logic ---
        const tabs = document.querySelectorAll('.login-tab');
        const contents = document.querySelectorAll('.method-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const method = tab.dataset.method;
                this.currentMethod = method;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                contents.forEach(c => {
                    c.classList.remove('active');
                    if (c.id === `method-${method}`) c.classList.add('active');
                });

                this.hideError();
                if (method === 'pfx') this.initEimzo();
            });
        });

        // --- Custom Dropdown Logic ---
        document.addEventListener('click', (e) => {
            const dropdowns = document.querySelectorAll('.custom-select-container');
            dropdowns.forEach(d => {
                if (!d.contains(e.target)) {
                    d.classList.remove('open');
                }
            });
        });

        const selectTriggers = document.querySelectorAll('.custom-select-trigger');
        selectTriggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const container = trigger.closest('.custom-select-container');
                container.classList.toggle('open');
            });
        });

        // --- Phone Input Logic ---
        const phoneInputs = [document.getElementById('login-phone')].filter(i => i);
        phoneInputs.forEach(input => {
            // Set initial value
            if (!input.value) input.value = '+998';

            input.addEventListener('focus', () => {
                if (!input.value) input.value = '+998';
            });

            input.addEventListener('input', (e) => {
                let val = e.target.value;
                if (!val.startsWith('+')) val = '+' + val;
                // Keep + and digits only
                val = '+' + val.substring(1).replace(/\D/g, '');

                // If user somehow deletes too much, reset to +998
                if (val.length < 4 && !val.startsWith('+998')) {
                    // But if they are just typing, let them
                }
                e.target.value = val;
            });

            input.addEventListener('keydown', (e) => {
                // Prevent deleting +998 easily
                if (e.key === 'Backspace' && e.target.value.length <= 4) {
                    // e.preventDefault(); // Optional: allow deletion but it will auto-refocus
                }
            });
        });

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

    async initEimzo() {
        if (this.eimzoInitialized) return;
        const triggerLabel = document.querySelector('.custom-select-trigger span');
        if (!triggerLabel) return;

        triggerLabel.textContent = 'Инициализация E-IMZO...';

        EIMZOClient.checkVersion(
            (major, minor) => {
                EIMZOClient.installApiKeys(() => {
                    this.loadEimzoKeys();
                    this.eimzoInitialized = true;
                    // Ensure info is hidden if version is OK
                    const info = document.querySelector('.pfx-info');
                    if (info) info.style.display = 'none';
                }, (e) => this.showError("Ошибка API ключей E-IMZO"));
            },
            (e) => {
                this.showError("Модуль E-IMZO не найден. Запустите его.");
                triggerLabel.textContent = 'E-IMZO не найден';
                // Show info box because module is missing
                const info = document.querySelector('.pfx-info');
                if (info) info.style.display = 'block';
            }
        );
    }

    loadEimzoKeys() {
        const optionsContainer = document.querySelector('.custom-options');
        const triggerLabel = document.querySelector('.custom-select-trigger span');
        if (!optionsContainer) return;

        EIMZOClient.listAllUserKeys(
            (o, i) => "key-" + o.serialNumber + "-" + i,
            (itemId, vo) => {
                const div = document.createElement('div');
                div.className = 'custom-option';
                div.dataset.value = itemId;
                div.dataset.vo = JSON.stringify(vo);

                div.innerHTML = `
                    <div class="option-icon"><i class="fas fa-key"></i></div>
                    <div class="option-info">
                        <div class="key-name">${vo.CN}</div>
                        <div class="key-tin">ИНН: ${vo.TIN || 'N/A'}</div>
                    </div>
                `;

                div.addEventListener('click', () => {
                    this.selectedKey = { id: itemId, vo: vo };
                    triggerLabel.textContent = vo.CN;
                    div.closest('.custom-select-container').classList.remove('open');
                });

                return div;
            },
            (items) => {
                optionsContainer.innerHTML = '';
                if (items.length === 0) {
                    triggerLabel.textContent = 'Ключи не найдены';
                } else {
                    triggerLabel.textContent = 'Выберите ключ...';
                    items.forEach(item => optionsContainer.appendChild(item));
                }

                // Add search handler
                const searchInput = document.querySelector('.select-search input');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => this.filterKeys(e.target.value));
                }
            },
            (e) => this.showError("Ошибка загрузки ключей")
        );
    }

    filterKeys(query) {
        const options = document.querySelectorAll('.custom-option');
        const q = query.toLowerCase();
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            opt.style.display = text.includes(q) ? 'flex' : 'none';
        });
    }

    async handleLogin() {
        this.hideError();
        let login = '';
        let password = '';

        if (this.currentMethod === 'phone') {
            const phoneField = document.getElementById('login-phone');
            const passField = document.getElementById('login-phone-password');
            login = phoneField?.value.trim() || '';
            password = passField?.value || '';
        } else if (this.currentMethod === 'email') {
            const emailField = document.getElementById('login-email');
            const passField = document.getElementById('login-email-password');
            login = emailField?.value.trim() || '';
            password = passField?.value || '';
        } else if (this.currentMethod === 'pfx') {
            if (!this.selectedKey) {
                this.showError('Выберите ключ ЭЦП');
                return;
            }
            login = this.selectedKey.vo.TIN || 'E-IMZO';
            password = 'pfx-login';
        }

        if (!login || !password) {
            this.showError('Заполните все поля');
            return;
        }

        this.setLoading(true);

        try {
            const isSubPage = window.location.pathname.includes('subcontractor');
            const result = isSubPage
                ? await api.loginSubcontractor(login, password)
                : await api.login(login, password);

            if (result && result.token) {
                if (isSubPage) {
                    window.location.href = 'subcontractor-dashboard.html';
                } else {
                    this.onAuthenticated(result.user);
                }
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
        if (this.loginOverlay) this.loginOverlay.style.display = 'none';
        document.querySelectorAll('.auth-hidden').forEach(el => el.classList.remove('auth-hidden'));
        this.updateUserUI();
        if (window.app && typeof window.app.init === 'function') window.app.init();
    }

    showLogin() {
        if (this.loginOverlay) this.loginOverlay.style.display = 'flex';
        document.querySelectorAll('.sidebar, .main-content').forEach(el => el.classList.add('auth-hidden'));
    }

    logout() {
        api.setToken(null);
        this.user = null;
        window.location.reload();
    }

    updateUserUI() {
        const userNameEls = document.querySelectorAll('.user-name');
        const userPhotoEls = document.querySelectorAll('.user-photo');
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
        if (this.loginError) this.loginError.style.display = 'none';
    }

    setLoading(isLoading) {
        if (this.loginBtn) {
            this.loginBtn.disabled = isLoading;
            this.loginBtn.textContent = isLoading ? 'Вход...' : 'Войти в систему';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.auth = new AuthManager();
});
