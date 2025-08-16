// Login Page Functionality
document.addEventListener('DOMContentLoaded', () => {
    initializeLoginPage();
    handleURLParams();
    setupGoogleLogin();
});

function initializeLoginPage() {
    // If user is already logged in, redirect to dashboard
    if (auth.isLoggedIn()) {
        window.location.href = '/dashboard.html';
        return;
    }

    // Hide any existing alerts
    hideAlert();
}

function handleURLParams() {
    const params = utils.parseURLParams();
    
    // Handle successful OAuth callback with token
    if (params.token) {
        handleOAuthSuccess(params.token);
        return;
    }

    // Handle OAuth errors
    if (params.error) {
        handleOAuthError(params.error);
        return;
    }
}

function handleOAuthSuccess(token) {
    try {
        // Store the token
        api.setToken(token);
        
        // Show success state
        const loginForm = document.getElementById('loginForm');
        const loginSuccess = document.getElementById('loginSuccess');
        
        if (loginForm) loginForm.classList.add('hidden');
        if (loginSuccess) loginSuccess.classList.remove('hidden');
        
        // Update page title
        document.title = 'Login Successful - SSnapify';
        
        // Clear URL parameters
        utils.updateURLParams({ token: null, error: null }, true);
        
        // Redirect to dashboard after delay
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('OAuth success handling failed:', error);
        showAlert('Login successful, but there was an error. Please try again.', 'error');
    }
}

function handleOAuthError(error) {
    let message = 'Authentication failed. Please try again.';
    
    switch (error) {
        case 'auth_failed':
            message = 'Google authentication failed. Please try again.';
            break;
        case 'access_denied':
            message = 'Access denied. You need to grant permission to continue.';
            break;
        case 'invalid_request':
            message = 'Invalid request. Please try again.';
            break;
    }
    
    showAlert(message, 'error');
    
    // Clear URL parameters
    utils.updateURLParams({ error: null }, true);
}

function setupGoogleLogin() {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Disable button to prevent double-click
            googleLoginBtn.disabled = true;
            googleLoginBtn.innerHTML = `
                <div class="loading-spinner" style="width: 1.25rem; height: 1.25rem; margin-right: 0.5rem;"></div>
                Connecting to Google...
            `;
            
            // Redirect to Google OAuth
            window.location.href = '/auth/google/login';
        });
    }
}

function showAlert(message, type = 'info') {
    const alertEl = document.getElementById('loginAlert');
    if (!alertEl) return;
    
    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = message;
    alertEl.classList.remove('hidden');
    
    // Auto-hide after 5 seconds for non-error alerts
    if (type !== 'error') {
        setTimeout(() => hideAlert(), 5000);
    }
}

function hideAlert() {
    const alertEl = document.getElementById('loginAlert');
    if (alertEl) {
        alertEl.classList.add('hidden');
    }
}

// Handle page visibility for security
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && auth.isLoggedIn()) {
        // User returned to login page while logged in
        window.location.href = '/dashboard.html';
    }
});
