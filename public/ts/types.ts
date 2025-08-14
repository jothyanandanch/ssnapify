export interface User {
    id: string;
    email: string;
    username: string;
    is_admin: boolean;
    is_active: boolean;
    credit_balance: number;
    plan_id?: string;
    created_at: string;
}

export interface Credits {
    credit_balance: number;
    plan_id?: string;
    days_until_next_reset: number;
    next_reset_time: string;
    billing_cycle_ends?: string;
}

export interface ImageAsset {
    id: string;
    user_id: string;
    public_id: string;
    secure_url: string;
    title?: string;
    transformation_type?: string;
    config?: Record<string, any>;
    created_at: string;
}

export interface UploadProgress {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    imageId?: string;
    error?: string;
}

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}
export interface User {
    id: string;
    email: string;
    username: string;
    is_admin: boolean;
    is_active: boolean;
    credit_balance: number;
    plan_id?: string;
    created_at: string;
}

export interface Credits {
    credit_balance: number;
    plan_id?: string;
    days_until_next_reset: number;
    next_reset_time: string;
    billing_cycle_ends?: string;
}

export interface ImageAsset {
    id: string;
    user_id: string;
    public_id: string;
    secure_url: string;
    title?: string;
    transformation_type?: string;
    config?: Record<string, any>;
    created_at: string;
}

export interface UploadProgress {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    imageId?: string;
    error?: string;
}

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

// Add the missing ImageTool export
export type ImageTool = 'restore' | 'remove_bg' | 'remove_obj' | 'image_enhancer' | 'generative_fill' | 'replace_background';
