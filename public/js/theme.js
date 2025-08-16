// Theme Management and Authentication Utilities
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || THEME_CONFIG.DEFAULT_THEME;
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();
        this.setupAuthState();
    }

    getStoredTheme() {
        return localStorage.getItem(THEME_CONFIG.STORAGE_KEY);
    }

    setStoredTheme(theme) {
        localStorage.setItem(THEME_CONFIG.STORAGE_KEY, theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.setStoredTheme(theme);
        this.updateToggleButton();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    setupToggleButton() {
        const toggleButton = document.getElementById('themeToggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggleTheme());
            this.updateToggleButton();
        }
    }

    updateToggleButton() {
        const toggleButton = document.getElementById('themeToggle');
        if (toggleButton) {
            toggleButton.textContent = THEME_CONFIG.THEMES[this.currentTheme];
            toggleButton.setAttribute('aria-label', `Switch to ${this.currentTheme === 'light' ? 'dark' : 'light'} mode`);
        }
    }

    setupAuthState() {
        this.updateAuthUI();
    }

    async updateAuthUI() {
        const token = api.getToken();
        const navAuth = document.getElementById('navAuth');
        const navUser = document.getElementById('navUser');

        if (!token) {
            // User not logged in
            if (navAuth) navAuth.classList.remove('hidden');
            if (navUser) navUser.classList.add('hidden');
            return;
        }

        try {
            // User is logged in, get user info
            const user = await apiHelpers.getCurrentUser();
            this.updateUserUI(user);
            
            if (navAuth) navAuth.classList.add('hidden');
            if (navUser) navUser.classList.remove('hidden');

            // Setup logout functionality
            this.setupLogout();

            // Get and display credits
            this.updateCredits();

        } catch (error) {
            console.error('Failed to get user info:', error);
            // Token might be invalid
            api.removeToken();
            if (navAuth) navAuth.classList.remove('hidden');
            if (navUser) navUser.classList.add('hidden');
        }
    }

    updateUserUI(user) {
        const userNameElements = document.querySelectorAll('#userName, #userNameDisplay');
        userNameElements.forEach(el => {
            if (el) el.textContent = user.username || user.email.split('@')[0];
        });

        // Show admin section if user is admin
        const adminSection = document.getElementById('adminSection');
        if (adminSection) {
            if (user.is_admin) {
                adminSection.classList.remove('hidden');
            } else {
                adminSection.classList.add('hidden');
            }
        }
    }

    async updateCredits() {
        try {
            const creditInfo = await apiHelpers.getCredits();
            const userCreditsElements = document.querySelectorAll('#userCredits');
            userCreditsElements.forEach(el => {
                if (el) el.textContent = `${creditInfo.credit_balance} Credits`;
            });
        } catch (error) {
            console.error('Failed to get credits:', error);
        }
    }

    setupLogout() {
        const logoutButtons = document.querySelectorAll('#logoutBtn');
        logoutButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleLogout();
            });
        });

        // Setup dropdown toggle
        const userAvatar = document.getElementById('userAvatar');
        const dropdownMenu = document.getElementById('dropdownMenu');
        
        if (userAvatar && dropdownMenu) {
            userAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.parentElement.classList.toggle('active');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!userAvatar.contains(e.target)) {
                    dropdownMenu.parentElement.classList.remove('active');
                }
            });
        }
    }

    async handleLogout() {
        try {
            // Show loading state
            toast.info('Logging out...');

            // Call logout API
            const result = await apiHelpers.logout();

            // Show success message
            if (result.warning) {
                toast.warning(result.message);
            } else {
                toast.success('Logged out successfully');
            }

            // Redirect to logout page for proper cleanup
            setTimeout(() => {
                window.location.href = '/logout.html';
            }, 1000);

        } catch (error) {
            console.error('Logout error:', error);
            
            // Force logout on client side
            api.removeToken();
            toast.error('Logged out (client-side only)');
            
            setTimeout(() => {
                window.location.href = '/logout.html';
            }, 1000);
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!api.getToken();
    }

    // Require authentication for page access
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    // Require admin access
    async requireAdmin() {
        if (!this.requireAuth()) return false;

        try {
            const user = await apiHelpers.getCurrentUser();
            if (!user.is_admin) {
                toast.error('Admin access required');
                window.location.href = '/dashboard.html';
                return false;
            }
            return true;
        } catch (error) {
            console.error('Failed to check admin status:', error);
            return false;
        }
    }
}

// Create global theme manager instance
window.themeManager = new ThemeManager();

// Authentication helper functions
window.auth = {
    isLoggedIn() {
        return themeManager.isAuthenticated();
    },

    requireAuth() {
        return themeManager.requireAuth();
    },

    async requireAdmin() {
        return themeManager.requireAdmin();
    },

    logout() {
        return themeManager.handleLogout();
    },

    async getCurrentUser() {
        try {
            return await apiHelpers.getCurrentUser();
        } catch (error) {
            console.error('Failed to get current user:', error);
            return null;
        }
    }
};

// Initialize theme on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Theme manager is already initialized
    console.log('✅ Theme manager initialized');
});
