// Landing Page Functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize page
    await initializePage();
    setupToolNavigation();
    setupHeroActions();
    setupScrollEffects();
});

async function initializePage() {
    // Check authentication state and update UI
    await themeManager.updateAuthUI();
    
    // Setup dynamic content
    updateStatsCounters();
    
    // Setup smooth scrolling for anchor links
    setupSmoothScrolling();
}

function setupToolNavigation() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    
    toolButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const redirectUrl = btn.getAttribute('data-redirect');
            if (redirectUrl) {
                // Check if user is logged in for tool access
                if (!auth.isLoggedIn()) {
                    toast.warning('Please login to use AI tools');
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 1500);
                } else {
                    window.location.href = redirectUrl;
                }
            }
        });
    });
}

function setupHeroActions() {
    const heroUpload = document.getElementById('heroUpload');
    
    if (heroUpload) {
        heroUpload.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (!auth.isLoggedIn()) {
                toast.info('Redirecting to login...');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1000);
            } else {
                window.location.href = '/upload.html';
            }
        });
    }
}

function setupSmoothScrolling() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function updateStatsCounters() {
    // Animate counter numbers
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
        const target = parseInt(counter.textContent.replace(/[^\d]/g, ''));
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = formatStatNumber(Math.floor(current), counter.textContent);
        }, 20);
    });
}

function formatStatNumber(num, original) {
    if (original.includes('M+')) {
        return (num / 1000000).toFixed(1) + 'M+';
    } else if (original.includes('k+')) {
        return (num / 1000).toFixed(0) + 'k+';
    } else if (original.includes('%')) {
        return num.toFixed(1) + '%';
    }
    return num.toString();
}

function setupScrollEffects() {
    // Add intersection observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe tool cards and stat items
    const animateElements = document.querySelectorAll('.tool-card, .stat-item');
    animateElements.forEach(el => observer.observe(el));
}
