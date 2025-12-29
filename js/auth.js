// Authentication helper functions
function checkAuth() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (!token || !userId || !username) {
    return false;
  }
  
  return { userId, username, token };
}

function requireAuth() {
  const auth = checkAuth();
  if (!auth) {
    window.location.href = 'login.html';
    return null;
  }
  return auth;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

// Make functions available globally
window.checkAuth = checkAuth;
window.requireAuth = requireAuth;
window.logout = logout;
