import fs from 'node:fs';

const jsSources=[
  'dashboard-01.js',
  'dashboard-02.js',
  'dashboard-p2.js',
  'dashboard-p2-session.js',
  'dashboard-p3.js',
  'dashboard-03.js',
  'dashboard-auth-persist.js',
  'dashboard-auth.js',
  'dashboard-p4.js',
  'dashboard-p5.js',
  'dashboard-p6.js',
  'dashboard-v5.js',
  'dashboard-v5-2.js',
  'dashboard-v5-3.js',
  'dashboard-auth-final.js',
  'dashboard-04.js',
  'dashboard-v6-2.js',
  'dashboard-v6-3.js',
  'dashboard-v6-4.js',
  'dashboard-v6-5.js',
  'dashboard-v6-6.js',
  'dashboard-v6-7.js',
  'dashboard-ops.js'
];

const cssSources=[
  'dashboard-01.css',
  'dashboard-02.css',
  'dashboard-03.css',
  'dashboard-p2.css',
  'dashboard-p3.css',
  'dashboard-p4.css',
  'dashboard-p5.css',
  'dashboard-p6.css',
  'dashboard-v5.css',
  'dashboard-v5-2.css',
  'dashboard-v5-3.css',
  'dashboard-v6-2.css',
  'dashboard-v6-6.css',
  'dashboard-v6-7.css'
];

const obsoleteRuntime=['dashboard-v5-1.js','dashboard-v6.js','dashboard-v6-1.js','dashboard-v6-1-2.js'];
const obsoleteStyles=['dashboard-v5-1.css','dashboard-v6.css','dashboard-v6-1-1.css','dashboard-v6-3.css','dashboard-v6-5.css'];

for(const file of [...jsSources,...cssSources])if(!fs.existsSync(file))throw new Error(`Missing V6.7 source: ${file}`);
for(const file of obsoleteRuntime)if(jsSources.includes(file))throw new Error(`Obsolete runtime fragment returned to production: ${file}`);
for(const file of obsoleteStyles)if(cssSources.includes(file))throw new Error(`Obsolete style fragment returned to production: ${file}`);

function expectedTemplate(files){
  return `---\n---\n${files.map(file=>`{% include_relative ${file} %}`).join('\n')}\n`;
}

const jsTemplate=fs.readFileSync('diet-app.js','utf8');
const cssTemplate=fs.readFileSync('diet.css','utf8');
if(jsTemplate!==expectedTemplate(jsSources))throw new Error('diet-app.js Jekyll include order does not match the certified source list.');
if(cssTemplate!==expectedTemplate(cssSources))throw new Error('diet.css Jekyll include order does not match the certified source list.');

fs.mkdirSync('.v67-build',{recursive:true});
let js=`/* Diet Copilot Web V1.0 RC1 — local CI expansion of the Jekyll production bundle. */\n`;
for(const file of jsSources)js+=`\n/* ===== ${file} ===== */\n${fs.readFileSync(file,'utf8').trim()}\n`;
let css=`/* Diet Copilot Web V1.0 RC1 — local CI expansion of the Jekyll production stylesheet. */\n`;
for(const file of cssSources)css+=`\n/* ===== ${file} ===== */\n${fs.readFileSync(file,'utf8').trim()}\n`;

if(js.includes('function v6CaptureMarkup'))throw new Error('Quick Capture implementation leaked into production bundle.');
if(js.includes('data-v6-capture="'))throw new Error('Quick Capture controls leaked into production bundle.');
if(js.includes('data-v6-recipe-log="'))throw new Error('Legacy recipe logging controls leaked into production bundle.');
if(!js.includes('renderInsightsV66'))throw new Error('Consolidated Insights renderer missing.');
if(!js.includes('renderTodayV67'))throw new Error('V6.7 Today invariant missing.');
if(!js.includes('Logged nutrition always counts'))throw new Error('All-logged-data policy missing from bundle.');

fs.writeFileSync('.v67-build/diet-app.js',js);
fs.writeFileSync('.v67-build/diet.css',css);

console.log('Expanded and certified Diet Copilot Web V1.0 RC1 production templates.');
console.log(`JS fragments: ${jsSources.length}; CSS fragments: ${cssSources.length}`);
console.log(`Expanded JS: ${Buffer.byteLength(js)} bytes; CSS: ${Buffer.byteLength(css)} bytes`);
