const API_BASE = 'http://localhost:8000';
const GOOGLE_LOGIN_URL = `${API_BASE}/auth/google/login`;

function getToken() {
  return localStorage.getItem('token') || '';
}

function setToken(tok) {
  localStorage.setItem('token', tok);
}

function clearToken() {
  localStorage.removeItem('token');
}
