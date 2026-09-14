import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const file of ['diet-app.js','diet.css','.v67-build/diet-app.js','.v67-build/diet.css','index.html','sw.js','.well-known/thiepn-app.json'])assert.ok(fs.existsSync(file),`Missing ${file}`);

const jsTemplate=fs.readFileSync('diet-app.js','utf8');
const cssTemplate=fs.readFileSync('diet.css','utf8');
const js=fs.readFileSync('.v67-build/diet-app.js','utf8');
const css=fs.readFileSync('.v67-build/diet.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const manifest=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));

assert.match(html,/diet\.css\?v=1\.0-rc1/);
assert.match(html,/diet-app\.js\?v=1\.0-rc1/);
assert.equal((html.match(/<script src="dashboard-/g)||[]).length,0,'Historical dashboard scripts are still loaded by production HTML');
assert.equal((html.match(/<link rel="stylesheet" href="dashboard-/g)||[]).length,0,'Historical dashboard styles are still loaded by production HTML');
assert.equal((html.match(/diet-app\.js/g)||[]).length,1,'Production must load one local JS bundle');
assert.equal((html.match(/diet\.css/g)||[]).length,1,'Production must load one CSS bundle');

assert.ok(jsTemplate.startsWith('---\n---\n'),'Production JS must be a Jekyll-expanded template');
assert.ok(cssTemplate.startsWith('---\n---\n'),'Production CSS must be a Jekyll-expanded template');
for(const required of ['renderInsightsV66','renderHistoryV66','renderTodayV67','V67_WEB_RELEASE','Logged nutrition always counts','window.DietOperations','window.DietRelease'])assert.ok(js.includes(required),`Expanded production JS missing ${required}`);
for(const banned of ['function v6CaptureMarkup','data-v6-capture="','data-v6-recipe-log="'])assert.ok(!js.includes(banned),`Obsolete dashboard logging UI leaked into production: ${banned}`);

assert.ok(css.includes('prefers-reduced-motion:reduce'),'Reduced-motion certification styles missing');
assert.ok(css.includes('.v53-detail-sheet'),'Detail-sheet hardening missing');
assert.ok(css.includes('overflow-x:hidden'),'Horizontal overflow guard missing');

assert.ok(sw.includes("const CACHE='diet-copilot-web-v1-rc1'"),'Wrong service-worker generation');
assert.ok(sw.includes("'./diet-app.js?v=1.0-rc1'"),'Service worker missing JS bundle');
assert.ok(sw.includes("'./diet.css?v=1.0-rc1'"),'Service worker missing CSS bundle');
assert.ok(!sw.includes('dashboard-v6-5.js'),'Service worker still precaches historical fragments');

assert.equal(manifest.release,'V6.7');
assert.equal(manifest.webRelease,'1.0-rc1');
assert.equal(manifest.productionBundle,'diet-app.js');
assert.equal(manifest.productionStyles,'diet.css');
assert.equal(manifest.runtimeMode,'consolidated-release-candidate');
assert.equal(manifest.health?.writesPerformedByDashboard,false);

const sizeKB=Buffer.byteLength(js)/1024;
assert.ok(sizeKB<450,`Expanded production JS exceeds 450 KB budget: ${sizeKB.toFixed(1)} KB`);
const cssKB=Buffer.byteLength(css)/1024;
assert.ok(cssKB<180,`Expanded production CSS exceeds 180 KB budget: ${cssKB.toFixed(1)} KB`);

console.log(`V6.7 production bundle certified: ${sizeKB.toFixed(1)} KB JS, ${cssKB.toFixed(1)} KB CSS.`);
