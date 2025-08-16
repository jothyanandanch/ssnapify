// Redis Logout Implementation
document.addEventListener('DOMContentLoaded', async () => {
    const logoutStatus = document.getElementById('logoutStatus');
    const logoutComplete = document.getElementById('logoutComplete');
    const logoutError = document.getElementById('logoutError');
    const logoutMessage = document.getElementById('logoutMessage');
    const errorMessage = document.getElementById('errorMessage');

    // Update progress message
    function updateMessage(message) {
        if (logoutMessage) {
            logoutMessage.textContent = message;
        }
    }

    try {
        // Step 1: Invalidate current token
        updateMessage('Invalidating current session...');
        
        const token = api.getToken();
        if (token) {
            try {
                await apiHelpers.logout();
            } catch (error) {
                console.warn('Server-side logout failed:', error);
                // Continue with client-side logout
            }
        }

        // Step 2: Clear local storage
        updateMessage('Clearing local data...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Visual delay
        
        api.removeToken();
        localStorage.removeItem('user_data');
        sessionStorage.clear();

        // Step 3: Clear any cached data
        updateMessage('Clearing cached data...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Visual delay

        // Try to clear browser cache (limited capability)
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            } catch (error) {
                console.warn('Failed to clear cache:', error);
            }
        }

        // Step 4: Final cleanup
        updateMessage('Finalizing logout...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Visual delay

        // Success - show completion
        if (logoutStatus) logoutStatus.classList.add('hidden');
        if (logoutComplete) logoutComplete.classList.remove('hidden');

        // Auto redirect after 3 seconds
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 3000);

    } catch (error) {
        console.error('Logout process failed:', error);
        
        // Error - show error state
        if (logoutStatus) logoutStatus.classList.add('hidden');
        if (logoutError) logoutError.classList.remove('hidden');
        
        if (errorMessage) {
            errorMessage.textContent = 'Session ended on client-side. Server-side logout may have failed.';
        }

        // Still clear local data as fallback
        api.removeToken();
        localStorage.clear();
        sessionStorage.clear();
    }
});

// Handle logout options
document.addEventListener('click', (e) => {
    if (e.target.matches('a[href="/login.html"]')) {
        // Clear any remaining data before redirect
        api.removeToken();
        localStorage.clear();
        sessionStorage.clear();
    }
});

// Prevent back navigation
window.history.pushState(null, null, window.location.href);
window.addEventListener('popstate', () => {
    window.history.pushState(null, null, window.location.href);
});
