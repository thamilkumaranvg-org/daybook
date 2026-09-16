/* ==========================================================================
   Daybook — Activity Management System
   Frontend with persistent mobile login, device date/time daily reset,
   streak & XP penalty system, day-end countdown alerts, and completion-based
   mentor coaching.
   ========================================================================== */

const API = "";

function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return formatDateKey(new Date());
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateKey(d);
}

const THEME_CATALOG = {
  onepiece: {
    label: "One Piece",
    sub: "Set sail on today's log",
    mark: "★",
    mentors: [
      { id: "zoro", name: "Zoro", title: "Swordsman Guide" },
      { id: "luffy", name: "Luffy", title: "Captain Guide" },
      { id: "rayleigh", name: "Rayleigh", title: "Veteran Coach" },
    ],
  },
  bleach: {
    label: "Bleach",
    sub: "Duty ledger",
    mark: "魂",
    mentors: [
      { id: "ichigo", name: "Ichigo", title: "Substitute Guide" },
      { id: "urahara", name: "Kisuke Urahara", title: "Shopkeeper Coach" },
      { id: "aizen", name: "Aizen", title: "Tactical Observer" },
    ],
  },
  naruto: {
    label: "Naruto",
    sub: "Mission board",
    mark: "忍",
    mentors: [
      { id: "naruto", name: "Naruto", title: "Squad Spark" },
      { id: "kakashi", name: "Kakashi", title: "Field Instructor" },
      { id: "guy", name: "Might Guy", title: "Youth Coach" },
    ],
  },
  blackclover: {
    label: "Black Clover",
    sub: "Magic Knights roster",
    mark: "魔",
    mentors: [
      { id: "yami", name: "Yami Sukehiro", title: "Squad Captain Guide" },
      { id: "asta", name: "Asta", title: "Training Partner" },
    ],
  },
};

// ==========================================================================
// PERSISTENT STORAGE (Mobile & Desktop App Reopen Resilient)
// ==========================================================================

function getStored(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
}

function setStored(key, val) {
  try { localStorage.setItem(key, val); } catch (_) {}
  try { sessionStorage.setItem(key, val); } catch (_) {}
}

function removeStored(key) {
  try { localStorage.removeItem(key); } catch (_) {}
  try { sessionStorage.removeItem(key); } catch (_) {}
}

let token = getStored("daybook_token") || "";
let username = getStored("daybook_user") || "user1";
let activities = [];
let quests = [];
let badges = [];
let progress = null;
let lastMentorKey = "";
let lastRank = "";
let pendingTheme = getStored("daybook_pending_theme") || "";
let pendingMentor = getStored("daybook_pending_mentor") || "";

const MENTOR_ASSETS = {
  zoro: "zoro.webp",
  luffy: "luffy.webp",
  rayleigh: "rayleigh.webp",
  asta: "asta.webp",
  yami: "yami.webp",
  urahara: "urahara.webp",
  ichigo: "ichigo.webp",
  aizen: "aizen.webp",
  naruto: "naruto.webp",
  kakashi: "kakashi.webp",
  guy: "might-guy.webp",
  "might-guy": "might-guy.webp",
};

const MENTOR_FALLBACK_ICONS = {
  onepiece: "⚓",
  bleach: "⚔️",
  naruto: "🍥",
  blackclover: "🍀",
};

let mentorQuotes = [];
let currentQuoteIndex = 0;
let speechBubbleTimer = null;
let lastNotificationHour = null;

// Streak milestones (days) used by renderStreak() progress bar
const MILESTONES = [3, 7, 14, 30, 60, 100];

/* ---------------------------------------------------------------------
   API
   --------------------------------------------------------------------- */

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  // Client device date passed with every request for synchronization
  headers["X-Client-Date"] = todayKey();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    token = "";
    removeStored("daybook_token");
    removeStored("daybook_user");
    showLogin();
    const err = new Error("Not signed in");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (_) { /* ignore */ }
    const err = new Error(typeof detail === "string" ? detail : "Request failed");
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadActivities() {
  activities = await api("/api/activities");
}

async function loadGameLayer() {
  try {
    progress = await api("/api/progress");
    quests = await api("/api/quests");
    badges = await api("/api/badges");
    try {
      const mentorMsg = await api("/api/mentor/message");
      if (mentorMsg && mentorMsg.quotes && mentorMsg.quotes.length > 0) {
        mentorQuotes = mentorMsg.quotes;
      }
    } catch (_) {}
  } catch (_) {
    progress = null;
    quests = [];
    badges = [];
    mentorQuotes = [];
  }
}

/* ---------------------------------------------------------------------
   LOGIN & GATE STEPS
   --------------------------------------------------------------------- */

const loginScreen = document.getElementById("login-screen");
const appEl = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const signupForm = document.getElementById("signup-form");
const signupUsername = document.getElementById("signup-username");
const signupPassword = document.getElementById("signup-password");
const signupConfirm = document.getElementById("signup-confirm");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");

const authTabLogin = document.getElementById("auth-tab-login");
const authTabSignup = document.getElementById("auth-tab-signup");
const loginPane = document.getElementById("login-pane");
const signupPane = document.getElementById("signup-pane");
const authHeading = document.getElementById("auth-heading");
const switchToSignup = document.getElementById("switch-to-signup");
const switchToSignin = document.getElementById("switch-to-signin");

let currentAuthMode = "login";

function setAuthMode(mode) {
  currentAuthMode = mode;
  const isLogin = mode === "login";

  if (authTabLogin) {
    authTabLogin.classList.toggle("active", isLogin);
    authTabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
  }
  if (authTabSignup) {
    authTabSignup.classList.toggle("active", !isLogin);
    authTabSignup.setAttribute("aria-selected", !isLogin ? "true" : "false");
  }
  if (loginPane) loginPane.hidden = !isLogin;
  if (signupPane) signupPane.hidden = isLogin;
  if (authHeading) {
    authHeading.textContent = isLogin ? "Sign in to your dashboard" : "Create your Daybook account";
  }
  if (loginError) loginError.hidden = true;
  if (signupError) signupError.hidden = true;
  if (signupSuccess) signupSuccess.hidden = true;
}

if (authTabLogin) authTabLogin.addEventListener("click", () => setAuthMode("login"));
if (authTabSignup) authTabSignup.addEventListener("click", () => setAuthMode("signup"));
if (switchToSignup) switchToSignup.addEventListener("click", () => setAuthMode("signup"));
if (switchToSignin) switchToSignin.addEventListener("click", () => setAuthMode("login"));

async function completeAuthenticationAndEnter(authToken, authUser, isNewUser = false) {
  token = authToken;
  username = authUser;
  setStored("daybook_token", token);
  setStored("daybook_user", username);
  setStored("daybook_pending_theme", pendingTheme);
  setStored("daybook_pending_mentor", pendingMentor);

  progress = await api("/api/session/start", {
    method: "POST",
    body: JSON.stringify({ theme: pendingTheme, mentor: pendingMentor }),
  });
  applyLockedTheme(progress.theme);
  await loadActivities();
  await loadGameLayer();
  showApp();
  renderAll();
  initSlideshow();
  if (isNewUser) {
    showToast(`Account created! Welcome, ${username}`, "good");
  } else {
    showToast(`Welcome back, ${username}`, "good");
  }
  applyMentorFeedback(progress, true);
}

function showLogin() {
  appEl.hidden = true;
  loginScreen.hidden = false;
  pendingTheme = "";
  pendingMentor = "";
  removeStored("daybook_pending_theme");
  removeStored("daybook_pending_mentor");
  const widget = document.getElementById("mentor-floating-widget");
  if (widget) widget.hidden = true;
  const bubble = document.getElementById("mentor-speech-bubble");
  if (bubble) bubble.hidden = true;
  setAuthMode("login");
  showGateStep("theme");
}

function showApp() {
  loginScreen.hidden = true;
  appEl.hidden = false;
  document.querySelector(".profile-name").textContent = username;
  updateMentorWidget();
}

function showGateStep(step) {
  document.getElementById("step-theme").hidden = step !== "theme";
  document.getElementById("step-mentor").hidden = step !== "mentor";
  document.getElementById("step-login").hidden = step !== "login";
}

function applyLockedTheme(themeId) {
  const theme = THEME_CATALOG[themeId] ? themeId : "onepiece";
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("brand-sub").textContent = THEME_CATALOG[theme].sub;
  document.getElementById("login-brand").textContent = "Daybook";
}

function buildThemePicks() {
  const grid = document.getElementById("theme-pick-grid");
  grid.innerHTML = "";
  Object.entries(THEME_CATALOG).forEach(([id, meta]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick-card";
    btn.innerHTML = `<span class="pick-mark">${meta.mark}</span><strong>${meta.label}</strong><span>${meta.sub}</span>`;
    btn.addEventListener("click", () => {
      pendingTheme = id;
      setStored("daybook_pending_theme", id);
      applyLockedTheme(id);
      buildMentorPicks();
      showGateStep("mentor");
    });
    grid.appendChild(btn);
  });
}

function updateLoginMentorBanner(mentorObj, themeObj) {
  const banner = document.getElementById("login-selected-mentor-banner");
  const img = document.getElementById("login-selected-mentor-img");
  const nameEl = document.getElementById("login-selected-mentor-name");
  const titleEl = document.getElementById("login-selected-mentor-title");
  if (!banner) return;
  if (!mentorObj) {
    banner.hidden = true;
    return;
  }
  const asset = MENTOR_ASSETS[mentorObj.id] || `${mentorObj.id}.webp`;
  if (img) {
    img.src = `/assets/mentors/${asset}`;
    img.alt = mentorObj.name;
  }
  if (nameEl) nameEl.textContent = mentorObj.name;
  if (titleEl) titleEl.textContent = `${mentorObj.title} · ${themeObj ? themeObj.label : ""}`;
  banner.hidden = false;
}

function buildMentorPicks() {
  const grid = document.getElementById("mentor-pick-grid");
  const theme = THEME_CATALOG[pendingTheme];
  if (!theme) return;
  document.getElementById("mentor-step-sub").textContent = `Guides for ${theme.label}. One choice, locked until logout.`;
  grid.innerHTML = "";
  theme.mentors.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick-card";
    const asset = MENTOR_ASSETS[m.id] || `${m.id}.webp`;
    btn.innerHTML = `
      <img src="/assets/mentors/${asset}" class="pick-avatar" alt="${escapeHtml(m.name)}" onerror="this.style.display='none'" />
      <span class="pick-mark">${theme.mark}</span>
      <strong>${escapeHtml(m.name)}</strong>
      <span>${escapeHtml(m.title)}</span>
    `;
    btn.addEventListener("click", () => {
      pendingMentor = m.id;
      setStored("daybook_pending_mentor", m.id);
      document.getElementById("login-lock-summary").textContent =
        `${theme.label} · ${m.name} (${m.title}) — locked for this session.`;
      updateLoginMentorBanner(m, theme);
      updateMentorWidget();
      showGateStep("login");
    });
    grid.appendChild(btn);
  });
}

document.getElementById("back-to-theme").addEventListener("click", () => {
  pendingMentor = "";
  removeStored("daybook_pending_mentor");
  const banner = document.getElementById("login-selected-mentor-banner");
  if (banner) banner.hidden = true;
  updateMentorWidget();
  showGateStep("theme");
});

document.getElementById("back-to-mentor").addEventListener("click", () => {
  showGateStep("mentor");
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingTheme || !pendingMentor) {
      showGateStep("theme");
      return;
    }
    const name = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    if (loginError) loginError.hidden = true;

    const submitBtn = document.getElementById("login-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing In...";
    }

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: name, password }),
      });
      await completeAuthenticationAndEnter(data.token, data.username, false);
    } catch (err) {
      if (err.status === 401) {
        if (loginError) {
          loginError.textContent = "Incorrect username or passcode.";
          loginError.hidden = false;
        }
      } else {
        showToast(err.message || "Sign in failed", "bad");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingTheme || !pendingMentor) {
      showGateStep("theme");
      return;
    }
    const name = signupUsername ? signupUsername.value.trim() : "";
    const password = signupPassword ? signupPassword.value : "";
    const confirm = signupConfirm ? signupConfirm.value : "";

    if (signupError) signupError.hidden = true;
    if (signupSuccess) signupSuccess.hidden = true;

    if (name.length < 3) {
      if (signupError) {
        signupError.textContent = "Username must be at least 3 characters long.";
        signupError.hidden = false;
      }
      return;
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
      if (signupError) {
        signupError.textContent = "Username can only contain letters, numbers, hyphens, and underscores.";
        signupError.hidden = false;
      }
      return;
    }
    if (password.length < 4) {
      if (signupError) {
        signupError.textContent = "Passcode must be at least 4 characters long.";
        signupError.hidden = false;
      }
      return;
    }
    if (password !== confirm) {
      if (signupError) {
        signupError.textContent = "Passcodes do not match. Please verify.";
        signupError.hidden = false;
      }
      return;
    }

    const submitBtn = document.getElementById("signup-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating Account...";
    }

    try {
      const data = await api("/api/signup", {
        method: "POST",
        body: JSON.stringify({ username: name, password }),
      });
      if (signupSuccess) {
        signupSuccess.textContent = "Account created! Starting your journey...";
        signupSuccess.hidden = false;
      }
      await completeAuthenticationAndEnter(data.token, data.username, true);
    } catch (err) {
      if (signupError) {
        signupError.textContent = err.message || "Failed to create account.";
        signupError.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account & Enter";
      }
    }
  });
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (_) { /* already signed out */ }
  token = "";
  removeStored("daybook_token");
  removeStored("daybook_user");
  removeStored("daybook_pending_theme");
  removeStored("daybook_pending_mentor");
  activities = [];
  quests = [];
  badges = [];
  progress = null;
  lastMentorKey = "";
  lastRank = "";
  document.getElementById("password").value = "";
  if (signupPassword) signupPassword.value = "";
  if (signupConfirm) signupConfirm.value = "";
  profileMenu.hidden = true;
  showLogin();
  showToast("Signed out", "good");
});

/* ---------------------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------------------- */

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");

const PAGE_TITLES = {
  dashboard: "Dashboard",
  today: "Today",
  history: "History",
  quests: "Quests",
};

function goToPage(pageKey) {
  navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === pageKey));
  pages.forEach((section) => section.classList.toggle("active", section.id === `page-${pageKey}`));
  pageTitle.textContent = PAGE_TITLES[pageKey] || "Daybook";
  document.getElementById("search-input").value = "";
  closeMobileSidebar();
  renderAll();
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.dataset.page));
});

document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.dataset.goto));
});

const sidebar = document.getElementById("sidebar");
document.getElementById("nav-toggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});
function closeMobileSidebar() {
  sidebar.classList.remove("open");
}

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
   ACTIVITY LOGGER (User-Only Added Activities)
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

loggerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("logger-title").value.trim();
  const notes = document.getElementById("logger-notes").value.trim();
  if (!title) return;

  try {
    await api("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title,
        notes,
        priority: document.getElementById("logger-priority").checked,
        date: todayKey(), // Strictly tied to device date
      }),
    });
    loggerForm.reset();
    loggerForm.hidden = true;
    await loadActivities();
    await loadGameLayer();
    renderAll();
    showToast("Activity added", "good");
    applyMentorFeedback(progress);
  } catch (err) {
    showToast(err.message, "bad");
  }
});

/* ---------------------------------------------------------------------
   COMPLETION TOGGLER
   --------------------------------------------------------------------- */

async function toggleComplete(id) {
  try {
    const updated = await api(`/api/activities/${id}/toggle`, { method: "PATCH" });
    await loadActivities();
    await loadGameLayer();
    renderAll();
    showToast(updated.completed ? "Marked complete" : "Marked pending", "good");
    applyMentorFeedback(progress);
  } catch (err) {
    showToast(err.message, "bad");
  }
}

/* ---------------------------------------------------------------------
   EDIT & DELETE
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
  document.getElementById("edit-priority").checked = !!activity.priority;
  editModal.hidden = false;
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  editModal.hidden = true;
  editingId = null;
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newTitle = editTitleInput.value.trim();
  if (!newTitle) return;
  try {
    await api(`/api/activities/${editingId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: newTitle,
        notes: editNotesInput.value.trim(),
        priority: document.getElementById("edit-priority").checked,
      }),
    });
    editModal.hidden = true;
    editingId = null;
    await loadActivities();
    await loadGameLayer();
    renderAll();
    showToast("Activity updated", "good");
    applyMentorFeedback(progress);
  } catch (err) {
    showToast(err.message, "bad");
  }
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

document.getElementById("delete-confirm-btn").addEventListener("click", async () => {
  try {
    await api(`/api/activities/${deletingId}`, { method: "DELETE" });
    deleteModal.hidden = true;
    deletingId = null;
    await loadActivities();
    await loadGameLayer();
    renderAll();
    showToast("Activity deleted", "bad");
  } catch (err) {
    showToast(err.message, "bad");
  }
});

/* ---------------------------------------------------------------------
   SEARCH + HISTORY FILTER
   --------------------------------------------------------------------- */

const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", renderAll);

const historyDateFilter = document.getElementById("history-date-filter");
historyDateFilter.addEventListener("change", renderHistory);

function matchesSearch(activity) {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return true;
  return activity.title.toLowerCase().includes(q) || (activity.notes || "").toLowerCase().includes(q);
}

/* ---------------------------------------------------------------------
   DAY-END COUNTDOWN WARNING & NOTIFICATION SYSTEM
   (4h before, 3h before, 10 PM night warnings)
   --------------------------------------------------------------------- */

function checkDayEndWarnings() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const today = todayKey();
  const todays = activities.filter((a) => a.date === today);
  const pending = todays.filter((a) => !a.completed);
  const banner = document.getElementById("day-warning-banner");
  if (!banner) return;

  if (todays.length > 0 && pending.length > 0) {
    const hrsLeft = 23 - hour;
    const minsLeft = 59 - minute;
    const countdownStr = `${hrsLeft}h ${minsLeft}m left`;
    const countdownEl = document.getElementById("day-warning-countdown");
    const msgEl = document.getElementById("day-warning-msg");
    const titleEl = document.getElementById("day-warning-title");
    const iconEl = document.getElementById("day-warning-icon");
    if (countdownEl) countdownEl.textContent = countdownStr;

    if (hour >= 22) {
      // 10:00 PM or later (before midnight)
      banner.hidden = false;
      banner.className = "day-warning-banner urgency-high";
      if (iconEl) iconEl.textContent = "🚨";
      if (titleEl) titleEl.textContent = "10 PM Final Warning";
      if (msgEl) {
        msgEl.textContent = `Urgent: You have ${pending.length} incomplete activity(s) tonight! At midnight, incomplete tasks will break your streak and deduct 15 XP each. Complete them now!`;
      }
      triggerSystemAlertOnce(hour, `10 PM Final Warning: ${pending.length} incomplete task(s) left tonight. Finish before midnight to protect your streak!`);
    } else if (hour >= 21) {
      // 3 hours before midnight (9:00 PM)
      banner.hidden = false;
      banner.className = "day-warning-banner urgency-high";
      if (iconEl) iconEl.textContent = "⏳";
      if (titleEl) titleEl.textContent = "3-Hour Warning (9:00 PM)";
      if (msgEl) {
        msgEl.textContent = `Only 3 hours remaining in the day! You have ${pending.length} pending activity(s). Finish them before 10 PM / midnight to protect your flame streak!`;
      }
      triggerSystemAlertOnce(hour, `3-Hour Warning: ${pending.length} pending tasks remain. Finish before 10 PM to protect your streak!`);
    } else if (hour >= 20) {
      // 4 hours before midnight (8:00 PM)
      banner.hidden = false;
      banner.className = "day-warning-banner urgency-medium";
      if (iconEl) iconEl.textContent = "⚠️";
      if (titleEl) titleEl.textContent = "4-Hour Reminder (8:00 PM)";
      if (msgEl) {
        msgEl.textContent = `4 hours left before the day completes. You have ${pending.length} pending activity(s). Complete them to maintain your streak and avoid an XP penalty.`;
      }
      triggerSystemAlertOnce(hour, `4-Hour Warning: 4 hours left today. Complete your ${pending.length} task(s) to avoid XP penalty.`);
    } else {
      banner.hidden = true;
    }
  } else {
    banner.hidden = true;
  }
}

function triggerSystemAlertOnce(hour, message) {
  if (lastNotificationHour === hour) return;
  lastNotificationHour = hour;
  playMentorChime();
  showToast(message, "bad");
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Daybook Streak Alert", {
        body: message,
        icon: "/assets/mentors/zoro.webp",
      });
    } catch (_) {}
  }
}

const notifBtn = document.getElementById("enable-notif-btn");
if (notifBtn) {
  notifBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      showToast("Browser notifications are not supported on this device", "bad");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      showToast("Notifications enabled! You will be alerted at 8 PM, 9 PM, & 10 PM.", "good");
      notifBtn.textContent = "✓ Alerts Active";
    } else {
      showToast("Notification permission was declined or dismissed.", "bad");
    }
  });
}

const penaltyDismissBtn = document.getElementById("penalty-dismiss-btn");
if (penaltyDismissBtn) {
  penaltyDismissBtn.addEventListener("click", () => {
    const penaltyBanner = document.getElementById("penalty-alert-banner");
    if (penaltyBanner) penaltyBanner.hidden = true;
    sessionStorage.setItem("daybook_penalty_dismissed", "true");
  });
}

/* ---------------------------------------------------------------------
   RENDER
   --------------------------------------------------------------------- */

function renderAll() {
  renderDashboard();
  renderToday();
  renderHistory();
  renderStreak();
  renderProgress();
  renderQuests();
  renderBadges();
  checkDayEndWarnings();
}

function renderDashboard() {
  const TODAY = todayKey();
  const todays = activities.filter((a) => a.date === TODAY);
  const pending = todays.filter((a) => !a.completed);
  const completed = todays.filter((a) => a.completed);
  const historyCompleted = activities.filter((a) => a.completed && a.date !== TODAY);

  document.getElementById("stat-total-today").textContent = todays.length;
  document.getElementById("stat-pending-today").textContent = pending.length;
  document.getElementById("stat-completed-today").textContent = completed.length;
  document.getElementById("stat-completed-history").textContent = historyCompleted.length;

  const recent = [...activities].sort((a, b) => b.id - a.id).slice(0, 5);
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

  const weekAgo = daysAgoKey(6);
  const weeklyCompleted = activities.filter((a) => a.completed && a.date >= weekAgo).length;
  const weeklySlideText = document.getElementById("slide-weekly-text");
  if (weeklySlideText) {
    weeklySlideText.textContent = `You've completed ${weeklyCompleted} task${weeklyCompleted === 1 ? "" : "s"} in the last 7 days.`;
  }
}

function renderToday() {
  const TODAY = todayKey();
  // Strictly tasks logged on today's device date! Resets automatically on new day.
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
    if (a.priority) {
      const mark = document.createElement("span");
      mark.className = "priority-pill";
      mark.textContent = "Boss Challenge";
      titleCell.appendChild(document.createTextNode(" "));
      titleCell.appendChild(mark);
    }

    const notesCell = document.createElement("td");
    notesCell.textContent = a.notes || "—";

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

    tr.appendChild(checkCell);
    tr.appendChild(titleCell);
    tr.appendChild(notesCell);
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  });
}

function renderHistory() {
  const TODAY = todayKey();
  const pastActivities = activities.filter((a) => a.date !== TODAY);

  const uniqueDates = [...new Set(pastActivities.map((a) => a.date))].sort((a, b) => (a < b ? 1 : -1));
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
  const filtered = pastActivities.filter(
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
    const dayTasks = grouped[date] || [];
    const hasIncomplete = dayTasks.some((t) => !t.completed);
    heading.innerHTML = `${date} ${hasIncomplete ? '<span style="color:var(--accent-bad);font-size:12px;font-weight:700;margin-left:8px;">(Incomplete — Penalty Applied)</span>' : '<span style="color:var(--accent-good);font-size:12px;font-weight:700;margin-left:8px;">(Clean Finish)</span>'}`;
    group.appendChild(heading);

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead><tr><th>Status</th><th>Title</th><th>Notes</th><th>Time</th><th>Actions</th></tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    grouped[date].forEach((a) => {
      const tr = document.createElement("tr");

      const statusCell = document.createElement("td");
      statusCell.innerHTML = `<span class="status-pill ${a.completed ? "status-done" : "status-pending"}">${a.completed ? "Completed" : "Incomplete"}</span>`;

      const titleCell = document.createElement("td");
      titleCell.textContent = a.title;
      if (a.completed) titleCell.classList.add("row-title-done");

      const notesCell = document.createElement("td");
      notesCell.textContent = a.notes || "—";

      const timeCell = document.createElement("td");
      timeCell.textContent = a.time || (a.completed ? "Done" : "Missed");

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

      tr.appendChild(statusCell);
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

function renderProgress() {
  if (!progress) return;
  document.getElementById("sidebar-rank").textContent = progress.rank || "—";
  document.getElementById("sidebar-level").textContent = progress.level;
  document.getElementById("sidebar-xp").textContent = progress.xp;
  const pct = progress.xp_for_next ? Math.round((progress.xp_into_level / progress.xp_for_next) * 100) : 0;
  document.getElementById("xp-progress-fill").style.width = `${pct}%`;

  let nextInfo = `${progress.xp_into_level} / ${progress.xp_for_next} to next level`;
  if (progress.penalty_xp > 0) {
    nextInfo += ` · (-${progress.penalty_xp} XP penalty)`;
  }
  document.getElementById("sidebar-xp-next").textContent = nextInfo;

  document.getElementById("mentor-name").textContent = progress.mentor_name || "Guide";
  document.getElementById("mentor-title").textContent = progress.mentor_title || "";
  if (progress.mentor_text) {
    document.getElementById("mentor-text").textContent = progress.mentor_text;
  }
  const theme = THEME_CATALOG[progress.theme];
  if (theme) document.getElementById("mentor-mark").textContent = theme.mark;
  updateMentorWidget();
}

function renderQuests() {
  const activeHost = document.getElementById("active-quest-list");
  const doneHost = document.getElementById("done-quest-list");
  if (!activeHost) return;
  const q = searchInput.value.trim().toLowerCase();
  const active = quests.filter((item) => item.status === "active" && (!q || item.title_text.toLowerCase().includes(q)));
  const done = quests.filter((item) => item.status === "completed" && (!q || item.title_text.toLowerCase().includes(q)));
  activeHost.innerHTML = "";
  doneHost.innerHTML = "";
  active.forEach((item) => activeHost.appendChild(questCard(item)));
  done.forEach((item) => doneHost.appendChild(questCard(item, true)));
  document.getElementById("active-quest-empty").hidden = active.length !== 0;
  document.getElementById("done-quest-empty").hidden = done.length !== 0;
}

function questCard(item, done = false) {
  const wrap = document.createElement("div");
  wrap.className = "quest-card" + (done ? " done" : "");
  wrap.innerHTML = `
    <p class="quest-type">${escapeHtml((item.quest_type || "").replace(/_/g, " "))}</p>
    <p class="quest-title">${escapeHtml(item.title_text)}</p>
    <div class="streak-progress-track">
      <div class="streak-progress-fill" style="width:${item.progress || 0}%"></div>
    </div>
    <p class="quest-meta">${item.current}/${item.target}${done ? " · complete" : ""}</p>
  `;
  return wrap;
}

function renderBadges() {
  const host = document.getElementById("badge-list");
  if (!host) return;
  host.innerHTML = "";
  badges.forEach((b) => {
    const el = document.createElement("span");
    el.className = "badge-chip";
    el.textContent = b.label;
    host.appendChild(el);
  });
  document.getElementById("badge-empty").hidden = badges.length !== 0;
}

function applyMentorFeedback(state, suppressToast = false) {
  if (!state) return;
  if (state.mentor_text) {
    document.getElementById("mentor-text").textContent = state.mentor_text;
    const key = `${state.mentor_event || ""}:${state.mentor_text}`;
    if (!suppressToast && key !== lastMentorKey) {
      lastMentorKey = key;
      showToast(state.mentor_text, "good");
      showMentorSpeechBubble(state.mentor_text, 6);
    } else if (key !== lastMentorKey) {
      lastMentorKey = key;
      showMentorSpeechBubble(state.mentor_text, 4);
    }
  }
  if (state.rank && lastRank && state.rank !== lastRank) showRankUp(state.rank);
  if (state.rank_up && state.rank) showRankUp(state.rank);
  if (state.rank) lastRank = state.rank;
}

function showRankUp(rank) {
  const overlay = document.getElementById("rank-up-overlay");
  document.getElementById("rank-up-title").textContent = rank;
  document.getElementById("rank-up-text").textContent = "Rank unlocked from completed work — not from a separate score.";
  overlay.hidden = false;
  setTimeout(() => { overlay.hidden = true; }, 2800);
}

/* ---------------------------------------------------------------------
   MENTOR INTERACTIVE WIDGET & SPEECH BUBBLE
   --------------------------------------------------------------------- */

function playMentorChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch (_) {}
}

function updateMentorWidget() {
  const widget = document.getElementById("mentor-floating-widget");
  if (!widget) return;

  const mentorId = (progress && progress.mentor) || pendingMentor || "";
  const currentTheme = (progress && progress.theme) || pendingTheme || "onepiece";

  if (!mentorId) {
    widget.hidden = true;
    return;
  }
  widget.hidden = false;

  let mentorName = (progress && progress.mentor_name) || "";
  let mentorTitle = (progress && progress.mentor_title) || "";
  if (!mentorName) {
    const themeMeta = THEME_CATALOG[currentTheme];
    const m = themeMeta ? themeMeta.mentors.find((x) => x.id === mentorId) : null;
    mentorName = m ? m.name : mentorId.toUpperCase();
    mentorTitle = m ? m.title : "Mentor Guide";
  }

  const assetName = MENTOR_ASSETS[mentorId] || `${mentorId}.webp`;
  const assetUrl = `/assets/mentors/${assetName}`;

  const nametag = document.getElementById("mentor-figure-nametag");
  if (nametag) nametag.textContent = mentorName;
  const bubbleTitle = document.getElementById("bubble-mentor-name");
  if (bubbleTitle) bubbleTitle.textContent = mentorName.toUpperCase();

  const img = document.getElementById("mentor-figure-img");
  const fallback = document.getElementById("mentor-figure-fallback");
  const fallbackIcon = document.getElementById("mentor-fallback-icon");
  const fallbackName = document.getElementById("mentor-fallback-name");

  if (img && fallback) {
    img.onload = () => {
      img.style.display = "block";
      fallback.hidden = true;
    };
    img.onerror = () => {
      img.style.display = "none";
      fallback.hidden = false;
      if (fallbackIcon) fallbackIcon.textContent = MENTOR_FALLBACK_ICONS[currentTheme] || "★";
      if (fallbackName) fallbackName.textContent = mentorName;
    };
    img.src = assetUrl;
    img.alt = mentorName;
    if (img.complete && img.naturalWidth > 0) {
      img.style.display = "block";
      fallback.hidden = true;
    }
  }

  const cardAvatar = document.getElementById("mentor-card-avatar");
  const cardMark = document.getElementById("mentor-mark");
  if (cardAvatar && cardMark) {
    cardAvatar.onload = () => {
      cardAvatar.hidden = false;
      cardMark.hidden = true;
    };
    cardAvatar.onerror = () => {
      cardAvatar.hidden = true;
      cardMark.hidden = false;
    };
    cardAvatar.src = assetUrl;
    cardAvatar.alt = mentorName;
    if (cardAvatar.complete && cardAvatar.naturalWidth > 0) {
      cardAvatar.hidden = false;
      cardMark.hidden = true;
    }
  }
}

function showMentorSpeechBubble(text, autoCloseSec = 0) {
  const bubble = document.getElementById("mentor-speech-bubble");
  const textEl = document.getElementById("bubble-mentor-text");
  if (!bubble || !textEl) return;
  if (text) textEl.textContent = text;
  bubble.hidden = false;

  if (speechBubbleTimer) clearTimeout(speechBubbleTimer);
  if (autoCloseSec > 0) {
    speechBubbleTimer = setTimeout(() => {
      bubble.hidden = true;
    }, autoCloseSec * 1000);
  }
}

function hideMentorSpeechBubble() {
  const bubble = document.getElementById("mentor-speech-bubble");
  if (bubble) bubble.hidden = true;
  if (speechBubbleTimer) clearTimeout(speechBubbleTimer);
}

function interactMentorFigure() {
  const wrapper = document.getElementById("mentor-figure-wrapper");
  if (wrapper) {
    wrapper.classList.remove("figure-clicked");
    void wrapper.offsetWidth;
    wrapper.classList.add("figure-clicked");
  }
  playMentorChime();

  const bubble = document.getElementById("mentor-speech-bubble");
  if (bubble && !bubble.hidden) {
    nextMentorQuote();
  } else {
    const currentText = document.getElementById("mentor-text")?.textContent || "";
    if (mentorQuotes.length > 0) {
      showMentorSpeechBubble(mentorQuotes[currentQuoteIndex % mentorQuotes.length]);
    } else {
      showMentorSpeechBubble(currentText || "Let's make today's work count.");
    }
  }
}

function nextMentorQuote() {
  playMentorChime();
  if (mentorQuotes.length > 0) {
    currentQuoteIndex = (currentQuoteIndex + 1) % mentorQuotes.length;
    showMentorSpeechBubble(mentorQuotes[currentQuoteIndex]);
  } else {
    const currentText = document.getElementById("mentor-text")?.textContent || "Stay focused on today's goals.";
    showMentorSpeechBubble(currentText);
  }
}

function computeStreak() {
  // Client-side fallback if progress not yet loaded
  const completedDates = new Set(activities.filter((a) => a.completed).map((a) => a.date));

  let cursor = new Date();
  if (!completedDates.has(formatDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedDates.has(formatDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderStreak() {
  const streak = (progress && progress.streak !== undefined) ? progress.streak : computeStreak();

  document.getElementById("stat-streak").textContent = streak;
  document.getElementById("sidebar-streak-count").textContent = streak;

  const nextMilestone = MILESTONES.find((m) => m > streak) || MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [0, ...MILESTONES].reverse().find((m) => m <= streak) || 0;
  const span = nextMilestone - prevMilestone || 1;
  const progressPct = Math.min(100, Math.round(((streak - prevMilestone) / span) * 100));

  document.getElementById("streak-progress-fill").style.width = `${progressPct}%`;
  document.getElementById("streak-milestone-label").textContent =
    streak >= MILESTONES[MILESTONES.length - 1]
      ? "Milestone streak reached — amazing consistency."
      : `Next milestone: ${nextMilestone} days`;

  const messageEl = document.getElementById("streak-message");
  if (progress && progress.streak_broken && progress.incomplete_past_count > 0) {
    messageEl.innerHTML = `<span style="color:var(--accent-bad);font-weight:700">⚠️ Streak Broken:</span> ${progress.incomplete_past_count} past task(s) were left incomplete (-${progress.penalty_xp} XP penalty applied).`;
  } else if (streak === 0) {
    messageEl.textContent = "Complete all today's tasks to build your streak.";
  } else if (streak < 3) {
    messageEl.textContent = "Good start — keep it going tomorrow.";
  } else if (streak < 7) {
    messageEl.textContent = "You're building a solid habit.";
  } else if (streak < 14) {
    messageEl.textContent = "A full week strong — impressive consistency.";
  } else {
    messageEl.textContent = "Outstanding streak. This is a real habit now.";
  }

  const slideStreakText = document.getElementById("slide-streak-text");
  if (slideStreakText) {
    if (progress && progress.streak_broken && progress.incomplete_past_count > 0) {
      slideStreakText.textContent = `Streak broken from ${progress.incomplete_past_count} incomplete past task(s). Finish today's work to rebuild!`;
    } else {
      slideStreakText.textContent =
        streak === 0
          ? "No active streak yet — complete all tasks today to start one."
          : `You're on a ${streak}-day streak. Keep it alive!`;
    }
  }

  // Update penalty banner
  const penaltyBanner = document.getElementById("penalty-alert-banner");
  const penaltyMsg = document.getElementById("penalty-alert-msg");
  if (penaltyBanner) {
    if (progress && progress.streak_broken && progress.incomplete_past_count > 0 && !sessionStorage.getItem("daybook_penalty_dismissed")) {
      penaltyBanner.hidden = false;
      if (penaltyMsg) {
        penaltyMsg.textContent = `${progress.incomplete_past_count} activity(s) from previous days were left incomplete, breaking your streak and deducting ${progress.penalty_xp} XP. Clear today's slate to start rebuilding your rank!`;
      }
    } else {
      penaltyBanner.hidden = true;
    }
  }
}

/* ---------------------------------------------------------------------
   SLIDESHOW
   --------------------------------------------------------------------- */

let slideIndex = 0;
let slideTimer = null;
const SLIDE_INTERVAL = 4500;

function initSlideshow() {
  const slides = document.querySelectorAll(".slide");
  const dotsContainer = document.getElementById("slideshow-dots");
  if (!slides.length || dotsContainer.dataset.built) return;

  dotsContainer.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => {
      setSlide(i);
      restartSlideTimer();
    });
    dotsContainer.appendChild(dot);
  });
  dotsContainer.dataset.built = "true";

  document.getElementById("slide-prev").addEventListener("click", () => {
    setSlide((slideIndex - 1 + slides.length) % slides.length);
    restartSlideTimer();
  });
  document.getElementById("slide-next").addEventListener("click", () => {
    setSlide((slideIndex + 1) % slides.length);
    restartSlideTimer();
  });

  const slideshow = document.getElementById("slideshow");
  slideshow.addEventListener("mouseenter", () => clearInterval(slideTimer));
  slideshow.addEventListener("mouseleave", restartSlideTimer);

  restartSlideTimer();
}

function setSlide(index) {
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");
  slides.forEach((s, i) => s.classList.toggle("active", i === index));
  dots.forEach((d, i) => d.classList.toggle("active", i === index));
  slideIndex = index;
}

function restartSlideTimer() {
  clearInterval(slideTimer);
  const slides = document.querySelectorAll(".slide");
  slideTimer = setInterval(() => {
    setSlide((slideIndex + 1) % slides.length);
  }, SLIDE_INTERVAL);
}

/* ---------------------------------------------------------------------
   TOAST
   --------------------------------------------------------------------- */

function showToast(message, type = "good") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------------
   MENTOR FIGURE EVENT LISTENERS
   --------------------------------------------------------------------- */

const mentorWrapper = document.getElementById("mentor-figure-wrapper");
if (mentorWrapper) {
  mentorWrapper.addEventListener("click", interactMentorFigure);
  mentorWrapper.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      interactMentorFigure();
    }
  });
}

const bubbleNextBtn = document.getElementById("bubble-next-btn");
if (bubbleNextBtn) {
  bubbleNextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    nextMentorQuote();
  });
}

const bubbleCloseBtn = document.getElementById("bubble-close-btn");
if (bubbleCloseBtn) {
  bubbleCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideMentorSpeechBubble();
  });
}

/* ---------------------------------------------------------------------
   BOOT SEQUENCE & SESSION RESTORATION
   --------------------------------------------------------------------- */

buildThemePicks();
applyLockedTheme(pendingTheme || "onepiece");

if (pendingTheme && pendingMentor) {
  const theme = THEME_CATALOG[pendingTheme];
  const m = theme ? theme.mentors.find((x) => x.id === pendingMentor) : null;
  if (m && theme) {
    updateLoginMentorBanner(m, theme);
    document.getElementById("login-lock-summary").textContent =
      `${theme.label} · ${m.name} (${m.title}) — locked for this session.`;
  }
  updateMentorWidget();
  showGateStep("login");
} else if (pendingTheme) {
  buildMentorPicks();
  showGateStep("mentor");
} else {
  showGateStep("theme");
}

(async function restoreSession() {
  if (!token) return;
  try {
    const me = await api("/api/me");
    username = me.username;
    await loadActivities();
    await loadGameLayer();

    if (!progress || !progress.theme) {
      if (pendingTheme && pendingMentor) {
        progress = await api("/api/session/start", {
          method: "POST",
          body: JSON.stringify({ theme: pendingTheme, mentor: pendingMentor }),
        });
      } else {
        token = "";
        removeStored("daybook_token");
        removeStored("daybook_user");
        showLogin();
        return;
      }
    }

    applyLockedTheme(progress.theme);
    showApp();
    renderAll();
    initSlideshow();

    // Start background countdown ticker for day-end reminders
    setInterval(checkDayEndWarnings, 30000);
    checkDayEndWarnings();
  } catch (_) {
    showLogin();
  }
})();
