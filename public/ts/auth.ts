import { api, APIError } from './api.js';
import { User } from './types.js';
import { showToast } from './utils.js';

class AuthManager {
    private user: User | null = null;
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('token');
        this.initializeAuth();
    }

    private initializeAuth(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        
        if (urlToken) {
            this.setToken(urlToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    public setToken(token: string): void {
        this.token = token;
        localStorage.setItem('token', token);
        this.loadUserProfile();
    }

    public clearToken(): void {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
    }

    public getToken(): string | null {
        return this.token;
    }

    public getUser(): User | null {
        return this.user;
    }

    public isAuthenticated(): boolean {
        return !!this.token;
    }

    public isAdmin(): boolean {
        return this.user?.is_admin ?? false;
    }

    private async loadUserProfile(): Promise<void> {
        if (!this.token) return;

        try {
            this.user = await api.get<User>('/users/me');
        } catch (error) {
            console.error('Failed to load user profile:', error);
            if (error instanceof APIError && error.status === 401) {
                this.clearToken();
                this.redirectToLogin();
            }
        }
    }

    public async logout(): Promise<void> {
        try {
            if (this.token) {
                await api.post('/logout', {});
            }
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            this.clearToken();
            this.redirectToLogin();
        }
    }

    private redirectToLogin(): void {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/static/login.html';
        }
    }

    public async refreshUserProfile(): Promise<void> {
        await this.loadUserProfile();
    }
}

const authManager = new AuthManager();

export function ensureLoggedIn(): void {
    if (!authManager.isAuthenticated()) {
        window.location.href = '/static/login.html';
        return;
    }
}

export function getToken(): string | null {
    return authManager.getToken();
}

export function getUser(): User | null {
    return authManager.getUser();
}

export function isAuthenticated(): boolean {
    return authManager.isAuthenticated();
}

export function isAdmin(): boolean {
    return authManager.isAdmin();
}

export async function logout(): Promise<void> {
    return authManager.logout();
}

export async function refreshUser(): Promise<void> {
    return authManager.refreshUserProfile();
}

export function attachLogout(): void {
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    attachLogout();
});

export { authManager };
