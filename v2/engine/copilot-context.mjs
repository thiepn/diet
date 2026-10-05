const VERSION='2.0.0-p32';
const ACTIONS=Object.freeze(['log_saved_food','log_saved_meal','repeat_meal','navigate_food','navigate_strategy','strategy_keep','strategy_apply','edit_goal']);
const MEAL_TYPES=Object.freeze(['Breakfast','Lunch','Dinner','Snack','Other']);
const BASIS=Object.freeze({
  'today.calories':{label:'Logged today',path:['today','calories'],unit:'kcal',digits:0},
  'today.calorieTarget':{label:'Today target',path:['today','calorieTarget'],unit:'kcal',digits:0},
  'today.caloriesRemaining':{label:'Remaining today',path:['today','caloriesRemaining'],unit:'kcal',digits:0,signed:true},
  'today.protein':{label:'Protein today',path:['today','protein'],unit:'g',digits:0},
  'today.proteinTarget':{label:'Protein target',path:['today','proteinTarget'],unit:'g',digits:0},
  'today.proteinRemaining':{label:'Protein remaining',path:['today','proteinRemaining'],unit:'g',digits:0},
  'today.trendWeight':{label:'Trend weight',path:['today','trendWeight'],unit:'kg',digits:2},
  'today.expenditure':{label:'Expenditure',path:['today','expenditure'],unit:'kcal/day',digits:0},
  'strategy.currentTarget':{label:'Current target',path:['strategy','currentTarget'],unit:'kcal',digits:0},
  'strategy.recommendedTarget':{label:'Recommended target',path:['strategy','recommendedTarget'],unit:'kcal',digits:0},
  'strategy.targetDelta':{label:'Target change',path:['strategy','targetDelta'],unit:'kcal',digits:0,signed:true},
  'strategy.confidenceLevel':{label:'Strategy confidence',path:['strategy','confidenceLevel'],text:true},
  'intelligence.proteinTargetAdherence':{label:'Protein adherence',path:['intelligence','proteinTargetAdherence'],unit:'%',digits:0},
  'intelligence.calorieTargetAdherence':{label:'Calorie adherence',path:['intelligence','calorieTargetAdherence'],unit:'%',digits:0},
  'intelligence.weekendDeltaCalories':{label:'Weekend delta',path:['intelligence','weekendDeltaCalories'],unit:'kcal/day',digits:0,signed:true},
  'intelligence.trainingCarbDelta':{label:'Training carb delta',path:['intelligence','trainingCarbDelta'],unit:'g/day',digits:0,signed:true},
  'intelligence.activityShiftPercent':{label:'Activity shift',path:['intelligence','activityShiftPercent'],unit:'%',digits:0,signed:true},
  'intelligence.weeklyTrendRate':{label:'Trend pace',path:['intelligence','weeklyTrendRate'],unit:'kg/week',digits:2,signed:true},
  'intelligence.stepsIntakeCorrelation':{label:'Steps/intake association',path:['intelligence','stepsIntakeCorrelation'],unit:'r',digits:2,signed:true}
});

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function num(v,fallback=null){return finite(v)?Number(v):fallback;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function text(v,max=180){return String(v??'').trim().slice(0,max);}
function normalize(v){return text(v,240).toLowerCase();}
function round(v,d=0){if(!finite(v))return null;const p=10**d;return Math.round(Number(v)*p)/p;}
function pct(v){return finite(v)?Math.round(Number(v)*100):null;}
function signed(v,d=0,suffix=''){if(!finite(v))return '—';const n=round(v,d);return (n>0?'+':'')+n+suffix;}
function explicitMultiplier(question){
  const q=normalize(question);
  const x=q.match(/\b(\d+(?:\.\d+)?)\s*[x×]\b/);
  if(x)return clamp(Number(x[1]),0.1,10);
  if(/\bhalf\b/.test(q))return 0.5;
  if(/\bdouble\b|\btwice\b/.test(q))return 2;
  if(/\bone and a half\b|\b1\.5\s*(?:servings?|portions?)\b/.test(q))return 1.5;
  return null;
}
function candidateBase(item,type,extra={}){
  return {
    type,
    id:text(item?.id,80),
    name:text(item?.name??item?.title,120),
    calories:round(item?.calories,0),
    protein:round(item?.protein,1),
    carbs:round(item?.carbs,1),
    fat:round(item?.fat,1),
    mealType:text(item?.mealType??item?.type,20)||null,
    favorite:Boolean(item?.favorite),
    useCount:Math.max(0,Math.round(num(item?.useCount,0)||0)),
    usualMultiplier:finite(extra?.usualMultiplier)?round(extra.usualMultiplier,2):1
  };
}
function compactInsight(x){
  return {
    id:text(x?.id,80),
    title:text(x?.title,100),
    value:finite(x?.value)?Number(x.value):null,
    unit:text(x?.unit,24),
    confidence:text(x?.confidence,24),
    evidenceDays:Math.max(0,Math.round(num(x?.evidenceDays,0)||0)),
    summary:text(x?.summary,260)
  };
}
function defaultMealType(){
  const h=new Date().getHours();
  if(h<10)return 'Breakfast';
  if(h<15)return 'Lunch';
  if(h<20)return 'Dinner';
  return 'Snack';
}
function candidateMap(context){
  const out=new Map();
  for(const list of [context?.candidates?.savedFoods,context?.candidates?.savedMeals,context?.candidates?.recentMeals]){
    for(const item of list??[]) if(item?.id) out.set(String(item.id),item);
  }
  return out;
}

function pathValue(context,path=[]){
  let value=context;
  for(const key of path)value=value?.[key];
  return value;
}
function resolveBasisItem(spec,context){
  const key=text(spec?.key,140);
  let meta=BASIS[key]??null;
  let value=null;
  if(meta){
    value=pathValue(context,meta.path);
  }else{
    const match=key.match(/^candidate:([^:]+):(calories|protein)$/);
    if(!match)return null;
    const item=candidateMap(context).get(match[1]);
    if(!item)return null;
    const field=match[2];
    value=item[field];
    meta={label:(item.name||'Saved item')+' '+field,unit:field==='calories'?'kcal':'g',digits:field==='calories'?0:1};
  }
  if(meta.text){
    const rendered=text(value,80);
    if(!rendered)return null;
    return {key,label:text(spec?.label,80)||meta.label,value:rendered};
  }
  if(!finite(value))return null;
  const n=round(value,meta.digits??0);
  const prefix=meta.signed&&n>0?'+':'';
  return {key,label:text(spec?.label,80)||meta.label,value:prefix+n+(meta.unit?' '+meta.unit:'')};
}
export function resolveCopilotBasis(basis,context){
  return Array.isArray(basis)?basis.slice(0,5).map(x=>resolveBasisItem(x,context)).filter(Boolean):[];
}
function findByWords(items,q){
  const words=normalize(q).split(/\s+/).filter(w=>w.length>2);
  return (items??[]).map(item=>{
    const hay=normalize((item.name??'')+' '+(item.mealType??''));
    const score=words.reduce((s,w)=>s+(hay.includes(w)?1:0),0)+(item.favorite?0.3:0)+Math.min(item.useCount??0,20)/100;
    return {item,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
}
function bestPattern(context,id){
  return (context?.intelligence?.insights??[]).find(x=>x.id===id)??null;
}

export function buildCopilotContext(model={}){
  const today=model.today??{};
  const strategy=model.strategy??{};
  const intel=model.progress?.intelligence??strategy.personalIntelligence??{};
  const memory=model.food?.memory?.foodsById??{};
  const savedFoods=(model.food?.savedFoods??[]).slice(0,12).map(x=>candidateBase(x,'saved_food',{
    usualMultiplier:memory?.[String(x.id)]?.usualPortion?.eligible
      ?memory[String(x.id)].usualPortion.multiplier:1
  })).filter(x=>x.id&&x.name);
  const savedMeals=(model.food?.savedMeals??[]).slice(0,10).map(x=>candidateBase(x,'saved_meal')).filter(x=>x.id&&x.name);
  const recentMeals=(model.food?.recentMeals??[]).slice(0,8).map(x=>({
    ...candidateBase(x,'recent_meal'),
    date:text(x?.date,10)
  })).filter(x=>x.id&&x.name);

  return {
    version:VERSION,
    asOfDate:text(model.asOfDate,10),
    today:{
      calories:round(today.calories,0),
      calorieTarget:round(today.calorieTarget,0),
      baseCalorieTarget:round(today.baseCalorieTarget,0),
      caloriesRemaining:round(today.caloriesRemaining,0),
      protein:round(today.protein,1),
      proteinTarget:round(today.proteinTarget,0),
      proteinRemaining:round(today.proteinRemaining,1),
      latestWeight:round(today.latestWeight,2),
      trendWeight:round(today.trendWeight,2),
      expenditure:round(today.expenditure,0),
      confidenceLevel:text(today.confidenceLevel,30),
      goalLabel:text(today.goalLabel,60),
      trainingDayType:text(today.trainingDayType,20),
      trainingTargetDelta:round(today.trainingTargetDelta,0),
      activityLevel:text(today.activityContext?.level,30)
    },
    strategy:{
      goalMode:text(strategy.goalMode,20),
      goalLabel:text(strategy.goalLabel,60),
      goalWeight:round(strategy.goalWeight,2),
      targetRateKgPerWeek:round(strategy.targetRateKgPerWeek,3),
      currentTarget:round(strategy.currentTarget,0),
      estimatedExpenditure:round(strategy.estimatedExpenditure,0),
      confidenceLevel:text(strategy.confidenceLevel,30),
      decision:text(strategy.decision,40),
      recommendedTarget:round(strategy.recommendedTarget,0),
      targetDelta:round(strategy.targetDelta,0),
      reason:text(strategy.reason,500),
      engineVersion:text(strategy.engineVersion,60),
      reviewStatus:text(strategy.weeklyReview?.status,40),
      reviewDue:Boolean(strategy.weeklyReview?.cadence?.due),
      reviewCadence:text(strategy.weeklyReview?.cadence?.label,80),
      missingEvidence:(strategy.weeklyReview?.missingEvidence??[]).slice(0,6).map(x=>text(x,140)),
      actionable:Boolean(strategy.weeklyReview?.recommendation?.actionable)
    },
    intelligence:{
      version:text(intel.version,40),
      reliableIntakeDays:round(intel.quality?.reliableIntakeDays,1),
      proteinTargetAdherence:pct(intel.metrics?.proteinTargetAdherence),
      calorieTargetAdherence:pct(intel.metrics?.calorieTargetAdherence),
      weekendDeltaCalories:round(intel.metrics?.weekendDeltaCalories,0),
      trainingCarbDelta:round(intel.metrics?.trainingCarbDelta,0),
      activityShiftPercent:finite(intel.metrics?.activityShift)?round(intel.metrics.activityShift*100,0):null,
      weeklyTrendRate:round(intel.metrics?.weeklyTrendRate,3),
      stepsIntakeCorrelation:round(intel.metrics?.stepsIntakeCorrelation,3),
      insights:(intel.insights??[]).slice(0,8).map(compactInsight)
    },
    candidates:{savedFoods,savedMeals,recentMeals},
    capabilities:{
      answerFromTrustedMetrics:true,
      logOnlyKnownSavedItems:true,
      repeatKnownRecentMeal:true,
      unknownFoodMustOpenFoodFlow:true,
      strategyReviewDecision:true,
      goalSetupNavigation:true,
      directModelWrites:false,
      allWritesRequireConfirmation:true
    }
  };
}

export function validateCopilotProposal(action,context){
  if(!action||typeof action!=='object')return null;
  const type=text(action.type,40);
  if(!ACTIONS.includes(type))return null;

  if(type==='navigate_food'){
    return {type,query:text(action.query,160),label:text(action.label,120)||'Open Food',requiresConfirmation:false,write:false};
  }
  if(type==='navigate_strategy'){
    return {type,label:text(action.label,120)||'Open Strategy',requiresConfirmation:false,write:false};
  }
  if(type==='edit_goal'){
    return {type,label:text(action.label,120)||'Edit goal',requiresConfirmation:false,write:false};
  }

  if(type==='strategy_keep'||type==='strategy_apply'){
    const s=context?.strategy??{};
    if(!finite(s.currentTarget))return null;
    if(type==='strategy_apply'&&(!s.actionable||!finite(s.recommendedTarget)||Math.abs(Number(s.recommendedTarget)-Number(s.currentTarget))<=1))return null;
    const currentGuard={
      asOfDate:text(context?.asOfDate,10),
      engineVersion:text(s.engineVersion,60),
      decision:text(s.decision,40),
      currentTarget:round(s.currentTarget,0),
      recommendedTarget:round(s.recommendedTarget,0)
    };
    if(action.guard){
      for(const key of ['asOfDate','engineVersion','decision']){
        if(text(action.guard?.[key],80)!==text(currentGuard[key],80))return null;
      }
      for(const key of ['currentTarget','recommendedTarget']){
        const expected=action.guard?.[key],actual=currentGuard[key];
        if((expected==null)!=(actual==null))return null;
        if(expected!=null&&Math.abs(Number(expected)-Number(actual))>1)return null;
      }
    }
    return {
      type,
      effectiveDate:action.effectiveDate==='tomorrow'?'tomorrow':'today',
      label:text(action.label,120)||(type==='strategy_apply'?'Apply '+Math.round(Number(s.recommendedTarget))+' kcal':'Keep current target'),
      guard:currentGuard,
      requiresConfirmation:true,
      write:true,
      strategy:{
        currentTarget:round(s.currentTarget,0),
        recommendedTarget:round(s.recommendedTarget,0),
        decision:text(s.decision,40),
        reason:text(s.reason,300)
      }
    };
  }

  const candidates=candidateMap(context);
  const id=text(action.id,80);
  const item=candidates.get(id);
  if(!item)return null;
  const expectedType=type==='log_saved_food'?'saved_food':type==='log_saved_meal'?'saved_meal':'recent_meal';
  if(item.type!==expectedType)return null;
  if(action.guard){
    if(text(action.guard?.id,80)!==String(item.id))return null;
    if(finite(action.guard?.calories)&&finite(item.calories)&&Math.abs(Number(action.guard.calories)-Number(item.calories))>1)return null;
    if(finite(action.guard?.protein)&&finite(item.protein)&&Math.abs(Number(action.guard.protein)-Number(item.protein))>.2)return null;
  }
  const multiplier=clamp(num(action.multiplier,item.usualMultiplier??1)??1,0.1,10);
  const mt=MEAL_TYPES.includes(action.mealType)?action.mealType:(item.mealType&&MEAL_TYPES.includes(item.mealType)?item.mealType:defaultMealType());
  return {
    type,id,
    multiplier:round(multiplier,2),
    mealType:mt,
    label:text(action.label,120)||('Log '+item.name),
    item:{id:item.id,name:item.name,calories:item.calories,protein:item.protein,type:item.type},
    guard:{id:item.id,calories:item.calories,protein:item.protein},
    requiresConfirmation:true,
    write:true
  };
}

export function sanitizeCopilotResponse(payload,context){
  const raw=payload&&typeof payload==='object'?payload:{};
  const answer=text(raw.answer,2200);
  if(!answer)return null;
  const basis=resolveCopilotBasis(raw.basis,context);
  return {
    answer,
    basis,
    caution:text(raw.caution,300)||null,
    action:validateCopilotProposal(raw.action,context)
  };
}

export function buildLocalCopilotReply(question,context){
  const q=normalize(question);
  if(!q)return null;
  const t=context.today??{},s=context.strategy??{},i=context.intelligence??{};

  if(/how (am i|i am) doing|status|today so far|progress today/.test(q)){
    const bits=[];
    if(finite(t.calories)&&finite(t.calorieTarget))bits.push('You have logged '+Math.round(t.calories)+' of '+Math.round(t.calorieTarget)+' kcal today');
    if(finite(t.protein)&&finite(t.proteinTarget))bits.push('protein is '+round(t.protein,0)+' of '+round(t.proteinTarget,0)+' g');
    if(finite(i.weeklyTrendRate))bits.push('trend weight is moving '+signed(i.weeklyTrendRate,2,' kg/week'));
    const answer=bits.length?bits.join('. ')+'.':'There is not enough trusted data yet for a useful status summary.';
    return {answer,basis:[],caution:null,action:null,source:'local'};
  }

  if(/how much.*(eat|left|remaining)|calories.*(left|remaining)|what can i eat/.test(q)){
    if(!finite(t.caloriesRemaining))return {answer:'A current calorie target is not available yet, so I cannot calculate a reliable remaining amount.',basis:[],caution:null,action:null,source:'local'};
    const remaining=Math.round(t.caloriesRemaining);
    const protein=finite(t.proteinRemaining)?Math.max(0,round(t.proteinRemaining,0)):null;
    return {
      answer:remaining>=0
        ?'You have about '+remaining+' kcal remaining today'+(protein!=null?', with about '+protein+' g protein remaining to target.':'.')
        :'You are about '+Math.abs(remaining)+' kcal over today\'s target.',
      basis:[
        {key:'today.caloriesRemaining'},
        ...(protein!=null?[{key:'today.proteinRemaining'}]:[])
      ],
      caution:null,action:null,source:'local'
    };
  }

  if(/\b(change|edit|update|set)\b.*\b(goal|goal weight|pace)\b|\bnew goal\b/.test(q)){
    return {
      answer:'Goal changes belong in the explicit goal-phase setup so the new phase boundary and targets stay reviewable.',
      basis:finite(s.currentTarget)?[{key:'strategy.currentTarget'}]:[],
      caution:'Opening goal setup does not change anything until you review and save the form.',
      action:{type:'edit_goal',label:'Edit goal'},
      source:'local'
    };
  }

  if(/\b(keep|stay with|do not change|don.t change)\b.*\b(target|calories|plan)\b/.test(q)&&finite(s.currentTarget)){
    return {
      answer:'I can record this weekly review as Keep current. Your calorie target will remain '+Math.round(s.currentTarget)+' kcal.',
      basis:[{key:'strategy.currentTarget'},{key:'strategy.confidenceLevel'}],
      caution:'This records the review decision but does not change your calorie target.',
      action:{type:'strategy_keep',label:'Keep '+Math.round(s.currentTarget)+' kcal'},
      source:'local'
    };
  }

  if(/\b(apply|accept|use|switch to)\b.*\b(recommend|target|calories|plan)\b/.test(q)&&s.actionable&&finite(s.recommendedTarget)){
    return {
      answer:'The deterministic strategy review currently supports applying '+Math.round(s.recommendedTarget)+' kcal instead of '+Math.round(s.currentTarget)+' kcal.',
      basis:[{key:'strategy.currentTarget'},{key:'strategy.recommendedTarget'},{key:'strategy.confidenceLevel'}],
      caution:'The change is not applied until you confirm the exact preview.',
      action:{type:'strategy_apply',effectiveDate:'today',label:'Apply '+Math.round(s.recommendedTarget)+' kcal'},
      source:'local'
    };
  }

  if(/why.*(target|calorie)|target.*(change|changed|lower|higher)|recommend/.test(q)){
    return {
      answer:s.reason||'The adaptive strategy engine does not currently have a specific target-change explanation.',
      basis:[
        ...(finite(s.currentTarget)?[{key:'strategy.currentTarget'}]:[]),
        ...(finite(s.recommendedTarget)?[{key:'strategy.recommendedTarget'}]:[]),
        ...(s.confidenceLevel?[{key:'strategy.confidenceLevel'}]:[])
      ],
      caution:'The Copilot explains the P1/P5 result; it does not recalculate or override it.',
      action:{type:'navigate_strategy',label:'Open Strategy'},
      source:'local'
    };
  }

  if(/weekend/.test(q)){
    const x=bestPattern(context,'weekend_intake');
    if(x)return {answer:x.summary,basis:[{key:'intelligence.weekendDeltaCalories'}],caution:null,action:null,source:'local'};
  }

  if(/protein/.test(q)&&finite(i.proteinTargetAdherence)){
    return {
      answer:'Across the current P7 analysis window, protein reached at least 90% of target on about '+i.proteinTargetAdherence+'% of reliable target days.',
      basis:[{key:'intelligence.proteinTargetAdherence'}],
      caution:null,action:null,source:'local'
    };
  }

  if(/pattern|insight|notice|learned/.test(q)){
    const insights=i.insights??[];
    if(insights.length){
      return {
        answer:insights.slice(0,3).map(x=>x.summary).join(' '),
        basis:insights.slice(0,3).map(x=>({
          key:x.id==='protein_adherence'?'intelligence.proteinTargetAdherence':
            x.id==='calorie_adherence'?'intelligence.calorieTargetAdherence':
            x.id==='weekend_intake'?'intelligence.weekendDeltaCalories':
            x.id==='training_carbs'?'intelligence.trainingCarbDelta':
            x.id==='activity_shift'?'intelligence.activityShiftPercent':
            x.id==='steps_intake_association'?'intelligence.stepsIntakeCorrelation':
            x.id==='weight_trend_rate'?'intelligence.weeklyTrendRate':''
        })).filter(x=>x.key),
        caution:'These are descriptive patterns from P7, not causal claims.',
        action:null,source:'local'
      };
    }
  }

  if(/\bcan i (eat|have)\b|\bwould .* fit\b/.test(q)){
    const saved=[...(context.candidates?.savedMeals??[]),...(context.candidates?.savedFoods??[])];
    const matches=findByWords(saved,q);
    const item=matches[0]?.score>0.9?matches[0].item:null;
    if(item&&finite(item.calories)&&finite(t.caloriesRemaining)){
      const after=round(Number(t.caloriesRemaining)-Number(item.calories),0);
      return {
        answer:after>=0
          ?'Your saved '+item.name+' is '+round(item.calories,0)+' kcal. It would fit inside today’s current target and leave about '+after+' kcal.'
          :'Your saved '+item.name+' is '+round(item.calories,0)+' kcal, which is about '+Math.abs(after)+' kcal more than today’s remaining target.',
        basis:[
          {key:'today.caloriesRemaining'},
          {key:'candidate:'+item.id+':calories',label:item.name}
        ],
        caution:'This compares the exact saved item with today’s current target; it does not judge whether you should eat it.',
        action:null,source:'local'
      };
    }
    return {
      answer:'I need the food’s actual nutrition before I can compare it with your remaining target.',
      basis:finite(t.caloriesRemaining)?[{key:'today.caloriesRemaining'}]:[],
      caution:'I will not estimate an unknown food into your canonical nutrition data.',
      action:{type:'navigate_food',query:text(question,160),label:'Find the food'},source:'local'
    };
  }

  const logIntent=/\b(log|add|record|ate|had)\b/.test(q);
  if(logIntent){
    const modified=/\b(modified|different|change|changed|without|extra|less|more|swap|replace)\b/.test(q);
    if(modified){
      return {
        answer:'That sounds different from the exact saved item, so I will not log the unmodified version. Open Food to review the actual items or nutrition first.',
        basis:[],caution:'Saved meals are only logged as-is unless the changed nutrition is known.',
        action:{type:'navigate_food',query:text(question,160),label:'Review in Food'},source:'local'
      };
    }
    const saved=[...(context.candidates?.savedMeals??[]),...(context.candidates?.savedFoods??[])];
    const matches=findByWords(saved,q);
    const ambiguous=matches.length>1&&matches[1].score>=matches[0].score-0.15;
    if(matches.length&&matches[0].score>0.9&&!ambiguous){
      const item=matches[0].item;
      const actionType=item.type==='saved_meal'?'log_saved_meal':'log_saved_food';
      const explicit=explicitMultiplier(question);
      const multiplier=explicit??Number(item.usualMultiplier??1);
      return {
        answer:'I found a known saved item that may match: '+item.name+'. I can only log it after you confirm the exact saved item.',
        basis:[
          ...(finite(item.calories)?[{key:'candidate:'+item.id+':calories',label:'Saved calories'}]:[]),
          ...(finite(item.protein)?[{key:'candidate:'+item.id+':protein',label:'Saved protein'}]:[])
        ],
        caution:'No nutrition values were estimated; this uses existing saved data.',
        action:{type:actionType,id:item.id,multiplier,mealType:item.mealType||defaultMealType(),label:'Log '+(multiplier!==1?multiplier+'× ':'')+item.name},
        source:'local'
      };
    }
    return {
      answer:'I cannot safely invent nutrition for an unknown food. Open Food to search the database or enter exact label values.',
      basis:[],caution:'Unknown foods are never auto-estimated into the canonical log.',
      action:{type:'navigate_food',query:text(question,160),label:'Open Food search'},source:'local'
    };
  }

  return null;
}

export const DietCopilotP8=Object.freeze({version:VERSION,actions:ACTIONS,mealTypes:MEAL_TYPES,basisKeys:Object.keys(BASIS)});
