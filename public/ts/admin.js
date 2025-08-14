// admin.js
window.addEventListener('DOMContentLoaded', async () => {
  ensureLoggedIn();
  await loadUsers();
});

async function loadUsers(){
  try{
    const data = await apiGet('/users?limit=100&offset=0');
    const tbody = el('#users-tbody');
    tbody.innerHTML = data.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.email || u.username || ''}</td>
        <td>${u.is_admin ? '<span class="badge">admin</span>' : 'user'}</td>
        <td>${u.is_active ? 'active' : 'inactive'}</td>
        <td>${u.credit_balance ?? 0}</td>
        <td class="row">
          <button class="btn" data-uid="${u.id}" data-action="toggle-admin">${u.is_admin?'Demote':'Promote'}</button>
          <button class="btn" data-uid="${u.id}" data-action="toggle-status">${u.is_active?'Deactivate':'Activate'}</button>
          <input class="input" style="max-width:100px" placeholder="Set credits" data-credits="${u.id}"/>
          <button class="btn" data-uid="${u.id}" data-action="set-credits">Apply</button>
        </td>
      </tr>
    `).join('');
    els('button[data-action]').forEach(b => b.addEventListener('click', onAdminAction));
  }catch(e){
    console.error(e); toast('Failed to load users');
  }
}

async function onAdminAction(ev){
  const btn = ev.currentTarget;
  const id = btn.dataset.uid;
  const action = btn.dataset.action;
  try{
    if (action === 'toggle-admin'){
      const make_admin = btn.textContent.includes('Promote');
      await apiPost(`/admin/users/${id}/role`, { make_admin });
    } else if (action === 'toggle-status'){
      const is_active = btn.textContent.includes('Activate');
      await apiPost(`/admin/users/${id}/status`, { is_active });
    } else if (action === 'set-credits'){
      const val = Number(el(`[data-credits="${id}"]`)?.value || '0');
      await apiPost(`/admin/users/${id}/credits`, { credits: val });
    }
    toast('Updated');
    await loadUsers();
  }catch(e){ console.error(e); toast('Update failed'); }
}