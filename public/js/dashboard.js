(async function() {
  attachLogout();
  const ok = await ensureLoggedIn();
  if (!ok) { location.href = '/static/login.html'; return; }

  try {
    const info = await apiGet('/account/credits');
    document.getElementById('stat-credits').textContent = info.credit_balance ?? '—';
    document.getElementById('stat-days').textContent = info.days_until_next_reset ?? '—';
    document.getElementById('stat-next-reset').textContent = info.next_reset_time ? new Date(info.next_reset_time).toLocaleString() : '—';
    document.getElementById('stat-billing-end').textContent = info.billing_cycle_ends ? new Date(info.billing_cycle_ends).toLocaleDateString() : '—';
  } catch (e) {
    console.error(e);
  }

  const recentEl = document.getElementById('recent');
  const emptyEl = document.getElementById('empty-recent');

  async function loadRecent() {
    const data = await apiGet('/images');
    const {from, to} = readDateRange();
    const filtered = data.filter(x => matchesRange(x.created_at, from, to));
    recentEl.innerHTML = '';
    if (!filtered.length) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    for (const img of filtered.slice(0, 12)) {
      const card = document.createElement('div');
      card.className = 'thumb';
      card.innerHTML = `
        <img src="${img.secure_url}" alt="${img.title || ''}">
        <div class="meta">
          <div>
            <div>${img.title || 'Untitled'}</div>
            <div class="small">${img.transformation_type || 'original'} · ${fmtDate(img.created_at)}</div>
          </div>
          <div class="actions">
            <a class="btn ghost" href="/static/gallery.html">Open</a>
          </div>
        </div>
      `;
      recentEl.appendChild(card);
    }
  }

  document.getElementById('apply-range').addEventListener('click', loadRecent);
  await loadRecent();
})();
