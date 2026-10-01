/* ==========================================================
   S!aP — universal light/dark theme switch. Shared by index.html and
   mobile.html (both load styles.css, which defines the actual palettes
   under :root and :root[data-theme="light"] — see styles.css for why).
   Loaded first, inline in <head>, so the saved theme is applied to
   <html> before first paint (no dark-then-light flash on load).
   ========================================================== */
(function () {
  "use strict";
  const KEY = "siap.theme";

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }

  function paintToggles(theme) {
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
      btn.title = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
      const icon = btn.querySelector("[data-lucide]");
      if (icon) icon.setAttribute("data-lucide", theme === "light" ? "moon" : "sun");
    });
    if (window.lucide) lucide.createIcons();
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (document.body) paintToggles(theme);
  }

  function set(theme) {
    write(theme);
    apply(theme);
  }

  function toggle() { set(current() === "light" ? "dark" : "light"); }

  function current() { return document.documentElement.getAttribute("data-theme") || "dark"; }

  // Apply immediately (script runs synchronously in <head>, before the rest of the DOM/CSS
  // paints) so there's no flash of the wrong theme on load.
  apply(read() || "dark");

  document.addEventListener("DOMContentLoaded", () => {
    paintToggles(current());
    document.body.addEventListener("click", (e) => {
      if (e.target.closest(".theme-toggle")) toggle();
    });
  });

  window.SIAP_THEME = { current, set, toggle };
})();
