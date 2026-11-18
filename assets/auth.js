(function () {
  const KEY = "mydisiplin_auth_state";
  // Single Apps Script endpoint for the whole app.
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbyxYslWAf_kAZpUumGyX9PuQ3shroMkDwSrbRiinIhu_X3hn9fkldOSwb6lW-abdAbf/exec";
  // Roles. A plain "Guru" may only record cases; the server enforces this, the app just hides what it cannot use.
  const ROLES = ["Guru", "Guru Disiplin", "PK HEM", "Pengetua"];
  const STAFF_ROLES = ["Guru Disiplin", "PK HEM", "Pengetua"];
  // A Guru may open only these pages; every other page is for Guru Disiplin, PK HEM and Pengetua.
  const GURU_PAGES = ["rekod-kes-baru.html", "login.html", "offline.html"];
  const GURU_HOME = "rekod-kes-baru.html";
  const ROLE_CHECK_MS = 5 * 60 * 1000;

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
  // Sessions saved before roles existed have no role, so they sign in again once.
  function isAuthenticated() {
    const state = readState();
    return !!(state && state.session && state.peranan && state.expiresAt && Date.now() < state.expiresAt);
  }

  function currentUser() {
    const state = readState();
    return state && isAuthenticated() ? { username: state.username, nama: state.nama, peranan: state.peranan } : null;
  }

  function isStaff() {
    const user = currentUser();
    return !!(user && STAFF_ROLES.includes(user.peranan));
  }

  function saveSession(result) {
    writeState({
      authenticated: true,
      session: result.session,
      username: result.username,
      nama: result.nama,
      peranan: result.peranan || "Guru",
      roleCheckedAt: Date.now(),
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

  function currentPage() {
    return location.pathname.split("/").pop() || "index.html";
  }

  function canOpen(page) {
    page = String(page || "").split(/[?#]/)[0].replace(/^\.\//, "") || "index.html";
    return isStaff() || GURU_PAGES.includes(page);
  }

  // Home page for the signed-in role.
  function homePage() {
    return isStaff() ? "index.html" : GURU_HOME;
  }

  // Sends a plain Guru away from pages meant for Guru Disiplin, PK HEM and Pengetua.
  function guardPage() {
    if (!canOpen(currentPage())) {
      location.replace(GURU_HOME + "?akses=terhad");
      return false;
    }
    return true;
  }

  // Hides links to pages the current role cannot open; links to Home go to the role's own home.
  function hideStaffLinks() {
    if (isStaff()) return;
    document.querySelectorAll("a[href]").forEach(function (a) {
      const href = a.getAttribute("href");
      if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
      const page = href.split(/[?#]/)[0].replace(/^\.\//, "") || "index.html";
      if (page === "index.html") a.setAttribute("href", GURU_HOME);
      else if (!canOpen(page)) a.hidden = true;
    });
    document.querySelectorAll("[data-staff-only]").forEach(function (el) { el.hidden = true; });
  }

  // Picks up role changes made by the admin in the 'guru' tab (checked at most every 5 minutes).
  function refreshRole() {
    const state = readState();
    if (!state || !state.session || Date.now() - (state.roleCheckedAt || 0) < ROLE_CHECK_MS) return;
    call("whoami", {}).then(function (result) {
      const latest = readState();
      if (!latest || latest.session !== state.session) return;
      const changed = result.peranan && result.peranan !== latest.peranan;
      latest.peranan = result.peranan || latest.peranan;
      latest.nama = result.nama || latest.nama;
      latest.roleCheckedAt = Date.now();
      writeState(latest);
      if (changed) location.reload();
    }).catch(function () {});
  }

  function requireAuth() {
    if (isLoginPage()) return;
    if (!isAuthenticated()) {
      clearState();
      location.replace("login.html");
      return;
    }
    if (!guardPage()) return;
    // Lets theme.css hide the menu tabs this role cannot use before the page paints.
    document.documentElement.classList.toggle("akses-guru", !isStaff());
    document.documentElement.dataset.peranan = currentUser().peranan;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hideStaffLinks);
    else hideStaffLinks();
    refreshRole();
  }

  function initLoginPage() {
    if (isAuthenticated()) {
      location.replace(homePage());
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
      setStatus(isLogin ? "Pilih peranan, kemudian masukkan nama pengguna dan kata laluan." : "Pilih peranan anda, kemudian isi butiran akaun.", false);
    }

    // No registration code. A Guru can use the app at once; the other roles wait for an admin
    // to approve them (status 'aktif' in the 'guru' tab).
    const roleHint = $("reg-role-hint");
    const regButton = $("reg-submit");
    const ROLE_KEY = "mydisiplin_last_role";
    function selectedRole() {
      return registerForm.elements.peranan.value;
    }
    function updateRoleHint() {
      const role = selectedRole();
      const staff = STAFF_ROLES.includes(role);
      if (roleHint) {
        roleHint.textContent = !role
          ? "Guru: rekod kes sahaja. Guru Disiplin, PK HEM, Pengetua: akses penuh selepas diluluskan pentadbir."
          : staff
            ? role + ": akses penuh (rekod, senarai kes, dashbord, profil murid). Akaun boleh digunakan selepas diluluskan oleh pentadbir."
            : "Guru: boleh merekod kes disiplin sahaja. Akaun terus boleh digunakan.";
      }
      if (regButton) regButton.textContent = staff ? "Hantar Pendaftaran" : "Daftar & Log Masuk";
    }
    registerForm.elements.peranan.addEventListener("change", updateRoleHint);
    updateRoleHint();
    try {
      const lastRole = localStorage.getItem(ROLE_KEY);
      if (lastRole && ROLES.includes(lastRole)) loginForm.elements.peranan.value = lastRole;
    } catch {}

    async function submit(form, action, fields, busyText) {
      const button = form.querySelector("button[type=submit]");
      const data = {};
      fields.forEach(function (name) { data[name] = form.elements[name].value; });
      button.disabled = true;
      setStatus(busyText, false);
      try {
        const result = await call(action, data);
        if (result.pending) {
          // Senior role: no session yet. Show the message and leave the login form ready.
          form.reset();
          updateRoleHint();
          showTab("login");
          loginForm.elements.username.value = result.username || "";
          loginForm.elements.peranan.value = result.peranan || "";
          setStatus(result.message || "Pendaftaran diterima dan menunggu kelulusan pentadbir.", false);
          button.disabled = false;
          return;
        }
        saveSession(result);
        try { localStorage.setItem(ROLE_KEY, result.peranan || ""); } catch {}
        setStatus("Berjaya. Mengalihkan ke halaman utama...", false);
        location.href = homePage();
      } catch (error) {
        setStatus(error.message, true);
        button.disabled = false;
      }
    }

    tabLogin.addEventListener("click", function () { showTab("login"); });
    tabRegister.addEventListener("click", function () { showTab("register"); });
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!loginForm.elements.peranan.value) {
        setStatus("Sila pilih peranan anda.", true);
        return;
      }
      submit(loginForm, "login", ["peranan", "username", "password"], "Menyemak akaun...");
    });
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!selectedRole()) {
        setStatus("Sila pilih peranan anda.", true);
        return;
      }
      const password = registerForm.elements.password.value;
      if (password !== registerForm.elements.password2.value) {
        setStatus("Kata laluan dan pengesahan tidak sama.", true);
        return;
      }
      submit(registerForm, "register", ["peranan", "nama", "username", "password"], "Mendaftar akaun...");
    });

    showTab("login");
  }

  window.myDisiplinAuth = {
    requireAuth: requireAuth,
    initLoginPage: initLoginPage,
    signOut: signOut,
    isAuthenticated: isAuthenticated,
    currentUser: currentUser,
    isStaff: isStaff,
    homePage: homePage,
    hideStaffLinks: hideStaffLinks,
    roles: ROLES.slice(),
    staffRoles: STAFF_ROLES.slice(),
    call: call,
    sheetTable: sheetTable,
    endpoint: ENDPOINT
  };
})();
