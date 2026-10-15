/* Light / dark mode. Follows the device setting until the user picks one; the choice is remembered. */
(function () {
  var KEY = "mydisiplin_theme";
  var root = document.documentElement;
  var button = null;

  function saved() {
    try {
      var value = localStorage.getItem(KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (e) {
      return null;
    }
  }

  function systemDark() {
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function effective() {
    return saved() || (systemDark() ? "dark" : "light");
  }

  function paint() {
    var theme = effective();
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b0b0f" : "#0f766e");
    if (button) {
      var toDark = theme !== "dark";
      button.textContent = toDark ? "🌙" : "☀️";
      button.setAttribute("aria-label", toDark ? "Tukar ke mod gelap" : "Tukar ke mod cerah");
      button.title = toDark ? "Mod gelap" : "Mod cerah";
    }
  }

  // Apply before first paint to avoid a white flash.
  paint();

  function mount() {
    if (button || !document.body) return;
    button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint();
    });
    document.body.appendChild(button);
    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  if (window.matchMedia) {
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () { if (!saved()) paint(); };
    if (query.addEventListener) query.addEventListener("change", onChange);
    else if (query.addListener) query.addListener(onChange);
  }
})();
