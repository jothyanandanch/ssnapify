// Application Configuration
window.APP_CONFIG = {
    // File upload settings
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp'
    ],
    
    // UI settings
    PAGINATION_LIMIT: 12,
    TOAST_DURATION: 4000,
    
    // Theme settings
    DEFAULT_THEME: 'light'
};

// Theme configuration
window.THEME_CONFIG = {
    STORAGE_KEY: 'theme-preference',
    DEFAULT_THEME: 'light',
    THEMES: {
        light: '🌙',
        dark: '☀️'
    }
};

// Tool configurations
window.TOOL_CONFIGS = {
    restore: {
        name: 'AI Image Restore',
        type: 'restore',
        endpoint: '/restore',
        cost: 1,
        requiresPrompt: false
    },
    remove_bg: {
        name: 'Background Removal',
        type: 'remove_bg', 
        endpoint: '/remove_bg',
        cost: 1,
        requiresPrompt: false
    },
    enhance: {
        name: 'Image Enhancement',
        type: 'enhance',
        endpoint: '/enhance', 
        cost: 1,
        requiresPrompt: false
    },
    replace_bg: {
        name: 'Background Replace',
        type: 'replace_bg',
        endpoint: '/replace_bg',
        cost: 2,
        requiresPrompt: true
    },
    generative_fill: {
        name: 'Generative Fill',
        type: 'generative_fill',
        endpoint: '/generative_fill',
        cost: 3,
        requiresPrompt: true
    }
};
