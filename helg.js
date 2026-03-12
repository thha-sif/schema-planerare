document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "schema-helg-v1";

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

  function clearSelection() {
    if (selectedEl) {
      selectedEl.style.outline = "";
      selectedEl.style.outlineOffset = "";
    }
    selectedEvent = null;
    selectedEl = null;
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
  }


  function colorFromTitle() {
    return "#013888";
  }

  // Vi lagrar som "veckomall" även här (fast bara helg)
  // item = { id, title, daysOfWeek:[6 eller 0], startTime:"HH:MM", endTime:"HH:MM" }
  let data = loadEvents();

  const calendarEl = document.getElementById("weekendCalendar");

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    headerToolbar: false,

    locale: "sv",
    firstDay: 1,
    dayHeaderFormat: { weekday: "long" },

    allDaySlot: false,

    // Visa bara lördag + söndag
    hiddenDays: [1,2,3,4,5], // döljer mån–fre

    slotMinTime: "09:00:00",
    slotMaxTime: "19:15:00",
    slotDuration: "00:15:00",
    snapDuration: "00:15:00",

    height: "auto",
    contentHeight: "auto",
    expandRows: false,

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
        daysOfWeek: [dowFromDate(info.start)],  // 6 eller 0
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
      info.el.style.setProperty("--stripe-color", colorFromTitle(info.event.title));

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

          const newTitle = prompt("Redigera namn", info.event.title);
          if (newTitle === null) return;

          info.event.setProp("title", newTitle);

          const key = info.event.id || (info.event._def && info.event._def.publicId) || "";
          const item = data.find(x => x.id === key);
          if (item) item.title = newTitle;

          info.el.style.setProperty("--stripe-color", colorFromTitle(newTitle));
          saveEvents(data);
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
            <br><br>
            <span class="ev-time">${start}-<br>${end}</span>
          </div>
        `
      };
    }
  });

  calendar.render();

  // DEL/BACKSPACE: ta bort markerat
  document.addEventListener("keydown", (e) => {
    if (!selectedEvent) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;

    const key = selectedEvent.id || (selectedEvent._def && selectedEvent._def.publicId) || "";
    const idx = data.findIndex(x => x.id === key);
    if (idx !== -1) data.splice(idx, 1);

    selectedEvent.remove();
    clearSelection();
    saveEvents(data);
  });

  // Klick utanför event: avmarkera
  document.addEventListener("click", (e) => {
    const clickedEvent = e.target.closest(".fc-event");
    const clickedControl = e.target.closest("button");
    if (!clickedEvent && !clickedControl) clearSelection();
  });

  // Rensa helg
  document.getElementById("weekendClear").addEventListener("click", () => {
    const ok = confirm("Rensa helgschemat och börja från noll?");
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