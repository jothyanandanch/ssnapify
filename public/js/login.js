document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (auth.isLoggedIn()) {
        window.location.href = '/dashboard.html';
        return;
    }

    setupLoginForm();
    handleURLParams();
});

function setupLoginForm() {
    const googleBtn = document.getElementById('googleBtn');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            googleBtn.disabled = true;
            googleBtn.innerHTML = `
                <svg class="google-icon" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Connecting...
            `;
            
            // Redirect to Google OAuth
            window.location.href = '/auth/google/login';
        });
    }
}

function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Handle errors
    if (params.get('error')) {
        showError('Authentication failed. Please try again.');
        return;
    }
    
    // Handle token (already handled by core.js)
    if (params.get('token')) {
        showSuccess();
    }
}

function showSuccess() {
    const loginForm = document.getElementById('loginForm');
    const loginSuccess = document.getElementById('loginSuccess');
    
    if (loginForm) loginForm.style.display = 'none';
    if (loginSuccess) loginSuccess.style.display = 'block';
}

function showError(message) {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loginForm) loginForm.style.display = 'none';
    if (loginError) loginError.style.display = 'block';
    if (errorMessage) errorMessage.textContent = message;
}

// Add spinning animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
