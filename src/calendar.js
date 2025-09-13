// ====== Calendar State ======
const state = {
  viewYear: 0,
  viewMonth: 0,
  modalISO: null,
  editingId: null,
  eventsByDate: {},
};
const STORAGE_KEY = "calendar.events.v1";

const monthLabel = document.getElementById("monthLabel");
const daysContainer = document.getElementById("days");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Modal refs
const modal = document.getElementById("eventModal");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModal");
const existingEventsEl = document.getElementById("existingEvents");
const eventForm = document.getElementById("eventForm");
const eventDateISOInput = document.getElementById("eventDateISO");
const eventIdInput = document.getElementById("eventId");
const eventTitleInput = document.getElementById("eventTitle");
const eventNotesInput = document.getElementById("eventNotes");
const deleteEventBtn = document.getElementById("deleteEvent");
const cancelEventBtn = document.getElementById("cancelEvent");

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

(function init() {
  loadEvents();
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  render();
  wireUI();
})();

function loadEvents() {
  try { state.eventsByDate = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { state.eventsByDate = {}; }
}
function persistEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.eventsByDate));
}

function wireUI() {
  prevBtn.addEventListener("click", () => navigateMonth(-1));
  nextBtn.addEventListener("click", () => navigateMonth(1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) hideModal();
    if ((e.ctrlKey || e.metaKey) && e.key === "ArrowLeft") navigateMonth(-1);
    if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight") navigateMonth(1);
  });

  closeModalBtn.addEventListener("click", hideModal);
  cancelEventBtn.addEventListener("click", hideModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });

  eventForm.addEventListener("submit", onSaveEvent);
  deleteEventBtn.addEventListener("click", onDeleteEvent);
}

function navigateMonth(delta) {
  let m = state.viewMonth + delta, y = state.viewYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0;  y++; }
  state.viewMonth = m; state.viewYear = y;
  render();
}

function render() {
  monthLabel.textContent = `${MONTH_NAMES[state.viewMonth]} ${state.viewYear}`;
  daysContainer.innerHTML = "";

  const cells = buildMonthCells(state.viewYear, state.viewMonth);
  const todayISO = toISO(new Date());

  for (const cell of cells) {
    const el = document.createElement("div");
    el.className = "day";
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.dataset.iso = cell.iso;

    if (!cell.inCurrentMonth) el.classList.add("faded");
    if (cell.iso === todayISO) el.classList.add("today");

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = cell.day;
    el.appendChild(num);

    // chips
    const wrap = document.createElement("div");
    wrap.className = "chips";
    const events = state.eventsByDate[cell.iso] || [];
    events.slice(0, 2).forEach(evt => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.title = evt.notes ? `${evt.title} — ${evt.notes}` : evt.title;
      chip.textContent = evt.title;
      wrap.appendChild(chip);
    });
    if (events.length > 2) {
      const more = document.createElement("span");
      more.className = "chip more";
      more.textContent = `+${events.length - 2}`;
      wrap.appendChild(more);
    }
    el.appendChild(wrap);

    // open modal
    const open = () => openModal(cell.iso);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    daysContainer.appendChild(el);
  }
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const start = first.getDay(); // 0=Sun..6=Sat
  const daysThis = daysInMonth(year, month);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysPrev = daysInMonth(prevYear, prevMonth);

  const leading = [];
  for (let i = start - 1; i >= 0; i--) {
    const d = daysPrev - i;
    leading.push(cell(prevYear, prevMonth, d, false));
  }
  const current = Array.from({length: daysThis}, (_, i) => cell(year, month, i + 1, true));

  const total = leading.length + current.length;
  const rem = total % 7;
  const trailingCount = rem === 0 ? 0 : 7 - rem;

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const trailing = Array.from({length: trailingCount}, (_, i) => cell(nextYear, nextMonth, i + 1, false));

  return [...leading, ...current, ...trailing];
}
function cell(y, m0, d, inCurrentMonth) {
  return { year: y, month: m0, day: d, inCurrentMonth, iso: isoFromParts(y, m0, d) };
}
function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
function toISO(date) { return isoFromParts(date.getFullYear(), date.getMonth(), date.getDate()); }
function isoFromParts(y, m0, d) {
  const mm = String(m0 + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function openModal(iso) {
  state.modalISO = iso; state.editingId = null;
  eventDateISOInput.value = iso; eventIdInput.value = "";
  eventTitleInput.value = ""; eventNotesInput.value = "";
  modalTitle.textContent = `Events — ${iso}`;
  renderExistingEventsList(iso);
  deleteEventBtn.classList.add("hidden");
  modal.classList.remove("hidden");
  eventTitleInput.focus();
}
function hideModal() {
  modal.classList.add("hidden");
  state.modalISO = null; state.editingId = null;
}
function renderExistingEventsList(iso) {
  const list = state.eventsByDate[iso] || [];
  if (!list.length) { existingEventsEl.innerHTML = `<div class="empty">No events yet for this date.</div>`; return; }
  existingEventsEl.innerHTML = "";
  list.forEach(evt => {
    const row = document.createElement("div"); row.className = "event-row";
    const left = document.createElement("div");
    left.innerHTML = `<div class="title">${escapeHTML(evt.title)}</div>` + (evt.notes ? `<div class="notes">${escapeHTML(evt.notes)}</div>` : "");
    const actions = document.createElement("div"); actions.className = "row-actions";
    const editBtn = document.createElement("button"); editBtn.className = "mini"; editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEditEvent(iso, evt.id));
    const delBtn = document.createElement("button"); delBtn.className = "mini danger"; delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => { deleteEvent(iso, evt.id); });
    actions.append(editBtn, delBtn);
    row.append(left, actions);
    existingEventsEl.appendChild(row);
  });
}
function startEditEvent(iso, id) {
  const evt = (state.eventsByDate[iso] || []).find(e => e.id === id);
  if (!evt) return;
  state.editingId = id;
  eventIdInput.value = String(id);
  eventDateISOInput.value = iso;
  eventTitleInput.value = evt.title;
  eventNotesInput.value = evt.notes || "";
  deleteEventBtn.classList.remove("hidden");
  eventTitleInput.focus();
}
function onSaveEvent(e) {
  e.preventDefault();
  const iso = eventDateISOInput.value;
  const title = eventTitleInput.value.trim();
  const notes = eventNotesInput.value.trim();
  if (!title) { eventTitleInput.focus(); return; }
  const list = state.eventsByDate[iso] || [];
  if (state.editingId) {
    const i = list.findIndex(e => e.id === state.editingId);
    if (i !== -1) list[i] = { ...list[i], title, notes };
  } else {
    list.push({ id: Date.now(), title, notes });
  }
  state.eventsByDate[iso] = list;
  persistEvents(); renderExistingEventsList(iso); render();
  state.editingId = null; eventIdInput.value = ""; eventTitleInput.value = ""; eventNotesInput.value = "";
  deleteEventBtn.classList.add("hidden");
}
function onDeleteEvent() {
  const iso = eventDateISOInput.value;
  const id = Number(eventIdInput.value);
  if (!id) return;
  deleteEvent(iso, id);
  state.editingId = null; eventIdInput.value = ""; eventTitleInput.value = ""; eventNotesInput.value = "";
  deleteEventBtn.classList.add("hidden");
}
function deleteEvent(iso, id) {
  const list = state.eventsByDate[iso] || [];
  state.eventsByDate[iso] = list.filter(e => e.id !== id);
  persistEvents(); renderExistingEventsList(iso); render();
}
function escapeHTML(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

