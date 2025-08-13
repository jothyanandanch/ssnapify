async function ensureLoggedIn() {
  if (!getToken()) {
    const params = new URLSearchParams(location.search);
    if (params.has('token')) {
      const t = params.get('token');
      setToken(t);
      params.delete('token');
      history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }
  if (!getToken()) return false;

  try {
    const me = await apiGet('/users/me');
    window.ME = me;
    const meEl = document.getElementById('me-name');
    const balEl = document.getElementById('me-balance');
    if (meEl) meEl.textContent = me.username || me.email;
    if (balEl) balEl.textContent = me.credit_balance ?? '';
    return true;
  } catch (e) {
    console.warn('Auth failed, clearing token', e);
    clearToken();
    return false;
  }
}

function attachLogin() {
  const btn = document.getElementById('login-google');
  if (btn) btn.addEventListener('click', () => {
    location.href = GOOGLE_LOGIN_URL;
  });
}

function attachLogout() {
  const btn = document.getElementById('logout');
  if (btn) btn.addEventListener('click', () => {
    clearToken();
    location.href = '/static/login.html';
  });
}
