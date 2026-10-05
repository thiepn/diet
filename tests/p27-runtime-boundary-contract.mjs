import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const legacy=fs.readFileSync('legacy-v1.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const plan=JSON.parse(fs.readFileSync('runtime-p27-boundary.json','utf8'));
const legacyReadme=fs.readFileSync('src/README.md','utf8');

assert.equal(plan.phase,'P27');
assert.equal(plan.state,'runtime_boundary_enforced');
assert.equal(plan.activeProduction.sourceTree,'v2/');
assert.equal(plan.rollback.sourceTree,'src/');
assert.equal(plan.rollback.featureDevelopmentAllowed,false);

for(const required of [
  './v2/shell.js',
  './v2/data.js',
  './v2/food.js',
  './v2/copilot.js',
  './v2/settings.js'
]) assert.ok(index.includes(required),`active runtime missing ${required}`);

assert.doesNotMatch(index,/src\//);
assert.doesNotMatch(index,/legacy-v1-app\.js/);
assert.ok(legacy.includes('legacy-v1-app.js'),'rollback entrypoint must keep rollback bundle');
assert.ok(sw.includes('./legacy-v1.html'),'service worker must preserve rollback entrypoint');
assert.ok(sw.includes('./legacy-v1-app.js'),'service worker must preserve rollback bundle');

assert.ok(legacyReadme.includes('not** the active Diet Copilot production runtime'));
assert.ok(legacyReadme.includes('Product development belongs in `v2/`'));

console.log('P27 active-runtime / rollback boundary contract passed.');
