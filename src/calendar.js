// ====== Calendar State ======
const state = {
  viewYear: 0,
  viewMonth: 0, // 0..11
  selectedISO: null, // e.g. "2025-09-13"
};

const monthLabel = document.getElementById("monthLabel");
const daysContainer = document.getElementById("days");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Initialize to today
(function init() {
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  render();
  wireNav();
})();

function wireNav() {
  prevBtn.addEventListener("click", () => {
    navigateMonth(-1);
  });
  nextBtn.addEventListener("click", () => {
    navigateMonth(1);
  });

  // Basic keyboard support for navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey)) navigateMonth(-1);
    if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) navigateMonth(1);
  });
}

function navigateMonth(delta) {
  let m = state.viewMonth + delta;
  let y = state.viewYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0;  y++; }
  state.viewMonth = m;
  state.viewYear = y;
  render();
}

function render() {
  // Header
  monthLabel.textContent = `${MONTH_NAMES[state.viewMonth]} ${state.viewYear}`;

  // Clear days
  daysContainer.innerHTML = "";

  // Build the grid cells (with leading/trailing dates for alignment)
  const cells = buildMonthCells(state.viewYear, state.viewMonth);

  const todayISO = isoDate(new Date());

  for (const cell of cells) {
    const el = document.createElement("div");
    el.className = "day";
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.dataset.iso = cell.iso;

    if (!cell.inCurrentMonth) el.classList.add("faded");
    if (cell.iso === todayISO) el.classList.add("today");
    if (cell.iso === state.selectedISO) el.classList.add("selected");

    // Label (top-right)
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = cell.day;

    el.appendChild(num);

    // Click/Enter toggles selection (single-select)
    const selectHandler = () => selectDate(cell.iso);
    el.addEventListener("click", selectHandler);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectHandler();
      }
    });

    daysContainer.appendChild(el);
  }
}

// Build all visible cells: leading days, current month days, trailing days
function buildMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const daysInThisMonth = getDaysInMonth(year, month);

  // Leading days from previous month to align the first row
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const leading = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    leading.push({
      year: prevYear,
      month: prevMonth,
      day,
      inCurrentMonth: false,
      iso: isoFromParts(prevYear, prevMonth, day),
    });
  }

  // Current month days
  const current = [];
  for (let d = 1; d <= daysInThisMonth; d++) {
    current.push({
      year,
      month,
      day: d,
      inCurrentMonth: true,
      iso: isoFromParts(year, month, d),
    });
  }

  // Trailing days to complete the last week row (to 6 index = Saturday)
  const totalSoFar = leading.length + current.length;
  const remainder = totalSoFar % 7;
  const trailingCount = remainder === 0 ? 0 : 7 - remainder;

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const trailing = [];
  for (let d = 1; d <= trailingCount; d++) {
    trailing.push({
      year: nextYear,
      month: nextMonth,
      day: d,
      inCurrentMonth: false,
      iso: isoFromParts(nextYear, nextMonth, d),
    });
  }

  return [...leading, ...current, ...trailing];
}

function getDaysInMonth(year, month0) {
  // month0 0..11; trick: day 0 of next month = last day of this month
  return new Date(year, month0 + 1, 0).getDate();
}

function isoDate(date) {
  return isoFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoFromParts(year, month0, day) {
  // Build YYYY-MM-DD with zero-padding; month0 is 0-based
  const m = (month0 + 1).toString().padStart(2, "0");
  const d = day.toString().padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function selectDate(iso) {
  // Single-select behavior
  if (state.selectedISO === iso) {
    // toggle off
    state.selectedISO = null;
  } else {
    state.selectedISO = iso;
  }
  // Re-render to update styles
  render();
  // You can hook into this for notes / events:
  // e.g., openDaySidebar(iso) or emitSelectedDate(iso)
}
