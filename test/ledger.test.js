import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, parseMoney, money, billRange, billStats, budgetStats, fundStats, withRecord, recordWarnings, mergeLedger, normalizeLedger, beijingToday } from '../src/ledger-model.js';
import { mergeBackup } from '../src/model.js';

const entry = (id, amountCents, extra = {}) => ({ id, date: '2026-10-01', type: 'expense', title: '真实开支', amountCents, categoryId: 'expense-0', note: '', inDailyBudget: true, fundId: null, ...extra });
const deposit = (id, amountCents, extra = {}) => ({ id, date: '2026-09-01', amountCents, note: '', fundId: 'graduation', ...extra });
test('人民币按整数分解析，拒绝零、负数、过多小数和不安全金额', () => {
  assert.equal(parseMoney('0.10') + parseMoney('0.20'), 30);
  assert.equal(parseMoney('600.01'), 60001); assert.equal(money(-60001), '-¥600.01');
  for (const value of ['', '0', '-1', '1.001', '1e2', 'NaN', '90071992547409.92']) assert.throws(() => parseMoney(value));
});
test('北京时间今天在 UTC 晚间进入次日', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 1, 16, 30) });
  assert.equal(beijingToday(), '2026-10-02');
});
test('日周月年和自定义范围包含边界，跨年周仍为周一至周日', () => {
  assert.deepEqual(billRange('day', '2026-10-01'), { start: '2026-10-01', end: '2026-10-01' });
  assert.deepEqual(billRange('week', '2026-01-01'), { start: '2025-12-29', end: '2026-01-04' });
  assert.deepEqual(billRange('month', '2024-02-29'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(billRange('year', '2026-10-01'), { start: '2026-01-01', end: '2026-12-31' });
  assert.throws(() => billRange('custom', '2026-10-01', '2026-10-02', '2026-10-01'));
  assert.throws(() => billRange('day', '2026-02-30'));
  const ledger = emptyLedger(); ledger.entries = [entry('a', 10), entry('b', 20, { date: '2026-10-02' }), entry('c', 30, { date: '2026-10-03' })];
  assert.equal(billStats(ledger, billRange('custom', '2026-10-01', '2026-10-01', '2026-10-02')).expense, 30);
});
test('所有账单使用同一收入减支出统计，存入不重复计入账单', () => {
  const ledger = emptyLedger(); ledger.entries = [entry('a', 10), entry('b', 100, { type: 'income', categoryId: 'income-0', inDailyBudget: false })]; ledger.deposits = [deposit('d', 50000)];
  for (const kind of ['day', 'week', 'month', 'year']) {
    const s = billStats(ledger, billRange(kind, '2026-10-01'));
    assert.equal(s.income, 100); assert.equal(s.expense, 10); assert.equal(s.net, 90); assert.equal(s.categories.length, 2);
  }
  const empty = billStats(ledger, billRange('day', '2026-10-02'));
  assert.equal(empty.net, 0); assert.equal(empty.rows.length, 0);
});
test('预算默认 600，预算开关独立于分类和收入，按月统计不结转', () => {
  const ledger = emptyLedger();
  assert.deepEqual(ledger.categories.filter(c => c.defaultBudget).map(c => c.name), ['饮食', '交通', '娱乐', '日用品']);
  ledger.entries = [entry('a', 39999, { categoryId: 'expense-4' }), entry('b', 80000, { inDailyBudget: false }), entry('c', 100000, { type: 'income', categoryId: 'income-0', inDailyBudget: false })];
  let b = budgetStats(ledger, '2026-10'); assert.equal(b.spent, 39999); assert.equal(b.remaining, 20001); assert.equal(b.level, 'normal');
  ledger.entries.push(entry('d', 1)); b = budgetStats(ledger, '2026-10'); assert.equal(b.level, 'warning'); assert.equal(b.hue, 40);
  ledger.entries.push(entry('e', 20000)); b = budgetStats(ledger, '2026-10'); assert.equal(b.level, 'danger'); assert.equal(b.hue, 0);
  ledger.entries.push(entry('f', 1)); b = budgetStats(ledger, '2026-10'); assert.equal(b.over, 1); assert.equal(b.remaining, -1);
  assert.equal(budgetStats(ledger, '2026-11').remaining, 60000);
});
test('基金月目标不结转，实际存入和可用资金跨月保留，消费不减完成度', () => {
  const ledger = emptyLedger(); ledger.deposits = [deposit('a', 20000), deposit('b', 10000, { date: '2026-10-01' })];
  ledger.entries = [entry('expense', 5000, { fundId: 'graduation' })];
  const september = fundStats(ledger, 'graduation', '2026-09'), october = fundStats(ledger, 'graduation', '2026-10');
  assert.equal(september.monthly, 20000); assert.equal(october.monthly, 10000); assert.equal(october.difference, 40000);
  assert.equal(october.available, 25000); assert.equal(october.total, 30000); assert.equal(october.used, 5000);
  assert.equal(fundStats(ledger, 'graduation', '2026-11').difference, 50000);
  assert.equal(ledger.funds.reduce((n, f) => n + f.targetCents, 0) + 60000, 400000);
});
test('关联支出修改、更换基金和删除均重新计算，重复 ID 不会重复扣减', () => {
  let ledger = emptyLedger(); ledger.deposits = [deposit('d', 50000)];
  const row = entry('e', 10000, { fundId: 'graduation' });
  ledger = withRecord(ledger, 'entries', row); ledger = withRecord(ledger, 'entries', row);
  assert.equal(ledger.entries.length, 1); assert.equal(fundStats(ledger, 'graduation', '2026-10').available, 40000);
  ledger = withRecord(ledger, 'entries', { ...row, amountCents: 15000, fundId: 'travel' });
  assert.equal(fundStats(ledger, 'graduation', '2026-10').available, 50000); assert.equal(fundStats(ledger, 'travel', '2026-10').available, -15000);
  ledger.entries = []; assert.equal(fundStats(ledger, 'travel', '2026-10').available, 0);
  ledger = withRecord(ledger, 'deposits', deposit('d', 20000)); assert.equal(fundStats(ledger, 'graduation', '2026-09').monthly, 20000);
  ledger.deposits = []; assert.equal(fundStats(ledger, 'graduation', '2026-09').available, 0);
});
test('预算与基金不足有明确提示，负数余额和真实金额仍保留', () => {
  const before = emptyLedger(), row = entry('e', 60001, { fundId: 'travel' }), after = withRecord(before, 'entries', row);
  const warnings = recordWarnings(before, after, 'entries', row);
  assert.equal(warnings.length, 2); assert.match(warnings[0], /超支/); assert.match(warnings[1], /超过累计存入/);
  assert.equal(after.entries[0].amountCents, 60001); assert.equal(fundStats(after, 'travel', '2026-10').available, -60001);
});
test('旧备份保留账本，新备份按 ID 合并且本机版本优先', () => {
  const local = emptyLedger(); local.entries = [entry('same', 10)]; local.deposits = [deposit('d', 20)];
  const other = emptyLedger(); other.entries = [entry('same', 99), entry('new', 30)];
  assert.deepEqual(mergeLedger(local, undefined), local);
  const merged = mergeLedger(local, other); assert.equal(merged.entries.length, 2); assert.equal(merged.entries.find(r => r.id === 'same').amountCents, 10);
  const backup = mergeBackup({ templates: [{ id: 't' }], days: [{ date: '2026-10-01' }], sessions: [{ id: 's' }], ledger: local }, { templates: [], days: [] });
  assert.deepEqual(backup.ledger, local); assert.equal(backup.sessions.length, 1); assert.equal(backup.days.length, 1);
});
test('不兼容的账本引用和非整数金额在保存或恢复前被拒绝', () => {
  const ledger = emptyLedger();
  assert.throws(() => withRecord(ledger, 'entries', entry('e', 1.1)));
  assert.throws(() => withRecord(ledger, 'entries', entry('e', 10, { categoryId: 'missing' })));
  assert.throws(() => withRecord(ledger, 'entries', entry('e', 10, { fundId: 'missing' })));
  assert.throws(() => withRecord(ledger, 'entries', entry('e', 10, { type: 'income', categoryId: 'income-0' })));
  assert.throws(() => normalizeLedger({ ...ledger, entries: [entry('dup', 10), entry('dup', 20)] }));
});
