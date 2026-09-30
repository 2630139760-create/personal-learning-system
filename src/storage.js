import { clone, INITIAL_TASKS } from './model.js?v=20260930-hotfix';
const DB_NAME = 'personal-learning-system';
const DB_VERSION = 1;
const STORES = ['templates', 'days', 'sessions', 'meta'];

function openDB() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, DB_VERSION); req.onupgradeneeded = () => STORES.forEach(s => { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: s === 'days' ? 'date' : 'id' }); }); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function transact(store, mode, action) { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction(store, mode); const req = action(tx.objectStore(store)); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); tx.oncomplete = () => db.close(); }); }
const all = store => transact(store, 'readonly', s => s.getAll());
const get = (store, key) => transact(store, 'readonly', s => s.get(key));
const put = (store, value) => transact(store, 'readwrite', s => s.put(clone(value)));
const clear = store => transact(store, 'readwrite', s => s.clear());

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
export async function exportAll() { return { schemaVersion: 1, exportedAt: new Date().toISOString(), templates: await all('templates'), days: await all('days'), sessions: await all('sessions'), timer: await getTimer(), settings: { timezone: 'Asia/Shanghai' } }; }
export async function replaceAll(data) { for (const s of STORES) await clear(s); for (const x of data.templates || []) await put('templates', x); for (const x of data.days || []) await put('days', x); for (const x of data.sessions || []) await put('sessions', x); if (data.timer) await saveTimer(data.timer); }
export async function importMerged(data) { const current = await exportAll(); const { mergeBackup } = await import('./model.js'); return replaceAll(mergeBackup(current, data)); }
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
