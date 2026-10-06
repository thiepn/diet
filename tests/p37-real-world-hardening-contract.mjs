import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const store=new Map();
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
}});

const writes=await import('../v2/write-api.mjs?p37-contract-a');
const meal={date:'2026-10-06',mealType:'Lunch',title:'Test',items:[{name:'Test',calories:100,protein:10}]};

let calls=0;
await assert.rejects(
  ()=>writes.logManualMeal({rpc:async()=>{calls++;return {data:null,error:{code:'PGRST204',message:'schema mismatch'}}}},meal),
  error=>error?.code==='PGRST204'
);
assert.equal(calls,1,'deterministic PGRST errors must not be retried or turned into uncertain writes');
assert.equal(writes.getDietWriteGuardState().kind,'clear');

let release;
const slowClient={rpc:()=>new Promise(resolve=>{release=()=>resolve({data:{meal_id:'one'},error:null})})};
const first=writes.logManualMeal(slowClient,meal);
assert.equal(writes.getDietWriteGuardState().kind,'in_flight');
await assert.rejects(
  ()=>writes.logManualMeal({rpc:async()=>({data:{},error:null})},meal),
  error=>error?.code==='DIET_WRITE_IN_PROGRESS'
);
release();
await first;
assert.equal(writes.getDietWriteGuardState().kind,'clear');

calls=0;
await assert.rejects(
  ()=>writes.logManualMeal({rpc:async()=>{calls++;return {data:null,error:{name:'TypeError',message:'Failed to fetch'}}}},meal),
  error=>error?.code==='DIET_WRITE_UNCERTAIN'
);
assert.equal(calls,2,'one bounded retry should use the same mutation request');
assert.equal(writes.getDietWriteGuardState().kind,'uncertain');
const persisted=sessionStorage.getItem('diet-copilot-write-guard-v1');
assert.ok(persisted);
assert.doesNotMatch(persisted,/Failed to fetch|calories|protein|Test/,'write guard persistence must contain no nutrition payload or raw error text');

const reloaded=await import('../v2/write-api.mjs?p37-contract-reload');
assert.equal(reloaded.getDietWriteGuardState().kind,'uncertain','uncertain mutation guard must survive a page reload');
reloaded.clearUncertainWriteGuard();
assert.equal(sessionStorage.getItem('diet-copilot-write-guard-v1'),null);

const data=fs.readFileSync('v2/data.js','utf8');
const food=fs.readFileSync('v2/food.js','utf8');
const editor=fs.readFileSync('v2/meal-editor.js','utf8');
const management=fs.readFileSync('v2/food-management.js','utf8');
const training=fs.readFileSync('v2/training-actions.js','utf8');
const hardening=fs.readFileSync('v2/p37-hardening.js','utf8');
const pwa=fs.readFileSync('v2/pwa.js','utf8');
const shell=fs.readFileSync('v2/shell.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const alias=fs.readFileSync('v2/index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));

for(const token of [
  'loadedOwnerId','state.loadedOwnerId&&state.loadedOwnerId!==ownerId',
  "state.source='memory'","queueBackgroundRefresh('realtime'","queueBackgroundRefresh('online'",
  "queueBackgroundRefresh('resume'","diet-v2-day-rollover","60_000",
  'ownerMatched:!state.model'
]) assert.ok(data.includes(token),`missing P37 data hardening: ${token}`);

for(const source of [food,editor,management,training])assert.match(source,/!s\.writeBlocked/);
assert.ok(hardening.includes("version:'1.0.0-p37'"));
assert.ok(hardening.includes("beforeunload"));
assert.ok(hardening.includes("hasUnsavedInput"));
assert.ok(hardening.includes("reloadForUpdate"));
assert.ok(hardening.includes("foodQuickAddForm"));
assert.ok(hardening.includes("mealEditorForm"));
assert.ok(pwa.includes('DietV2Hardening?.reloadForUpdate'));
assert.ok(shell.includes("diet-v2-day-rollover"));
assert.ok(html.includes('./v2/p37-hardening.js'));
assert.ok(alias.includes('./p37-hardening.js'));
assert.match(sw,/diet-copilot-prod-v2-p37-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p37-1/);
assert.ok(sw.includes("'./v2/p37-hardening.js'"));
assert.ok(aliasSw.includes("'./p37-hardening.js'"));

assert.equal(app.health?.realWorldHardeningContract,'P37');
assert.equal(app.health?.crossOwnerStaleStatePrevented,true);
assert.equal(app.health?.uncertainWriteGuardPersistsAcrossReload,true);
assert.equal(app.health?.globalWriteLock,true);
assert.equal(app.health?.backgroundRefreshCoalesced,true);
assert.equal(app.health?.midnightRolloverAware,true);
assert.equal(app.health?.unsavedInputReloadGuard,true);

const coreFiles=['index.html','v2/index.html','v2/shell.css','vendor/supabase-2.116.0.js'];
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return walk(full);
    return /\.(?:js|mjs)$/.test(entry.name)?[full]:[];
  });
}
coreFiles.push(...walk('v2'));
const rawCoreBytes=[...new Set(coreFiles)].reduce((sum,p)=>sum+fs.statSync(p).size,0);
assert.ok(rawCoreBytes<=750000,`P37 core budget exceeded: ${rawCoreBytes}/750000 bytes`);
assert.equal(app.health.rawCoreAssetObservedBytes,rawCoreBytes);

console.log(JSON.stringify({ok:true,phase:'P37',rawCoreBytes,writeReconciliation:true,ownerIsolation:true,dayRollover:true,unsavedInputGuard:true}));
