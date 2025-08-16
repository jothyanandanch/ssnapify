document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;

    await loadDashboardData();
    setupDashboard();
});

async function loadDashboardData() {
    try {
        // Load user info, credits, and recent images in parallel
        const [user, credits, images] = await Promise.all([
            core.user || core.fetchUserData(),
            core.getCredits(),
            core.getUserImages({ limit: 6 })
        ]);

        // Update user info
        if (user) {
            updateUserInfo(user);
        }

        // Update credits and plan info
        if (credits) {
            updateCreditsInfo(credits);
        }

        // Update recent images
        updateRecentImages(images || []);

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        core.showToast('Failed to load dashboard data', 'error');
    }
}

function updateUserInfo(user) {
    const userNameDisplay = document.getElementById('userNameDisplay');
    if (userNameDisplay) {
        userNameDisplay.textContent = user.username || user.email.split('@')[0];
    }
}

function updateCreditsInfo(credits) {
    // Update credits count
    const creditsCount = document.getElementById('creditsCount');
    if (creditsCount) {
        creditsCount.textContent = credits.credit_balance || 0;
    }

    // Update plan name
    const planName = document.getElementById('planName');
    if (planName) {
        planName.textContent = credits.plan_name || 'Free';
    }

    // Update next reset days
    const nextReset = document.getElementById('nextReset');
    if (nextReset) {
        nextReset.textContent = credits.days_until_next_reset || '--';
    }
}

function updateRecentImages(images) {
    const recentImagesContainer = document.getElementById('recentImages');
    const imageCount = document.getElementById('imageCount');
    
    // Update image count
    if (imageCount) {
        imageCount.textContent = images.length;
    }

    if (!recentImagesContainer) return;

    if (images.length === 0) {
        recentImagesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖼️</div>
                <h3>No images yet</h3>
                <p>Upload your first image to get started</p>
                <a href="/upload.html" class="btn btn-primary">Upload Images</a>
            </div>
        `;
        return;
    }

    const imagesHTML = images.map(image => `
        <div class="image-card" onclick="window.location.href='/gallery.html'">
            <div class="image-thumbnail">
                <img src="${image.secure_url}" alt="${image.title}" loading="lazy">
                <div class="image-overlay">
                    <span class="image-type">${formatTransformationType(image.transformation_type)}</span>
                </div>
            </div>
            <div class="image-info">
                <h4 class="image-title">${truncateText(image.title, 20)}</h4>
                <p class="image-date">${formatDate(image.created_at)}</p>
            </div>
        </div>
    `).join('');

    recentImagesContainer.innerHTML = imagesHTML;
}

function setupDashboard() {
    // Any additional dashboard setup
    console.log('Dashboard setup complete');
}

// Utility functions
function formatTransformationType(type) {
    if (!type) return 'Original';
    return type.replace(/_/g, ' ').split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function truncateText(text, length) {
    return text && text.length > length ? text.substring(0, length) + '...' : text;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}
