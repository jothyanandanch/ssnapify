// API Configuration and Token Management
const API_CONFIG = {
    BASE_URL: window.location.origin,
    TOKEN_KEY: 'access_token',
    USER_KEY: 'user_data'
};

// Core API Object
window.api = {
    // Token management
    setToken(token) {
        localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
        console.log('✅ Token saved:', token ? 'Yes' : 'No');
    },

    getToken() {
        return localStorage.getItem(API_CONFIG.TOKEN_KEY);
    },

    removeToken() {
        localStorage.removeItem(API_CONFIG.TOKEN_KEY);
        localStorage.removeItem(API_CONFIG.USER_KEY);
        console.log('✅ Token removed');
    },

    // Get auth headers
    getAuthHeaders() {
        const token = this.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    // Check if authenticated
    isAuthenticated() {
        return !!this.getToken();
    }
};

console.log('✅ API object initialized');
