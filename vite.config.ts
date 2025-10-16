import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar las variables de entorno
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/mercadopago': {
          target: 'https://api.mercadopago.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/mercadopago/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              // Agregar el token de autorización desde el env
              const token = env.VITE_MERCADOPAGO_ACCESS_TOKEN;
              // console.log('🔑 [Proxy] Setting Authorization token:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND');
              if (token) {
                proxyReq.setHeader('Authorization', `Bearer ${token}`);
              } else {
                console.error('⚠️ [Proxy] VITE_MERCADOPAGO_ACCESS_TOKEN no encontrado en .env');
              }
            });
          },
        },
      },
    },
  }
})
