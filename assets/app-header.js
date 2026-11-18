/* Shared myDisiplin header: adds the school tagline to every page, and the brand line + logo
   to every page except home (which has its own) and login (which uses a card instead of a hero). */
(function () {
  "use strict";
  var TAGLINE = ["Disiplin Pertama", "Kurikulum Utama", "Kokurikulum Bitara"];
  var CREDIT = "Dibangunkan dan diuruskan oleh ustazashraf";
  var VERSION = "v1.0";

  // Small credit line at the bottom of every page.
  function addCredit() {
    if (document.querySelector(".app-credit")) return;
    var footer = document.createElement("footer");
    footer.className = "app-credit";
    footer.appendChild(document.createTextNode(CREDIT + " "));
    var version = document.createElement("span");
    version.className = "app-credit-version";
    version.textContent = VERSION;
    footer.appendChild(version);
    var host = document.querySelector("main") || document.body;
    host.appendChild(footer);
  }

  // Each phrase is kept whole, so on narrow screens the line breaks between phrases, never inside one.
  function tagline() {
    var el = document.createElement("p");
    el.className = "hero-tagline";
    TAGLINE.forEach(function (phrase, i) {
      var span = document.createElement("span");
      span.textContent = phrase;
      el.appendChild(span);
      if (i < TAGLINE.length - 1) {
        var dot = document.createElement("span");
        dot.className = "hero-tagline-dot";
        dot.textContent = "•";
        dot.setAttribute("aria-hidden", "true");
        el.appendChild(dot);
      }
    });
    return el;
  }

  // Signed-in name and role with a sign-out button, under the hero on every page.
  function addUserBar() {
    var auth = window.myDisiplinAuth;
    var user = auth && auth.currentUser && auth.currentUser();
    var main = document.querySelector("main");
    if (!user || !main || document.querySelector(".user-bar")) return;
    var bar = document.createElement("div");
    bar.className = "user-bar";
    var who = document.createElement("span");
    who.className = "user-bar-name";
    who.textContent = user.nama || user.username;
    var role = document.createElement("span");
    role.className = "user-bar-role";
    role.textContent = user.peranan;
    var out = document.createElement("button");
    out.type = "button";
    out.className = "user-bar-logout";
    out.textContent = "Log Keluar";
    out.addEventListener("click", function () { auth.signOut(); });
    bar.appendChild(who);
    bar.appendChild(role);
    bar.appendChild(out);
    var hero = main.querySelector(".hero");
    if (hero) hero.insertAdjacentElement("afterend", bar);
    else main.insertBefore(bar, main.firstChild);
  }

  function build() {
    addCredit();
    // Login card: tagline under the app name.
    var loginTitle = document.querySelector(".login-card .title");
    if (loginTitle) {
      if (!document.querySelector(".hero-tagline")) loginTitle.insertAdjacentElement("afterend", tagline());
      return;
    }

    var main = document.querySelector("main");
    if (!main) return;
    var hero = main.querySelector(".hero");

    // Home page already has its own logo and title; it only needs the tagline.
    if (!hero || !hero.querySelector(".hero-logo")) {
      var logo = document.createElement("a");
      logo.className = "hero-logo-link";
      logo.href = "index.html";
      logo.setAttribute("aria-label", "Ke halaman utama");
      var img = document.createElement("img");
      img.className = "hero-logo";
      img.src = "icons/logo-sekolah.png";
      img.alt = "Logo myDisiplin";
      logo.appendChild(img);
      var brand = document.createElement("span");
      brand.className = "hero-brand";
      brand.textContent = "myDisiplin";

      if (!hero) {
        // Older pages: turn the page's own <h1> into the hero title.
        var h1 = main.querySelector("h1");
        hero = document.createElement("div");
        hero.className = "hero";
        var box = document.createElement("div");
        box.className = "hero-text";
        var title = document.createElement("h1");
        title.textContent = h1 ? h1.textContent : "";
        box.appendChild(title);
        hero.appendChild(box);
        if (h1) h1.remove();
        main.insertBefore(hero, main.firstChild);
      }
      var text = hero.querySelector(".hero-text");
      if (text) text.insertBefore(brand, text.firstChild);
      hero.appendChild(logo);
    }

    // Full-width row under the title and logo.
    if (!hero.querySelector(".hero-tagline")) hero.appendChild(tagline());
    addUserBar();
    // The logo link was just added; point it at the role's own home page.
    if (window.myDisiplinAuth && window.myDisiplinAuth.hideStaffLinks) window.myDisiplinAuth.hideStaffLinks();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
