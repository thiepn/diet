import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-v68.mjs'], { stdio: 'inherit' });
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www', { recursive: true });

const copy = (from, to = path.basename(from)) => fs.copyFileSync(from, path.join('www', to));
copy('.v68-build/diet-app.js');
copy('.v68-build/diet.css');
for (const file of ['icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']) copy(file);

const supabaseCandidates = [
  'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
  'node_modules/@supabase/supabase-js/dist/umd/supabase.min.js'
];
const supabase = supabaseCandidates.find(fs.existsSync);
if (!supabase) throw new Error('Could not locate the Supabase UMD bundle. Run npm install first.');
copy(supabase, 'supabase.js');

let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0', 'supabase.js')
  .replace(/diet\.css\?v=1\.0\.0/g, 'diet.css?v=7.0.0')
  .replace(/diet-app\.js\?v=1\.0\.0/g, 'diet-app.js?v=7.0.0')
  .replace('<meta name="application-version" content="1.0.0" />', '<meta name="application-version" content="7.0.0" />');
fs.writeFileSync('www/index.html', html);

console.log('Prepared local Diet Copilot web assets for the Android shell.');
