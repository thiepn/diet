import fs from 'node:fs';

const release='1.0.3';
const writeProduction=process.argv.includes('--write');
const jsSources=[
  'src/core/dashboard-01.js',
  'src/core/dashboard-02.js',
  'src/ui/dashboard-p2.js',
  'src/ui/dashboard-p2-session.js',
  'src/ui/dashboard-p3.js',
  'src/core/dashboard-03.js',
  'src/ui/dashboard-p4.js',
  'src/ui/dashboard-p5.js',
  'src/ui/dashboard-p6.js',
  'src/ui/dashboard-v5.js',
  'src/intelligence/dashboard-v5-2.js',
  'src/ui/dashboard-v5-3.js',
  'src/core/dashboard-04.js',
  'src/intelligence/dashboard-v6-2.js',
  'src/intelligence/dashboard-v6-3.js',
  'src/intelligence/dashboard-v6-4.js',
  'src/intelligence/dashboard-v6-5.js',
  'src/intelligence/dashboard-v6-6.js',
  'src/release.js',
  'src/native/android-bridge.js',
  'src/operations/dashboard-ops.js',
  'src/auth/dashboard-auth-persist.js',
  'src/auth/dashboard-auth.js',
  'src/auth/dashboard-auth-final.js',
  'src/bootstrap.js'
];

const cssSources=[
  'src/styles/dashboard-01.css',
  'src/styles/dashboard-02.css',
  'src/styles/dashboard-03.css',
  'src/styles/dashboard-p2.css',
  'src/styles/dashboard-p3.css',
  'src/styles/dashboard-p4.css',
  'src/styles/dashboard-p5.css',
  'src/styles/dashboard-p6.css',
  'src/styles/dashboard-v5.css',
  'src/styles/dashboard-v5-2.css',
  'src/styles/dashboard-v5-3.css',
  'src/styles/dashboard-v6-2.css',
  'src/styles/dashboard-v6-6.css',
  'src/styles/release.css',
  'src/styles/native.css'
];

for(const file of [...jsSources,...cssSources]){
  if(!fs.existsSync(file))throw new Error(`Missing Web 1.0 source: ${file}`);
}

const strayRoot=fs.readdirSync('.').filter(file=>/^dashboard-.*\.(?:js|css)$/.test(file));
if(strayRoot.length)throw new Error(`Historical root dashboard fragments remain: ${strayRoot.join(', ')}`);

fs.rmSync('.v68-build',{recursive:true,force:true});
fs.mkdirSync('.v68-build',{recursive:true});
let js=`/* Diet Copilot Web ${release} — stable production bundle. */\n`;
for(const file of jsSources)js+=`\n/* ===== ${file} ===== */\n${fs.readFileSync(file,'utf8').trim()}\n`;
let css=`/* Diet Copilot Web ${release} — stable production stylesheet. */\n`;
for(const file of cssSources)css+=`\n/* ===== ${file} ===== */\n${fs.readFileSync(file,'utf8').trim()}\n`;

for(const banned of ['function v6CaptureMarkup','data-v6-capture="','data-v6-recipe-log="','1.0-rc1']){
  if(js.includes(banned))throw new Error(`Retired runtime leaked into stable bundle: ${banned}`);
}
for(const required of ['renderInsightsV66','renderHistoryV66','renderTodayV68','DIET_WEB_RELEASE = \'1.0.3\'','window.DietRelease','Logged nutrition always counts','window.DietOperations']){
  if(!js.includes(required))throw new Error(`Stable bundle missing ${required}`);
}
if(!css.includes('prefers-reduced-motion:reduce'))throw new Error('Reduced-motion styles missing.');
if(!css.includes('overflow-x:hidden'))throw new Error('Horizontal overflow guard missing.');

const config=fs.readFileSync('src/config.js','utf8');
if(!config.includes('hycegznamzjhwinegaai'))throw new Error('Canonical Supabase project missing from source config.');
if(config.includes('mrrqsqawwxwebsdmrnre'))throw new Error('Retired Supabase project leaked into active source config.');

fs.writeFileSync('.v68-build/diet-app.js',js);
fs.writeFileSync('.v68-build/diet.css',css);

if(writeProduction){
  fs.writeFileSync('diet-app.js',js);
  fs.writeFileSync('diet.css',css);
  console.log('Updated committed static production bundles.');
}else{
  const productionJs=fs.readFileSync('diet-app.js','utf8');
  const productionCss=fs.readFileSync('diet.css','utf8');
  if(productionJs!==js)throw new Error('Committed diet-app.js is stale. Run: node scripts/build-v68.mjs --write');
  if(productionCss!==css)throw new Error('Committed diet.css is stale. Run: node scripts/build-v68.mjs --write');
  if(productionJs.includes('{%')||productionCss.includes('{%'))throw new Error('Liquid directives must never ship in production runtime assets.');
  if(productionJs.startsWith('---')||productionCss.startsWith('---'))throw new Error('Jekyll front matter must never ship in production runtime assets.');
}

const jsKB=Buffer.byteLength(js)/1024,cssKB=Buffer.byteLength(css)/1024;
if(jsKB>=400)throw new Error(`Stable JS exceeds 400 KB budget: ${jsKB.toFixed(1)} KB`);
if(cssKB>=160)throw new Error(`Stable CSS exceeds 160 KB budget: ${cssKB.toFixed(1)} KB`);

console.log(`Built Diet Copilot Web ${release}.`);
console.log(`Sources: ${jsSources.length} JS / ${cssSources.length} CSS.`);
console.log(`Bundle budgets: ${jsKB.toFixed(1)} KB JS / ${cssKB.toFixed(1)} KB CSS.`);
