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
assert.equal(app.health?.v1UiRepairContract,'V1-UI-REPAIR');
assert.equal(app.health?.neutralDarkMode,true);
assert.equal(app.health?.systemDarkModeNeutral,true);
assert.equal(app.health?.darkGreenShellTokens,false);
assert.equal(app.health?.v1LightPaletteRestored,true);
assert.equal(app.health?.explicitLightModeV1Palette,true);
assert.equal(app.health?.uiCacheGeneration,'ui-v1-1');

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
assert.ok(settings.includes("effectiveDark?'#0F0F11':'#F7F8FA'"));

for(const token of [
  '--bg:#F7F8FA','--surface:#FFF','--surface-muted:#F2F3F6',
  '--surface-coral:#FFF1EC','--surface-blue:#EDF3FF','--surface-violet:#F2EDFF','--surface-green:#EAF9F1','--surface-amber:#FFF6E5',
  '--accent:#FF6B55','--accent-strong:#F2553D','--accent-soft:#FFF0EC',
  '--protein:#3977F6','--weight:#8A5CF6','--success:#28B875',
  '.dc-sidebar{position:fixed','.dc-topbar{display:none}',
  '.dc-metric-card--primary{background:var(--surface-coral,#FFF1EC)',
  'background:var(--surface-blue)','background:var(--surface-violet)','background:var(--surface-green)',
  '.dc-bottom-nav{display:grid;background:rgba(255,255,255,.96)',
  '.dc-v1-account{width:100%',
  '.dc-metric-card--primary .dc-metric-empty strong{font-size:60px}'
]) assert.ok(css.includes(token),`missing V1 visual token: ${token}`);

assert.ok(css.lastIndexOf('--accent:#FF6B55')>css.lastIndexOf('--accent:#2d6a49'),'V1 coral tokens must override historical V2 green tokens.');
assert.ok(css.lastIndexOf('--bg:#F7F8FA')>css.lastIndexOf('--bg:#f5f7f5'),'V1 neutral canvas must be final.');
assert.ok(css.includes(':root[data-theme="light"]{--bg:#F7F8FA;--surface:#FFF;--surface-muted:#F2F3F6'),'Explicit light mode must use the V1 palette.');
assert.ok(css.includes('html[data-theme="light"] .dc-metric-card--primary{background:var(--surface-coral)}'),'Explicit light mode must preserve the coral calorie surface.');
assert.ok(css.includes('html[data-theme="light"] .dc-metric-grid>.dc-metric-card:nth-child(2){background:var(--surface-blue)}'),'Explicit light mode must preserve the blue protein surface.');
assert.ok(css.includes('html[data-theme="light"] .dc-metric-grid>.dc-metric-card:nth-child(3){background:var(--surface-violet)}'),'Explicit light mode must preserve the violet weight surface.');
assert.ok(css.includes('html[data-theme="light"] .dc-metric-grid>.dc-metric-card:nth-child(4){background:var(--surface-green)}'),'Explicit light mode must preserve the green success surface.');
assert.ok(css.includes(':root[data-theme="dark"]{--bg:#0F0F11;--surface:#171719;--surface-muted:#202024'),'Explicit dark mode must be neutral charcoal.');
assert.ok(css.includes('@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0F0F11'),'System dark mode must use the neutral palette.');
assert.ok(css.includes('@media(max-width:760px){.dc-shell{display:block}.dc-sidebar{display:none}'),'Sidebar/mobile breakpoint must align with the existing bottom-navigation breakpoint.');
for(const forbidden of ['#111512','#171d18','#1d241f','#1a201b','#2a342c','#39453b','#7bbb91','#a0d2af','#203b2b','#19251d','rgba(42,52,44,.75)']){
  assert.ok(!css.includes(forbidden),`obsolete green dark-mode token remains: ${forbidden}`);
}

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
