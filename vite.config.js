import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/rpc': {
        target: 'http://127.0.0.1:8332',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add Basic Auth header if credentials are needed
            const username = '';
            const password = '';
            if (username || password) {
              const auth = Buffer.from(`${username}:${password}`).toString('base64');
              proxyReq.setHeader('Authorization', `Basic ${auth}`);
            }
          });
        }
      }
    }
  }
});
