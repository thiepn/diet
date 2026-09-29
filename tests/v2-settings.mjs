import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DietWriteRPC } from '../v2/write-api.mjs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const settings=fs.readFileSync('v2/settings.js','utf8');
const data=fs.readFileSync('v2/data.js','utf8');
const sourceCore=fs.readFileSync('src/engine/settings-data.mjs','utf8');
const browserCore=fs.readFileSync('v2/engine/settings-data.mjs','utf8');
const training=fs.readFileSync('v2/training-actions.js','utf8');

assert.equal(browserCore,sourceCore,'P9 deployable settings/export helper drifted from canonical source.');

for(const id of [
  'moreIntegrationsButton','moreBodyButton','moreAppearanceButton','moreDataButton',
  'integrationsDialog','bodyWeightDialog','appearanceDialog','dataExportDialog',
  'integrationHealthStatus','bodyLatestWeight','bodyTrendWeight','bodyGoalWeight','bodyWeightEntries',
  'exportJsonButton','exportNutritionButton','exportWeightsButton',
  'clearCopilotSessionButton','clearOfflineCacheButton'
]) assert.match(html,new RegExp('id="'+id+'"'),'Missing P9 target '+id);

assert.doesNotMatch(html,/data-coming="Body measurements are connected later\."/,'Body/weight More card must not remain a placeholder.');
assert.doesNotMatch(html,/data-coming="Appearance settings are connected later\."/,'Appearance More card must not remain a placeholder.');
assert.doesNotMatch(html,/data-coming="Data controls are connected later\."/,'Data/export More card must not remain a placeholder.');
assert.match(html,/type="module" src="\.\/settings\.js"/,'P9 settings module must be loaded.');

for(const cls of [
  '.dc-p9-dialog','.dc-p9-stat-grid','.dc-p9-setting-group','.dc-choice-row',
  '.dc-p9-export-grid','.dc-export-card','.dc-p9-privacy-actions'
]) assert.ok(css.includes(cls),'Missing P9 style '+cls);

assert.match(css,/:root\[data-theme="light"\]/,'Forced light theme override missing.');
assert.match(css,/:root\[data-theme="dark"\]/,'Forced dark theme override missing.');
assert.match(css,/data-density="compact"/,'Compact density override missing.');
assert.match(css,/data-motion="reduce"/,'Reduced-motion override missing.');

assert.match(settings,/PREF_KEY='diet-copilot-v2-ui-preferences-v1'/,'P9 preferences need a versioned local key.');
assert.match(settings,/buildDietJsonBackup/,'P9 JSON backup helper must be used.');
assert.match(settings,/buildNutritionCsv/,'P9 nutrition CSV helper must be used.');
assert.match(settings,/buildWeightCsv/,'P9 weight CSV helper must be used.');
assert.match(settings,/clearDietV2OfflineCache/,'P9 cache control must use the V2 cache API.');
assert.match(settings,/window\.DietV2Copilot\?\.clearSession/,'P9 must reuse the P8 session clearing boundary.');
assert.doesNotMatch(settings,/\.rpc\s*\(/,'P9 settings must not add direct RPC calls.');
assert.doesNotMatch(settings,/service_role|sb_secret_|SUPABASE_DB_URL|access_token|refresh_token/,'P9 settings bundle must not contain privileged credentials or session-token handling.');

assert.match(data,/export function getDietV2RawData\(\)/,'P9 data export bridge missing.');
assert.match(data,/export function clearDietV2OfflineCache\(\)/,'P9 cache-clear bridge missing.');
assert.match(data,/export function getDietV2OfflineCacheInfo\(\)/,'P9 cache-info bridge missing.');
assert.match(data,/structuredClone\(state\.raw\)/,'P9 must hand exports a clone rather than mutable canonical state.');

assert.doesNotMatch(training,/\$\('moreIntegrationsButton'\)\?\.addEventListener/,'Old direct-to-Strategy integration shortcut must be removed.');

const expected=[
  'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
  'diet_app_repeat_meal','diet_app_delete_meal',
  'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
  'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
  'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal',
  'diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review',
  'diet_app_save_training_distribution','diet_app_upsert_training_day','diet_app_delete_training_day'
].sort();
assert.deepEqual(Object.values(DietWriteRPC).sort(),expected,'P9 must not change the certified 18-RPC browser mutation surface.');

console.log('Diet Copilot 2.0 P9 settings/data-control integration tests passed.');
