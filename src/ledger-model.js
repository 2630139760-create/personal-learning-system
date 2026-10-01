export const DAILY_BUDGET = 60000;
export const DEFAULT_FUNDS = [
  { id: 'graduation', name: '毕业缓冲金', targetCents: 50000, purpose: '跨月积存' },
  { id: 'travel', name: '旅行基金', targetCents: 100000, purpose: '跨月积存' },
  { id: 'beauty', name: '衣饰美妆基金', targetCents: 30000, purpose: '跨月积存，可集中消费' },
  { id: 'gpt', name: 'GPT Pro订阅预留', targetCents: 70000, purpose: '当月付款预留' },
  { id: 'rent', name: '房租预留', targetCents: 90000, purpose: '当月付款预留' }
];
const expenseNames = ['饮食', '交通', '居住', '娱乐', '旅行', '衣饰美妆', '数码与设备', '软件与订阅', '日用品', '其他'];
export const DEFAULT_CATEGORIES = [
  ...expenseNames.map((name, i) => ({ id: `expense-${i}`, type: 'expense', name, defaultBudget: ['饮食', '交通', '日用品', '娱乐'].includes(name) })),
  ...['工资', '其他收入'].map((name, i) => ({ id: `income-${i}`, type: 'income', name, defaultBudget: false }))
];
export const emptyLedger = () => ({ entries: [], deposits: [], categories: structuredClone(DEFAULT_CATEGORIES), funds: structuredClone(DEFAULT_FUNDS) });
export const beijingToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function parseMoney(value) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('金额必须大于 0，最多两位小数');
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('金额必须大于 0 且在可计算范围内');
  return Number(cents);
}
export function money(cents) {
  if (!Number.isSafeInteger(cents)) throw new Error('金额超出可计算范围');
  const n = BigInt(cents), abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}¥${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
const sum = rows => rows.reduce((n, row) => {
  const next = n + row.amountCents;
  if (!Number.isSafeInteger(next)) throw new Error('累计金额超出可计算范围');
  return next;
}, 0);
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function billRange(kind, date, start, end) {
  if (!validDate(date)) throw new Error('请选择有效的基准日期');
  const d = new Date(`${date}T00:00:00Z`), iso = value => value.toISOString().slice(0, 10);
  if (kind === 'day') return { start: date, end: date };
  if (kind === 'week') {
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const monday = iso(d); d.setUTCDate(d.getUTCDate() + 6);
    return { start: monday, end: iso(d) };
  }
  if (kind === 'month') {
    const first = `${date.slice(0, 7)}-01`; d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return { start: first, end: iso(d) };
  }
  if (kind === 'year') return { start: `${date.slice(0, 4)}-01-01`, end: `${date.slice(0, 4)}-12-31` };
  if (kind !== 'custom' || !validDate(start) || !validDate(end) || start > end) throw new Error('起止日期无效，结束日期不能早于开始日期');
  return { start, end };
}
export function billStats(ledger, range) {
  const rows = ledger.entries.filter(e => e.date >= range.start && e.date <= range.end);
  const income = sum(rows.filter(e => e.type === 'income')), expense = sum(rows.filter(e => e.type === 'expense'));
  const categories = ledger.categories.map(c => ({ ...c, amountCents: sum(rows.filter(e => e.categoryId === c.id)) })).filter(c => c.amountCents > 0);
  return { income, expense, net: income - expense, categories, rows: [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) };
}
export function budgetStats(ledger, month) {
  const spent = sum(ledger.entries.filter(e => e.type === 'expense' && e.inDailyBudget && e.date.slice(0, 7) === month));
  const level = spent >= DAILY_BUDGET ? 'danger' : spent >= 40000 ? 'warning' : 'normal';
  // Hue shifts gradually from green, through amber at 400 yuan, to red at 600.
  const hue = spent <= 40000 ? 120 - spent / 40000 * 80 : Math.max(0, 40 - (spent - 40000) / 20000 * 40);
  return { spent, remaining: DAILY_BUDGET - spent, over: Math.max(0, spent - DAILY_BUDGET), percent: Math.min(100, spent / DAILY_BUDGET * 100), hue, level };
}
export function fundStats(ledger, fundId, month) {
  const fund = ledger.funds.find(f => f.id === fundId);
  if (!fund) throw new Error('资金项目不存在');
  const deposits = ledger.deposits.filter(d => d.fundId === fundId);
  const monthly = sum(deposits.filter(d => d.date.slice(0, 7) === month));
  const total = sum(deposits), used = sum(ledger.entries.filter(e => e.type === 'expense' && e.fundId === fundId));
  return { monthly, total, used, available: total - used, difference: fund.targetCents - monthly, deposits: [...deposits].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) };
}
const idValid = id => typeof id === 'string' && /^[\w-]{1,100}$/.test(id);
export function validateRecord(kind, row, ledger) {
  if (!row || !idValid(row.id) || !validDate(row.date)) throw new Error('记录 ID 或日期无效');
  if (!Number.isSafeInteger(row.amountCents) || row.amountCents <= 0) throw new Error('金额必须是大于 0 的整数分');
  if (typeof row.note !== 'string' || row.note.length > 2000) throw new Error('备注最多 2000 字');
  if (kind === 'entries') {
    if (row.fundId != null && !idValid(row.fundId)) throw new Error('资金项目引用无效');
    if (!['income', 'expense'].includes(row.type) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 80) throw new Error('请填写项目名称（最多 80 字）和收支类型');
    if (!ledger.categories.some(c => c.id === row.categoryId && c.type === row.type)) throw new Error('请选择对应的收支分类');
    if (typeof row.inDailyBudget !== 'boolean' || (row.type === 'income' && (row.inDailyBudget || row.fundId))) throw new Error('收入不能计入日常预算或扣减基金');
  }
  if ((kind === 'deposits' || row.fundId) && !ledger.funds.some(f => f.id === row.fundId)) throw new Error('请选择有效的资金项目');
}
export function normalizeLedger(value) {
  if (value === undefined) return emptyLedger();
  const ledger = structuredClone(value);
  if (!ledger || !['entries', 'deposits', 'categories', 'funds'].every(k => Array.isArray(ledger[k]))) throw new Error('账本备份格式不兼容');
  for (const key of ['entries', 'deposits', 'categories', 'funds']) {
    if (new Set(ledger[key].map(r => r?.id)).size !== ledger[key].length || !ledger[key].every(r => r && idValid(r.id))) throw new Error('账本包含重复或无效的 ID');
  }
  if (ledger.funds.length !== DEFAULT_FUNDS.length || !DEFAULT_FUNDS.every(f => ledger.funds.some(x => x.id === f.id && Number.isSafeInteger(x.targetCents) && x.targetCents > 0 && typeof x.name === 'string'))) throw new Error('资金项目或目标无效');
  for (const c of ledger.categories) {
    if (!['income', 'expense'].includes(c.type) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 30 || typeof c.defaultBudget !== 'boolean') throw new Error('分类格式无效');
  }
  for (const kind of ['entries', 'deposits']) for (const row of ledger[kind]) validateRecord(kind, row, ledger);
  // Reject unsafe totals before anything is written or restored.
  sum(ledger.entries); sum(ledger.deposits);
  return ledger;
}
export function mergeLedger(current, incoming) {
  const local = normalizeLedger(current);
  if (incoming === undefined) return local;
  const other = normalizeLedger(incoming);
  const merge = key => [...new Map([...other[key], ...local[key]].map(row => [row.id, row])).values()];
  return normalizeLedger({ entries: merge('entries'), deposits: merge('deposits'), categories: merge('categories'), funds: merge('funds') });
}
export function withRecord(ledger, kind, record) {
  const next = structuredClone(ledger);
  validateRecord(kind, record, next);
  const i = next[kind].findIndex(r => r.id === record.id);
  if (i < 0) next[kind].push(record); else next[kind][i] = record;
  return normalizeLedger(next);
}
export function recordWarnings(before, after, kind, record, { includeBudget = true } = {}) {
  const warnings = [];
  if (includeBudget && kind === 'entries' && record.type === 'expense' && record.inDailyBudget) {
    const month = record.date.slice(0, 7), b = budgetStats(after, month);
    if (b.spent >= 40000) warnings.push(`${month} 日常已花 ${money(b.spent)}。${b.spent >= DAILY_BUDGET ? (b.over ? `已超支 ${money(b.over)}` : '已达到 600 元预算') : '已达到 400 元提醒线'}。确认记录这笔真实收支？`);
  }
  const affected = new Set([record.fundId, before[kind].find(r => r.id === record.id)?.fundId].filter(Boolean));
  for (const id of affected) {
    const f = after.funds.find(f => f.id === id), stats = fundStats(after, id, record.date.slice(0, 7));
    if (stats.available < 0) warnings.push(`${f.name}的关联支出超过累计存入 ${money(-stats.available)}，可用金额将为 ${money(stats.available)}。仍可确认保存真实记录，请核对小荷包。`);
  }
  return warnings;
}
