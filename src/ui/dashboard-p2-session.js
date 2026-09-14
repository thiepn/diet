'use strict';

// P2 privacy guard: never render a local nutrition snapshot until the browser
// session has been resolved and belongs to the signed-in Diet Copilot user.
const renderTodayP2Authed = renderToday;
renderToday = function renderTodayP2SessionGuard() {
  if (cloud.status === 'cache' || cloud.status === 'syncing' && dashboard.source === 'empty') {
    app.innerHTML = p2LoadingState();
    return;
  }
  if (!cloud.user) {
    app.innerHTML = p2SignedOutState();
    app.querySelector('[data-open-account]')?.addEventListener('click', openConnection);
    return;
  }
  return renderTodayP2Authed();
};
