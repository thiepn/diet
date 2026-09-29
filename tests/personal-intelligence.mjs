import assert from 'node:assert/strict';
import { buildPersonalIntelligence } from '../src/engine/personal-intelligence.mjs';

function dateAdd(start,days){
  const d=new Date(start+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
function baseRows(){
  const daily=[],assessed=[],activity=[];
  for(let i=0;i<28;i++){
    const date=dateAdd('2026-09-02',i);
    const dow=new Date(date+'T12:00:00Z').getUTCDay();
    const weekend=dow===0||dow===6;
    const hard=[2,4,6].includes(dow);
    const calories=weekend?2300:2000;
    const protein=i%4===0?120:155;
    daily.push({
      date,calories,protein,carbs:hard?300:220,fat:65,fiber:30,
      calorie_target:2050,protein_target:150
    });
    assessed.push({date,reliability:1,coverage:'complete'});
    activity.push({
      activity_date:date,
      steps:i>=21?12000:8000,
      active_calories:i>=21?650:430,
      exercise_minutes:i>=21?60:40
    });
  }
  return {daily,assessed,activity};
}

{
  const {daily,assessed,activity}=baseRows();
  const out=buildPersonalIntelligence({
    asOfDate:'2026-09-29',
    daily,assessedIntake:assessed,activity,
    trainingSettings:{weekly_template:{mon:'rest',tue:'hard',wed:'rest',thu:'hard',fri:'rest',sat:'hard',sun:'rest'}},
    trainingDays:[],
    trendWeights:Array.from({length:28},(_,i)=>({date:dateAdd('2026-09-02',i),trendWeight:80-i*0.04}))
  });
  assert.equal(out.version,'1.0.0-p7');
  assert.equal(out.quality.observedReliableDays,28);
  assert.ok(out.metrics.proteinTargetAdherence>0.7&&out.metrics.proteinTargetAdherence<0.9);
  assert.equal(out.metrics.weekendDeltaCalories,300);
  assert.equal(out.metrics.trainingCarbDelta,80);
  assert.ok(out.metrics.activityShift>0.4);
  assert.ok(out.metrics.weeklyTrendRate<0);
  assert.ok(out.insights.some(x=>x.id==='protein_adherence'));
  assert.ok(out.insights.some(x=>x.id==='weekend_intake'));
  assert.ok(out.insights.some(x=>x.id==='training_carbs'));
  assert.ok(out.insights.some(x=>x.id==='activity_shift'));
  assert.equal(out.policy.aiRole,'explanation_only_not_calculation');
  assert.equal(out.policy.correlationMeaning,'association_not_causation');
}

{
  const daily=[],assessed=[],activity=[];
  for(let i=0;i<12;i++){
    const date=dateAdd('2026-09-18',i);
    const steps=5000+i*1000;
    daily.push({date,calories:1500+i*100,protein:150,carbs:200,fat:60,calorie_target:2100,protein_target:150});
    assessed.push({date,reliability:1,coverage:'complete'});
    activity.push({activity_date:date,steps});
  }
  const out=buildPersonalIntelligence({asOfDate:'2026-09-29',daily,assessedIntake:assessed,activity});
  assert.ok(out.metrics.stepsIntakeCorrelation>0.95);
  const correlation=out.insights.find(x=>x.id==='steps_intake_association');
  assert.ok(correlation);
  assert.match(correlation.summary,/descriptive, not causal/i);
}

{
  const out=buildPersonalIntelligence({
    asOfDate:'2026-09-29',
    daily:[
      {date:'2026-09-28',calories:2000,protein:150,carbs:220,calorie_target:2000,protein_target:150},
      {date:'2026-09-29',calories:2100,protein:150,carbs:230,calorie_target:2000,protein_target:150}
    ],
    assessedIntake:[
      {date:'2026-09-28',reliability:1,coverage:'complete'},
      {date:'2026-09-29',reliability:1,coverage:'complete'}
    ]
  });
  assert.equal(out.insights.length,0,'P7 must withhold patterns below evidence thresholds.');
  assert.equal(out.quality.observedReliableDays,2);
}

{
  const {daily,assessed}=baseRows();
  const trainingDays=[{training_date:'2026-09-29',day_type:'hard',status:'skipped'}];
  const out=buildPersonalIntelligence({
    asOfDate:'2026-09-29',daily,assessedIntake:assessed,trainingDays,
    trainingSettings:{weekly_template:{mon:'rest',tue:'hard',wed:'rest',thu:'hard',fri:'rest',sat:'hard',sun:'rest'}}
  });
  assert.ok(Number.isFinite(out.metrics.trainingCarbDelta));
}

console.log('Diet Copilot 2.0 P7 personal intelligence engine tests passed.');
