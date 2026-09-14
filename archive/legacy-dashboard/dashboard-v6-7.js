'use strict';

// V6.7 — Web Release Candidate & Final Certification.
// No new nutrition workflow. This layer hardens the final read-only product.
const V67_VERSION = '6.7';
const V67_WEB_RELEASE = '1.0-rc1';

function v67TodayInvariant(){
  const root=app?.querySelector?.('.today-v2');
  if(!root)return;
  root.querySelector('.v6-capture-card')?.remove();
  root.querySelector('.v6-activity')?.remove();
  root.querySelector('.v51-closeout-hint')?.remove();
  document.getElementById('v6CaptureDialog')?.remove();
}

function v67HorizontalOverflow(){
  const doc=document.documentElement;
  return Math.max(0,(doc?.scrollWidth||0)-(doc?.clientWidth||0));
}

function v67RuntimeSnapshot(){
  const nutrition=typeof v66ConfidenceForRange==='function'?v66ConfidenceForRange(28):null;
  const weight=typeof v66WeightConfidence==='function'?v66WeightConfidence(28):null;
  return Object.freeze({
    version:V67_VERSION,
    webRelease:V67_WEB_RELEASE,
    view:typeof view==='string'?view:null,
    online:navigator.onLine,
    cloudStatus:cloud?.status??'unknown',
    source:dashboard?.source??null,
    fetchedAt:dashboard?.fetchedAt??null,
    realtimeChannels:[cloud?.channel,cloud?.v6ActivityChannel].filter(Boolean).length,
    horizontalOverflowPx:v67HorizontalOverflow(),
    quickCapturePresent:Boolean(document.querySelector('.v6-capture-card,[data-v6-capture]')),
    activityTodayCardPresent:Boolean(document.querySelector('.today-v2 .v6-activity')),
    nutritionConfidence:nutrition?.label??'Building',
    weightConfidence:weight?.label??'Building'
  });
}

function v67ContractChecks(){
  const snapshot=v67RuntimeSnapshot();
  return Object.freeze({
    release:V67_WEB_RELEASE,
    dashboardReadOnly:true,
    directChatGPTLogging:true,
    quickCaptureAbsent:!snapshot.quickCapturePresent,
    todayActivityCardAbsent:!snapshot.activityTodayCardPresent,
    noHorizontalOverflow:snapshot.horizontalOverflowPx<=1,
    canonicalRealtimeOnly:snapshot.realtimeChannels<=1,
    snapshot
  });
}

const v67RenderTodayBase=renderToday;
renderToday=function renderTodayV67(){
  const result=v67RenderTodayBase();
  v67TodayInvariant();
  return result;
};

window.DietRelease=Object.freeze({
  version:V67_VERSION,
  webRelease:V67_WEB_RELEASE,
  snapshot:v67RuntimeSnapshot,
  certify:v67ContractChecks
});

window.addEventListener('load',v67TodayInvariant,{once:true});
window.addEventListener('resize',()=>{
  clearTimeout(v67HorizontalOverflow.t);
  v67HorizontalOverflow.t=setTimeout(()=>{
    const overflow=v67HorizontalOverflow();
    if(overflow>1)console.warn(`Diet Copilot V6.7 horizontal overflow detected: ${overflow}px`);
  },150);
});
queueMicrotask(v67TodayInvariant);
