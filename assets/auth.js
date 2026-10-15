(function () {
  const KEY = "mydisiplin_auth_state";
  // Single Apps Script endpoint for the whole app.
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbxEt9OP-SO8k6VquhFT0wrRRWM26-ohEk9hzdiR68EAG4FjmnmqM1mUfHqzjkByEOu7/exec";

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

  function clearState() {
    try { localStorage.removeItem(KEY); } catch {}
  }

  function isLoginPage() {
    return location.pathname.endsWith("login.html");
  }

  // The session is issued and verified by the server; this only decides whether to show the login page.
  function isAuthenticated() {
    const state = readState();
    return !!(state && state.session && state.expiresAt && Date.now() < state.expiresAt);
  }

  function currentUser() {
    const state = readState();
    return state && isAuthenticated() ? { username: state.username, nama: state.nama } : null;
  }

  function saveSession(result) {
    writeState({
      authenticated: true,
      session: result.session,
      username: result.username,
      nama: result.nama,
      expiresAt: Date.now() + Math.max(60, (result.expiresIn || 21600) - 60) * 1000
    });
  }

  function goToLogin() {
    if (!isLoginPage()) location.replace("login.html");
  }

  async function call(action, data) {
    const state = readState() || {};
    const body = Object.assign({}, data, { action: action, session: state.session });
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error("Tiada sambungan ke pelayan. Cuba semula.");
    }
    if (!response.ok) throw new Error("Pelayan tidak dapat dihubungi (HTTP " + response.status + ").");

    let json;
    try {
      json = await response.json();
    } catch {
      throw new Error("Respons pelayan tidak sah.");
    }
    if (!json.ok) {
      if (json.code === "SESSION") {
        clearState();
        goToLogin();
      }
      const error = new Error(json.error || "Ralat pelayan.");
      error.code = json.code || "";
      throw error;
    }
    return json;
  }

  // Same shape as the old gviz result so page code keeps working: { headers, rows: [{ c: [{ v }] }] }.
  async function sheetTable(tab) {
    const result = await call("sheet_table", { tab: tab });
    return {
      headers: result.headers || [],
      rows: (result.rows || []).map(function (cells) {
        return { c: cells.map(function (value) { return { v: value === "" ? null : value }; }) };
      })
    };
  }

  function signOut() {
    const state = readState();
    if (state && state.session) {
      try {
        fetch(ENDPOINT, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "logout", session: state.session })
        }).catch(function () {});
      } catch {}
    }
    clearState();
    if (!isLoginPage()) location.href = "login.html";
  }

  function requireAuth() {
    if (!isAuthenticated() && !isLoginPage()) {
      clearState();
      location.replace("login.html");
    }
  }

  function initLoginPage() {
    if (isAuthenticated()) {
      location.replace("index.html");
      return;
    }

    const $ = function (id) { return document.getElementById(id); };
    const statusEl = $("login-status");
    const loginForm = $("login-form");
    const registerForm = $("register-form");
    const tabLogin = $("tab-login");
    const tabRegister = $("tab-register");

    function setStatus(message, isError) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.dataset.state = isError ? "error" : "info";
    }

    function showTab(name) {
      const isLogin = name === "login";
      loginForm.hidden = !isLogin;
      registerForm.hidden = isLogin;
      tabLogin.setAttribute("aria-selected", String(isLogin));
      tabRegister.setAttribute("aria-selected", String(!isLogin));
      setStatus(isLogin ? "Masukkan username dan kata laluan." : "Daftar akaun guru. Kod pendaftaran diberi oleh pentadbir sekolah.", false);
    }

    async function submit(form, action, fields, busyText) {
      const button = form.querySelector("button[type=submit]");
      const data = {};
      fields.forEach(function (name) { data[name] = form.elements[name].value; });
      button.disabled = true;
      setStatus(busyText, false);
      try {
        const result = await call(action, data);
        saveSession(result);
        setStatus("Berjaya. Mengalihkan ke halaman utama...", false);
        location.href = "index.html";
      } catch (error) {
        setStatus(error.message, true);
        button.disabled = false;
      }
    }

    tabLogin.addEventListener("click", function () { showTab("login"); });
    tabRegister.addEventListener("click", function () { showTab("register"); });
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submit(loginForm, "login", ["username", "password"], "Menyemak akaun...");
    });
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const password = registerForm.elements.password.value;
      if (password !== registerForm.elements.password2.value) {
        setStatus("Kata laluan dan pengesahan tidak sama.", true);
        return;
      }
      submit(registerForm, "register", ["nama", "username", "password", "kodDaftar"], "Mendaftar akaun...");
    });

    showTab("login");
  }

  window.myDisiplinAuth = {
    requireAuth: requireAuth,
    initLoginPage: initLoginPage,
    signOut: signOut,
    isAuthenticated: isAuthenticated,
    currentUser: currentUser,
    call: call,
    sheetTable: sheetTable,
    endpoint: ENDPOINT
  };
})();
