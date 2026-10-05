import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const audit=fs.readFileSync('docs/P26-PRODUCT-REALITY-AUDIT.md','utf8');
const plan=JSON.parse(fs.readFileSync('product-p26-rebaseline.json','utf8'));
const readme=fs.readFileSync('README.md','utf8');

assert.equal(plan.phase,'P26');
assert.equal(plan.state,'product_track_active');
assert.equal(plan.productionRuntime.entrypoint,'index.html');
assert.equal(plan.productionRuntime.activeTree,'v2/');
assert.equal(plan.productionRuntime.legacyTreeLoadedByProduction,false);
assert.equal(plan.infrastructurePolicy.wholeSharedSupabaseEpochCertification,false);
assert.equal(plan.infrastructurePolicy.unrelatedAppMigrationRestartsDietRelease,false);
assert.equal(plan.roadmap[0][0],'P27');

for(const module of [
  './v2/shell.js',
  './v2/data.js',
  './v2/food.js',
  './v2/copilot.js',
  './v2/settings.js'
]) assert.ok(index.includes(module),`production entrypoint missing ${module}`);

assert.doesNotMatch(index,/\.\/src\//);
assert.ok(audit.includes('Core product loop'));
assert.ok(audit.includes('P27 — Production Runtime Consolidation & Legacy Retirement'));
assert.ok(audit.includes('does **not** own certification of every migration'));
assert.ok(readme.includes('## Product'));
assert.ok(readme.includes('## Development direction'));
assert.ok(readme.includes('v2/'));
for(const path of [
  '.github/workflows/p40-generation5-activation.yml',
  '.github/workflows/p41-generation5-epoch-watch.yml',
  '.github/workflows/p42-generation6-refreeze.yml',
  '.github/workflows/p43-generation6-final-activation.yml',
  'platform-p40-generation5-activation-plan.json',
  'platform-p41-generation5-epoch-watch.json',
  'platform-p42-generation6-refreeze-plan.json',
  'platform-p43-final-revalidation.json'
]) assert.equal(fs.existsSync(path),false,`sidetrack artifact still present: ${path}`);

console.log('P26 product-track contract passed.');
