import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // GLM_API_KEY lives in .env.local and is read here, on the server side only.
  // It isn't VITE_-prefixed, so it never reaches the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: '/',
    server: {
      proxy: {
        // Local dev only: the viewer calls /glm-api and this forwards to GLM with
        // the key attached. GLM's API sends no CORS header, so the browser can't
        // call it directly.
        '/glm-api': {
          target: 'https://api.z.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/glm-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.GLM_API_KEY ?? ''}`)
            })
          },
        },
      },
    },
  }
})
