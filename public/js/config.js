// API Configuration
window.API_CONFIG = {
    BASE_URL: window.location.origin,
    API_PREFIX: '',
    ENDPOINTS: {
        // Auth
        AUTH_GOOGLE_LOGIN: '/auth/google/login',
        AUTH_LOGOUT: '/auth/logout',
        AUTH_LOGOUT_ALL: '/auth/logout-all-devices',
        
        // Users
        USERS_ME: '/users/me',
        USERS_ALL: '/users',
        
        // Images
        IMAGES: '/images',
        IMAGES_BY_ID: '/images/{id}',
        IMAGE_RESTORE: '/images/{id}/restore',
        IMAGE_REMOVE_BG: '/images/{id}/remove_bg',
        IMAGE_REMOVE_OBJ: '/images/{id}/remove_obj',
        IMAGE_ENHANCE: '/images/{id}/enhance',
        IMAGE_GENERATIVE_FILL: '/images/{id}/generative_fill',
        IMAGE_REPLACE_BG: '/images/{id}/replace_bg',
        
        // Account
        ACCOUNT_CREDITS: '/account/credits',
        
        // Admin
        ADMIN_USER_CREDITS: '/admin/users/{id}/credits',
        ADMIN_USER_ROLE: '/admin/users/{id}/role',
        ADMIN_USER_STATUS: '/admin/users/{id}/status',
        ADMIN_USER_LOGOUT: '/admin/users/{id}/logout-force',
        ADMIN_USER_PLAN: '/admin/users/{id}/plan',
        
        // Support
        SUPPORT_TICKET: '/support/ticket',
        
        // Health
        HEALTH_REDIS: '/health/redis',
        HEALTH_CLOUDINARY: '/health/cloudinary',
        HEALTH_GENERAL: '/health'
    }
};

// App Configuration
window.APP_CONFIG = {
    TOKEN_KEY: 'ssnapify_token',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    PAGINATION_LIMIT: 20,
    TOAST_DURATION: 5000,
    
    TRANSFORMATION_COSTS: {
        restore: 1,
        remove_bg: 1,
        remove_obj: 1,
        enhance: 1,
        replace_bg: 2,
        generative_fill: 3
    },
    
    PLAN_NAMES: {
        1: 'Free',
        2: 'Pro Monthly',
        3: 'Pro 6-Month'
    }
};

// Theme Configuration
window.THEME_CONFIG = {
    STORAGE_KEY: 'ssnapify_theme',
    DEFAULT_THEME: 'light',
    THEMES: {
        light: '☀️',
        dark: '🌙'
    }
};
