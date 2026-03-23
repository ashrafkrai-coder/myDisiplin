(function () {
  const KEY = "mydisiplin_auth_state";
  // Default shared password hash (SHA-256 for: BEA8613).
  const PASSWORD_HASH = "d72847a42d401b7509a7878ea51ee524f40644c06a84fe1f4ad679c298100f8d";

  async function sha256Hex(value) {
    if (!window.crypto || !window.crypto.subtle) return "";
    const encoded = new TextEncoder().encode(String(value || ""));
    const buffer = await window.crypto.subtle.digest("SHA-256", encoded);
    const bytes = Array.from(new Uint8Array(buffer));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function verifyPassword(password) {
    const hash = await sha256Hex(password);
    return hash === PASSWORD_HASH;
  }

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
    const passwordEl = document.getElementById("shared-password");
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
      statusEl.textContent = "Sedia. Masukkan kata laluan, kemudian pilih daftar atau login.";
    }

    async function handleAuth(provider, successMessage) {
      if (!passwordEl) return;
      const password = String(passwordEl.value || "").trim();
      if (!password) {
        if (statusEl) statusEl.textContent = "Masukkan kata laluan dahulu.";
        passwordEl.focus();
        return;
      }

      const ok = await verifyPassword(password);
      if (!ok) {
        if (statusEl) statusEl.textContent = "Kata laluan tidak sah. Sila cuba lagi.";
        passwordEl.focus();
        passwordEl.select();
        return;
      }

      signIn(provider);
      if (statusEl) statusEl.textContent = successMessage;
      setTimeout(function () {
        location.href = "index.html";
      }, 300);
    }

    if (signupBtn) {
      signupBtn.addEventListener("click", function () {
        handleAuth("google-signup", "Daftar berjaya. Mengalihkan ke halaman utama...");
      });
    }

    if (signinBtn) {
      signinBtn.addEventListener("click", function () {
        handleAuth("google-signin", "Login berjaya. Mengalihkan ke halaman utama...");
      });
    }

    if (passwordEl) {
      passwordEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          handleAuth("google-signin", "Login berjaya. Mengalihkan ke halaman utama...");
        }
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
