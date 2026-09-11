(() => {
  const config = {
    url: 'https://mrrqsqawwxwebsdmrnre.supabase.co',
    key: 'sb_publishable_1skle8AStSXmao9Vx0DOGA_U6mPJfsu'
  };
  try {
    localStorage.setItem('diet-copilot-cloud-config', JSON.stringify(config));
  } catch (e) {
    console.warn('Could not preconfigure Diet Copilot cloud connection', e);
  }
})();
