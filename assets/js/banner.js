document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "schema-banner-settings-v1";
  const FALLBACK_PRIMARY_COLOR = "#8c8480";
  const DEFAULT_SETTINGS = {
    clubName: "Klubbnamn",
    clubLogoDataUrl: "",
    primaryColor: FALLBACK_PRIMARY_COLOR
  };
  let toastTimer = 0;
  let searchRoot = null;
  let searchInput = null;
  let searchResults = null;
  let searchStatus = null;
  let searchTitle = null;
  let activeSearchAdapter = null;
  let activeSearchResults = [];
  let activeSearchIndex = -1;

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

  function getToolbarActions(pageKey) {
    if (pageKey === "settings") return [];

    const base = [
      { id: "search", icon: "search.svg", label: "Sök", kind: "utility" },
      { id: "undo", icon: "undo.svg", label: "Ångra", kind: "history" },
      { id: "redo", icon: "redo.svg", label: "Gör om", kind: "history" }
    ];

    if (pageKey === "training") {
      return [
        ...base,
        {
          id: "import-group",
          icon: "import.svg",
          label: "Importera",
          kind: "io",
          menu: [
            { id: "import-json", icon: "json-file.svg", label: "JSON" }
          ]
        },
        {
          id: "export-group",
          icon: "export.svg",
          label: "Exportera",
          kind: "io",
          menu: [
            { id: "export-json", icon: "json-file.svg", label: "JSON" }
          ]
        },
        {
          id: "export-media-group",
          icon: "image.svg",
          label: "Bild/PDF",
          kind: "io",
          menu: [
            { id: "export-pdf", icon: "pdf.svg", label: "PDF" },
            { id: "export-png-calendarA", icon: "image.svg", label: "PNG A-plan" },
            { id: "export-png-calendarB", icon: "image.svg", label: "PNG B-plan" },
            { id: "export-png-calendarS", icon: "image.svg", label: "PNG Skönvik" },
            { id: "export-png-calendarF", icon: "image.svg", label: "PNG Försäsong" },
            { id: "export-png-all", icon: "image.svg", label: "PNG Alla" }
          ]
        },
        {
          id: "copy-plan-group",
          icon: "copy.svg",
          label: "Kopiera schema",
          kind: "io",
          menu: [
            { id: "copy-calendarA", label: "A-plan" },
            { id: "copy-calendarB", label: "B-plan" },
            { id: "copy-calendarS", label: "Skönvik" },
            { id: "copy-calendarF", label: "Försäsong" }
          ]
        },
        {
          id: "reset-plan-group",
          icon: "reset.svg",
          label: "Återställ schema",
          kind: "io",
          menu: [
            { id: "reset-calendarA", label: "A-plan" },
            { id: "reset-calendarB", label: "B-plan" },
            { id: "reset-calendarS", label: "Skönvik" },
            { id: "reset-calendarF", label: "Försäsong" }
          ]
        }
      ];
    }

    if (pageKey === "matches") {
      return [
        ...base,
        {
          id: "import-group",
          icon: "import.svg",
          label: "Importera",
          kind: "io",
          menu: [
            { id: "import-json", icon: "json-file.svg", label: "JSON" },
            { id: "import-csv", icon: "file-csv.svg", label: "CSV" }
          ]
        },
        {
          id: "export-group",
          icon: "export.svg",
          label: "Exportera",
          kind: "io",
          menu: [
            { id: "export-json", icon: "json-file.svg", label: "JSON" }
          ]
        },
        { id: "reset-matches", icon: "reset.svg", label: "Återställ schema", kind: "io" }
      ];
    }

    if (pageKey === "cup") {
      return [
        ...base,
        { id: "export-png", icon: "image.svg", label: "Export PNG", kind: "io" },
        { id: "reset-cup", icon: "reset.svg", label: "Återställ schema", kind: "io" }
      ];
    }

    return base;
  }

  function buildToolbarMarkup(pageKey, iconsBase) {
    const actions = getToolbarActions(pageKey);
    if (!actions.length) return "";

    function getActionCluster(action) {
      if (!action || typeof action !== "object") return "utility";
      if (String(action.id || "").startsWith("reset-")) return "destructive";
      if (action.id === "search" || action.kind === "history") return "history-search";
      if (action.kind === "io") return "data-io";
      return "utility";
    }

    const buttons = actions
      .map((action, index) => {
        const cluster = getActionCluster(action);
        const previousCluster = index > 0 ? getActionCluster(actions[index - 1]) : "";
        const separator = index > 0 && cluster !== previousCluster
          ? '<span class="app-banner__tool-separator" aria-hidden="true"></span>'
          : "";

        const iconHtml = `<img class="app-banner__tool-icon" src="${iconsBase}${action.icon}" alt="" aria-hidden="true" width="16" height="16">`;

        if (Array.isArray(action.menu) && action.menu.length) {
          const items = action.menu
            .map((item) => {
              const itemIconHtml = item.icon
                ? `<img class="app-banner__tool-icon" src="${iconsBase}${item.icon}" alt="" aria-hidden="true" width="16" height="16">`
                : "";
              return `
              <button
                type="button"
                class="app-banner__tool-menu-item"
                data-banner-action="${item.id}"
                title="${item.label}"
                aria-label="${item.label}">
                ${itemIconHtml}<span>${item.label}</span>
              </button>`;
            })
            .join("");

          return `${separator}
            <div class="app-banner__tool-group" data-banner-tool-group>
              <button
                type="button"
                class="app-banner__tool-btn"
                data-banner-tool-toggle
                aria-expanded="false"
                title="${action.label}"
                aria-label="${action.label}">
                ${iconHtml}
                <span class="app-banner__tool-label">${action.label}</span>
              </button>
              <div class="app-banner__tool-menu" data-banner-tool-menu hidden>
                ${items}
              </div>
            </div>`;
        }

        return `${separator}
          <button
            type="button"
            class="app-banner__tool-btn"
            data-banner-action="${action.id}"
            title="${action.label}"
            aria-label="${action.label}">
            ${iconHtml}
            <span class="app-banner__tool-label">${action.label}</span>
          </button>`;
      })
      .join("");

    return `<div class="app-banner__toolbar" data-banner-toolbar>${buttons}</div>`;
  }

  function buildMenuActionsMarkup(pageKey) {
    const actions = getToolbarActions(pageKey)
      .filter((action) => action.id !== "undo" && action.id !== "redo")
      .flatMap((action) => {
        if (Array.isArray(action.menu) && action.menu.length) {
          return action.menu.map((item) => ({
            id: item.id,
            label: `${action.label} ${item.label}`
          }));
        }
        return [{ id: action.id, label: action.label }];
      });

    if (!actions.length) return "";

    const items = actions
      .map((action) => `
        <button
          type="button"
          class="app-banner__menu-action"
          data-banner-action="${action.id}"
          title="${action.label}"
          aria-label="${action.label}">
          <span>${action.label}</span>
        </button>`)
      .join("");

    return `
      <div class="app-banner__menu-divider" role="separator"></div>
      <div class="app-banner__menu-section">Åtgärder</div>
      ${items}
    `;
  }

  function requestHistoryAction(type) {
    const eventName = type === "undo" ? "schedule:undo-request" : "schedule:redo-request";
    const request = new CustomEvent(eventName, {
      detail: {
        handled: false
      }
    });

    document.dispatchEvent(request);

    if (!request.detail || request.detail.handled !== true) {
      showToast(type === "undo" ? "Ångra kommer i nästa steg." : "Gör om kommer i nästa steg.");
    }
  }

  function showToast(message) {
    if (!message) return;

    let toast = document.querySelector("[data-banner-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "app-banner__toast";
      toast.setAttribute("data-banner-toast", "1");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = String(message);
    toast.hidden = false;
    toast.classList.add("is-visible");

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.hidden = true;
      toastTimer = 0;
    }, 2100);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shouldHandleHistoryShortcut(event) {
    const target = event && event.target;
    if (!target || !(target instanceof Element)) return true;
    if (target.closest("[data-event-modal]")) return false;
    if (target.closest("input, textarea, select, [contenteditable='true']")) return false;
    return true;
  }

  function createConfirmAnchor(sourceEl) {
    const fallbackRect = {
      left: window.innerWidth / 2,
      right: window.innerWidth / 2,
      top: window.innerHeight / 2,
      bottom: window.innerHeight / 2,
      width: 0,
      height: 0
    };

    const rect = sourceEl && typeof sourceEl.getBoundingClientRect === "function"
      ? sourceEl.getBoundingClientRect()
      : fallbackRect;

    return {
      getBoundingClientRect() {
        return rect;
      }
    };
  }

  function requestResetConfirmation({ selector, sourceEl, label }) {
    const targetNode = document.querySelector(selector);
    if (!targetNode) {
      showToast("Återställning är inte tillgänglig på den här sidan.");
      return;
    }

    const contextMenu = window.scheduleEventContextMenu;
    if (!contextMenu || typeof contextMenu.confirmDelete !== "function") {
      targetNode.dataset.resetConfirmed = "true";
      targetNode.click();
      return;
    }

    const anchor = createConfirmAnchor(sourceEl);
    window.setTimeout(() => {
      contextMenu.confirmDelete({
        targetEl: anchor,
        label: label || "Återställa schemat?",
        confirmLabel: "Återställ",
        cancelLabel: "Avbryt",
        onConfirm() {
          targetNode.dataset.resetConfirmed = "true";
          targetNode.click();
        }
      });
    }, 0);
  }

  function ensureSearchUi() {
    if (searchRoot) return;

    searchRoot = document.createElement("div");
    searchRoot.className = "schedule-search";
    searchRoot.hidden = true;
    searchRoot.innerHTML = `
      <div class="schedule-search__dialog" role="dialog" aria-modal="true" aria-labelledby="scheduleSearchTitle">
        <div class="schedule-search__header">
          <h2 id="scheduleSearchTitle">Sök i schema</h2>
          <button type="button" class="schedule-search__close" data-search-close aria-label="Stäng">×</button>
        </div>
        <div class="schedule-search__body">
          <label class="schedule-search__field" for="scheduleSearchInput">Sök</label>
          <input id="scheduleSearchInput" class="schedule-search__input" type="search" autocomplete="off" placeholder="Sök i schemat">
          <p class="schedule-search__status" data-search-status>Skriv för att söka i den här sidan.</p>
          <div class="schedule-search__results" data-search-results></div>
        </div>
      </div>
    `;

    document.body.appendChild(searchRoot);

    searchInput = searchRoot.querySelector("#scheduleSearchInput");
    searchResults = searchRoot.querySelector("[data-search-results]");
    searchStatus = searchRoot.querySelector("[data-search-status]");
    searchTitle = searchRoot.querySelector("#scheduleSearchTitle");

    searchRoot.querySelector("[data-search-close]")?.addEventListener("click", () => {
      closeSearchPanel();
    });

    searchInput?.addEventListener("input", () => {
      renderSearchResults(searchInput.value);
    });

    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        updateActiveSearchResult(activeSearchIndex + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        updateActiveSearchResult(activeSearchIndex <= 0 ? 0 : activeSearchIndex - 1);
        return;
      }

      if (event.key !== "Enter") return;
      const activeResult = activeSearchResults[activeSearchIndex] || activeSearchResults[0];
      if (!activeResult) return;
      event.preventDefault();
      activateSearchResult(activeResult);
    });

    searchResults?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-search-result-id]");
      if (!button) return;

      const resultId = button.getAttribute("data-search-result-id");
      const result = activeSearchResults.find((item) => item.id === resultId);
      if (!result) return;

      activateSearchResult(result);
    });

    searchRoot.addEventListener("click", (event) => {
      if (event.target === searchRoot) {
        closeSearchPanel();
      }
    });
  }

  function closeSearchPanel() {
    if (!searchRoot) return;
    searchRoot.hidden = true;
    activeSearchAdapter = null;
    activeSearchResults = [];
    activeSearchIndex = -1;
    if (searchInput) searchInput.value = "";
    if (searchResults) searchResults.innerHTML = "";
    if (searchStatus) searchStatus.textContent = "";
    document.body.classList.remove("has-modal-open");
  }

  function updateActiveSearchResult(nextIndex) {
    if (!searchResults) return;

    const buttons = Array.from(searchResults.querySelectorAll("button[data-search-result-id]"));
    if (!buttons.length) {
      activeSearchIndex = -1;
      return;
    }

    const safeIndex = Math.max(0, Math.min(nextIndex, buttons.length - 1));
    activeSearchIndex = safeIndex;

    buttons.forEach((button, index) => {
      const isActive = index === safeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    buttons[safeIndex].scrollIntoView({ block: "nearest" });
  }

  function activateSearchResult(result) {
    if (!result || !activeSearchAdapter) return;

    if (typeof activeSearchAdapter.focusResult === "function") {
      activeSearchAdapter.focusResult(result.id);
      closeSearchPanel();
    }
  }

  function renderSearchResults(query) {
    if (!searchResults || !searchStatus) return;

    const trimmed = String(query || "").trim();
    if (!activeSearchAdapter || typeof activeSearchAdapter.search !== "function") {
      activeSearchResults = [];
      searchResults.innerHTML = "";
      searchStatus.textContent = "Sökning är inte tillgänglig på den här sidan ännu.";
      return;
    }

    if (!trimmed) {
      activeSearchResults = [];
      activeSearchIndex = -1;
      searchResults.innerHTML = "";
      searchStatus.textContent = "Skriv för att söka i den här sidan.";
      return;
    }

    activeSearchResults = activeSearchAdapter.search(trimmed).slice(0, 40);
    if (!activeSearchResults.length) {
      activeSearchIndex = -1;
      searchResults.innerHTML = "";
      searchStatus.textContent = `Ingen träff för \"${trimmed}\".`;
      return;
    }

    searchStatus.textContent = `${activeSearchResults.length} träff${activeSearchResults.length === 1 ? "" : "ar"}.`;
    searchResults.innerHTML = activeSearchResults.map((result) => `
      <button type="button" class="schedule-search__result" data-search-result-id="${escapeHtml(result.id)}">
        <span class="schedule-search__result-top">
          <span class="schedule-search__result-title">${escapeHtml(result.title)}</span>
          ${result.groupLabel ? `<span class="schedule-search__result-group">${escapeHtml(result.groupLabel)}</span>` : ""}
        </span>
        ${result.subtitle ? `<span class="schedule-search__result-subtitle">${escapeHtml(result.subtitle)}</span>` : ""}
      </button>
    `).join("");
    updateActiveSearchResult(0);
  }

  function openSearchPanel(pageKey) {
    if (window.scheduleEventModal && typeof window.scheduleEventModal.isOpen === "function" && window.scheduleEventModal.isOpen()) {
      showToast("Stäng redigeringen innan du söker.");
      return;
    }

    ensureSearchUi();
    activeSearchAdapter = window.schedulePageSearch || null;
    activeSearchResults = [];
    activeSearchIndex = -1;

    const pageLabelByKey = {
      training: "Sök i träningsschema",
      matches: "Sök i matchschema",
      cup: "Sök i cupschema"
    };

    if (searchTitle) {
      searchTitle.textContent = pageLabelByKey[pageKey] || "Sök i schema";
    }

    if (searchInput) {
      searchInput.placeholder = activeSearchAdapter && activeSearchAdapter.placeholder
        ? activeSearchAdapter.placeholder
        : "Sök i schemat";
      searchInput.value = "";
    }

    if (searchResults) searchResults.innerHTML = "";
    if (searchStatus) {
      searchStatus.textContent = activeSearchAdapter
        ? "Skriv för att söka i den här sidan."
        : "Sökning är inte tillgänglig på den här sidan ännu.";
    }

    searchRoot.hidden = false;
    document.body.classList.add("has-modal-open");

    requestAnimationFrame(() => {
      searchInput?.focus();
      searchInput?.select();
    });
  }

  async function runToolbarAction(actionId, pageKey, sourceEl) {
    const click = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      node.click();
      return true;
    };

    if (actionId === "undo" || actionId === "redo") {
      requestHistoryAction(actionId);
      return;
    }

    if (actionId === "search") {
      openSearchPanel(pageKey);
      return;
    }

    if (actionId === "import-json") {
      if (!click("#importJson")) {
        showToast("Import JSON är inte tillgänglig på den här sidan.");
      }
      return;
    }

    if (actionId === "import-csv") {
      if (!click("#importCsv")) {
        showToast("Import CSV är inte tillgänglig på den här sidan.");
      }
      return;
    }

    if (actionId === "export-json") {
      if (!click("#exportJson")) {
        showToast("Export JSON är inte tillgänglig på den här sidan.");
      }
      return;
    }

    if (actionId === "export-pdf") {
      if (!click("#exportAllPdf")) {
        showToast("Export PDF är inte tillgänglig på den här sidan.");
      }
      return;
    }

    if (actionId === "reset-cup") {
      requestResetConfirmation({
        selector: "#weekendClear",
        sourceEl,
        label: "Rensa schemat och börja från noll?"
      });
      return;
    }

    if (actionId === "reset-matches") {
      requestResetConfirmation({
        selector: '.reset-btn[data-cal="calendarMatches"]',
        sourceEl,
        label: "Rensa schemat och börja från noll?"
      });
      return;
    }

    if (actionId.startsWith("copy-")) {
      if (pageKey !== "training") {
        showToast("Funktionen är inte tillgänglig på den här sidan.");
        return;
      }

      const mapByActionId = {
        "copy-calendarA": ".copy-btn[data-cal=\"calendarA\"]",
        "copy-calendarB": ".copy-btn[data-cal=\"calendarB\"]",
        "copy-calendarS": ".copy-btn[data-cal=\"calendarS\"]",
        "copy-calendarF": ".copy-btn[data-cal=\"calendarF\"]"
      };

      const selector = mapByActionId[actionId];
      if (!selector || !click(selector)) {
        showToast("Funktionen är inte tillgänglig på den här sidan.");
      }
      return;
    }

    if (actionId.startsWith("reset-")) {
      if (pageKey !== "training") {
        showToast("Funktionen är inte tillgänglig på den här sidan.");
        return;
      }

      const mapByActionId = {
        "reset-calendarA": {
          selector: '.reset-btn[data-cal="calendarA"]',
          label: "Rensa A-plan och börja från noll?"
        },
        "reset-calendarB": {
          selector: '.reset-btn[data-cal="calendarB"]',
          label: "Rensa B-plan och börja från noll?"
        },
        "reset-calendarS": {
          selector: '.reset-btn[data-cal="calendarS"]',
          label: "Rensa Skönvik och börja från noll?"
        },
        "reset-calendarF": {
          selector: '.reset-btn[data-cal="calendarF"]',
          label: "Rensa Försäsong A-plan och börja från noll?"
        }
      };

      const config = mapByActionId[actionId];
      if (!config) {
        showToast("Funktionen är inte tillgänglig på den här sidan.");
        return;
      }

      requestResetConfirmation({
        selector: config.selector,
        sourceEl,
        label: config.label
      });
      return;
    }

    if (actionId.startsWith("export-png-")) {
      if (pageKey === "cup") {
        if (!click("#weekendExportPng")) {
          showToast("Export PNG är inte tillgänglig på den här sidan.");
        }
        return;
      }

      if (pageKey === "training") {
        if (actionId === "export-png-all") {
          ["calendarA", "calendarB", "calendarS", "calendarF"].forEach((calId) => {
            click(`.export-png[data-cal="${calId}"]`);
          });
          return;
        }

        const mapByActionId = {
          "export-png-calendarA": "calendarA",
          "export-png-calendarB": "calendarB",
          "export-png-calendarS": "calendarS",
          "export-png-calendarF": "calendarF"
        };

        const calId = mapByActionId[actionId];
        if (!calId || !click(`.export-png[data-cal="${calId}"]`)) {
          showToast("Export PNG är inte tillgänglig på den här sidan.");
        }
        return;
      }

      showToast("Export PNG är inte tillgänglig på den här sidan.");
    }

    if (actionId === "export-png") {
      if (pageKey === "cup" && !click("#weekendExportPng")) {
        showToast("Export PNG är inte tillgänglig på den här sidan.");
      }
      return;
    }
  }

  function buildBannerMarkup(scheduleType, pageKey) {
    const pathName = (window.location && window.location.pathname ? window.location.pathname : "").toLowerCase();
    const isPagesSection = pathName.includes("/pages/") || /\\pages\\/.test(pathName);
    const isSettingsPage = pageKey === "settings";
    const iconsBase = isPagesSection ? "../assets/icons/" : "assets/icons/";
    const toolbarMarkup = buildToolbarMarkup(pageKey, iconsBase);
    const menuLinks = getMenuLinks(pageKey, isPagesSection)
      .map((item) => {
        const divider = item.dividerBefore ? '<div class="app-banner__menu-divider" role="separator"></div>' : "";
        if (item.isCurrent) {
          return `${divider}<span class="app-banner__menu-item is-current" aria-current="page">${item.label}</span>`;
        }
        return `${divider}<a href="${item.href}">${item.label}</a>`;
      })
      .join("");

    const menuActions = buildMenuActionsMarkup(pageKey);
    const menuMarkup = isSettingsPage
      ? ""
      : `
        <div class="app-banner__menu">
          <button class="app-banner__menu-toggle" type="button" aria-expanded="false" aria-controls="bannerMenuPanel" data-banner-menu-toggle>
            <span class="app-banner__menu-label">Meny</span>
            <span class="app-banner__menu-icon" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
          <nav class="app-banner__menu-panel" id="bannerMenuPanel" data-banner-menu-panel hidden>
            ${menuLinks}
            ${menuActions}
          </nav>
        </div>
      `;

    const rightMarkup = isSettingsPage
      ? ""
      : `
        <div class="app-banner__right">
          ${toolbarMarkup}
          ${menuMarkup}
        </div>
      `;

    return `
      <header class="app-banner no-export${isSettingsPage ? " app-banner--no-menu" : ""}" data-schedule-banner data-page-key="${pageKey}" data-schedule-type="${scheduleType}">
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
        ${rightMarkup}
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

  function closeBannerMenu(banner) {
    if (!banner) return;

    const toggleBtn = banner.querySelector("[data-banner-menu-toggle]");
    const panel = banner.querySelector("[data-banner-menu-panel]");
    if (!toggleBtn || !panel) return;

    toggleBtn.setAttribute("aria-expanded", "false");
    panel.hidden = true;
  }

  function closeBannerToolMenus(banner) {
    if (!banner) return;

    banner.querySelectorAll("[data-banner-tool-group]").forEach((groupEl) => {
      const toggle = groupEl.querySelector("[data-banner-tool-toggle]");
      const menu = groupEl.querySelector("[data-banner-tool-menu]");
      if (!toggle || !menu) return;
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    });
  }

  function closeBannerPopups(banner) {
    closeBannerMenu(banner);
    closeBannerToolMenus(banner);
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
      closeBannerToolMenus(banner);
      setOpenState(!isOpen);
    });

    panel.querySelectorAll("a").forEach((linkEl) => {
      linkEl.addEventListener("click", () => setOpenState(false));
    });

    panel.querySelectorAll("button[data-banner-action]").forEach((buttonEl) => {
      buttonEl.addEventListener("click", () => setOpenState(false));
    });

    document.addEventListener("click", (event) => {
      if (!banner.contains(event.target)) {
        closeBannerPopups(banner);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && searchRoot && !searchRoot.hidden) {
        closeSearchPanel();
        return;
      }

      if (event.key === "Escape") {
        closeBannerPopups(banner);
      }
    });
  }

  function initBannerToolbar() {
    const banner = document.querySelector("[data-schedule-banner]");
    if (!banner) return;

    const pageKey = banner.dataset.pageKey || "training";

    banner.querySelectorAll("[data-banner-tool-group]").forEach((groupEl) => {
      const toggle = groupEl.querySelector("[data-banner-tool-toggle]");
      const menu = groupEl.querySelector("[data-banner-tool-menu]");
      if (!toggle || !menu) return;

      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const nextOpen = toggle.getAttribute("aria-expanded") !== "true";
        closeBannerPopups(banner);
        toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        menu.hidden = !nextOpen;
      });
    });

    banner.querySelectorAll("[data-banner-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const actionId = btn.getAttribute("data-banner-action");
        if (!actionId) return;
        runToolbarAction(actionId, pageKey, btn);
        closeBannerToolMenus(banner);
      });

      const actionId = btn.getAttribute("data-banner-action");
      if (actionId === "undo" || actionId === "redo") {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      }
    });

    document.addEventListener("click", (event) => {
      if (!banner.contains(event.target)) {
        closeBannerPopups(banner);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeBannerPopups(banner);
      }

      if (!shouldHandleHistoryShortcut(event)) return;

      const isCmdOrCtrl = event.ctrlKey || event.metaKey;
      if (!isCmdOrCtrl) return;

      const key = String(event.key || "").toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        requestHistoryAction("undo");
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        requestHistoryAction("redo");
      }
    });

    document.addEventListener("schedule:history-state", (event) => {
      const state = event && event.detail && typeof event.detail === "object" ? event.detail : {};
      const canUndo = Boolean(state.canUndo);
      const canRedo = Boolean(state.canRedo);

      banner.querySelectorAll('[data-banner-action="undo"]').forEach((btn) => {
        btn.disabled = !canUndo;
        btn.setAttribute("aria-disabled", canUndo ? "false" : "true");
      });

      banner.querySelectorAll('[data-banner-action="redo"]').forEach((btn) => {
        btn.disabled = !canRedo;
        btn.setAttribute("aria-disabled", canRedo ? "false" : "true");
      });
    });
  }

  mountBanner();

  const settings = loadSettings();
  renderBanner(settings);
  initBannerMenu();
  initBannerToolbar();

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