(function() {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved) {
    root.setAttribute('data-theme', saved);
  }
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const curr = root.getAttribute('data-theme');
      const next = curr === 'dark' ? 'light' : (curr === 'light' ? null : 'dark');
      if (next) {
        root.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      } else {
        root.removeAttribute('data-theme');
        localStorage.removeItem('theme');
      }
    });
  }
})();
