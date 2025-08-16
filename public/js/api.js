// API Client Utilities
class APIClient {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
    }

    // Get authorization token
    getToken() {
        return localStorage.getItem(APP_CONFIG.TOKEN_KEY);
    }

    // Set authorization token
    setToken(token) {
        localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
    }

    // Remove authorization token
    removeToken() {
        localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
    }

    // Get default headers
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    // Make HTTP request
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(options.includeAuth !== false),
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);
            
            // Handle 401 Unauthorized
            if (response.status === 401) {
                this.removeToken();
                if (window.location.pathname !== '/login.html' && window.location.pathname !== '/') {
                    window.location.href = '/login.html';
                }
                throw new Error('Unauthorized');
            }

            // Handle other HTTP errors
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            // Return response data
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return response;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        return this.request(url.pathname + url.search, {
            method: 'GET',
        });
    }

    // POST request
    async post(endpoint, data = null, options = {}) {
        const config = {
            method: 'POST',
            ...options,
        };

        if (data instanceof FormData) {
            // Remove Content-Type header for FormData (browser will set it)
            config.headers = { ...this.getHeaders(), ...options.headers };
            delete config.headers['Content-Type'];
            config.body = data;
        } else if (data) {
            config.body = JSON.stringify(data);
        }

        return this.request(endpoint, config);
    }

    // PUT request
    async put(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // Upload file
    async uploadFile(file, title = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (title) {
            formData.append('title', title);
        }

        return this.post(API_CONFIG.ENDPOINTS.IMAGES, formData);
    }

    // Apply transformation
    async applyTransformation(imageId, type, prompt = null) {
        const endpoint = API_CONFIG.ENDPOINTS[`IMAGE_${type.toUpperCase()}`];
        if (!endpoint) {
            throw new Error(`Unknown transformation type: ${type}`);
        }

        const url = endpoint.replace('{id}', imageId);
        const params = prompt ? { prompt } : {};

        return this.post(url, null, {
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params).toString(),
        });
    }
}

// Create global API instance
window.api = new APIClient();

// API Helper Functions
window.apiHelpers = {
    // Auth
    async getCurrentUser() {
        return api.get(API_CONFIG.ENDPOINTS.USERS_ME);
    },

    async logout() {
        try {
            const result = await api.post(API_CONFIG.ENDPOINTS.AUTH_LOGOUT);
            api.removeToken();
            return result;
        } catch (error) {
            // Always remove token on logout, even if request fails
            api.removeToken();
            throw error;
        }
    },

    async logoutAllDevices() {
        try {
            const result = await api.post(API_CONFIG.ENDPOINTS.AUTH_LOGOUT_ALL);
            api.removeToken();
            return result;
        } catch (error) {
            // Always remove token on logout, even if request fails
            api.removeToken();
            throw error;
        }
    },

    // Images
    async getUserImages(params = {}) {
        return api.get(API_CONFIG.ENDPOINTS.IMAGES, params);
    },

    async getImage(imageId) {
        return api.get(API_CONFIG.ENDPOINTS.IMAGES_BY_ID.replace('{id}', imageId));
    },

    async deleteImage(imageId) {
        return api.delete(API_CONFIG.ENDPOINTS.IMAGES_BY_ID.replace('{id}', imageId));
    },

    // Account
    async getCredits() {
        return api.get(API_CONFIG.ENDPOINTS.ACCOUNT_CREDITS);
    },

    // Admin
    async getAllUsers() {
        return api.get(API_CONFIG.ENDPOINTS.USERS_ALL);
    },

    async updateUserCredits(userId, credits) {
        return api.post(API_CONFIG.ENDPOINTS.ADMIN_USER_CREDITS.replace('{id}', userId), null, {
            body: new URLSearchParams({ credits }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    async updateUserRole(userId, makeAdmin) {
        return api.post(API_CONFIG.ENDPOINTS.ADMIN_USER_ROLE.replace('{id}', userId), null, {
            body: new URLSearchParams({ make_admin: makeAdmin }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    async updateUserStatus(userId, isActive) {
        return api.post(API_CONFIG.ENDPOINTS.ADMIN_USER_STATUS.replace('{id}', userId), null, {
            body: new URLSearchParams({ is_active: isActive }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    async forceLogoutUser(userId) {
        return api.post(API_CONFIG.ENDPOINTS.ADMIN_USER_LOGOUT.replace('{id}', userId));
    },

    async updateUserPlan(userId, planId) {
        return api.post(API_CONFIG.ENDPOINTS.ADMIN_USER_PLAN.replace('{id}', userId), null, {
            body: new URLSearchParams({ plan_id: planId }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    // Support
    async createSupportTicket(name, subject, message) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('subject', subject);
        formData.append('message', message);

        return api.post(API_CONFIG.ENDPOINTS.SUPPORT_TICKET, formData);
    },

    // Health
    async checkHealth() {
        return api.get(API_CONFIG.ENDPOINTS.HEALTH_GENERAL, {}, { includeAuth: false });
    },

    async checkRedisHealth() {
        return api.get(API_CONFIG.ENDPOINTS.HEALTH_REDIS, {}, { includeAuth: false });
    },

    async checkCloudinaryHealth() {
        return api.get(API_CONFIG.ENDPOINTS.HEALTH_CLOUDINARY, {}, { includeAuth: false });
    }
};
