import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const alias=read('v2/index.html');
const css=read('v2/shell.css');
const manifest=read('manifest.webmanifest');
const aliasManifest=read('v2/manifest.webmanifest');
const settings=read('v2/settings.js');
const app=JSON.parse(read('.well-known/thiepn-app.json'));

assert.equal(app.visualSystemPhase,'V1-restored');
assert.equal(app.health?.visualSystem,'V1-restored-on-V2-runtime');
assert.equal(app.health?.v1VisualLanguageActive,true);
assert.equal(app.health?.v2GreenVisualShellActive,false);
assert.equal(app.health?.p35DelightRuntimeActive,false);
assert.equal(app.health?.v1UiRestorationContract,'V1-UI');

for(const markup of [html,alias]){
  assert.ok(markup.includes('Nutrition dashboard'));
  assert.ok(markup.includes('dc-v1-account'));
  assert.ok(markup.includes('THIEPN Account'));
  assert.ok(markup.includes('p37-hardening.js'),'V2 hardening must remain active under V1 UI');
  assert.doesNotMatch(markup,/p35-delight\.js/);
}
assert.ok(html.includes('content="#F7F8FA"'));
assert.ok(alias.includes('content="#F7F8FA"'));
assert.ok(manifest.includes('"background_color": "#F7F8FA"'));
assert.ok(manifest.includes('"theme_color": "#F7F8FA"'));
assert.ok(aliasManifest.includes('"background_color":"#F7F8FA"'));
assert.ok(aliasManifest.includes('"theme_color":"#F7F8FA"'));
assert.ok(settings.includes("effectiveDark?'#151519':'#F7F8FA'"));

for(const token of [
  '--bg:#F7F8FA','--surface:#FFF','--surface-muted:#F2F3F6',
  '--accent:#FF6B55','--accent-strong:#F2553D','--accent-soft:#FFF0EC',
  '--protein:#3977F6','--weight:#8A5CF6','--success:#28B875',
  '.dc-sidebar{position:fixed','.dc-topbar{display:none}',
  '.dc-metric-card--primary{background:var(--surface-coral,#FFF1EC)',
  'background:#EDF3FF','background:#F2EDFF','background:#EAF9F1',
  '.dc-bottom-nav{background:rgba(255,255,255,.96)',
  '.dc-v1-account{width:100%',
  '.dc-metric-card--primary .dc-metric-empty strong{font-size:60px}'
]) assert.ok(css.includes(token),`missing V1 visual token: ${token}`);

assert.ok(css.lastIndexOf('--accent:#FF6B55')>css.lastIndexOf('--accent:#2d6a49'),'V1 coral tokens must override historical V2 green tokens.');
assert.ok(css.lastIndexOf('--bg:#F7F8FA')>css.lastIndexOf('--bg:#f5f7f5'),'V1 neutral canvas must be final.');

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
assert.ok(rawCoreBytes<=750000,`V1 UI restoration exceeded core budget: ${rawCoreBytes}/750000`);
assert.equal(app.health.rawCoreAssetObservedBytes,rawCoreBytes);

console.log(JSON.stringify({ok:true,visualSystem:'V1-restored-on-V2-runtime',rawCoreBytes}));
