import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const account=JSON.parse(read('.well-known/thiepn-account-release.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const data=read('v2/data.js');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const pwa=read('v2/pwa.js');
const migration=read('supabase/migrations/20260929200148_diet_p16_consolidated_reads_and_hot_indexes.sql');
const explicitInvoker=read('supabase/migrations/20260929200457_diet_p16_read_contract_explicit_invoker.sql');
const cleanup=read('supabase/migrations/20260929201015_diet_p16_remove_speculative_hot_indexes.sql');

assert.ok(['2.0.2','2.0.3'].includes(app.release));
assert.ok(['2.0.2','2.0.3'].includes(app.webRelease));
assert.ok(['P16.0','P17.0','P18.0','P19.0'].includes(app.operationsVersion));
assert.equal(app.performanceRelease,'P16');
assert.equal(app.securityRelease,'P14');
assert.equal(app.resilienceRelease,'P15');
assert.equal(account.consumerRelease,app.webRelease);

assert.equal(app.health?.consolidatedOwnerRead,true);
assert.equal(app.health?.normalRefreshDataRequests,1);
assert.equal(app.health?.ownerFilteredFallbackReads,true);
assert.equal(app.health?.ownerFilteredRealtime,true);
assert.equal(app.health?.broadRealtimeDeleteSubscription,false);

assert.equal(backend.performance_policy?.release,'P16');
assert.equal(backend.performance_policy?.read_transport,'diet_app_read_snapshot_security_invoker');
assert.equal(backend.performance_policy?.normal_refresh_data_requests,1);
assert.equal(backend.performance_policy?.compatibility_fallback,'explicit_owner_filtered_multi_query');
assert.equal(backend.performance_policy?.protected_by_rls,true);
assert.equal(backend.performance_policy?.measured_snapshot_execution_ms,21.432);

assert.match(migration,/create or replace function public\.diet_app_read_snapshot\(\)/i);
assert.match(migration,/security invoker/i);
assert.match(migration,/where user_id=uid/);
assert.match(migration,/revoke all on function public\.diet_app_read_snapshot\(\) from public,anon/i);
assert.match(migration,/grant execute on function public\.diet_app_read_snapshot\(\) to authenticated,service_role/i);
for(const name of ['meal_items_owner_sort_p16','saved_foods_owner_rank_p16','saved_meals_owner_rank_p16']){
  assert.match(migration,new RegExp(name));
  assert.match(cleanup,new RegExp('drop index if exists public\\.'+name));
}
assert.match(explicitInvoker,/alter function public\.diet_app_read_snapshot\(\) security invoker/i);
assert.equal(backend.performance_policy?.speculative_p16_indexes_retained,false);
assert.deepEqual(backend.performance_policy?.indexes,[]);

assert.match(data,/client\.rpc\('diet_app_read_snapshot'\)/);
assert.match(data,/state\.readTransport='snapshot_rpc'/);
assert.match(data,/state\.readTransport='legacy_owner_queries'/);
assert.match(data,/snapshotRpcUnavailable/);
assert.match(data,/code==='PGRST202'/);
const ownerFilters=[...data.matchAll(/\.eq\('user_id',ownerId\)/g)].length;
assert.ok(ownerFilters>=6,'Legacy fallback must retain explicit owner predicates.');
assert.match(data,/const ownerFilter=`user_id=eq\.\$\{state\.user\.id\}`/);
assert.match(data,/for\(const event of \['INSERT','UPDATE'\]\)/);
assert.doesNotMatch(data,/channel\.on\('postgres_changes',\{event:'\*'/);
assert.match(data,/version:'2\.0\.(?:1-p16|3-p17)'/);

assert.match(sw,/diet-copilot-prod-v2-p(?:16|17)-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p(?:16|17)-1/);
assert.match(pwa,/version:'2\.0\.(?:2-p16|3-p17)'/);

const budgetFiles=[
  'index.html',
  'v2/index.html',
  'v2/shell.css',
  'vendor/supabase-2.116.0.js'
];
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return walk(full);
    return /\.(?:js|mjs)$/.test(entry.name)?[full]:[];
  });
}
budgetFiles.push(...walk('v2'));
const unique=[...new Set(budgetFiles)];
const rawBytes=unique.reduce((sum,p)=>sum+fs.statSync(p).size,0);
assert.ok(rawBytes<=700000,`P16 raw core asset budget exceeded: ${rawBytes} bytes`);

assert.doesNotMatch(data,/sb_secret_[A-Za-z0-9_-]+/i);
assert.equal(backend.security_policy?.release,'P14');
assert.equal(backend.resilience_policy?.release,'P15');

console.log(JSON.stringify({ok:true,rawCoreBytes:rawBytes,normalRefreshDataRequests:1,measuredSnapshotExecutionMs:21.432}));
