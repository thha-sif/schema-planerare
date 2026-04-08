document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "schema-helg-v1";

  const TEAMS = ["Säters IF FK", "Röd", "Orange", "Mörkgul", "Gul", "Ljusgrön", "Grön", "Turkos", "Ljusblå", "Blå", "Lila", "Rosa", "Grå", "Svart", "Vit"];

  let selectedEvent = null;
  let selectedEl = null;

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
      },
      onDelete() {
        const idx = data.findIndex((x) => x.id === key);
        if (idx !== -1) {
          data.splice(idx, 1);
        }

        saveEvents(data);
        clearSelection();
        calendar.removeAllEvents();
        calendar.addEventSource(data);
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

  let data = loadEvents();
  if (ensureLockedColors(data)) {
    saveEvents(data);
  }

  initTeamsPanel();

  const calendarEl = document.getElementById("weekendCalendar");
  const initialHeight = getViewportCalendarHeight(calendarEl);

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

    height: initialHeight,
    expandRows: true,

    editable: true,
    selectable: true,
    selectMirror: true,
    slotEventOverlap: true,

    events: data,

    select(info) {
      const title = prompt("Namn");
      if (!title) return;

      const item = {
        id: makeId(),
        title,
        lockedColor: colorFromTitle(title),
        droppedAt: currentDropStamp(),
        daysOfWeek: [dowFromDate(info.start)],
        startTime: timeFromDate(info.start),
        endTime: timeFromDate(info.end)
      };

      data.push(item);
      calendar.addEvent(item);
      saveEvents(data);
    },

    eventDrop(info) {
      const key = info.event.id || (info.event._def && info.event._def.publicId) || "";
      const item = data.find(x => x.id === key);
      if (!item) return;

      item.daysOfWeek = [dowFromDate(info.event.start)];
      item.startTime = timeFromDate(info.event.start);
      item.endTime = timeFromDate(info.event.end);
      item.droppedAt = currentDropStamp();

      info.event.setExtendedProp("droppedAt", item.droppedAt);

      saveEvents(data);
    },

    eventResize(info) {
      const key = info.event.id || (info.event._def && info.event._def.publicId) || "";
      const item = data.find(x => x.id === key);
      if (!item) return;

      item.endTime = timeFromDate(info.event.end);
      saveEvents(data);
    },

    eventDidMount(info) {
      const stripeColor = eventLockedColor(info.event);
      info.el.style.setProperty("--stripe-color", stripeColor);
      info.el.tabIndex = 0;

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

  function getViewportCalendarHeight(el) {
    if (!el) return 420;

    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const top = Math.max(rect.top, 0);
    const bottomSpacing = 8;
    const minHeight = 420;

    return Math.max(Math.floor(viewportHeight - top - bottomSpacing), minHeight);
  }

  function fitCalendarToViewport(currentCalendar) {
    if (!currentCalendar || !calendarEl) return;

    const nextHeight = getViewportCalendarHeight(calendarEl);
    calendarEl.style.height = `${nextHeight}px`;
    currentCalendar.setOption("height", nextHeight);
    currentCalendar.updateSize();
  }

  requestAnimationFrame(() => {
    fitCalendarToViewport(calendar);
  });

  window.addEventListener("load", () => {
    fitCalendarToViewport(calendar);
  });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      fitCalendarToViewport(calendar);
    });
  });

  syncEditButtonState();

  // DEL/BACKSPACE: öppna redigering för säker borttagning
  document.addEventListener("keydown", (e) => {
    if (!selectedEvent) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (window.scheduleEventModal && window.scheduleEventModal.isOpen()) return;

    e.preventDefault();
    openEventEditor(selectedEvent, selectedEl);

    if (window.scheduleEventModal && typeof window.scheduleEventModal.setStatus === "function") {
      window.scheduleEventModal.setStatus("Välj Ta bort i rutan om du vill ta bort aktiviteten.");
    }
  });

  // Klick utanför event: avmarkera
  document.addEventListener("click", (e) => {
    const clickedEvent = e.target.closest(".fc-event");
    const clickedControl = e.target.closest("button");
    if (!clickedEvent && !clickedControl) clearSelection();
  });

  document.getElementById("weekendClear").addEventListener("click", () => {
    const ok = confirm("Rensa schemat och börja från noll?");
    if (!ok) return;

    data = [];
    saveEvents(data);
    clearSelection();
    calendar.removeAllEvents();
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
});