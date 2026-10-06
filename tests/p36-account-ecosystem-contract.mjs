import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const alias=read('v2/index.html');
const data=read('v2/data.js');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const release=JSON.parse(read('.well-known/thiepn-account-release.json'));
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');

assert.equal(app.integrationMode,'certified-legacy');
assert.equal(app.sessionAuthority,'thiepn-account');
assert.deepEqual(app.authEntryPoints,['google']);
assert.equal(app.accountConsumerUiPhase,'P36');
assert.equal(app.ecosystem?.hubUrl,'https://thiepn.dev/home/');
assert.equal(app.ecosystem?.accountUrl,'https://account.thiepn.dev/');
assert.equal(app.ecosystem?.accountAppsUrl,'https://account.thiepn.dev/apps');
assert.equal(app.ecosystem?.referrerPolicy,'no-referrer');
assert.equal(app.health?.accountUnavailableDistinctFromSignedOut,true);
assert.equal(app.health?.accountLocalSignOutExplicit,true);
assert.equal(app.health?.accountRawBackendErrorsHidden,true);
assert.equal(app.health?.accountManagementLink,true);
assert.equal(app.health?.hubReturnSurface,true);
assert.equal(app.health?.legacyV1AccountEntry,false);

assert.equal(release.consumerIntegrationPhase,'P36');
assert.equal(release.accountUiPattern,'A8');
assert.equal(release.localSignOutExplicit,true);
assert.equal(release.hubReturnSurface,true);

for(const markup of [html,alias]){
  assert.ok(markup.includes('Manage THIEPN Account'));
  assert.ok(markup.includes('Return to Hub'));
  assert.ok(markup.includes('https://account.thiepn.dev/'));
  assert.ok(markup.includes('href="/home/"'));
  assert.ok(markup.includes('referrerpolicy="no-referrer"'));
  assert.ok(markup.includes('Sign out of Diet'));
  assert.ok(markup.includes('Session authority'));
  assert.ok(markup.includes('THIEPN Account'));
  assert.ok(markup.includes('Diet session'));
  assert.doesNotMatch(markup,/v2AccountProduction|Open legacy v1/);
}

assert.ok(data.includes("scope:'local'"));
assert.ok(data.includes('Account temporarily unavailable'));
assert.ok(data.includes('A network or service failure is not treated as sign-out.'));
assert.ok(data.includes('THIEPN Account owns identity and security; Diet Copilot owns your nutrition data.'));
assert.ok(data.includes("refreshButton.textContent=unavailable?'Retry account check':'Refresh data'"));
assert.doesNotMatch(data,/stale:\['Cached',state\.error/);
assert.doesNotMatch(data,/error:\['Data unavailable',state\.error/);
assert.doesNotMatch(data,/v2AccountProduction/);
assert.doesNotMatch(data,/account-platform\/sdk\/v1\/index\.js/,'Certified-legacy Diet must not pretend to migrate to SDK in P36.');

assert.match(sw,/diet-copilot-prod-v2-p36-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p36-1/);

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
assert.ok(rawCoreBytes<=750000,`P36 core budget exceeded: ${rawCoreBytes}/750000 bytes`);
assert.equal(app.health.rawCoreAssetObservedBytes,rawCoreBytes);

console.log(JSON.stringify({ok:true,phase:'P36',rawCoreBytes,accountAuthority:'thiepn-account',integrationMode:'certified-legacy'}));
