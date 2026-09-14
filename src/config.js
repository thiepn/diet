(() => {
  const config = {
    url: 'https://hycegznamzjhwinegaai.supabase.co',
    key: 'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR'
  };
  try {
    localStorage.setItem('diet-copilot-cloud-config', JSON.stringify(config));
  } catch (e) {
    console.warn('Could not preconfigure Diet Copilot cloud connection', e);
  }
})();
