(function () {
  const KEY = "mydisiplin_auth_state";
  function readState() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }
  function writeState(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function isAuthenticated() {
    const state = readState();
    return !!(state && state.authenticated);
  }
  function signIn(provider) {
    const now = new Date().toISOString();
    const existing = readState() || {};
    writeState({
      authenticated: true,
      provider: provider || existing.provider || "local",
      firstLoginAt: existing.firstLoginAt || now,
      lastLoginAt: now
    });
  }
  function signOut() {
    localStorage.removeItem(KEY);
    if (!location.pathname.endsWith("login.html")) {
      location.href = "login.html";
    }
  }
  function requireAuth() {
    const onLoginPage = location.pathname.endsWith("login.html");
    if (!isAuthenticated() && !onLoginPage) {
      location.replace("login.html");
    }
  }
  function initLoginPage() {
    const signupBtn = document.getElementById("signup-google-btn");
    const signinBtn = document.getElementById("signin-google-btn");
    const statusEl = document.getElementById("login-status");
    const firstUserEl = document.getElementById("first-user-info");
    const state = readState();
    if (firstUserEl) {
      if (state && state.firstLoginAt) {
        firstUserEl.textContent = "Pengguna pertama telah didaftarkan pada peranti ini.";
      } else {
        firstUserEl.textContent = "Belum ada pengguna didaftarkan pada peranti ini. Gunakan butang daftar dahulu.";
      }
    }
    if (statusEl) {
      statusEl.textContent = "Sedia. Pilih daftar atau login untuk teruskan.";
    }
    if (signupBtn) {
      signupBtn.addEventListener("click", function () {
        signIn("google-signup");
        if (statusEl) statusEl.textContent = "Daftar berjaya. Mengalihkan ke halaman utama...";
        setTimeout(function () { location.href = "index.html"; }, 300);
      });
    }
    if (signinBtn) {
      signinBtn.addEventListener("click", function () {
        signIn("google-signin");
        if (statusEl) statusEl.textContent = "Login berjaya. Mengalihkan ke halaman utama...";
        setTimeout(function () { location.href = "index.html"; }, 300);
      });
    }
  }
  window.myDisiplinAuth = {
    requireAuth: requireAuth,
    initLoginPage: initLoginPage,
    signOut: signOut,
    isAuthenticated: isAuthenticated
  };
})();
