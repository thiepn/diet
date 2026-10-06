import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const account=JSON.parse(read('.well-known/thiepn-account-release.json'));
const migration=read('supabase/migrations/20260929214524_diet_p19_concurrency_idempotency_hardening.sql');
const writeApi=read('v2/write-api.mjs');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const pwa=read('v2/pwa.js');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p))
  .join('\n');

assert.equal(app.release,'2.0.3');
assert.equal(app.webRelease,'2.0.3');
assert.equal(account.consumerRelease,'2.0.3');
assert.ok(['P19.0','P20.0','P21.0','P22.0','P23.0','P25.0'].includes(app.operationsVersion),'P19 concurrency controls must remain valid through P25.');
assert.equal(app.concurrencyRelease,'P19');
assert.equal(app.concurrencyModel,'transactional-request-ledger-owner-serialization-v1');
assert.equal(app.securityRelease,'P14');
assert.equal(app.resilienceRelease,'P15');
assert.equal(app.performanceRelease,'P16');
assert.equal(app.privacyRelease,'P17');
assert.equal(app.integrityRelease,'P18');

assert.equal(app.health?.mutationRequestLedger,true);
assert.equal(app.health?.mutationRequestRetentionDays,35);
assert.equal(app.health?.payloadBoundIdempotency,true);
assert.equal(app.health?.ownerMutationSerialization,true);
assert.equal(app.health?.publicWriteWrapperCount,19);
assert.equal(app.health?.privateWriteCoreCount,18);
assert.equal(app.health?.staleContentAutoMerge,false);
assert.equal(app.health?.concurrencyStatusServiceOnly,true);

assert.equal(backend.concurrency_policy?.release,'P19');
assert.deepEqual(backend.concurrency_policy?.migration_versions,['20260929214524']);
assert.equal(backend.concurrency_policy?.public_write_wrappers,19);
assert.equal(backend.concurrency_policy?.private_write_cores,18);
assert.equal(backend.concurrency_policy?.request_identity,'user_id_plus_request_id');
assert.equal(backend.concurrency_policy?.request_binding,'operation_plus_sha256_canonical_jsonb_payload');
assert.equal(backend.concurrency_policy?.exact_replay,'stored_committed_result');
assert.equal(backend.concurrency_policy?.collision_behavior,'reject_same_id_different_operation_or_payload');
assert.equal(backend.concurrency_policy?.owner_mutation_serialization,'pg_advisory_xact_lock');
assert.equal(backend.concurrency_policy?.stale_content_edit_policy,'reject_via_expected_updated_at');
assert.equal(backend.concurrency_policy?.explicit_state_setters,'serialized_last_write_wins');
assert.equal(backend.concurrency_policy?.auto_merge_stale_content,false);
assert.equal(backend.concurrency_policy?.ledger?.retention_days,35);
assert.equal(backend.concurrency_policy?.ledger?.browser_access,false);
assert.equal(backend.concurrency_policy?.ledger?.account_delete_behavior,'cascade_delete');
assert.equal(backend.concurrency_policy?.ledger?.p15_backup_required,false);
assert.equal(backend.concurrency_policy?.status_rpc_service_only,true);
assert.equal(backend.concurrency_policy?.release_status?.started_rows,0);

assert.match(migration,/create table if not exists private\.diet_mutation_requests/i);
assert.match(migration,/references auth\.users\(id\) on delete cascade/i);
assert.match(migration,/primary key\(user_id,request_id\)/i);
assert.match(migration,/payload_sha256/i);
assert.match(migration,/status text not null check \(status in \('started','complete'\)\)/i);
assert.match(migration,/alter table private\.diet_mutation_requests enable row level security/i);
assert.match(migration,/create policy diet_p19_mutation_requests_deny/i);
assert.match(migration,/as restrictive[\s\S]*for all[\s\S]*to authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);

assert.match(migration,/create or replace function private\.diet_p19_begin_mutation/i);
assert.match(migration,/pg_catalog\.pg_advisory_xact_lock/i);
assert.match(migration,/pg_catalog\.hashtextextended\('diet-p19-owner:'\|\|v_uid::text,0\)/i);
assert.match(migration,/extensions\.digest/i);
assert.match(migration,/Request ID collision: this ID is already bound to a different Diet mutation/);
assert.match(migration,/for update/i);
assert.match(migration,/status='complete'/i);
assert.match(migration,/idempotent_replay/);
assert.match(migration,/p19_replay/);

assert.match(migration,/create or replace function private\.diet_p19_complete_mutation/i);
assert.match(migration,/create or replace function private\.diet_p19_prune_mutation_requests/i);
assert.match(migration,/created_at < clock_timestamp\(\)-interval '35 days'/i);

assert.match(migration,/p\.proname like 'diet_app_%'/);
assert.match(migration,/'p_request_id'=any/);
assert.match(migration,/alter function public\.%I\(%s\) set schema private/i);
assert.match(migration,/create function public\.%I\(%s\)/i);
assert.match(migration,/private\.diet_p19_begin_mutation/);
assert.match(migration,/private\.diet_p19_complete_mutation/);
assert.match(migration,/grant execute on function public\.%I\(%s\) to authenticated,service_role/i);
assert.match(migration,/revoke all on function private\.%I\(%s\) from public,anon,authenticated/i);

assert.match(migration,/create or replace function public\.diet_p19_concurrency_status\(\)/i);
assert.match(migration,/revoke all on function public\.diet_p19_concurrency_status\(\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.diet_p19_concurrency_status\(\) to service_role/i);
assert.match(migration,/diet-p19-idempotency-prune/);
assert.match(migration,/27 3 \* \* \*/);

for(const symbol of ['p_expected_updated_at','DIET_WRITE_UNCERTAIN','uncertainWrite','p_request_id']){
  assert.ok(writeApi.includes(symbol),'P19 must preserve browser write-safety symbol '+symbol);
}
assert.doesNotMatch(browser,/diet_p19_begin_mutation/,'P19 private request-claim helper must not appear in browser code.');
assert.doesNotMatch(browser,/diet_p19_complete_mutation/,'P19 private completion helper must not appear in browser code.');
assert.doesNotMatch(browser,/diet_p19_concurrency_status/,'P19 global status endpoint must not be called by browser code.');

assert.match(sw,/diet-copilot-prod-v2-p(?:17|33)-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p(?:17|33)-1/);
assert.match(pwa,/version:'2\.0\.3-p17'/);

assert.match(writeApi,/completeOnboarding:'diet_app_complete_onboarding'/);
assert.match(writeApi,/p_request_id:rid/);
console.log('Diet Copilot P19 concurrency/idempotency contract passed.');
