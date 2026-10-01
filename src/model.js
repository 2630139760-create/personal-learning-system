import { mergeLedger } from './ledger-model.js?v=20261001-ledger';
import { mergeDiary } from './diary-model.js?v=20261001-diary';
export const STUDY_MODULES = ['化妆', '剪辑', '调色', '英语／雅思', 'AI', '拍摄'];
export const STATUS = { todo: '未完成', done: '已完成', improve: '待完善' };
export const EXECUTION_PRIORITY = [['化妆'], ['剪辑', '调色'], ['英语／雅思'], ['AI'], ['拍摄']];
export const MASTERY_PRIORITY = ['AI', '调色', '化妆', '英语／雅思', '剪辑', '拍摄'];

const task = (id, start, end, title, module = '生活', extra = {}) => ({ id, start, end, title, module, kind: end ? 'range' : 'point', note: '', reminder: false, status: 'todo', ...extra });
export const INITIAL_TASKS = [
  task('wake', '06:55', '', '起床'), task('wash-am', '07:00', '07:20', '洗漱'), task('breakfast', '07:20', '08:00', '早饭'),
  task('makeup', '08:00', '09:30', '化妆', '化妆'), task('english', '09:30', '12:30', '英语', '英语／雅思', { note: '现阶段使用词书' }),
  task('rest', '12:30', '13:00', '休息'), task('edit-color', '13:00', '16:00', '剪辑／调色', '剪辑', { choice: '剪辑 · 学习', choices: ['剪辑 · 学习', '剪辑 · 实践', '调色 · 学习', '调色 · 实践'] }),
  task('dinner', '16:00', '17:00', '晚饭'), task('ai', '17:00', '20:00', 'AI', 'AI'), task('free', '20:00', '21:30', '自由活动', '生活', { note: '可填写健身、拍视频、跳舞、买菜等' }),
  task('care', '21:30', '22:30', '洗澡、个人护理'), task('review', '22:30', '23:00', '复习与总结', '生活'),
  task('sleep', '23:00', '', '随后洗漱护肤、睡觉', '生活', { kind: 'open', note: '无固定结束时间' })
];

export const clone = value => structuredClone(value);
export const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
export const plannedSeconds = t => t.kind === 'range' && t.end ? Math.max(0, (minutes(t.end) - minutes(t.start)) * 60) : 0;
export const isStudy = t => STUDY_MODULES.includes(t.module);
export const taskActualSeconds = (taskId, sessions) => sessions.filter(s => s.taskId === taskId && s.endedAt).reduce((n, s) => n + s.durationSeconds, 0);
export function calculateStats(tasks, sessions) {
  const study = tasks.filter(isStudy);
  return {
    done: study.filter(t => t.status === 'done').length, total: study.length,
    improve: study.filter(t => t.status === 'improve').length,
    planned: study.reduce((n, t) => n + plannedSeconds(t), 0),
    actual: sessions.filter(s => s.endedAt && STUDY_MODULES.includes(s.module || tasks.find(t => t.id === s.taskId)?.module)).reduce((n, s) => n + s.durationSeconds, 0),
    sessions: sessions.filter(s => s.endedAt && STUDY_MODULES.includes(s.module || tasks.find(t => t.id === s.taskId)?.module)).length
  };
}
export function conflictsFor(candidate, tasks) {
  if (candidate.kind !== 'range' || !candidate.end) return [];
  const a = minutes(candidate.start), b = minutes(candidate.end);
  return tasks.filter(t => t.id !== candidate.id && t.kind === 'range' && t.end && a < minutes(t.end) && b > minutes(t.start));
}
export function effectiveTemplate(templates, date) {
  return [...templates].filter(t => t.effectiveDate <= date).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || (b.createdAt || 0) - (a.createdAt || 0))[0];
}
export function mergeBackup(current, incoming) {
  // Load the backup first so an identical local ID wins; merge must never silently overwrite local edits.
  const unique = (a, b, key) => [...new Map([...b, ...a].map(x => [x[key], x])).values()];
  return { templates: unique(current.templates, incoming.templates || [], 'id'), days: unique(current.days, incoming.days || [], 'date'), sessions: unique(current.sessions, incoming.sessions || [], 'id'), timer: current.timer || incoming.timer || null, settings: { ...incoming.settings, ...current.settings }, ledger: mergeLedger(current.ledger, incoming.ledger), diary: mergeDiary(current.diary, incoming.diary) };
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600), mins = Math.floor(total % 3600 / 60), secs = total % 60;
  if (hours) return `${hours}小时${mins ? `${mins}分` : ''}${secs ? `${secs}秒` : ''}`;
  if (mins) return `${mins}分${secs ? `${secs}秒` : ''}`;
  return `${secs}秒`;
}
export const sortTasks = tasks => [...tasks].sort((a,b) => a.start.localeCompare(b.start));
export function validTaskTime(task) { return task.kind !== 'range' || Boolean(task.end && task.end > task.start); }

export function timerElapsed(timer, now = Date.now()) {
  if (!timer) return 0;
  return Math.max(0, Math.floor(Number(timer.accumulatedSeconds) || 0) + (timer.phase === 'active' && timer.runningSince ? Math.max(0, Math.floor((now - timer.runningSince) / 1000)) : 0));
}

const TEMPLATE_FIELDS = ['title', 'module', 'kind', 'start', 'end', 'note', 'reminder', 'choice', 'choices'];
const templateShape = task => Object.fromEntries(TEMPLATE_FIELDS.map(key => [key, task?.[key] ?? (key === 'reminder' ? false : '')]));
export const taskDiffersFromTemplate = (task, templateTask) => !templateTask || JSON.stringify(templateShape(task)) !== JSON.stringify(templateShape(templateTask));

/** Merge a newer template into a generated day without discarding day-specific work. */
export function reconcileTemplateDay(day, previousTasks, templateTasks, { preserveCustom = true, protectedIds = [] } = {}) {
  const existing = new Map(day.tasks.map(t => [t.id, t]));
  const previous = new Map((previousTasks || []).map(t => [t.id, t]));
  const incoming = new Set(templateTasks.map(t => t.id));
  const protectedSet = new Set(protectedIds);
  const customIds = day.tasks.filter(t => taskDiffersFromTemplate(t, previous.get(t.id))).map(t => t.id);
  const tasks = templateTasks.map(source => {
    const old = existing.get(source.id);
    if (old && preserveCustom && customIds.includes(old.id)) return clone(old);
    return { ...clone(source), status: old?.status || 'todo' };
  });
  for (const old of day.tasks) {
    if (incoming.has(old.id)) continue;
    const shouldRetain = old.status !== 'todo' || protectedSet.has(old.id) || (preserveCustom && customIds.includes(old.id));
    if (shouldRetain) tasks.push(clone(old));
  }
  return {
    day: { ...day, tasks: sortTasks(tasks), templateAppliedAt: Date.now() },
    customIds,
    hasCustomizations: customIds.length > 0
  };
}

export function applyTemplateToDay(day, templateTasks) {
  return reconcileTemplateDay(day, [], templateTasks, { preserveCustom: false }).day;
}
