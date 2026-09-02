/* ==========================================================================
   Daybook — Activity Management System
   Frontend only. All data below is MOCK/SAMPLE data (no backend, no DB).
   ========================================================================== */

/* ---------------------------------------------------------------------
   1. MOCK DATA
   Each activity has: id, title, notes, date (YYYY-MM-DD), completed, time
   --------------------------------------------------------------------- */

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TODAY = todayKey();

// Sample credentials for the mock login (frontend only, no real auth yet)
const MOCK_USER = { username: "user1", password: "demo1234" };

// Sample activities. A few are dated "today" and several on past dates
// so the History and Dashboard pages have data to display.
let activities = [
  { id: 1, title: "Review project brief", notes: "Check requirements doc", date: TODAY, completed: false, time: null },
  { id: 2, title: "Team stand-up", notes: "9:30 AM call", date: TODAY, completed: true, time: "09:35 AM" },
  { id: 3, title: "Reply to client email", notes: "", date: TODAY, completed: false, time: null },
  { id: 4, title: "Prepare weekly report", notes: "Include KPIs", date: "2026-08-31", completed: true, time: "04:10 PM" },
  { id: 5, title: "Update task tracker", notes: "", date: "2026-08-31", completed: true, time: "05:00 PM" },
  { id: 6, title: "Plan sprint tasks", notes: "With team lead", date: "2026-08-29", completed: true, time: "11:20 AM" },
];

let nextId = 7;

/* ---------------------------------------------------------------------
   2. LOGIN
   --------------------------------------------------------------------- */

const loginScreen = document.getElementById("login-screen");
const appEl = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (username === MOCK_USER.username && password === MOCK_USER.password) {
    loginError.hidden = true;
    loginScreen.hidden = true;
    appEl.hidden = false;
    renderAll();
  } else {
    loginError.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  appEl.hidden = true;
  loginScreen.hidden = false;
  document.getElementById("password").value = "";
  profileMenu.hidden = true;
});

/* ---------------------------------------------------------------------
   3. NAVIGATION (no page reload — just show/hide sections)
   --------------------------------------------------------------------- */

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");

const PAGE_TITLES = {
  dashboard: "Dashboard",
  today: "Today",
  history: "History",
};

function goToPage(pageKey) {
  navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === pageKey));
  pages.forEach((section) => section.classList.toggle("active", section.id === `page-${pageKey}`));
  pageTitle.textContent = PAGE_TITLES[pageKey];
  document.getElementById("search-input").value = "";
  closeMobileSidebar();
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.dataset.page));
});

// "Go to Today" button inside the Dashboard panel
document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.dataset.goto));
});

// Mobile sidebar toggle
const sidebar = document.getElementById("sidebar");
document.getElementById("nav-toggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});
function closeMobileSidebar() {
  sidebar.classList.remove("open");
}

// Profile dropdown
const profileBtn = document.getElementById("profile-btn");
const profileMenu = document.getElementById("profile-menu");
profileBtn.addEventListener("click", () => {
  profileMenu.hidden = !profileMenu.hidden;
});
document.addEventListener("click", (e) => {
  if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
    profileMenu.hidden = true;
  }
});

/* ---------------------------------------------------------------------
   4. ACTIVITY LOGGER (add new activity)
   --------------------------------------------------------------------- */

const addActivityBtn = document.getElementById("add-activity-btn");
const loggerForm = document.getElementById("logger-form");
const loggerCancel = document.getElementById("logger-cancel");

addActivityBtn.addEventListener("click", () => {
  loggerForm.hidden = !loggerForm.hidden;
  if (!loggerForm.hidden) document.getElementById("logger-title").focus();
});

loggerCancel.addEventListener("click", () => {
  loggerForm.reset();
  loggerForm.hidden = true;
});

loggerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("logger-title").value.trim();
  const notes = document.getElementById("logger-notes").value.trim();
  if (!title) return;

  activities.unshift({
    id: nextId++,
    title,
    notes,
    date: TODAY,
    completed: false,
    time: null,
  });

  loggerForm.reset();
  loggerForm.hidden = true;
  renderAll();
});

/* ---------------------------------------------------------------------
   5. COMPLETION MARKER (toggle done / pending)
   --------------------------------------------------------------------- */

function toggleComplete(id) {
  const activity = activities.find((a) => a.id === id);
  if (!activity) return;
  activity.completed = !activity.completed;
  activity.time = activity.completed
    ? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  renderAll();
}

/* ---------------------------------------------------------------------
   6. EDIT & DELETE
   --------------------------------------------------------------------- */

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editTitleInput = document.getElementById("edit-title");
const editNotesInput = document.getElementById("edit-notes");
let editingId = null;

function openEditModal(id) {
  const activity = activities.find((a) => a.id === id);
  if (!activity) return;
  editingId = id;
  editTitleInput.value = activity.title;
  editNotesInput.value = activity.notes;
  editModal.hidden = false;
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  editModal.hidden = true;
  editingId = null;
});

editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const activity = activities.find((a) => a.id === editingId);
  if (!activity) return;
  const newTitle = editTitleInput.value.trim();
  if (!newTitle) return;
  activity.title = newTitle;
  activity.notes = editNotesInput.value.trim();
  editModal.hidden = true;
  editingId = null;
  renderAll();
});

const deleteModal = document.getElementById("delete-modal");
let deletingId = null;

function openDeleteModal(id) {
  deletingId = id;
  deleteModal.hidden = false;
}

document.getElementById("delete-cancel-btn").addEventListener("click", () => {
  deleteModal.hidden = true;
  deletingId = null;
});

document.getElementById("delete-confirm-btn").addEventListener("click", () => {
  activities = activities.filter((a) => a.id !== deletingId);
  deleteModal.hidden = true;
  deletingId = null;
  renderAll();
});

/* ---------------------------------------------------------------------
   7. SEARCH (Today & History) + FILTER (History by date)
   --------------------------------------------------------------------- */

const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", renderAll);

const historyDateFilter = document.getElementById("history-date-filter");
historyDateFilter.addEventListener("change", renderHistory);

function matchesSearch(activity) {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return true;
  return activity.title.toLowerCase().includes(q) || activity.notes.toLowerCase().includes(q);
}

/* ---------------------------------------------------------------------
   8. RENDER FUNCTIONS
   --------------------------------------------------------------------- */

function renderAll() {
  renderDashboard();
  renderToday();
  renderHistory();
}

// ---- Dashboard ----
function renderDashboard() {
  const todays = activities.filter((a) => a.date === TODAY);
  const pending = todays.filter((a) => !a.completed);
  const completed = todays.filter((a) => a.completed);
  const historyCompleted = activities.filter((a) => a.completed && a.date !== TODAY);

  document.getElementById("stat-total-today").textContent = todays.length;
  document.getElementById("stat-pending-today").textContent = pending.length;
  document.getElementById("stat-completed-today").textContent = completed.length;
  document.getElementById("stat-completed-history").textContent = historyCompleted.length;

  const recent = [...activities]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const tbody = document.querySelector("#dashboard-recent-table tbody");
  tbody.innerHTML = "";
  recent.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(a.title)}</td>
      <td>${a.date}</td>
      <td><span class="status-pill ${a.completed ? "status-done" : "status-pending"}">${a.completed ? "Completed" : "Pending"}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- Today page ----
function renderToday() {
  const todays = activities.filter((a) => a.date === TODAY && matchesSearch(a));
  const pending = todays.filter((a) => !a.completed);
  const completed = todays.filter((a) => a.completed);

  fillTaskTable("#pending-table tbody", pending);
  fillTaskTable("#completed-table tbody", completed);

  document.getElementById("pending-empty").hidden = pending.length !== 0;
  document.getElementById("completed-empty").hidden = completed.length !== 0;
}

function fillTaskTable(selector, list) {
  const tbody = document.querySelector(selector);
  tbody.innerHTML = "";
  list.forEach((a) => {
    const tr = document.createElement("tr");

    const checkCell = document.createElement("td");
    const checkBtn = document.createElement("button");
    checkBtn.className = "check-toggle" + (a.completed ? " checked" : "");
    checkBtn.setAttribute("aria-label", "Toggle completion");
    checkBtn.addEventListener("click", () => toggleComplete(a.id));
    checkCell.appendChild(checkBtn);

    const titleCell = document.createElement("td");
    titleCell.textContent = a.title;
    if (a.completed) titleCell.classList.add("row-title-done");

    const notesCell = document.createElement("td");
    notesCell.textContent = a.notes || "—";

    const actionsCell = document.createElement("td");
    actionsCell.className = "row-actions";
    actionsCell.innerHTML = "";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditModal(a.id));

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => openDeleteModal(a.id));

    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(delBtn);

    tr.appendChild(checkCell);
    tr.appendChild(titleCell);
    tr.appendChild(notesCell);
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  });
}

// ---- History page ----
function renderHistory() {
  const completedPast = activities.filter((a) => a.completed && a.date !== TODAY);

  // Populate the date filter dropdown with unique dates (once per render)
  const uniqueDates = [...new Set(completedPast.map((a) => a.date))].sort((a, b) => (a < b ? 1 : -1));
  const currentFilterValue = historyDateFilter.value;
  historyDateFilter.innerHTML = '<option value="all">All dates</option>';
  uniqueDates.forEach((date) => {
    const opt = document.createElement("option");
    opt.value = date;
    opt.textContent = date;
    historyDateFilter.appendChild(opt);
  });
  if ([...historyDateFilter.options].some((o) => o.value === currentFilterValue)) {
    historyDateFilter.value = currentFilterValue;
  }

  const activeFilter = historyDateFilter.value;
  const filtered = completedPast.filter(
    (a) => (activeFilter === "all" || a.date === activeFilter) && matchesSearch(a)
  );

  const grouped = {};
  filtered.forEach((a) => {
    if (!grouped[a.date]) grouped[a.date] = [];
    grouped[a.date].push(a);
  });

  const dates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  const container = document.getElementById("history-container");
  container.innerHTML = "";

  dates.forEach((date) => {
    const group = document.createElement("div");
    group.className = "history-group";

    const heading = document.createElement("p");
    heading.className = "history-date";
    heading.textContent = date;
    group.appendChild(heading);

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead><tr><th>Title</th><th>Notes</th><th>Completed At</th><th>Actions</th></tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    grouped[date].forEach((a) => {
      const tr = document.createElement("tr");

      const titleCell = document.createElement("td");
      titleCell.textContent = a.title;

      const notesCell = document.createElement("td");
      notesCell.textContent = a.notes || "—";

      const timeCell = document.createElement("td");
      timeCell.textContent = a.time || "—";

      const actionsCell = document.createElement("td");
      actionsCell.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditModal(a.id));

      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => openDeleteModal(a.id));

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(delBtn);

      tr.appendChild(titleCell);
      tr.appendChild(notesCell);
      tr.appendChild(timeCell);
      tr.appendChild(actionsCell);
      tbody.appendChild(tr);
    });

    group.appendChild(table);
    container.appendChild(group);
  });

  document.getElementById("history-empty").hidden = dates.length !== 0;
}

/* ---------------------------------------------------------------------
   9. UTIL
   --------------------------------------------------------------------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
