class AuthManager {
    constructor() {
        this.tokenKey = 'access_token';
        this.userKey = 'user_data';
        this.token = null;
        this.user = null;
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.checkURLToken();
        this.updateUI();
        this.bindEvents();
    }

    // Load token and user data from localStorage
    loadFromStorage() {
        this.token = localStorage.getItem(this.tokenKey);
        const userData = localStorage.getItem(this.userKey);
        this.user = userData ? JSON.parse(userData) : null;
    }

    // Check for token in URL (from OAuth callback)
    checkURLToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            this.saveToken(token);
            this.fetchUserData();
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Save token to localStorage
    saveToken(token) {
        this.token = token;
        localStorage.setItem(this.tokenKey, token);
    }

    // Save user data to localStorage
    saveUser(userData) {
        this.user = userData;
        localStorage.setItem(this.userKey, JSON.stringify(userData));
    }

    // Fetch user data from API
    async fetchUserData() {
        if (!this.token) return;

        try {
            const response = await fetch('/users/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.saveUser(userData);
                this.updateUI();
                
                // Redirect to dashboard if on login page
                if (window.location.pathname.includes('login.html')) {
                    window.location.href = '/static/dashboard.html';
                }
            } else {
                this.clearAuth();
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
            this.clearAuth();
        }
    }

    // Update UI based on auth state
    updateUI() {
        const loginBtn = document.getElementById('btn-login');
        const logoutBtn = document.getElementById('btn-logout');
        const userInfo = document.getElementById('user-info');
        const authRequiredElements = document.querySelectorAll('.auth-required');

        if (this.isAuthenticated()) {
            // User is logged in
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (userInfo) userInfo.textContent = this.user?.username || this.user?.email || 'User';
            
            // Show auth-required elements
            authRequiredElements.forEach(el => el.style.display = 'block');
        } else {
            // User is not logged in
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userInfo) userInfo.textContent = '';
            
            // Hide auth-required elements
            authRequiredElements.forEach(el => el.style.display = 'none');
        }
    }

    // Bind logout event
    bindEvents() {
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    // Logout function
    async logout() {
        try {
            if (this.token) {
                await fetch('/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuth();
            window.location.href = '/static/index.html';
        }
    }

    // Clear authentication data
    clearAuth() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.token = null;
        this.user = null;
        this.updateUI();
    }

    // Check if user is authenticated
    isAuthenticated() {
        return Boolean(this.token && this.user);
    }

    // Get authentication headers for API calls
    getAuthHeaders() {
        return this.token ? {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }

    // Make authenticated API call
    async apiCall(url, options = {}) {
        if (!this.isAuthenticated()) {
            window.location.href = '/static/login.html';
            return null;
        }

        const defaultOptions = {
            headers: this.getAuthHeaders()
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, mergedOptions);
            
            if (response.status === 401) {
                this.clearAuth();
                window.location.href = '/static/login.html';
                return null;
            }

            return response;
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    // Require authentication for current page
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/static/login.html';
            return false;
        }
        return true;
    }
}

// Initialize global auth manager
window.authManager = new AuthManager();
