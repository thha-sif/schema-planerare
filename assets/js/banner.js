document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "schema-banner-settings-v1";
  const FALLBACK_PRIMARY_COLOR = "#8c8480";
  const DEFAULT_SETTINGS = {
    clubName: "Klubbnamn",
    clubLogoDataUrl: "",
    primaryColor: FALLBACK_PRIMARY_COLOR
  };

  function normalizePrimaryColor(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return DEFAULT_SETTINGS.primaryColor;
    return CSS.supports("color", raw) ? raw : DEFAULT_SETTINGS.primaryColor;
  }

  function sanitizeSettings(input) {
    const next = input && typeof input === "object" ? input : {};
    const clubName = typeof next.clubName === "string" ? next.clubName.trim() : "";
    const clubLogoDataUrl = typeof next.clubLogoDataUrl === "string" ? next.clubLogoDataUrl.trim() : "";
    const primaryColor = normalizePrimaryColor(next.primaryColor);

    return {
      clubName: clubName || DEFAULT_SETTINGS.clubName,
      clubLogoDataUrl,
      primaryColor
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return sanitizeSettings(raw ? JSON.parse(raw) : null);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(nextSettings) {
    const normalized = sanitizeSettings({
      ...loadSettings(),
      ...(nextSettings && typeof nextSettings === "object" ? nextSettings : {})
    });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    renderBanner(normalized);
    return normalized;
  }

  function clearSettings() {
    localStorage.removeItem(SETTINGS_KEY);
    renderBanner({ ...DEFAULT_SETTINGS });
  }

  function makeFallbackLabel(clubName) {
    const words = (clubName || DEFAULT_SETTINGS.clubName)
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (!words.length) return "LOGO";
    return words.map((part) => part.charAt(0)).join("");
  }

  function getMenuLinks(pageKey, isPagesSection) {
    const rootIndex = isPagesSection ? "../index.html" : "index.html";
    const matchesPage = isPagesSection ? "matches.html" : "pages/matches.html";
    const cupPage = isPagesSection ? "cup.html" : "pages/cup.html";
    const settingsPage = isPagesSection ? "settings.html" : "pages/settings.html";

    const allLinks = [
      { key: "training", href: rootIndex, label: "Träningsschema" },
      { key: "matches", href: matchesPage, label: "Matchschema" },
      { key: "cup", href: cupPage, label: "Spelschema Cup" },
      { key: "settings", href: settingsPage, label: "Inställningar", dividerBefore: true }
    ];

    return allLinks.map((item) => ({
      ...item,
      isCurrent: item.key === pageKey
    }));
  }

  function buildBannerMarkup(scheduleType, pageKey) {
    const pathName = (window.location && window.location.pathname ? window.location.pathname : "").toLowerCase();
    const isPagesSection = pathName.includes("/pages/") || /\\pages\\/.test(pathName);
    const menuLinks = getMenuLinks(pageKey, isPagesSection)
      .map((item) => {
        const divider = item.dividerBefore ? '<div class="app-banner__menu-divider" role="separator"></div>' : "";
        if (item.isCurrent) {
          return `${divider}<span class="app-banner__menu-item is-current" aria-current="page">${item.label}</span>`;
        }
        return `${divider}<a href="${item.href}">${item.label}</a>`;
      })
      .join("");

    return `
      <header class="app-banner no-export" data-schedule-banner data-schedule-type="${scheduleType}">
        <div class="app-banner__identity">
          <div class="app-banner__logo-shell">
            <img class="app-banner__logo" data-club-logo alt="Klubblogotyp">
            <span class="app-banner__logo-fallback" data-club-logo-fallback aria-hidden="true"></span>
          </div>
          <div class="app-banner__details">
            <strong class="app-banner__type" data-schedule-type-label>${scheduleType}</strong>
            <span class="app-banner__club" data-club-name>Klubbnamn</span>
          </div>
        </div>
        <div class="app-banner__menu">
          <button class="app-banner__menu-toggle" type="button" aria-expanded="false" aria-controls="bannerMenuPanel" data-banner-menu-toggle>
            <span class="app-banner__menu-label">Meny</span>
            <span class="app-banner__menu-icon" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
          <nav class="app-banner__menu-panel" id="bannerMenuPanel" data-banner-menu-panel hidden>
            ${menuLinks}
          </nav>
        </div>
      </header>
    `;
  }

  function mountBanner() {
    const mount = document.querySelector("[data-banner-root]");
    if (!mount) return;

    const scheduleType = mount.dataset.scheduleType || "Schema";
    const pageKey = mount.dataset.pageKey || "training";
    mount.outerHTML = buildBannerMarkup(scheduleType, pageKey);
  }

  function renderBanner(settings) {
    const banner = document.querySelector("[data-schedule-banner]");
    if (!banner) return;

    const typeLabel = banner.querySelector("[data-schedule-type-label]");
    const clubNameEl = banner.querySelector("[data-club-name]");
    const logoShellEl = banner.querySelector(".app-banner__logo-shell");
    const logoEl = banner.querySelector("[data-club-logo]");
    const logoFallbackEl = banner.querySelector("[data-club-logo-fallback]");
    const scheduleType = banner.dataset.scheduleType || "Schema";
    const hasLogo = Boolean(settings.clubLogoDataUrl);
    banner.style.setProperty("--club-primary", normalizePrimaryColor(settings.primaryColor));

    if (typeLabel) typeLabel.textContent = scheduleType;
    if (clubNameEl) clubNameEl.textContent = settings.clubName;

    if (logoShellEl) {
      logoShellEl.classList.toggle("has-logo", hasLogo);
    }

    if (logoFallbackEl) {
      logoFallbackEl.textContent = makeFallbackLabel(settings.clubName);
      logoFallbackEl.hidden = hasLogo;
    }

    if (logoEl) {
      if (hasLogo) {
        logoEl.src = settings.clubLogoDataUrl;
        logoEl.classList.add("is-visible");
        logoEl.hidden = false;
      } else {
        logoEl.removeAttribute("src");
        logoEl.classList.remove("is-visible");
        logoEl.hidden = true;
      }
    }
  }

  function initBannerMenu() {
    const banner = document.querySelector("[data-schedule-banner]");
    if (!banner) return;

    const toggleBtn = banner.querySelector("[data-banner-menu-toggle]");
    const panel = banner.querySelector("[data-banner-menu-panel]");
    if (!toggleBtn || !panel) return;

    function setOpenState(isOpen) {
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      panel.hidden = !isOpen;
    }

    setOpenState(false);

    toggleBtn.addEventListener("click", () => {
      const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
      setOpenState(!isOpen);
    });

    panel.querySelectorAll("a").forEach((linkEl) => {
      linkEl.addEventListener("click", () => setOpenState(false));
    });

    document.addEventListener("click", (event) => {
      if (!banner.contains(event.target)) {
        setOpenState(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setOpenState(false);
      }
    });
  }

  mountBanner();

  const settings = loadSettings();
  renderBanner(settings);
  initBannerMenu();

  window.scheduleBannerSettings = {
    key: SETTINGS_KEY,
    defaults: { ...DEFAULT_SETTINGS },
    get() {
      return loadSettings();
    },
    set(nextSettings) {
      return saveSettings(nextSettings);
    },
    clear() {
      clearSettings();
    }
  };
});