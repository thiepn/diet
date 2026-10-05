import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  reviewCadence,evidenceReadiness,recommendationState,buildWeeklyReview
} from '../v2/p31-weekly-review.mjs';

assert.deepEqual(
  reviewCadence('2026-10-05',[]),
  {state:'first_review',due:true,lastReviewOn:null,daysSince:null,nextReviewOn:null,label:'First review'}
);
const recent=reviewCadence('2026-10-05',[{status:'dismissed',generatedOn:'2026-10-02',resolvedAt:'2026-10-02T18:00:00Z'}]);
assert.equal(recent.due,false);
assert.equal(recent.label,'Next review in 4d');
const due=reviewCadence('2026-10-05',[{status:'accepted',generatedOn:'2026-09-27',resolvedAt:'2026-09-27T18:00:00Z'}]);
assert.equal(due.due,true);
assert.equal(due.label,'Review overdue by 1d');

const building=evidenceReadiness({
  reliableIntakeDays:2.5,weighIns:2,weightSpanDays:8,confidenceScore:.3,
  confidenceLevel:'building_baseline',estimatedExpenditure:null
});
assert.equal(building.changeReady,false);
assert.equal(building.missing.length,3);
assert.ok(building.missing.some(x=>x.includes('weight history')));
assert.ok(building.missing.some(x=>x.includes('weigh-in')));
assert.ok(building.missing.some(x=>x.includes('intake')));

const medium=evidenceReadiness({
  reliableIntakeDays:9,weighIns:6,weightSpanDays:20,confidenceScore:.68,
  confidenceLevel:'medium',estimatedExpenditure:2450
});
assert.equal(medium.changeReady,true);
assert.deepEqual(medium.missing,[]);
assert.ok(medium.items.every(x=>x.state==='ready'));

const increase=recommendationState({
  decision:'increase',currentTarget:2200,recommendedTarget:2300,reason:'Evidence supports a bounded increase.'
});
assert.equal(increase.actionable,true);
assert.equal(increase.headline,'Increase to 2300 kcal');
assert.equal(increase.delta,100);

const hold=recommendationState({
  decision:'hold_for_confidence',currentTarget:2200,recommendedTarget:2200,reason:'Need confidence.'
});
assert.equal(hold.actionable,false);
assert.equal(hold.keep,true);
assert.match(hold.headline,/confidence/);

const weekly=buildWeeklyReview({
  reliableIntakeDays:9,weighIns:6,weightSpanDays:20,confidenceScore:.68,
  confidenceLevel:'medium',estimatedExpenditure:2450,uncertaintyKcal:140,
  decision:'decrease',currentTarget:2300,recommendedTarget:2200,reason:'Move gradually.'
},'2026-10-05',[]);
assert.equal(weekly.status,'review_due');
assert.equal(weekly.confidence.score,68);
assert.equal(weekly.recommendation.actionable,true);
assert.equal(weekly.missingEvidence.length,0);

const html=fs.readFileSync('index.html','utf8');
const actions=fs.readFileSync('v2/strategy-actions.js','utf8');
const readModel=fs.readFileSync('v2/read-model.mjs','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');

for(const id of [
  'strategyReviewCadence','strategyConfidencePercent','strategyConfidenceBar',
  'strategyConfidenceMessage','strategyWhyHeadline','strategyWhyText',
  'strategyMissingEvidence','strategyReadiness','strategyKeepCurrent','strategyAccept'
]) assert.ok(html.includes(`id="${id}"`),`missing ${id}`);

assert.ok(readModel.includes('buildWeeklyReview'));
assert.ok(readModel.includes('confidenceComponents'));
assert.ok(readModel.includes('weeklyReview'));
assert.ok(actions.includes('ensureCurrentReview'));
assert.ok(actions.includes('stageCurrentSnapshot'));
assert.ok(actions.includes("resolveDecision('keep_current')"));
assert.ok(actions.includes("resolveDecision('accept')"));
assert.ok(actions.includes("weeklyReview:s.weeklyReview"));
assert.ok(actions.includes("'Apply '+fmt(s.recommendedTarget)+' kcal'"));
assert.ok(sw.includes('./v2/p31-weekly-review.mjs'));
assert.ok(aliasSw.includes('./p31-weekly-review.mjs'));

console.log('P31 adaptive strategy and weekly review contract passed.');
