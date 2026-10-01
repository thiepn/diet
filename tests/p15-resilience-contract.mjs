import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const m1=read('supabase/migrations/20260929193123_diet_p15_recovery_snapshots_and_cron.sql');
const m2=read('supabase/migrations/20260929193253_diet_p15_recovery_snapshot_rls_deny.sql');
const m3=read('supabase/migrations/20260929193608_diet_p15_offsite_export_boundary.sql');
const edge=read('supabase/functions/diet-p15-backup-export/index.ts');
const workflow=read('.github/workflows/p15-offsite-backup.yml');
const decrypt=read('scripts/p15-decrypt-backup.sh');

assert.ok(['P15.0','P16.0','P17.0','P18.0','P19.0','P20.0','P21.0','P22.0','P23.0','P25.0'].includes(app.operationsVersion),'P15 resilience must remain valid through P25.');
assert.equal(app.securityRelease,'P14');
assert.equal(app.resilienceRelease,'P15');
assert.equal(app.health?.inDatabaseRecoverySnapshots,true);
assert.equal(app.health?.encryptedOffsiteBackups,true);
assert.equal(app.health?.managedSupabaseDailyBackups,false);
assert.equal(app.health?.pointInTimeRecovery,false);
assert.equal(app.health?.destructiveRestoreAutomatic,false);
assert.equal(app.health?.recoverySnapshotsCascadeOnAccountDelete,true);
assert.equal(app.health?.nativeCredentialMaterialBackedUp,false);

assert.equal(backend.resilience_policy?.release,'P15');
assert.equal(backend.resilience_policy?.supabase_plan,'free');
assert.equal(backend.resilience_policy?.managed_daily_backups,false);
assert.equal(backend.resilience_policy?.point_in_time_recovery,false);
assert.equal(backend.resilience_policy?.destructive_restore_automatic,false);
assert.equal(backend.resilience_policy?.snapshot_account_delete_behavior,'cascade_delete');
assert.equal(backend.resilience_policy?.native_credential_digest_backed_up,false);
assert.equal(backend.resilience_policy?.offsite?.authentication,'github_actions_oidc');
assert.equal(backend.resilience_policy?.offsite?.artifact_retention_days,90);

assert.match(m1,/references auth\.users\(id\) on delete cascade/i);
assert.match(m1,/diet_recovery_snapshots/);
assert.match(m1,/diet_p15_verify_snapshot/);
assert.match(m1,/schema_sha256/);
assert.match(m1,/payload_sha256/);
assert.match(m1,/credential_digest/);
assert.match(m1,/captured_at < clock_timestamp\(\)-interval '35 days'/);
assert.match(m1,/captured_at < clock_timestamp\(\)-interval '370 days'/);
assert.match(m1,/17 2 \* \* \*/);
assert.match(m1,/47 2 1 \* \*/);
assert.match(m1,/destructive_restore_is_automatic',false/);
assert.match(m1,/native_device_credentials_restored',false/);
assert.match(m2,/diet_p15_recovery_snapshots_deny/);
assert.match(m2,/using \(false\)/i);
assert.match(m2,/with check \(false\)/i);

assert.match(m3,/diet_p15_offsite_export/);
assert.match(m3,/verification_status='verified'/);
assert.match(m3,/revoke all on function public\.diet_p15_offsite_export\(\) from public,anon,authenticated/i);
assert.match(m3,/grant execute on function public\.diet_p15_offsite_export\(\) to service_role/i);

for(const required of [
  'EXPECTED_AUDIENCE = "diet-p15-backup"',
  'EXPECTED_REPOSITORY = "thiepn/diet"',
  'EXPECTED_REPOSITORY_ID = "1365859979"',
  'EXPECTED_OWNER_ID = "229373572"',
  'EXPECTED_REF = "refs/heads/main"',
  'p15-offsite-backup.yml@refs/heads/main',
  'EXPECTED_WORKFLOW_NAME = "P15 Encrypted Offsite Backup"',
  'runner_environment',
  'SUPABASE_SERVICE_ROLE_KEY'
]) assert.ok(edge.includes(required), 'Missing Edge OIDC boundary: '+required);
assert.match(edge,/RSASSA-PKCS1-v1_5/);
assert.match(edge,/github_oidc_rejected/);
assert.doesNotMatch(edge,/sb_secret_[A-Za-z0-9_-]+/i);

assert.match(workflow,/id-token:\s*write/);
assert.match(workflow,/audience=diet-p15-backup/);
assert.match(workflow,/aes-256-gcm/);
assert.match(workflow,/shred -u p15-backup\.json/);
assert.match(workflow,/retention-days:\s*90/);
assert.match(workflow,/p15-offsite\/\*\.cms/);
assert.doesNotMatch(workflow,/path:[\s\S]{0,120}p15-backup\.json/);
assert.match(decrypt,/openssl cms -decrypt/);

const cert=new crypto.X509Certificate(read('ops/p15-backup-recovery-cert.pem'));
assert.equal(
  cert.fingerprint256,
  '98:9E:71:79:15:B9:0B:67:7B:87:BF:FE:71:40:73:46:40:37:9F:18:C0:F8:EF:E5:59:F6:DE:01:81:6D:67:97'
);

const ignored=new Set(['.git','node_modules','_site']);
function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
for(const file of walk(root)){
  if(file.endsWith('.gz')||file.endsWith('.zip')||file.endsWith('.png')||file.endsWith('.ico'))continue;
  let content;
  try{content=fs.readFileSync(file,'utf8')}catch{continue}
  assert.doesNotMatch(content,/-----BEGIN (?:RSA )?PRIVATE KEY-----/,'Private recovery key committed: '+file);
  assert.doesNotMatch(content,/sb_secret_[A-Za-z0-9_-]{12,}/i,'Supabase secret key committed: '+file);
}

console.log('Diet Copilot P15 resilience contract passed.');
