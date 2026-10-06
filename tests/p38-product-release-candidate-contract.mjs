import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const product=JSON.parse(read('product-p38-release-candidate.json'));
const html=read('index.html');
const alias=read('v2/index.html');
const sw=read('sw.js');
const p21=read('tests/p21-live-failure.py');
const p11Workflow=read('.github/workflows/p11-rc-live.yml');
const readme=read('README.md');

assert.equal(app.release,'2.0.3');
assert.equal(app.webRelease,'2.0.3');
assert.equal(app.releaseChannel,'stable');
assert.equal(app.stable,true);
assert.equal(app.productReleasePhase,'P38');
assert.equal(app.productReleaseState,'candidate-certified');
assert.equal(app.featureFreeze,true);
assert.equal(app.maintenanceMode,'defect-only');

assert.equal(app.health?.productReleaseCandidateContract,'P38');
assert.equal(app.health?.candidateRuntimePhase,'P37');
assert.equal(app.health?.productFeatureFreeze,true);
assert.equal(app.health?.productTrackComplete,true);
assert.equal(app.health?.exactPublicDeploymentVerification,true);
assert.equal(app.health?.threeBrowserProductionCertification,true);
assert.equal(app.health?.historicalRcAutomationRetired,true);
assert.equal(app.health?.p21LiveCacheAssertionDynamic,true);

assert.equal(product.phase,'P38');
assert.equal(product.state,'candidate-certified');
assert.equal(product.release,'2.0.3');
assert.equal(product.releaseChannel,'stable');
assert.equal(product.runtimePhase,'P37');
assert.equal(product.runtimeChanged,false);
assert.equal(product.featureFreeze,true);
assert.equal(product.maintenanceMode,'defect-only');
assert.deepEqual(product.acceptance.liveBrowsers,['chromium','firefox','webkit']);

assert.match(html,/dc-version-badge">2\.0</);
assert.match(alias,/dc-version-badge">2\.0</);
assert.ok(html.includes('<p>Production.</p>'));
assert.doesNotMatch(html,/2\.0 RC|data-coming/);
assert.doesNotMatch(alias,/2\.0 RC|data-coming/);
assert.doesNotMatch(html,/v2AccountProduction|Open legacy v1/);
assert.match(sw,/const CACHE='diet-copilot-prod-v2-[^']+'/,'Production service worker must declare a Diet cache generation.');

assert.ok(p21.includes('EXPECTED_CACHE'));
assert.ok(p21.includes('SOURCE_SW=Path("sw.js")'));
assert.doesNotMatch(p21,/diet-copilot-prod-v2-p17-1/);
assert.match(p11Workflow,/Historical/);
assert.match(p11Workflow,/workflow_dispatch/);
assert.doesNotMatch(p11Workflow,/workflow_run:|branches:\s*\[main\]/);
assert.ok(readme.includes('P38 — Product Release Candidate'));
assert.ok(readme.includes('defect-only maintenance'));

for(const required of [
  'tests/p38-deployed-production.py',
  'tests/p38-live-candidate.py',
  '.github/workflows/p38-release-candidate.yml',
  'docs/P38-PRODUCT-RELEASE-CANDIDATE.md',
  'docs/releases/2.0.3.md'
]) assert.ok(fs.existsSync(required),`missing P38 release artifact: ${required}`);

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
assert.ok(rawCoreBytes<=750000,`P38 core budget exceeded: ${rawCoreBytes}/750000 bytes`);
assert.equal(product.performance.rawCoreAssetObservedBytes,749788,'P38 certification baseline must remain recorded.');
assert.equal(app.health.rawCoreAssetObservedBytes,rawCoreBytes);
if(app.maintenancePatch){
  assert.equal(app.maintenanceMode,'defect-only');
  assert.ok(rawCoreBytes<=750000,'Post-P38 maintenance changes must remain within the core budget.');
}else{
  assert.equal(rawCoreBytes,product.performance.rawCoreAssetObservedBytes,'Unpatched P38 runtime must match its certification baseline.');
}

console.log(JSON.stringify({
  ok:true,phase:'P38',release:'2.0.3',releaseChannel:'stable',
  state:'candidate-certified',runtimePhase:'P37',rawCoreBytes,featureFreeze:true
}));
