/* Adds the myDisiplin brand header (logo + name) to every page except home and login. */
(function () {
  "use strict";
  function build() {
    if (document.querySelector(".hero-logo") || document.getElementById("login-form")) return;
    var main = document.querySelector("main");
    if (!main) return;
    var logo = document.createElement("img");
    logo.className = "hero-logo";
    logo.src = "icons/logo-sekolah.png";
    logo.alt = "Logo myDisiplin";
    var brand = document.createElement("span");
    brand.className = "hero-brand";
    brand.textContent = "myDisiplin";

    var hero = main.querySelector(".hero");
    if (hero) {
      var text = hero.querySelector(".hero-text");
      if (text) text.insertBefore(brand, text.firstChild);
      hero.appendChild(logo);
      return;
    }
    // Older pages: turn the page's own <h1> into the hero title.
    var h1 = main.querySelector("h1");
    hero = document.createElement("div");
    hero.className = "hero";
    var box = document.createElement("div");
    box.className = "hero-text";
    box.appendChild(brand);
    var title = document.createElement("h1");
    title.textContent = h1 ? h1.textContent : "";
    box.appendChild(title);
    hero.appendChild(box);
    hero.appendChild(logo);
    if (h1) h1.remove();
    main.insertBefore(hero, main.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
