const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const PALETTE = ["#9a9a9a", "#6ba5c9", "#c98b6b", "#8bc98f", "#c9c26b", "#a06bc9", "#c96b8f"];

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

let editingId = null;
let cachedWorkspaces = [];
let cachedGroups = [];
let cachedTasks = [];
let currentWorkspaceId = localStorage.getItem("ledger_workspace_id") || null;
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

function dueState(dateStr, isDoneGroup) {
  if (!dateStr || isDoneGroup) return "";
  if (dateStr < todayISO()) return "overdue";
  if (dateStr === todayISO()) return "today";
  return "";
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
  renderWorkspaceList();
}

function renderWorkspaceList() {
  workspaceListEl.innerHTML = "";
  cachedWorkspaces.forEach((ws) => {
    const a = document.createElement("a");
    a.href = "#";
    a.className = `board-item${ws.id === currentWorkspaceId ? " active" : ""}`;
    a.textContent = ws.name;
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
  if (current) boardTitleEl.textContent = current.name;
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
  const visible = term ? cachedTasks.filter((t) => t.title.toLowerCase().includes(term)) : cachedTasks;

  cachedGroups.forEach((group, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const groupTasks = visible.filter((t) => t.group_id === group.id);

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
        if (!confirm(`Delete "${group.name}"? Tasks inside will also be deleted.`)) return;
        const { error } = await sb.from("groups").delete().eq("id", group.id);
        if (error) {
          console.error(error);
          return;
        }
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
        fetchTasks();
      }
    });

    groupsContainer.appendChild(section);
  });

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
  const name = prompt("New group name:");
  if (!name || !name.trim()) return;
  const isDone = confirm("Should tasks moved into this group count as completed (like a \"Done\" column)?");
  const nextPos = cachedGroups.length ? Math.max(...cachedGroups.map((g) => g.position)) + 1 : 0;
  const { error } = await sb
    .from("groups")
    .insert({ workspace_id: currentWorkspaceId, name: name.trim(), is_done_group: isDone, position: nextPos });
  if (error) {
    console.error(error);
    return;
  }
  await loadBoard();
});

// Add workspace (board)
addWorkspaceBtn.addEventListener("click", async () => {
  const name = prompt("New board name:");
  if (!name || !name.trim()) return;
  const nextPos = cachedWorkspaces.length ? Math.max(...cachedWorkspaces.map((w) => w.position)) + 1 : 0;
  const { data: ws, error } = await sb
    .from("workspaces")
    .insert({ name: name.trim(), position: nextPos })
    .select()
    .single();
  if (error) {
    console.error(error);
    return;
  }
  await seedDefaultGroups(ws.id);
  cachedWorkspaces.push(ws);
  currentWorkspaceId = ws.id;
  localStorage.setItem("ledger_workspace_id", currentWorkspaceId);
  renderWorkspaceList();
  await loadBoard();
});

// Search
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderBoard();
});

function openModal(task, presetGroupId) {
  editingId = task ? task.id : null;
  modalTitle.textContent = task ? "Edit task" : "New task";
  fieldTitle.value = task ? task.title : "";
  fieldDescription.value = task ? task.description || "" : "";
  fieldDueDate.value = task ? task.due_date || "" : "";
  fieldPriority.value = task ? task.priority : "normal";

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

(async function init() {
  await loadWorkspaces();
  await loadBoard();
})();
