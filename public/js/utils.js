// Utility Functions
window.utils = {
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Format date
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format relative time
    formatRelativeTime(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        
        return this.formatDate(dateString);
    },

    // Validate file
    validateFile(file) {
        const errors = [];

        if (!APP_CONFIG.SUPPORTED_FORMATS.includes(file.type)) {
            errors.push(`Unsupported file format: ${file.type}`);
        }

        if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
            errors.push(`File too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(APP_CONFIG.MAX_FILE_SIZE)})`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    // Generate unique ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    // Download file
    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Scroll to element
    scrollTo(element, options = {}) {
        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };

        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        if (element) {
            element.scrollIntoView({ ...defaultOptions, ...options });
        }
    },

    // Parse URL parameters
    parseURLParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },

    // Update URL parameters
    updateURLParams(params, replace = false) {
        const url = new URL(window.location.href);
        
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, params[key]);
            }
        });

        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({}, '', url.toString());
    },

    // Escape HTML
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Truncate text
    truncate(text, length = 100, suffix = '...') {
        if (text.length <= length) return text;
        return text.substring(0, length) + suffix;
    },

    // Capitalize first letter
    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    },

    // Format transformation type
    formatTransformationType(type) {
        if (!type) return 'Original';
        return type.replace(/_/g, ' ').split(' ').map(word => 
            this.capitalize(word)
        ).join(' ');
    },

    // Generate transformation description
    getTransformationDescription(type) {
        const descriptions = {
            restore: 'Enhanced and restored image quality using AI',
            remove_bg: 'Background removed with precision AI detection',
            remove_obj: 'Unwanted objects removed seamlessly',
            enhance: 'Image quality improved with AI enhancement',
            replace_bg: 'Background replaced with AI-generated content',
            generative_fill: 'Areas filled with AI-generated content'
        };
        return descriptions[type] || 'AI-processed image';
    },

    // Check if user is on mobile
    isMobile() {
        return window.innerWidth <= 768;
    },

    // Get transformation icon
    getTransformationIcon(type) {
        const icons = {
            restore: '🔧',
            remove_bg: '🖼️',
            remove_obj: '✂️',
            enhance: '✨',
            replace_bg: '🌈',
            generative_fill: '🎨'
        };
        return icons[type] || '📷';
    }
};

// Toast Notification System
window.toast = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = APP_CONFIG.TOAST_DURATION) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <span class="toast-icon-content">${icons[type] || icons.info}</span>
            </div>
            <div class="toast-content">
                <div class="toast-message">${utils.escapeHTML(message)}</div>
            </div>
            <button class="toast-close">×</button>
        `;

        this.container.appendChild(toast);

        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    },

    remove(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    },

    success(message, duration) {
        return this.show(message, 'success', duration);
    },

    error(message, duration) {
        return this.show(message, 'error', duration);
    },

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    },

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
};

// Modal System
window.modal = {
    show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            
            // Focus trap
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    },

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    confirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const messageEl = document.getElementById('confirmMessage');
            const proceedBtn = document.getElementById('confirmProceed');
            const cancelBtn = document.getElementById('confirmCancel');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;

            const cleanup = () => {
                this.hide('confirmModal');
                proceedBtn?.removeEventListener('click', handleProceed);
                cancelBtn?.removeEventListener('click', handleCancel);
            };

            const handleProceed = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            proceedBtn?.addEventListener('click', handleProceed);
            cancelBtn?.addEventListener('click', handleCancel);

            this.show('confirmModal');
        });
    },

    alert(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('alertModal');
            const titleEl = document.getElementById('alertTitle');
            const messageEl = document.getElementById('alertMessage');
            const okBtn = document.getElementById('alertOk');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;

            const cleanup = () => {
                this.hide('alertModal');
                okBtn?.removeEventListener('click', handleOk);
            };

            const handleOk = () => {
                cleanup();
                resolve();
            };

            okBtn?.addEventListener('click', handleOk);

            this.show('alertModal');
        });
    }
};

// Initialize toast system on DOM load
document.addEventListener('DOMContentLoaded', () => {
    toast.init();
});
