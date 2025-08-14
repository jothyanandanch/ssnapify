export const CONFIG = {
    API_BASE: 'http://localhost:8000',
    GOOGLE_LOGIN_URL: 'http://localhost:8000/auth/google/login',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    ANIMATION_DURATION: 300,
    TOAST_DURATION: 5000
} as const;

export type ImageTool = 'restore' | 'remove_bg' | 'remove_obj' | 'image_enhancer' | 'generative_fill' | 'replace_background';

export const TOOL_CONFIG = {
    restore: {
        name: 'Photo Restoration',
        icon: '🔧',
        description: 'Restore old and damaged photos',
        credits: 2
    },
    remove_bg: {
        name: 'Background Removal',
        icon: '🎭',
        description: 'Remove backgrounds with precision',
        credits: 1
    },
    remove_obj: {
        name: 'Object Removal',
        icon: '✂️',
        description: 'Remove unwanted objects',
        credits: 3
    },
    image_enhancer: {
        name: 'Image Enhancement',
        icon: '✨',
        description: 'Enhance quality and sharpness',
        credits: 1
    },
    generative_fill: {
        name: 'Generative Fill',
        icon: '🎨',
        description: 'Fill areas with AI content',
        credits: 4
    },
    replace_background: {
        name: 'Background Replace',
        icon: '🖼️',
        description: 'Replace with custom backgrounds',
        credits: 3
    }
} as const;
