import assert from "node:assert/strict";
import handler from "../api/copilot.js";

const originalFetch=globalThis.fetch;
const oldEnv={...process.env};
process.env.SUPABASE_URL="https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
process.env.DIET_COPILOT_AI_API_KEY="provider-test";
process.env.DIET_COPILOT_ALLOWED_ORIGINS="https://thiepn.dev";

try{
  const unauthorized=await handler.fetch(new Request("https://runtime.example/api/copilot",{
    method:"POST",
    headers:{"content-type":"application/json","origin":"https://thiepn.dev"},
    body:JSON.stringify({question:"Status?",context:{},history:[]})
  }));
  assert.equal(unauthorized.status,401);
  assert.equal((await unauthorized.json()).error,"unauthorized");

  const deniedOrigin=await handler.fetch(new Request("https://runtime.example/api/copilot",{
    method:"OPTIONS",
    headers:{origin:"https://evil.example"}
  }));
  assert.equal(deniedOrigin.status,403);

  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith("/auth/v1/user")){
      assert.equal(options.headers.apikey,"sb_publishable_test");
      assert.equal(options.headers.Authorization,"Bearer user-token");
      return Response.json({id:"00000000-0000-4000-8000-000000000001"});
    }
    if(String(url)==="https://api.openai.com/v1/responses"){
      const providerBody=JSON.parse(options.body);
      assert.equal(providerBody.model,"gpt-6-luna");
      return Response.json({
        output_text:JSON.stringify({
          answer:"You have 500 kcal remaining.",
          basis:[{key:"today.caloriesRemaining",label:"Remaining"}],
          caution:null,
          action:null
        })
      });
    }
    throw new Error("Unexpected URL "+url);
  };

  const response=await handler.fetch(new Request("https://runtime.example/api/copilot",{
    method:"POST",
    headers:{
      authorization:"Bearer user-token",
      "content-type":"application/json",
      origin:"https://thiepn.dev"
    },
    body:JSON.stringify({
      question:"How much is left?",
      context:{today:{caloriesRemaining:500},candidates:{savedFoods:[],savedMeals:[],recentMeals:[]}},
      history:[]
    })
  }));
  assert.equal(response.status,200);
  assert.equal(response.headers.get("access-control-allow-origin"),"https://thiepn.dev");
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.runtime,"vercel");
  assert.equal(body.reply.answer,"You have 500 kcal remaining.");
  assert.deepEqual(body.reply.basis,[{key:"today.caloriesRemaining",label:"Remaining"}]);
  assert.equal(calls.length,2);
}finally{
  globalThis.fetch=originalFetch;
  for(const key of Object.keys(process.env)){
    if(!(key in oldEnv))delete process.env[key];
  }
  Object.assign(process.env,oldEnv);
}

console.log("Platform P7 Vercel function unit contract passed.");
