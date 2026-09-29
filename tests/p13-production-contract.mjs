import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=fs.readFileSync('index.html','utf8');
const alias=fs.readFileSync('v2/index.html','utf8');
const data=fs.readFileSync('v2/data.js','utf8');
const writes=fs.readFileSync('v2/write-api.mjs','utf8');
const pwa=fs.readFileSync('v2/pwa.js','utf8');
const telemetry=fs.readFileSync('v2/telemetry.mjs','utf8');
const rootSw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const account=JSON.parse(fs.readFileSync('.well-known/thiepn-account-release.json','utf8'));
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8'));

for(const html of [root,alias]){
  assert.match(html,/id="moreHealthButton"/);
  assert.match(html,/id="systemHealthDialog"/);
  assert.match(html,/id="healthCopyDiagnostics"/);
  assert.match(html,/id="healthRecentEvents"/);
  assert.doesNotMatch(html,/2\.0 RC/);
}
assert.match(root,/dc-version-badge">2\.0</);
assert.match(data,/\.\/telemetry\.mjs/);
assert.match(data,/startTelemetrySpan\('refresh'/);
assert.match(data,/realtimeStatus/);
assert.match(data,/visibilitychange/);
assert.match(data,/pageshow/);
assert.match(data,/version:'2\.0\.1-p13'/);
assert.match(writes,/recordTelemetry\('write_retry'/);
assert.match(writes,/outcome:'uncertain'/);
assert.match(writes,/p_request_id/);
assert.doesNotMatch(writes,/recordTelemetry\([^\n]+p_request_id/);
assert.match(pwa,/recordTelemetry\('pwa'/);
assert.match(pwa,/version:'2\.0\.1-p13'/);
assert.match(telemetry,/local-only-sanitized-operations/);
assert.doesNotMatch(telemetry,/sendBeacon\(|fetch\(|\.rpc\(|\.from\(/);

assert.match(rootSw,/diet-copilot-prod-v2-p13-1/);
assert.match(rootSw,/\.\/v2\/telemetry\.mjs/);
assert.match(aliasSw,/diet-copilot-v2-alias-p13-1/);
assert.match(aliasSw,/\.\/telemetry\.mjs/);
for(const sw of [rootSw,aliasSw]){
  assert.match(sw,/\['code','sb_flow_id','error','error_code','error_description'\]/);
}

assert.equal(app.webRelease,'2.0.1');
assert.equal(app.operationsVersion,'P13.0');
assert.equal(app.runtimeMode,'adaptive-v2-production-monitored');
assert.equal(app.health?.localOperationalTelemetry,true);
assert.equal(app.health?.telemetryUploadsNutritionData,false);
assert.equal(app.health?.syntheticProductionMonitoring,true);
assert.equal(account.consumerRelease,'2.0.1');
assert.equal(backend.observability_policy?.release,'P13');
assert.equal(backend.observability_policy?.remote_nutrition_telemetry,false);
assert.equal(backend.observability_policy?.retention_days_local,7);
assert.equal(backend.observability_policy?.max_local_events,120);

console.log('Diet Copilot 2.0.1 P13 production monitoring and reliability contract passed.');
