import { clone, INITIAL_TASKS, mergeBackup } from './model.js?v=20261001-ledger';
import { normalizeLedger, withRecord, recordWarnings } from './ledger-model.js?v=20261001-ledger';
const DB_NAME = 'personal-learning-system';
const DB_VERSION = 1;
const STORES = ['templates', 'days', 'sessions', 'meta'];

function openDB() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, DB_VERSION); req.onupgradeneeded = () => STORES.forEach(s => { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: s === 'days' ? 'date' : 'id' }); }); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function transact(store, mode, action) { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction(store, mode); const req = action(tx.objectStore(store)); let result; req.onsuccess = () => { result = req.result; }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('本地保存未完成')); }; }); }
const all = store => transact(store, 'readonly', s => s.getAll());
const get = (store, key) => transact(store, 'readonly', s => s.get(key));
const put = (store, value) => transact(store, 'readwrite', s => s.put(clone(value)));

export async function initialize(today) {
  let templates = await all('templates');
  if (!templates.length) { const initial = { id: 'template-initial', effectiveDate: '1970-01-01', tasks: clone(INITIAL_TASKS), createdAt: Date.now(), initializedAt: today }; await put('templates', initial); templates = [initial]; }
  return templates;
}
export async function getDay(date, template) { let day = await get('days', date); if (!day) { day = { date, templateId: template.id, tasks: clone(template.tasks), createdAt: Date.now(), updatedAt: Date.now() }; await put('days', day); } return day; }
export const saveDay = day => put('days', { ...day, updatedAt: Date.now() });
export const getDays = () => all('days');
export async function saveDays(days) { for (const day of days) await saveDay(day); }
export const saveTemplate = template => put('templates', template);
export const getTemplates = () => all('templates');
export const getSessions = async date => (await all('sessions')).filter(s => s.date === date);
export const getAllSessions = () => all('sessions');
export const saveSession = session => put('sessions', session);
export const getTimer = () => get('meta', 'timer').then(x => x?.value || null);
export const saveTimer = timer => put('meta', { id: 'timer', value: timer });
export async function claimTimer(timer) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite'), store = tx.objectStore('meta');
    let claimed = false;
    const request = store.get('timer');
    request.onsuccess = () => { if (!request.result?.value) { store.put({ id: 'timer', value: clone(timer) }); claimed = true; } };
    tx.oncomplete = () => { db.close(); resolve(claimed); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
  });
}
function snapshot(rows) {
  return { templates: rows.templates, days: rows.days, sessions: rows.sessions, timer: rows.meta.find(r => r.id === 'timer')?.value || null, ledger: normalizeLedger(rows.meta.find(r => r.id === 'ledger')?.value), settings: { timezone: 'Asia/Shanghai' } };
}
export async function exportAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readonly'), rows = {};
    for (const s of STORES) { const req = tx.objectStore(s).getAll(); req.onsuccess = () => { rows[s] = req.result; }; }
    tx.oncomplete = () => { db.close(); try { resolve({ schemaVersion: 1, exportedAt: new Date().toISOString(), ...snapshot(rows) }); } catch (error) { reject(error); } };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('无法导出本地数据')); };
  });
}
async function restoreBackup(data, merge) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.templates) || !Array.isArray(data.days) || (data.sessions !== undefined && !Array.isArray(data.sessions))) throw new Error('备份格式不兼容');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite'), rows = {}; let remaining = STORES.length, failure;
    for (const s of STORES) {
      const req = tx.objectStore(s).getAll();
      req.onsuccess = () => {
        rows[s] = req.result;
        if (--remaining) return;
        try {
          const current = snapshot(rows);
          const next = merge ? mergeBackup(current, data) : { ...data, sessions: data.sessions ?? current.sessions, timer: data.timer === undefined ? current.timer : data.timer, ledger: data.ledger === undefined ? current.ledger : normalizeLedger(data.ledger) };
          for (const store of ['templates', 'days', 'sessions']) { const target = tx.objectStore(store); target.clear(); for (const row of next[store]) target.put(clone(row)); }
          const meta = tx.objectStore('meta');
          meta.put({ id: 'timer', value: clone(next.timer || null) });
          meta.put({ id: 'ledger', value: clone(next.ledger) });
        } catch (error) { failure = error; tx.abort(); }
      };
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || new Error('恢复失败，原有数据未改变')); };
  });
}
export const replaceAll = data => restoreBackup(data, false);
export const importMerged = data => restoreBackup(data, true);
export const getLedger = () => get('meta', 'ledger').then(row => normalizeLedger(row?.value));
async function updateLedger(change) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite'), meta = tx.objectStore('meta'); let result, failure;
    const req = meta.get('ledger');
    req.onsuccess = () => {
      try { result = normalizeLedger(change(normalizeLedger(req.result?.value))); meta.put({ id: 'ledger', value: clone(result) }); }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || new Error('账本保存失败')); };
  });
}
function checkWarnings(warnings, approved) {
  if (warnings.some(w => !approved.includes(w))) throw new Error('预算或基金金额已变化，请重新检查并确认后保存');
}
export const saveLedgerRecord = (kind, record, approvedWarnings = []) => updateLedger(current => {
  if (!['entries', 'deposits'].includes(kind)) throw new Error('记录类型无效');
  const next = withRecord(current, kind, record);
  checkWarnings(recordWarnings(current, next, kind, record), approvedWarnings);
  return next;
});
export const deleteLedgerRecord = (kind, id, approvedWarnings = []) => updateLedger(current => {
  if (!['entries', 'deposits'].includes(kind)) throw new Error('记录类型无效');
  const row = current[kind].find(r => r.id === id); if (!row) return current;
  const next = { ...current, [kind]: current[kind].filter(r => r.id !== id) };
  checkWarnings(recordWarnings(current, next, kind, row, { includeBudget: false }), approvedWarnings);
  return next;
});
export const saveLedgerCategory = category => updateLedger(current => {
  if (current.categories.some(c => c.id !== category.id && c.type === category.type && c.name === category.name)) throw new Error('该收支类型已有同名分类');
  const existing = current.categories.find(c => c.id === category.id);
  if (existing && existing.type !== category.type) throw new Error('不能更改已有分类的收支类型');
  return { ...current, categories: existing ? current.categories.map(c => c.id === category.id ? { ...existing, name: category.name } : c) : [...current.categories, category] };
});
export const deleteLedgerCategory = id => updateLedger(current => {
  if (current.entries.some(e => e.categoryId === id)) throw new Error('该分类已被记录使用，请保留或改名；历史记录不会删除');
  return { ...current, categories: current.categories.filter(c => c.id !== id) };
});
export const deleteSession = id => transact('sessions', 'readwrite', s => s.delete(id));

export async function commitTimerSession(timer, session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions', 'meta'], 'readwrite');
    const sessions = tx.objectStore('sessions');
    const meta = tx.objectStore('meta');
    let existing;
    const check = sessions.get(session.id);
    check.onsuccess = () => {
      existing = check.result;
      if (!existing) sessions.put(clone(session));
      const current = meta.get('timer');
      current.onsuccess = () => {
        if (current.result?.value?.id === timer.id) meta.put({ id: 'timer', value: null });
      };
    };
    tx.oncomplete = () => { db.close(); resolve(existing || session); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
  });
}
