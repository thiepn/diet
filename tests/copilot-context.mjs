import assert from 'node:assert/strict';
import {
  buildCopilotContext,buildLocalCopilotReply,sanitizeCopilotResponse,validateCopilotProposal,DietCopilotP8
} from '../src/engine/copilot-context.mjs';

const model={
  asOfDate:'2026-09-29',
  today:{
    calories:1700,calorieTarget:2400,baseCalorieTarget:2300,caloriesRemaining:700,
    protein:120,proteinTarget:160,proteinRemaining:40,
    latestWeight:82.4,trendWeight:82.1,expenditure:2800,confidenceLevel:'high',
    goalLabel:'Lose weight',trainingDayType:'hard',trainingTargetDelta:100,
    activityContext:{level:'high'}
  },
  strategy:{
    goalMode:'lose',goalLabel:'Lose weight',goalWeight:78,targetRateKgPerWeek:-0.35,
    currentTarget:2300,estimatedExpenditure:2800,confidenceLevel:'high',
    decision:'keep_target',recommendedTarget:2300,targetDelta:0,
    reason:'Observed rate is aligned with the selected pace.'
  },
  progress:{
    intelligence:{
      version:'1.0.0-p7',
      quality:{reliableIntakeDays:20.5},
      metrics:{
        proteinTargetAdherence:.82,calorieTargetAdherence:.76,
        weekendDeltaCalories:220,trainingCarbDelta:55,activityShift:.18,
        weeklyTrendRate:-.31,stepsIntakeCorrelation:.28
      },
      insights:[
        {id:'weekend_intake',title:'Weekend intake difference',value:220,unit:'kcal/day',confidence:'high',evidenceDays:20,summary:'Reliable weekend days averaged +220 kcal versus weekdays.'}
      ]
    }
  },
  food:{
    savedFoods:[
      {id:'food-1',name:'Skyr',calories:180,protein:30,carbs:12,fat:1,favorite:true,useCount:12},
      {id:'food-2',name:'Pizza slice',calories:320,protein:14,carbs:38,fat:12,useCount:2}
    ],
    savedMeals:[
      {id:'meal-1',name:'Usual breakfast',mealType:'Breakfast',calories:620,protein:48,carbs:75,fat:14,favorite:true,useCount:20}
    ],
    recentMeals:[
      {id:'recent-1',title:'Chicken rice bowl',type:'Lunch',date:'2026-09-28',calories:740,protein:55}
    ]
  },
  user:{id:'must-not-leak',email:'must-not-leak@example.com'},
  raw:{secret:'must-not-leak'}
};

const context=buildCopilotContext(model);
assert.equal(context.version,'1.0.0-p8');
assert.equal(context.today.caloriesRemaining,700);
assert.equal(context.intelligence.proteinTargetAdherence,82);
assert.equal(context.candidates.savedMeals[0].id,'meal-1');
assert.equal(JSON.stringify(context).includes('must-not-leak'),false,'P8 context must not copy arbitrary model/user/raw fields.');

{
  const reply=buildLocalCopilotReply('How much can I still eat today?',context);
  assert.ok(reply);
  assert.match(reply.answer,/700 kcal remaining/i);
  assert.match(reply.answer,/40 g protein/i);
  assert.equal(reply.action,null);
}

{
  const reply=buildLocalCopilotReply('Why did my calorie target change?',context);
  assert.ok(reply);
  assert.match(reply.answer,/aligned/i);
  assert.equal(reply.action.type,'navigate_strategy');
}

{
  const reply=buildLocalCopilotReply('What is different on weekends?',context);
  assert.ok(reply);
  assert.match(reply.answer,/220 kcal/i);
}

{
  const reply=buildLocalCopilotReply('Log my usual breakfast',context);
  const safe=sanitizeCopilotResponse(reply,context);
  assert.ok(safe?.action);
  assert.equal(safe.action.type,'log_saved_meal');
  assert.equal(safe.action.id,'meal-1');
  assert.equal(safe.action.multiplier,1);
}

{
  const reply=buildLocalCopilotReply('Can I eat a pizza slice?',context);
  assert.ok(reply);
  assert.equal(reply.action,null,'A comparison question must not become a logging proposal.');
  assert.match(reply.answer,/would fit|more than today/i);
}

{
  const reply=buildLocalCopilotReply('Log my usual breakfast but modified',context);
  assert.ok(reply);
  assert.equal(reply.action.type,'navigate_food','Modified saved meals must not log the unchanged canonical item.');
  assert.match(reply.answer,/will not log the unmodified version/i);
}

{
  const reply=buildLocalCopilotReply('I ate a completely unknown dragonfruit pastry',context);
  assert.ok(reply);
  assert.equal(reply.action.type,'navigate_food');
  assert.match(reply.answer,/cannot safely invent nutrition/i);
}

{
  const malicious={
    answer:'I changed everything.',
    action:{type:'log_saved_meal',id:'invented-id',multiplier:999,mealType:'Breakfast',label:'Do it'}
  };
  const safe=sanitizeCopilotResponse(malicious,context);
  assert.ok(safe);
  assert.equal(safe.action,null,'Unknown candidate IDs must never survive client validation.');
}

{
  const safe=validateCopilotProposal({
    type:'log_saved_food',id:'food-1',multiplier:99,mealType:'Dinner'
  },context);
  assert.equal(safe.id,'food-1');
  assert.equal(safe.multiplier,10,'Multiplier must be bounded.');
  assert.equal(safe.mealType,'Dinner');
}

{
  assert.equal(validateCopilotProposal({type:'delete_everything',id:'food-1'},context),null);
  assert.deepEqual([...DietCopilotP8.actions],[
    'log_saved_food','log_saved_meal','repeat_meal','navigate_food','navigate_strategy'
  ]);
}

console.log('Diet Copilot 2.0 P8 Copilot context and proposal tests passed.');
