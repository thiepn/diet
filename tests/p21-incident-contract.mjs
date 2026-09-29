import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const account=JSON.parse(read('.well-known/thiepn-account-release.json'));
const migration=read('supabase/migrations/20260929224046_diet_p21_failure_incident_recovery_certification.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p))
  .join('\n');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const pwa=read('v2/pwa.js');

assert.equal(app.release,'2.0.3');
assert.equal(app.webRelease,'2.0.3');
assert.equal(account.consumerRelease,'2.0.3');
assert.ok(['P21.0','P22.0'].includes(app.operationsVersion),'P21 incident controls must remain valid through P22.');
assert.equal(app.incidentCertificationRelease,'P21');
assert.equal(app.incidentModel,'failure-injection-write-freeze-recovery-readiness-v1');
for(const [k,v] of Object.entries({
  securityRelease:'P14',
  resilienceRelease:'P15',
  performanceRelease:'P16',
  privacyRelease:'P17',
  integrityRelease:'P18',
  concurrencyRelease:'P19',
  changeGovernanceRelease:'P20'
})) assert.equal(app[k],v);

assert.equal(app.health?.failureInjectionCertification,true);
assert.equal(app.health?.failureScenarioCount,15);
assert.equal(app.health?.failurePassedCount,15);
assert.equal(app.health?.failureFailedCount,0);
assert.equal(app.health?.emergencyWriteFreeze,true);
assert.equal(app.health?.writesPaused,false);
assert.equal(app.health?.incidentReadinessWatchdog,true);
assert.equal(app.health?.incidentReadinessCronUtc,'03:47');
assert.equal(app.health?.incidentCertificationRetentionDays,365);
assert.equal(app.health?.destructiveFailureInjection,false);
assert.equal(app.health?.recoveryPlanVerified,true);
assert.equal(app.health?.incidentStatusServiceOnly,true);
assert.ok(app.health?.schemaContractRelationCount>=25);

const policy=backend.incident_response_policy;
assert.equal(policy?.release,'P21');
assert.deepEqual(policy?.migration_versions,['20260929224046']);
assert.equal(policy?.failure_certification?.scenario_count,15);
assert.equal(policy?.failure_certification?.passed_count,15);
assert.equal(policy?.failure_certification?.failed_count,0);
assert.equal(policy?.failure_certification?.status,'pass');
assert.equal(policy?.failure_certification?.destructive_restore_executed,false);
assert.equal(policy?.failure_certification?.destructive_failure_injection,false);
assert.equal(policy?.readiness?.daily_cron_utc,'03:47');
assert.equal(policy?.readiness?.status,'pass');
assert.ok([6,7].includes(policy?.readiness?.expected_diet_jobs));
assert.equal(policy?.readiness?.recent_cron_failures_24h,0);
assert.equal(policy?.emergency_write_freeze?.current_writes_paused,false);
assert.equal(policy?.emergency_write_freeze?.browser_access,false);
assert.equal(policy?.emergency_write_freeze?.enforced_at,'private.diet_p19_begin_mutation');
assert.equal(policy?.certification_ledger?.retention_days,365);
assert.equal(policy?.recovery?.latest_snapshot_verified,true);
assert.equal(policy?.recovery?.restore_plan_safe_to_stage,true);
assert.equal(policy?.recovery?.destructive_restore_automatic,false);
assert.equal(policy?.recovery?.operator_review_required,true);
assert.equal(policy?.status_rpc_service_only,true);
assert.equal(policy?.advisor_security_findings,0);
assert.equal(policy?.advisor_performance_findings,0);
assert.match(policy?.certified_schema_sha256||'',/^[0-9a-f]{64}$/);

assert.ok(['P21','P22'].includes(backend.change_governance_policy?.checkpoint?.release));
assert.ok(['P21.0','P22.0'].includes(backend.change_governance_policy?.checkpoint?.operations_version));
assert.equal(backend.change_governance_policy?.checkpoint?.status,'clean');
assert.ok(backend.change_governance_policy?.contract_scope?.private_operational_tables>=7);
assert.equal(backend.change_governance_policy?.certified_schema_sha256,policy.certified_schema_sha256);

for(const token of [
  'private.diet_incident_certifications',
  'private.diet_incident_control',
  'diet_p21_incident_certifications_deny',
  'diet_p21_incident_control_deny',
  'private.diet_p21_set_write_freeze',
  'Diet writes are temporarily paused for incident recovery',
  'private.diet_p21_readiness_report',
  'private.diet_p21_run_failure_certification',
  'private.diet_p21_run_readiness_audit',
  'public.diet_p21_incident_status',
  'diet-p21-readiness-daily',
  '47 3 * * *',
  'incident_write_freeze_blocks_mutations',
  'p20_schema_drift_detected_and_rolled_back',
  'p19_exact_replay_after_lost_response',
  'p18_invalid_numeric_write_rejected',
  'p15_verified_recovery_plan',
  'p14_anon_diet_api_denied'
]) assert.ok(migration.includes(token),'Missing P21 migration contract: '+token);

assert.match(migration,/create policy diet_p21_incident_certifications_deny[\s\S]*as restrictive[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);
assert.match(migration,/create policy diet_p21_incident_control_deny[\s\S]*as restrictive[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);
assert.match(migration,/revoke all on function public\.diet_p21_incident_status\(\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.diet_p21_incident_status\(\) to service_role/i);
assert.match(migration,/diet_p20_certify_release\([\s\S]*'P21'[\s\S]*'P21\.0'/i);
assert.match(migration,/scenarioCount'\)::int<>15/);
assert.match(migration,/destructiveRestoreExecuted',false/i);
assert.match(migration,/autoRepair',false/i);

for(const privateSymbol of [
  'diet_p21_set_write_freeze',
  'diet_p21_run_failure_certification',
  'diet_p21_run_readiness_audit',
  'diet_p21_incident_status'
]) assert.doesNotMatch(browser,new RegExp(privateSymbol),'P21 operator surface must not enter browser code.');

assert.match(sw,/diet-copilot-prod-v2-p17-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p17-1/);
assert.match(pwa,/version:'2\.0\.3-p17'/);

console.log('Diet Copilot P21 failure/incident/recovery contract passed.');
