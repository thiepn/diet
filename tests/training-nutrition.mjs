import assert from 'node:assert/strict';
import { buildWeeklyTrainingDistribution,buildActivityContext,buildTrainingNutritionPlan } from '../src/engine/training-nutrition.mjs';

{
  const plan=buildWeeklyTrainingDistribution({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{
      enabled:true,hardExtraKcal:150,moderateExtraKcal:75,lightExtraKcal:25,
      weeklyTemplate:{mon:'hard',tue:'rest',wed:'hard',thu:'rest',fri:'hard',sat:'rest',sun:'rest'}
    }
  });
  assert.equal(plan.week.length,7);
  assert.equal(plan.weeklyBaseCalories,14000);
  assert.equal(plan.weeklyDistributedCalories,14000);
  assert.equal(plan.zeroSum,true);
  assert.equal(plan.week.filter(x=>x.dayType==='hard').every(x=>x.targetCalories>2000),true);
  assert.equal(plan.week.filter(x=>x.dayType==='rest').every(x=>x.targetCalories<2000),true);
  assert.equal(plan.week.every(x=>x.macros.protein===150),true);
  assert.equal(plan.week.every(x=>x.macros.fat===65),true);
}

{
  const plan=buildWeeklyTrainingDistribution({
    asOfDate:'2026-09-29',baseCalories:2033,protein:140,fat:60,
    settings:{
      enabled:true,hardExtraKcal:150,moderateExtraKcal:75,lightExtraKcal:25,
      weeklyTemplate:{mon:'hard',tue:'rest',wed:'moderate',thu:'rest',fri:'light',sat:'rest',sun:'rest'}
    }
  });
  assert.equal(plan.weeklyBaseCalories,14231);
  assert.equal(plan.weeklyDistributedCalories,14231);
  assert.equal(plan.zeroSum,true);
}

{
  const plan=buildWeeklyTrainingDistribution({
    asOfDate:'2026-09-29',baseCalories:2200,protein:160,fat:70,
    settings:{enabled:false,weeklyTemplate:{mon:'hard',tue:'rest',wed:'hard',thu:'rest',fri:'hard',sat:'rest',sun:'rest'}}
  });
  assert.equal(plan.weeklyDistributedCalories,15400);
  assert.equal(plan.week.every(x=>x.targetCalories===2200),true);
  assert.equal(plan.week.every(x=>x.deltaKcal===0),true);
}

{
  const plan=buildWeeklyTrainingDistribution({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{enabled:true,weeklyTemplate:{mon:'rest',tue:'rest',wed:'rest',thu:'rest',fri:'rest',sat:'rest',sun:'rest'}},
    trainingDays:[{training_date:'2026-09-29',day_type:'hard',status:'completed'}]
  });
  const today=plan.week.find(x=>x.date==='2026-09-29');
  assert.equal(today.dayType,'hard');
  assert.equal(today.source,'override');
  assert.ok(today.targetCalories>2000);
}

{
  const plan=buildWeeklyTrainingDistribution({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{enabled:true,weeklyTemplate:{mon:'rest',tue:'hard',wed:'rest',thu:'rest',fri:'rest',sat:'rest',sun:'rest'}},
    trainingDays:[{training_date:'2026-09-29',day_type:'hard',status:'skipped'}]
  });
  const today=plan.week.find(x=>x.date==='2026-09-29');
  assert.equal(today.dayType,'rest');
}

{
  const activity=[
    ...Array.from({length:14},(_,i)=>({
      activity_date:'2026-09-'+String(15+i).padStart(2,'0'),
      steps:8000,active_calories:450,exercise_minutes:40,source:'health_connect',synced_at:'2026-09-29T08:00:00Z'
    })),
    {activity_date:'2026-09-29',steps:16000,active_calories:900,exercise_minutes:80,source:'health_connect',synced_at:'2026-09-29T10:00:00Z'}
  ];
  const context=buildActivityContext({asOfDate:'2026-09-29',activity});
  assert.equal(context.baseline.steps,8000);
  assert.equal(context.relativeLoad,2);
  assert.equal(context.level,'very_high');
  assert.equal(context.affectsCalorieTarget,false);
}

{
  const lowActivity=[{activity_date:'2026-09-29',steps:20000,active_calories:1000,exercise_minutes:90}];
  const a=buildTrainingNutritionPlan({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{enabled:false},activity:lowActivity
  });
  const b=buildTrainingNutritionPlan({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{enabled:false},activity:[]
  });
  assert.equal(a.today.targetCalories,b.today.targetCalories,'Activity must not create calorie eat-back.');
  assert.equal(a.policy.activityCaloriePolicy,'context_only_no_eat_back');
}

console.log('Diet Copilot 2.0 P6 training nutrition engine tests passed.');
