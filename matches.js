document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "schema-matches-v2";
  const CAL_ID = "calendarMatches";

  const TEAMS = [
    "P12 9️⃣", "P13 9️⃣", "P14 7️⃣", "P15 7️⃣", "P16 7️⃣", "P-GUDH",
    "F12 9️⃣", "F13 9️⃣", "F14 7️⃣", "F15 7️⃣", "F16 7️⃣", "F-GUDH",
    "Tigerligan", "Torscupen", "Herrar A", "Herrar U", "Damer A", "Herrar Div 8"
  ];

  const defaultSchedules = {
    [CAL_ID]: []
  };

  const schedules = loadSchedules();

  let selectedEvent = null;
  let selectedCalendarId = null;
  let selectedKey = null;
  let selectedEl = null;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadSchedules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : clone(defaultSchedules);

      for (const key of Object.keys(defaultSchedules)) {
        if (!parsed[key]) parsed[key] = [];
      }

      return parsed;
    } catch {
      return clone(defaultSchedules);
    }
  }

  function saveSchedules() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function eventKey(ev) {
    return ev.id || (ev._def && ev._def.publicId) || "";
  }

  function colorFromTitle(title) {
    const ch = (title || "").trim().charAt(0).toUpperCase();

    if (["D", "H", "S", "G"].includes(ch)) return "#013888";
    if (ch === "P") return "#2F6FDB";
    if (ch === "F") return "#AD343E";
    if (ch === "M") return "#84E296";
    if (ch === "B") return "#6B7280";

    return "#6B7280";
  }

  function clearSelection() {
    if (selectedEl) {
      selectedEl.style.outline = "";
      selectedEl.style.outlineOffset = "";
    }

    selectedEvent = null;
    selectedCalendarId = null;
    selectedKey = null;
    selectedEl = null;
  }

  function setSelection(ev, calId, el) {
    if (selectedEl && selectedEl !== el) {
      selectedEl.style.outline = "";
      selectedEl.style.outlineOffset = "";
    }

    selectedEvent = ev;
    selectedCalendarId = calId;
    selectedKey = eventKey(ev);
    selectedEl = el;

    if (selectedEl) {
      selectedEl.style.outline = "2px solid #000000";
      selectedEl.style.outlineOffset = "1px";
    }
  }

  function editEventTitle(ev, calId, el) {
    const newTitle = prompt("Redigera lagnamn", ev.title);
    if (newTitle === null) return;

    ev.setProp("title", newTitle);

    const key = eventKey(ev);
    const item = schedules[calId].find((x) => x.id === key);
    if (item) item.title = newTitle;

    if (el) el.style.setProperty("--stripe-color", colorFromTitle(newTitle));

    saveSchedules();
  }

  function initTeamsPanel() {
    const teamsEl = document.getElementById("teams");
    if (!teamsEl) return;

    teamsEl.innerHTML = TEAMS.map((name) => `<div class="team-item">${name}</div>`).join("");

    if (!FullCalendar.Draggable) {
      console.warn("FullCalendar.Draggable saknas. Kontrollera att @fullcalendar/interaction är laddat.");
      return;
    }

    new FullCalendar.Draggable(teamsEl, {
      itemSelector: ".team-item",
      eventData: (el) => ({
        title: el.innerText.trim(),
        duration: "01:00"
      })
    });
  }

  function createCalendar(id) {
    const calendarEl = document.getElementById(id);
    if (!calendarEl) return null;

    const initialHeight = getViewportCalendarHeight(calendarEl);

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "timeGridWeek",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: ""
      },

      locale: "sv",
      firstDay: 1,
      weekNumbers: true,
      weekText: "Vecka",
      dayHeaderFormat: { weekday: "long", day: "numeric", month: "numeric" },

      allDaySlot: false,

      slotMinTime: "09:00:00",
      slotMaxTime: "21:30:00",
      slotDuration: "00:30:00",
      snapDuration: "00:30:00",

      height: initialHeight,
      expandRows: false,

      editable: true,
      selectable: true,
      selectMirror: true,
      slotEventOverlap: true,

      droppable: true,

      events: schedules[id],

      select(info) {
        const title = prompt("Lag namn");
        if (!title) return;

        const item = {
          id: makeId(id),
          title,
          start: info.start.toISOString(),
          end: info.end.toISOString()
        };

        schedules[id].push(item);
        calendar.addEvent(item);
        saveSchedules();
      },

      eventReceive(info) {
        const start = info.event.start;
        const end = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);

        const item = {
          id: makeId(id),
          title: info.event.title,
          start: start.toISOString(),
          end: end.toISOString()
        };

        schedules[id].push(item);
        saveSchedules();

        info.event.remove();
        calendar.addEvent(item);
      },

      eventDrop(info) {
        const key = eventKey(info.event);
        const item = schedules[id].find((x) => x.id === key);
        if (!item) return;

        item.start = info.event.start.toISOString();
        item.end = info.event.end.toISOString();

        saveSchedules();
      },

      eventResize(info) {
        const key = eventKey(info.event);
        const item = schedules[id].find((x) => x.id === key);
        if (!item) return;

        item.end = info.event.end.toISOString();
        saveSchedules();
      },

      eventDidMount(info) {
        info.el.style.setProperty("--stripe-color", colorFromTitle(info.event.title));

        const key = eventKey(info.event);
        if (selectedKey && selectedCalendarId === id && key === selectedKey) {
          setSelection(info.event, id, info.el);
        }

        if (!info.el.dataset.bound) {
          info.el.dataset.bound = "1";

          info.el.addEventListener("click", () => {
            setSelection(info.event, id, info.el);
          });

          info.el.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelection(info.event, id, info.el);
            editEventTitle(info.event, id, info.el);
          });
        }
      },

      eventContent(arg) {
        const start = arg.event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const end = arg.event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        return {
          html: `
            <div class="ev">
              <b class="ev-title">${arg.event.title}</b>
              <br>
              <span class="ev-time">${start}-${end}</span>
            </div>
          `
        };
      }
    });

    calendar.render();
    return calendar;
  }

  function getViewportCalendarHeight(calendarEl) {
    const rect = calendarEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const top = Math.max(rect.top, 0);
    const bottomSpacing = 16;
    const minHeight = 460;
    return Math.max(Math.floor(viewportHeight - top - bottomSpacing), minHeight);
  }

  function fitCalendarToViewport(calendar, id) {
    if (!calendar) return;

    const calendarEl = document.getElementById(id);
    if (!calendarEl) return;

    const nextHeight = getViewportCalendarHeight(calendarEl);

    calendarEl.style.height = `${nextHeight}px`;
    calendar.setOption("height", nextHeight);
    calendar.updateSize();
  }

  initTeamsPanel();

  const calendar = createCalendar(CAL_ID);
  requestAnimationFrame(() => {
    fitCalendarToViewport(calendar, CAL_ID);
  });

  window.addEventListener("load", () => {
    fitCalendarToViewport(calendar, CAL_ID);
  });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (!calendar) return;

    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      fitCalendarToViewport(calendar, CAL_ID);
    });
  });

  document.addEventListener("click", (e) => {
    const clickedEvent = e.target.closest(".fc-event");
    const clickedSidebar = e.target.closest("#teams");
    const clickedControl = e.target.closest("button");
    if (!clickedEvent && !clickedSidebar && !clickedControl) clearSelection();
  });

  document.addEventListener("keydown", (e) => {
    if (!selectedEvent || !selectedCalendarId) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;

    const key = eventKey(selectedEvent);
    const list = schedules[selectedCalendarId];
    const idx = list.findIndex((x) => x.id === key);
    if (idx !== -1) list.splice(idx, 1);

    selectedEvent.remove();
    clearSelection();
    saveSchedules();
  });

  const resetBtn = document.querySelector(`.reset-btn[data-cal="${CAL_ID}"]`);
  if (resetBtn && calendar) {
    resetBtn.addEventListener("click", () => {
      const ok = confirm("Återställa Matches till blankt?");
      if (!ok) return;

      schedules[CAL_ID] = [];
      saveSchedules();
      calendar.removeAllEvents();
      clearSelection();
    });
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function makeExportPayload() {
    return {
      app: "schema-matches",
      version: 2,
      exportedAt: new Date().toISOString(),
      schedules
    };
  }

  function normalizeImportedData(parsed) {
    let incoming = null;

    if (parsed && parsed.schedules && typeof parsed.schedules === "object") {
      incoming = parsed.schedules;
    } else if (parsed && typeof parsed === "object") {
      incoming = parsed;
    }

    if (!incoming) return null;

    const normalized = clone(defaultSchedules);

    for (const id of Object.keys(defaultSchedules)) {
      if (!Array.isArray(incoming[id])) continue;

      normalized[id] = incoming[id]
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          id: String(x.id || makeId(id)),
          title: String(x.title || ""),
          start: String(x.start || ""),
          end: String(x.end || "")
        }))
        .filter((x) => {
          if (!x.title || !x.start || !x.end) return false;
          const startDate = new Date(x.start);
          const endDate = new Date(x.end);
          return !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate > startDate;
        });
    }

    return normalized;
  }

  function applyImportedSchedules(newSchedules) {
    for (const id of Object.keys(defaultSchedules)) {
      schedules[id] = newSchedules[id] || [];
    }

    saveSchedules();
    clearSelection();

    if (calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(schedules[CAL_ID]);
      fitCalendarToViewport(calendar, CAL_ID);
    }
  }

  const exportJsonBtn = document.getElementById("exportJson");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      const payload = makeExportPayload();
      const niceDate = new Date().toISOString().slice(0, 10);
      downloadTextFile(`matches-backup-${niceDate}.json`, JSON.stringify(payload, null, 2));
    });
  }

  const importJsonInput = document.getElementById("importJson");
  if (importJsonInput) {
    importJsonInput.addEventListener("change", async () => {
      const file = importJsonInput.files && importJsonInput.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const normalized = normalizeImportedData(parsed);

        if (!normalized) {
          alert("Fel format i JSON-filen.");
          importJsonInput.value = "";
          return;
        }

        const ok = confirm("Importera JSON och ersätta nuvarande matches-schema?");
        if (!ok) {
          importJsonInput.value = "";
          return;
        }

        applyImportedSchedules(normalized);
        alert("Import klar.");
      } catch {
        alert("Kunde inte läsa JSON-filen.");
      } finally {
        importJsonInput.value = "";
      }
    });
  }
});
