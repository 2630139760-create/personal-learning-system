// Await pending local writes before changing modules or taking/restoring a backup.
const leaveGuards = [];
export const registerLeaveGuard = guard => leaveGuards.push(guard);
export async function flushPendingEdits() { for (const guard of leaveGuards) await guard(); }
export async function activatePage(page) {
  await flushPendingEdits();
  for (const name of ['today', 'ledger', 'diary']) document.getElementById(`${name}Page`)?.classList.toggle('hidden', name !== page);
  document.getElementById('detailPanel').classList.toggle('hidden', page !== 'today');
  const app = document.getElementById('app');
  app.classList.toggle('ledger-mode', page === 'ledger');
  app.classList.toggle('diary-mode', page === 'diary');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
}
