document.addEventListener('DOMContentLoaded', () => {
    setupHeroActions();
    setupFeatureCards();
    setupScrollEffects();
    animateStats();
});

function setupHeroActions() {
    const heroStart = document.getElementById('heroStart');
    
    if (heroStart) {
        heroStart.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (auth.isLoggedIn()) {
                window.location.href = '/upload.html';
            } else {
                core.showToast('Please log in to start creating', 'info');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1000);
            }
        });
    }
}

function setupFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
        card.addEventListener('click', () => {
            const tool = card.dataset.tool;
            
            if (auth.isLoggedIn()) {
                // Redirect to specific tool or upload page
                window.location.href = '/upload.html';
            } else {
                core.showToast('Please log in to use AI tools', 'info');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
            }
        });
    });
}

function setupScrollEffects() {
    // Smooth scrolling for anchor links
    window.scrollToFeatures = function() {
        const featuresSection = document.getElementById('features');
        if (featuresSection) {
            featuresSection.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    // Intersection Observer for animations
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

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.feature-card, .stat-item');
    animateElements.forEach(el => observer.observe(el));
}

function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const animateNumber = (element, target, suffix = '') => {
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            let displayValue = Math.floor(current);
            if (suffix.includes('M')) {
                displayValue = (current / 1000000).toFixed(1) + 'M+';
            } else if (suffix.includes('k')) {
                displayValue = (current / 1000).toFixed(0) + 'k+';
            } else if (suffix.includes('%')) {
                displayValue = current.toFixed(1) + '%';
            } else {
                displayValue = displayValue.toString();
            }
            
            element.textContent = displayValue;
        }, 20);
    };

    // Animate stats when they come into view
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const text = element.textContent;
                let target = parseInt(text.replace(/[^\d]/g, ''));
                
                if (text.includes('M+')) {
                    target = target * 1000000;
                } else if (text.includes('k+')) {
                    target = target * 1000;
                }
                
                animateNumber(element, target, text);
                statsObserver.unobserve(element);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => {
        statsObserver.observe(stat);
    });
}
