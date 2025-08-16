// Auth Management
const API_BASE = 'http://localhost:8000';
const getToken = () => localStorage.getItem('access_token') || '';
const clearToken = () => localStorage.removeItem('access_token');

async function logout() {
    try {
        const token = getToken();
        if (token) {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.warn('Server logout failed:', error);
    } finally {
        clearToken();
        window.location.href = '/static/login.html';
    }
}

async function checkAuth() {
    const token = getToken();
    if (!token) return null;
    
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) return await response.json();
        else { clearToken(); return null; }
    } catch { return null; }
}

// Support functionality
class SupportManager {
    constructor() {
        this.user = null;
        this.init();
    }

    async init() {
        this.user = await checkAuth();
        this.bindEvents();
        this.initFAQ();
        this.prefillUserInfo();
    }

    async prefillUserInfo() {
        if (this.user) {
            const nameInput = document.getElementById('name');
            if (nameInput && !nameInput.value) {
                nameInput.value = this.user.username || this.user.email?.split('@')[0] || '';
            }
        }
    }

    bindEvents() {
        // Contact form
        const supportForm = document.getElementById('support-form');
        if (supportForm) {
            supportForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitContactForm();
            });
        }

        // Quick action buttons
        document.querySelectorAll('.contact-method').forEach(method => {
            method.addEventListener('click', () => {
                this.scrollToContactForm();
            });
        });

        // FAQ search
        const faqSearch = document.getElementById('faq-search');
        if (faqSearch) {
            faqSearch.addEventListener('input', (e) => {
                this.searchFAQ(e.target.value);
            });
        }
    }

    async submitContactForm() {
        const nameInput = document.getElementById('name');
        const subjectInput = document.getElementById('subject');
        const messageInput = document.getElementById('message');
        const statusDiv = document.getElementById('form-status');

        // Get form values
        const formData = {
            name: nameInput?.value?.trim() || '',
            subject: subjectInput?.value?.trim() || '',
            message: messageInput?.value?.trim() || ''
        };

        // Validation
        const validation = this.validateForm(formData);
        if (!validation.valid) {
            this.showFormStatus(validation.error, 'error');
            return;
        }

        try {
            this.showFormStatus('Sending message...', 'loading');

            const token = getToken();
            const response = await fetch(`${API_BASE}/support/ticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showFormStatus('Message sent successfully! We\'ll get back to you within 24 hours.', 'success');
                this.resetForm();
                this.showThankYouModal();
            } else {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to send message');
            }
        } catch (error) {
            console.error('Support form error:', error);
            this.showFormStatus('Failed to send message. Please try again or contact us directly.', 'error');
        }
    }

    validateForm(data) {
        if (!data.name) {
            return { valid: false, error: 'Please enter your full name.' };
        }

        if (data.name.length < 2) {
            return { valid: false, error: 'Name must be at least 2 characters long.' };
        }

        if (!data.subject) {
            return { valid: false, error: 'Please enter a subject.' };
        }

        if (data.subject.length < 5) {
            return { valid: false, error: 'Subject must be at least 5 characters long.' };
        }

        if (!data.message) {
            return { valid: false, error: 'Please enter your message.' };
        }

        if (data.message.length < 10) {
            return { valid: false, error: 'Message must be at least 10 characters long.' };
        }

        return { valid: true };
    }

    showFormStatus(message, type) {
        const statusDiv = document.getElementById('form-status');
        if (!statusDiv) return;

        const statusClasses = {
            'loading': 'status-loading',
            'success': 'status-success',
            'error': 'status-error'
        };

        statusDiv.className = `form-status ${statusClasses[type] || ''}`;
        statusDiv.innerHTML = `
            <div class="status-message">
                ${type === 'loading' ? '<div class="spinner"></div>' : ''}
                ${message}
            </div>
        `;
        statusDiv.style.display = 'block';

        // Auto-hide success/error messages after 10 seconds
        if (type !== 'loading') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 10000);
        }
    }

    resetForm() {
        const form = document.getElementById('support-form');
        if (form) {
            form.reset();
            // Re-prefill user info if logged in
            this.prefillUserInfo();
        }
    }

    showThankYouModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Thank You!</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Your support ticket has been submitted successfully.</p>
                    <p>Our team will review your message and get back to you within 24 hours.</p>
                    <div class="modal-actions">
                        <button class="btn primary" onclick="this.closest('.modal').remove()">Got it</button>
                        <a href="/static/dashboard.html" class="btn secondary">Go to Dashboard</a>
                    </div>
                </div>
            </div>
        `;

        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        `;

        document.body.appendChild(modal);

        // Close modal events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (modal.parentNode) modal.remove();
        }, 10000);
    }

    scrollToContactForm() {
        const contactSection = document.querySelector('.support-form-section');
        if (contactSection) {
            contactSection.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start' 
            });
            
            // Focus on the name input
            setTimeout(() => {
                const nameInput = document.getElementById('name');
                if (nameInput) nameInput.focus();
            }, 500);
        }
    }

    initFAQ() {
        // FAQ toggle functionality
        document.querySelectorAll('.faq-item').forEach(item => {
            const question = item.querySelector('h4');
            if (question) {
                question.style.cursor = 'pointer';
                question.addEventListener('click', () => {
                    const isActive = item.classList.contains('active');
                    
                    // Close all FAQ items
                    document.querySelectorAll('.faq-item').forEach(faq => {
                        faq.classList.remove('active');
                    });
                    
                    // Open clicked item if it wasn't active
                    if (!isActive) {
                        item.classList.add('active');
                    }
                });
            }
        });

        // Add expand/collapse icons
        document.querySelectorAll('.faq-item h4').forEach(question => {
            const icon = document.createElement('span');
            icon.className = 'faq-icon';
            icon.textContent = '+';
            icon.style.cssText = 'float: right; font-weight: bold; transition: transform 0.3s;';
            question.appendChild(icon);
        });

        // Update icons when FAQ items are toggled
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const item = mutation.target;
                    const icon = item.querySelector('.faq-icon');
                    if (icon) {
                        if (item.classList.contains('active')) {
                            icon.textContent = '−';
                            icon.style.transform = 'rotate(180deg)';
                        } else {
                            icon.textContent = '+';
                            icon.style.transform = 'rotate(0deg)';
                        }
                    }
                }
            });
        });

        document.querySelectorAll('.faq-item').forEach(item => {
            observer.observe(item, { attributes: true });
        });
    }

    searchFAQ(query) {
        const faqItems = document.querySelectorAll('.faq-item');
        const searchTerm = query.toLowerCase().trim();

        faqItems.forEach(item => {
            const question = item.querySelector('h4').textContent.toLowerCase();
            const answer = item.querySelector('p').textContent.toLowerCase();
            
            if (!searchTerm || question.includes(searchTerm) || answer.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
                item.classList.remove('active');
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new SupportManager();
});
