// Authentication Manager
class Auth {
    constructor() {
        this.core = window.core;
    }

    isLoggedIn() {
        return this.core.isAuthenticated();
    }

    requireAuth() {
        return this.core.requireAuth();
    }

    async logout() {
        return await this.core.logout();
    }

    async getCurrentUser() {
        return this.core.user;
    }
}

// Initialize Auth
window.auth = new Auth();
