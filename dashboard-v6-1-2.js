'use strict';

// V6.1.2 — remove Quick Capture from the Today screen.
// Diet Copilot is intentionally conversation-first: the user logs food directly
// in ChatGPT, and the dashboard remains a read-only status/analytics surface.

if (typeof v6CaptureMarkup === 'function') {
  v6CaptureMarkup = function v612NoTodayQuickCapture() { return ''; };
}

// Remove an already-rendered card as a safety net for stale/mixed script loads.
document.querySelector('.today-v2 .v6-capture-card')?.remove();

// Keep the invariant on every Today render without changing any other V6 feature.
const v612RenderTodayBase = renderToday;
renderToday = function renderTodayV612() {
  const result = v612RenderTodayBase();
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  return result;
};
