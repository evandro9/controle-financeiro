// Compat layer DEMO: reescreve http://localhost:3001 -> /api (fetch/axios)
// Só ativa em modo "demo", para não interferir no dev local padrão.
if (import.meta.env.MODE === 'demo') {
  const LOCAL_HOSTS = [
    'http://localhost:3001',
    'https://localhost:3001',
    'http://127.0.0.1:3001',
    'https://127.0.0.1:3001',
  ];
  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const rewrite = (url) => {
    if (typeof url !== 'string') return url;
    for (const base of LOCAL_HOSTS) {
      if (url.startsWith(base)) {
        const rest = url.slice(base.length);
        return `${API_BASE}${rest.startsWith('/') ? '' : '/'}${rest}`;
      }
    }
    return url;
  };

  // fetch()
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') {
      input = rewrite(input);
    } else if (input && typeof input.url === 'string') {
      const newUrl = rewrite(input.url);
      if (newUrl !== input.url) {
        input = new Request(newUrl, input);
      }
    }
    return origFetch(input, init);
  };

  // axios (se presente)
  try {
    import('axios').then(({ default: axios }) => {
      if (!axios.defaults.baseURL) axios.defaults.baseURL = API_BASE;
      axios.interceptors.request.use((cfg) => {
        if (cfg && typeof cfg.url === 'string') {
          cfg.url = rewrite(cfg.url);
        }
        return cfg;
      });
    }).catch(() => {});
  } catch (_) {}
}