/**
 * Chat Sidebar Manager for ProBIM
 * Handles sidebar visibility, positioning, tabs, and conversation simulation.
 */
class ChatManager {
    constructor() {
        this.sidebar = document.getElementById('chat-sidebar');
        this.isOpen = false;
        this.isVisible = false; // Start hidden
        this.isLeft = false; // Default is right
        this.activeTab = 'contacts';
        this.activeUserId = null;

        this.init();
    }

    init() {
        if (!this.sidebar) return;

        // Apply initial hidden state
        if (!this.isVisible) {
            this.sidebar.classList.add('hidden');
        }

        // Initialize event listeners
        this.initControls();
        this.initTabs();
        this.initInput();

        // Simulating data loading
        this.switchTab('contacts');
    }

    initControls() {
        // Toggle Sidebar Button (Main Header)
        const toggleBtn = document.getElementById('header-chat-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent immediate document click
                this.toggleVisibility();
            });
        }

        // Internal Controls
        document.getElementById('chat-swap-btn')?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling causing expand/collapse issues
            this.swapPosition();
        });

        // Search Input propagation
        document.getElementById('chat-search-input')?.addEventListener('click', (e) => {
            e.stopPropagation(); // Allow typing without toggling sidebar
        });

        // Click Outside to Collapse (only if visible)
        document.addEventListener('click', (e) => {
            if (this.isVisible && this.isOpen &&
                !this.sidebar.contains(e.target) &&
                e.target !== toggleBtn &&
                !toggleBtn?.contains(e.target)) {
                this.toggleSidebar(false);
            }
        });

        // Click Inside (Avatar/Chat) to Expand (when collapsed)
        this.sidebar.addEventListener('click', (e) => {
            if (!this.isOpen) {
                this.toggleSidebar(true);
            }
        });

        // Org Chart "Chat" buttons integration
        window.addEventListener('open-chat', (e) => {
            e.stopPropagation();
            this.openConversation(e.detail);
            if (!this.isVisible) this.toggleVisibility(true);
            if (!this.isOpen) this.toggleSidebar(true);
        });

        // Listen for requests from iframes
        window.addEventListener('message', (e) => {
            if (e.data.type === 'get-chat-state') {
                this.broadcastState();
            }
        });
    }

    toggleSidebar(forceOpen = null) {
        if (forceOpen !== null) {
            this.isOpen = forceOpen;
        } else {
            this.isOpen = !this.isOpen;
        }

        this.sidebar.classList.toggle('collapsed', !this.isOpen);
        this.broadcastState();
    }

    toggleVisibility(forceVisible = null) {
        if (forceVisible !== null) {
            this.isVisible = forceVisible;
        } else {
            this.isVisible = !this.isVisible;
        }
        this.sidebar.classList.toggle('hidden', !this.isVisible);
        this.broadcastState();
    }

    broadcastState() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.contentWindow.postMessage({
                type: 'chat-state-update',
                isVisible: this.isVisible,
                isOpen: this.isOpen
            }, '*');
        });
    }

    swapPosition() {
        this.isLeft = !this.isLeft;
        this.sidebar.classList.toggle('position-left', this.isLeft);
        this.sidebar.classList.toggle('position-right', !this.isLeft);
    }

    initTabs() {
        const tabs = document.querySelectorAll('.chat-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.tab;
                this.switchTab(target);
            });
        });
    }

    initInput() {
        // Mock functionality for media buttons
        document.getElementById('chat-btn-attach')?.addEventListener('click', () => {
            alert('Загрузка файлов - в разработке');
        });
        document.getElementById('chat-btn-voice')?.addEventListener('click', () => {
            alert('Голосовая запись - в разработке');
        });
        document.getElementById('chat-btn-video')?.addEventListener('click', () => {
            alert('Видео-кружочек - в разработке');
        });
        document.getElementById('chat-btn-emoji')?.addEventListener('click', () => {
            alert('Смайлы - скоро');
        });

        // Send message on Enter
        const input = document.getElementById('chat-message-input');
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(input.value);
                input.value = '';
            }
        });
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // UI Updates
        document.querySelectorAll('.chat-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        this.renderList(tabName);
    }

    async renderList(tabName) {
        const listContainer = document.getElementById('chat-list-container');
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gray-400); font-size:12px;">Загрузка...</div>';

        try {
            let data = [];
            if (tabName === 'contacts') {
                const employees = await window.api.getEmployees();
                data = employees.map(e => ({
                    id: e.id,
                    name: `${e.lastName} ${e.firstName}`,
                    image: e.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.firstName + ' ' + e.lastName)}&background=random`,
                    lastMessage: e.position?.name || 'Сотрудник',
                    lastTime: '10:45',
                    online: Math.random() > 0.5
                }));
            } else if (tabName === 'subcontractors') {
                const subs = await window.api.getAllSubcontractors();
                data = subs.map(s => ({
                    id: s.id,
                    name: s.company,
                    image: s.companyPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.company)}&background=207345&color=fff`,
                    lastMessage: s.workTypes || 'Субподрядчик',
                    lastTime: 'Пн',
                    online: false
                }));
            } else {
                data = this.getMockData(tabName);
            }

            listContainer.innerHTML = '';
            if (data.length === 0) {
                listContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--gray-400); font-size:12px;">Пусто</div>';
                return;
            }

            data.forEach(item => {
                const el = document.createElement('div');
                el.className = 'chat-list-item';
                el.onclick = () => this.openConversation(item);

                el.innerHTML = `
                    <div class="chat-avatar-wrapper">
                        <img src="${item.image}" class="chat-avatar" alt="${item.name}">
                        <span class="chat-status-dot ${item.online ? 'online' : ''}"></span>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name-row">
                            <span class="chat-name">${item.name}</span>
                            <span class="chat-time">${item.lastTime}</span>
                        </div>
                        <div class="chat-preview">${item.lastMessage}</div>
                    </div>
                `;
                listContainer.appendChild(el);
            });
        } catch (error) {
            console.error('Chat render error:', error);
            listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--red-500); font-size:12px;">Ошибка загрузки</div>';
        }
    }

    openConversation(user) {
        // Expand sidebar if collapsed
        if (!this.isOpen) {
            this.toggleSidebar(true);
        }

        // Switch views
        document.getElementById('chat-list-view').style.display = 'none';
        document.getElementById('chat-conversation-view').style.display = 'flex';

        // Hide Search and Tabs
        document.querySelector('.chat-sidebar-header').style.display = 'none';
        document.querySelector('.chat-sidebar-tabs').style.display = 'none';

        // Update Header
        document.getElementById('converastion-user-name').textContent = user.name;

        const imgEl = document.getElementById('conversation-user-image');
        if (imgEl) {
            imgEl.src = user.image;
            imgEl.style.display = 'block';
        }

        const statusEl = document.getElementById('conversation-user-status');
        if (user.online) {
            statusEl.textContent = 'В сети';
            statusEl.style.color = 'var(--primary)';
        } else {
            // Check if lastTime is a time string (HH:MM or similar) or day/date
            let statusText = 'Был(а) ';
            if (user.lastTime && (user.lastTime.includes(':') || user.lastTime.match(/\d/))) {
                // Assume if it has numbers it's a specific time or date
                // If just HH:MM assume today
                if (user.lastTime.includes(':') && user.lastTime.length <= 5) {
                    statusText += `сегодня в ${user.lastTime}`;
                } else {
                    statusText += user.lastTime;
                }
            } else {
                statusText += 'недавно';
            }
            statusEl.textContent = statusText;
            statusEl.style.color = 'var(--gray-500)';
        }

        // Load messages (Mock)
        const msgs = document.getElementById('chat-messages-area');
        msgs.innerHTML = `
            <div class="chat-date-separator"><span>Сегодня</span></div>
            <div class="chat-msg incoming">
                <div class="chat-bubble">
                    Здравствуйте! Как дела с проектом?
                    <span class="chat-msg-time">10:42</span>
                </div>
            </div>
             <div class="chat-msg outgoing">
                <div class="chat-bubble">
                    Всё по плану, заканчиваем смету.
                    <span class="chat-msg-time">
                        10:45
                        <span class="read-tick" title="Прочитано">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 6 7 17l-5-5"/>
                                <path d="m22 10-7.5 7.5L13 16"/>
                            </svg>
                        </span>
                    </span>
                </div>
            </div>
        `;

        // Back button logic
        document.getElementById('chat-back-btn').onclick = () => {
            document.getElementById('chat-list-view').style.display = 'flex';
            document.getElementById('chat-conversation-view').style.display = 'none';

            // Show Search and Tabs
            document.querySelector('.chat-sidebar-header').style.display = 'flex';
            document.querySelector('.chat-sidebar-tabs').style.display = 'flex';
        };
    }

    sendMessage(text) {
        if (!text.trim()) return;

        const msgs = document.getElementById('chat-messages-area');
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg outgoing';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgEl.innerHTML = `
            <div class="chat-bubble">
                ${text}
                <span class="chat-msg-time">${time} <span class="read-tick">✓</span></span>
            </div>
        `;
        msgs.appendChild(msgEl);
        msgs.scrollTop = msgs.scrollHeight;
    }

    getMockData(tab) {
        // Simple mock data router
        switch (tab) {
            case 'contacts': return [
                { id: 1, name: 'Александр Волков', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', lastMessage: 'Нужно согласовать доп...', lastTime: '10:45', online: true },
                { id: 2, name: 'Елена Ким', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100', lastMessage: 'Схемы готовы.', lastTime: 'Вчера', online: false },
                { id: 3, name: 'Игорь Новиков', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', lastMessage: 'Принято.', lastTime: 'Пн', online: true },
            ];
            case 'groups': return [
                { id: 101, name: 'ЖК Гранд Палас (Общий)', image: 'https://ui-avatars.com/api/?name=GP&background=207345&color=fff', lastMessage: 'Александр: Все на совещание!', lastTime: '11:00', online: true },
                { id: 102, name: 'Сметный отдел', image: 'https://ui-avatars.com/api/?name=СО&background=random', lastMessage: 'Файл обновлен.', lastTime: '09:30', online: false },
            ];
            case 'channel': return [
                { id: 201, name: 'Новости ProBIM', image: 'https://ui-avatars.com/api/?name=News&background=0088cc&color=fff', lastMessage: 'Вышло обновление v1.2', lastTime: '12:00', online: true },
            ];
            case 'subcontractors': return [
                { id: 301, name: 'ООО "СтройМастер"', image: 'https://ui-avatars.com/api/?name=SM&background=random', lastMessage: 'Акт подписан.', lastTime: 'Cp', online: true },
            ];
            default: return [];
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatManager();
});
