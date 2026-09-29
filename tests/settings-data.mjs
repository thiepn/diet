import assert from 'node:assert/strict';
import {
  normalizeUiPreferences,encodeCsv,buildDietJsonBackup,buildNutritionCsv,buildWeightCsv,DietSettingsDataP9
} from '../src/engine/settings-data.mjs';

assert.deepEqual(normalizeUiPreferences({theme:'dark',density:'compact',motion:'reduce'}),{
  theme:'dark',density:'compact',motion:'reduce'
});
assert.deepEqual(normalizeUiPreferences({theme:'neon',density:'tiny',motion:'spin'}),{
  theme:'system',density:'comfortable',motion:'system'
});

assert.equal(
  encodeCsv([{name:'A, B',note:'He said "yes"',plain:'ok'}],['name','note','plain']),
  'name,note,plain\r\n"A, B","He said ""yes""",ok'
);

const raw={
  profile:{calorie_target:2400,access_token:'secret-a'},
  dailyLogs:[{log_date:'2026-09-28',notes:'private note',refresh_token:'secret-b'}],
  nested:{authorization:'Bearer nope',safe:'keep me'},
  rows:[{api_key:'secret-c',value:7}]
};
const model={
  asOfDate:'2026-09-29',
  progress:{
    intake:[
      {date:'2026-09-28',calories:2310,target:2400,protein:168.4,status:'complete'},
      {date:'2026-09-29',calories:1200,target:2400,protein:80,status:'open'}
    ],
    rawWeights:[
      {date:'2026-09-28',value:82.4},
      {date:'2026-09-29',value:82.1}
    ],
    trendWeights:[
      {date:'2026-09-28',value:82.31},
      {date:'2026-09-29',value:82.25}
    ]
  }
};

const backup=buildDietJsonBackup(raw,model,{exportedAt:'2026-09-29T13:00:00.000Z'});
assert.equal(backup.format,'diet-copilot-backup');
assert.equal(backup.version,1);
assert.equal(backup.exportedAt,'2026-09-29T13:00:00.000Z');
assert.equal(backup.asOfDate,'2026-09-29');
assert.equal(backup.data.profile.calorie_target,2400);
assert.equal(backup.data.dailyLogs[0].notes,'private note');
assert.equal(backup.data.nested.safe,'keep me');
assert.equal('access_token' in backup.data.profile,false);
assert.equal('refresh_token' in backup.data.dailyLogs[0],false);
assert.equal('authorization' in backup.data.nested,false);
assert.equal('api_key' in backup.data.rows[0],false);
assert.equal(JSON.stringify(backup).includes('secret-a'),false);
assert.equal(JSON.stringify(backup).includes('secret-b'),false);
assert.equal(JSON.stringify(backup).includes('secret-c'),false);

assert.equal(
  buildNutritionCsv(model),
  'date,calories,calorie_target,protein_g,day_status\r\n2026-09-28,2310,2400,168.4,complete\r\n2026-09-29,1200,2400,80,open'
);
assert.equal(
  buildWeightCsv(model),
  'date,scale_weight_kg,trend_weight_kg\r\n2026-09-28,82.4,82.31\r\n2026-09-29,82.1,82.25'
);
assert.equal(buildNutritionCsv({progress:{intake:[]}}),null);
assert.equal(buildWeightCsv({progress:{rawWeights:[],trendWeights:[]}}),null);
assert.equal(buildDietJsonBackup(null,model),null);
assert.equal(DietSettingsDataP9.version,'1.0.0-p9');

console.log('Diet Copilot 2.0 P9 settings/export core tests passed.');
