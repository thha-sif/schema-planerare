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

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toDateTimeLocalValue(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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

  function colorFromFacility(facility) {
    const value = String(facility || "").trim();

    if (value === "Skönviks IP") {
      return {
        bg: "#f0e6cd"
      };
    }

    if (value === "Säters IP A-plan") {
      return {
        bg: "#e2f0e3"
      };
    }

    return null;
  }

  function backgroundFromEvent(ev) {
    if (!ev) return "";

    if (ev.extendedProps && ev.extendedProps.noFixedTime) {
      return "#FEE2E2";
    }

    const facilityColors = colorFromFacility(ev.extendedProps && ev.extendedProps.facility);
    return facilityColors ? facilityColors.bg : "";
  }

  function normalizeFacilityChoice(value) {
    const raw = String(value || "").trim().toLowerCase();

    if (!raw || raw === "0" || raw === "null" || raw === "ingen" || raw === "none") return "";
    if (raw === "1" || raw === "skönviks ip") return "Skönviks IP";
    if (raw === "2" || raw === "säters ip a-plan") return "Säters IP A-plan";

    return null;
  }

  function facilityPromptDefaultValue(facility) {
    if (facility === "Skönviks IP") return "1";
    if (facility === "Säters IP A-plan") return "2";
    return "0";
  }

  function applyEventColors(ev, el) {
    if (!el || !ev) return;

    el.style.setProperty("--stripe-color", colorFromTitle(ev.title));

    const bgColor = backgroundFromEvent(ev);
    if (bgColor) {
      el.style.setProperty("background-color", bgColor, "important");
    } else {
      el.style.removeProperty("background-color");
    }
  }

  function syncEditButtonState() {
    // Matches no longer shows a separate edit toolbar button.
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
    const item = schedules[calId].find((x) => x.id === key);
    if (!item) return;

    const modal = window.scheduleEventModal;
    if (!modal || typeof modal.open !== "function") {
      const newTitle = prompt("Redigera lagnamn", ev.title);
      if (newTitle === null) return;

      ev.setProp("title", newTitle);
      item.title = newTitle;
      applyEventColors(ev, el);
      saveSchedules();
      return;
    }

    setSelection(ev, calId, el || selectedEl);

    modal.open({
      dialogTitle: "Redigera match",
      showFields: {
        title: true,
        startDateTime: true,
        endDateTime: true,
        facility: true
      },
      values: {
        title: item.title,
        startDateTime: toDateTimeLocalValue(item.start),
        endDateTime: toDateTimeLocalValue(item.end),
        facility: item.facility || ""
      },
      statusText: "Uppdatera namn, tid och anläggning för den markerade matchen.",
      onSave(nextValues) {
        if (!nextValues.title) {
          modal.setStatus("Namn måste fyllas i.");
          return false;
        }

        const nextStart = new Date(nextValues.startDateTime);
        const nextEnd = new Date(nextValues.endDateTime);

        if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
          modal.setStatus("Start och slut måste fyllas i.");
          return false;
        }

        if (nextEnd <= nextStart) {
          modal.setStatus("Sluttiden måste vara senare än starttiden.");
          return false;
        }

        ev.setProp("title", nextValues.title);
        ev.setStart(nextStart);
        ev.setEnd(nextEnd);
        ev.setExtendedProp("facility", nextValues.facility || "");

        item.title = nextValues.title;
        item.start = nextStart.toISOString();
        item.end = nextEnd.toISOString();
        item.facility = nextValues.facility || "";

        applyEventColors(ev, el || selectedEl);
        saveSchedules();
      },
      onDelete() {
        const idx = schedules[calId].findIndex((x) => x.id === key);
        if (idx !== -1) {
          schedules[calId].splice(idx, 1);
        }

        ev.remove();
        clearSelection();
        saveSchedules();
      }
    });
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

      slotMinTime: "08:00:00",
      slotMaxTime: "21:30:00",
      slotDuration: "00:30:00",
      snapDuration: "00:30:00",

      height: initialHeight,
      expandRows: true,

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
        item.noFixedTime = false;

        info.event.setExtendedProp("noFixedTime", false);
        applyEventColors(info.event, info.el);

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
        applyEventColors(info.event, info.el);
        info.el.tabIndex = 0;

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
        const titleHtml = String(arg.event.title || "")
          .split(" - ")
          .map((part) => part.trim())
          .join("<br>");

        return {
          html: `
            <div class="ev">
              <b class="ev-title">${titleHtml}</b>
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
    const extraTrim = 110;
    const minHeight = 380;
    return Math.max(Math.floor(viewportHeight - top - bottomSpacing - extraTrim), minHeight);
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

  syncEditButtonState();

  document.addEventListener("keydown", (e) => {
    if (!selectedEvent || !selectedCalendarId) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (window.scheduleEventModal && window.scheduleEventModal.isOpen()) return;

    e.preventDefault();
    editEventTitle(selectedEvent, selectedCalendarId, selectedEl);

    if (window.scheduleEventModal && typeof window.scheduleEventModal.setStatus === "function") {
      window.scheduleEventModal.setStatus("Välj Ta bort i rutan om du vill ta bort matchen.");
    }
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

  function normalizeHeaderName(value) {
    return String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase();
  }

  function detectCsvDelimiter(text) {
    const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
    const candidates = [";", ",", "\t"];

    let winner = ";";
    let bestCount = -1;
    for (const delim of candidates) {
      const count = firstLine.split(delim).length;
      if (count > bestCount) {
        bestCount = count;
        winner = delim;
      }
    }

    return winner;
  }

  function splitCsvLine(line, delimiter) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur.trim());
    return out;
  }

  function parseCsvRows(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (!lines.length) {
      return { rows: [], missingColumns: [] };
    }

    const delimiter = detectCsvDelimiter(lines.join("\n"));
    const headerCells = splitCsvLine(lines[0], delimiter).map((h) => normalizeHeaderName(h));

    const requiredColumns = ["matchnr", "tävling", "hemmalag", "bortalag", "datum / tid", "anläggning"];
    const missingColumns = requiredColumns.filter((key) => !headerCells.includes(key));

    if (missingColumns.length) {
      return { rows: [], missingColumns };
    }

    const rows = [];

    for (let i = 1; i < lines.length; i += 1) {
      const cells = splitCsvLine(lines[i], delimiter);
      const row = {};

      for (let c = 0; c < headerCells.length; c += 1) {
        const key = headerCells[c];
        if (!key) continue;
        row[key] = (cells[c] || "").trim();
      }

      rows.push(row);
    }

    return { rows, missingColumns: [] };
  }

  function parseDateTimeValue(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return null;

    const noFixedTime = /(Tid\s+ej\s+fastställd)/i.test(value);
    const defaultTime = "20:00";

    const explicitMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (explicitMatch) {
      const [, y, m, d, hh, mm] = explicitMatch;
      const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0, 0);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (noFixedTime) {
      const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dateOnlyMatch) return null;

      const [, y, m, d] = dateOnlyMatch;
      const [hh, mm] = defaultTime.split(":").map(Number);
      const date = new Date(Number(y), Number(m) - 1, Number(d), hh, mm, 0, 0);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  function durationMinutesFromCompetition(competition) {
    return /7️⃣/i.test(String(competition || "")) ? 90 : 120;
  }

  function normalizeCsvToSchedules(rows) {
    const normalized = clone(defaultSchedules);
    let skippedRows = 0;

    normalized[CAL_ID] = rows
      .map((row) => {
        let competition = String(row["tävling"] || "").trim();
        competition = competition
          .replace(/Flickor/g, "F")
          .replace(/Pojkar/g, "P")
          .replace(/Division/g, "Div")
          .replace(/7-m/g, "7️⃣")
          .replace(/9-m/g, "9️⃣")
          .replace(/Grp./g, "G");
        let homeTeam = String(row["hemmalag"] || "").trim();
        homeTeam = homeTeam
          .replace(/s IF FK/g, "");
        let awayTeam = String(row["bortalag"] || "").trim();
        awayTeam = awayTeam
          .replace(/IFK /g, "")
          .replace(/IF /g, "")
          .slice(0, 8).trim();
        const facility = String(row["anläggning"] || "").trim();
        const dateTimeRaw = String(row["datum / tid"] || "").trim();
        const noFixedTime = /(Tid\s+ej\s+fastställd)/i.test(dateTimeRaw);

        if (!homeTeam || !awayTeam || !facility || !dateTimeRaw) {
          skippedRows += 1;
          return null;
        }

        if (!homeTeam.startsWith("Säter")) {
          skippedRows += 1;
          return null;
        }

        const startDate = parseDateTimeValue(dateTimeRaw);
        if (!startDate) {
          skippedRows += 1;
          return null;
        }

        const durationMinutes = durationMinutesFromCompetition(competition);
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

        return {
          id: makeId(CAL_ID),
          title: `${competition} - ${homeTeam} - ${awayTeam}`,
          facility,
          noFixedTime,
          start: startDate.toISOString(),
          end: endDate.toISOString()
        };
      })
      .filter(Boolean);

    return { normalized, skippedRows };
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
          facility: String(x.facility || ""),
          noFixedTime: Boolean(x.noFixedTime),
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

  const importCsvInput = document.getElementById("importCsv");
  if (importCsvInput) {
    importCsvInput.addEventListener("change", async () => {
      const file = importCsvInput.files && importCsvInput.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const { rows, missingColumns } = parseCsvRows(text);

        if (missingColumns.length) {
          alert(`CSV saknar obligatoriska kolumner: ${missingColumns.join(", ")}`);
          importCsvInput.value = "";
          return;
        }

        const { normalized, skippedRows } = normalizeCsvToSchedules(rows);
        const validCount = normalized[CAL_ID].length;

        if (!validCount) {
          alert("Inga giltiga rader hittades i CSV-filen.");
          importCsvInput.value = "";
          return;
        }

        const confirmText = skippedRows
          ? `Importera ${validCount} matcher och ersätta nuvarande schema? ${skippedRows} rader hoppades över.`
          : `Importera ${validCount} matcher och ersätta nuvarande schema?`;

        const ok = confirm(confirmText);
        if (!ok) {
          importCsvInput.value = "";
          return;
        }

        applyImportedSchedules(normalized);

        const successText = skippedRows
          ? `Import klar. ${validCount} matcher importerades och ${skippedRows} rader hoppades över.`
          : `Import klar. ${validCount} matcher importerades.`;
        alert(successText);
      } catch {
        alert("Kunde inte läsa CSV-filen.");
      } finally {
        importCsvInput.value = "";
      }
    });
  }
});
