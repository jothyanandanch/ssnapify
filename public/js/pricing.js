document.addEventListener('DOMContentLoaded', async () => {
    await initializePricing();
});

let currentUser = null;
let creditInfo = null;

async function initializePricing() {
    if (auth.isLoggedIn()) {
        await loadUserPricingData();
        showCurrentPlanSection();
    }
    
    setupPricingEvents();
}

async function loadUserPricingData() {
    try {
        [currentUser, creditInfo] = await Promise.all([
            core.user || core.fetchUserData(),
            core.getCredits()
        ]);

        if (creditInfo) {
            updateCurrentPlanDisplay();
            updatePlanCards();
        }
    } catch (error) {
        console.error('Failed to load pricing data:', error);
    }
}

function updateCurrentPlanDisplay() {
    const currentCredits = document.getElementById('currentCredits');
    const currentPlan = document.getElementById('currentPlan');
    const nextReset = document.getElementById('nextReset');

    if (currentCredits) currentCredits.textContent = creditInfo.credit_balance || 0;
    if (currentPlan) currentPlan.textContent = creditInfo.plan_name || 'Free';
    if (nextReset) nextReset.textContent = creditInfo.days_until_next_reset || '--';
}

function updatePlanCards() {
    const planCards = document.querySelectorAll('.pricing-card');
    
    planCards.forEach(card => {
        const planId = parseInt(card.dataset.plan);
        const planBtn = card.querySelector('.plan-btn');
        
        if (planId === creditInfo.plan_id) {
            // Current plan
            card.classList.add('current');
            if (planBtn) {
                planBtn.textContent = 'Current Plan';
                planBtn.classList.remove('btn-primary');
                planBtn.classList.add('btn-outline');
                planBtn.disabled = true;
            }
        } else {
            // Other plans
            card.classList.remove('current');
            if (planBtn) {
                planBtn.disabled = false;
                planBtn.classList.add('btn-primary');
                planBtn.classList.remove('btn-outline');
                
                if (planId === 1) {
                    planBtn.textContent = 'Downgrade';
                } else {
                    planBtn.textContent = planId === 2 ? 'Upgrade Now' : 'Best Value';
                }
            }
        }
    });
}

function setupPricingEvents() {
    const planBtns = document.querySelectorAll('.plan-btn');
    
    planBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const planId = parseInt(btn.dataset.plan);
            handlePlanSelection(planId);
        });
    });
}

function handlePlanSelection(planId) {
    if (!auth.isLoggedIn()) {
        core.showToast('Please log in to change your plan', 'info');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
        return;
    }

    if (creditInfo && planId === creditInfo.plan_id) {
        core.showToast('This is your current plan', 'info');
        return;
    }

    // Show plan change confirmation
    showPlanChangeModal(planId);
}

function showPlanChangeModal(planId) {
    const planNames = {
        1: 'Free Plan',
        2: 'Pro Monthly',
        3: 'Pro 6-Month'
    };

    const planPrices = {
        1: '$0/month',
        2: '$9.99/month', 
        3: '$49.99/6 months'
    };

    const modal = document.createElement('div');
    modal.className = 'modal plan-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>Confirm Plan Change</h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <p>You are switching to <strong>${planNames[planId]}</strong> (${planPrices[planId]})</p>
                ${creditInfo ? `<p>Current plan: <strong>${creditInfo.plan_name}</strong></p>` : ''}
                <p><em>Note: This is a demo. In production, this would integrate with a payment processor like Stripe.</em></p>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline modal-cancel">Cancel</button>
                <button class="btn btn-primary modal-confirm" data-plan="${planId}">Confirm</button>
            </div>
        </div>
    `;

    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const confirmBtn = modal.querySelector('.modal-confirm');
    const overlay = modal.querySelector('.modal-overlay');

    [closeBtn, cancelBtn, overlay].forEach(element => {
        element.addEventListener('click', () => {
            modal.remove();
        });
    });

    confirmBtn.addEventListener('click', async () => {
        const selectedPlan = parseInt(confirmBtn.dataset.plan);
        await changePlan(selectedPlan);
        modal.remove();
    });
}

async function changePlan(planId) {
    try {
        core.showToast('Processing plan change...', 'info');
        
        // In a real app, this would call your payment API
        // For demo purposes, we'll simulate the plan change
        setTimeout(async () => {
            core.showToast('Plan changed successfully!', 'success');
            
            // Reload pricing data
            await loadUserPricingData();
            updateCurrentPlanDisplay();
            updatePlanCards();
        }, 1000);

    } catch (error) {
        console.error('Plan change failed:', error);
        core.showToast('Failed to change plan. Please try again.', 'error');
    }
}

function showCurrentPlanSection() {
    const currentPlanSection = document.getElementById('currentPlanSection');
    if (currentPlanSection) {
        currentPlanSection.style.display = 'block';
    }
}
