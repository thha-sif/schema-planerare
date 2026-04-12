document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "schema-helg-v1";

  const TEAMS = ["Säters IF FK", "Röd", "Orange", "Mörkgul", "Gul", "Ljusgrön", "Grön", "Turkos", "Ljusblå", "Blå", "Lila", "Rosa", "Grå", "Svart", "Vit"];

  let selectedEvent = null;
  let selectedEl = null;
  let data = [];
  const eventElements = new Map();

  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function snapshotData() {
    return JSON.parse(JSON.stringify(data));
  }

  function applyDataState(nextData) {
    data = Array.isArray(nextData) ? JSON.parse(JSON.stringify(nextData)) : [];
    saveEvents(data);
    clearSelection();
    if (calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(data);
    }
  }

  const history = window.scheduleHistory && typeof window.scheduleHistory.createManager === "function"
    ? window.scheduleHistory.createManager({
      applyState: applyDataState,
      onStateChange(state) {
        document.dispatchEvent(new CustomEvent("schedule:history-state", { detail: state }));
      }
    })
    : null;

  function recordHistory(beforeState) {
    if (!history) return;
    history.record(beforeState, snapshotData());
  }

  function makeId() {
    return `wk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }
  function timeFromDate(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  function dowFromDate(d) { return d.getDay(); } // 0=sön..6=lör

  function syncEditButtonState() {
    // Cup page no longer shows a separate edit toolbar button.
  }

  function clearSelection() {
    if (selectedEl) {
      selectedEl.style.outline = "";
      selectedEl.style.outlineOffset = "";
    }
    selectedEvent = null;
    selectedEl = null;
    syncEditButtonState();
  }

  function setSelection(ev, el) {
    if (selectedEl && selectedEl !== el) {
      selectedEl.style.outline = "";
      selectedEl.style.outlineOffset = "";
    }
    selectedEvent = ev;
    selectedEl = el;

    if (selectedEl) {
      selectedEl.style.outline = "2px solid #000";
      selectedEl.style.outlineOffset = "1px";
    }

    syncEditButtonState();
  }

  function openEventEditor(ev, el) {
    if (!ev) return;

    const key = ev.id || (ev._def && ev._def.publicId) || "";
    const item = data.find((x) => x.id === key);
    if (!item) return;

    const modal = window.scheduleEventModal;
    if (!modal || typeof modal.open !== "function") {
      const newTitle = prompt("Redigera namn", ev.title);
      if (newTitle === null) return;

      ev.setProp("title", newTitle);
      item.title = newTitle;
      if (el) {
        el.style.setProperty("--stripe-color", eventLockedColor(ev));
      }
      saveEvents(data);
      return;
    }

    setSelection(ev, el || selectedEl);

    modal.open({
      dialogTitle: "Redigera aktivitet",
      showFields: {
        title: true,
        startTime: true,
        endTime: true
      },
      values: {
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime
      },
      statusText: "Ändra namn och tider för den markerade aktiviteten.",
      onSave(nextValues) {
        const beforeState = snapshotData();
        if (!nextValues.title) {
          modal.setStatus("Namn måste fyllas i.");
          return false;
        }

        if (!nextValues.startTime || !nextValues.endTime || nextValues.endTime <= nextValues.startTime) {
          modal.setStatus("Sluttiden måste vara senare än starttiden.");
          return false;
        }

        item.title = nextValues.title;
        item.startTime = nextValues.startTime;
        item.endTime = nextValues.endTime;

        saveEvents(data);
        clearSelection();
        calendar.removeAllEvents();
        calendar.addEventSource(data);
        recordHistory(beforeState);
      },
      onDelete() {
        const beforeState = snapshotData();
        const idx = data.findIndex((x) => x.id === key);
        if (idx !== -1) {
          data.splice(idx, 1);
        }

        saveEvents(data);
        clearSelection();
        calendar.removeAllEvents();
        calendar.addEventSource(data);
        recordHistory(beforeState);
      }
    });
  }

  function colorFromTitle(title) {
    if (title === "Blå") return "blue";
    if (title === "Röd") return "red";
    if (title === "Gul") return "yellow";
    if (title === "Mörkgul") return "#CA8A04";
    if (title === "Orange") return "orange";
    if (title === "Ljusblå") return "lightblue";
    if (title === "Turkos") return "#06B6D4";
    if (title === "Grön") return "green";
    if (title === "Grå") return "#6B7280";
    if (title === "Svart") return "black";
    if (title === "Vit") return "white";
    if (title === "Lila") return "purple";
    if (title === "Rosa") return "#EC4899";
    if (title === "Ljusgrön") return "lightgreen";
    return "#013888";
  }

  function eventLockedColor(ev) {
    return (ev && ev.extendedProps && ev.extendedProps.lockedColor) || colorFromTitle(ev && ev.title);
  }

  function textColorFromTitle(title) {
    if (title === "Gul" || title === "Ljusblå" || title === "Ljusgrön" || title === "Vit" || title === "Turkos") {
      return "#000000";
    }
    return "#ffffff";
  }

  function normalizeSearchText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function scoreCupSearch(title, needle) {
    const haystack = normalizeSearchText(title);
    if (!haystack || !needle) return -1;
    if (haystack === needle) return 360;
    if (haystack.startsWith(needle)) return 260;
    const wordIndex = haystack.indexOf(` ${needle}`);
    if (wordIndex !== -1) return 180 - wordIndex;
    const containsIndex = haystack.indexOf(needle);
    if (containsIndex !== -1) return 100 - containsIndex;
    return -1;
  }

  function focusSearchResult(resultId) {
    const event = calendar && calendar.getEventById(resultId);
    const eventEl = eventElements.get(resultId);
    const wrapper = document.getElementById("export-weekend");

    if (wrapper) {
      wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (!event || !eventEl) return false;

    setSelection(event, eventEl);
    eventEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    eventEl.focus({ preventScroll: true });
    return true;
  }

  function editSearchResult(resultId) {
    const event = calendar && calendar.getEventById(resultId);
    const eventEl = eventElements.get(resultId);
    if (!event || !eventEl) return false;

    setSelection(event, eventEl);
    openEventEditor(event, eventEl);
    return true;
  }

  function initTeamsPanel() {
    const teamsEl = document.getElementById("teams");
    if (!teamsEl) return;
    teamsEl.innerHTML = TEAMS.map(name => `<div class="team-item">${name}</div>`).join("");

    teamsEl.querySelectorAll(".team-item").forEach((itemEl) => {
      const title = itemEl.innerText.trim();
      itemEl.style.backgroundColor = colorFromTitle(title);
      itemEl.style.color = textColorFromTitle(title);
      itemEl.style.borderColor = "#8c8480";
    });

    new FullCalendar.Draggable(teamsEl, {
      itemSelector: ".team-item",
      eventData: function(eventEl) {
        return {
          title: eventEl.innerText,
          duration: "01:00"
        };
      }
    });
  }

  function ensureLockedColors(events) {
    let changed = false;

    events.forEach((item) => {
      if (!item || typeof item !== "object") return;
      if (item.lockedColor) return;
      item.lockedColor = colorFromTitle(item.title);
      changed = true;
    });

    return changed;
  }

  function currentDropStamp() {
    return Date.now();
  }

  function compareByDropOrder(a, b) {
    // Apply custom ordering only for direct overlaps at same start/end.
    const aStart = a && a.start ? Number(new Date(a.start)) : NaN;
    const bStart = b && b.start ? Number(new Date(b.start)) : NaN;
    const aEnd = a && a.end ? Number(new Date(a.end)) : NaN;
    const bEnd = b && b.end ? Number(new Date(b.end)) : NaN;

    if (!Number.isFinite(aStart) || !Number.isFinite(bStart) || !Number.isFinite(aEnd) || !Number.isFinite(bEnd)) {
      return 0;
    }

    if (aStart !== bStart || aEnd !== bEnd) {
      return 0;
    }

    const aStamp = a && a.extendedProps ? Number(a.extendedProps.droppedAt) : 0;
    const bStamp = b && b.extendedProps ? Number(b.extendedProps.droppedAt) : 0;

    const safeA = Number.isFinite(aStamp) ? aStamp : 0;
    const safeB = Number.isFinite(bStamp) ? bStamp : 0;
    return safeB - safeA;
  }

  data = loadEvents();
  if (ensureLockedColors(data)) {
    saveEvents(data);
  }

  initTeamsPanel();

  const calendarEl = document.getElementById("weekendCalendar");

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    headerToolbar: false,

    locale: "sv",
    firstDay: 1,
    dayHeaderFormat: { weekday: "long" },

    allDaySlot: false,

    // Only show weekend days
    hiddenDays: [1,2,3,4,5],

    slotMinTime: "09:00:00",
    slotMaxTime: "17:10:00",
    slotDuration: "00:10:00",
    snapDuration: "00:10:00",
    
    height: "100%",
    expandRows: true,

    editable: true,
    selectable: true,
    selectMirror: true,
    dragScroll: true,
    slotEventOverlap: true,

    events: data,

    select(info) {
      const initialStartTime = timeFromDate(info.start);
      const initialEndTime = timeFromDate(info.end);
      const modal = window.scheduleEventModal;

      if (!modal || typeof modal.open !== "function") {
        const title = prompt("Namn");
        if (!title) return;

        const item = {
          id: makeId(),
          title,
          lockedColor: colorFromTitle(title),
          droppedAt: currentDropStamp(),
          daysOfWeek: [dowFromDate(info.start)],
          startTime: initialStartTime,
          endTime: initialEndTime
        };

        data.push(item);
        calendar.addEvent(item);
        saveEvents(data);
        return;
      }

      modal.open({
        dialogTitle: "Ny aktivitet",
        showFields: {
          title: true,
          startTime: true,
          endTime: true
        },
        values: {
          title: "",
          startTime: initialStartTime,
          endTime: initialEndTime
        },
        statusText: "Ange namn och tider för den nya aktiviteten.",
        onSave(nextValues) {
          const beforeState = snapshotData();
          if (!nextValues.title) {
            modal.setStatus("Namn måste fyllas i.");
            return false;
          }

          if (!nextValues.startTime || !nextValues.endTime || nextValues.endTime <= nextValues.startTime) {
            modal.setStatus("Sluttiden måste vara senare än starttiden.");
            return false;
          }

          const item = {
            id: makeId(),
            title: nextValues.title,
            lockedColor: colorFromTitle(nextValues.title),
            droppedAt: currentDropStamp(),
            daysOfWeek: [dowFromDate(info.start)],
            startTime: nextValues.startTime,
            endTime: nextValues.endTime
          };

          data.push(item);
          calendar.addEvent(item);
          saveEvents(data);
          recordHistory(beforeState);
        }
      });
    },

    eventDrop(info) {
      const beforeState = snapshotData();
      const key = info.event.id || (info.event._def && info.event._def.publicId) || "";
      const item = data.find(x => x.id === key);
      if (!item) return;

      item.daysOfWeek = [dowFromDate(info.event.start)];
      item.startTime = timeFromDate(info.event.start);
      item.endTime = timeFromDate(info.event.end);
      item.droppedAt = currentDropStamp();

      info.event.setExtendedProp("droppedAt", item.droppedAt);

      saveEvents(data);
      recordHistory(beforeState);
    },

    eventResize(info) {
      const beforeState = snapshotData();
      const key = info.event.id || (info.event._def && info.event._def.publicId) || "";
      const item = data.find(x => x.id === key);
      if (!item) return;

      item.endTime = timeFromDate(info.event.end);
      saveEvents(data);
      recordHistory(beforeState);
    },

    eventDidMount(info) {
      const stripeColor = eventLockedColor(info.event);
      info.el.style.setProperty("--stripe-color", stripeColor);
      info.el.tabIndex = 0;
      eventElements.set(info.event.id || (info.event._def && info.event._def.publicId) || "", info.el);

      // enkelklick markera
      if (!info.el.dataset.bound) {
        info.el.dataset.bound = "1";

        info.el.addEventListener("click", () => {
          setSelection(info.event, info.el);
        });

        info.el.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelection(info.event, info.el);
          openEventEditor(info.event, info.el);
        });

        info.el.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelection(info.event, info.el);

          const contextMenu = window.scheduleEventContextMenu;
          if (contextMenu && typeof contextMenu.show === "function") {
            contextMenu.show({
              x: e.clientX,
              y: e.clientY,
              onEdit: () => openEventEditor(info.event, info.el)
            });
            return;
          }

          openEventEditor(info.event, info.el);
        });
      }
    },

    eventReceive(info) {
      const beforeState = snapshotData();
      const start = info.event.start;
      const end = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);

      const item = {
        id: makeId(),
        title: info.event.title,
        lockedColor: colorFromTitle(info.event.title),
        droppedAt: currentDropStamp(),
        daysOfWeek: [dowFromDate(start)],
        startTime: timeFromDate(start),
        endTime: timeFromDate(end)
      };

      data.push(item);
      saveEvents(data);

      info.event.remove();
      calendar.addEvent(item);
      recordHistory(beforeState);
    },

    eventContent(arg) {
      const start = arg.event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const end = arg.event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      return {
        html: `
          <div class="ev">
            <b class="ev-title">${arg.event.title}</b>
            <br>
            <span class="ev-time">${start} - ${end}</span>
          </div>
        `
      };
    },

    eventOrder: compareByDropOrder
  });

  calendar.render();

  syncEditButtonState();

  // DEL/BACKSPACE: öppna redigering för säker borttagning
  document.addEventListener("keydown", (e) => {
    if (!selectedEvent) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (window.scheduleEventModal && window.scheduleEventModal.isOpen()) return;

    e.preventDefault();

    const contextMenu = window.scheduleEventContextMenu;
    if (contextMenu && typeof contextMenu.confirmDelete === "function") {
      const key = selectedEvent.id || (selectedEvent._def && selectedEvent._def.publicId) || "";
      const el = selectedEl;
      contextMenu.confirmDelete({
        targetEl: el,
        onConfirm() {
          const beforeState = snapshotData();
          const idx = data.findIndex((x) => x.id === key);
          if (idx !== -1) data.splice(idx, 1);
          saveEvents(data);
          clearSelection();
          calendar.removeAllEvents();
          calendar.addEventSource(data);
          recordHistory(beforeState);
        }
      });
    } else {
      openEventEditor(selectedEvent, selectedEl);
    }
  });

  // Klick utanför event: avmarkera
  document.addEventListener("click", (e) => {
    const clickedEvent = e.target.closest(".fc-event");
    const clickedControl = e.target.closest("button");
    if (!clickedEvent && !clickedControl) clearSelection();
  });

  document.getElementById("weekendClear").addEventListener("click", () => {
    const beforeState = snapshotData();
    const clearBtn = document.getElementById("weekendClear");
    const skipConfirm = clearBtn && clearBtn.dataset.resetConfirmed === "true";
    if (clearBtn) {
      clearBtn.dataset.resetConfirmed = "false";
    }

    const ok = skipConfirm ? true : confirm("Rensa schemat och börja från noll?");
    if (!ok) return;

    data = [];
    saveEvents(data);
    clearSelection();
    calendar.removeAllEvents();
    recordHistory(beforeState);
  });

  // Export PNG (endast export-wrapper)
  async function captureElementAsCanvas(el) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return html2canvas(el, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function safeFilename(name) {
    return (name || "").replace(/[\\/:*?"<>|]/g, "-").trim();
  }

  document.getElementById("weekendExportPng").addEventListener("click", async () => {
    const wrapper = document.getElementById("export-weekend");
    const canvas = await captureElementAsCanvas(wrapper);
    const dataUrl = canvas.toDataURL("image/png", 1.0);

    // filnamn med datum för "den här helgen" (baserat på dagens datum)
    const date = new Date();
    const stamp = `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
    downloadDataUrl(dataUrl, `${safeFilename("Helgschema")}-${stamp}.png`);
  });

  document.addEventListener("schedule:undo-request", (event) => {
    if (!history) return;
    if (event && event.detail && typeof event.detail === "object") {
      event.detail.handled = true;
    }
    history.undo();
  });

  document.addEventListener("schedule:redo-request", (event) => {
    if (!history) return;
    if (event && event.detail && typeof event.detail === "object") {
      event.detail.handled = true;
    }
    history.redo();
  });

  window.schedulePageSearch = {
    placeholder: "Sök färg eller aktivitet",
    search(query) {
      const needle = normalizeSearchText(query);
      if (!needle) return [];

      return data
        .map((item) => ({
          item,
          score: scoreCupSearch(item.title, needle)
        }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => right.score - left.score || String(left.item.title || "").localeCompare(String(right.item.title || ""), "sv"))
        .map(({ item }) => ({
          id: item.id,
          title: item.title || "Aktivitet",
          subtitle: [item.startTime, item.endTime].filter(Boolean).join("-") || "Cupschema",
          groupLabel: "Cup",
          canEdit: true
        }));
    },
    focusResult(resultId) {
      return focusSearchResult(resultId);
    },
    editResult(resultId) {
      return editSearchResult(resultId);
    }
  };
});