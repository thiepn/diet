import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const file of ['diet-app.js','diet.css','.v68-build/diet-app.js','.v68-build/diet.css','index.html','sw.js','.well-known/thiepn-app.json','src/release.js','src/native/android-bridge.js','src/styles/native.css'])assert.ok(fs.existsSync(file),`Missing ${file}`);

const jsTemplate=fs.readFileSync('diet-app.js','utf8');
const cssTemplate=fs.readFileSync('diet.css','utf8');
const js=fs.readFileSync('.v68-build/diet-app.js','utf8');
const css=fs.readFileSync('.v68-build/diet.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const manifest=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));

assert.match(html,/diet\.css\?v=1\.0\.0/);
assert.match(html,/diet-app\.js\?v=1\.0\.0/);
assert.match(html,/application-version" content="1\.0\.0/);
assert.equal((html.match(/<script src="dashboard-/g)||[]).length,0,'Historical dashboard scripts are still loaded by production HTML');
assert.equal((html.match(/<link rel="stylesheet" href="dashboard-/g)||[]).length,0,'Historical dashboard styles are still loaded by production HTML');
assert.equal((html.match(/diet-app\.js/g)||[]).length,1,'Production must load exactly one local JS bundle');
assert.equal((html.match(/diet\.css/g)||[]).length,1,'Production must load exactly one CSS bundle');

assert.ok(jsTemplate.startsWith('---\n---\n'),'Production JS must be a Jekyll-expanded template');
assert.ok(cssTemplate.startsWith('---\n---\n'),'Production CSS must be a Jekyll-expanded template');
assert.ok(jsTemplate.includes('src/release.js'),'Stable release source missing from JS template');
assert.ok(jsTemplate.includes('src/native/android-bridge.js'),'Native Android bridge missing from JS template');
assert.ok(cssTemplate.includes('src/styles/release.css'),'Stable release source missing from CSS template');
assert.ok(cssTemplate.includes('src/styles/native.css'),'Native Android styles missing from CSS template');
assert.ok(!jsTemplate.includes('archive/'),'Archive must never feed production JS');
assert.ok(!cssTemplate.includes('archive/'),'Archive must never feed production CSS');

for(const required of ['renderInsightsV66','renderHistoryV66','renderTodayV68','DIET_WEB_RELEASE = \'1.0.0\'','DIET_RELEASE_CHANNEL = \'stable\'','Logged nutrition always counts','window.DietOperations','window.DietRelease','window.DietNative'])assert.ok(js.includes(required),`Expanded production JS missing ${required}`);
for(const banned of ['function v6CaptureMarkup','data-v6-capture="','data-v6-recipe-log="','1.0-rc1'])assert.ok(!js.includes(banned),`Retired dashboard behavior leaked into production: ${banned}`);

assert.ok(css.includes('prefers-reduced-motion:reduce'),'Reduced-motion certification styles missing');
assert.ok(css.includes('.v53-detail-sheet'),'Detail-sheet hardening missing');
assert.ok(css.includes('overflow-x:hidden'),'Horizontal overflow guard missing');
assert.ok(css.includes('.diet-native-health'),'Native Health Connect styles missing');

assert.ok(sw.includes("const CACHE='diet-copilot-web-v1.0.0'"),'Wrong service-worker generation');
assert.ok(sw.includes("'./diet-app.js?v=1.0.0'"),'Service worker missing stable JS bundle');
assert.ok(sw.includes("'./diet.css?v=1.0.0'"),'Service worker missing stable CSS bundle');
assert.ok(!sw.includes('dashboard-v6-5.js'),'Service worker still precaches historical fragments');
assert.ok(!sw.includes('1.0-rc1'),'Release-candidate cache marker remains');

assert.equal(manifest.release,'V7.0');
assert.equal(manifest.webRelease,'1.0.0');
assert.equal(manifest.nativeRelease,'7.0.0');
assert.equal(manifest.releaseChannel,'stable');
assert.equal(manifest.stable,true);
assert.equal(manifest.productionBundle,'diet-app.js');
assert.equal(manifest.productionStyles,'diet.css');
assert.equal(manifest.runtimeMode,'web-stable-native-companion');
assert.equal(manifest.sourceLayout,'src');
assert.equal(manifest.health?.writesPerformedByDashboard,false);
assert.equal(manifest.health?.healthConnectWritesThroughNativeBridge,true);
assert.equal(manifest.android?.appId,'dev.thiepn.diet');
assert.equal(manifest.android?.healthConnect,true);
assert.equal(manifest.android?.backgroundHealthSync,true);
assert.equal(manifest.android?.nativeReminders,true);
assert.equal(manifest.android?.activityCalorieEatBack,false);

const strayRoot=fs.readdirSync('.').filter(file=>/^dashboard-.*\.(?:js|css)$/.test(file));
assert.deepEqual(strayRoot,[],'Historical dashboard fragments remain at repository root');
assert.ok(fs.existsSync('archive/legacy-dashboard'),'Legacy archive is missing');

const sizeKB=Buffer.byteLength(js)/1024;
assert.ok(sizeKB<420,`Expanded production JS exceeds 420 KB budget: ${sizeKB.toFixed(1)} KB`);
const cssKB=Buffer.byteLength(css)/1024;
assert.ok(cssKB<165,`Expanded production CSS exceeds 165 KB budget: ${cssKB.toFixed(1)} KB`);

console.log(`Diet Copilot Web 1.0.0 + Android V7 bridge certified: ${sizeKB.toFixed(1)} KB JS, ${cssKB.toFixed(1)} KB CSS.`);
