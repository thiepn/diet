import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DietProgressP33,progressRangeStart,filterProgressSeries,buildProgressAnalytics
} from '../v2/p33-progress-analytics.mjs';

assert.equal(DietProgressP33.version,'1.0.0-p33');
assert.equal(progressRangeStart('2026-10-06',28),'2026-09-09');

const trendDates=[
  '2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26',
  '2026-09-27','2026-09-28','2026-09-29','2026-09-30','2026-10-01',
  '2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06'
];
const trend=trendDates.map((date,i)=>({
  date,
  value:80.8-(0.8/(trendDates.length-1))*i
}));

const intakeDates=[
  '2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27',
  '2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02',
  '2026-10-03','2026-10-04','2026-10-05','2026-10-06'
];
const intake=intakeDates.map((date,i)=>({
  date,
  calories:i%5===0?2450:2150,
  target:2200,
  protein:145
}));

const analytics=buildProgressAnalytics({
  asOfDate:'2026-10-06',
  days:28,
  progress:{
    trendWeights:trend,
    rawWeights:[
      {date:'2026-09-23',value:80.7},{date:'2026-09-27',value:80.5},
      {date:'2026-10-01',value:80.25},{date:'2026-10-06',value:80.0}
    ],
    expenditure:[
      {date:'2026-09-22',value:2470,confidence:.55},
      {date:'2026-10-06',value:2520,confidence:.72}
    ],
    intake,
    goalProjection:{projectedDate:'2027-01-05',weeks:13}
  },
  strategy:{goalMode:'lose',goalWeight:75,targetRateKgPerWeek:-0.4}
});

assert.equal(analytics.range.days,28);
assert.equal(analytics.range.weighIns,4);
assert.ok(analytics.range.intakeDays>=10);
assert.equal(analytics.weight.current,80);
assert.ok(analytics.weight.change<0);
assert.ok(Math.abs(analytics.weight.weeklyRate+0.4)<0.06);
assert.equal(analytics.weight.pace.state,'on_track');
assert.equal(analytics.goal.goalWeight,75);
assert.equal(analytics.goal.projectedDate,'2027-01-05');
assert.ok(analytics.goal.movementTowardGoalKg>0);
assert.equal(analytics.expenditure.current,2520);
assert.equal(analytics.expenditure.change,50);
assert.ok(analytics.nutrition.adherenceRate>0.5);
assert.ok(Array.isArray(analytics.weeks));
assert.ok(analytics.chart.intakeBars.every(row=>row.kind==='day'));

const longRange=buildProgressAnalytics({
  asOfDate:'2026-10-06',days:90,
  progress:{trendWeights:trend,rawWeights:[],expenditure:[],intake,goalProjection:null},
  strategy:{goalMode:'maintain',goalWeight:80,targetRateKgPerWeek:0}
});
assert.ok(longRange.chart.intakeBars.every(row=>row.kind==='week'),'long ranges should aggregate intake into weekly bars');

assert.deepEqual(
  filterProgressSeries([{date:'2026-08-01',value:1},{date:'2026-10-06',value:2}],'2026-10-06',28),
  [{date:'2026-10-06',value:2}]
);

const html=fs.readFileSync('index.html','utf8');
const data=fs.readFileSync('v2/data.js','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');

for(const id of [
  'progressRangeSummary','progressTrendChange','progressObservedPace','progressAdherence',
  'progressExpenditureNow','progressEvidenceCoverage','progressDigest','progressWeeklySignals'
]) assert.ok(html.includes(`id="${id}"`),`missing ${id}`);

assert.ok(data.includes("buildProgressAnalytics"));
assert.ok(data.includes("renderProgressSummary"));
assert.ok(data.includes("dateExtent"));
assert.ok(data.includes("intakeBars"));
assert.ok(css.includes(".dc-progress-summary"));
assert.ok(css.includes(".dc-progress-week"));
assert.ok(sw.includes('./v2/p33-progress-analytics.mjs'));
assert.ok(aliasSw.includes('./p33-progress-analytics.mjs'));

console.log('P33 progress, trends and visual analytics contract passed.');
