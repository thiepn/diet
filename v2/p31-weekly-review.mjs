const REVIEW_DAYS=7;
const MIN_ESTIMATE_SPAN=14;
const MIN_ESTIMATE_WEIGH_INS=4;
const MIN_LOW_EFFECTIVE_DAYS=4;
const MIN_MEDIUM_EFFECTIVE_DAYS=8;
const MEDIUM_SCORE=0.62;

function num(value,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function dateMs(value){
  const t=Date.parse(String(value??'')+'T00:00:00Z');
  return Number.isFinite(t)?t:null;
}
function daysBetween(a,b){
  const x=dateMs(a),y=dateMs(b);
  if(x==null||y==null)return null;
  return Math.floor((x-y)/86400000);
}
function pct(value){return Math.round(num(value)*100);}
function plural(n,one,many=one+'s'){return n===1?one:many;}

export function reviewCadence(asOfDate,history=[]){
  const resolved=(history??[]).filter(x=>x?.resolvedAt||['accepted','dismissed','insufficient','advisory','reverted'].includes(String(x?.status)));
  const latest=resolved[0]??null;
  if(!latest)return {state:'first_review',due:true,lastReviewOn:null,daysSince:null,nextReviewOn:null,label:'First review'};
  const last=String(latest.generatedOn??latest.resolvedAt??'').slice(0,10);
  const elapsed=daysBetween(asOfDate,last);
  if(elapsed==null)return {state:'unknown',due:true,lastReviewOn:last||null,daysSince:null,nextReviewOn:null,label:'Review available'};
  const next=new Date(dateMs(last)+REVIEW_DAYS*86400000).toISOString().slice(0,10);
  if(elapsed>=REVIEW_DAYS)return {state:'due',due:true,lastReviewOn:last,daysSince:elapsed,nextReviewOn:next,label:elapsed===REVIEW_DAYS?'Weekly review due':`Review overdue by ${elapsed-REVIEW_DAYS}d`};
  return {state:'recent',due:false,lastReviewOn:last,daysSince:elapsed,nextReviewOn:next,label:`Next review in ${REVIEW_DAYS-elapsed}d`};
}

export function evidenceReadiness(strategy={}){
  const reliable=num(strategy.reliableIntakeDays);
  const weighIns=num(strategy.weighIns);
  const span=num(strategy.weightSpanDays);
  const score=num(strategy.confidenceScore);
  const hasEstimate=Number.isFinite(Number(strategy.estimatedExpenditure));

  const items=[
    {
      key:'intake',
      label:'Reliable intake',
      value:reliable,
      target:MIN_MEDIUM_EFFECTIVE_DAYS,
      unit:'effective days',
      state:reliable>=MIN_MEDIUM_EFFECTIVE_DAYS?'ready':reliable>=MIN_LOW_EFFECTIVE_DAYS?'building':'missing'
    },
    {
      key:'weigh_ins',
      label:'Weigh-ins',
      value:weighIns,
      target:MIN_ESTIMATE_WEIGH_INS,
      unit:plural(MIN_ESTIMATE_WEIGH_INS,'weigh-in'),
      state:weighIns>=MIN_ESTIMATE_WEIGH_INS?'ready':'missing'
    },
    {
      key:'span',
      label:'Weight span',
      value:span,
      target:MIN_ESTIMATE_SPAN,
      unit:'days',
      state:span>=MIN_ESTIMATE_SPAN?'ready':'missing'
    },
    {
      key:'confidence',
      label:'Confidence',
      value:pct(score),
      target:62,
      unit:'%',
      state:score>=MEDIUM_SCORE?'ready':score>=0.42?'building':'missing'
    }
  ];

  const missing=[];
  if(span<MIN_ESTIMATE_SPAN)missing.push(`${Math.ceil(MIN_ESTIMATE_SPAN-span)} more ${plural(Math.ceil(MIN_ESTIMATE_SPAN-span),'day')} of weight history`);
  if(weighIns<MIN_ESTIMATE_WEIGH_INS)missing.push(`${Math.ceil(MIN_ESTIMATE_WEIGH_INS-weighIns)} more ${plural(Math.ceil(MIN_ESTIMATE_WEIGH_INS-weighIns),'weigh-in')}`);
  if(reliable<MIN_LOW_EFFECTIVE_DAYS)missing.push(`${Math.ceil(MIN_LOW_EFFECTIVE_DAYS-reliable)} more effective ${plural(Math.ceil(MIN_LOW_EFFECTIVE_DAYS-reliable),'intake day')}`);
  else if(reliable<MIN_MEDIUM_EFFECTIVE_DAYS)missing.push(`${Math.ceil(MIN_MEDIUM_EFFECTIVE_DAYS-reliable)} more effective ${plural(Math.ceil(MIN_MEDIUM_EFFECTIVE_DAYS-reliable),'intake day')} for medium-confidence changes`);
  if(hasEstimate&&score<MEDIUM_SCORE&&reliable>=MIN_MEDIUM_EFFECTIVE_DAYS&&weighIns>=MIN_ESTIMATE_WEIGH_INS&&span>=MIN_ESTIMATE_SPAN){
    missing.push('more consistent intake and weight observations to raise confidence');
  }

  return {
    items,missing,hasEstimate,
    changeReady:hasEstimate&&['medium','high'].includes(String(strategy.confidenceLevel)),
    thresholds:{
      estimateSpanDays:MIN_ESTIMATE_SPAN,
      estimateWeighIns:MIN_ESTIMATE_WEIGH_INS,
      lowEffectiveIntakeDays:MIN_LOW_EFFECTIVE_DAYS,
      mediumEffectiveIntakeDays:MIN_MEDIUM_EFFECTIVE_DAYS,
      mediumConfidenceScore:MEDIUM_SCORE
    }
  };
}

export function recommendationState(strategy={}){
  const decision=String(strategy.decision??'need_more_data');
  const current=Number(strategy.currentTarget);
  const recommended=Number(strategy.recommendedTarget);
  const delta=Number.isFinite(current)&&Number.isFinite(recommended)?recommended-current:null;
  const actionable=['increase','decrease','set_initial_target','transition_maintenance'].includes(decision)
    && Number.isFinite(recommended)
    && (!Number.isFinite(current)||Math.abs(delta)>1);
  const keep=['need_more_data','hold_for_confidence','keep_target','prepare_maintenance'].includes(decision)||!actionable;

  let headline='Keep the current target';
  let explanation=String(strategy.reason??'The current evidence does not support a target change.');
  if(decision==='increase')headline=`Increase to ${Math.round(recommended)} kcal`;
  if(decision==='decrease')headline=`Decrease to ${Math.round(recommended)} kcal`;
  if(decision==='set_initial_target')headline=`Set ${Math.round(recommended)} kcal`;
  if(decision==='transition_maintenance')headline=`Move to maintenance at ${Math.round(recommended)} kcal`;
  if(decision==='prepare_maintenance')headline='Keep target while preparing for maintenance';
  if(decision==='hold_for_confidence')headline='Keep target while confidence builds';
  if(decision==='need_more_data')headline='Keep target while the baseline builds';

  return {decision,actionable,keep,headline,explanation,delta};
}

export function buildWeeklyReview(strategy={},asOfDate,history=[]){
  const cadence=reviewCadence(asOfDate,history);
  const evidence=evidenceReadiness(strategy);
  const recommendation=recommendationState(strategy);
  const confidenceLevel=String(strategy.confidenceLevel??'building_baseline').replaceAll('_',' ');
  const score=pct(strategy.confidenceScore);
  const status=strategy.openReview?.status==='pending'
    ?'decision_pending'
    :strategy.openReview?.status==='advisory'
      ?'record_pending'
      :cadence.due?'review_due':'monitoring';

  return {
    version:'P31.1',
    cadence,
    evidence,
    recommendation,
    status,
    confidence:{
      level:confidenceLevel,
      score,
      uncertaintyKcal:Number.isFinite(Number(strategy.uncertaintyKcal))?Number(strategy.uncertaintyKcal):null,
      message:evidence.changeReady
        ?`${confidenceLevel} confidence supports a bounded target decision.`
        :evidence.missing.length
          ?'The engine will keep the plan stable until the evidence is strong enough.'
          :'Evidence is still building.'
    },
    missingEvidence:evidence.missing
  };
}
