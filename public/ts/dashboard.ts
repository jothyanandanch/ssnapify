import { api, APIError } from './api.js';
import { User, Credits, ImageAsset } from './types.js';
import { showToast, formatDate } from './utils.js';
import { ensureLoggedIn, getUser, refreshUser } from './auth.js';

class DashboardManager {
    private user: User | null = null;
    private credits: Credits | null = null;
    private recentImages: ImageAsset[] = [];

    constructor() {
        this.initializeDashboard();
        this.setupEventListeners();
    }

    private async initializeDashboard(): Promise<void> {
        try {
            await this.loadUserData();
            await this.loadCredits();
            await this.loadRecentImages();
            this.renderDashboard();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            showToast('Failed to load dashboard data', 'error');
        }
    }

    private setupEventListeners(): void {
        // Refresh button
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDashboard());
        }

        // Date range filters
        const dateFromInput = document.getElementById('dateFrom') as HTMLInputElement;
        const dateToInput = document.getElementById('dateTo') as HTMLInputElement;
        
        if (dateFromInput && dateToInput) {
            dateFromInput.addEventListener('change', () => this.loadRecentImages());
            dateToInput.addEventListener('change', () => this.loadRecentImages());
        }

        // Quick action buttons
        document.getElementById('quickUpload')?.addEventListener('click', () => {
            window.location.href = 'upload.html';
        });

        document.getElementById('viewGallery')?.addEventListener('click', () => {
            window.location.href = 'gallery.html';
        });
    }

    private async loadUserData(): Promise<void> {
        this.user = getUser();
        if (!this.user) {
            await refreshUser();
            this.user = getUser();
        }
    }

    private async loadCredits(): Promise<void> {
        this.credits = await api.get<Credits>('/account/credits');
    }

    private async loadRecentImages(): Promise<void> {
        const params: Record<string, string> = {};
        
        const dateFromInput = document.getElementById('dateFrom') as HTMLInputElement;
        const dateToInput = document.getElementById('dateTo') as HTMLInputElement;
        
        if (dateFromInput?.value) params.from = dateFromInput.value;
        if (dateToInput?.value) params.to = dateToInput.value;

        // Limit to recent 10 images
        params.limit = '10';
        
        this.recentImages = await api.get<ImageAsset[]>('/images', params);
    }

    private renderDashboard(): void {
        this.renderUserWelcome();
        this.renderKPIs();
        this.renderCreditsInfo();
        this.renderRecentImages();
        this.renderQuickStats();
    }

    private renderUserWelcome(): void {
        const welcomeElement = document.getElementById('userWelcome');
        if (welcomeElement && this.user) {
            const userName = this.user.username || this.user.email.split('@')[0];
            const timeOfDay = this.getTimeOfDay();
            
            welcomeElement.innerHTML = `
                <h1>Good ${timeOfDay}, ${userName}! 👋</h1>
                <p>Welcome back to your SSnapify dashboard</p>
            `;
        }
    }

    private renderKPIs(): void {
        if (!this.credits) return;

        // Credits remaining
        const creditsElement = document.getElementById('creditsRemaining');
        if (creditsElement) {
            creditsElement.innerHTML = `
                <div class="kpi-value">${this.credits.credit_balance}</div>
                <div class="kpi-label">Credits Remaining</div>
                <div class="kpi-trend ${this.credits.credit_balance > 10 ? 'positive' : 'warning'}">
                    ${this.credits.credit_balance > 10 ? '✅ Good' : '⚠️ Low'}
                </div>
            `;
        }

        // Images this month
        const thisMonth = new Date();
        const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
        const imagesThisMonth = this.recentImages.filter(img => 
            new Date(img.created_at) >= monthStart
        ).length;

        const imagesElement = document.getElementById('imagesThisMonth');
        if (imagesElement) {
            imagesElement.innerHTML = `
                <div class="kpi-value">${imagesThisMonth}</div>
                <div class="kpi-label">Images This Month</div>
                <div class="kpi-trend positive">📈 ${imagesThisMonth > 0 ? 'Active' : 'Get Started'}</div>
            `;
        }

        // Total transformations
        const totalTransformations = this.recentImages.filter(img => 
            img.transformation_type && img.transformation_type !== 'original'
        ).length;

        const transformationsElement = document.getElementById('totalTransformations');
        if (transformationsElement) {
            transformationsElement.innerHTML = `
                <div class="kpi-value">${totalTransformations}</div>
                <div class="kpi-label">Total Transformations</div>
                <div class="kpi-trend positive">✨ Processed</div>
            `;
        }
    }

    private renderCreditsInfo(): void {
        if (!this.credits) return;

        const creditsInfoElement = document.getElementById('creditsInfo');
        if (creditsInfoElement) {
            const nextReset = new Date(this.credits.next_reset_time);
            const daysUntilReset = this.credits.days_until_next_reset;

            creditsInfoElement.innerHTML = `
                <div class="credits-details glass-effect">
                    <h3>Credits Information</h3>
                    <div class="credits-grid">
                        <div class="credit-item">
                            <span class="credit-label">Current Balance</span>
                            <span class="credit-value">${this.credits.credit_balance}</span>
                        </div>
                        <div class="credit-item">
                            <span class="credit-label">Days Until Reset</span>
                            <span class="credit-value">${daysUntilReset}</span>
                        </div>
                        <div class="credit-item">
                            <span class="credit-label">Next Reset</span>
                            <span class="credit-value">${formatDate(this.credits.next_reset_time)}</span>
                        </div>
                        ${this.credits.billing_cycle_ends ? `
                            <div class="credit-item">
                                <span class="credit-label">Billing Cycle Ends</span>
                                <span class="credit-value">${formatDate(this.credits.billing_cycle_ends)}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${this.credits.credit_balance < 10 ? `
                        <div class="low-credits-warning">
                            <p>⚠️ Your credits are running low. Consider upgrading your plan.</p>
                            <a href="pricing.html" class="btn btn-primary btn-sm">View Plans</a>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    private renderRecentImages(): void {
        const recentImagesElement = document.getElementById('recentImages');
        if (!recentImagesElement) return;

        if (this.recentImages.length === 0) {
            recentImagesElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📸</div>
                    <h4>No recent images</h4>
                    <p>Upload your first image to get started!</p>
                    <a href="upload.html" class="btn btn-primary">Upload Now</a>
                </div>
            `;
            return;
        }

        recentImagesElement.innerHTML = `
            <h3>Recent Images</h3>
            <div class="recent-images-grid">
                ${this.recentImages.slice(0, 8).map(image => `
                    <div class="recent-image-card">
                        <img src="${image.secure_url}" alt="${image.title || 'Image'}" loading="lazy">
                        <div class="recent-image-info">
                            <h5>${image.title || 'Untitled'}</h5>
                            <p>${formatDate(image.created_at)}</p>
                            <span class="transformation-badge ${image.transformation_type || 'original'}">
                                ${this.getTransformationLabel(image.transformation_type)}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${this.recentImages.length > 8 ? `
                <div class="view-all-link">
                    <a href="gallery.html" class="btn btn-secondary">View All Images</a>
                </div>
            ` : ''}
        `;
    }

    private renderQuickStats(): void {
        const quickStatsElement = document.getElementById('quickStats');
        if (!quickStatsElement) return;

        // Calculate stats
        const totalImages = this.recentImages.length;
        const transformationTypes = this.recentImages.reduce((acc, img) => {
            const type = img.transformation_type || 'original';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const mostUsedTransformation = Object.entries(transformationTypes)
            .sort(([,a], [,b]) => b - a)[0];

        quickStatsElement.innerHTML = `
            <div class="quick-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <h4>Total Images</h4>
                        <p>${totalImages}</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-info">
                        <h4>Most Used Tool</h4>
                        <p>${mostUsedTransformation ? this.getTransformationLabel(mostUsedTransformation[0]) : 'None'}</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-info">
                        <h4>Account Status</h4>
                        <p>${this.user?.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">💎</div>
                    <div class="stat-info">
                        <h4>Plan</h4>
                        <p>${this.credits?.plan_id || 'Free'}</p>
                    </div>
                </div>
            </div>
        `;
    }

    private getTransformationLabel(type?: string): string {
        if (!type || type === 'original') return 'Original';
        
        const transformationLabels: Record<string, string> = {
            'restore': 'Restored',
            'remove_bg': 'Background Removed',
            'remove_obj': 'Object Removed',
            'image_enhancer': 'Enhanced',
            'generative_fill': 'Generative Fill',
            'replace_background': 'Background Replaced'
        };
        
        return transformationLabels[type] || type;
    }

    private getTimeOfDay(): string {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
    }

    private async refreshDashboard(): Promise<void> {
        const refreshBtn = document.getElementById('refreshData') as HTMLButtonElement;
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<div class="loading-spinner"></div> Refreshing...';
        }

        try {
            await this.initializeDashboard();
            showToast('Dashboard refreshed successfully', 'success');
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
            showToast('Failed to refresh dashboard', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh';
            }
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ensureLoggedIn();
    new DashboardManager();
});
