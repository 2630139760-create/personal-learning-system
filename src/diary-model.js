import { validDate } from './ledger-model.js?v=20261001-ledger';
import { MOODS } from './diary-moods.js?v=20261001-diary';

export const emptyDiary = () => ({ entries: [], drafts: [] });
export const blankDraft = date => ({ date, body: '', moodId: null, life: null, scoreText: '', favorite: false });
export function parseScore(text) {
  if (text.trim() === '') return null;
  if (!/^\d{1,3}$/.test(text.trim()) || Number(text) > 100) throw new Error('评分请填写 0—100 的整数，或留空');
  return Number(text);
}
function common(row) {
  if (!row || !validDate(row.date) || typeof row.body !== 'string' || (row.moodId !== null && !MOODS.some(m => m.id === row.moodId)) || ![null, 'yes', 'or', 'no'].includes(row.life) || typeof row.favorite !== 'boolean') throw new Error('日记格式不兼容');
  return { date: row.date, body: row.body, moodId: row.moodId, life: row.life, favorite: row.favorite };
}
export function normalizeEntry(row) {
  if (row.score !== null && (!Number.isInteger(row.score) || row.score < 0 || row.score > 100)) throw new Error('日记评分无效');
  return { ...common(row), score: row.score };
}
export function normalizeDraft(row) {
  if (typeof row.scoreText !== 'string') throw new Error('日记草稿评分格式不兼容');
  // Keep even an unfinished/invalid score as text, so drafts never lose input.
  return { ...common(row), scoreText: row.scoreText };
}
export function normalizeDiary(value) {
  if (value === undefined) return emptyDiary();
  if (!value || !Array.isArray(value.entries) || !Array.isArray(value.drafts)) throw new Error('日记备份格式不兼容');
  const unique = (rows, normalize) => {
    const seen = new Set();
    return rows.map(row => { const next = normalize(row); if (seen.has(next.date)) throw new Error('日记日期重复'); seen.add(next.date); return next; });
  };
  return { entries: unique(value.entries, normalizeEntry), drafts: unique(value.drafts, normalizeDraft) };
}
export function entryToDraft(entry) { return { ...common(entry), scoreText: entry.score === null ? '' : String(entry.score) }; }
export function draftToEntry(draft) { return normalizeEntry({ ...common(draft), score: parseScore(draft.scoreText) }); }
export const hasContent = entry => Boolean(entry.body.trim() || entry.moodId || entry.life !== null || entry.score !== null || entry.favorite);
export function updateDiary(value, kind, row) {
  const current = normalizeDiary(value), next = kind === 'drafts' ? normalizeDraft(row) : normalizeEntry(row);
  if (!['entries', 'drafts'].includes(kind)) throw new Error('日记记录类型无效');
  if (kind === 'entries' && !hasContent(next) && !current.entries.some(e => e.date === next.date)) {
    return { ...current, drafts: current.drafts.filter(d => d.date !== next.date) };
  }
  return { ...current, [kind]: [...current[kind].filter(e => e.date !== next.date), next], ...(kind === 'entries' ? { drafts: current.drafts.filter(d => d.date !== next.date) } : {}) };
}
export function removeDiary(value, date) {
  if (!validDate(date)) throw new Error('日记日期无效');
  const current = normalizeDiary(value);
  return { entries: current.entries.filter(e => e.date !== date), drafts: current.drafts.filter(e => e.date !== date) };
}
export function mergeDiary(local, incoming) {
  const current = normalizeDiary(local), other = normalizeDiary(incoming);
  // A date's local entry/draft is one pair: do not attach a stale imported draft to a local entry.
  const dates = new Set([...current.entries, ...current.drafts].map(e => e.date));
  return { entries: [...current.entries, ...other.entries.filter(e => !dates.has(e.date))], drafts: [...current.drafts, ...other.drafts.filter(e => !dates.has(e.date))] };
}
export function findDiary(entries, { keyword = '', start = '', end = '', favorites = false } = {}) {
  if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) throw new Error('请检查起止日期，开始不能晚于结束');
  const query = keyword.trim().toLocaleLowerCase();
  return entries.filter(e => (!favorites || e.favorite) && (!start || e.date >= start) && (!end || e.date <= end) && (!query || e.body.toLocaleLowerCase().includes(query))).sort((a, b) => b.date.localeCompare(a.date));
}
export function monthCells(month) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(`${month}-01`)) throw new Error('日历月份无效');
  const first = new Date(`${month}-01T00:00:00Z`), offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i < offset || i >= offset + count ? null : `${month}-${String(i - offset + 1).padStart(2, '0')}`);
}
