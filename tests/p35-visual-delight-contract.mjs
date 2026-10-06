import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const alias=read('v2/index.html');
const css=read('v2/shell.css');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const app=JSON.parse(read('.well-known/thiepn-app.json'));

assert.equal(app.health?.visualDelightContract,'P35-superseded');
assert.equal(app.health?.p35DelightRuntimeActive,false);
assert.equal(app.health?.visualSystem,'V1-restored-on-V2-runtime');
assert.equal(app.visualSystemPhase,'V1-restored');

assert.doesNotMatch(html,/p35-delight\.js/);
assert.doesNotMatch(alias,/p35-delight\.js/);
assert.doesNotMatch(sw,/p35-delight\.js/);
assert.doesNotMatch(aliasSw,/p35-delight\.js/);
assert.equal(fs.existsSync('v2/p35-delight.js'),false);

for(const token of [
  '--motion-fast','--motion-base','--motion-slow','--ease-pop','--shadow-lift',
  'dc-action-shine','dc-chip-pulse','dc-progress-sheen','dc-chart-draw',
  'dc-bar-rise','dc-value-pop','dc-success-pop','dc-error-nudge',
  'dc-dialog-in','dc-sheet-in','dc-ripple','dc-success-burst'
]) assert.ok(!css.includes(token),`superseded P35 token still active: ${token}`);

assert.ok(css.includes('.dc-account-platform-note'));
assert.ok(css.includes('.dc-account-ecosystem'));

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
assert.ok(rawCoreBytes<=750000,`restored visual core budget exceeded: ${rawCoreBytes}/750000 bytes`);
assert.equal(app.health.rawCoreAssetObservedBytes,rawCoreBytes);

console.log(JSON.stringify({ok:true,phase:'P35-superseded',visualSystem:'V1-restored-on-V2-runtime',rawCoreBytes}));
