// Core API and Utility Functions
class Core {
    constructor() {
        this.baseURL = window.location.origin;
        this.tokenKey = 'access_token';
        this.userKey = 'user_data';
        this.token = localStorage.getItem(this.tokenKey);
        this.user = null;
        this.init();
    }

    init() {
        this.loadUser();
        this.handleTokenFromURL();
    }

    // Token Management
    setToken(token) {
        this.token = token;
        localStorage.setItem(this.tokenKey, token);
    }

    getToken() {
        return this.token || localStorage.getItem(this.tokenKey);
    }

    removeToken() {
        this.token = null;
        this.user = null;
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    // User Management
    loadUser() {
        const userData = localStorage.getItem(this.userKey);
        this.user = userData ? JSON.parse(userData) : null;
    }

    saveUser(userData) {
        this.user = userData;
        localStorage.setItem(this.userKey, JSON.stringify(userData));
    }

    // Handle token from URL
    handleTokenFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            console.log('Token found in URL, saving...');
            this.setToken(token);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Fetch user data
            this.fetchUserData();
        }
    }

    // Auth Check
    isAuthenticated() {
        return !!this.getToken();
    }

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    // API Calls
    async apiCall(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` })
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, finalOptions);
            
            if (response.status === 401) {
                this.removeToken();
                window.location.href = '/login.html';
                return null;
            }

            return response;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // User Data
    async fetchUserData() {
        try {
            const response = await this.apiCall('/users/me');
            if (response && response.ok) {
                const userData = await response.json();
                this.saveUser(userData);
                this.updateAuthUI();
                
                // Redirect to dashboard if on login page
                if (window.location.pathname.includes('login.html')) {
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        }
    }

    async getCredits() {
        try {
            const response = await this.apiCall('/account/credits');
            return response ? await response.json() : null;
        } catch (error) {
            console.error('Failed to get credits:', error);
            return null;
        }
    }

    async getUserImages(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const endpoint = `/images/${queryString ? '?' + queryString : ''}`;
            const response = await this.apiCall(endpoint);
            return response ? await response.json() : [];
        } catch (error) {
            console.error('Failed to get images:', error);
            return [];
        }
    }

    // Upload Image
    async uploadImage(file, title = null) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (title) formData.append('title', title);

            const response = await this.apiCall('/images/', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`
                    // Don't set Content-Type for FormData
                }
            });

            return response ? await response.json() : null;
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    // Logout
    async logout() {
        try {
            if (this.getToken()) {
                await this.apiCall('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            console.warn('Server logout failed:', error);
        } finally {
            this.removeToken();
            this.updateAuthUI();
            window.location.href = '/index.html';
        }
    }

    // Update Auth UI
    updateAuthUI() {
        const isAuth = this.isAuthenticated();
        
        // Navigation elements
        const navAuth = document.getElementById('navAuth');
        const navUser = document.getElementById('navUser');
        
        if (navAuth) navAuth.style.display = isAuth ? 'none' : 'flex';
        if (navUser) navUser.style.display = isAuth ? 'block' : 'none';
        
        // User info
        if (isAuth && this.user) {
            const userNameElements = document.querySelectorAll('#userName, #userNameDisplay');
            userNameElements.forEach(el => {
                if (el) el.textContent = this.user.username || this.user.email.split('@')[0];
            });
            
            // Update credits
            this.updateCreditsDisplay();
        }
    }

    async updateCreditsDisplay() {
        try {
            const credits = await this.getCredits();
            if (credits) {
                const creditElements = document.querySelectorAll('#userCredits');
                creditElements.forEach(el => {
                    if (el) el.textContent = `${credits.credit_balance} Credits`;
                });
            }
        } catch (error) {
            console.error('Failed to update credits:', error);
        }
    }

    // Utility Functions
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            z-index: 1000;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        const errors = [];
        
        if (!allowedTypes.includes(file.type)) {
            errors.push(`Unsupported file type: ${file.type}`);
        }
        
        if (file.size > maxSize) {
            errors.push(`File too large: ${this.formatFileSize(file.size)} (max: 10MB)`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Initialize Core
window.core = new Core();

// Setup global event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Update auth UI
    core.updateAuthUI();
    
    // Setup dropdown toggles
    const userBtn = document.getElementById('userBtn');
    const dropdown = document.querySelector('.user-dropdown');
    
    if (userBtn && dropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    // Setup logout buttons
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            core.logout();
        });
    });
});
