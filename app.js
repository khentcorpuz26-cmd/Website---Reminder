const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const PALETTE = ["#9a9a9a", "#6ba5c9", "#c98b6b", "#8bc98f", "#c9c26b", "#a06bc9", "#c96b8f"];

const FOLDER_ICON_SVG =
  '<svg class="board-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M1.5 3.5a1 1 0 0 1 1-1h3.1a1 1 0 0 1 .8.4l.9 1.2a1 1 0 0 0 .8.4H13.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
  "</svg>";

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const taskForm = document.getElementById("taskForm");
const fieldTitle = document.getElementById("fieldTitle");
const fieldDescription = document.getElementById("fieldDescription");
const fieldDueDate = document.getElementById("fieldDueDate");
const fieldPriority = document.getElementById("fieldPriority");
const fieldStatus = document.getElementById("fieldStatus");
const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");
const newItemBtn = document.getElementById("newItemBtn");
const overdueReadout = document.getElementById("overdueReadout");
const syncStatus = document.getElementById("syncStatus");
const todayDateEl = document.getElementById("todayDate");
const searchInput = document.getElementById("searchInput");
const addGroupBtn = document.getElementById("addGroupBtn");
const groupsContainer = document.getElementById("groupsContainer");
const workspaceListEl = document.getElementById("workspaceList");
const addWorkspaceBtn = document.getElementById("addWorkspaceBtn");
const boardTitleEl = document.getElementById("boardTitle");
const navBoard = document.getElementById("navBoard");
const navFavorites = document.getElementById("navFavorites");
const navSettings = document.getElementById("navSettings");
const addGroupBtnEl = document.getElementById("addGroupBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsForm = document.getElementById("settingsForm");
const fieldDisplayName = document.getElementById("fieldDisplayName");
const fieldTheme = document.getElementById("fieldTheme");
const settingsCancelBtn = document.getElementById("settingsCancelBtn");
const avatarBadgeEl = document.getElementById("avatarBadge");
const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.getElementById("filterPanel");
const sortBtn = document.getElementById("sortBtn");
const sortPanel = document.getElementById("sortPanel");
const priorityChips = document.getElementById("priorityChips");
const promptOverlay = document.getElementById("promptOverlay");
const promptForm = document.getElementById("promptForm");
const promptTitle = document.getElementById("promptTitle");
const promptLabel = document.getElementById("promptLabel");
const promptInput = document.getElementById("promptInput");
const promptCheckboxRow = document.getElementById("promptCheckboxRow");
const promptCheckbox = document.getElementById("promptCheckbox");
const promptCheckboxLabel = document.getElementById("promptCheckboxLabel");
const promptCancelBtn = document.getElementById("promptCancelBtn");
const promptOkBtn = document.getElementById("promptOkBtn");
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");
const toastContainer = document.getElementById("toastContainer");

let editingId = null;
let cachedWorkspaces = [];
let cachedGroups = [];
let cachedTasks = [];
let currentWorkspaceId = localStorage.getItem("ledger_workspace_id") || null;
let searchTerm = "";
let currentView = "board";
let workspaceTaskCounts = {};
let sortBy = "due";
let filterPriority = "all";

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function formatDue(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dueState(dateStr, isDoneGroup) {
  if (!dateStr || isDoneGroup) return "";
  if (dateStr < todayISO()) return "overdue";
  if (dateStr === todayISO()) return "today";
  return "";
}

function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " toast-error" : ""}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

function showConfirm({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = confirmLabel;
    confirmOkBtn.classList.toggle("danger", danger);
    confirmOverlay.hidden = false;

    function cleanup(result) {
      confirmOverlay.hidden = true;
      confirmOkBtn.removeEventListener("click", onOk);
      confirmCancelBtn.removeEventListener("click", onCancel);
      confirmOverlay.removeEventListener("click", onOverlay);
      resolve(result);
    }
    function onOk() {
      cleanup(true);
    }
    function onCancel() {
      cleanup(false);
    }
    function onOverlay(e) {
      if (e.target === confirmOverlay) cleanup(false);
    }
    confirmOkBtn.addEventListener("click", onOk);
    confirmCancelBtn.addEventListener("click", onCancel);
    confirmOverlay.addEventListener("click", onOverlay);
  });
}

function showPrompt({ title, label, placeholder = "", defaultValue = "", confirmLabel = "Create", showCheckbox = false, checkboxLabel = "" }) {
  return new Promise((resolve) => {
    promptTitle.textContent = title;
    promptLabel.textContent = label;
    promptInput.placeholder = placeholder;
    promptInput.value = defaultValue;
    promptOkBtn.textContent = confirmLabel;
    promptCheckboxRow.hidden = !showCheckbox;
    promptCheckboxLabel.textContent = checkboxLabel;
    promptCheckbox.checked = false;
    promptOverlay.hidden = false;
    promptInput.focus();

    function cleanup(result) {
      promptOverlay.hidden = true;
      promptForm.removeEventListener("submit", onSubmit);
      promptCancelBtn.removeEventListener("click", onCancel);
      promptOverlay.removeEventListener("click", onOverlay);
      resolve(result);
    }
    function onSubmit(e) {
      e.preventDefault();
      const value = promptInput.value.trim();
      if (!value) return;
      cleanup({ value, checked: promptCheckbox.checked });
    }
    function onCancel() {
      cleanup(null);
    }
    function onOverlay(e) {
      if (e.target === promptOverlay) cleanup(null);
    }
    promptForm.addEventListener("submit", onSubmit);
    promptCancelBtn.addEventListener("click", onCancel);
    promptOverlay.addEventListener("click", onOverlay);
  });
}

async function seedDefaultGroups(workspaceId) {
  await sb.from("groups").insert([
    { workspace_id: workspaceId, name: "To do", is_done_group: false, position: 0 },
    { workspace_id: workspaceId, name: "In progress", is_done_group: false, position: 1 },
    { workspace_id: workspaceId, name: "Done", is_done_group: true, position: 2 },
  ]);
}

async function loadWorkspaces() {
  const { data, error } = await sb.from("workspaces").select("*").order("position", { ascending: true });
  if (error) {
    console.error(error);
    syncStatus.textContent = "sync failed — check console";
    return;
  }
  cachedWorkspaces = data;

  if (cachedWorkspaces.length === 0) {
    const { data: ws, error: wsErr } = await sb
      .from("workspaces")
      .insert({ name: "My tasks", position: 0 })
      .select()
      .single();
    if (wsErr) {
      console.error(wsErr);
      return;
    }
    await seedDefaultGroups(ws.id);
    cachedWorkspaces = [ws];
  }

  if (!currentWorkspaceId || !cachedWorkspaces.find((w) => w.id === currentWorkspaceId)) {
    currentWorkspaceId = cachedWorkspaces[0].id;
  }
  localStorage.setItem("ledger_workspace_id", currentWorkspaceId);
  await loadWorkspaceCounts();
  renderWorkspaceList();
}

async function loadWorkspaceCounts() {
  const { data: allGroups, error: groupsErr } = await sb.from("groups").select("id,workspace_id");
  if (groupsErr) {
    console.error(groupsErr);
    return;
  }
  const groupToWorkspace = {};
  allGroups.forEach((g) => {
    groupToWorkspace[g.id] = g.workspace_id;
  });

  const { data: allTasks, error: tasksErr } = await sb.from("tasks").select("group_id");
  if (tasksErr) {
    console.error(tasksErr);
    return;
  }
  const counts = {};
  allTasks.forEach((t) => {
    const wsId = groupToWorkspace[t.group_id];
    if (!wsId) return;
    counts[wsId] = (counts[wsId] || 0) + 1;
  });
  workspaceTaskCounts = counts;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderWorkspaceList() {
  workspaceListEl.innerHTML = "";
  cachedWorkspaces.forEach((ws) => {
    const a = document.createElement("a");
    a.href = "#";
    a.className = `board-item${ws.id === currentWorkspaceId ? " active" : ""}`;
    a.innerHTML =
      FOLDER_ICON_SVG +
      `<span class="board-item-name">${escapeHtml(ws.name)}</span>` +
      `<span class="board-item-count">${workspaceTaskCounts[ws.id] || 0}</span>`;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (ws.id === currentWorkspaceId) return;
      currentWorkspaceId = ws.id;
      localStorage.setItem("ledger_workspace_id", currentWorkspaceId);
      renderWorkspaceList();
      loadBoard();
    });
    workspaceListEl.appendChild(a);
  });
  const current = cachedWorkspaces.find((w) => w.id === currentWorkspaceId);
  if (current) boardTitleEl.textContent = currentView === "favorites" ? "Favorites" : current.name;
}

async function loadGroups() {
  const { data, error } = await sb
    .from("groups")
    .select("*")
    .eq("workspace_id", currentWorkspaceId)
    .order("position", { ascending: true });
  if (error) {
    console.error(error);
    cachedGroups = [];
    return;
  }
  cachedGroups = data;
}

async function fetchTasks() {
  if (cachedGroups.length === 0) {
    cachedTasks = [];
    renderBoard();
    return;
  }
  const groupIds = cachedGroups.map((g) => g.id);
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .in("group_id", groupIds)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    syncStatus.textContent = "sync failed — check console";
    return;
  }
  cachedTasks = data;
  workspaceTaskCounts[currentWorkspaceId] = cachedTasks.length;
  renderWorkspaceList();
  renderBoard();
  syncStatus.textContent = `synced ${new Date().toLocaleTimeString()}`;
}

async function loadBoard() {
  await loadGroups();
  await fetchTasks();
}

function renderBoard() {
  groupsContainer.innerHTML = "";

  const term = searchTerm.trim().toLowerCase();
  let visible = term ? cachedTasks.filter((t) => t.title.toLowerCase().includes(term)) : cachedTasks;
  if (currentView === "favorites") {
    visible = visible.filter((t) => t.is_favorite);
  }
  if (filterPriority !== "all") {
    visible = visible.filter((t) => t.priority === filterPriority);
  }

  addGroupBtnEl.hidden = currentView === "favorites";

  cachedGroups.forEach((group, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const groupTasks = sortTasks(visible.filter((t) => t.group_id === group.id));

    if (currentView === "favorites" && groupTasks.length === 0) return;

    const section = document.createElement("section");
    section.className = "group";
    section.dataset.groupId = group.id;

    const header = document.createElement("div");
    header.className = "group-header";

    const toggle = document.createElement("button");
    toggle.className = "group-toggle";
    toggle.setAttribute("aria-label", "Collapse group");
    toggle.addEventListener("click", () => section.classList.toggle("collapsed"));
    header.appendChild(toggle);

    const dot = document.createElement("span");
    dot.className = "group-dot";
    dot.style.background = group.is_done_group ? color : "transparent";
    dot.style.border = `1.5px solid ${color}`;
    header.appendChild(dot);

    const h2 = document.createElement("h2");
    h2.textContent = group.name;
    header.appendChild(h2);

    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = groupTasks.length;
    header.appendChild(count);

    if (cachedGroups.length > 1) {
      const delBtn = document.createElement("button");
      delBtn.className = "group-delete-btn";
      delBtn.textContent = "×";
      delBtn.title = "Delete group";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await showConfirm({
          title: "Delete group?",
          message: `Delete "${group.name}"? Tasks inside will also be deleted.`,
          confirmLabel: "Delete",
          danger: true,
        });
        if (!ok) return;
        const { error } = await sb.from("groups").delete().eq("id", group.id);
        if (error) {
          console.error(error);
          showToast("Couldn't delete group — try again", "error");
          return;
        }
        showToast(`"${group.name}" deleted`);
        await loadBoard();
      });
      header.appendChild(delBtn);
    }

    section.appendChild(header);

    const body = document.createElement("div");
    body.className = "group-body";

    const headRow = document.createElement("div");
    headRow.className = "table-head-row";
    headRow.innerHTML = `
      <div class="col-check"></div>
      <div class="col-star"></div>
      <div class="col-item">Item</div>
      <div class="col-avatar"></div>
      <div class="col-status">Status</div>
      <div class="col-due">Due date</div>
      <div class="col-priority">Priority</div>
    `;
    body.appendChild(headRow);

    const rowsEl = document.createElement("div");
    rowsEl.className = "rows";
    groupTasks.forEach((task) => rowsEl.appendChild(buildRow(task, group)));
    body.appendChild(rowsEl);

    const addItemBtn = document.createElement("button");
    addItemBtn.className = "add-item-row";
    addItemBtn.textContent = "+ Add item";
    addItemBtn.addEventListener("click", () => openModal(null, group.id));
    body.appendChild(addItemBtn);

    section.appendChild(body);

    const bar = document.createElement("div");
    bar.className = "group-bar";
    bar.style.background = color;
    section.appendChild(bar);

    section.addEventListener("dragover", (e) => {
      e.preventDefault();
      section.classList.add("drag-over");
    });
    section.addEventListener("dragleave", () => section.classList.remove("drag-over"));
    section.addEventListener("drop", async (e) => {
      e.preventDefault();
      section.classList.remove("drag-over");
      const dragging = document.querySelector(".row.dragging");
      if (!dragging) return;
      const id = dragging.dataset.id;
      const task = cachedTasks.find((t) => t.id === id);
      if (!task || task.group_id === group.id) return;
      task.group_id = group.id;
      renderBoard();
      const { error } = await sb.from("tasks").update({ group_id: group.id }).eq("id", id);
      if (error) {
        console.error(error);
        showToast("Couldn't move task — try again", "error");
        fetchTasks();
      }
    });

    groupsContainer.appendChild(section);
  });

  if (currentView === "favorites" && visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "footer";
    empty.textContent = "No favorites yet — click the star on a task to add it here.";
    groupsContainer.appendChild(empty);
  }

  const doneGroupIds = cachedGroups.filter((g) => g.is_done_group).map((g) => g.id);
  const overdueCount = cachedTasks.filter(
    (t) => !doneGroupIds.includes(t.group_id) && t.due_date && t.due_date < todayISO()
  ).length;

  overdueReadout.innerHTML = overdueCount > 0 ? `<strong>${overdueCount}</strong> overdue` : "All caught up";
}

function buildRow(task, group) {
  const row = document.createElement("div");
  row.className = `row${group.is_done_group ? " is-done" : ""}`;
  row.draggable = true;
  row.dataset.id = task.id;

  // checkbox
  const checkCol = document.createElement("div");
  checkCol.className = "col-check";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = group.is_done_group;
  check.addEventListener("click", (e) => e.stopPropagation());
  check.addEventListener("change", async () => {
    const doneGroup = cachedGroups.find((g) => g.is_done_group);
    const fallbackGroup = cachedGroups.find((g) => !g.is_done_group) || cachedGroups[0];
    const targetGroup = check.checked ? doneGroup : fallbackGroup;
    if (!targetGroup) return;
    task.group_id = targetGroup.id;
    renderBoard();
    const { error } = await sb.from("tasks").update({ group_id: targetGroup.id }).eq("id", task.id);
    if (error) {
      console.error(error);
      showToast("Couldn't update task — try again", "error");
      fetchTasks();
    }
  });
  checkCol.appendChild(check);
  row.appendChild(checkCol);

  // favorite star
  const starCol = document.createElement("div");
  starCol.className = "col-star";
  const starBtn = document.createElement("button");
  starBtn.type = "button";
  starBtn.className = `star-btn${task.is_favorite ? " favorited" : ""}`;
  starBtn.title = task.is_favorite ? "Remove from favorites" : "Add to favorites";
  starBtn.textContent = task.is_favorite ? "★" : "☆";
  starBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const next = !task.is_favorite;
    task.is_favorite = next;
    renderBoard();
    const { error } = await sb.from("tasks").update({ is_favorite: next }).eq("id", task.id);
    if (error) {
      console.error(error);
      showToast("Couldn't update favorite — try again", "error");
      fetchTasks();
    }
  });
  starCol.appendChild(starBtn);
  row.appendChild(starCol);

  // title
  const itemCol = document.createElement("div");
  itemCol.className = "col-item";
  itemCol.textContent = task.title;
  row.appendChild(itemCol);

  // avatar
  const avatarCol = document.createElement("div");
  avatarCol.className = "col-avatar";
  const avatar = document.createElement("div");
  avatar.className = "row-avatar";
  avatar.textContent = "K";
  avatarCol.appendChild(avatar);
  row.appendChild(avatarCol);

  // status dropdown (moves task between groups)
  const statusCol = document.createElement("div");
  statusCol.className = "col-status";
  const statusSelect = document.createElement("select");
  cachedGroups.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    if (g.id === task.group_id) opt.selected = true;
    statusSelect.appendChild(opt);
  });
  statusSelect.addEventListener("click", (e) => e.stopPropagation());
  statusSelect.addEventListener("change", async () => {
    const newGroupId = statusSelect.value;
    task.group_id = newGroupId;
    renderBoard();
    const { error } = await sb.from("tasks").update({ group_id: newGroupId }).eq("id", task.id);
    if (error) {
      console.error(error);
      showToast("Couldn't update status — try again", "error");
      fetchTasks();
    }
  });
  statusCol.appendChild(statusSelect);
  row.appendChild(statusCol);

  // due date
  const dueCol = document.createElement("div");
  const state = dueState(task.due_date, group.is_done_group);
  dueCol.className = `col-due ${state}`;
  if (task.due_date) {
    if (state === "overdue" || state === "today") {
      const marker = document.createElement("span");
      marker.className = "marker";
      marker.textContent = state === "overdue" ? "●" : "○";
      dueCol.appendChild(marker);
    }
    const text = document.createElement("span");
    text.textContent = formatDue(task.due_date);
    dueCol.appendChild(text);
  }
  row.appendChild(dueCol);

  // priority pill
  const priorityCol = document.createElement("div");
  priorityCol.className = "col-priority";
  const pill = document.createElement("span");
  pill.className = `pill pill-${task.priority}`;
  pill.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  priorityCol.appendChild(pill);
  row.appendChild(priorityCol);

  row.addEventListener("click", () => openModal(task));
  row.addEventListener("dragstart", () => row.classList.add("dragging"));
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  return row;
}

// Add group
addGroupBtn.addEventListener("click", async () => {
  const result = await showPrompt({
    title: "New group",
    label: "Group name",
    placeholder: "e.g. In review",
    showCheckbox: true,
    checkboxLabel: 'Counts as completed (like a "Done" column)',
  });
  if (!result) return;
  const nextPos = cachedGroups.length ? Math.max(...cachedGroups.map((g) => g.position)) + 1 : 0;
  const { error } = await sb
    .from("groups")
    .insert({ workspace_id: currentWorkspaceId, name: result.value, is_done_group: result.checked, position: nextPos });
  if (error) {
    console.error(error);
    showToast("Couldn't create group — try again", "error");
    return;
  }
  showToast(`"${result.value}" group created`);
  await loadBoard();
});

// Add workspace (board)
addWorkspaceBtn.addEventListener("click", async () => {
  const result = await showPrompt({
    title: "New board",
    label: "Board name",
    placeholder: "e.g. Marketing",
  });
  if (!result) return;
  const nextPos = cachedWorkspaces.length ? Math.max(...cachedWorkspaces.map((w) => w.position)) + 1 : 0;
  const { data: ws, error } = await sb
    .from("workspaces")
    .insert({ name: result.value, position: nextPos })
    .select()
    .single();
  if (error) {
    console.error(error);
    showToast("Couldn't create board — try again", "error");
    return;
  }
  await seedDefaultGroups(ws.id);
  cachedWorkspaces.push(ws);
  currentWorkspaceId = ws.id;
  localStorage.setItem("ledger_workspace_id", currentWorkspaceId);
  renderWorkspaceList();
  showToast(`"${result.value}" board created`);
  await loadBoard();
});

// Search
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderBoard();
});

// Filter / Sort dropdowns
function closePanels(except) {
  if (filterPanel !== except) filterPanel.hidden = true;
  if (sortPanel !== except) sortPanel.hidden = true;
}

filterBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = filterPanel.hidden;
  closePanels();
  filterPanel.hidden = !willOpen;
});

sortBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = sortPanel.hidden;
  closePanels();
  sortPanel.hidden = !willOpen;
});

document.addEventListener("click", () => closePanels());
filterPanel.addEventListener("click", (e) => e.stopPropagation());
sortPanel.addEventListener("click", (e) => e.stopPropagation());

filterPanel.querySelectorAll(".tb-panel-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    filterPriority = btn.dataset.filter;
    filterPanel.querySelectorAll(".tb-panel-item").forEach((b) => b.classList.toggle("selected", b === btn));
    filterBtn.classList.toggle("active", filterPriority !== "all");
    filterPanel.hidden = true;
    renderBoard();
  });
});

sortPanel.querySelectorAll(".tb-panel-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    sortBy = btn.dataset.sort;
    sortPanel.querySelectorAll(".tb-panel-item").forEach((b) => b.classList.toggle("selected", b === btn));
    sortBtn.classList.toggle("active", sortBy !== "due");
    sortPanel.hidden = true;
    renderBoard();
  });
});

filterPanel.querySelector('[data-filter="all"]').classList.add("selected");
sortPanel.querySelector('[data-sort="due"]').classList.add("selected");

function sortTasks(tasks) {
  const sorted = tasks.slice();
  if (sortBy === "priority") {
    const rank = { high: 0, normal: 1, low: 2 };
    sorted.sort((a, b) => rank[a.priority] - rank[b.priority]);
  } else if (sortBy === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    sorted.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }
  return sorted;
}

// Board / Favorites view switching
function setView(view) {
  currentView = view;
  navBoard.classList.toggle("active", view === "board");
  navFavorites.classList.toggle("active", view === "favorites");
  const current = cachedWorkspaces.find((w) => w.id === currentWorkspaceId);
  boardTitleEl.textContent = view === "favorites" ? "Favorites" : current ? current.name : "My tasks";
  renderBoard();
}

navBoard.addEventListener("click", (e) => {
  e.preventDefault();
  setView("board");
});

navFavorites.addEventListener("click", (e) => {
  e.preventDefault();
  setView("favorites");
});

// Settings
function applyDisplayName(name) {
  const initial = (name || "K").trim().charAt(0).toUpperCase() || "K";
  avatarBadgeEl.textContent = initial;
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function openSettings() {
  fieldDisplayName.value = localStorage.getItem("ledger_display_name") || "";
  fieldTheme.value = localStorage.getItem("ledger_theme") || "light";
  settingsOverlay.hidden = false;
}

function closeSettings() {
  settingsOverlay.hidden = true;
}

navSettings.addEventListener("click", (e) => {
  e.preventDefault();
  openSettings();
});

settingsCancelBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = fieldDisplayName.value.trim();
  const theme = fieldTheme.value;
  localStorage.setItem("ledger_display_name", name);
  localStorage.setItem("ledger_theme", theme);
  applyDisplayName(name);
  applyTheme(theme);
  closeSettings();
});

function setPriority(value) {
  fieldPriority.value = value;
  priorityChips.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.priority === value);
  });
}

priorityChips.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => setPriority(chip.dataset.priority));
});

function openModal(task, presetGroupId) {
  editingId = task ? task.id : null;
  modalTitle.textContent = task ? "Edit task" : "New task";
  fieldTitle.value = task ? task.title : "";
  fieldDescription.value = task ? task.description || "" : "";
  fieldDueDate.value = task ? task.due_date || "" : "";
  setPriority(task ? task.priority : "normal");

  fieldStatus.innerHTML = "";
  cachedGroups.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    fieldStatus.appendChild(opt);
  });
  fieldStatus.value = task ? task.group_id : presetGroupId || (cachedGroups[0] && cachedGroups[0].id) || "";

  deleteBtn.hidden = !task;
  modalOverlay.hidden = false;
  fieldTitle.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  taskForm.reset();
  editingId = null;
}

newItemBtn.addEventListener("click", () => openModal(null));
cancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    title: fieldTitle.value.trim(),
    description: fieldDescription.value.trim(),
    due_date: fieldDueDate.value || null,
    priority: fieldPriority.value,
    group_id: fieldStatus.value,
  };
  if (!payload.title || !payload.group_id) return;

  const wasEditing = Boolean(editingId);
  const { error } = editingId
    ? await sb.from("tasks").update(payload).eq("id", editingId)
    : await sb.from("tasks").insert(payload);

  if (error) {
    console.error(error);
    showToast("Couldn't save task — try again", "error");
    return;
  }
  closeModal();
  showToast(wasEditing ? "Task updated" : "Task created");
  fetchTasks();
});

deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  const ok = await showConfirm({
    title: "Delete task?",
    message: "This can't be undone.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!ok) return;
  const { error } = await sb.from("tasks").delete().eq("id", editingId);
  if (error) {
    console.error(error);
    showToast("Couldn't delete task — try again", "error");
    return;
  }
  closeModal();
  showToast("Task deleted");
  fetchTasks();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modalOverlay.hidden) closeModal();
  if (!settingsOverlay.hidden) closeSettings();
  if (!confirmOverlay.hidden) confirmCancelBtn.click();
  if (!promptOverlay.hidden) promptCancelBtn.click();
  if (!filterPanel.hidden) filterPanel.hidden = true;
  if (!sortPanel.hidden) sortPanel.hidden = true;
});

todayDateEl.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

(async function init() {
  applyTheme(localStorage.getItem("ledger_theme") || "light");
  applyDisplayName(localStorage.getItem("ledger_display_name") || "");
  await loadWorkspaces();
  await loadBoard();
})();
