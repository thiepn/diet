import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isDefinitiveAuthFailure,classifyReadFailure,DietReleaseGuardsP10
} from '../src/engine/release-guards.mjs';

const canonicalGuard=fs.readFileSync('src/engine/release-guards.mjs','utf8');
const browserGuard=fs.readFileSync('v2/engine/release-guards.mjs','utf8');
assert.equal(browserGuard,canonicalGuard,'Deployable P10 release guard drifted from canonical source.');
import {
  logSavedFood,clearUncertainWriteGuard,getDietWriteGuardState
} from '../v2/write-api.mjs';
import { buildDietV2ReadModel } from '../v2/read-model.mjs';

assert.equal(DietReleaseGuardsP10.version,'1.0.0-p10');
assert.equal(isDefinitiveAuthFailure({status:401,message:'JWT expired'}),true);
assert.equal(isDefinitiveAuthFailure({status:403,message:'Forbidden'}),true);
assert.equal(isDefinitiveAuthFailure({code:'session_not_found'}),true);
assert.equal(isDefinitiveAuthFailure({message:'Refresh token already used'}),true);
assert.equal(isDefinitiveAuthFailure({name:'TypeError',message:'Failed to fetch'}),false);
assert.equal(classifyReadFailure({name:'TypeError',message:'Failed to fetch'}),'transient');
assert.equal(classifyReadFailure({status:503,message:'upstream unavailable'}),'transient');
assert.equal(classifyReadFailure({status:400,message:'bad request'}),'other');
assert.equal(classifyReadFailure({status:401,message:'invalid JWT'}),'auth_invalid');

{
  clearUncertainWriteGuard();
  const calls=[];
  let attempt=0;
  const client={rpc:async(name,args)=>{
    calls.push({name,args:{...args}});
    attempt++;
    if(attempt===1)return {data:null,error:{status:503,message:'temporary outage'}};
    return {data:{meal_id:'meal-1'},error:null};
  }};
  const result=await logSavedFood(client,{
    savedFoodId:'food-1',date:'2026-09-29',mealType:'Lunch',requestId:'app:test:retry'
  });
  assert.equal(result.data.meal_id,'meal-1');
  assert.equal(calls.length,2);
  assert.equal(calls[0].args.p_request_id,'app:test:retry');
  assert.equal(calls[1].args.p_request_id,'app:test:retry','Automatic retry must reuse the same idempotency key.');
  assert.equal(getDietWriteGuardState().blocked,false);
}

{
  clearUncertainWriteGuard();
  let calls=0;
  const failing={rpc:async()=>{calls++;return {data:null,error:{status:503,message:'response lost'}};}};
  await assert.rejects(
    logSavedFood(failing,{savedFoodId:'food-1',date:'2026-09-29',mealType:'Lunch',requestId:'app:test:uncertain'}),
    error=>error?.code==='DIET_WRITE_UNCERTAIN'
  );
  assert.equal(calls,2,'One automatic retry is allowed before the outcome becomes uncertain.');
  const guard=getDietWriteGuardState();
  assert.equal(guard.blocked,true);
  assert.equal(guard.requestId,'app:test:uncertain');

  let forbiddenCalls=0;
  const wouldSucceed={rpc:async()=>{forbiddenCalls++;return {data:{meal_id:'duplicate'},error:null};}};
  await assert.rejects(
    logSavedFood(wouldSucceed,{savedFoodId:'food-1',date:'2026-09-29',mealType:'Lunch',requestId:'app:test:new-click'}),
    error=>error?.code==='DIET_WRITE_RECONCILE_REQUIRED'
  );
  assert.equal(forbiddenCalls,0,'Manual retry must be blocked until a cloud refresh reconciles canonical state.');

  clearUncertainWriteGuard();
  const result=await logSavedFood(wouldSucceed,{
    savedFoodId:'food-1',date:'2026-09-29',mealType:'Lunch',requestId:'app:test:after-refresh'
  });
  assert.equal(result.data.meal_id,'duplicate');
  assert.equal(getDietWriteGuardState().blocked,false);
}

function dateKey(start,index){
  const d=new Date(start+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+index);
  return d.toISOString().slice(0,10);
}
{
  const dailyLogs=[],meals=[],mealItems=[],weights=[],activityDaily=[];
  const days=730;
  for(let i=0;i<days;i++){
    const date=dateKey('2024-10-01',i);
    const dailyId='d-'+i;
    const mealId='m-'+i;
    dailyLogs.push({
      id:dailyId,log_date:date,calorie_target:2400,protein_target:160,
      status:i%11===0?'partial':'complete',updated_at:date+'T20:00:00Z'
    });
    meals.push({
      id:mealId,daily_log_id:dailyId,meal_type:'Dinner',title:'Stress meal '+i,
      calories:2200+(i%7)*40,protein:150+(i%5),confidence:'high',source:'manual_exact',
      eaten_at:date+'T18:00:00Z',updated_at:date+'T18:05:00Z'
    });
    mealItems.push({
      id:'i-'+i,meal_id:mealId,name:'Stress food '+i,quantity_text:'1 serving',
      calories:2200+(i%7)*40,protein:150+(i%5),carbs:260,fat:70,fiber:30,
      confidence:'high',source:'manual_exact',sort_order:0
    });
    if(i%2===0)weights.push({id:'w-'+i,entry_date:date,weight:84-i*0.002,updated_at:date+'T08:00:00Z'});
    if(i>=days-120)activityDaily.push({activity_date:date,steps:7000+(i%9)*500,active_calories:450,exercise_minutes:45});
  }
  // Adversarial malformed/future rows must not poison the model.
  weights.push({entry_date:'not-a-date',weight:'NaN'});
  weights.push({entry_date:'2099-01-01',weight:999});
  meals.push({id:'bad-meal',daily_log_id:'missing',title:'Future',calories:'NaN',protein:null,eaten_at:'2099-01-01T12:00:00Z'});
  mealItems.push({id:'bad-item',meal_id:'bad-meal',name:'Bad',calories:'oops',protein:'oops'});

  const model=buildDietV2ReadModel({
    profile:{calorie_target:2400,protein_target:160,goal_weight:80,desired_weekly_weight_change:-0.25},
    dailyLogs,meals,mealItems,weights,
    goalPhases:[{phase_type:'cut',start_date:'2024-10-01',calorie_target:2400,protein_target:160,goal_weight:80,desired_weekly_weight_change:-0.25,active:true}],
    savedFoods:[],savedMeals:[],targetRecommendations:[],activityDaily,trainingDays:[],
    trainingDistribution:{enabled:false,weekly_template:{}}
  },{asOfDate:'2026-09-29'});

  assert.equal(model.asOfDate,'2026-09-29');
  assert.ok(model.progress.rawWeights.length>300);
  assert.ok(model.progress.intake.length>700);
  assert.ok(Number.isFinite(model.today.trendWeight));
  assert.ok(Number.isFinite(model.strategy.currentTarget));
  assert.ok(model.progress.rawWeights.every(x=>x.date<='2026-09-29'));
  assert.ok(model.food.recentMeals.every(x=>x.date<='2026-09-29'));
  assert.ok(model.meta.legacyRows.daily>=700);
}

{
  const html=fs.readFileSync('v2/index.html','utf8');
  const sw=fs.readFileSync('v2/sw.js','utf8');
  const manifest=JSON.parse(fs.readFileSync('v2/manifest.webmanifest','utf8'));
  const pwa=fs.readFileSync('v2/pwa.js','utf8');
  const data=fs.readFileSync('v2/data.js','utf8');
  const rootSw=fs.readFileSync('sw.js','utf8');
  const css=fs.readFileSync('v2/shell.css','utf8');

  assert.equal(manifest.scope,'./');
  assert.equal(manifest.start_url,'./#today');
  assert.equal(manifest.display,'standalone');
  assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html,/src="\.\/pwa\.js"/);
  assert.match(pwa,/register\('\.\/sw\.js',\{scope:'\.\/'/);
  assert.match(sw,/diet-copilot-v2-rc-p\d+/,'V2 worker must keep a versioned RC cache namespace.');
  assert.match(sw,/\.\/engine\/release-guards\.mjs/);
  assert.match(sw,/request\.mode==='navigate'/);
  assert.match(sw,/new URL\('\.\/index\.html',self\.registration\.scope\)/);
  assert.doesNotMatch(sw,/\.\.\/index\.html/,'V2 offline navigation must never fall back to the V1 root shell.');
  assert.doesNotMatch(sw,/\.\.\/diet-app\.js|\.\.\/diet\.css/,'V2 service worker must not cache the V1 application bundle.');
  assert.match(sw,/native-auth-start\.html/);
  assert.match(sw,/error_description/);
  assert.match(data,/isDefinitiveAuthFailure\(verified\.error\)/);
  assert.match(data,/auth\.signOut\(\{scope:'local'\}\)/);
  assert.match(data,/dietV2AuthStorage\.removeItem\(DIET_V2_AUTH_STORAGE_KEY\)/);
  assert.match(data,/clearUncertainWriteGuard\(\)/);
  assert.match(data,/async function fetchPagedRows\(/,'Canonical long-history reads must use deterministic pagination.');
  assert.match(data,/query\.range\(from,to\)/,'Paginated reads must request explicit API ranges.');
  assert.match(data,/OFFLINE_HISTORY_DAYS=400/,'Offline cache must be bounded independently from complete cloud history.');
  assert.match(data,/buildOfflineSnapshot\(raw\)/,'Offline cache must use a compact snapshot.');
  assert.match(data,/diet-copilot-v2-read-cache-v2/,'Bounded cache must use a migrated cache version.');
  assert.match(rootSw,/key\.startsWith\('diet-copilot-web-'\)/,'V1 service worker must clean only its own cache namespace.');
  assert.doesNotMatch(rootSw,/key\.startsWith\('diet-copilot'\)\)/,'V1 service worker must not delete V2 caches.');
  assert.match(rootSw,/url\.pathname\.startsWith\(rootScope\+'v2\/'\)\)return/,'V1 service worker must never answer V2 navigations with the V1 offline shell.');

  const dialogs=[...html.matchAll(/<dialog\b[^>]*>/g)].map(match=>match[0]);
  assert.ok(dialogs.length>=8,'Release candidate should expose all expected modal surfaces.');
  for(const tag of dialogs) assert.match(tag,/aria-labelledby=/,'Every native dialog needs an accessible name: '+tag);
  assert.doesNotMatch(html,/user-scalable\s*=\s*no/i,'V2 must not disable browser zoom.');
  assert.doesNotMatch(html,/maximum-scale\s*=\s*1/i,'V2 must not cap accessibility zoom.');
  assert.match(html,/dc-more-icon" aria-hidden="true"/,'Decorative More icons must be hidden from assistive technology.');
  assert.match(css,/\.dc-quick-actions--food\{display:flex;overflow-x:auto/,'Mobile food shortcuts must remain one compact horizontal row.');
  assert.match(css,/\.dc-bottom-nav\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,'Mobile primary navigation must remain a single five-item row.');
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/,'System reduced-motion support must remain present.');
}

console.log('Diet Copilot 2.0 P10 adversarial release-hardening tests passed.');
