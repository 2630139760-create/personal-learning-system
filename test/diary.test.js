import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { blankDraft, parseScore, normalizeDiary, entryToDraft, draftToEntry, updateDiary, removeDiary, mergeDiary, findDiary, monthCells } from '../src/diary-model.js';
import { mergeBackup } from '../src/model.js';
import { MOODS, moodSVG } from '../src/diary-moods.js';

// Runtime-only opaque fixture strings; never include personal diary content.
const make = (date, extra = {}) => draftToEntry({ ...blankDraft(date), ...extra });
test('评分 0 与空值分开；心情及 Yes/Or/No 均可不选，不自动换算评分', () => {
  assert.equal(parseScore(''), null); assert.equal(parseScore('0'), 0); assert.equal(parseScore('100'), 100);
  for (const input of ['-1', '101', '1.5', '1e2', 'abc']) assert.throws(() => parseScore(input));
  for (const life of [null, 'yes', 'or', 'no']) {
    const entry = make('2026-10-01', { life, moodId: 'alive' });
    assert.equal(entry.life, life); assert.equal(entry.score, null);
  }
  assert.equal(entryToDraft(make('2026-10-01', { scoreText: '0' })).scoreText, '0');
  assert.equal(entryToDraft(make('2026-10-01')).scoreText, '');
  assert.equal(MOODS.length, 9); assert.equal(new Set(MOODS.map(m => m.id)).size, 9);
  assert.equal(moodSVG(null), ''); assert.match(moodSVG('alive'), /<img/);
});
test('不同日期草稿隔离；未完成评分和取消选择原样保留', () => {
  const first = { ...blankDraft('2026-10-01'), body: randomUUID(), scoreText: '101' };
  const second = { ...blankDraft('2026-09-30'), life: 'or' };
  let data = updateDiary(undefined, 'drafts', first); data = updateDiary(data, 'drafts', second);
  data = updateDiary(data, 'drafts', { ...second, life: null });
  assert.equal(data.drafts.length, 2); assert.deepEqual(data.drafts.find(d => d.date === first.date), first);
  assert.equal(data.drafts.find(d => d.date === second.date).life, null);
  assert.equal(normalizeDiary(data).drafts[0].scoreText, '101');
});
test('正式保存按日期更新、只清除同日期草稿；完全空白不创建记录，0 分可单独保存', () => {
  let data = updateDiary(undefined, 'entries', make('2026-10-01')); assert.equal(data.entries.length, 0);
  data = updateDiary(data, 'drafts', { ...blankDraft('2026-09-30'), body: randomUUID() });
  data = updateDiary(data, 'drafts', { ...blankDraft('2026-10-01'), scoreText: '0' });
  const entry = make('2026-10-01', { scoreText: '0', favorite: true });
  data = updateDiary(data, 'entries', entry); data = updateDiary(data, 'entries', { ...entry, favorite: false });
  assert.equal(data.entries.length, 1); assert.equal(data.entries[0].score, 0);
  assert.equal(data.drafts.length, 1); assert.equal(data.drafts[0].date, '2026-09-30');
  assert.deepEqual(removeDiary(data, '2026-10-01'), { entries: [], drafts: data.drafts });
});
test('收藏引用原记录；正文搜索、日期筛选均包含首尾', () => {
  const token = randomUUID();
  const entries = [make('2026-09-30', { body: token }), make('2026-10-01', { body: token, favorite: true }), make('2026-10-02', { body: token, favorite: true })];
  const rows = findDiary(entries, { keyword: token.toUpperCase(), start: '2026-09-30', end: '2026-10-01' });
  assert.deepEqual(rows.map(r => r.date), ['2026-10-01', '2026-09-30']); assert.equal(rows[0], entries[1]);
  assert.equal(findDiary(entries, { keyword: token, favorites: true }).length, 2);
  entries[1].body = randomUUID(); assert.equal(findDiary(entries, { keyword: token, favorites: true }).length, 1);
  assert.throws(() => findDiary(entries, { start: '2026-10-02', end: '2026-10-01' }));
});
test('旧备份合并保留日记；同日期本机记录和草稿一起优先，导入新日期', () => {
  const local = { entries: [make('2026-10-01', { scoreText: '0' })], drafts: [blankDraft('2026-10-01')] };
  const incoming = { entries: [make('2026-10-01', { scoreText: '99' }), make('2026-09-30', { life: 'or' })], drafts: [blankDraft('2026-10-01'), blankDraft('2026-09-29')] };
  assert.deepEqual(mergeDiary(local, undefined), local);
  const merged = mergeDiary(local, incoming); assert.equal(merged.entries.length, 2); assert.equal(merged.entries[0].score, 0); assert.equal(merged.drafts.length, 2);
  const current = { templates: [{ id: 't' }], days: [{ date: '2026-10-01' }], sessions: [{ id: 's' }], diary: local };
  const restored = mergeBackup(current, { templates: [], days: [] });
  assert.deepEqual(restored.diary, local); assert.deepEqual(restored.days, current.days); assert.deepEqual(restored.sessions, current.sessions);
  assert.deepEqual(normalizeDiary(JSON.parse(JSON.stringify(merged))), merged);
});
test('日历周一开头，正确处理闰月及月初周日', () => {
  const feb = monthCells('2024-02'); assert.equal(feb[3], '2024-02-01'); assert.ok(feb.includes('2024-02-29')); assert.equal(feb.length % 7, 0);
  assert.equal(monthCells('2026-06')[0], '2026-06-01'); assert.equal(monthCells('2026-02')[6], '2026-02-01');
  assert.throws(() => monthCells('2026-13'));
});
test('坏备份和重复日期明确拒绝，不静默丢弃数据', () => {
  assert.throws(() => normalizeDiary(null)); assert.throws(() => normalizeDiary({ entries: [], drafts: null }));
  const entry = make('2026-10-01', { scoreText: '0' });
  for (const patch of [{ score: -1 }, { score: 0.1 }, { moodId: 'unknown' }, { life: '' }, { date: '2026-02-30' }]) assert.throws(() => normalizeDiary({ entries: [{ ...entry, ...patch }], drafts: [] }));
  assert.throws(() => normalizeDiary({ entries: [entry, entry], drafts: [] }));
});
