import { defineConfig, loadEnv } from 'vite';

// Permite injetar hosts extras via env:
//   __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=host1,host2
const extraHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Host do túnel (opcional) para HMR estável via ngrok
const parseHost = (v = '') => v.replace(/^https?:\/\//, '').split('/')[0];
const ngrokHost = parseHost(process.env.VITE_NGROK_HOST || '');

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDemo = mode === 'demo';
  const demoTenant = env.VITE_TENANT_ID || 'demo';
  return defineConfig({
  server: {
    host: true, // aceita conexões que não sejam só localhost
    // Lista explícita + curingas do ngrok + extras por env
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      ...extraHosts,
      ...(ngrokHost ? [ngrokHost] : []),
    ],
    // Só força WSS:443 quando houver ngrokHost definido
    hmr: ngrokHost
      ? { clientPort: 443, protocol: 'wss', host: ngrokHost }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Envia /api/login -> /login no backend
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Header do tenant somente no modo DEMO
        headers: isDemo ? { 'x-tenant-id': demoTenant } : undefined       
      },
    },
  },
  // Cobre "vite preview" também, se um dia usar
  preview: {
    host: true,
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      ...extraHosts,
      ...(ngrokHost ? [ngrokHost] : []),
    ],
  },
  });
};