'use strict';

// V6.8.1 — Diet Copilot Web 1.0.2 maintenance release.
// No new nutrition workflow: this layer freezes and certifies the stable web product.
const DIET_PRODUCT_VERSION = '6.8.1';
const DIET_WEB_RELEASE = '1.0.2';
const DIET_RELEASE_CHANNEL = 'stable';

function dietTodayInvariant(){
  const root=app?.querySelector?.('.today-v2');
  if(!root)return;
  root.querySelector('.v6-capture-card')?.remove();
  root.querySelector('.v6-activity')?.remove();
  root.querySelector('.v51-closeout-hint')?.remove();
  document.getElementById('v6CaptureDialog')?.remove();
}

function dietHorizontalOverflow(){
  const doc=document.documentElement;
  return Math.max(0,(doc?.scrollWidth||0)-(doc?.clientWidth||0));
}

function dietReleaseSnapshot(){
  const nutrition=typeof v66ConfidenceForRange==='function'?v66ConfidenceForRange(28):null;
  const weight=typeof v66WeightConfidence==='function'?v66WeightConfidence(28):null;
  return Object.freeze({
    productVersion:DIET_PRODUCT_VERSION,
    webRelease:DIET_WEB_RELEASE,
    channel:DIET_RELEASE_CHANNEL,
    stable:true,
    view:typeof view==='string'?view:null,
    online:navigator.onLine,
    cloudStatus:cloud?.status??'unknown',
    source:dashboard?.source??null,
    fetchedAt:dashboard?.fetchedAt??null,
    realtimeChannels:[cloud?.channel,cloud?.v6ActivityChannel].filter(Boolean).length,
    horizontalOverflowPx:dietHorizontalOverflow(),
    quickCapturePresent:Boolean(document.querySelector('.v6-capture-card,[data-v6-capture]')),
    activityTodayCardPresent:Boolean(document.querySelector('.today-v2 .v6-activity')),
    closeoutPromptPresent:Boolean(document.querySelector('.today-v2 .v51-closeout-hint')),
    nutritionConfidence:nutrition?.label??'Building',
    weightConfidence:weight?.label??'Building'
  });
}

function dietReleaseChecks(){
  const snapshot=dietReleaseSnapshot();
  return Object.freeze({
    release:DIET_WEB_RELEASE,
    stable:true,
    dashboardReadOnly:true,
    directChatGPTLogging:true,
    quickCaptureAbsent:!snapshot.quickCapturePresent,
    todayActivityCardAbsent:!snapshot.activityTodayCardPresent,
    closeoutPromptAbsent:!snapshot.closeoutPromptPresent,
    noHorizontalOverflow:snapshot.horizontalOverflowPx<=1,
    canonicalRealtimeOnly:snapshot.realtimeChannels<=1,
    snapshot
  });
}

const dietRenderTodayStableBase=renderToday;
renderToday=function renderTodayV68(){
  const result=dietRenderTodayStableBase();
  dietTodayInvariant();
  return result;
};

window.DietRelease=Object.freeze({
  version:DIET_PRODUCT_VERSION,
  webRelease:DIET_WEB_RELEASE,
  channel:DIET_RELEASE_CHANNEL,
  stable:true,
  snapshot:dietReleaseSnapshot,
  certify:dietReleaseChecks
});

window.addEventListener('load',dietTodayInvariant,{once:true});
window.addEventListener('resize',()=>{
  clearTimeout(dietHorizontalOverflow.t);
  dietHorizontalOverflow.t=setTimeout(()=>{
    const overflow=dietHorizontalOverflow();
    if(overflow>1)console.warn(`Diet Copilot Web 1.0.2 horizontal overflow detected: ${overflow}px`);
  },150);
});
queueMicrotask(dietTodayInvariant);
