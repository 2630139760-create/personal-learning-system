import {
  STATUS, STUDY_MODULES, calculateStats, conflictsFor, effectiveTemplate,
  isStudy, plannedSeconds, taskActualSeconds, clone, sessionFromTimer, validateTemplateTasks
} from './model.js';
import * as db from './storage.js';

const $ = selector => document.querySelector(selector);
const fmtDate = date => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);
const todayBJ = () => fmtDate(new Date());
const uid = prefix => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const MODULES = ['生活', ...STUDY_MODULES];
const state = {
  date: todayBJ(), day: null, sessions: [], selected: null, timer: null,
  pendingImport: null, templates: [], templateDraft: [], templateDirty: false,
  taskFormInitial: '', deleteSessionId: null, savingTimer: false
};

const duration = seconds => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  if (hours) return `${hours}小时${minutes ? `${minutes}分` : ''}${secs ? `${secs}秒` : ''}`;
  if (minutes) return `${minutes}分${secs ? `${secs}秒` : ''}`;
  return `${secs}秒`;
};
const clock = seconds => {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
};
const elapsed = timer => timer
  ? timer.accumulatedSeconds + (timer.runningSince ? Math.max(0, Math.floor((Date.now() - timer.runningSince) / 1000)) : 0)
  : 0;
const escapeHtml = (value = '') => { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; };
const escapeAttr = (value = '') => escapeHtml(value).replaceAll('"', '&quot;');

function notify(message, error = false) {
  const banner = $('#banner');
  banner.textContent = message;
  banner.className = `banner ${error ? 'error' : ''}`;
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => banner.classList.add('hidden'), 5000);
}
async function persistDay(message = '已保存到此设备') {
  try { await db.saveDay(state.day); notify(message); }
  catch (error) { notify(`保存失败，输入仍保留在页面中：${error.message}`, true); throw error; }
}
function dateLabel(date) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' })
    .format(new Date(`${date}T12:00:00+08:00`));
}

async function loadDate(date) {
  state.date = date;
  state.templates = await db.getTemplates();
  const template = effectiveTemplate(state.templates, date);
  state.day = await db.getDay(date, template);
  state.sessions = await db.getSessions(date);
  state.timer = await db.getTimer();
  // Timers created by the first release did not have an explicit phase.
  if (state.timer && !state.timer.phase) state.timer.phase = 'timing';
  state.selected = state.day.tasks.some(task => task.id === state.selected) ? state.selected : null;
  render();
  if (state.timer?.phase === 'confirming') showTimerConfirmation();
}

function render() {
  $('#datePicker').value = state.date;
  $('#dateTitle').textContent = state.date === todayBJ() ? '今日计划' : '计划与记录';
  $('#weekday').textContent = dateLabel(state.date);
  const stats = calculateStats(state.day.tasks, state.sessions);
  $('#stats').innerHTML = `
    <div class="progress-ring"><b>${stats.done}<small> / ${stats.total}</small></b><span>完成学习任务</span></div>
    <div class="stat"><span>待完善</span><b>${stats.improve}</b></div>
    <div class="stat"><span>计划学习</span><b>${duration(stats.planned)}</b></div>
    <div class="stat accent"><span>实际学习</span><b>${duration(stats.actual)}</b></div>`;

  const tasks = [...state.day.tasks].sort((a, b) => a.start.localeCompare(b.start));
  $('#schedule').innerHTML = tasks.map(task => {
    const active = state.timer?.taskId === task.id && state.timer?.date === state.date;
    const pending = active && state.timer.phase === 'confirming';
    const actual = taskActualSeconds(task.id, state.sessions) + (active && !pending ? elapsed(state.timer) : 0);
    return `<button class="task-card ${state.selected === task.id ? 'selected' : ''} ${active ? 'timing' : ''}" data-id="${task.id}">
      <span class="time"><b>${task.start}</b><small>${task.kind === 'range' ? task.end : task.kind === 'open' ? '随后' : '时间点'}</small></span>
      <span class="line"></span><span class="task-copy"><span class="task-top"><b>${escapeHtml(task.title)}</b>
      <i class="badge ${isStudy(task) ? 'study' : ''}">${escapeHtml(task.module)}</i>
      ${active ? `<i class="live">● ${pending ? '待确认' : '正在计时'}</i>` : ''}</span>
      <small>${escapeHtml(task.choice || task.note || (task.reminder ? '到点提醒已保存 · 设备通知尚未启用' : ''))}</small></span>
      <span class="task-meta">${actual ? `<small>累计 ${duration(actual)}</small>` : ''}<i class="status ${task.status}">${STATUS[task.status]}</i><span>›</span></span></button>`;
  }).join('');
  document.querySelectorAll('.task-card').forEach(card => {
    card.onclick = () => { state.selected = card.dataset.id; render(); };
  });
  renderDetail();
}

function closeDetail() {
  state.selected = null;
  render();
  // The detail is an overlay at narrow widths, so closing it reveals the
  // untouched schedule scroll position underneath.
}
function renderDetail() {
  const task = state.day.tasks.find(item => item.id === state.selected);
  $('#detailEmpty').classList.toggle('hidden', Boolean(task));
  $('#detail').classList.toggle('hidden', !task);
  if (!task) return;
  const active = state.timer?.taskId === task.id && state.timer?.date === state.date;
  const pending = active && state.timer.phase === 'confirming';
  const seconds = taskActualSeconds(task.id, state.sessions) + (active && !pending ? elapsed(state.timer) : 0);
  const sessionList = state.sessions.filter(session => session.taskId === task.id && session.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  $('#detail').innerHTML = `<div class="detail-sticky"><button class="close-detail" id="closeDetail" aria-label="关闭任务详情">× <span>关闭</span></button></div>
    <div class="detail-head"><div><i class="badge ${isStudy(task) ? 'study' : ''}">${task.module}</i><h2>${escapeHtml(task.title)}</h2>
    <p>${task.start}${task.end ? `–${task.end}` : ''} · ${task.kind === 'point' ? '时间点事项' : task.kind === 'open' ? '无固定结束' : duration(plannedSeconds(task))}</p></div>
    <button class="icon-btn" id="editTask" aria-label="仅编辑当天计划">✎</button></div>
    ${task.choice ? `<div class="info-row"><span>当日选择</span><b>${escapeHtml(task.choice)}</b></div>` : ''}
    <div class="note-box"><span>备注</span><p>${escapeHtml(task.note || '暂无备注')}</p></div>
    <div class="status-picker"><span>完成状态</span><div>${Object.entries(STATUS).map(([key, label]) => `<button data-status="${key}" class="${task.status === key ? 'active' : ''}">${label}</button>`).join('')}</div></div>
    ${isStudy(task) ? `<section class="timer-card"><span>${pending ? '本次计时待确认' : active ? state.timer.runningSince ? '正在计时' : '计时已暂停' : '本轮计时'}</span>
      <strong id="timerValue">${clock(active ? (pending ? state.timer.accumulatedSeconds : elapsed(state.timer)) : 0)}</strong>
      <div class="timer-actions">${pending ? '<button class="primary wide" id="reviewTimer">查看待确认记录</button>' : active
        ? `<button class="secondary" id="pauseTimer">${state.timer.runningSince ? '暂停' : '继续'}</button><button class="primary" id="endTimer">结束计时</button>`
        : '<button class="primary wide" id="startTimer">▷ 开始计时</button>'}</div>
      <small>历史累计 ${duration(taskActualSeconds(task.id, state.sessions))} · 计时和完成状态相互独立。</small></section>
      <section class="sessions"><div class="sessions-title"><h3>练习记录</h3><span>${sessionList.length} 次</span></div>
      ${sessionList.length ? sessionList.map(session => `<div class="session-row"><span>${new Date(session.startedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Shanghai' })}</span>
        <label class="session-duration"><input type="number" min="0" step="1" value="${session.durationSeconds}" data-session-duration="${session.id}" aria-label="修正时长（秒）"> 秒</label>
        <button class="delete-session" data-delete-session="${session.id}" aria-label="删除这条练习记录">删除</button></div>`).join('') : '<p class="muted">还没有计时记录</p>'}</section>`
      : '<div class="non-study">生活安排不计入学习时长统计。</div>'}`;
  $('#closeDetail').onclick = closeDetail;
  $('#editTask').onclick = () => openTask(task);
  document.querySelectorAll('[data-status]').forEach(button => button.onclick = async () => {
    task.status = button.dataset.status; await persistDay('状态已保存'); render();
  });
  $('#startTimer')?.addEventListener('click', () => startTimer(task));
  $('#pauseTimer')?.addEventListener('click', togglePause);
  $('#endTimer')?.addEventListener('click', requestEndTimer);
  $('#reviewTimer')?.addEventListener('click', showTimerConfirmation);
  document.querySelectorAll('[data-session-duration]').forEach(input => input.onchange = async () => {
    const session = state.sessions.find(item => item.id === input.dataset.sessionDuration);
    session.durationSeconds = Math.max(0, Math.floor(Number(input.value) || 0));
    await db.saveSession(session); render(); notify('练习时长已按秒修正');
  });
  document.querySelectorAll('[data-delete-session]').forEach(button => button.onclick = () => requestDeleteSession(button.dataset.deleteSession));
}

async function startTimer(task) {
  if (state.timer) { notify('已有计时或待确认记录，请先处理当前计时。', true); return; }
  state.timer = { taskId: task.id, date: state.date, startedAt: Date.now(), runningSince: Date.now(), accumulatedSeconds: 0, phase: 'timing' };
  await db.saveTimer(state.timer); render();
}
async function togglePause() {
  if (state.timer.runningSince) { state.timer.accumulatedSeconds = elapsed(state.timer); state.timer.runningSince = null; }
  else state.timer.runningSince = Date.now();
  await db.saveTimer(state.timer); render();
}
async function requestEndTimer() {
  const wasRunning = Boolean(state.timer.runningSince);
  state.timer.accumulatedSeconds = elapsed(state.timer);
  state.timer.runningSince = null;
  state.timer.phase = 'confirming';
  state.timer.wasRunning = wasRunning;
  await db.saveTimer(state.timer);
  render(); showTimerConfirmation();
}
function showTimerConfirmation() {
  if (!state.timer || state.timer.phase !== 'confirming') return;
  const task = state.day?.tasks.find(item => item.id === state.timer.taskId);
  $('#timerConfirmTitle').textContent = task?.title || '练习记录';
  $('#timerConfirmSummary').innerHTML = `<b>${escapeHtml(task?.title || '原任务')}</b><strong>${clock(state.timer.accumulatedSeconds)}</strong><span>${duration(state.timer.accumulatedSeconds)}</span>`;
  if (!$('#timerConfirmDialog').open) $('#timerConfirmDialog').showModal();
}
async function resumeTimer() {
  state.timer.phase = 'timing';
  if (state.timer.wasRunning) state.timer.runningSince = Date.now();
  delete state.timer.wasRunning;
  await db.saveTimer(state.timer); $('#timerConfirmDialog').close(); render();
}
async function discardTimer() {
  state.timer = null; await db.saveTimer(null); $('#timerConfirmDialog').close(); render();
  notify('已放弃本次计时，没有生成练习记录');
}
async function saveTimerSession() {
  if (state.savingTimer || !state.timer || state.timer.phase !== 'confirming') return;
  state.savingTimer = true; $('#saveTimerSession').disabled = true;
  try {
    const timer = state.timer;
    const id = `session-${timer.taskId}-${timer.startedAt}`;
    if (!state.sessions.some(session => session.id === id)) {
      const session = sessionFromTimer(timer);
      await db.saveSession(session);
      if (timer.date === state.date) state.sessions.push(session);
    }
    state.timer = null; await db.saveTimer(null); $('#timerConfirmDialog').close(); render();
    notify('本次练习已保存；新计时将从零开始');
  } finally { state.savingTimer = false; $('#saveTimerSession').disabled = false; }
}

function requestDeleteSession(id) {
  const session = state.sessions.find(item => item.id === id);
  const task = state.day.tasks.find(item => item.id === session?.taskId);
  if (!session) return;
  state.deleteSessionId = id;
  $('#deleteSessionSummary').innerHTML = `<b>${escapeHtml(task?.title || '原任务')}</b><span>${session.date} · ${duration(session.durationSeconds)}</span>`;
  $('#deleteSessionDialog').showModal();
}
async function confirmDeleteSession() {
  const id = state.deleteSessionId;
  if (!id) return;
  await db.deleteSession(id);
  state.sessions = state.sessions.filter(session => session.id !== id);
  state.deleteSessionId = null; $('#deleteSessionDialog').close(); render();
  notify('已删除这一条练习记录，相关统计已更新');
}

function formTask() {
  const form = $('#taskForm'); const data = Object.fromEntries(new FormData(form));
  const old = state.day.tasks.find(task => task.id === data.id);
  return { ...old, id: data.id || uid('task'), title: data.title, module: data.module, kind: data.kind,
    start: data.start, end: data.kind === 'range' ? data.end : '', note: data.note,
    reminder: form.reminder.checked, status: old?.status || 'todo', choice: data.choice || '', choices: old?.choices };
}
function showConflicts() {
  const conflicts = conflictsFor(formTask(), state.day.tasks);
  $('#conflicts').classList.toggle('hidden', !conflicts.length);
  $('#conflicts').textContent = conflicts.length ? `时间与“${conflicts.map(item => item.title).join('、')}”重叠。仍可保存，请自行调整安排。` : '';
}
function serializeTaskForm() { return JSON.stringify(Object.fromEntries(new FormData($('#taskForm')))); }
function openTask(task = null) {
  const form = $('#taskForm'); form.reset(); form.id.value = task?.id || ''; form.title.value = task?.title || '';
  form.module.value = task?.module || '生活'; form.kind.value = task?.kind || 'range'; form.start.value = task?.start || '09:00';
  form.end.value = task?.end || '10:00'; form.note.value = task?.note || ''; form.reminder.checked = task?.reminder || false;
  $('#formTitle').textContent = task ? '仅编辑当天计划' : '新增当天任务'; $('#deleteTask').classList.toggle('hidden', !task);
  const choice = $('#choiceWrap'); choice.classList.toggle('hidden', !task?.choices);
  if (task?.choices) form.choice.innerHTML = task.choices.map(value => `<option ${value === task.choice ? 'selected' : ''}>${value}</option>`).join('');
  $('#taskDialog').showModal(); showConflicts(); state.taskFormInitial = serializeTaskForm();
}
function confirmDiscardTaskEdit() {
  if (serializeTaskForm() === state.taskFormInitial) return true;
  return confirm('有尚未保存的当天计划修改。\n\n选择“取消”返回编辑并保存；选择“确定”放弃修改。');
}

function openTemplateEditor() {
  const template = effectiveTemplate(state.templates, state.date) || state.templates.at(-1);
  state.templateDraft = clone(template.tasks).map(task => ({ ...task }));
  state.templateDirty = false;
  $('#templateForm').effectiveDate.value = state.date < todayBJ() ? todayBJ() : state.date;
  renderTemplateTasks(); $('#templateDialog').showModal();
}
function templateRow(task) {
  const options = MODULES.map(module => `<option ${module === task.module ? 'selected' : ''}>${module}</option>`).join('');
  return `<div class="template-row" data-template-id="${task.id}">
    <div class="template-row-head"><span class="drag-time">${task.start || '--:--'}</span><button type="button" class="danger-link" data-remove-template="${task.id}">删除</button></div>
    <div class="template-fields"><label>名称<input data-field="title" value="${escapeAttr(task.title)}" required></label>
    <label>所属模块<select data-field="module">${options}</select></label>
    <label>类型<select data-field="kind"><option value="range" ${task.kind === 'range' ? 'selected' : ''}>时间段</option><option value="point" ${task.kind === 'point' ? 'selected' : ''}>时间点</option><option value="open" ${task.kind === 'open' ? 'selected' : ''}>无固定结束</option></select></label>
    <label>开始<input data-field="start" type="time" value="${task.start}" required></label>
    <label class="template-end ${task.kind !== 'range' ? 'disabled-field' : ''}">结束<input data-field="end" type="time" value="${task.end || ''}" ${task.kind === 'range' ? 'required' : 'disabled'}></label>
    <label class="template-note">备注<input data-field="note" value="${escapeAttr(task.note || '')}"></label></div></div>`;
}
function renderTemplateTasks() {
  state.templateDraft.sort((a, b) => a.start.localeCompare(b.start));
  $('#templateTasks').innerHTML = state.templateDraft.map(templateRow).join('');
  document.querySelectorAll('.template-row').forEach(row => row.addEventListener('input', event => {
    const task = state.templateDraft.find(item => item.id === row.dataset.templateId);
    task[event.target.dataset.field] = event.target.value; state.templateDirty = true;
    if (event.target.dataset.field === 'kind') { if (task.kind !== 'range') task.end = ''; renderTemplateTasks(); }
  }));
  document.querySelectorAll('[data-remove-template]').forEach(button => button.onclick = () => {
    state.templateDraft = state.templateDraft.filter(task => task.id !== button.dataset.removeTemplate);
    state.templateDirty = true; renderTemplateTasks();
  });
}
function closeTemplateEditor() {
  if (state.templateDirty && !confirm('有尚未保存的模板修改。\n\n选择“取消”返回编辑并保存；选择“确定”放弃修改。')) return;
  $('#templateDialog').close();
}

$('#taskForm').addEventListener('input', showConflicts);
$('#taskForm').addEventListener('submit', async event => {
  if (event.submitter?.value === 'cancel') { event.preventDefault(); if (confirmDiscardTaskEdit()) $('#taskDialog').close(); return; }
  event.preventDefault(); const task = formTask();
  if (task.kind === 'range' && (!task.end || task.end <= task.start)) { notify('结束时间必须晚于开始时间', true); return; }
  const index = state.day.tasks.findIndex(item => item.id === task.id);
  if (index >= 0) state.day.tasks[index] = task; else state.day.tasks.push(task);
  await persistDay(); $('#taskDialog').close(); state.selected = task.id; render();
});
$('#deleteTask').onclick = async () => {
  const id = $('#taskForm').id.value; if (!confirm('删除这项当天任务？已有计时记录会保留。')) return;
  state.day.tasks = state.day.tasks.filter(task => task.id !== id); state.selected = null;
  await persistDay('任务已删除'); $('#taskDialog').close(); render();
};
$('#addTask').onclick = () => openTask();
$('#datePicker').onchange = event => loadDate(event.target.value);
$('#todayBtn').onclick = () => loadDate(todayBJ());
const shift = amount => { const date = new Date(`${state.date}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); loadDate(fmtDate(date)); };
$('#prevDay').onclick = () => shift(-1); $('#nextDay').onclick = () => shift(1);

$('#templateBtn').onclick = openTemplateEditor;
$('#addTemplateTask').onclick = () => {
  state.templateDraft.push({ id: uid('template-task'), title: '新安排', module: '生活', kind: 'range', start: '09:00', end: '10:00', note: '', reminder: false, status: 'todo' });
  state.templateDirty = true; renderTemplateTasks();
};
$('#cancelTemplate').onclick = closeTemplateEditor;
$('#cancelTemplateTop').onclick = closeTemplateEditor;
$('#templateDialog').addEventListener('cancel', event => { event.preventDefault(); closeTemplateEditor(); });
$('#templateForm').onsubmit = async event => {
  event.preventDefault();
  const validationError = validateTemplateTasks(state.templateDraft);
  if (validationError) { notify(validationError, true); return; }
  const effectiveDate = event.currentTarget.effectiveDate.value;
  if (!confirm(`保存从 ${effectiveDate} 生效的新模板？\n\n只用于尚未生成的计划；已有当天、未来和历史计划均不会被覆盖。`)) return;
  await db.saveTemplate({ id: uid('template'), effectiveDate, tasks: clone(state.templateDraft).sort((a, b) => a.start.localeCompare(b.start)).map(task => ({ ...task, status: 'todo' })), createdAt: Date.now() });
  state.templates = await db.getTemplates(); state.templateDirty = false; $('#templateDialog').close();
  notify(`新模板已保存，将从 ${effectiveDate} 起用于尚未生成的计划`);
};

$('#resumeTimer').onclick = resumeTimer; $('#discardTimer').onclick = discardTimer; $('#saveTimerSession').onclick = saveTimerSession;
$('#timerConfirmDialog').addEventListener('cancel', event => event.preventDefault());
$('#cancelDeleteSession').onclick = () => { state.deleteSessionId = null; $('#deleteSessionDialog').close(); };
$('#confirmDeleteSession').onclick = confirmDeleteSession;

document.querySelectorAll('[data-later]').forEach(button => button.onclick = () => notify(`${button.dataset.later}模块后续接入，本阶段没有无效占位功能。`));
$('#settingsBtn').onclick = () => $('#settingsDialog').showModal();
$('#exportBtn').onclick = async () => { const data = await db.exportAll(); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = `学习系统备份-${todayBJ()}.json`; link.click(); URL.revokeObjectURL(link.href); };
$('#importFile').onchange = async event => { try { const data = JSON.parse(await event.target.files[0].text()); if (data.schemaVersion !== 1 || !Array.isArray(data.templates) || !Array.isArray(data.days)) throw new Error('备份格式不兼容'); state.pendingImport = data; $('#importChoice').classList.remove('hidden'); } catch (error) { notify(`无法读取备份：${error.message}`, true); } };
$('#mergeImport').onclick = async () => { await db.importMerged(state.pendingImport); $('#settingsDialog').close(); await loadDate(state.date); notify('备份已合并；相同 ID 的本机记录优先保留'); };
$('#replaceImport').onclick = async () => { if (!confirm('确定用备份替换此设备的全部数据吗？建议先导出当前数据。')) return; await db.replaceAll(state.pendingImport); $('#settingsDialog').close(); await loadDate(state.date); notify('已用备份替换本机数据'); };

setInterval(() => {
  if (state.timer?.phase === 'timing' && state.timer.runningSince) {
    const value = $('#timerValue'); if (value) value.textContent = clock(elapsed(state.timer));
  }
}, 1000);
window.addEventListener('unhandledrejection', event => notify(`操作失败，页面中的内容仍保留：${event.reason?.message || event.reason}`, true));
await db.initialize(todayBJ()); await loadDate(state.date);
