import * as db from './storage.js?v=20261001-diary';
import { beijingToday, validDate } from './ledger-model.js?v=20261001-ledger';
import { blankDraft, entryToDraft, draftToEntry, findDiary, monthCells } from './diary-model.js?v=20261001-diary';
import { MOODS, moodSVG } from './diary-moods.js?v=20261001-moods-reference';
import { activatePage, registerLeaveGuard } from './navigation.js?v=20261001-diary';

const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { data: null, date: beijingToday(), month: beijingToday().slice(0, 7), tab: 'calendar', moodId: null, life: null, dirty: false, revision: 0, busy: false };
let timer, queue = Promise.resolve(), pendingRevision = -1, draftTask;
function status(text, error = false) { const el = $('#diaryStatus'); el.textContent = text; el.classList.toggle('persistent-error', error); }
function enqueue(work) { const task = queue.then(work); queue = task.catch(() => {}); return task; }
function values() { return { date: state.date, body: $('#diaryBody').value, moodId: state.moodId, life: state.life, scoreText: $('#diaryScore').value, favorite: $('#diaryFavorite').checked }; }
function selections() {
  document.querySelectorAll('[data-mood]').forEach(b => { const selected = state.moodId === b.dataset.mood; b.setAttribute('aria-pressed', String(selected)); b.classList.toggle('selected', selected); });
  document.querySelectorAll('[data-life]').forEach(b => { const selected = state.life === b.dataset.life; b.setAttribute('aria-pressed', String(selected)); b.classList.toggle('selected', selected); });
}
function edited() {
  state.dirty = true; state.revision++;
  status('保存中…'); clearTimeout(timer);
  timer = setTimeout(() => persistDraft().catch(() => {}), 180);
}
function persistDraft() {
  clearTimeout(timer);
  if (!state.dirty) return Promise.resolve();
  if (pendingRevision === state.revision) return draftTask;
  const draft = values(), revision = state.revision;
  pendingRevision = revision;
  draftTask = enqueue(async () => {
    const data = await db.saveDiaryDraft(draft);
    state.data = data;
    if (state.date === draft.date && state.revision === revision) { state.dirty = false; if (!state.busy) $('#diaryDelete').disabled = false; status('草稿已保存 · 点击“保存日记”更新日历与收藏'); }
  }).catch(error => {
    if (state.date === draft.date && state.revision === revision) status(`保存失败：${error.message}。输入仍保留，请重试。`, true);
    throw error;
  });
  draftTask.finally(() => { if (pendingRevision === revision) pendingRevision = -1; }).catch(() => {});
  return draftTask;
}
async function flushDraft(allowBusy = false) {
  if (state.busy && !allowBusy) throw new Error('日记正在保存或切换日期，请稍后重试');
  if (!state.data) return;
  do { await persistDraft(); await queue; } while (state.dirty);
}
function renderCalendar() {
  $('#diaryMonthTitle').textContent = `${state.month.slice(0, 4)} 年 ${Number(state.month.slice(5))} 月`;
  const entries = new Map(state.data.entries.map(e => [e.date, e]));
  $('#diaryCalendar').innerHTML = monthCells(state.month).map(date => {
    if (!date) return '<span class="diary-day-blank" aria-hidden="true"></span>';
    const entry = entries.get(date), mood = MOODS.find(m => m.id === entry?.moodId);
    const detail = [mood?.name, entry?.body.trim() && '有正文', entry?.favorite && '已收藏'].filter(Boolean).join('，');
    return `<button type="button" class="diary-day ${date === state.date ? 'selected' : ''} ${date === beijingToday() ? 'is-today' : ''}" data-diary-date="${date}" aria-label="${date}${detail ? `，${detail}` : ''}" aria-pressed="${date === state.date}"><span>${Number(date.slice(8))}</span>${mood ? moodSVG(mood.id) : '<span class="diary-no-mood"></span>'}${!mood && entry?.body.trim() ? '<i class="diary-record-dot" aria-label="有正文"></i>' : ''}${entry?.favorite ? '<span class="diary-star" aria-label="已收藏">★</span>' : ''}</button>`;
  }).join('');
}
function renderResults() {
  const keyword = $('#diaryKeyword').value, start = $('#diaryStart').value, end = $('#diaryEnd').value;
  const visible = state.tab === 'favorites' || Boolean(keyword.trim() || start || end);
  $('#diaryResultsSection').classList.toggle('hidden', !visible);
  $('#diaryResultsTitle').textContent = state.tab === 'favorites' ? '收藏夹' : '查找结果';
  if (!visible) return;
  try {
    const rows = findDiary(state.data.entries, { keyword, start, end, favorites: state.tab === 'favorites' });
    $('#diaryResults').innerHTML = rows.length ? rows.map(entry => {
      const mood = MOODS.find(m => m.id === entry.moodId);
      return `<button type="button" class="diary-result" data-diary-date="${entry.date}"><span class="diary-result-meta"><b>${entry.date}</b>${mood ? `${moodSVG(mood.id)}<span>${mood.name}</span>` : '<span>未选心情</span>'}${entry.favorite ? '<span aria-label="已收藏">★</span>' : ''}</span><span class="diary-snippet">${escape(entry.body.slice(0, 100)) || '未写正文'}${entry.body.length > 100 ? '…' : ''}</span></button>`;
    }).join('') : '<p class="muted">没有符合条件的日记。</p>';
  } catch (error) { $('#diaryResults').textContent = error.message; }
}
function renderViews() {
  $('#diaryCalendarSection').classList.toggle('hidden', state.tab !== 'calendar');
  document.querySelectorAll('[data-diary-tab]').forEach(b => { b.classList.toggle('active', state.tab === b.dataset.diaryTab); b.setAttribute('aria-pressed', String(state.tab === b.dataset.diaryTab)); });
  renderCalendar(); renderResults();
}
function loadEditor() {
  const draft = state.data.drafts.find(d => d.date === state.date), entry = state.data.entries.find(e => e.date === state.date);
  const form = draft || (entry ? entryToDraft(entry) : blankDraft(state.date));
  state.moodId = form.moodId; state.life = form.life; state.dirty = false; state.revision++;
  $('#diarySelectedDate').value = state.date;
  $('#diaryBody').value = form.body; $('#diaryScore').value = form.scoreText; $('#diaryFavorite').checked = form.favorite;
  $('#diaryDelete').disabled = !draft && !entry;
  selections(); status(draft ? '草稿已保存 · 已恢复此日期草稿，尚未正式保存' : entry ? '已保存' : '尚未填写 · 内容均可选');
}
async function openDate(date) {
  if (!validDate(date) || state.busy) { $('#diarySelectedDate').value = state.date; return; }
  setBusy(true);
  try {
    await flushDraft(true); state.data = await db.getDiary();
    state.date = date; state.month = date.slice(0, 7); loadEditor(); renderViews();
  } finally { $('#diarySelectedDate').value = state.date; setBusy(false); }
}
async function saveEntry() {
  if (state.busy) return;
  let entry;
  try { entry = draftToEntry(values()); } catch (error) { status(error.message, true); return; }
  setBusy(true);
  try {
    await flushDraft(true); status('保存中…');
    state.data = await enqueue(() => db.saveDiaryEntry(entry)); state.dirty = false;
    loadEditor(); renderViews();
    status(state.data.entries.some(e => e.date === state.date) ? '已保存' : '内容为空，未创建空日记');
  } catch (error) { status(`保存失败：${error.message}。输入和已有草稿保留，可重试。`, true); }
  finally { setBusy(false); }
}
function setBusy(busy) { state.busy = busy; $('#diaryFields').disabled = busy; $('#diarySave').disabled = busy; $('#diaryRetry').disabled = busy; $('#diaryDelete').disabled = busy || !state.data.entries.concat(state.data.drafts).some(e => e.date === state.date); }
async function deleteEntry() {
  if (state.busy || !confirm(`确认删除 ${state.date} 的日记和草稿？收藏和日历标记也会移除。`)) return;
  setBusy(true);
  try { await flushDraft(true); state.data = await enqueue(() => db.deleteDiary(state.date)); loadEditor(); renderViews(); status('日记及草稿已删除'); }
  catch (error) { status(`删除失败：${error.message}。原记录保留，可重试。`, true); }
  finally { setBusy(false); }
}
const run = action => async () => { try { await action(); } catch (error) { status(`操作失败：${error.message}。输入仍保留。`, true); } };
export function initDiary() {
  $('#detailPanel').insertAdjacentHTML('beforebegin', `<main id="diaryPage" class="main-panel diary-page hidden">
    <header class="topbar"><div><p class="eyebrow">北京时间 · 仅此浏览器</p><h1>日记</h1></div><nav class="diary-tabs" aria-label="日记视图"><button type="button" class="secondary active" data-diary-tab="calendar" aria-pressed="true">日历</button><button type="button" class="secondary" data-diary-tab="favorites" aria-pressed="false">收藏夹</button></nav></header>
    <section id="diaryCalendarSection" class="diary-calendar-section"><div class="diary-monthbar"><button type="button" class="icon-btn" id="diaryPrev" aria-label="上月">‹</button><h2 id="diaryMonthTitle"></h2><button type="button" class="icon-btn" id="diaryNext" aria-label="下月">›</button><button type="button" class="secondary" id="diaryToday">回到今天</button></div><div class="diary-weekdays" aria-hidden="true">${['一', '二', '三', '四', '五', '六', '日'].map(d => `<span>${d}</span>`).join('')}</div><div id="diaryCalendar" class="diary-calendar" aria-label="月历，每周从周一开始"></div><p class="diary-hint">● 有正文、未选心情　★ 已收藏 · 月历显示正式保存的日记</p></section>
    <details class="diary-search" id="diarySearch"><summary>查找日记</summary><div class="diary-filters"><label>正文关键词<input type="search" id="diaryKeyword" /></label><label>起始日期<input type="date" id="diaryStart" /></label><label>结束日期<input type="date" id="diaryEnd" /></label><button type="button" class="text-btn" id="diaryClearSearch">清除筛选</button></div><p class="diary-hint">包含起止两天；收藏夹内仅查找已收藏日记。</p></details>
    <section id="diaryResultsSection" class="hidden"><h2 id="diaryResultsTitle">查找结果</h2><div id="diaryResults"></div></section>
    <section class="diary-editor"><div class="diary-editor-head"><h2>所选日期</h2><label>北京时间<input type="date" id="diarySelectedDate" aria-label="日记日期" /></label></div>
      <form id="diaryForm" novalidate><fieldset id="diaryFields"><legend class="sr-only">日记编辑</legend>
        <div><h3>今天的心情 <small>可不选，再点一次取消</small></h3><div class="diary-moods">${MOODS.map(m => `<button type="button" class="diary-mood" data-mood="${m.id}" aria-pressed="false">${moodSVG(m.id)}<span>${m.name}</span></button>`).join('')}</div></div>
        <label>日记正文<textarea id="diaryBody" rows="5" placeholder="今天发生了什么？我有什么感受？我的想法或心路发生了怎样的转变？"></textarea></label>
        <div><h3>今天是否有在过自己想过的生活？</h3><div class="diary-life">${[['yes', 'Yes', '是，今天接近我想过的生活。'], ['or', 'Or', '比较平淡，暂时没有明确答案。'], ['no', 'No', '否，今天偏离了我想过的生活。']].map(([id, name, description]) => `<button type="button" class="secondary" data-life="${id}" aria-pressed="false"><b>${name}</b><span>${description}</span></button>`).join('')}</div><p class="diary-hint">默认未选择；再次点击取消。Or 与未选择分别保存。</p></div>
        <div class="diary-bottom-fields"><label>为今天打分<input id="diaryScore" type="text" inputmode="numeric" placeholder="0—100，可留空" aria-describedby="diaryScoreHint" /></label><button type="button" class="text-btn" id="diaryClearScore">清除评分</button><label class="diary-favorite"><input type="checkbox" id="diaryFavorite" />收藏这篇日记</label></div><p id="diaryScoreHint" class="diary-hint">评分由你填写，0 分有效；心情不会自动换算评分。收藏随“保存日记”生效。</p>
      </fieldset><div id="diaryStatus" role="status" aria-live="polite"></div><div class="diary-actions"><button type="button" class="danger-link" id="diaryDelete">删除日记</button><button type="button" class="secondary" id="diaryRetry">重试保存草稿</button><button type="submit" class="primary" id="diarySave">保存日记</button></div></form>
    </section></main>`);
  registerLeaveGuard(flushDraft);
  document.querySelector('[data-page=diary]').onclick = run(async () => {
    await flushDraft(); state.data = await db.getDiary();
    await activatePage('diary'); loadEditor(); renderViews();
  });
  $('#diaryPage').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || state.busy) return;
    if (button.dataset.diaryDate) await run(() => openDate(button.dataset.diaryDate))();
    if (button.dataset.mood) { state.moodId = state.moodId === button.dataset.mood ? null : button.dataset.mood; selections(); edited(); }
    if (button.dataset.life) { state.life = state.life === button.dataset.life ? null : button.dataset.life; selections(); edited(); }
    if (button.dataset.diaryTab) { state.tab = button.dataset.diaryTab; $('#diarySearch').open = state.tab === 'favorites'; renderViews(); }
  });
  ['#diaryBody', '#diaryScore', '#diaryFavorite'].forEach(s => $(s).addEventListener('input', edited));
  $('#diaryClearScore').onclick = () => { if ($('#diaryScore').value !== '') { $('#diaryScore').value = ''; edited(); } };
  $('#diarySelectedDate').onchange = run(() => openDate($('#diarySelectedDate').value));
  $('#diaryToday').onclick = run(() => openDate(beijingToday()));
  for (const [selector, amount] of [['#diaryPrev', -1], ['#diaryNext', 1]]) $(selector).onclick = run(async () => {
    const date = new Date(`${state.month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount);
    await flushDraft(); state.month = date.toISOString().slice(0, 7); renderCalendar();
  });
  for (const selector of ['#diaryKeyword', '#diaryStart', '#diaryEnd']) $(selector).oninput = renderResults;
  $('#diaryClearSearch').onclick = () => { ['#diaryKeyword', '#diaryStart', '#diaryEnd'].forEach(s => $(s).value = ''); renderResults(); };
  $('#diaryForm').onsubmit = event => { event.preventDefault(); run(saveEntry)(); };
  $('#diaryDelete').onclick = run(deleteEntry);
  $('#diaryRetry').onclick = run(async () => { await flushDraft(); if (!state.data.drafts.some(d => d.date === state.date)) status('没有待保存的草稿'); });
  window.addEventListener('pagehide', () => { if (!state.busy) persistDraft().catch(() => {}); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !state.busy) persistDraft().catch(() => {}); });
  window.addEventListener('learning-data-restored', run(async () => { state.data = await db.getDiary(); if (!$('#diaryPage').classList.contains('hidden')) { loadEditor(); renderViews(); } }));
}
