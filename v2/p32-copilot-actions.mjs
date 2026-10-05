function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function round(value,digits=0){if(!finite(value))return null;const p=10**digits;return Math.round(Number(value)*p)/p;}
function signed(value){if(!finite(value))return '—';const n=Math.round(Number(value));return (n>0?'+':'')+n;}
function mealTypeLabel(value){return String(value??'Other');}

export function actionKind(action){
  if(!action)return 'none';
  if(['log_saved_food','log_saved_meal','repeat_meal'].includes(action.type))return 'food_write';
  if(['strategy_keep','strategy_apply'].includes(action.type))return 'strategy_write';
  if(['navigate_food','navigate_strategy','edit_goal'].includes(action.type))return 'navigation';
  return 'unknown';
}

export function buildActionPreview(action,context={}){
  if(!action)return null;
  const kind=actionKind(action);

  if(kind==='navigation'){
    const map={
      navigate_food:{title:'Open Food',summary:action.query?'Search for “'+action.query+'”.':'Open the Food workspace.'},
      navigate_strategy:{title:'Open Strategy',summary:'Open the deterministic strategy review.'},
      edit_goal:{title:'Edit goal',summary:'Open goal setup. Nothing changes until you save the form.'}
    };
    return {
      kind,title:map[action.type]?.title??'Continue',summary:map[action.type]?.summary??'Open the relevant Diet screen.',
      write:false,requiresConfirmation:false,changes:[]
    };
  }

  if(kind==='food_write'){
    const multiplier=Number(action.multiplier??1);
    const calories=finite(action.item?.calories)?Math.round(Number(action.item.calories)*multiplier):null;
    const protein=finite(action.item?.protein)?round(Number(action.item.protein)*multiplier,1):null;
    const verb=action.type==='repeat_meal'?'Repeat':'Log';
    const changes=[
      {label:'Item',before:null,after:action.item?.name??'Saved item'},
      {label:'Meal',before:null,after:mealTypeLabel(action.mealType)},
      {label:'Portion',before:null,after:(multiplier===1?'1×':multiplier+'×')},
      ...(calories!=null?[{label:'Calories added',before:null,after:calories+' kcal'}]:[]),
      ...(protein!=null?[{label:'Protein added',before:null,after:protein+' g'}]:[])
    ];
    return {
      kind,
      title:verb+' '+(action.item?.name??'saved item'),
      summary:'This writes the exact saved nutrition to today’s log.',
      write:true,requiresConfirmation:true,changes,
      consequence:calories!=null&&finite(context?.today?.caloriesRemaining)
        ?'After logging, about '+signed(Number(context.today.caloriesRemaining)-calories)+' kcal would remain versus target.'
        :null
    };
  }

  if(kind==='strategy_write'){
    const current=Number(action.strategy?.currentTarget);
    const recommended=Number(action.strategy?.recommendedTarget);
    if(action.type==='strategy_keep'){
      return {
        kind,title:'Keep current strategy',
        summary:'Record this weekly review without changing your calorie target.',
        write:true,requiresConfirmation:true,
        changes:[
          {label:'Calorie target',before:finite(current)?Math.round(current)+' kcal':'—',after:finite(current)?Math.round(current)+' kcal':'—'},
          {label:'Review outcome',before:'Unresolved',after:'Keep current'}
        ],
        consequence:'Historical targets remain unchanged.'
      };
    }
    return {
      kind,title:'Apply strategy recommendation',
      summary:'Apply the deterministic P31 recommendation to your active plan.',
      write:true,requiresConfirmation:true,
      changes:[
        {label:'Calorie target',before:finite(current)?Math.round(current)+' kcal':'—',after:finite(recommended)?Math.round(recommended)+' kcal':'—'},
        {label:'Change',before:null,after:finite(current)&&finite(recommended)?signed(recommended-current)+' kcal':'—'},
        {label:'Effective',before:null,after:action.effectiveDate==='tomorrow'?'Tomorrow':'Today'}
      ],
      consequence:'A new target period is created; prior target history is preserved.'
    };
  }

  return null;
}

export function confirmationLabel(action){
  if(!action)return 'Confirm';
  if(action.type==='strategy_keep')return 'Confirm keep';
  if(action.type==='strategy_apply')return 'Confirm apply';
  if(action.type==='log_saved_food'||action.type==='log_saved_meal'||action.type==='repeat_meal')return 'Confirm log';
  return action.label||'Continue';
}
