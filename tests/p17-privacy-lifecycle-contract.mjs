import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const account=JSON.parse(read('.well-known/thiepn-account-release.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const migration=read('supabase/migrations/20260929201804_diet_p17_owner_export_and_lifecycle_contract.sql');
const data=read('v2/data.js');
const settings=read('v2/settings.js');
const auth=read('v2/auth-storage.mjs');
const html=read('index.html');
const alias=read('v2/index.html');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const pwa=read('v2/pwa.js');
const allBrowser=[data,settings,auth,read('v2/write-api.mjs'),read('v2/copilot.js')].join('\n');

assert.equal(app.release,'2.0.3');
assert.equal(app.webRelease,'2.0.3');
assert.ok(['P17.0','P18.0','P19.0','P20.0','P21.0','P22.0','P23.0','P25.0'].includes(app.operationsVersion));
assert.equal(app.privacyRelease,'P17');
assert.equal(app.securityRelease,'P14');
assert.equal(app.resilienceRelease,'P15');
assert.equal(app.performanceRelease,'P16');
assert.equal(account.consumerRelease,'2.0.3');

assert.equal(app.health?.authoritativeOwnerExport,true);
assert.equal(app.health?.ownerExportTableCount,18);
assert.equal(app.health?.localDevicePurge,true);
assert.equal(app.health?.accountDeletionCentralOnly,true);
assert.equal(app.health?.liveDietRowsCascadeOnAccountDelete,true);
assert.equal(app.health?.ownerExportIncludesCredentialDigest,false);
assert.equal(app.health?.ownerExportIncludesRecoverySnapshots,false);
assert.equal(app.health?.encryptedBackupRetentionDays,90);

assert.equal(backend.privacy_policy?.release,'P17');
assert.equal(backend.privacy_policy?.owner_export?.rpc,'diet_app_export_owner_data');
assert.equal(backend.privacy_policy?.owner_export?.table_count,18);
assert.equal(backend.privacy_policy?.owner_export?.native_credential_digest_included,false);
assert.equal(backend.privacy_policy?.owner_export?.recovery_snapshots_included,false);
assert.equal(backend.privacy_policy?.account_deletion?.authority,'delete_thiepn_account');
assert.equal(backend.privacy_policy?.account_deletion?.browser_delete_from_diet,false);
assert.equal(backend.privacy_policy?.account_deletion?.live_diet_table_cascade_count,18);
assert.equal(backend.privacy_policy?.account_deletion?.recovery_snapshots_cascade,true);
assert.equal(backend.privacy_policy?.encrypted_offsite_backup_retention_days,90);

assert.match(migration,/create or replace function public\.diet_app_export_owner_data\(\)/i);
assert.match(migration,/security invoker/i);
assert.match(migration,/where x\.user_id=\$1/);
assert.match(migration,/to_jsonb\(x\)-''credential_digest''/);
assert.match(migration,/revoke all on function public\.diet_app_export_owner_data\(\) from public,anon/i);
assert.match(migration,/grant execute on function public\.diet_app_export_owner_data\(\) to authenticated,service_role/i);
assert.match(migration,/create or replace function private\.diet_p17_lifecycle_status\(\)/i);
assert.match(migration,/con\.confdeltype='c'/);
assert.match(migration,/diet_recovery_snapshots/);

for(const table of [
  'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
  'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
  'target_recommendations','activity_daily','training_distribution_settings',
  'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
])assert.match(migration,new RegExp("'"+table+"'"));

assert.match(data,/client\.rpc\('diet_app_export_owner_data'\)/);
assert.match(data,/export async function exportDietV2OwnerData/);
assert.match(data,/export async function purgeDietV2LocalDevice/);
assert.match(data,/clearDietV2AuthArtifacts/);
assert.match(data,/clearDietV2OfflineCache\(\)/);
assert.match(data,/clearOAuthRelayState\(\)/);
assert.match(data,/clearUncertainWriteGuard\(\)/);
assert.match(data,/version:'2\.0\.3-p17'/);

assert.match(auth,/export function clearDietV2AuthArtifacts/);
assert.match(auth,/DIET_V2_AUTH_STORAGE_KEY/);
assert.match(auth,/PKCE_FALLBACK_PREFIX/);

assert.match(settings,/exportDietV2OwnerData/);
assert.match(settings,/purgeDietV2LocalDevice/);
assert.match(settings,/clearTelemetry\(\)/);
assert.match(settings,/localStorage\.removeItem\(PREF_KEY\)/);
assert.match(settings,/DietV2Copilot\?\.clearSession/);
assert.match(settings,/version:'2\.0\.3-p17'/);
assert.doesNotMatch(settings,/buildDietJsonBackup/);

assert.match(html,/id="clearDeviceDataButton"/);
assert.match(html,/all 18 Diet tables/);
assert.match(html,/Cloud nutrition data is not deleted/);
assert.match(html,/90-day retention/);
assert.match(alias,/id="clearDeviceDataButton"/);

assert.doesNotMatch(allBrowser,/\.rpc\(['"]delete_thiepn_account['"]/,'Central account deletion must not be callable from Diet browser code.');
assert.doesNotMatch(allBrowser,/credential_digest\s*[:=]/i,'Credential digest material must not be introduced into browser code.');

assert.match(sw,/diet-copilot-prod-v2-(?:p(?:17|33|34|35|36|37)-1|ui-v1-1)/);
assert.match(aliasSw,/diet-copilot-v2-alias-(?:p(?:17|33|34|35|36|37)-1|ui-v1-1)/);
assert.match(pwa,/version:'2\.0\.3-p(?:17|34)'/);

console.log('Diet Copilot P17 privacy/lifecycle contract passed.');
