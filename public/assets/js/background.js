// /public/assets/js/background.js
(function () {
  const KEY = "troop248_bg";
  const DEFAULT_TAN = "#d2cab6";

  // Update paths to match your uploads
  const BG_MAP = {
    tan: "",
    bg1: "/assets/backgrounds/bg-image-1.webp",
    bg2: "/assets/backgrounds/bg-image-2.webp",
    bg3: "/assets/backgrounds/bg-image-3.webp"
  };

  function apply(choice) {
    const img = BG_MAP[choice] ?? "";
    if (!img) {
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = DEFAULT_TAN;
    } else {
      document.body.style.backgroundImage = `url('${img}')`;
      document.body.style.backgroundColor = DEFAULT_TAN;
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundAttachment = "fixed";
    }
  }

  function load() {
    const saved = localStorage.getItem(KEY) || "tan";
    apply(saved);

    // If the page has a dropdown, sync it + hook it up
    const sel = document.getElementById("bgSelect");
    if (sel) {
      sel.value = saved;
      sel.addEventListener("change", () => {
        const val = sel.value;
        localStorage.setItem(KEY, val);
        apply(val);
      });
    }
  }

  // Run as soon as DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
