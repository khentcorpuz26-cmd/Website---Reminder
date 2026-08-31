const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const STATUSES = ["todo", "in_progress", "done"];
const rowsEls = {
  todo: document.getElementById("rows-todo"),
  in_progress: document.getElementById("rows-in_progress"),
  done: document.getElementById("rows-done"),
};
const countEls = {
  todo: document.getElementById("count-todo"),
  in_progress: document.getElementById("count-in_progress"),
  done: document.getElementById("count-done"),
};

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

let editingId = null;
let cachedTasks = [];
let searchTerm = "";

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

function dueState(dateStr, status) {
  if (!dateStr || status === "done") return "";
  if (dateStr < todayISO()) return "overdue";
  if (dateStr === todayISO()) return "today";
  return "";
}

async function fetchTasks() {
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    syncStatus.textContent = "sync failed — check console";
    return;
  }
  cachedTasks = data;
  renderBoard();
  syncStatus.textContent = `synced ${new Date().toLocaleTimeString()}`;
}

function renderBoard() {
  STATUSES.forEach((s) => (rowsEls[s].innerHTML = ""));

  const term = searchTerm.trim().toLowerCase();
  const visible = term
    ? cachedTasks.filter((t) => t.title.toLowerCase().includes(term))
    : cachedTasks;

  visible.forEach((task) => {
    rowsEls[task.status].appendChild(buildRow(task));
  });

  STATUSES.forEach((s) => {
    countEls[s].textContent = visible.filter((t) => t.status === s).length;
  });

  const overdueCount = cachedTasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date < todayISO()
  ).length;

  overdueReadout.innerHTML =
    overdueCount > 0 ? `<strong>${overdueCount}</strong> overdue` : "All caught up";
}

function buildRow(task) {
  const row = document.createElement("div");
  row.className = `row${task.status === "done" ? " is-done" : ""}`;
  row.draggable = true;
  row.dataset.id = task.id;

  // checkbox
  const checkCol = document.createElement("div");
  checkCol.className = "col-check";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = task.status === "done";
  check.addEventListener("click", (e) => e.stopPropagation());
  check.addEventListener("change", async () => {
    const newStatus = check.checked ? "done" : "todo";
    task.status = newStatus;
    renderBoard();
    const { error } = await sb.from("tasks").update({ status: newStatus }).eq("id", task.id);
    if (error) {
      console.error(error);
      fetchTasks();
    }
  });
  checkCol.appendChild(check);
  row.appendChild(checkCol);

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

  // due date
  const dueCol = document.createElement("div");
  const state = dueState(task.due_date, task.status);
  dueCol.className = `col-due ${state}`;
  if (task.due_date) {
    if (state === "overdue" || state === "today") {
      const marker = document.createElement("span");
      marker.className = "marker";
      marker.textContent = state === "overdue" ? "\u25CF" : "\u25CB";
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

// Drag and drop between groups
document.querySelectorAll(".group").forEach((group) => {
  group.addEventListener("dragover", (e) => {
    e.preventDefault();
    group.classList.add("drag-over");
  });
  group.addEventListener("dragleave", () => group.classList.remove("drag-over"));
  group.addEventListener("drop", async (e) => {
    e.preventDefault();
    group.classList.remove("drag-over");
    const dragging = document.querySelector(".row.dragging");
    if (!dragging) return;
    const id = dragging.dataset.id;
    const newStatus = group.dataset.status;
    const task = cachedTasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;
    task.status = newStatus;
    renderBoard();
    const { error } = await sb.from("tasks").update({ status: newStatus }).eq("id", id);
    if (error) {
      console.error(error);
      fetchTasks();
    }
  });
});

// Group collapse/expand
document.querySelectorAll(".group-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".group").classList.toggle("collapsed");
  });
});

// Add item per group
document.querySelectorAll(".add-item-row").forEach((btn) => {
  btn.addEventListener("click", () => openModal(null, btn.dataset.status));
});

// Search
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderBoard();
});

// Add group (not wired to a backend concept — statuses are fixed)
addGroupBtn.addEventListener("click", () => {
  const original = addGroupBtn.textContent;
  addGroupBtn.textContent = "Custom groups aren't available yet";
  setTimeout(() => (addGroupBtn.textContent = original), 1800);
});

function openModal(task, presetStatus) {
  editingId = task ? task.id : null;
  modalTitle.textContent = task ? "Edit task" : "New task";
  fieldTitle.value = task ? task.title : "";
  fieldDescription.value = task ? task.description || "" : "";
  fieldDueDate.value = task ? task.due_date || "" : "";
  fieldPriority.value = task ? task.priority : "normal";
  fieldStatus.value = task ? task.status : presetStatus || "todo";
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
    status: fieldStatus.value,
  };
  if (!payload.title) return;

  const { error } = editingId
    ? await sb.from("tasks").update(payload).eq("id", editingId)
    : await sb.from("tasks").insert(payload);

  if (error) {
    console.error(error);
    return;
  }
  closeModal();
  fetchTasks();
});

deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("Delete this task?")) return;
  const { error } = await sb.from("tasks").delete().eq("id", editingId);
  if (error) {
    console.error(error);
    return;
  }
  closeModal();
  fetchTasks();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
});

todayDateEl.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

fetchTasks();