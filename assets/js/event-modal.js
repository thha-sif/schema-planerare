document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-event-modal]");
  if (!root) return;

  const dialog = root.querySelector(".event-modal__dialog");
  const form = root.querySelector("[data-event-modal-form]");
  const titleLabel = root.querySelector("[data-event-modal-title]");
  const statusEl = root.querySelector("[data-event-modal-status]");
  const deleteBtn = root.querySelector("[data-event-modal-delete]");
  const closeTargets = root.querySelectorAll("[data-event-modal-close]");

  const fieldWraps = {
    title: root.querySelector('[data-field-wrap="title"]'),
    startTime: root.querySelector('[data-field-wrap="startTime"]'),
    endTime: root.querySelector('[data-field-wrap="endTime"]'),
    startDateTime: root.querySelector('[data-field-wrap="startDateTime"]'),
    endDateTime: root.querySelector('[data-field-wrap="endDateTime"]'),
    facility: root.querySelector('[data-field-wrap="facility"]')
  };

  const fields = {
    title: root.querySelector('[data-field="title"]'),
    startTime: root.querySelector('[data-field="startTime"]'),
    endTime: root.querySelector('[data-field="endTime"]'),
    startDateTime: root.querySelector('[data-field="startDateTime"]'),
    endDateTime: root.querySelector('[data-field="endDateTime"]'),
    facility: root.querySelector('[data-field="facility"]')
  };

  let activeConfig = null;
  let restoreFocusEl = null;
  let contextMenuAction = null;

  const contextMenuEl = document.createElement("div");
  contextMenuEl.className = "event-context-menu";
  contextMenuEl.hidden = true;
  contextMenuEl.innerHTML = '<button type="button" class="event-context-menu__button">Redigera</button>';
  document.body.appendChild(contextMenuEl);

  const contextMenuEditBtn = contextMenuEl.querySelector(".event-context-menu__button");

  function hideContextMenu() {
    contextMenuEl.hidden = true;
    contextMenuAction = null;
  }

  function showContextMenu(options) {
    const next = options || {};
    if (typeof next.onEdit !== "function") return;

    contextMenuAction = next.onEdit;
    contextMenuEl.hidden = false;
    contextMenuEl.style.left = "0px";
    contextMenuEl.style.top = "0px";

    requestAnimationFrame(() => {
      const rect = contextMenuEl.getBoundingClientRect();
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
      const left = Math.min(Math.max(Number(next.x) || 0, margin), maxLeft);
      const top = Math.min(Math.max(Number(next.y) || 0, margin), maxTop);

      contextMenuEl.style.left = `${left}px`;
      contextMenuEl.style.top = `${top}px`;
    });
  }

  if (contextMenuEditBtn) {
    contextMenuEditBtn.addEventListener("click", () => {
      const action = contextMenuAction;
      hideContextMenu();
      if (typeof action === "function") {
        action();
      }
    });
  }

  function resetDeleteState() {
    if (!deleteBtn) return;
    deleteBtn.dataset.confirming = "false";
    deleteBtn.textContent = deleteBtn.dataset.defaultLabel || "Ta bort";
    deleteBtn.classList.remove("is-confirming");
  }

  function setStatus(message) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
  }

  function setFieldVisibility(showFields) {
    const visible = showFields || {};

    Object.entries(fieldWraps).forEach(([key, wrap]) => {
      if (!wrap) return;
      wrap.hidden = !visible[key];
    });
  }

  function fillValues(values) {
    const next = values || {};
    if (fields.title) fields.title.value = next.title || "";
    if (fields.startTime) fields.startTime.value = next.startTime || "";
    if (fields.endTime) fields.endTime.value = next.endTime || "";
    if (fields.startDateTime) fields.startDateTime.value = next.startDateTime || "";
    if (fields.endDateTime) fields.endDateTime.value = next.endDateTime || "";
    if (fields.facility) fields.facility.value = next.facility || "";
  }

  function collectValues() {
    return {
      title: fields.title ? fields.title.value.trim() : "",
      startTime: fields.startTime ? fields.startTime.value : "",
      endTime: fields.endTime ? fields.endTime.value : "",
      startDateTime: fields.startDateTime ? fields.startDateTime.value : "",
      endDateTime: fields.endDateTime ? fields.endDateTime.value : "",
      facility: fields.facility ? fields.facility.value : ""
    };
  }

  function getInitialFocusTarget() {
    const ordered = [
      fields.title,
      fields.startDateTime,
      fields.startTime,
      fields.facility,
      dialog && dialog.querySelector("button")
    ];

    return ordered.find((node) => node && !node.closest("[hidden]"));
  }

  function closeModal() {
    root.hidden = true;
    document.body.classList.remove("has-modal-open");
    resetDeleteState();
    hideContextMenu();
    setStatus("");
    form.reset();

    const nextFocus = restoreFocusEl;
    activeConfig = null;
    restoreFocusEl = null;

    if (nextFocus && typeof nextFocus.focus === "function") {
      nextFocus.focus();
    }
  }

  function openModal(config) {
    hideContextMenu();
    activeConfig = config || {};
    restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (titleLabel) {
      titleLabel.textContent = activeConfig.dialogTitle || "Redigera aktivitet";
    }

    setFieldVisibility(activeConfig.showFields || { title: true });
    fillValues(activeConfig.values);
    setStatus(activeConfig.statusText || "");

    if (deleteBtn) {
      const deleteLabel = activeConfig.deleteLabel || "Ta bort";
      deleteBtn.hidden = typeof activeConfig.onDelete !== "function";
      deleteBtn.dataset.defaultLabel = deleteLabel;
      deleteBtn.textContent = deleteLabel;
    }

    root.hidden = false;
    document.body.classList.add("has-modal-open");
    resetDeleteState();

    requestAnimationFrame(() => {
      const focusTarget = getInitialFocusTarget();
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    });
  }

  closeTargets.forEach((node) => {
    node.addEventListener("click", (event) => {
      if (node === root && event.target !== root) return;
      closeModal();
    });
  });

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      closeModal();
    }
  });

  document.addEventListener("click", (event) => {
    if (!contextMenuEl.hidden && !contextMenuEl.contains(event.target)) {
      hideContextMenu();
    }
  });

  document.addEventListener("scroll", () => {
    if (!contextMenuEl.hidden) {
      hideContextMenu();
    }
  }, true);

  window.addEventListener("resize", () => {
    if (!contextMenuEl.hidden) {
      hideContextMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!contextMenuEl.hidden) {
        hideContextMenu();
      }

      if (!root.hidden) {
        event.preventDefault();
        closeModal();
      }
    }
  });

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!activeConfig || typeof activeConfig.onSave !== "function") {
        closeModal();
        return;
      }

      try {
        const result = activeConfig.onSave(collectValues());
        if (result === false) return;
        closeModal();
      } catch (error) {
        setStatus((error && error.message) || "Kunde inte spara ändringen.");
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (!activeConfig || typeof activeConfig.onDelete !== "function") return;

      if (deleteBtn.dataset.confirming !== "true") {
        deleteBtn.dataset.confirming = "true";
        deleteBtn.classList.add("is-confirming");
        deleteBtn.textContent = "Bekräfta ta bort";
        setStatus("Klicka igen för att ta bort aktiviteten.");
        return;
      }

      try {
        const result = activeConfig.onDelete();
        if (result === false) return;
        closeModal();
      } catch (error) {
        setStatus((error && error.message) || "Kunde inte ta bort aktiviteten.");
      }
    });
  }

  window.scheduleEventContextMenu = {
    show: showContextMenu,
    hide: hideContextMenu,
    isOpen() {
      return !contextMenuEl.hidden;
    }
  };

  window.scheduleEventModal = {
    open: openModal,
    close: closeModal,
    setStatus,
    isOpen() {
      return !root.hidden;
    }
  };
});