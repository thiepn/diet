const VERSION='1.0.0-p8';
const ACTIONS=Object.freeze(['log_saved_food','log_saved_meal','repeat_meal','navigate_food','navigate_strategy']);
const MEAL_TYPES=Object.freeze(['Breakfast','Lunch','Dinner','Snack','Other']);

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function num(v,fallback=null){return finite(v)?Number(v):fallback;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function text(v,max=180){return String(v??'').trim().slice(0,max);}
function normalize(v){return text(v,240).toLowerCase();}
function round(v,d=0){if(!finite(v))return null;const p=10**d;return Math.round(Number(v)*p)/p;}
function pct(v){return finite(v)?Math.round(Number(v)*100):null;}
function signed(v,d=0,suffix=''){if(!finite(v))return '—';const n=round(v,d);return (n>0?'+':'')+n+suffix;}
function candidateBase(item,type){
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
    useCount:Math.max(0,Math.round(num(item?.useCount,0)||0))
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
  const savedFoods=(model.food?.savedFoods??[]).slice(0,12).map(x=>candidateBase(x,'saved_food')).filter(x=>x.id&&x.name);
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
      reason:text(strategy.reason,500)
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
      strategyWrites:false,
      directModelWrites:false
    }
  };
}

export function validateCopilotProposal(action,context){
  if(!action||typeof action!=='object')return null;
  const type=text(action.type,40);
  if(!ACTIONS.includes(type))return null;
  if(type==='navigate_food'){
    return {type,query:text(action.query,160),label:text(action.label,120)||'Open Food'};
  }
  if(type==='navigate_strategy'){
    return {type,label:text(action.label,120)||'Open Strategy'};
  }

  const candidates=candidateMap(context);
  const id=text(action.id,80);
  const item=candidates.get(id);
  if(!item)return null;
  const expectedType=type==='log_saved_food'?'saved_food':type==='log_saved_meal'?'saved_meal':'recent_meal';
  if(item.type!==expectedType)return null;
  const multiplier=clamp(num(action.multiplier,1)??1,0.1,10);
  const mt=MEAL_TYPES.includes(action.mealType)?action.mealType:(item.mealType&&MEAL_TYPES.includes(item.mealType)?item.mealType:defaultMealType());
  return {
    type,id,
    multiplier:round(multiplier,2),
    mealType:mt,
    label:text(action.label,120)||('Log '+item.name),
    item:{id:item.id,name:item.name,calories:item.calories,protein:item.protein,type:item.type}
  };
}

export function sanitizeCopilotResponse(payload,context){
  const raw=payload&&typeof payload==='object'?payload:{};
  const answer=text(raw.answer,2200);
  if(!answer)return null;
  const basis=Array.isArray(raw.basis)?raw.basis.slice(0,5).map(x=>({
    label:text(x?.label,80),
    value:text(x?.value,120)
  })).filter(x=>x.label&&x.value):[];
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
        {label:'Today',value:round(t.calories,0)+' / '+round(t.calorieTarget,0)+' kcal'},
        ...(protein!=null?[{label:'Protein remaining',value:protein+' g'}]:[])
      ],
      caution:null,action:null,source:'local'
    };
  }

  if(/why.*(target|calorie)|target.*(change|changed|lower|higher)|recommend/.test(q)){
    return {
      answer:s.reason||'The adaptive strategy engine does not currently have a specific target-change explanation.',
      basis:[
        ...(finite(s.currentTarget)?[{label:'Current target',value:Math.round(s.currentTarget)+' kcal'}]:[]),
        ...(finite(s.recommendedTarget)?[{label:'Recommended',value:Math.round(s.recommendedTarget)+' kcal'}]:[]),
        ...(s.confidenceLevel?[{label:'Confidence',value:text(s.confidenceLevel,30)}]:[])
      ],
      caution:'The Copilot explains the P1/P5 result; it does not recalculate or override it.',
      action:{type:'navigate_strategy',label:'Open Strategy'},
      source:'local'
    };
  }

  if(/weekend/.test(q)){
    const x=bestPattern(context,'weekend_intake');
    if(x)return {answer:x.summary,basis:[{label:'Weekend delta',value:signed(x.value,0,' '+x.unit)}],caution:null,action:null,source:'local'};
  }

  if(/protein/.test(q)&&finite(i.proteinTargetAdherence)){
    return {
      answer:'Across the current P7 analysis window, protein reached at least 90% of target on about '+i.proteinTargetAdherence+'% of reliable target days.',
      basis:[{label:'Protein adherence',value:i.proteinTargetAdherence+'%'}],
      caution:null,action:null,source:'local'
    };
  }

  if(/pattern|insight|notice|learned/.test(q)){
    const insights=i.insights??[];
    if(insights.length){
      return {
        answer:insights.slice(0,3).map(x=>x.summary).join(' '),
        basis:insights.slice(0,3).map(x=>({label:x.title,value:signed(x.value,x.unit==='r'?2:0,' '+x.unit)})),
        caution:'These are descriptive patterns from P7, not causal claims.',
        action:null,source:'local'
      };
    }
  }

  const logIntent=/\b(log|add|ate|eat|had)\b/.test(q);
  if(logIntent){
    const saved=[...(context.candidates?.savedMeals??[]),...(context.candidates?.savedFoods??[])];
    const matches=findByWords(saved,q);
    if(matches.length&&matches[0].score>0.9){
      const item=matches[0].item;
      const actionType=item.type==='saved_meal'?'log_saved_meal':'log_saved_food';
      return {
        answer:'I found a known saved item that may match: '+item.name+'. I can only log it after you confirm the exact saved item.',
        basis:[
          ...(finite(item.calories)?[{label:'Saved calories',value:Math.round(item.calories)+' kcal'}]:[]),
          ...(finite(item.protein)?[{label:'Saved protein',value:round(item.protein,0)+' g'}]:[])
        ],
        caution:'No nutrition values were estimated; this uses existing saved data.',
        action:{type:actionType,id:item.id,multiplier:1,mealType:item.mealType||defaultMealType(),label:'Log '+item.name},
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

export const DietCopilotP8=Object.freeze({version:VERSION,actions:ACTIONS,mealTypes:MEAL_TYPES});
