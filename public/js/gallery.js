(async function() {
  attachLogout();
  const ok = await ensureLoggedIn();
  if (!ok) { location.href = '/static/login.html'; return; }

  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');

  async function run() {
    const items = await apiGet('/images');
    const {from, to} = readDateRange();
    const filtered = items.filter(x => matchesRange(x.created_at, from, to));
    grid.innerHTML = '';
    if (!filtered.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    for (const img of filtered) {
      const el = document.createElement('div');
      el.className = 'thumb';
      el.innerHTML = `
        <img src="${img.secure_url}" alt="${img.title || ''}">
        <div class="meta">
          <div>
            <div>${img.title || 'Untitled'}</div>
            <div class="small">${img.transformation_type || 'original'} · ${fmtDate(img.created_at)}</div>
          </div>
          <div class="actions">
            <button class="btn ghost" data-action="restore" data-id="${img.id}">Restore</button>
            <button class="btn ghost" data-action="remove_bg" data-id="${img.id}">Remove BG</button>
            <button class="btn ghost" data-action="remove_obj" data-id="${img.id}">Remove Obj</button>
            <button class="btn ghost" data-action="enhance" data-id="${img.id}">Enhance</button>
            <button class="btn ghost" data-action="genfill" data-id="${img.id}">Gen Fill</button>
            <button class="btn ghost" data-action="replace_bg" data-id="${img.id}">Replace BG</button>
            <button class="btn danger" data-action="delete" data-id="${img.id}">Delete</button>
          </div>
        </div>
      `;
      grid.appendChild(el);
    }
  }

  document.getElementById('apply-range').addEventListener('click', run);

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    try {
      if (action === 'restore') {
        await apiPost(`/images/${id}/restore`, {});
      } else if (action === 'remove_bg') {
        await apiPost(`/images/${id}/remove_bg`, {});
      } else if (action === 'remove_obj') {
        await apiPost(`/images/${id}/remove_obj`, {});
      } else if (action === 'enhance') {
        await apiPost(`/images/${id}/image_enhancer`, {});
      } else if (action === 'genfill') {
        const prompt = promptDialog('Enter generative fill prompt');
        if (!prompt) return;
        await apiPost(`/images/${id}/generative_fill?prompt=${encodeURIComponent(prompt)}`, {});
      } else if (action === 'replace_bg') {
        const prompt = promptDialog('Describe new background');
        if (!prompt) return;
        await apiPost(`/images/${id}/replace_background?prompt=${encodeURIComponent(prompt)}`, {});
      } else if (action === 'delete') {
        if (!confirm('Delete image?')) return;
        await apiDelete(`/images/${id}`);
      }
      await run();
      alert('Done.');
    } catch (err) {
      console.error(err);
      alert('Operation failed: ' + (err.message || err));
    }
  });

  function promptDialog(text) {
    const v = window.prompt(text, '');
    if (v && v.trim().length > 0) return v.trim();
    return null;
  }

  await run();
})();
