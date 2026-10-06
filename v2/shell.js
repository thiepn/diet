const ROUTES = Object.freeze({
  today:{title:'Today',kicker:'Today'},
  food:{title:'Food',kicker:'Food log'},
  progress:{title:'Progress',kicker:'Progress'},
  strategy:{title:'Strategy',kicker:'Strategy'},
  more:{title:'More',kicker:'Settings'}
});

const views=[...document.querySelectorAll('[data-view]')];
const navLinks=[...document.querySelectorAll('[data-route]')];
const title=document.getElementById('routeTitle');
const kicker=document.getElementById('routeKicker');
const main=document.getElementById('mainContent');
const toast=document.querySelector('[data-toast]');
let toastTimer=null;

const inputSelector='input,textarea,select,[contenteditable="true"]';
const mobileQuery=globalThis.matchMedia?.('(max-width:760px)');
function syncVisualViewport(){
  const height=Math.round(globalThis.visualViewport?.height??innerHeight);
  document.documentElement.style.setProperty('--dc-visual-height',height+'px');
}
function syncInputState(){
  const active=document.activeElement;
  const inputActive=Boolean(mobileQuery?.matches&&active?.matches?.(inputSelector));
  if(inputActive)document.documentElement.dataset.inputActive='true';
  else delete document.documentElement.dataset.inputActive;
}

function cleanRoute(hash=location.hash){
  const route=String(hash||'').replace(/^#/,'').trim().toLowerCase();
  return ROUTES[route]?route:'today';
}

function setCurrentRoute(route,{focus=false}={}){
  const current=ROUTES[route]?route:'today';

  for(const view of views){
    const active=view.dataset.view===current;
    view.hidden=!active;
    view.setAttribute('aria-hidden',active?'false':'true');
  }

  for(const link of navLinks){
    const active=link.dataset.route===current;
    if(active) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }

  document.documentElement.dataset.route=current;
  document.title=`${ROUTES[current].title} · Diet Copilot 2.0`;
  if(title) title.textContent=ROUTES[current].title;
  if(kicker) kicker.textContent=ROUTES[current].kicker;

  try{sessionStorage.setItem('diet-v2-route',current)}catch{}
  if(focus) main?.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'auto'});
}

function navigateFromLocation(){
  const route=cleanRoute();
  if(!location.hash){
    let restored='today';
    try{restored=sessionStorage.getItem('diet-v2-route')||'today'}catch{}
    const next=ROUTES[restored]?restored:'today';
    history.replaceState(null,'',`#${next}`);
    setCurrentRoute(next);
    return;
  }
  setCurrentRoute(route);
}

function showToast(message){
  if(!toast||!message) return;
  toast.textContent=message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),2600);
}

function setTodayLabel(){
  const el=document.getElementById('todayDate');
  if(!el) return;
  try{
    el.textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  }catch{
    el.textContent='Today';
  }
}

window.addEventListener('hashchange',()=>setCurrentRoute(cleanRoute(),{focus:true}));
window.addEventListener('resize',()=>{syncVisualViewport();syncInputState();},{passive:true});
globalThis.visualViewport?.addEventListener('resize',syncVisualViewport,{passive:true});
globalThis.visualViewport?.addEventListener('scroll',syncVisualViewport,{passive:true});
document.addEventListener('focusin',syncInputState);
document.addEventListener('focusout',()=>setTimeout(syncInputState,0));

document.addEventListener('click',event=>{
  const coming=event.target.closest('[data-coming]');
  if(coming){
    showToast(coming.dataset.coming);
    return;
  }

  const shellAction=event.target.closest('[data-shell-action]');
  if(shellAction){
    const action=shellAction.dataset.shellAction;
    const handled=window.DietV2Data?.handleShellAction?.(action);
    if(handled)return;
    if(action==='account') showToast('Account integration is still loading.');
    else if(action==='refresh') showToast('Data integration is still loading.');
  }
});

document.addEventListener('keydown',event=>{
  if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey){
    const target=event.target;
    if(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
    if(cleanRoute()!=='food') location.hash='food';
    event.preventDefault();
    requestAnimationFrame(()=>document.getElementById('foodSearchInput')?.focus());
  }
});

syncVisualViewport();
syncInputState();
setTodayLabel();
navigateFromLocation();

window.DietV2Shell=Object.freeze({
  version:'2.0.0-p34-shell',
  routes:Object.keys(ROUTES),
  currentRoute:()=>cleanRoute(),
  navigate(route){
    if(!ROUTES[route]) throw new Error(`Unknown Diet Copilot 2.0 route: ${route}`);
    location.hash=route;
  },
  showToast
});
