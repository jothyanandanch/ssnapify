// Pricing Page Functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;
    
    await initializePricing();
    await loadPricingData();
    setupPricingEvents();
});

let currentUser = null;
let creditInfo = null;
let transactionHistory = [];

async function initializePricing() {
    // Update auth UI
    await themeManager.updateAuthUI();
}

async function loadPricingData() {
    try {
        // Load user and credit info
        [currentUser, creditInfo] = await Promise.all([
            apiHelpers.getCurrentUser(),
            apiHelpers.getCredits()
        ]);
        
        // Update current plan display
        updateCurrentPlan();
        
        // Load transaction history (simulated for demo)
        await loadTransactionHistory();
        
        // Update usage statistics (simulated for demo)
        updateUsageStatistics();
        
    } catch (error) {
        console.error('Failed to load pricing data:', error);
        toast.error('Failed to load billing information');
    }
}

function updateCurrentPlan() {
    const currentPlanName = document.getElementById('currentPlanName');
    const currentCredits = document.getElementById('currentCredits');
    const planStatus = document.getElementById('planStatus');
    const nextReset = document.getElementById('nextReset');
    const billingCycle = document.getElementById('billingCycle');
    
    if (currentPlanName) {
        currentPlanName.textContent = creditInfo.plan_name;
    }
    
    if (currentCredits) {
        currentCredits.textContent = creditInfo.credit_balance;
    }
    
    if (planStatus) {
        planStatus.textContent = creditInfo.plan_id === 1 ? 'Free Plan' : 'Active';
    }
    
    if (nextReset) {
        const resetDate = new Date();
        resetDate.setDate(resetDate.getDate() + creditInfo.days_until_next_reset);
        nextReset.textContent = resetDate.toLocaleDateString();
    }
    
    if (billingCycle) {
        const cycles = {
            1: 'Monthly (Free)',
            2: 'Monthly',
            3: '6 Months'
        };
        billingCycle.textContent = cycles[creditInfo.plan_id] || 'Unknown';
    }
    
    // Update plan cards to show current plan
    updatePlanCards();
}

function updatePlanCards() {
    const planCards = document.querySelectorAll('.plan-card');
    
    planCards.forEach(card => {
        const planId = parseInt(card.getAttribute('data-plan'));
        const planBtn = card.querySelector('.plan-btn');
        
        if (planId === creditInfo.plan_id) {
            card.classList.add('current-plan');
            if (planBtn) {
                planBtn.textContent = 'Current Plan';
                planBtn.disabled = true;
                planBtn.classList.remove('btn-primary');
                planBtn.classList.add('btn-outline');
            }
        } else {
            card.classList.remove('current-plan');
            if (planBtn) {
                planBtn.disabled = false;
                planBtn.classList.add('btn-primary');
                planBtn.classList.remove('btn-outline');
                
                if (planId === 1) {
                    planBtn.textContent = 'Downgrade';
                } else {
                    planBtn.textContent = 'Upgrade Now';
                }
            }
        }
    });
}

async function loadTransactionHistory() {
    // For demo purposes, we'll simulate transaction history
    // In a real app, this would come from your backend
    transactionHistory = generateDemoTransactions();
    updateTransactionDisplay();
}

function generateDemoTransactions() {
    const transactions = [];
    const now = new Date();
    
    // Credit reset transaction
    transactions.push({
        id: 1,
        type: 'credit_reset',
        description: 'Monthly credit reset',
        amount: '+50 credits',
        date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        status: 'completed'
    });
    
    // Usage transactions
    const usageTypes = [
        { type: 'remove_bg', description: 'Background Removal', cost: 1 },
        { type: 'enhance', description: 'Image Enhancement', cost: 1 },
        { type: 'generative_fill', description: 'Generative Fill', cost: 3 },
        { type: 'replace_bg', description: 'Background Replacement', cost: 2 }
    ];
    
    for (let i = 0; i < 8; i++) {
        const usage = usageTypes[Math.floor(Math.random() * usageTypes.length)];
        transactions.push({
            id: i + 2,
            type: 'credit_usage',
            description: usage.description,
            amount: `-${usage.cost} credit${usage.cost > 1 ? 's' : ''}`,
            date: new Date(now.getTime() - Math.random() * 10 * 24 * 60 * 60 * 1000),
            status: 'completed'
        });
    }
    
    // Sort by date (newest first)
    return transactions.sort((a, b) => b.date - a.date);
}

function updateTransactionDisplay() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    
    if (transactionHistory.length === 0) {
        transactionList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📄</div>
                <h3>No transactions yet</h3>
                <p>Your transaction history will appear here</p>
            </div>
        `;
        return;
    }
    
    const transactionsHTML = transactionHistory.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-icon">
                ${getTransactionIcon(transaction.type)}
            </div>
            <div class="transaction-details">
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-date">${utils.formatDate(transaction.date)}</div>
            </div>
            <div class="transaction-amount ${transaction.amount.startsWith('+') ? 'positive' : 'negative'}">
                ${transaction.amount}
            </div>
        </div>
    `).join('');
    
    transactionList.innerHTML = transactionsHTML;
}

function getTransactionIcon(type) {
    const icons = {
        'credit_reset': '🔄',
        'credit_usage': '💳',
        'plan_change': '📋',
        'payment': '💰'
    };
    return icons[type] || '📄';
}

function updateUsageStatistics() {
    // Demo statistics
    const totalCreditsUsed = document.getElementById('totalCreditsUsed');
    const mostUsedTool = document.getElementById('mostUsedTool');
    const averageDaily = document.getElementById('averageDaily');
    
    if (totalCreditsUsed) {
        totalCreditsUsed.textContent = '127';
    }
    
    if (mostUsedTool) {
        mostUsedTool.textContent = 'Background Removal';
    }
    
    if (averageDaily) {
        averageDaily.textContent = '3.2';
    }
}

function setupPricingEvents() {
    // Plan selection buttons
    const planBtns = document.querySelectorAll('.plan-btn');
    planBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (btn.disabled) return;
            
            const planCard = btn.closest('.plan-card');
            const planId = parseInt(planCard.getAttribute('data-plan'));
            
            await handlePlanSelection(planId);
        });
    });
    
    // Transaction filter
    const transactionFilter = document.getElementById('transactionFilter');
    if (transactionFilter) {
        transactionFilter.addEventListener('change', (e) => {
            filterTransactions(e.target.value);
        });
    }
    
    // Setup plan modal events
    setupPlanModal();
}

async function handlePlanSelection(planId) {
    if (planId === creditInfo.plan_id) {
        toast.info('This is already your current plan');
        return;
    }
    
    const planNames = {
        1: 'Free Plan',
        2: 'Pro Monthly ($9.99/month)',
        3: 'Pro 6-Month ($49.99/6 months)'
    };
    
    // Show confirmation modal
    const modal = document.getElementById('planModal');
    const newPlanInfo = document.getElementById('newPlanInfo');
    
    if (newPlanInfo) {
        newPlanInfo.innerHTML = `
            <div class="plan-change-card">
                <h4>${planNames[planId]}</h4>
                <p>You will be switching from <strong>${creditInfo.plan_name}</strong> to <strong>${planNames[planId]}</strong></p>
                ${planId > 1 ? '<p><em>Note: This is a demo. In production, this would integrate with a payment processor like Stripe.</em></p>' : ''}
            </div>
        `;
    }
    
    modal.classList.remove('hidden');
}

function setupPlanModal() {
    const modal = document.getElementById('planModal');
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const cancelBtn = document.getElementById('cancelPlan');
    const confirmBtn = document.getElementById('confirmPlan');
    
    // Close modal events
    [overlay, closeBtn, cancelBtn].forEach(el => {
        if (el) {
            el.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
    });
    
    // Confirm plan change
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const planCard = document.querySelector('.plan-card.selected');
            if (planCard) {
                const planId = parseInt(planCard.getAttribute('data-plan'));
                await confirmPlanChange(planId);
            }
            modal.classList.add('hidden');
        });
    }
}

async function confirmPlanChange(planId) {
    try {
        // In a real app, this would make an API call to change the plan
        // For demo purposes, we'll just simulate the change
        
        toast.info('Processing plan change...');
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update local credit info
        creditInfo.plan_id = planId;
        creditInfo.plan_name = APP_CONFIG.PLAN_NAMES[planId];
        
        if (planId > 1) {
            creditInfo.credit_balance = 500; // Pro plans get 500 credits
        }
        
        // Update UI
        updateCurrentPlan();
        updateTransactionDisplay();
        
        // Add transaction record
        transactionHistory.unshift({
            id: Date.now(),
            type: 'plan_change',
            description: `Plan changed to ${creditInfo.plan_name}`,
            amount: '+500 credits',
            date: new Date(),
            status: 'completed'
        });
        
        updateTransactionDisplay();
        
        toast.success(`Successfully switched to ${creditInfo.plan_name}`);
        
        // Update credits in navbar
        await themeManager.updateCredits();
        
    } catch (error) {
        console.error('Plan change failed:', error);
        toast.error('Failed to change plan. Please try again.');
    }
}

function filterTransactions(filterType) {
    let filteredTransactions = transactionHistory;
    
    if (filterType !== 'all') {
        filteredTransactions = transactionHistory.filter(t => t.type === filterType);
    }
    
    // Temporarily update the display with filtered data
    const originalHistory = transactionHistory;
    transactionHistory = filteredTransactions;
    updateTransactionDisplay();
    transactionHistory = originalHistory;
}

// Auto-refresh credits periodically
setInterval(async () => {
    try {
        const newCreditInfo = await apiHelpers.getCredits();
        if (newCreditInfo.credit_balance !== creditInfo.credit_balance) {
            creditInfo = newCreditInfo;
            updateCurrentPlan();
        }
    } catch (error) {
        console.error('Failed to refresh credits:', error);
    }
}, 60000); // Refresh every minute
