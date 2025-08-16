// Admin Panel Functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Require admin access
    if (!(await auth.requireAdmin())) return;
    
    await initializeAdmin();
    await loadAdminData();
    setupAdminEvents();
});

let allUsers = [];
let filteredUsers = [];
let currentEditingUser = null;

async function initializeAdmin() {
    // Update auth UI
    await themeManager.updateAuthUI();
    
    // Check system health
    await checkSystemHealth();
}

async function loadAdminData() {
    try {
        // Load all users
        allUsers = await apiHelpers.getAllUsers();
        filteredUsers = [...allUsers];
        
        // Update displays
        updateUsersTable();
        updateQuickStats();
        
    } catch (error) {
        console.error('Failed to load admin data:', error);
        toast.error('Failed to load admin data');
    }
}

async function checkSystemHealth() {
    const healthChecks = [
        { id: 'redisHealth', check: apiHelpers.checkRedisHealth },
        { id: 'cloudinaryHealth', check: apiHelpers.checkCloudinaryHealth },
        { id: 'generalHealth', check: apiHelpers.checkHealth }
    ];
    
    for (const health of healthChecks) {
        try {
            const result = await health.check();
            updateHealthStatus(health.id, result.status === 'healthy', result);
        } catch (error) {
            updateHealthStatus(health.id, false, { error: error.message });
        }
    }
}

function updateHealthStatus(elementId, isHealthy, data) {
    const healthCard = document.getElementById(elementId);
    if (!healthCard) return;
    
    const icon = healthCard.querySelector('.health-icon');
    const status = healthCard.querySelector('.health-status');
    
    if (icon) {
        icon.textContent = isHealthy ? '🟢' : '🔴';
    }
    
    if (status) {
        status.textContent = isHealthy ? 'Healthy' : 'Unhealthy';
        status.className = `health-status ${isHealthy ? 'healthy' : 'unhealthy'}`;
    }
    
    if (data.error) {
        healthCard.title = `Error: ${data.error}`;
    }
}

function updateUsersTable() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    if (filteredUsers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">No users found</td>
            </tr>
        `;
        return;
    }
    
    const usersHTML = filteredUsers.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${utils.escapeHTML(user.email)}</td>
            <td>${utils.escapeHTML(user.username || '-')}</td>
            <td>
                <span class="badge badge-${getPlanBadgeType(user.plan_id)}">
                    ${APP_CONFIG.PLAN_NAMES[user.plan_id] || 'Unknown'}
                </span>
            </td>
            <td>${user.credit_balance || 0}</td>
            <td>
                <span class="badge badge-${user.is_active ? 'success' : 'danger'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <span class="badge badge-${user.is_admin ? 'warning' : 'primary'}">
                    ${user.is_admin ? 'Admin' : 'User'}
                </span>
            </td>
            <td>
                <button class="btn btn-small btn-outline manage-user" data-user-id="${user.id}">
                    Manage
                </button>
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = usersHTML;
    
    // Setup manage buttons
    const manageButtons = tableBody.querySelectorAll('.manage-user');
    manageButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                showUserManagementModal(user);
            }
        });
    });
}

function getPlanBadgeType(planId) {
    switch (planId) {
        case 1: return 'primary';  // Free
        case 2: return 'success';  // Pro Monthly
        case 3: return 'warning';  // Pro 6-Month
        default: return 'danger';
    }
}

function updateQuickStats() {
    const totalUsers = document.getElementById('totalUsers');
    const activeUsers = document.getElementById('activeUsers');
    const proUsers = document.getElementById('proUsers');
    const adminUsers = document.getElementById('adminUsers');
    
    if (totalUsers) {
        totalUsers.textContent = allUsers.length;
    }
    
    if (activeUsers) {
        activeUsers.textContent = allUsers.filter(u => u.is_active).length;
    }
    
    if (proUsers) {
        proUsers.textContent = allUsers.filter(u => u.plan_id > 1).length;
    }
    
    if (adminUsers) {
        adminUsers.textContent = allUsers.filter(u => u.is_admin).length;
    }
}

function setupAdminEvents() {
    // User search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', utils.debounce((e) => {
            filterUsers(e.target.value);
        }, 300));
    }
    
    // Refresh users
    const refreshUsers = document.getElementById('refreshUsers');
    if (refreshUsers) {
        refreshUsers.addEventListener('click', async () => {
            refreshUsers.disabled = true;
            refreshUsers.textContent = 'Refreshing...';
            
            await loadAdminData();
            
            refreshUsers.disabled = false;
            refreshUsers.textContent = 'Refresh';
        });
    }
    
    // Setup user management modal
    setupUserManagementModal();
}

function filterUsers(searchTerm) {
    if (!searchTerm.trim()) {
        filteredUsers = [...allUsers];
    } else {
        const term = searchTerm.toLowerCase();
        filteredUsers = allUsers.filter(user => 
            user.email.toLowerCase().includes(term) ||
            (user.username && user.username.toLowerCase().includes(term)) ||
            user.id.toString().includes(term)
        );
    }
    
    updateUsersTable();
}

function showUserManagementModal(user) {
    currentEditingUser = user;
    
    const modal = document.getElementById('userModal');
    const modalTitle = document.getElementById('modalTitle');
    const userDetails = document.getElementById('userDetails');
    const newCredits = document.getElementById('newCredits');
    const newPlan = document.getElementById('newPlan');
    
    if (modalTitle) {
        modalTitle.textContent = `Manage User: ${user.email}`;
    }
    
    if (userDetails) {
        userDetails.innerHTML = `
            <div class="user-info-grid">
                <div class="info-item">
                    <span class="info-label">ID:</span>
                    <span class="info-value">${user.id}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${utils.escapeHTML(user.email)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Username:</span>
                    <span class="info-value">${utils.escapeHTML(user.username || '-')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Current Plan:</span>
                    <span class="info-value">${APP_CONFIG.PLAN_NAMES[user.plan_id] || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Credits:</span>
                    <span class="info-value">${user.credit_balance || 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status:</span>
                    <span class="info-value badge badge-${user.is_active ? 'success' : 'danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label">Role:</span>
                    <span class="info-value badge badge-${user.is_admin ? 'warning' : 'primary'}">
                        ${user.is_admin ? 'Admin' : 'User'}
                    </span>
                </div>
            </div>
        `;
    }
    
    if (newCredits) {
        newCredits.value = user.credit_balance || 0;
    }
    
    if (newPlan) {
        newPlan.value = user.plan_id || 1;
    }
    
    modal.classList.remove('hidden');
}

function setupUserManagementModal() {
    const modal = document.getElementById('userModal');
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    
    // Close modal events
    [overlay, closeBtn].forEach(el => {
        if (el) {
            el.addEventListener('click', () => {
                modal.classList.add('hidden');
                currentEditingUser = null;
            });
        }
    });
    
    // Management action buttons
    const updateCreditsBtn = document.getElementById('updateCreditsBtn');
    const updatePlanBtn = document.getElementById('updatePlanBtn');
    const toggleActiveBtn = document.getElementById('toggleActiveBtn');
    const toggleAdminBtn = document.getElementById('toggleAdminBtn');
    const forceLogoutBtn = document.getElementById('forceLogoutBtn');
    
    if (updateCreditsBtn) {
        updateCreditsBtn.addEventListener('click', handleUpdateCredits);
    }
    
    if (updatePlanBtn) {
        updatePlanBtn.addEventListener('click', handleUpdatePlan);
    }
    
    if (toggleActiveBtn) {
        toggleActiveBtn.addEventListener('click', handleToggleActive);
    }
    
    if (toggleAdminBtn) {
        toggleAdminBtn.addEventListener('click', handleToggleAdmin);
    }
    
    if (forceLogoutBtn) {
        forceLogoutBtn.addEventListener('click', handleForceLogout);
    }
}

async function handleUpdateCredits() {
    if (!currentEditingUser) return;
    
    const newCredits = document.getElementById('newCredits');
    const credits = parseInt(newCredits.value);
    
    if (isNaN(credits) || credits < 0) {
        toast.error('Please enter a valid credit amount');
        return;
    }
    
    try {
        await apiHelpers.updateUserCredits(currentEditingUser.id, credits);
        
        // Update local data
        currentEditingUser.credit_balance = credits;
        const userIndex = allUsers.findIndex(u => u.id === currentEditingUser.id);
        if (userIndex !== -1) {
            allUsers[userIndex].credit_balance = credits;
        }
        
        // Update displays
        updateUsersTable();
        showUserManagementModal(currentEditingUser); // Refresh modal
        
        toast.success(`Updated credits for ${currentEditingUser.email}`);
        
    } catch (error) {
        console.error('Failed to update credits:', error);
        toast.error('Failed to update credits');
    }
}

async function handleUpdatePlan() {
    if (!currentEditingUser) return;
    
    const newPlan = document.getElementById('newPlan');
    const planId = parseInt(newPlan.value);
    
    try {
        await apiHelpers.updateUserPlan(currentEditingUser.id, planId);
        
        // Update local data
        currentEditingUser.plan_id = planId;
        const userIndex = allUsers.findIndex(u => u.id === currentEditingUser.id);
        if (userIndex !== -1) {
            allUsers[userIndex].plan_id = planId;
        }
        
        // Update displays
        updateUsersTable();
        showUserManagementModal(currentEditingUser); // Refresh modal
        
        toast.success(`Updated plan for ${currentEditingUser.email}`);
        
    } catch (error) {
        console.error('Failed to update plan:', error);
        toast.error('Failed to update plan');
    }
}

async function handleToggleActive() {
    if (!currentEditingUser) return;
    
    const newStatus = !currentEditingUser.is_active;
    
    try {
        await apiHelpers.updateUserStatus(currentEditingUser.id, newStatus);
        
        // Update local data
        currentEditingUser.is_active = newStatus;
        const userIndex = allUsers.findIndex(u => u.id === currentEditingUser.id);
        if (userIndex !== -1) {
            allUsers[userIndex].is_active = newStatus;
        }
        
        // Update displays
        updateUsersTable();
        showUserManagementModal(currentEditingUser); // Refresh modal
        
        toast.success(`${newStatus ? 'Activated' : 'Deactivated'} ${currentEditingUser.email}`);
        
    } catch (error) {
        console.error('Failed to update status:', error);
        toast.error('Failed to update user status');
    }
}

async function handleToggleAdmin() {
    if (!currentEditingUser) return;
    
    const newAdminStatus = !currentEditingUser.is_admin;
    
    // Prevent removing admin from self
    const currentUser = await auth.getCurrentUser();
    if (currentUser.id === currentEditingUser.id && !newAdminStatus) {
        toast.error('You cannot remove admin privileges from yourself');
        return;
    }
    
    try {
        await apiHelpers.updateUserRole(currentEditingUser.id, newAdminStatus);
        
        // Update local data
        currentEditingUser.is_admin = newAdminStatus;
        const userIndex = allUsers.findIndex(u => u.id === currentEditingUser.id);
        if (userIndex !== -1) {
            allUsers[userIndex].is_admin = newAdminStatus;
        }
        
        // Update displays
        updateUsersTable();
        updateQuickStats();
        showUserManagementModal(currentEditingUser); // Refresh modal
        
        toast.success(`${newAdminStatus ? 'Granted admin' : 'Removed admin'} for ${currentEditingUser.email}`);
        
    } catch (error) {
        console.error('Failed to update admin status:', error);
        toast.error('Failed to update admin status');
    }
}

async function handleForceLogout() {
    if (!currentEditingUser) return;
    
    const confirmed = await modal.confirm(
        'Force Logout',
        `Are you sure you want to force logout ${currentEditingUser.email} from all devices?`
    );
    
    if (!confirmed) return;
    
    try {
        await apiHelpers.forceLogoutUser(currentEditingUser.id);
        toast.success(`Forced logout for ${currentEditingUser.email}`);
        
    } catch (error) {
        console.error('Failed to force logout:', error);
        toast.error('Failed to force logout user');
    }
}

// Auto-refresh admin data every 30 seconds
setInterval(async () => {
    try {
        await loadAdminData();
        await checkSystemHealth();
    } catch (error) {
        console.error('Failed to refresh admin data:', error);
    }
}, 30000);
