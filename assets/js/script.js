document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "schema-planerare-v1";

  const TEAMS = [
    "P12 9️⃣", "P13 9️⃣", "P14 7️⃣", "P15 7️⃣", "P16 7️⃣", "P17 5️⃣", "P18 5️⃣", "P19 3️⃣", "P-GUDH", "PF20 3️⃣", "PF21",
    "Herrar A", "Herrar U", "Herrar Div 8", "Gåfotboll", "Stjärnlaget",
    "F12 9️⃣", "F13 9️⃣", "F14 7️⃣", "F15 7️⃣", "F16 7️⃣", "F17 5️⃣", "F18 5️⃣", "F19 3️⃣", "F-GUDH", "Damer A", "Match"
  ];

  const CAL_IDS = ["calendarA", "calendarB", "calendarS", "calendarF"];

  // Export-filnamn exakt som du vill
  const EXPORT_NAMES = {
    calendarA: "A-plan",
    calendarB: "B-plan",
    calendarS: "Skönvik",
    calendarF: "Försäsong A-plan"
  };

  const defaultSchedules = {
    calendarA: [],
    calendarB: [],
    calendarS: [],
    calendarF: []
  };

  const schedules = loadSchedules();
  const calendars = {};
  const history = createHistoryManager();
  const eventElements = new Map();

  // Markering för DEL
  let selectedEvent = null;
  let selectedCalendarId = null;
  let selectedKey = null;
  let selectedEl = null;

  // ----------------- Storage -----------------
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadSchedules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : clone(defaultSchedules);

      // säkerställ keys
      for (const k of Object.keys(defaultSchedules)) {
        if (!parsed[k]) parsed[k] = [];
      }
      return parsed;
    } catch {
      return clone(defaultSchedules);
    }
  }

  function saveSchedules() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  }

  function snapshotSchedules() {
    return clone(schedules);
  }

  function applySchedulesState(nextState) {
    for (const id of Object.keys(defaultSchedules)) {
      schedules[id] = Array.isArray(nextState && nextState[id]) ? clone(nextState[id]) : [];
    }

    saveSchedules();
    clearSelection();

    for (const id of Object.keys(calendars)) {
      calendars[id].removeAllEvents();
      calendars[id].addEventSource(schedules[id]);
    }
  }

  function createHistoryManager() {
    if (!window.scheduleHistory || typeof window.scheduleHistory.createManager !== "function") return null;

    return window.scheduleHistory.createManager({
      applyState: applySchedulesState,
      onStateChange(state) {
        document.dispatchEvent(new CustomEvent("schedule:history-state", { detail: state }));
      }
    });
  }

  function recordHistory(beforeState) {
    if (!history) return;
    history.record(beforeState, snapshotSchedules());
  }

  // ----------------- Helpers -----------------
  function pad2(n) { return String(n).padStart(2, "0"); }
  function timeFromDate(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  function dowFromDate(d) { return d.getDay(); } // 0=sön..6=lör
  function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

  // Robust event-id (fixar recurring/panel/efter F5)
  function eventKey(ev) {
    return ev.id || (ev._def && ev._def.publicId) || "";
  }

  function colorFromTitle(title) {
    const ch = (title || "").trim().charAt(0).toUpperCase();

    // Senior: D/H/S/G
    if (["D", "H", "S", "G"].includes(ch)) return "#013888";
    // Pojkar
    if (ch === "P") return "#2F6FDB";
    // Flickor
    if (ch === "F") return "#AD343E";
    // Match
    if (ch === "M") return "#84E296";
    // Övrigt
    if (ch === "B") return "#6B7280";

    return "#6B7280";
  }

  function normalizeSearchText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function scoreTrainingSearch(title, needle) {
    const haystack = normalizeSearchText(title);
    if (!haystack || !needle) return -1;
    if (haystack === needle) return 400;
    if (haystack.startsWith(needle)) return 300;
    const wordIndex = haystack.indexOf(` ${needle}`);
    if (wordIndex !== -1) return 220 - wordIndex;
    const containsIndex = haystack.indexOf(needle);
    if (containsIndex !== -1) return 120 - containsIndex;
    return -1;
  }

  function focusSearchResult(resultId) {
    const [calId, eventId] = String(resultId || "").split("::");
    if (!calId || !eventId || !calendars[calId]) return false;

    const event = calendars[calId].getEventById(eventId);
    const eventEl = eventElements.get(resultId);
    const wrapper = document.getElementById(`export-${calId}`);

    if (wrapper) {
      wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (!event || !eventEl) return false;

    setSelection(event, calId, eventEl);
    eventEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    eventEl.focus({ preventScroll: true });
    return true;
  }

  function editSearchResult(resultId) {
    const [calId, eventId] = String(resultId || "").split("::");
    if (!calId || !eventId || !calendars[calId]) return false;

    const event = calendars[calId].getEventById(eventId);
    const eventEl = eventElements.get(resultId);
    if (!event || !eventEl) return false;

    setSelection(event, calId, eventEl);
    editEventTitle(event, calId, eventEl);
    return true;
  }

  function syncEditButtonState() {
    // Training page no longer shows a separate edit toolbar button.
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
    syncEditButtonState();
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

    syncEditButtonState();
  }

  function editEventTitle(ev, calId, el) {
    if (!ev || !calId) return;

    const key = eventKey(ev);
    const item = schedules[calId].find(x => x.id === key);
    if (!item) return;

    const modal = window.scheduleEventModal;
    if (!modal || typeof modal.open !== "function") {
      const newTitle = prompt("Redigera lagnamn", ev.title);
      if (newTitle === null) return;

      ev.setProp("title", newTitle);
      item.title = newTitle;

      if (el) el.style.setProperty("--stripe-color", colorFromTitle(newTitle));
      saveSchedules();
      return;
    }

    setSelection(ev, calId, el || selectedEl);

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
      statusText: "Uppdatera namn och tider för den markerade aktiviteten.",
      onSave(nextValues) {
        const beforeState = snapshotSchedules();
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

        saveSchedules();
        clearSelection();
        calendars[calId].removeAllEvents();
        calendars[calId].addEventSource(schedules[calId]);
        recordHistory(beforeState);
      },
      onDelete() {
        const beforeState = snapshotSchedules();
        const idx = schedules[calId].findIndex(x => x.id === key);
        if (idx !== -1) {
          schedules[calId].splice(idx, 1);
        }

        saveSchedules();
        clearSelection();
        calendars[calId].removeAllEvents();
        calendars[calId].addEventSource(schedules[calId]);
        recordHistory(beforeState);
      }
    });
  }

  // ----------------- Lagpanel (external drag) -----------------
  initTeamsPanel();

  function initTeamsPanel() {
    const teamsEl = document.getElementById("teams");
    if (!teamsEl) return;

    const paletteRoot = teamsEl.closest(".team-palette");
    const twoColumnThreshold = 16;

    if (TEAMS.length > twoColumnThreshold) {
      teamsEl.classList.add("teams-list--two-column");
      if (paletteRoot) paletteRoot.classList.add("team-palette--wide");

      const firstColumn = TEAMS.slice(0, twoColumnThreshold)
        .map((name) => `<div class="team-item">${name}</div>`)
        .join("");
      const secondColumn = TEAMS.slice(twoColumnThreshold)
        .map((name) => `<div class="team-item">${name}</div>`)
        .join("");

      teamsEl.innerHTML = `
        <div class="teams-list__col">${firstColumn}</div>
        <div class="teams-list__col">${secondColumn}</div>
      `;
    } else {
      teamsEl.classList.remove("teams-list--two-column");
      if (paletteRoot) paletteRoot.classList.remove("team-palette--wide");
      teamsEl.innerHTML = TEAMS.map(name => `<div class="team-item">${name}</div>`).join("");
    }

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

  // ----------------- Kalender-fabrik -----------------
  function createCalendar(id) {
    const calendarEl = document.getElementById(id);
    if (!calendarEl) return null;

    const isPlanS = (id === "calendarS");
    const minTime = isPlanS ? "09:30:00" : "10:00:00";
    const maxTime = isPlanS ? "19:00:00" : "21:30:00";

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "timeGridWeek",
      headerToolbar: false,

      locale: "sv",
      firstDay: 1,
      dayHeaderFormat: { weekday: "long" },

      allDaySlot: false,

      slotMinTime: minTime,
      slotMaxTime: maxTime,
      slotDuration: "00:15:00",
      snapDuration: "00:15:00",

      height: "100%",
      expandRows: true,

      editable: true,
      selectable: true,
      selectMirror: true,
      slotEventOverlap: true,

      droppable: true,

      events: schedules[id],

      // Skapa via markering
      select(info) {
        const initialStartTime = timeFromDate(info.start);
        const initialEndTime = timeFromDate(info.end);
        const modal = window.scheduleEventModal;

        if (!modal || typeof modal.open !== "function") {
          const title = prompt("Lag namn");
          if (!title) return;

          const item = {
            id: makeId(id),
            title,
            daysOfWeek: [dowFromDate(info.start)],
            startTime: initialStartTime,
            endTime: initialEndTime
          };

          schedules[id].push(item);
          calendar.addEvent(item);
          saveSchedules();
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
            const beforeState = snapshotSchedules();
            if (!nextValues.title) {
              modal.setStatus("Namn måste fyllas i.");
              return false;
            }

            if (!nextValues.startTime || !nextValues.endTime || nextValues.endTime <= nextValues.startTime) {
              modal.setStatus("Sluttiden måste vara senare än starttiden.");
              return false;
            }

            const item = {
              id: makeId(id),
              title: nextValues.title,
              daysOfWeek: [dowFromDate(info.start)],
              startTime: nextValues.startTime,
              endTime: nextValues.endTime
            };

            schedules[id].push(item);
            calendar.addEvent(item);
            saveSchedules();
            recordHistory(beforeState);
          }
        });
      },

      // Drop från panel -> konvertera till veckomall
      eventReceive(info) {
        const beforeState = snapshotSchedules();
        const start = info.event.start;
        const end = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);

        const item = {
          id: makeId(id),
          title: info.event.title,
          daysOfWeek: [dowFromDate(start)],
          startTime: timeFromDate(start),
          endTime: timeFromDate(end)
        };

        schedules[id].push(item);
        saveSchedules();

        info.event.remove();
        calendar.addEvent(item);
        recordHistory(beforeState);
      },

      // Flytt
      eventDrop(info) {
        const beforeState = snapshotSchedules();
        const key = eventKey(info.event);
        const item = schedules[id].find(x => x.id === key);
        if (!item) return;

        item.daysOfWeek = [dowFromDate(info.event.start)];
        item.startTime = timeFromDate(info.event.start);
        item.endTime = timeFromDate(info.event.end);

        saveSchedules();
        recordHistory(beforeState);
      },

      // Ändra längd
      eventResize(info) {
        const beforeState = snapshotSchedules();
        const key = eventKey(info.event);
        const item = schedules[id].find(x => x.id === key);
        if (!item) return;

        item.endTime = timeFromDate(info.event.end);
        saveSchedules();
        recordHistory(beforeState);
      },

      // Stripe + click/dblclick
      eventDidMount(info) {
        // stripe-color
        info.el.style.setProperty("--stripe-color", colorFromTitle(info.event.title));
        info.el.tabIndex = 0;

        // återmarkera efter rerender
        const k = eventKey(info.event);
        eventElements.set(`${id}::${k}`, info.el);
        if (selectedKey && selectedCalendarId === id && k === selectedKey) {
          setSelection(info.event, id, info.el);
        }

        // bind bara en gång per element
        if (!info.el.dataset.bound) {
          info.el.dataset.bound = "1";

          // enkelklick = markera
          info.el.addEventListener("click", () => {
            setSelection(info.event, id, info.el);
          });

          // dubbelklick = redigera
          info.el.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelection(info.event, id, info.el);
            editEventTitle(info.event, id, info.el);
          });

          // högerklick = liten meny med Redigera
          info.el.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelection(info.event, id, info.el);

            const contextMenu = window.scheduleEventContextMenu;
            if (contextMenu && typeof contextMenu.show === "function") {
              contextMenu.show({
                x: e.clientX,
                y: e.clientY,
                onEdit: () => editEventTitle(info.event, id, info.el)
              });
              return;
            }

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
              <span class="ev-time">${start} - ${end}</span>
            </div>
          `
        };
      }
    });

    calendar.render();
    return calendar;
  }

  // Init alla kalendrar som finns i DOM
  for (const id of CAL_IDS) {
    const cal = createCalendar(id);
    if (cal) calendars[id] = cal;
  }

  // ----------------- Plan switcher -----------------
  initPlanSwitcher();

  function initPlanSwitcher() {
    const PLAN_KEY = "schema-active-plan";

    function getActivePlanId() {
      for (const pid of CAL_IDS) {
        const wrapper = document.getElementById(`export-${pid}`);
        if (wrapper && !wrapper.hidden) return pid;
      }
      return CAL_IDS[0];
    }

    function refreshPlanLayout(planId) {
      const id = CAL_IDS.includes(planId) ? planId : CAL_IDS[0];
      const calendar = calendars[id];
      if (!calendar) return;

      // Hidden->visible transitions need an explicit reflow in FullCalendar.
      requestAnimationFrame(() => {
        calendar.updateSize();
        requestAnimationFrame(() => {
          calendar.updateSize();
        });
      });
    }

    function showPlan(planId) {
      const id = CAL_IDS.includes(planId) ? planId : CAL_IDS[0];
      CAL_IDS.forEach((pid) => {
        const wrapper = document.getElementById(`export-${pid}`);
        if (wrapper) wrapper.hidden = (pid !== id);
      });

      const activeWrapper = document.getElementById(`export-${id}`);
      if (activeWrapper) {
        const headingText = EXPORT_NAMES[id] || id;
        let heading = activeWrapper.querySelector("h1");
        if (!heading) {
          heading = document.createElement("h1");
          activeWrapper.prepend(heading);
        }
        heading.textContent = headingText;
        heading.hidden = false;
      }

      document.querySelectorAll("[data-plan-id]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.planId === id);
      });
      try { localStorage.setItem(PLAN_KEY, id); } catch {}
      refreshPlanLayout(id);
    }

    let saved = "calendarA";
    try { saved = localStorage.getItem(PLAN_KEY) || "calendarA"; } catch {}
    showPlan(saved);

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-plan-id]");
      if (!btn) return;
      showPlan(btn.dataset.planId);
    });

    window.addEventListener("resize", () => {
      refreshPlanLayout(getActivePlanId());
    });

    window.addEventListener("pageshow", () => {
      refreshPlanLayout(getActivePlanId());
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      refreshPlanLayout(getActivePlanId());
    });
  }

  // Klick utanför events/panel/knappar = avmarkera
  document.addEventListener("click", (e) => {
    const clickedEvent = e.target.closest(".fc-event");
    const clickedSidebar = e.target.closest("#teams");
    const clickedControl = e.target.closest("button");
    if (!clickedEvent && !clickedSidebar && !clickedControl) clearSelection();
  });

  syncEditButtonState();

  // ----------------- DEL / BACKSPACE -----------------
  document.addEventListener("keydown", (e) => {
    if (!selectedEvent || !selectedCalendarId) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (window.scheduleEventModal && window.scheduleEventModal.isOpen()) return;

    e.preventDefault();

    const contextMenu = window.scheduleEventContextMenu;
    if (contextMenu && typeof contextMenu.confirmDelete === "function") {
      const calId = selectedCalendarId;
      const key = eventKey(selectedEvent);
      const el = selectedEl;
      contextMenu.confirmDelete({
        targetEl: el,
        onConfirm() {
          const beforeState = snapshotSchedules();
          const idx = schedules[calId].findIndex(x => x.id === key);
          if (idx !== -1) schedules[calId].splice(idx, 1);
          saveSchedules();
          clearSelection();
          calendars[calId].removeAllEvents();
          calendars[calId].addEventSource(schedules[calId]);
          recordHistory(beforeState);
        }
      });
    } else {
      editEventTitle(selectedEvent, selectedCalendarId, selectedEl);
    }
  });

  // ----------------- Reset buttons -----------------
  document.querySelectorAll(".reset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const beforeState = snapshotSchedules();
      const calId = btn.dataset.cal;
      if (!calId || !calendars[calId]) return;

      const skipConfirm = btn.dataset.resetConfirmed === "true";
      btn.dataset.resetConfirmed = "false";

      const ok = skipConfirm ? true : confirm(`Återställa ${EXPORT_NAMES[calId] || calId} till blankt?`);
      if (!ok) return;

      schedules[calId] = [];
      saveSchedules();

      calendars[calId].removeAllEvents();

      if (selectedCalendarId === calId) clearSelection();
      recordHistory(beforeState);
    });
  });

  // ----------------- Kopiera plan -----------------
  function clonePlanEvents(fromId, toId) {
    const beforeState = snapshotSchedules();
    schedules[toId] = schedules[fromId].map(ev => ({
      id: makeId(toId),
      title: ev.title,
      daysOfWeek: Array.isArray(ev.daysOfWeek) ? [...ev.daysOfWeek] : ev.daysOfWeek,
      startTime: ev.startTime,
      endTime: ev.endTime
    }));

    saveSchedules();

    calendars[toId].removeAllEvents();
    calendars[toId].addEventSource(schedules[toId]);

    if (selectedCalendarId === toId) clearSelection();
    recordHistory(beforeState);
  }

  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const toId = btn.dataset.cal;
      if (!toId || !calendars[toId]) return;

      const options = CAL_IDS
        .filter(x => x !== toId && calendars[x])
        .map(x => EXPORT_NAMES[x] || x)
        .join(", ");

      const fromName = prompt(`Kopiera FRÅN vilken plan?\n${options}`);
      if (!fromName) return;

      // matcha på export-namn eller id
      const fromId = CAL_IDS.find(id =>
        (EXPORT_NAMES[id] || "").toLowerCase() === fromName.trim().toLowerCase() ||
        id.toLowerCase() === fromName.trim().toLowerCase()
      );

      if (!fromId || !calendars[fromId] || fromId === toId) return;

      const ok = confirm(`Kopiera "${EXPORT_NAMES[fromId]}" → "${EXPORT_NAMES[toId]}"?\nDetta skriver över nuvarande schema i "${EXPORT_NAMES[toId]}".`);
      if (!ok) return;

      clonePlanEvents(fromId, toId);
    });
  });

  // ----------------- Export (PNG + PDF) -----------------
  function safeFilename(name) {
    // behåll åäö, men ta bort tecken som kan ställa till det i filnamn
    return (name || "").replace(/[\\/:*?"<>|]/g, "-").trim();
  }

  function waitForRender() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function captureElementAsCanvas(el) {
    await waitForRender();

    return html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY
    });
  }

  async function capturePlanCanvas(calId) {
    const wrapper = document.getElementById(`export-${calId}`);
    if (!wrapper) return null;

    const previousVisibility = CAL_IDS.map((pid) => {
      const el = document.getElementById(`export-${pid}`);
      return { pid, el, hidden: el ? el.hidden : true };
    });

    try {
      previousVisibility.forEach(({ pid, el }) => {
        if (el) el.hidden = (pid !== calId);
      });

      if (calendars[calId]) calendars[calId].updateSize();
      await waitForRender();
      if (calendars[calId]) calendars[calId].updateSize();

      return await captureElementAsCanvas(wrapper);
    } finally {
      previousVisibility.forEach(({ el, hidden }) => {
        if (el) el.hidden = hidden;
      });

      const activePlan = previousVisibility.find((entry) => entry.el && !entry.hidden);
      if (activePlan && calendars[activePlan.pid]) {
        calendars[activePlan.pid].updateSize();
      }
    }
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function exportPlanPng(calId) {
    const canvas = await capturePlanCanvas(calId);
    if (!canvas || !canvas.width || !canvas.height) {
      alert("Kunde inte exportera planen som PNG.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png", 1.0);
    const niceName = EXPORT_NAMES[calId] || calId;
    downloadDataUrl(dataUrl, `${safeFilename(niceName)}.png`);
  }

  async function exportAllPdf() {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("jsPDF-biblioteket är inte laddat. Försök igen senare.");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const order = CAL_IDS.filter((id) => document.getElementById(`export-${id}`));
      if (order.length === 0) {
        alert("Inga planer att exportera.");
        return;
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let addedPages = 0;

      for (const calId of order) {
        try {
          const canvas = await capturePlanCanvas(calId);
          if (!canvas || !canvas.width || !canvas.height) {
            console.warn(`Tom exportyta för ${calId}`);
            continue;
          }

          const imgData = canvas.toDataURL("image/png", 1.0);
          const maxWidth = pageWidth - (margin * 2);
          const maxHeight = pageHeight - (margin * 2);
          const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
          const imgWidth = canvas.width * ratio;
          const imgHeight = canvas.height * ratio;
          const x = (pageWidth - imgWidth) / 2;
          const y = (pageHeight - imgHeight) / 2;

          if (addedPages > 0) doc.addPage();
          doc.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
          addedPages += 1;
        } catch (err) {
          console.error(`Fel vid export av ${calId}:`, err);
        }
      }

      if (addedPages === 0) {
        alert("Kunde inte exportera några scheman till PDF.");
        return;
      }

      doc.save("Alla scheman.pdf");
    } catch (err) {
      console.error("Fel vid PDF-export:", err);
      alert("Kunde inte exportera PDF. Se konsolen för detaljer.");
    }
  }

  // PNG per plan
  document.querySelectorAll(".export-png").forEach(btn => {
    btn.addEventListener("click", async () => {
      const calId = btn.dataset.cal;
      if (!calId) return;
      await exportPlanPng(calId);
    });
  });

  // PDF alla
  const pdfBtn = document.getElementById("exportAllPdf");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      await exportAllPdf();
    });
  }

  // ----------------- JSON Export/Import -----------------
function safeFilename(name) {
  return (name || "").replace(/[\\/:*?"<>|]/g, "-").trim();
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
    app: "schema-planerare",
    version: 1,
    exportedAt: new Date().toISOString(),
    schedules: schedules
  };
}

function normalizeImportedData(parsed) {
  // tillåt både "payload" och "direkt schedules-objekt"
  let incoming = null;

  if (parsed && parsed.schedules && typeof parsed.schedules === "object") {
    incoming = parsed.schedules;
  } else if (parsed && typeof parsed === "object") {
    incoming = parsed; // om filen råkar vara direkt {calendarA:[...], ...}
  }

  if (!incoming) return null;

  // bygg nytt objekt med rätt keys
  const normalized = clone(defaultSchedules);

  for (const id of Object.keys(defaultSchedules)) {
    if (Array.isArray(incoming[id])) {
      normalized[id] = incoming[id]
        .filter(x => x && typeof x === "object")
        .map(x => ({
          id: String(x.id || ""),                    // behåll id om finns
          title: String(x.title || ""),
          daysOfWeek: Array.isArray(x.daysOfWeek) ? x.daysOfWeek.map(n => Number(n)) : [],
          startTime: String(x.startTime || ""),
          endTime: String(x.endTime || "")
        }))
        // släng trasiga rader
        .filter(x => x.title && x.daysOfWeek.length && x.startTime && x.endTime);
    }
  }

  return normalized;
}

function applyImportedSchedules(newSchedules) {
  const beforeState = snapshotSchedules();
  // ersätt i minnet
  for (const id of Object.keys(defaultSchedules)) {
    schedules[id] = newSchedules[id] || [];
  }

  saveSchedules();
  clearSelection();

  // re-render alla kalendrar
  for (const id of Object.keys(calendars)) {
    calendars[id].removeAllEvents();
    calendars[id].addEventSource(schedules[id]);
  }

  recordHistory(beforeState);
}

// Export-knapp
const exportJsonBtn = document.getElementById("exportJson");
if (exportJsonBtn) {
  exportJsonBtn.addEventListener("click", () => {
    const payload = makeExportPayload();
    const niceDate = new Date().toISOString().slice(0, 10);
    downloadTextFile(`schema-backup-${niceDate}.json`, JSON.stringify(payload, null, 2));
  });
}

// Import-input
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

      const ok = confirm("Importera JSON och ersätta nuvarande scheman?");
      if (!ok) {
        importJsonInput.value = "";
        return;
      }

      applyImportedSchedules(normalized);
      alert("Import klar.");
    } catch (e) {
      alert("Kunde inte läsa JSON-filen.");
    } finally {
      importJsonInput.value = "";
    }
  });
}

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
  placeholder: "Sök lag eller aktivitet",
  search(query) {
    const needle = normalizeSearchText(query);
    if (!needle) return [];

    return CAL_IDS.flatMap((calId) => {
      return (schedules[calId] || [])
        .map((item) => ({
          item,
          score: scoreTrainingSearch(item.title, needle)
        }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => right.score - left.score || String(left.item.title || "").localeCompare(String(right.item.title || ""), "sv"))
        .map(({ item }) => ({
          id: `${calId}::${item.id}`,
          title: item.title || "Aktivitet",
          subtitle: `${EXPORT_NAMES[calId]} · ${item.startTime || ""}-${item.endTime || ""}`,
          groupLabel: EXPORT_NAMES[calId],
          canEdit: true
        }));
    });
  },
  focusResult(resultId) {
    return focusSearchResult(resultId);
  },
  editResult(resultId) {
    return editSearchResult(resultId);
  }
};


});