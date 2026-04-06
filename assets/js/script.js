document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "schema-planerare-v1";

  const TEAMS = [
    "P12 9️⃣", "P13 9️⃣", "P14 7️⃣", "P15 7️⃣", "P16 7️⃣", "P17 5️⃣", "P18 5️⃣", "P19 3️⃣", "PF20 3️⃣", "PF21","P-GUDH",
    "F12 9️⃣", "F13 9️⃣", "F14 7️⃣", "F15 7️⃣", "F16 7️⃣", "F17 5️⃣", "F18 5️⃣", "F19 3️⃣", "F-GUDH",
    "Herrar A", "Herrar U", "Damer A", "Stjärnlaget", "Herrar Div 8", "Gåfotboll", "Match"
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
    const item = schedules[calId].find(x => x.id === key);
    if (item) item.title = newTitle;

    if (el) el.style.setProperty("--stripe-color", colorFromTitle(newTitle));

    saveSchedules();
  }

  // ----------------- Lagpanel (external drag) -----------------
  initTeamsPanel();

  function initTeamsPanel() {
    const teamsEl = document.getElementById("teams");
    if (!teamsEl) return;

    teamsEl.innerHTML = TEAMS.map(name => `<div class="team-item">${name}</div>`).join("");

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
    const minTime = isPlanS ? "09:30:00" : "09:00:00";
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

      // bort med stor vit marginal längst ned
      height: "auto",
      contentHeight: "auto",
      expandRows: false,

      editable: true,
      selectable: true,
      selectMirror: true,
      slotEventOverlap: true,

      droppable: true,

      events: schedules[id],

      // Skapa via markering
      select(info) {
        const title = prompt("Lag namn");
        if (!title) return;

        const item = {
          id: makeId(id),
          title,
          daysOfWeek: [dowFromDate(info.start)],
          startTime: timeFromDate(info.start),
          endTime: timeFromDate(info.end)
        };

        schedules[id].push(item);
        calendar.addEvent(item);
        saveSchedules();
      },

      // Drop från panel -> konvertera till veckomall
      eventReceive(info) {
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
      },

      // Flytt
      eventDrop(info) {
        const key = eventKey(info.event);
        const item = schedules[id].find(x => x.id === key);
        if (!item) return;

        item.daysOfWeek = [dowFromDate(info.event.start)];
        item.startTime = timeFromDate(info.event.start);
        item.endTime = timeFromDate(info.event.end);

        saveSchedules();
      },

      // Ändra längd
      eventResize(info) {
        const key = eventKey(info.event);
        const item = schedules[id].find(x => x.id === key);
        if (!item) return;

        item.endTime = timeFromDate(info.event.end);
        saveSchedules();
      },

      // Stripe + click/dblclick
      eventDidMount(info) {
        // stripe-color
        info.el.style.setProperty("--stripe-color", colorFromTitle(info.event.title));

        // återmarkera efter rerender
        const k = eventKey(info.event);
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
        }
      },

      // Titel fet + extra <br> + tid med bindestreck + radbrytning (A-variant)
      eventContent(arg) {
        const start = arg.event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const end = arg.event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        return {
          html: `
            <div class="ev">
              <b class="ev-title">${arg.event.title}</b>
              <br><br>
              <span class="ev-time">${start}-<br>${end}</span>
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

  // Klick utanför events/panel/knappar = avmarkera
  document.addEventListener("click", (e) => {
    const clickedEvent = e.target.closest(".fc-event");
    const clickedSidebar = e.target.closest("#teams");
    const clickedControl = e.target.closest("button");
    if (!clickedEvent && !clickedSidebar && !clickedControl) clearSelection();
  });

  // ----------------- DEL / BACKSPACE -----------------
  document.addEventListener("keydown", (e) => {
    if (!selectedEvent || !selectedCalendarId) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;

    const key = eventKey(selectedEvent);
    const list = schedules[selectedCalendarId];
    const idx = list.findIndex(x => x.id === key);
    if (idx !== -1) list.splice(idx, 1);

    selectedEvent.remove();
    clearSelection();
    saveSchedules();
  });

  // ----------------- Reset buttons -----------------
  document.querySelectorAll(".reset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const calId = btn.dataset.cal;
      if (!calId || !calendars[calId]) return;

      const ok = confirm(`Återställa ${EXPORT_NAMES[calId] || calId} till blankt?`);
      if (!ok) return;

      schedules[calId] = [];
      saveSchedules();

      calendars[calId].removeAllEvents();

      if (selectedCalendarId === calId) clearSelection();
    });
  });

  // ----------------- Kopiera plan -----------------
  function clonePlanEvents(fromId, toId) {
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

  async function captureElementAsCanvas(el) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    return html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true
    });
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
    const wrapper = document.getElementById(`export-${calId}`);
    if (!wrapper) return;

    const canvas = await captureElementAsCanvas(wrapper, 1);
    const dataUrl = canvas.toDataURL("image/png", 1.0);

    const niceName = EXPORT_NAMES[calId] || calId;
    downloadDataUrl(dataUrl, `${safeFilename(niceName)}.png`);
  }

  async function exportAllPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });

    const order = ["calendarA", "calendarB", "calendarS", "calendarF"].filter(id => {
      return document.getElementById(`export-${id}`);
    });

    for (let i = 0; i < order.length; i++) {
      const calId = order[i];
      const wrapper = document.getElementById(`export-${calId}`);

      const canvas = await captureElementAsCanvas(wrapper);
      const imgData = canvas.toDataURL("image/png", 1.0);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const w = imgWidth * ratio;
      const h = imgHeight * ratio;

      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;

      if (i > 0) doc.addPage();
      doc.addImage(imgData, "PNG", x, y, w, h);
    }

    doc.save("Alla scheman.pdf");
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


});