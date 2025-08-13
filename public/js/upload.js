(async function() {
  attachLogout();
  const ok = await ensureLoggedIn();
  if (!ok) { location.href = '/static/login.html'; return; }

  const fileEl = document.getElementById('file');
  const titleEl = document.getElementById('title');
  const preview = document.getElementById('preview');
  const submit = document.getElementById('submit');
  let file;

  fileEl.addEventListener('change', () => {
    const f = fileEl.files?.[0];
    if (!f) { submit.disabled = true; return; }
    file = f;
    submit.disabled = false;
    const url = URL.createObjectURL(f);
    preview.innerHTML = `<img src="${url}" alt="preview">`;
  });

  submit.addEventListener('click', async () => {
    if (!file) return;
    submit.disabled = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const title = titleEl.value?.trim();
      if (title) fd.append('title', title);
      const data = await apiPost('/images', fd, false);
      alert('Uploaded!');
      location.href = '/static/gallery.html';
    } catch (e) {
      console.error(e);
      alert('Upload failed: ' + (e.message || e));
    } finally {
      submit.disabled = false;
    }
  });
})();
