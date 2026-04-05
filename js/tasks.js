// ===== tasks.js — Kanban board & list view =====

import { escapeHtml } from './ui.js';
import { trackAnalytics } from './analytics.js';
import { checkBadges } from './badges.js';
import { showCyberLoader, hideCyberLoader } from './loader.js';
import { getFullApiUrl, fetchWithRetry } from './api.js';
import { showStatus, setSyncStatus } from './ui.js';
import { showAuthError } from './config.js';

// Module-level state (internal)
let sections = [];
let tasks    = {};
let hasChanges   = false;
let currentView  = 'board';
let quickAddSection = null;
let _prevCheckedCount = 0;

// Config ref (set on init)
let _config = null;

export function initTasks(config) {
  _config = config;

  const listViewBtn  = document.getElementById('listViewBtn');
  const boardViewBtn = document.getElementById('boardViewBtn');
  const saveBtn      = document.getElementById('saveBtn');

  listViewBtn?.addEventListener('click',  () => switchTaskView('list'));
  boardViewBtn?.addEventListener('click', () => switchTaskView('board'));

  saveBtn?.addEventListener('click', saveTasksToHackMD);

  window.addEventListener('beforeunload', (e) => {
    if (hasChanges) { e.preventDefault(); e.returnValue = ''; }
  });
}

// ── Parsing & Serialisation ───────────────────────────────────────

function taskSectionId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseTaskMarkdown(content) {
  const resultSections = [];
  const resultTasks    = {};
  let currentSection   = null;
  let currentSectionId = null;
  let currentTask      = null;

  for (const line of content.split('\n')) {
    const headerMatch = line.match(/^## \*{0,2}(.+?)\*{0,2}$/);
    if (headerMatch) {
      if (currentTask && currentSectionId) { resultTasks[currentSectionId].push(currentTask); currentTask = null; }
      const sectionName = headerMatch[1].trim();
      currentSectionId  = taskSectionId(sectionName);
      currentSection    = sectionName;
      if (!resultTasks[currentSectionId]) {
        resultSections.push({ id: currentSectionId, name: sectionName });
        resultTasks[currentSectionId] = [];
      }
    } else if (currentSectionId && line.match(/^- \[[ xX]\]/)) {
      if (currentTask) resultTasks[currentSectionId].push(currentTask);
      const checked    = line.match(/\[[xX]\]/) !== null;
      let text         = line.replace(/^- \[[ xX]\]\s*/, '');
      let title        = text;
      let note         = '';
      const boldMatch  = text.match(/^\*\*(.+?)\*\*(.*)$/);
      if (boldMatch) { title = boldMatch[1]; note = boldMatch[2].replace(/^\s*-\s*/, '').trim(); }
      currentTask = { id: Date.now() + Math.random(), title, note, checked, subtasks: [], section: currentSectionId };
    } else if (currentTask && line.match(/^\s+- \[[ xX]\]/)) {
      const checked = line.match(/\[[xX]\]/) !== null;
      const text    = line.replace(/^\s+- \[[ xX]\]\s*/, '');
      currentTask.subtasks.push({ text, checked });
    }
  }
  if (currentTask && currentSectionId) resultTasks[currentSectionId].push(currentTask);
  return { sections: resultSections, tasks: resultTasks };
}

function toMarkdown() {
  let md = '# Tasks\n';
  sections.forEach(section => {
    md += `\n## ${section.name}\n`;
    (tasks[section.id] || []).forEach(t => {
      const checkbox = t.checked ? '[x]' : '[ ]';
      const note     = t.note ? ` - ${t.note}` : '';
      md += `- ${checkbox} **${t.title}**${note}\n`;
      t.subtasks.forEach(st => {
        md += `  - ${st.checked ? '[x]' : '[ ]'} ${st.text}\n`;
      });
    });
  });
  return md.trimEnd() + '\n';
}

// ── Mutation helpers ──────────────────────────────────────────────

export function markChanged() {
  hasChanges = true;
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.disabled = false;
}

export function renderTasks() {
  if (currentView === 'board') renderBoard();
  else                         renderList();
  trackTaskCompletions();
}

function trackTaskCompletions() {
  let checked = 0;
  sections.forEach(s => { (tasks[s.id] || []).forEach(t => { if (t.checked) checked++; }); });
  if (checked > _prevCheckedCount) { trackAnalytics('tasks_done', checked - _prevCheckedCount); checkBadges(); }
  _prevCheckedCount = checked;
}

// ── Board view ────────────────────────────────────────────────────

function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';
  sections.forEach(section => {
    board.appendChild(createColumn(section.id, section.name, tasks[section.id] || []));
  });
  const addSectionBtn = document.createElement('div');
  addSectionBtn.className = 'column';
  addSectionBtn.style.cssText = 'background: transparent; border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; min-height: 120px;';
  addSectionBtn.innerHTML = '<span style="color: var(--text-muted); font-size: 14px; font-weight: 500;">+ Add Section</span>';
  addSectionBtn.addEventListener('click', () => startAddingSection(addSectionBtn));
  board.appendChild(addSectionBtn);
}

function createColumn(id, title, items) {
  const col = document.createElement('div');
  col.className = 'column';
  col.innerHTML = `
    <div class="column-header">
      <span class="column-title" data-section-id="${id}" style="cursor: pointer;">${escapeHtml(title)}</span>
      <span class="count">${items.length}</span>
    </div>
    <div class="cards" data-column="${id}"></div>
    <div class="add-card">
      <button data-add="${id}">+ Add task</button>
    </div>
  `;

  col.querySelector('.column-title').addEventListener('click', (e) => {
    if (!col.dragging) startEditingColumnTitle(e.target, id);
  });

  const header = col.querySelector('.column-header');
  header.draggable = true;
  const board = document.getElementById('board');

  header.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    col.classList.add('dragging-column');
    e.dataTransfer.setData('text/column', id);
    e.dataTransfer.effectAllowed = 'move';
  });
  header.addEventListener('dragend', () => {
    col.classList.remove('dragging-column');
    board?.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
  });

  col.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('text/column')) {
      e.preventDefault(); e.stopPropagation();
      board?.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
      const indicator = document.createElement('div');
      indicator.className = 'column-drop-indicator';
      const rect = col.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) col.before(indicator);
      else col.after(indicator);
    }
  });

  col.addEventListener('drop', (e) => {
    if (e.dataTransfer.types.includes('text/column')) {
      e.preventDefault(); e.stopPropagation();
      const fromId = e.dataTransfer.getData('text/column');
      if (fromId !== id) {
        const rect = col.getBoundingClientRect();
        moveSection(fromId, id, e.clientX < rect.left + rect.width / 2);
      }
      board?.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
    }
  });

  const cardsContainer = col.querySelector('.cards');
  items.forEach(task => cardsContainer.appendChild(createCard(task)));

  const getDropPosition = (e) => {
    const allCards    = [...cardsContainer.querySelectorAll('.task-card')];
    const visCards    = allCards.filter(c => !c.classList.contains('dragging'));
    let insertBeforeCard = null, dropIndex = visCards.length;
    for (let i = 0; i < visCards.length; i++) {
      const rect = visCards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) { insertBeforeCard = visCards[i]; dropIndex = i; break; }
    }
    return { insertBeforeCard, dropIndex };
  };

  const showDropIndicator = (e) => {
    col.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    const { insertBeforeCard } = getDropPosition(e);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.cssText = 'height: 3px; background: var(--accent); border-radius: 2px; margin: 5px 0;';
    if (insertBeforeCard) cardsContainer.insertBefore(indicator, insertBeforeCard);
    else                  cardsContainer.appendChild(indicator);
  };

  col.addEventListener('dragover', (e) => {
    e.preventDefault();
    cardsContainer.classList.add('drag-over');
    showDropIndicator(e);
  });
  col.addEventListener('dragleave', (e) => {
    if (!col.contains(e.relatedTarget)) {
      cardsContainer.classList.remove('drag-over');
      col.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    }
  });
  col.addEventListener('drop', (e) => {
    e.preventDefault();
    cardsContainer.classList.remove('drag-over');
    col.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    const taskId = parseFloat(e.dataTransfer.getData('text/plain'));
    if (taskId) moveTask(taskId, id, getDropPosition(e).dropIndex);
  });

  col.querySelector(`[data-add="${id}"]`).addEventListener('click', () => {
    addNewTask(id, col.querySelector('.cards'));
  });

  return col;
}

function createCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable  = true;
  card.dataset.id = task.id;

  let html = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <button class="delete-btn" data-action="delete" title="Delete task">&times;</button>
      <span class="checkbox ${task.checked ? 'checked' : ''}" data-action="toggle"></span>
      <div class="card-title" data-action="edit-title">${escapeHtml(task.title)}</div>
    </div>
  `;
  if (task.note) {
    html += `<div class="card-note" data-action="edit-note" style="cursor: pointer; margin-left: 30px;">${escapeHtml(task.note)}</div>`;
  } else {
    html += `<div class="card-note add-on-hover" data-action="edit-note" style="cursor: pointer; margin-left: 30px; font-style: italic;">+ Add note</div>`;
  }
  if (task.subtasks.length > 0) {
    html += '<div class="card-subtasks" style="margin-left: 30px;">';
    task.subtasks.forEach((st, idx) => {
      html += `<div class="subtask">
        <span class="checkbox ${st.checked ? 'checked' : ''}" data-action="toggle-sub" data-idx="${idx}" style="width:16px;height:16px;min-width:16px;min-height:16px;"></span>
        <span data-action="edit-subtask" data-idx="${idx}" style="cursor:pointer;">${escapeHtml(st.text)}</span>
      </div>`;
    });
    html += `<div class="subtask add-on-hover" data-action="add-subtask" style="color:var(--text-muted);cursor:pointer;font-style:italic;padding-left:24px;">+ Add subtask</div>`;
    html += '</div>';
  } else {
    html += `<div class="card-subtasks add-on-hover" style="margin-left:30px;">
      <div class="subtask" data-action="add-subtask" style="color:var(--text-muted);cursor:pointer;font-style:italic;">+ Add subtask</div>
    </div>`;
  }
  card.innerHTML = html;

  card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', task.id); });
  card.addEventListener('dragend',   () => card.classList.remove('dragging'));
  card.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'toggle')       { task.checked = !task.checked; markChanged(); renderTasks(); }
    else if (action === 'toggle-sub') { const idx = parseInt(e.target.dataset.idx); task.subtasks[idx].checked = !task.subtasks[idx].checked; markChanged(); renderTasks(); }
    else if (action === 'edit-title')   startEditingTitle(e.target, task);
    else if (action === 'edit-note')    startEditingNote(e.target, task);
    else if (action === 'edit-subtask') startEditingSubtask(e.target, task, parseInt(e.target.dataset.idx));
    else if (action === 'add-subtask')  startAddingSubtask(e.target, task);
    else if (action === 'delete')       deleteTask(task);
  });
  return card;
}

// ── List view ─────────────────────────────────────────────────────

function renderList() {
  const listView = document.getElementById('listView');
  if (!listView) return;
  listView.innerHTML = '';
  if (!quickAddSection && sections.length > 0) quickAddSection = sections[0].id;

  const quickAdd    = document.createElement('div');
  quickAdd.className = 'quick-add';
  quickAdd.style.cssText = 'border-bottom: 2px solid var(--border); margin-bottom: 24px; padding-bottom: 16px;';
  const sectionName = sections.find(s => s.id === quickAddSection)?.name || 'Select section';
  quickAdd.innerHTML = `
    <span class="checkbox" style="opacity: 0.3;"></span>
    <input type="text" class="quick-add-input" placeholder="Add a task..." id="quickAddInput">
    <span class="quick-add-section" id="quickAddSectionBtn">${escapeHtml(sectionName)}</span>
  `;
  listView.appendChild(quickAdd);

  const quickInput  = document.getElementById('quickAddInput');
  const sectionBtn  = document.getElementById('quickAddSectionBtn');
  quickInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quickInput.value.trim()) {
      const title = quickInput.value.trim();
      if (!tasks[quickAddSection]) tasks[quickAddSection] = [];
      tasks[quickAddSection].unshift({ id: Date.now() + Math.random(), title, note: '', checked: false, subtasks: [], section: quickAddSection });
      quickInput.value = '';
      markChanged();
      renderTasks();
      setTimeout(() => document.getElementById('quickAddInput')?.focus(), 10);
    }
  });
  sectionBtn?.addEventListener('click', (e) => showSectionPicker(e.target));

  sections.forEach(section => {
    const sectionTasks = tasks[section.id] || [];
    const sectionEl    = document.createElement('div');
    sectionEl.className    = 'list-section';
    sectionEl.dataset.sectionId = section.id;

    const header = document.createElement('div');
    header.className = 'list-section-header';
    header.innerHTML = `
      <span class="section-title" data-section-id="${section.id}">${escapeHtml(section.name)}</span>
      <span class="count">${sectionTasks.length}</span>
    `;
    header.querySelector('.section-title').addEventListener('click', (e) => {
      startEditingListSectionTitle(e.target, section);
    });
    sectionEl.appendChild(header);

    const tasksContainer = document.createElement('div');
    tasksContainer.className      = 'list-tasks-container';
    tasksContainer.dataset.sectionId = section.id;
    sectionTasks.forEach(task => tasksContainer.appendChild(createListItem(task, section)));
    sectionEl.appendChild(tasksContainer);

    const getDropPos = (e, container) => {
      const items = [...container.querySelectorAll('.list-item:not(.dragging)')];
      let insertBeforeEl = null, dropIndex = items.length;
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { insertBeforeEl = items[i]; dropIndex = i; break; }
      }
      return { insertBeforeEl, dropIndex };
    };
    const showListDropIndicator = (e) => {
      tasksContainer.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
      const { insertBeforeEl } = getDropPos(e, tasksContainer);
      const indicator = document.createElement('div');
      indicator.className = 'list-drop-indicator';
      if (insertBeforeEl) tasksContainer.insertBefore(indicator, insertBeforeEl);
      else                tasksContainer.appendChild(indicator);
    };
    sectionEl.addEventListener('dragover', (e) => { e.preventDefault(); sectionEl.classList.add('drag-over'); showListDropIndicator(e); });
    sectionEl.addEventListener('dragleave', (e) => {
      if (!sectionEl.contains(e.relatedTarget)) {
        sectionEl.classList.remove('drag-over');
        tasksContainer.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
      }
    });
    sectionEl.addEventListener('drop', (e) => {
      e.preventDefault();
      sectionEl.classList.remove('drag-over');
      tasksContainer.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
      const taskId = parseFloat(e.dataTransfer.getData('text/plain'));
      if (!taskId) return;
      moveTask(taskId, section.id, getDropPos(e, tasksContainer).dropIndex);
    });

    listView.appendChild(sectionEl);
  });

  const addSectionBtn = document.createElement('div');
  addSectionBtn.className = 'list-add-section';
  addSectionBtn.textContent = '+ Add Section';
  addSectionBtn.addEventListener('click', () => startAddingListSection(addSectionBtn));
  listView.appendChild(addSectionBtn);
}

function createListItem(task, section) {
  const item     = document.createElement('div');
  item.className = 'list-item';
  item.draggable  = true;
  item.dataset.taskId = task.id;

  item.addEventListener('dragstart', (e) => { item.classList.add('dragging'); e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; });
  item.addEventListener('dragend',   () => { item.classList.remove('dragging'); document.querySelectorAll('.list-drop-indicator').forEach(el => el.remove()); document.querySelectorAll('.list-section.drag-over').forEach(el => el.classList.remove('drag-over')); });

  const checkbox = document.createElement('span');
  checkbox.className = `checkbox ${task.checked ? 'checked' : ''}`;
  checkbox.addEventListener('click', (e) => { e.stopPropagation(); task.checked = !task.checked; markChanged(); renderTasks(); });

  const content = document.createElement('div');
  content.className = 'list-item-content';

  const title = document.createElement('div');
  title.className = `list-item-title ${task.checked ? 'checked' : ''}`;
  title.textContent = task.title;
  title.addEventListener('click', (e) => { e.stopPropagation(); startEditingListItem(title, task); });
  content.appendChild(title);

  if (task.note) {
    const note = document.createElement('div');
    note.className = 'list-item-note';
    note.textContent = task.note;
    note.addEventListener('click', (e) => { e.stopPropagation(); startEditingListNote(note, task); });
    content.appendChild(note);
  } else {
    const addNote = document.createElement('div');
    addNote.className = 'list-item-note add-note';
    addNote.textContent = '+ Add note';
    addNote.addEventListener('click', (e) => { e.stopPropagation(); startEditingListNote(addNote, task); });
    content.appendChild(addNote);
  }

  if (task.subtasks && task.subtasks.length > 0) {
    const subtasksContainer = document.createElement('div');
    subtasksContainer.className = 'list-item-subtasks';
    task.subtasks.forEach((st, idx) => {
      const subtaskEl  = document.createElement('div');
      subtaskEl.className = 'list-item-subtask';
      const stCheckbox = document.createElement('span');
      stCheckbox.className = `checkbox ${st.checked ? 'checked' : ''}`;
      stCheckbox.addEventListener('click', (e) => { e.stopPropagation(); st.checked = !st.checked; markChanged(); renderTasks(); });
      const stText = document.createElement('span');
      stText.textContent = st.text;
      if (st.checked) { stText.style.textDecoration = 'line-through'; stText.style.color = 'var(--text-muted)'; }
      stText.addEventListener('click', (e) => { e.stopPropagation(); startEditingListSubtask(stText, task, idx); });
      subtaskEl.appendChild(stCheckbox);
      subtaskEl.appendChild(stText);
      subtasksContainer.appendChild(subtaskEl);
    });
    content.appendChild(subtasksContainer);
  }

  const addSubtask = document.createElement('div');
  addSubtask.className = 'list-item-add-subtask';
  addSubtask.textContent = '+ Add subtask';
  addSubtask.addEventListener('click', (e) => { e.stopPropagation(); startAddingListSubtask(addSubtask, task); });
  content.appendChild(addSubtask);

  const actions = document.createElement('div');
  actions.className = 'list-item-actions';
  actions.innerHTML = '<button title="Delete task">&times;</button>';
  actions.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task); });

  item.appendChild(checkbox);
  item.appendChild(content);
  item.appendChild(actions);
  return item;
}

// ── Inline editing helpers ────────────────────────────────────────

function makeInlineInput(type, value, style, onSave, onEscape) {
  const input = document.createElement('input');
  input.type  = type;
  input.value = value;
  input.style.cssText = style;
  let saved = false;
  const commit = () => { if (saved) return; saved = true; onSave(input.value); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { saved = true; onEscape?.(); renderTasks(); }
  });
  input.addEventListener('blur', commit);
  return input;
}

const CARD_INPUT_STYLE  = 'width:100%;background:var(--bg-card);border:2px solid var(--accent);border-radius:6px;padding:6px 10px;color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;';
const NOTE_INPUT_STYLE  = 'width:100%;background:var(--bg-card);border:2px solid var(--accent);border-radius:6px;padding:4px 8px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;';
const SUB_INPUT_STYLE   = 'width:calc(100% - 30px);background:var(--bg-card);border:2px solid var(--accent);border-radius:4px;padding:2px 6px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;';

function startEditingTitle(titleEl, task) {
  const input = makeInlineInput('text', task.title, CARD_INPUT_STYLE, (val) => {
    const v = val.trim();
    if (v && v !== task.title) { task.title = v; markChanged(); }
    renderTasks();
  });
  titleEl.replaceWith(input); input.focus(); input.select();
}

function startEditingNote(noteEl, task) {
  const input = makeInlineInput('text', task.note || '', NOTE_INPUT_STYLE, (val) => {
    task.note = val.trim(); markChanged(); renderTasks();
  });
  input.placeholder = 'Add a note...';
  noteEl.replaceWith(input); input.focus();
}

function startEditingSubtask(subtaskEl, task, idx) {
  const input = makeInlineInput('text', task.subtasks[idx].text, SUB_INPUT_STYLE, (val) => {
    const v = val.trim();
    if (v) task.subtasks[idx].text = v; else task.subtasks.splice(idx, 1);
    markChanged(); renderTasks();
  });
  subtaskEl.replaceWith(input); input.focus(); input.select();
}

function startAddingSubtask(el, task) {
  const input = makeInlineInput('text', '', 'width:calc(100% - 10px);background:var(--bg-card);border:2px solid var(--accent);border-radius:4px;padding:2px 6px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;', (val) => {
    const v = val.trim();
    if (v) { task.subtasks.push({ text: v, checked: false }); markChanged(); }
    renderTasks();
  });
  input.placeholder = 'New subtask...';
  el.replaceWith(input); input.focus();
}

function startEditingColumnTitle(titleEl, colId) {
  const section = sections.find(s => s.id === colId);
  if (!section) return;
  const style = 'width:180px;background:var(--bg-card);border:2px solid var(--accent);border-radius:6px;padding:4px 10px;color:var(--text-primary);font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;font-family:inherit;outline:none;';
  const input = makeInlineInput('text', section.name, style, (val) => {
    const newName = val.trim();
    if (newName && newName !== section.name) {
      const oldId = section.id;
      section.name = newName;
      const newId = taskSectionId(newName);
      if (newId !== oldId) { tasks[newId] = tasks[oldId] || []; delete tasks[oldId]; tasks[newId].forEach(t => t.section = newId); section.id = newId; }
      markChanged();
    }
    renderTasks();
  });
  titleEl.replaceWith(input); input.focus(); input.select();
}

function startEditingListSectionTitle(titleEl, section) {
  const style = 'width:200px;background:var(--bg-card);border:2px solid var(--accent);border-radius:6px;padding:4px 10px;color:var(--text-primary);font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;font-family:inherit;outline:none;';
  const input = makeInlineInput('text', section.name, style, (val) => {
    const newName = val.trim();
    if (newName && newName !== section.name) {
      const oldId = section.id;
      section.name = newName;
      const newId = taskSectionId(newName);
      if (newId !== oldId) { tasks[newId] = tasks[oldId] || []; delete tasks[oldId]; tasks[newId].forEach(t => t.section = newId); section.id = newId; }
      markChanged();
    }
    renderTasks();
  });
  titleEl.replaceWith(input); input.focus(); input.select();
}

function startEditingListNote(noteEl, task) {
  const input = makeInlineInput('text', task.note || '', NOTE_INPUT_STYLE, (val) => {
    task.note = val.trim(); markChanged(); renderTasks();
  });
  input.placeholder = 'Add a note...';
  noteEl.replaceWith(input); input.focus();
}

function startEditingListSubtask(subtaskEl, task, idx) {
  const input = makeInlineInput('text', task.subtasks[idx].text, SUB_INPUT_STYLE, (val) => {
    const v = val.trim();
    if (v) task.subtasks[idx].text = v; else task.subtasks.splice(idx, 1);
    markChanged(); renderTasks();
  });
  subtaskEl.replaceWith(input); input.focus(); input.select();
}

function startAddingListSubtask(el, task) {
  const input = makeInlineInput('text', '', 'width:calc(100% - 10px);background:var(--bg-card);border:2px solid var(--accent);border-radius:4px;padding:2px 6px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;', (val) => {
    const v = val.trim();
    if (v) { if (!task.subtasks) task.subtasks = []; task.subtasks.push({ text: v, checked: false }); markChanged(); }
    renderTasks();
  });
  input.placeholder = 'New subtask...';
  el.replaceWith(input); input.focus();
}

function startEditingListItem(titleEl, task) {
  const style = 'width:100%;background:var(--bg-card);border:2px solid var(--accent);border-radius:6px;padding:8px 12px;color:var(--text-primary);font-size:15px;font-family:inherit;outline:none;';
  const input = makeInlineInput('text', task.title, style, (val) => {
    const v = val.trim();
    if (v && v !== task.title) { task.title = v; markChanged(); }
    renderTasks();
  });
  titleEl.replaceWith(input); input.focus(); input.select();
}

// ── Data mutations ────────────────────────────────────────────────

function addNewTask(sectionId, container) {
  const existing = container.querySelector('.new-task-input');
  if (existing) return;
  const input = document.createElement('textarea');
  input.className   = 'new-task-input';
  input.placeholder = 'What needs to be done?';
  input.rows        = 2;
  container.appendChild(input); input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const title = input.value.trim();
      if (title) {
        if (!tasks[sectionId]) tasks[sectionId] = [];
        tasks[sectionId].push({ id: Date.now() + Math.random(), title, note: '', checked: false, subtasks: [], section: sectionId });
        markChanged(); renderTasks();
      } else { input.remove(); }
    } else if (e.key === 'Escape') { input.remove(); }
  });
  input.addEventListener('blur', () => setTimeout(() => input.remove(), 100));
}

function moveSection(fromId, toId, insertBefore) {
  const fromIdx = sections.findIndex(s => s.id === fromId);
  const toIdx   = sections.findIndex(s => s.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [section] = sections.splice(fromIdx, 1);
  let newIdx = sections.findIndex(s => s.id === toId);
  if (!insertBefore) newIdx++;
  sections.splice(newIdx, 0, section);
  markChanged(); renderTasks();
}

function moveTask(taskId, toSectionId, dropIndex = -1) {
  let task = null;
  for (const section of sections) {
    const sectionTasks = tasks[section.id] || [];
    const idx          = sectionTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) { task = sectionTasks.splice(idx, 1)[0]; break; }
  }
  if (!task) return;
  task.section = toSectionId;
  if (!tasks[toSectionId]) tasks[toSectionId] = [];
  if (dropIndex >= 0 && dropIndex <= tasks[toSectionId].length) tasks[toSectionId].splice(dropIndex, 0, task);
  else tasks[toSectionId].push(task);
  markChanged(); renderTasks();
}

function deleteTask(task) {
  if (!confirm(`Delete "${task.title}"?`)) return;
  for (const section of sections) {
    const arr = tasks[section.id] || [];
    const idx = arr.findIndex(t => t.id === task.id);
    if (idx !== -1) { arr.splice(idx, 1); break; }
  }
  markChanged(); renderTasks();
}

function startAddingSection(btn) {
  const input = document.createElement('input');
  input.type        = 'text';
  input.placeholder = 'Section name...';
  input.style.cssText = 'width:220px;background:var(--bg-card);border:2px solid var(--accent);border-radius:8px;padding:10px 14px;color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;';
  btn.innerHTML    = '';
  btn.style.cssText = 'background:var(--bg-secondary);border:2px dashed var(--accent);display:flex;align-items:center;justify-content:center;cursor:default;min-height:120px;min-width:340px;border-radius:12px;';
  btn.appendChild(input); input.focus();
  let saved = false;
  const saveSection = () => {
    if (saved) return; saved = true;
    const name = input.value.trim();
    if (name) { const id = taskSectionId(name); if (!tasks[id]) { sections.push({ id, name }); tasks[id] = []; markChanged(); } }
    renderTasks();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveSection(); } else if (e.key === 'Escape') { saved = true; renderTasks(); } });
  input.addEventListener('blur', saveSection);
}

function startAddingListSection(btn) {
  const input = document.createElement('input');
  input.type        = 'text';
  input.placeholder = 'Section name...';
  input.style.cssText = 'width:100%;background:var(--bg-card);border:2px solid var(--accent);border-radius:8px;padding:12px 16px;color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;text-align:left;';
  btn.innerHTML    = '';
  btn.style.border = '2px solid var(--accent)';
  btn.style.cursor = 'default';
  btn.appendChild(input); input.focus();
  let saved = false;
  const saveSection = () => {
    if (saved) return; saved = true;
    const name = input.value.trim();
    if (name) { const id = taskSectionId(name); if (!tasks[id]) { sections.push({ id, name }); tasks[id] = []; markChanged(); } }
    renderTasks();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveSection(); } else if (e.key === 'Escape') { saved = true; renderTasks(); } });
  input.addEventListener('blur', saveSection);
}

function showSectionPicker(anchorEl) {
  document.querySelectorAll('.section-picker').forEach(el => el.remove());
  const picker = document.createElement('div');
  picker.className = 'section-picker';
  const rect = anchorEl.getBoundingClientRect();
  picker.style.top   = (rect.bottom + 4) + 'px';
  picker.style.right = (window.innerWidth - rect.right) + 'px';
  sections.forEach(section => {
    const btn = document.createElement('button');
    btn.textContent = section.name;
    btn.addEventListener('click', () => { quickAddSection = section.id; picker.remove(); renderTasks(); setTimeout(() => document.getElementById('quickAddInput')?.focus(), 10); });
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', function closeHandler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', closeHandler); }
    });
  }, 10);
}

function switchTaskView(view) {
  currentView = view;
  const listView  = document.getElementById('listView');
  const board     = document.getElementById('board');
  const listBtn   = document.getElementById('listViewBtn');
  const boardBtn  = document.getElementById('boardViewBtn');
  if (view === 'list') {
    if (listView) listView.style.display = 'block';
    if (board)    board.style.display    = 'none';
    listBtn?.classList.add('active');
    boardBtn?.classList.remove('active');
  } else {
    if (listView) listView.style.display = 'none';
    if (board)    board.style.display    = 'flex';
    listBtn?.classList.remove('active');
    boardBtn?.classList.add('active');
  }
  renderTasks();
}

// ── HackMD API ────────────────────────────────────────────────────

export async function loadTasksFromAPI(config) {
  _config = config;
  if (!config.API_TOKEN) { showStatus('Error: HackMD API Token is not configured'); return; }
  setSyncStatus('⟳ Loading…');
  try {
    const res = await fetch(getFullApiUrl(`/notes/${config.TASKS_NOTE_ID}`, config), {
      headers: { 'Authorization': 'Bearer ' + config.API_TOKEN }
    });
    if (!res.ok) {
      if (res.status === 401) { showAuthError(config); throw new Error('Unauthorized: Please check your API token'); }
      throw new Error('Failed to load from HackMD');
    }
    const data   = await res.json();
    const result = parseTaskMarkdown(data.content);
    sections     = result.sections;
    tasks        = result.tasks;
    hasChanges   = false;
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.disabled = true;
    switchTaskView('board');
    const emptyState = document.getElementById('boardEmptyState');
    if (emptyState) emptyState.style.display = 'none';
    setSyncStatus('✓ Synced with HackMD', 'var(--accent)');
    setTimeout(() => setSyncStatus(''), 3000);
  } catch (e) {
    setSyncStatus('⚠ Load failed', '#e55');
    showStatus('Error loading tasks: ' + e.message);
  }
}

async function saveTasksToHackMD() {
  if (!hasChanges) return;
  if (!_config.API_TOKEN) { showStatus('Error: HackMD API Token is not configured'); return; }
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  setSyncStatus('⟳ Saving…');
  showCyberLoader('Uploading Tasks');
  try {
    const res = await fetchWithRetry(getFullApiUrl(`/notes/${_config.TASKS_NOTE_ID}`, _config), {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + _config.API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: toMarkdown() })
    });
    if (!res.ok) throw new Error('Save failed');
    hasChanges = false;
    showStatus('Saved to HackMD ✓');
    setSyncStatus('✓ Saved', 'var(--accent)');
    setTimeout(() => setSyncStatus(''), 3000);
  } catch (e) {
    showStatus('Error saving: ' + e.message);
    setSyncStatus('⚠ Save failed', '#e55');
    if (saveBtn) saveBtn.disabled = false;
  }
  hideCyberLoader();
  if (saveBtn) saveBtn.textContent = 'Save to HackMD';
}

// ── Quick-capture integration ─────────────────────────────────────
// Called by capture.js to prepend a task
export function addCapturedTask(title) {
  if (sections.length > 0) {
    const firstSec = sections[0].id;
    if (!tasks[firstSec]) tasks[firstSec] = [];
    tasks[firstSec].unshift({ id: Date.now() + Math.random(), title, note: '', checked: false, subtasks: [], section: firstSec });
    markChanged();
  }
}

export function getSections() { return sections; }
