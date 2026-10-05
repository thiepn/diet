import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCopilotContext,buildLocalCopilotReply,sanitizeCopilotResponse,
  validateCopilotProposal,DietCopilotP32
} from '../v2/engine/copilot-context.mjs';
import { buildActionPreview,actionKind,confirmationLabel } from '../v2/p32-copilot-actions.mjs';

const baseModel={
  asOfDate:'2026-10-06',
  today:{
    calories:1200,calorieTarget:2200,baseCalorieTarget:2200,caloriesRemaining:1000,
    protein:90,proteinTarget:150,proteinRemaining:60,trendWeight:80.1,expenditure:2500,
    confidenceLevel:'medium',goalLabel:'Lose weight',trainingDayType:'moderate',trainingTargetDelta:0,
    activityContext:{level:'normal'}
  },
  strategy:{
    goalMode:'lose',goalLabel:'Lose weight',goalWeight:75,targetRateKgPerWeek:-0.4,
    currentTarget:2200,estimatedExpenditure:2500,confidenceLevel:'medium',confidenceScore:.68,
    decision:'decrease',recommendedTarget:2100,targetDelta:-100,
    reason:'Move gradually toward the target implied by current expenditure and goal rate.',
    engineVersion:'1.0.0-p1',
    weeklyReview:{
      status:'review_due',cadence:{due:true,label:'Weekly review due'},
      missingEvidence:[],recommendation:{actionable:true}
    }
  },
  progress:{intelligence:{version:'P7',quality:{reliableIntakeDays:10},metrics:{},insights:[]}},
  food:{
    savedFoods:[
      {id:'f1',name:'Greek Yogurt',calories:200,protein:25,mealType:'Breakfast',favorite:true,useCount:8}
    ],
    savedMeals:[
      {id:'m1',name:'Chicken Rice',calories:650,protein:48,mealType:'Lunch',favorite:true,useCount:6}
    ],
    recentMeals:[
      {id:'r1',title:'Yogurt breakfast',calories:500,protein:35,type:'Breakfast',date:'2026-10-05'}
    ],
    memory:{foodsById:{f1:{usualPortion:{eligible:true,multiplier:1.5}}}}
  }
};

const ctx=buildCopilotContext(baseModel);
assert.equal(ctx.version,'2.0.0-p32');
assert.equal(DietCopilotP32.version,'2.0.0-p32');
assert.equal(ctx.candidates.savedFoods[0].usualMultiplier,1.5);
assert.equal(ctx.strategy.actionable,true);
assert.equal(ctx.capabilities.strategyReviewDecision,true);
assert.equal(ctx.capabilities.allWritesRequireConfirmation,true);

{
  const reply=buildLocalCopilotReply('log 1.5x Greek Yogurt',ctx);
  const safe=sanitizeCopilotResponse(reply,ctx);
  assert.equal(safe.action.type,'log_saved_food');
  assert.equal(safe.action.multiplier,1.5);
  assert.equal(safe.action.requiresConfirmation,true);
  assert.equal(safe.action.guard.id,'f1');
  const preview=buildActionPreview(safe.action,ctx);
  assert.equal(preview.write,true);
  assert.equal(preview.title,'Log Greek Yogurt');
  assert.ok(preview.changes.some(x=>x.label==='Calories added'&&x.after==='300 kcal'));
  assert.equal(confirmationLabel(safe.action),'Confirm log');
}
{
  const reply=buildLocalCopilotReply('log Greek Yogurt',ctx);
  const safe=sanitizeCopilotResponse(reply,ctx);
  assert.equal(safe.action.multiplier,1.5,'learned usual portion should be the safe default when user gives no multiplier');
}
{
  const reply=buildLocalCopilotReply('repeat yogurt breakfast again',ctx);
  const safe=sanitizeCopilotResponse(reply,ctx);
  assert.equal(safe.action.type,'repeat_meal');
  assert.equal(safe.action.id,'r1');
}
{
  const reply=buildLocalCopilotReply('keep my calorie target',ctx);
  const safe=sanitizeCopilotResponse(reply,ctx);
  assert.equal(safe.action.type,'strategy_keep');
  assert.equal(safe.action.guard.currentTarget,2200);
  const preview=buildActionPreview(safe.action,ctx);
  assert.equal(preview.changes[0].before,'2200 kcal');
  assert.equal(preview.changes[0].after,'2200 kcal');
}
{
  const reply=buildLocalCopilotReply('apply the recommendation tomorrow',ctx);
  const safe=sanitizeCopilotResponse(reply,ctx);
  assert.equal(safe.action.type,'strategy_apply');
  assert.equal(safe.action.effectiveDate,'tomorrow');
  assert.equal(safe.action.guard.currentTarget,2200);
  assert.equal(safe.action.guard.recommendedTarget,2100);
  const preview=buildActionPreview(safe.action,ctx);
  assert.equal(preview.changes.find(x=>x.label==='Effective').after,'Tomorrow');
  assert.equal(preview.changes.find(x=>x.label==='Change').after,'-100 kcal');
}
{
  const reply=buildLocalCopilotReply('change my goal weight',ctx);
  const safe=sanitizeCopilotResponse(reply,ctx);
  assert.equal(safe.action.type,'edit_goal');
  assert.equal(safe.action.write,false);
  assert.equal(actionKind(safe.action),'navigation');
}
{
  const unsupported=validateCopilotProposal({type:'delete_account',label:'Delete everything'},ctx);
  assert.equal(unsupported,null);
}
{
  const proposed=validateCopilotProposal({type:'log_saved_food',id:'f1',multiplier:1.5,mealType:'Breakfast'},ctx);
  const changed=structuredClone(ctx);
  changed.candidates.savedFoods[0].calories=250;
  assert.equal(validateCopilotProposal(proposed,changed),null,'food action must fail closed after saved nutrition changes');
}
{
  const proposed=validateCopilotProposal({type:'strategy_apply',effectiveDate:'today'},ctx);
  const changed=structuredClone(ctx);
  changed.strategy.recommendedTarget=2050;
  assert.equal(validateCopilotProposal(proposed,changed),null,'strategy action must fail closed after recommendation changes');
}
{
  const blocked=structuredClone(ctx);
  blocked.strategy.actionable=false;
  blocked.strategy.decision='hold_for_confidence';
  blocked.strategy.recommendedTarget=2200;
  assert.equal(validateCopilotProposal({type:'strategy_apply'},blocked),null,'non-actionable strategy may never be applied');
  assert.ok(validateCopilotProposal({type:'strategy_keep'},blocked),'keep remains valid with a current target');
}
{
  const safe=sanitizeCopilotResponse({
    answer:'I can prepare an action.',
    action:{type:'drop_table',label:'Do it'}
  },ctx);
  assert.equal(safe.action,null,'model output outside the allowlist must be stripped');
}

const copilot=fs.readFileSync('v2/copilot.js','utf8');
const strategy=fs.readFileSync('v2/strategy-actions.js','utf8');
const edge=fs.readFileSync('supabase/functions/diet-copilot-ai/index.ts','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');

assert.ok(copilot.includes('buildActionPreview'));
assert.ok(copilot.includes('window.DietV2StrategyReview'));
assert.ok(copilot.includes('window.DietV2Onboarding'));
assert.ok(copilot.includes("action.type==='strategy_keep'||action.type==='strategy_apply'"));
assert.ok(strategy.includes('matchesExpectedStrategy'));
assert.ok(strategy.includes('expected:'));
assert.ok(strategy.includes('window.DietV2StrategyReview'));
assert.ok(edge.includes('"strategy_keep","strategy_apply","edit_goal"'));
assert.ok(edge.includes('Every write remains a proposal until the app shows an exact preview'));
assert.ok(edge.includes('strategy.actionable!==true'));
assert.ok(html.includes('P32 · Actionable Copilot'));
assert.ok(html.includes('Requires confirmation')===false,'dynamic confirmation badge belongs in JS');
assert.ok(sw.includes('./v2/p32-copilot-actions.mjs'));
assert.ok(aliasSw.includes('./p32-copilot-actions.mjs'));

const coreFiles=['index.html','v2/index.html','v2/shell.css','vendor/supabase-2.116.0.js'];
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return walk(full);
    return /\.(?:js|mjs)$/.test(entry.name)?[full]:[];
  });
}
coreFiles.push(...walk('v2'));
const rawCoreBytes=[...new Set(coreFiles)].reduce((sum,p)=>sum+fs.statSync(p).size,0);
assert.ok(rawCoreBytes<=750000,`P32 core budget exceeded: ${rawCoreBytes}/750000 bytes`);

console.log('P32 Copilot actionability contract passed.');
