'use strict';

function p4WeekSnapshotMarkup() {
  const complete = completeDates(7);
  const avgCalories = complete.length ? average(complete.map(d=>totalsFor(d).calories)) : null;
  const avgProtein = complete.length ? average(complete.map(d=>totalsFor(d).protein)) : null;
  const weights = dashboard.weights.filter(w=>w.date>=rangeStart(7)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightChange = weights.length > 1 ? Number(weights.at(-1).weight)-Number(weights[0].weight) : null;
  const latest = latestWeight();
  return `<aside class="p4-week-card" aria-label="Seven day snapshot">
    <div class="p4-week-card-head"><div><strong>7-day snapshot</strong><span>Complete days only for intake averages</span></div></div>
    <div class="p4-week-grid">
      <div class="p4-week-stat calories"><span>Avg calories</span><strong>${avgCalories==null?'—':`${fmt(avgCalories)} kcal`}</strong></div>
      <div class="p4-week-stat protein"><span>Avg protein</span><strong>${avgProtein==null?'—':`${fmt(avgProtein,1)} g`}</strong></div>
      <div class="p4-week-stat weight"><span>Weight change</span><strong>${weightChange==null?(latest?`${fmt(latest.weight,1)} kg`:'—'):`${weightChange>0?'+':''}${fmt(weightChange,1)} kg`}</strong></div>
      <div class="p4-week-stat complete"><span>Complete days</span><strong>${complete.length}/7</strong></div>
    </div>
    <div class="p4-week-note">This summary uses your recorded Diet Copilot history and does not treat incomplete days as low-calorie days.</div>
  </aside>`;
}

function p4TodayHeaderMarkup() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  return `<div class="p4-desktop-today-head"><div><h2>Today</h2><p>Your current nutrition and weight overview.</p></div><div class="p4-desktop-date">${esc(date)}</div></div>`;
}

const p4RenderTodayBase = renderToday;
renderToday = function renderTodayP4() {
  const result = p4RenderTodayBase();
  const root = app.querySelector('.today-v2');
  if (root) {
    if (!root.querySelector('.p4-desktop-today-head')) root.insertAdjacentHTML('afterbegin',p4TodayHeaderMarkup());
    if (!root.querySelector('.p4-week-card')) root.insertAdjacentHTML('beforeend',p4WeekSnapshotMarkup());
  }
  return result;
};

function p4SyncDesktopAccount() {
  const label = document.getElementById('desktopAccountState');
  if (!label) return;
  if (cloud?.user?.email) {
    label.textContent = cloud.user.email;
    return;
  }
  const status = String(document.getElementById('statusText')?.textContent || '').toLowerCase();
  if (status.includes('error')) label.textContent = 'Needs attention';
  else if (status.includes('refresh')) label.textContent = 'Syncing…';
  else label.textContent = 'Sign in';
}

const p4UpdateStatusBase = updateStatus;
updateStatus = function updateStatusP4() {
  p4UpdateStatusBase();
  p4SyncDesktopAccount();
};

document.querySelector('.desktop-account[data-open-account]')?.addEventListener('click',openConnection);
p4SyncDesktopAccount();
