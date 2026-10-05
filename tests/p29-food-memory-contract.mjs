import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildFoodMemory, foodMemoryFor, learnedFoodMultiplier,
  rankFoodsForMealType, rankMealsForMealType, buildRecurringMealMemory,
  findDuplicateSavedFood, duplicateReuseMultiplier
} from '../v2/p29-food-memory.mjs';
import { rankFoodCaptureMatches } from '../v2/p28-food-capture.mjs';

const foods=[
  {id:'f1',name:'Greek Yogurt',brand:'Fage',quantity:'250 g',barcode:'111',calories:200,protein:25,favorite:false,useCount:4},
  {id:'f2',name:'Banana',brand:'',quantity:'1 medium',barcode:'222',calories:105,protein:1.3,favorite:true,useCount:10},
  {id:'f3',name:'Oats',brand:'Store',quantity:'50 g',barcode:'333',calories:190,protein:6,favorite:false,useCount:2}
];
const meals=[
  {id:'m5',date:'2026-10-05',type:'Breakfast',title:'Yogurt bowl',calories:500,protein:35,eatenAt:'2026-10-05T07:30:00Z',items:[
    {savedFoodId:'f1',name:'Greek Yogurt',quantity:'375 g',calories:300,protein:37.5},
    {savedFoodId:'f2',name:'Banana',quantity:'1 medium',calories:105,protein:1.3}
  ]},
  {id:'m4',date:'2026-10-04',type:'Breakfast',title:'Yogurt bowl',calories:490,protein:35,eatenAt:'2026-10-04T07:20:00Z',items:[
    {savedFoodId:'f2',name:'Banana',quantity:'1 medium',calories:105,protein:1.3},
    {savedFoodId:'f1',name:'Greek Yogurt',quantity:'375 g',calories:300,protein:37.5}
  ]},
  {id:'m3',date:'2026-10-03',type:'Breakfast',title:'Yogurt bowl',calories:505,protein:35,eatenAt:'2026-10-03T07:10:00Z',items:[
    {savedFoodId:'f1',name:'Greek Yogurt',quantity:'375 g',calories:300,protein:37.5},
    {savedFoodId:'f3',name:'Oats',quantity:'50 g',calories:190,protein:6}
  ]},
  {id:'m2',date:'2026-10-02',type:'Lunch',title:'Yogurt snack',calories:300,protein:37.5,eatenAt:'2026-10-02T12:10:00Z',items:[
    {savedFoodId:'f1',name:'Greek Yogurt',quantity:'375 g',calories:300,protein:37.5}
  ]},
  {id:'m1',date:'2026-10-01',type:'Dinner',title:'Variable oats',calories:380,protein:12,eatenAt:'2026-10-01T18:10:00Z',items:[
    {savedFoodId:'f3',name:'Oats',quantity:'100 g',calories:380,protein:12}
  ]}
];

const memory=buildFoodMemory(foods,meals,{minObservations:3});
const yogurt=foodMemoryFor(memory,'f1');
assert.equal(yogurt.observations,4);
assert.equal(yogurt.usualPortion.eligible,true);
assert.equal(yogurt.usualPortion.multiplier,1.5);
assert.equal(yogurt.usualPortion.quantityText,'375 g');
assert.equal(learnedFoodMultiplier(memory,'f1'),1.5);
assert.equal(memory.learnedCount,1);
assert.equal(foodMemoryFor(memory,'missing'),null);

const breakfastRank=rankFoodsForMealType(foods,memory,'Breakfast',{limit:3});
const dinnerRank=rankFoodsForMealType(foods,memory,'Dinner',{limit:3});
assert.ok(
  breakfastRank.findIndex(x=>x.id==='f1') < dinnerRank.findIndex(x=>x.id==='f1'),
  'repeated breakfast evidence should improve Greek Yogurt ranking in breakfast context'
);
assert.equal(breakfastRank[0].id,'f2','explicit favorite may still outrank learned context');
const savedMealRanks=rankMealsForMealType([
  {id:'s1',name:'Dinner bowl',mealType:'Dinner',favorite:false,useCount:9},
  {id:'s2',name:'Breakfast bowl',mealType:'Breakfast',favorite:false,useCount:7}
],'Breakfast',{limit:2});
assert.equal(savedMealRanks[0].id,'s2','selected meal type should materially influence reusable meal ordering');

const recurring=buildRecurringMealMemory(meals,[{id:'s3',name:'Yogurt bowl'}],{minOccurrences:2});
assert.equal(recurring.length,1);
assert.equal(recurring[0].occurrences,2);
assert.equal(recurring[0].title,'Yogurt bowl');
assert.equal(recurring[0].alreadySaved,true);
assert.equal(recurring[0].representativeId,'m5');

const barcodeDupe=findDuplicateSavedFood(foods,{name:'Anything',barcode:'111'});
assert.equal(barcodeDupe.food.id,'f1');
assert.equal(barcodeDupe.reason,'barcode');
const sameDupe=findDuplicateSavedFood(foods,{
  name:'Greek Yogurt',brand:'Fage',quantityText:'250 g',calories:205,protein:25.5
});
assert.equal(sameDupe.food.id,'f1');
assert.equal(sameDupe.reason,'same_food');
assert.equal(findDuplicateSavedFood(foods,{name:'Greek Yogurt',brand:'Other',quantityText:'250 g',calories:205,protein:25.5}),null);

assert.equal(duplicateReuseMultiplier(
  {calories:200,protein:25,carbs:20,fat:5},
  {calories:300,protein:37.5,carbs:30,fat:7.5}
),1.5);
assert.equal(duplicateReuseMultiplier(
  {calories:200,protein:25},
  {calories:300,protein:20}
),null,'inconsistent nutrition scaling must not silently reuse');

const noFalseMatch=rankFoodCaptureMatches({food:{
  savedFoods:[{...foods[0],favorite:true,useCount:99}],
  savedMeals:[],
  memory:{foodsById:{f1:{mealTypeCounts:{Breakfast:20},dominantMealType:'Breakfast'}}}
}},'zzzzzz',{mealType:'Breakfast'});
assert.deepEqual(noFalseMatch,[],'memory bonuses must never create a non-text search match');

const readModel=fs.readFileSync('v2/read-model.mjs','utf8');
const foodUi=fs.readFileSync('v2/food.js','utf8');
const management=fs.readFileSync('v2/food-management.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');

assert.ok(readModel.includes('buildFoodMemory'));
assert.ok(readModel.includes('buildRecurringMealMemory'));
assert.ok(readModel.includes('memory:foodMemory'));
assert.ok(readModel.includes('recurringMeals'));
assert.ok(foodUi.includes('learnedFoodDefault'));
assert.ok(foodUi.includes('rankFoodsForMealType'));
assert.ok(foodUi.includes('data-save-recurring-meal'));
assert.ok(foodUi.includes('usualPortion'));
assert.ok(management.includes('findDuplicateSavedFood'));
assert.ok(management.includes('duplicateReuseMultiplier'));
assert.ok(management.includes("was already saved — reused and logged."));
assert.ok(html.includes('id="foodMemoryPanel"'));
assert.ok(html.includes('id="foodMemoryMeals"'));
assert.ok(sw.includes('./v2/p29-food-memory.mjs'));
assert.ok(aliasSw.includes('./p29-food-memory.mjs'));

console.log('P29 food memory and reuse intelligence contract passed.');
