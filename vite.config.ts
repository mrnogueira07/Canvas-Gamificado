import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'proxy-image-middleware',
      configureServer(server) {
        server.middlewares.use('/api/proxy-image', async (req, res) => {
          try {
            const parsed = new URL(req.url!, 'http://localhost');
            const targetUrl = parsed.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }
            const fetchRes = await fetch(targetUrl);
            if (!fetchRes.ok) {
              res.statusCode = fetchRes.status;
              res.end(`Upstream error: ${fetchRes.statusText}`);
              return;
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const arrayBuffer = await fetchRes.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err) {
            console.error('[Vite Proxy Image Error]:', err);
            res.statusCode = 500;
            res.end('Proxy image failed');
          }
        });
      }
    }
  ],
})

