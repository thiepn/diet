export const DietServerRuntime=Object.freeze({
  phase:"platform-p7",
  copilot:Object.freeze({
    active:"supabase-edge",
    vercelEndpoint:"https://thiepn-diet.vercel.app/api/copilot",
    fallback:"supabase-edge",
    cutoverRequiresCertification:true
  })
});
