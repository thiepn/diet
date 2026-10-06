export default {
  async fetch(){
    const supabaseConfigured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY);
    const providerConfigured=Boolean(process.env.OPENAI_API_KEY||process.env.DIET_COPILOT_AI_API_KEY);
    return Response.json({
      ok:true,
      service:"diet-copilot",
      workload:"copilot-ai",
      phase:"platform-p7",
      runtime:"vercel",
      region:process.env.VERCEL_REGION||null,
      ready:supabaseConfigured&&providerConfigured,
      configuration:{supabase:supabaseConfigured,provider:providerConfigured,providerMode:"openai-direct",model:"gpt-6-luna"}
    },{
      headers:{"Cache-Control":"no-store"}
    });
  }
};
