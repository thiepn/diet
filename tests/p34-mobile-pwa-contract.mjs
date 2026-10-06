import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const alias=read('v2/index.html');
const css=read('v2/shell.css');
const shell=read('v2/shell.js');
const pwa=read('v2/pwa.js');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const aliasManifest=JSON.parse(read('v2/manifest.webmanifest'));

for(const markup of [html,alias]){
  assert.match(markup,/viewport-fit=cover,interactive-widget=resizes-content/);
  assert.match(markup,/apple-mobile-web-app-capable/);
  assert.match(markup,/apple-mobile-web-app-title/);
}

assert.match(css,/touch-action:manipulation/);
assert.match(css,/safe-area-inset-top/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(css,/min-height:44px/);
assert.match(css,/font-size:16px!important/);
assert.match(css,/data-input-active="true"/);
assert.match(css,/scroll-snap-type:x proximity/);
assert.match(css,/max-width:380px/);
assert.match(css,/display-mode:standalone/);

assert.match(shell,/--dc-visual-height/);
assert.match(shell,/globalThis\.visualViewport/);
assert.match(shell,/dataset\.inputActive='true'/);
assert.match(shell,/focusin/);
assert.match(shell,/focusout/);
assert.match(shell,/version:'2\.0\.0-p34-shell'/);

for(const token of [
  'beforeinstallprompt','appinstalled','controllerchange','morePwaButton',
  'pwaDialog','pwaInstallButton','pwaReloadButton','display-mode: standalone',
  "version:'2.0.3-p34'"
]) assert.ok(pwa.includes(token),`missing PWA behavior: ${token}`);

assert.match(sw,/diet-copilot-prod-v2-p(?:34|35|36)-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p(?:34|35|36)-1/);
assert.doesNotMatch(sw,/pathname\.startsWith\(scopePath\+'v2\/'\)\)return/,'root service worker must not bypass production v2 assets');
assert.ok(sw.includes("'./v2/shell.css'"));
assert.ok(sw.includes("'./v2/pwa.js'"));

for(const value of [manifest,aliasManifest]){
  assert.equal(value.display,'standalone');
  assert.equal(value.launch_handler?.client_mode,'navigate-existing');
  assert.equal(value.prefer_related_applications,false);
  assert.ok(value.categories.includes('health'));
  assert.ok(value.shortcuts.some(x=>x.short_name==='Strategy'));
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
assert.ok(rawCoreBytes<=750000,`P34 core budget exceeded: ${rawCoreBytes}/750000 bytes`);

console.log(JSON.stringify({ok:true,phase:'P34',rawCoreBytes,offlineV2Assets:true,touchTargetPx:44}));
