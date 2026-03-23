(function () {
  const KEY = "mydisiplin_auth_state";
  const PASSWORD_PLAIN = "BEA8613";
  // Default shared access code hash (SHA-256 for: BEA8613).
  const PASSWORD_HASH = "d72847a42d401b7509a7878ea51ee524f40644c06a84fe1f4ad679c298100f8d";

  async function sha256Hex(value) {
    if (!window.crypto || !window.crypto.subtle) return "";
    const encoded = new TextEncoder().encode(String(value || ""));
    const buffer = await window.crypto.subtle.digest("SHA-256", encoded);
    const bytes = Array.from(new Uint8Array(buffer));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function verifyPassword(password) {
    const value = String(password || "").trim();
    if (!value) return false;

    // Fallback for non-secure contexts where crypto.subtle is unavailable.
    if (!window.crypto || !window.crypto.subtle) {
      return value === PASSWORD_PLAIN;
    }

    try {
      const hash = await sha256Hex(value);
      return hash === PASSWORD_HASH;
    } catch {
      return value === PASSWORD_PLAIN;
    }
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
    writeState({
      authenticated: true,
      provider: provider || "access-code",
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
    const signinBtn = document.getElementById("signin-btn");
    const passwordEl = document.getElementById("shared-password");
    const statusEl = document.getElementById("login-status");

    if (statusEl) {
      statusEl.textContent = "Sedia. Masukkan kod akses untuk login.";
    }

    async function handleAuth() {
      if (!passwordEl) return;
      const password = String(passwordEl.value || "").trim();
      if (!password) {
        if (statusEl) statusEl.textContent = "Masukkan kod akses dahulu.";
        passwordEl.focus();
        return;
      }

      const ok = await verifyPassword(password);
      if (!ok) {
        if (statusEl) statusEl.textContent = "Kod akses tidak sah. Sila cuba lagi.";
        passwordEl.focus();
        passwordEl.select();
        return;
      }

      signIn("access-code");
      if (statusEl) statusEl.textContent = "Login berjaya. Mengalihkan ke halaman utama...";
      setTimeout(function () {
        location.href = "index.html";
      }, 300);
    }

    if (signinBtn) {
      signinBtn.addEventListener("click", function () {
        handleAuth();
      });
    }

    if (passwordEl) {
      passwordEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          handleAuth();
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
