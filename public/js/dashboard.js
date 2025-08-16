class Dashboard {
    constructor() {
        this.init();
    }

    async init() {
        if (!window.authManager || !window.authManager.token) {
            window.location.href = '/static/login.html';
            return;
        }

        await this.loadUserData();
        await this.loadImages();
        await this.loadCredits();
    }

    async loadUserData() {
        try {
            const response = await window.authManager.apiCall('/users/me');
            if (response && response.ok) {
                const user = await response.json();
                this.displayUserInfo(user);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            this.showError('Failed to load user information');
        }
    }

    async loadImages() {
        try {
            const response = await window.authManager.apiCall('/images/?limit=10');
            if (response && response.ok) {
                const images = await response.json();
                this.displayRecentImages(images);
            }
        } catch (error) {
            console.error('Failed to load images:', error);
            this.showError('Failed to load recent images');
        }
    }

    async loadCredits() {
        try {
            const response = await window.authManager.apiCall('/account/credits');
            if (response && response.ok) {
                const credits = await response.json();
                this.displayCredits(credits);
            }
        } catch (error) {
            console.error('Failed to load credits:', error);
            this.showError('Failed to load credit information');
        }
    }

    displayUserInfo(user) {
        const userNameEl = document.getElementById('user-name-display');
        const userEmailEl = document.getElementById('user-email-display');
        
        if (userNameEl) userNameEl.textContent = user.username || 'User';
        if (userEmailEl) userEmailEl.textContent = user.email || '';
    }

    displayCredits(credits) {
        const creditsEl = document.getElementById('credits-display');
        const planEl = document.getElementById('plan-display');
        const resetEl = document.getElementById('reset-display');
        
        if (creditsEl) creditsEl.textContent = credits.credit_balance || 0;
        if (planEl) planEl.textContent = credits.plan_name || 'Free';
        if (resetEl) resetEl.textContent = `${credits.days_until_next_reset || 0} days`;
    }

    displayRecentImages(images) {
        const container = document.getElementById('recent-images');
        if (!container) return;

        if (!images || images.length === 0) {
            container.innerHTML = '<p>No images uploaded yet. <a href="/static/upload.html">Upload your first image</a></p>';
            return;
        }

        const imagesHtml = images.map(image => `
            <div class="image-card">
                <img src="${image.secure_url}" alt="${image.title}" loading="lazy">
                <div class="image-info">
                    <h4>${image.title}</h4>
                    <p>${image.transformation_type || 'Original'}</p>
                    <small>${new Date(image.created_at).toLocaleDateString()}</small>
                </div>
            </div>
        `).join('');

        container.innerHTML = imagesHtml;
    }

    showError(message) {
        const errorContainer = document.getElementById('error-messages');
        if (errorContainer) {
            errorContainer.innerHTML = `<div class="alert alert-error">${message}</div>`;
        } else {
            console.error(message);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth manager to initialize
    setTimeout(() => {
        new Dashboard();
    }, 100);
});
