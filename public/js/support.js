(async function() {
  // Attach logout button behavior if present; ignore if not logged in
  try { attachLogout(); } catch (_) {}

  // Try to load user to prefill name if available, but don't block page
  let me = null;
  try {
    const logged = await ensureLoggedIn();
    if (logged) me = window.__ME__ || null;
  } catch (_) {}

  const nameEl = document.getElementById('s-name');
  const subEl = document.getElementById('s-subject');
  const msgEl = document.getElementById('s-message');
  const sendBtn = document.getElementById('s-send');
  const statusEl = document.getElementById('s-status');

  // Prefill name if we know the user
  if (me && me.username) {
    nameEl.value = me.username;
  } else if (me && me.email) {
    nameEl.value = me.email.split('@')[0];
  }

  function setStatus(text, kind = 'info') {
    statusEl.textContent = text;
    statusEl.style.color = kind === 'error' ? '#ef4444' : (kind === 'success' ? '#10b981' : '#6b7280');
  }

  function validate() {
    const name = (nameEl.value || '').trim();
    const subject = (subEl.value || '').trim();
    const message = (msgEl.value || '').trim();

    if (!name) { setStatus('Please enter your name.', 'error'); return null; }
    if (!subject) { setStatus('Please enter a subject.', 'error'); return null; }
    if (!message || message.length < 10) { setStatus('Message should be at least 10 characters.', 'error'); return null; }

    return { name, subject, message };
  }

  async function sendTicket(payload) {
    // Backend endpoint you will implement to forward email to support without exposing the address
    // Suggested FastAPI route: POST /support/ticket
    // Body: { name, subject, message }
    // It should send an email to jothyanandan123@gmail.com with subject "Support Ticket: <subject>"
    // and include name/message in the body.
    const res = await fetch(`${API_BASE}/support/ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `Request failed with ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  sendBtn.addEventListener('click', async () => {
    const data = validate();
    if (!data) return;

    sendBtn.disabled = true;
    setStatus('Sending...', 'info');
    try {
      await sendTicket(data);
      setStatus('Ticket sent successfully. We will get back to you via email.', 'success');
      // Optional: clear the form
      // subEl.value = '';
      // msgEl.value = '';
    } catch (err) {
      console.error(err);
      setStatus('Failed to send ticket. Please try again later.', 'error');
    } finally {
      sendBtn.disabled = false;
    }
  });
})();
