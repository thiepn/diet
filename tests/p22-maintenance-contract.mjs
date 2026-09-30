import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const lock=JSON.parse(read('supply-chain.lock.json'));
const migration=read('supabase/migrations/20260929231309_diet_p22_long_term_operability_supply_chain_maintenance.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p))
  .join('\n');

assert.equal(app.webRelease,'2.0.3');
assert.ok(['P22.0','P23.0'].includes(app.operationsVersion),'P22 maintenance controls must remain valid through P23.');
assert.equal(app.maintenanceRelease,'P22');
assert.equal(app.maintenanceModel,'immutable-supply-chain-weekly-maintenance-upgrade-readiness-v1');
for(const [k,v] of Object.entries({
  securityRelease:'P14',resilienceRelease:'P15',performanceRelease:'P16',
  privacyRelease:'P17',integrityRelease:'P18',concurrencyRelease:'P19',
  changeGovernanceRelease:'P20',incidentCertificationRelease:'P21'
})) assert.equal(app[k],v);

assert.equal(app.health?.schemaContractRelationCount,26);
assert.equal(app.health?.maintenanceAudit,true);
assert.equal(app.health?.maintenanceAuditStatus,'pass');
assert.equal(app.health?.maintenanceCronUtc,'04:07 Sunday');
assert.equal(app.health?.maintenanceAuditRetentionDays,730);
assert.equal(app.health?.cronHistoryRetentionDays,90);
assert.equal(app.health?.expectedDietCronJobs,7);
assert.equal(app.health?.cronSchedulerHealthy,true);
assert.equal(app.health?.immutableGithubActionPins,true);
assert.equal(app.health?.dependabotGithubActions,true);
assert.equal(app.health?.vendoredSupabaseJsPinned,true);
assert.equal(app.health?.vendoredSupabaseJsVersion,'2.116.0');
assert.match(app.health?.vendoredSupabaseJsSha256||'',/^[0-9a-f]{64}$/);
assert.equal(app.health?.postgres1711UpgradeAvailable,true);
assert.equal(app.health?.dietPostgres1711PreflightClean,true);
assert.equal(app.health?.sharedProjectUpgradeRequiresCrossAppReview,true);
assert.equal(app.health?.maintenanceStatusServiceOnly,true);
assert.equal(app.health?.autoDependencyUpdate,false);
assert.equal(app.health?.autoPlatformUpgrade,false);

const policy=backend.maintenance_policy;
assert.equal(policy?.release,'P22');
assert.deepEqual(policy?.migration_versions,['20260929231309']);
assert.equal(policy?.database?.release_status,'pass');
assert.equal(policy?.database?.audit_retention_days,730);
assert.equal(policy?.database?.weekly_cron_utc,'04:07_sunday');
assert.equal(policy?.database?.expected_diet_jobs,7);
assert.equal(policy?.database?.cron_history_retention_days,90);
assert.equal(policy?.database?.cron_history_scope,'current_diet_job_ids_only');
assert.equal(policy?.database?.status_rpc_service_only,true);
assert.equal(policy?.supply_chain?.github_actions,'immutable_commit_sha');
assert.equal(policy?.supply_chain?.dependabot_github_actions,'weekly_review_prs');
assert.equal(policy?.supply_chain?.monthly_upstream_watch,true);
assert.equal(policy?.supply_chain?.remote_browser_scripts,false);
assert.equal(policy?.supply_chain?.remote_browser_esm_imports,false);
assert.equal(policy?.supply_chain?.vendored_supabase_js?.version,'2.116.0');
assert.equal(policy?.supply_chain?.vendored_supabase_js?.sha256,app.health.vendoredSupabaseJsSha256);
assert.equal(policy?.platform_upgrade?.current_postgres,'17.6');
assert.equal(policy?.platform_upgrade?.known_security_baseline,'17.11');
assert.equal(policy?.platform_upgrade?.upgrade_available,true);
assert.equal(policy?.platform_upgrade?.diet_preflight_clean,true);
assert.equal(policy?.platform_upgrade?.ltree_or_btree_gist_installed_count,0);
assert.equal(policy?.platform_upgrade?.custom_operator_risk_count,0);
assert.equal(policy?.platform_upgrade?.diet_legacy_pgcrypto_encryption_function_count,0);
assert.equal(policy?.platform_upgrade?.shared_project_cross_app_review_required,true);
assert.equal(policy?.platform_upgrade?.automatic_upgrade,false);
assert.equal(policy?.advisor_security_findings,0);
assert.equal(policy?.advisor_performance_findings,0);
assert.match(policy?.certified_schema_sha256||'',/^[0-9a-f]{64}$/);

assert.equal(backend.change_governance_policy?.checkpoint?.release,'P22');
assert.equal(backend.change_governance_policy?.checkpoint?.operations_version,'P22.0');
assert.equal(backend.change_governance_policy?.checkpoint?.status,'clean');
assert.equal(backend.change_governance_policy?.contract_scope?.private_operational_tables,8);
assert.equal(backend.change_governance_policy?.certified_schema_sha256,policy.certified_schema_sha256);
assert.equal(backend.incident_response_policy?.readiness?.expected_diet_jobs,7);
assert.equal(backend.incident_response_policy?.certified_schema_sha256,policy.certified_schema_sha256);

for(const token of [
  'private.diet_maintenance_audits',
  'diet_p22_maintenance_audits_deny',
  'private.diet_p22_prune_cron_history',
  'private.diet_p22_maintenance_report',
  'private.diet_p22_run_maintenance',
  'public.diet_p22_maintenance_status',
  'diet-p22-maintenance-weekly',
  '7 4 * * 0',
  "interval '730 days'",
  "make_interval(days=>p_retention_days)",
  "'knownSecurityBaseline','17.11'",
  "'sharedProjectUpgradeRequiresCrossAppReview',true",
  "private.diet_p20_certify_release",
  "diet_p21_run_failure_certification('release')"
]) assert.ok(migration.includes(token),'Missing P22 migration contract: '+token);

assert.match(migration,/revoke all on function public\.diet_p22_maintenance_status\(\) from public, anon, authenticated|revoke all on function public\.diet_p22_maintenance_status\(\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.diet_p22_maintenance_status\(\) to service_role/i);
assert.doesNotMatch(browser,/diet_p22_maintenance_status/,'P22 maintenance status must not be browser-called.');
assert.doesNotMatch(browser,/diet_p22_run_maintenance/,'P22 maintenance runner must not enter browser code.');

assert.equal(lock.schemaVersion,1);
assert.equal(lock.policy,'reviewed-immutable-pins-v1');
for(const [name,item] of Object.entries(lock.githubActions)){
  assert.match(item.sha,/^[0-9a-f]{40}$/,'Action must be immutable: '+name);
}
const vendor=lock.vendoredRuntime[0];
const actual=crypto.createHash('sha256').update(fs.readFileSync(vendor.path)).digest('hex');
assert.equal(actual,vendor.sha256);
assert.equal(vendor.version,'2.116.0');
assert.equal(vendor.updatePolicy,'manual_review_plus_cross_browser_regression');
assert.equal(lock.ciTools?.playwright?.version,'1.57.0');

console.log('Diet Copilot P22 long-term maintenance/supply-chain contract passed.');
