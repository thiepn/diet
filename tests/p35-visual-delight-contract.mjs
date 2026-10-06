import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const alias=read('v2/index.html');
const css=read('v2/shell.css');
const delight=read('v2/p35-delight.js');
const data=read('v2/data.js');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');

assert.ok(html.includes('./v2/p35-delight.js'));
assert.ok(alias.includes('./p35-delight.js'));
assert.match(sw,/diet-copilot-prod-v2-p(?:35|36)-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p(?:35|36)-1/);
assert.ok(sw.includes("'./v2/p35-delight.js'"));
assert.ok(aliasSw.includes("'./p35-delight.js'"));

for(const token of [
  '--motion-fast','--motion-base','--motion-slow','--ease-pop','--shadow-lift',
  'dc-action-shine','dc-chip-pulse','dc-progress-sheen','dc-chart-draw',
  'dc-bar-rise','dc-value-pop','dc-success-pop','dc-error-nudge',
  'dc-dialog-in','dc-sheet-in','dc-ripple','dc-success-burst',
  'data-motion="reduce"','prefers-reduced-motion:reduce'
]) assert.ok(css.includes(token),`missing P35 visual token: ${token}`);

for(const token of [
  "version:'1.0.0-p35'","todayCaloriesValue","progressTrendChange",
  "foodWriteStatus","dc-success-pop","dc-success-burst",
  "prefers-reduced-motion: reduce","dc-ripple"
]) assert.ok(delight.includes(token),`missing P35 runtime behavior: ${token}`);

assert.match(data,/pathLength="1"/);
assert.doesNotMatch(delight,/calorie.*celebrat|weight.*celebrat|goal.*confetti/i,'P35 delight must not gamify calories, weight, or goal outcomes.');

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
assert.ok(rawCoreBytes<=750000,`P35 core budget exceeded: ${rawCoreBytes}/750000 bytes`);

console.log(JSON.stringify({ok:true,phase:'P35',rawCoreBytes,motionRespect:true,actionDelight:true}));
