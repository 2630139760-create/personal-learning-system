import * as db from './storage.js?v=20261001-diary';
import { activatePage } from './navigation.js?v=20261001-diary';
import { beijingToday, parseMoney, money, billRange, billStats, budgetStats, fundStats, withRecord, recordWarnings } from './ledger-model.js?v=20261001-ledger';

const $ = s => document.querySelector(s);
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const field = (form, name) => form.elements.namedItem(name);
const state = { ledger: null, tab: 'bills', month: beijingToday().slice(0, 7), busy: false, budgetTouched: false };
const amountField = '<label>金额（人民币元）<input name="amount" inputmode="decimal" required pattern="[0-9]+([.][0-9]{1,2})?" maxlength="20" placeholder="0.00" aria-describedby="ledgerAmountHint" /></label>';
const dateField = '<label>日期（北京时间）<input type="date" name="date" required /></label>';
const noteField = '<label>备注（可选）<textarea name="note" rows="2" maxlength="2000"></textarea></label>';
const closeButton = '<button type="button" class="icon-btn" data-ledger-close aria-label="关闭">×</button>';
const actions = '<p class="persistent-error hidden" data-ledger-error role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-ledger-close>取消</button><button type="submit" class="primary">保存</button></div>';

function message(text, error = false) {
  const el = $('#ledgerStatus'); el.textContent = text; el.className = error ? 'persistent-error' : 'ledger-message';
}
function formError(form, error) { const el = form.querySelector('[data-ledger-error]'); el.textContent = error.message || String(error); el.classList.remove('hidden'); }
function categories(type) { return state.ledger.categories.filter(c => c.type === type); }
function fundOptions(selected = '', optional = true) {
  return `${optional ? '<option value="">不关联资金项目</option>' : ''}${state.ledger.funds.map(f => `<option value="${html(f.id)}" ${f.id === selected ? 'selected' : ''}>${html(f.name)}</option>`).join('')}`;
}
function render() {
  const planned = state.ledger.funds.reduce((n, f) => n + f.targetCents, 0);
  $('#ledgerPlan').innerHTML = `月度默认安排合计 <b>${money(planned + 60000)}</b>：基金及预留 ${money(planned)} ＋ 日常预算 ¥600.00。这是计划金额，不是已发生的支出。`;
  const budget = budgetStats(state.ledger, state.month);
  $('#ledgerBudget').innerHTML = `<div class="ledger-card-head"><h2>${html(state.month)} 日常预算</h2><b>每月 ¥600.00</b></div><div class="ledger-totals"><div><span>日常已花</span><strong>${money(budget.spent)}</strong></div><div><span>${budget.over ? '超支金额' : '剩余预算'}</span><strong>${money(budget.over || budget.remaining)}</strong></div></div><progress max="100" value="${budget.percent}" style="--budget-color:hsl(${budget.hue},70%,36%)" aria-label="本月日常预算使用进度"></progress><p class="ledger-budget-${budget.level}">${budget.over ? `已超支 ${money(budget.over)}` : budget.spent >= 60000 ? '已达到本月预算' : budget.spent >= 40000 ? '已达到 400 元提醒线，请留意剩余预算' : '日常开支在预算内'} · 每月独立统计，结余与超支均不结转。</p>`;
  $('#ledgerBills').classList.toggle('hidden', state.tab !== 'bills');
  $('#ledgerFunds').classList.toggle('hidden', state.tab !== 'funds');
  document.querySelectorAll('[data-ledger-tab]').forEach(b => { b.classList.toggle('active', b.dataset.ledgerTab === state.tab); b.setAttribute('aria-pressed', String(b.dataset.ledgerTab === state.tab)); });
  renderBills(); renderFunds();
}
function renderBills() {
  try {
    const kind = $('#ledgerRange').value;
    $('#ledgerCustomRange').classList.toggle('hidden', kind !== 'custom');
    const range = billRange(kind, $('#ledgerAnchor').value, $('#ledgerStart').value, $('#ledgerEnd').value);
    const stats = billStats(state.ledger, range);
    $('#ledgerBillSummary').innerHTML = `<p class="muted">${range.start} 至 ${range.end}，包含起止两天${kind === 'week' ? ' · 周一至周日' : ''}</p><div class="ledger-totals"><div><span>总收入</span><strong>${money(stats.income)}</strong></div><div><span>总支出</span><strong>${money(stats.expense)}</strong></div><div><span>净收支</span><strong>${money(stats.net)}</strong></div></div><p class="muted">净收支 = 收入 − 支出，不代表实际银行余额；小荷包存入不计入收支。</p>`;
    $('#ledgerCategorySummary').innerHTML = ['income', 'expense'].map(type => `<section><h3>${type === 'income' ? '收入' : '支出'}分类汇总</h3>${stats.categories.some(c => c.type === type) ? `<ul>${stats.categories.filter(c => c.type === type).map(c => `<li><span>${html(c.name)}</span><b>${money(c.amountCents)}</b></li>`).join('')}</ul>` : '<p class="muted">此范围暂无记录 · ¥0.00</p>'}</section>`).join('');
    $('#ledgerEntries').innerHTML = stats.rows.length ? stats.rows.map(e => {
      const category = state.ledger.categories.find(c => c.id === e.categoryId), fund = state.ledger.funds.find(f => f.id === e.fundId);
      return `<article class="ledger-row"><div><b>${html(e.title)}</b><small>${e.date} · ${html(category.name)} · ${e.type === 'income' ? '收入' : '支出'}${e.type === 'expense' ? ` · ${e.inDailyBudget ? '计入' : '不计入'}日常预算` : ''}${fund ? ` · 扣减${html(fund.name)}` : ''}</small>${e.note ? `<p>${html(e.note)}</p>` : ''}</div><div class="ledger-row-actions"><strong>${e.type === 'income' ? '+' : '-'}${money(e.amountCents)}</strong><button type="button" class="text-btn" data-edit-entry="${html(e.id)}">编辑</button><button type="button" class="danger-link" data-delete-entry="${html(e.id)}">删除</button></div></article>`;
    }).join('') : '<p class="ledger-empty">这个范围还没有收支记录。可新增真实账目，不会生成演示记录。</p>';
  } catch (error) {
    $('#ledgerBillSummary').textContent = error.message; $('#ledgerCategorySummary').innerHTML = ''; $('#ledgerEntries').innerHTML = '';
  }
}
function renderFunds() {
  $('#ledgerFundCards').innerHTML = state.ledger.funds.map(f => {
    const s = fundStats(state.ledger, f.id, state.month);
    return `<article class="ledger-card"><div class="ledger-card-head"><div><h2>${html(f.name)}</h2><small>${html(f.purpose)}</small></div><button type="button" class="secondary" data-add-deposit="${html(f.id)}">记录存入</button></div><div class="ledger-totals"><div><span>${state.month} 月目标</span><strong>${money(f.targetCents)}</strong></div><div><span>当月实际存入</span><strong>${money(s.monthly)}</strong></div><div><span>${s.difference >= 0 ? '尚差' : '超出目标'}</span><strong>${money(Math.abs(s.difference))}</strong></div></div><p><b>累计可用 ${money(s.available)}</b> <small>累计实际存入 ${money(s.total)} − 关联实际支出 ${money(s.used)}</small></p>${s.available < 0 ? '<p class="persistent-error">关联支出超过已记录存入，请核对小荷包；真实记录和负数余额均保留。</p>' : ''}<p class="muted">月目标不结转；已存入的资金跨月保留。关联消费不减少当月实际存入完成度。</p><details><summary>历次存入明细（${s.deposits.length} 笔，所有月份）</summary>${s.deposits.length ? s.deposits.map(d => `<div class="ledger-row"><div><b>${d.date} · ${money(d.amountCents)}</b>${d.note ? `<p>${html(d.note)}</p>` : ''}</div><div class="ledger-row-actions"><button type="button" class="text-btn" data-edit-deposit="${html(d.id)}">编辑</button><button type="button" class="danger-link" data-delete-deposit="${html(d.id)}">删除</button></div></div>`).join('') : '<p class="muted">暂无存入，请在支付宝实际存入后手动记录。</p>'}</details></article>`;
  }).join('');
}
function setEntryType() {
  const form = $('#ledgerEntryForm'), type = field(form, 'type').value;
  const selected = field(form, 'categoryId').value;
  field(form, 'categoryId').innerHTML = categories(type).map(c => `<option value="${html(c.id)}">${html(c.name)}</option>`).join('');
  if (categories(type).some(c => c.id === selected)) field(form, 'categoryId').value = selected;
  $('#ledgerExpenseOptions').classList.toggle('hidden', type !== 'expense');
  if (type === 'income') { field(form, 'inDailyBudget').checked = false; field(form, 'fundId').value = ''; }
  else if (!state.budgetTouched) field(form, 'inDailyBudget').checked = categories(type).find(c => c.id === field(form, 'categoryId').value)?.defaultBudget || false;
  previewEntry();
}
function recordFrom(form, kind) {
  const row = { id: field(form, 'id').value, date: field(form, 'date').value, amountCents: parseMoney(field(form, 'amount').value), note: field(form, 'note').value.trim() };
  if (kind === 'deposits') return { ...row, fundId: field(form, 'fundId').value };
  const expense = field(form, 'type').value === 'expense';
  return { ...row, type: field(form, 'type').value, title: field(form, 'title').value.trim(), categoryId: field(form, 'categoryId').value, inDailyBudget: expense && field(form, 'inDailyBudget').checked, fundId: expense ? field(form, 'fundId').value || null : null };
}
function previewEntry() {
  const form = $('#ledgerEntryForm');
  try {
    const row = recordFrom(form, 'entries');
    const next = withRecord(state.ledger, 'entries', row);
    const warnings = recordWarnings(state.ledger, next, 'entries', row);
    const fund = row.fundId ? `关联后累计可用：${money(fundStats(next, row.fundId, row.date.slice(0, 7)).available)}。` : '';
    $('#ledgerEntryPreview').textContent = [fund, ...warnings].filter(Boolean).join('\n') || '保存后进入实际账单；日常预算选项与分类相互独立。';
    $('#ledgerEntryPreview').classList.toggle('warning', warnings.length > 0);
  } catch {
    $('#ledgerEntryPreview').textContent = '填写完整后显示预算和基金影响。'; $('#ledgerEntryPreview').classList.remove('warning');
  }
}
function openRecord(kind, record = null, fundId = '') {
  const form = $(kind === 'entries' ? '#ledgerEntryForm' : '#ledgerDepositForm');
  form.reset(); form.querySelector('[data-ledger-error]').classList.add('hidden');
  field(form, 'id').value = record?.id || uid(kind === 'entries' ? 'entry' : 'deposit');
  field(form, 'date').value = record?.date || beijingToday();
  field(form, 'amount').value = record ? money(record.amountCents).replace('¥', '') : '';
  field(form, 'note').value = record?.note || '';
  field(form, 'fundId').innerHTML = fundOptions(record?.fundId || fundId, kind === 'entries');
  if (kind === 'entries') {
    field(form, 'type').value = record?.type || 'expense'; state.budgetTouched = Boolean(record);
    setEntryType(); field(form, 'title').value = record?.title || '';
    if (record) { field(form, 'categoryId').value = record.categoryId; field(form, 'inDailyBudget').checked = record.inDailyBudget; }
    $('#ledgerEntryTitle').textContent = record ? '编辑收支' : '新增收支'; previewEntry();
  } else $('#ledgerDepositTitle').textContent = record ? '编辑实际存入' : '记录实际存入';
  form.closest('dialog').showModal(); form.scrollTop = 0;
}
async function saveRecord(event, kind) {
  event.preventDefault(); const form = event.currentTarget, dialog = form.closest('dialog');
  if (state.busy || !dialog.open) return;
  state.busy = true; const button = form.querySelector('[type=submit]'); button.disabled = true;
  try {
    const record = recordFrom(form, kind), fresh = await db.getLedger();
    const next = withRecord(fresh, kind, record), warnings = recordWarnings(fresh, next, kind, record);
    if (warnings.length && !confirm(warnings.join('\n\n'))) return;
    const saved = await db.saveLedgerRecord(kind, record, warnings);
    state.ledger = saved; dialog.close(); render(); message('已保存到此浏览器');
  } catch (error) { formError(form, error); }
  finally { state.busy = false; button.disabled = false; }
}
async function deleteRecord(kind, id) {
  if (state.busy) return; state.busy = true;
  try {
    const fresh = await db.getLedger(), row = fresh[kind].find(r => r.id === id); if (!row) return;
    const next = { ...fresh, [kind]: fresh[kind].filter(r => r.id !== id) };
    const warnings = recordWarnings(fresh, next, kind, row, { includeBudget: false });
    if (!confirm(`确认删除 ${row.date} 的${kind === 'entries' ? `“${row.title}”` : '存入记录'} ${money(row.amountCents)}？\n${warnings.join('\n')}`)) return;
    state.ledger = await db.deleteLedgerRecord(kind, id, warnings); render(); message('记录已删除，账单和基金金额已重算');
  } catch (error) { message(`删除失败：${error.message}`, true); }
  finally { state.busy = false; }
}
function renderCategories() {
  $('#ledgerCategoryList').innerHTML = state.ledger.categories.map(c => {
    const used = state.ledger.entries.some(e => e.categoryId === c.id);
    return `<div class="ledger-row"><div><b>${html(c.name)}</b><small>${c.type === 'expense' ? '支出' : '收入'}${c.defaultBudget ? ' · 新支出默认计入日常预算' : ''}</small></div><div class="ledger-row-actions"><button type="button" class="text-btn" data-rename-category="${html(c.id)}">改名</button><button type="button" class="danger-link" data-delete-category="${html(c.id)}" ${used ? 'disabled title="已被历史记录使用，只能改名"' : ''}>${used ? '使用中' : '删除'}</button></div></div>`;
  }).join('');
}
function resetCategoryForm(category = null) {
  const form = $('#ledgerCategoryForm'); form.reset();
  field(form, 'id').value = category?.id || uid('category'); field(form, 'name').value = category?.name || '';
  field(form, 'type').value = category?.type || 'expense'; field(form, 'type').disabled = Boolean(category);
  form.querySelector('[data-ledger-error]').classList.add('hidden');
  $('#ledgerCategoryTitle').textContent = category ? '分类改名' : '新增分类';
}
async function showLedger() {
  try {
    state.ledger = await db.getLedger();
    await activatePage('ledger');
    render();
  } catch (error) { alert(`账本读取失败：${error.message}。现有数据未改变，请重试。`); }
}
export function initLedger() {
  $('#detailPanel').insertAdjacentHTML('beforebegin', `<main id="ledgerPage" class="main-panel ledger-page hidden">
    <header class="topbar"><div><p class="eyebrow">人民币 · 仅此浏览器</p><h1>账本</h1></div><div class="button-row"><button type="button" class="secondary" id="ledgerManageCategories">管理分类</button><button type="button" class="primary" id="ledgerAddEntry">＋ 新增收支</button></div></header>
    <p class="ledger-plan" id="ledgerPlan"></p>
    <div id="ledgerStatus" class="hidden" role="status" aria-live="polite"></div>
    <label class="ledger-month">预算与资金月份<input id="ledgerMonth" type="month" value="${state.month}" required /></label>
    <section id="ledgerBudget" class="ledger-card"></section>
    <nav class="ledger-tabs" aria-label="账本视图"><button type="button" class="secondary active" data-ledger-tab="bills">实际账单</button><button type="button" class="secondary" data-ledger-tab="funds">小荷包资金</button></nav>
    <section id="ledgerBills"><div class="ledger-filters"><label>账单范围<select id="ledgerRange"><option value="day">日账单</option><option value="week">周账单</option><option value="month" selected>月账单</option><option value="year">年账单</option><option value="custom">自定义</option></select></label><label>基准日期<input id="ledgerAnchor" type="date" value="${beijingToday()}" required /></label><div id="ledgerCustomRange" class="ledger-filters hidden"><label>开始日期<input id="ledgerStart" type="date" value="${beijingToday()}" /></label><label>结束日期<input id="ledgerEnd" type="date" value="${beijingToday()}" /></label></div></div>
      <section class="ledger-card" id="ledgerBillSummary"></section><div class="ledger-card ledger-category-summary" id="ledgerCategorySummary"></div><section class="ledger-card"><h2>逐笔明细</h2><div id="ledgerEntries"></div></section>
    </section>
    <section id="ledgerFunds" class="hidden"><p class="muted">在支付宝实际存入后手动记录；本系统不连接支付宝，也不自动存入。资金内部安排不算收入或支出。累计可用涵盖所有月份，包含本月之后补录的记录。</p><div id="ledgerFundCards"></div></section>
  </main>`);
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="ledgerEntryDialog" class="ledger-dialog"><form id="ledgerEntryForm"><div class="dialog-head"><h2 id="ledgerEntryTitle">新增收支</h2>${closeButton}</div><input type="hidden" name="id" />${dateField}<label>类型<select name="type"><option value="expense">支出</option><option value="income">收入</option></select></label><label>项目名称<input name="title" required maxlength="80" /></label>${amountField}<small id="ledgerAmountHint">金额大于 0，最多两位小数。</small><label>分类<select name="categoryId" required></select></label><div id="ledgerExpenseOptions"><label class="switch-row"><span>计入日常预算（独立于分类）</span><input type="checkbox" name="inDailyBudget" /></label><label>关联资金项目（可选）<select name="fundId"></select></label><p class="muted">关联后仍算实际支出，并且仅扣减一次对应基金；不关联则不影响基金。</p></div>${noteField}<div id="ledgerEntryPreview" class="preview"></div>${actions}</form></dialog>
    <dialog id="ledgerDepositDialog" class="ledger-dialog"><form id="ledgerDepositForm"><div class="dialog-head"><h2 id="ledgerDepositTitle">记录实际存入</h2>${closeButton}</div><input type="hidden" name="id" /><p class="muted">仅记录已经实际存入小荷包的资金，不计入收入或消费支出。</p>${dateField}<label>资金项目<select name="fundId" required></select></label>${amountField.replace(' aria-describedby="ledgerAmountHint"', '')}${noteField}${actions}</form></dialog>
    <dialog id="ledgerCategoryDialog" class="ledger-dialog"><form id="ledgerCategoryForm"><div class="dialog-head"><h2 id="ledgerCategoryTitle">新增分类</h2>${closeButton}</div><input type="hidden" name="id" /><div class="form-row"><label>收支类型<select name="type"><option value="expense">支出</option><option value="income">收入</option></select></label><label>分类名称<input name="name" required maxlength="30" /></label></div><p class="muted">新分类默认不计入日常预算，每笔支出仍可单独调整。使用中的分类只能改名，不会删除历史记录。</p>${actions}<button type="button" class="text-btn" id="ledgerNewCategory">切换为新增分类</button><div id="ledgerCategoryList"></div></form></dialog>`);
  document.querySelector('[data-page=ledger]').onclick = showLedger;
  document.querySelector('[data-page=today]').onclick = () => activatePage('today').catch(error => alert(`切换失败：${error.message}`));
  $('#ledgerAddEntry').onclick = () => openRecord('entries');
  $('#ledgerMonth').onchange = e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { state.month = e.target.value; render(); } };
  ['#ledgerRange', '#ledgerAnchor', '#ledgerStart', '#ledgerEnd'].forEach(s => $(s).onchange = renderBills);
  document.querySelectorAll('[data-ledger-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.ledgerTab; render(); });
  $('#ledgerEntryForm').onsubmit = e => saveRecord(e, 'entries'); $('#ledgerDepositForm').onsubmit = e => saveRecord(e, 'deposits');
  const entryForm = $('#ledgerEntryForm');
  field(entryForm, 'type').onchange = () => { state.budgetTouched = false; setEntryType(); };
  field(entryForm, 'categoryId').onchange = () => { if (!state.budgetTouched) field(entryForm, 'inDailyBudget').checked = state.ledger.categories.find(c => c.id === field(entryForm, 'categoryId').value)?.defaultBudget || false; previewEntry(); };
  field(entryForm, 'inDailyBudget').onchange = () => { state.budgetTouched = true; previewEntry(); };
  entryForm.addEventListener('input', previewEntry);
  document.querySelectorAll('.ledger-dialog').forEach(dialog => {
    dialog.addEventListener('cancel', e => { if (state.busy) e.preventDefault(); });
    dialog.querySelectorAll('[data-ledger-close]').forEach(b => b.onclick = () => { if (!state.busy) dialog.close(); });
  });
  $('#ledgerPage').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || state.busy) return;
    if (b.dataset.editEntry) openRecord('entries', state.ledger.entries.find(r => r.id === b.dataset.editEntry));
    if (b.dataset.deleteEntry) deleteRecord('entries', b.dataset.deleteEntry);
    if (b.dataset.addDeposit) openRecord('deposits', null, b.dataset.addDeposit);
    if (b.dataset.editDeposit) openRecord('deposits', state.ledger.deposits.find(r => r.id === b.dataset.editDeposit));
    if (b.dataset.deleteDeposit) deleteRecord('deposits', b.dataset.deleteDeposit);
  });
  $('#ledgerManageCategories').onclick = () => { resetCategoryForm(); renderCategories(); $('#ledgerCategoryDialog').showModal(); };
  $('#ledgerNewCategory').onclick = () => { if (!state.busy) resetCategoryForm(); };
  $('#ledgerCategoryForm').onsubmit = async e => {
    e.preventDefault(); if (state.busy) return; state.busy = true;
    const form = e.currentTarget, button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      state.ledger = await db.saveLedgerCategory({ id: field(form, 'id').value, type: field(form, 'type').value, name: field(form, 'name').value.trim(), defaultBudget: false });
      resetCategoryForm(); renderCategories(); render(); message('分类已保存，历史记录保留');
    } catch (error) { formError(form, error); }
    finally { state.busy = false; button.disabled = false; }
  };
  $('#ledgerCategoryList').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || state.busy) return;
    if (b.dataset.renameCategory) resetCategoryForm(state.ledger.categories.find(c => c.id === b.dataset.renameCategory));
    if (b.dataset.deleteCategory && confirm('确认删除这个未被记录使用的分类？')) {
      state.busy = true;
      try { state.ledger = await db.deleteLedgerCategory(b.dataset.deleteCategory); renderCategories(); render(); }
      catch (error) { formError($('#ledgerCategoryForm'), error); }
      finally { state.busy = false; }
    }
  });
  window.addEventListener('learning-data-restored', async () => { if (!$('#ledgerPage').classList.contains('hidden')) { try { state.ledger = await db.getLedger(); render(); message('备份已恢复，账本已刷新'); } catch (error) { message(error.message, true); } } });
}
