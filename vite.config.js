import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxy local que resuelve CORS desde Node.js — evita bloqueos de firewall
// Solo activo en desarrollo (vite dev server). No aplica en el build de producción.
const proxyPlugin = {
  name: 'local-cors-proxy',
  configureServer(server) {
    server.middlewares.use('/api/proxy', async (req, res) => {
      // Extraer el parámetro ?url= de la query string
      const raw = req.url || ''
      const match = raw.match(/[?&]url=([^&]+)/)
      if (!match) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Parámetro url requerido: /api/proxy?url=https://...')
        return
      }

      const targetUrl = decodeURIComponent(match[1])

      // Validar que la URL sea https (seguridad básica)
      if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('URL inválida')
        return
      }

      try {
        const response = await fetch(targetUrl, {
          headers: {
            // Simula un navegador real para pasar los filtros básicos de User-Agent
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-GT,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
          },
          // Seguir redirecciones automáticamente
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        })

        const body = await response.text()

        // Headers de respuesta al frontend
        res.writeHead(response.status, {
          'Content-Type': response.headers.get('content-type') || 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'X-Proxy-Status': String(response.status),
          'X-Proxy-Source': targetUrl.substring(0, 80),
        })
        res.end(body)

      } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout')
        res.writeHead(isTimeout ? 504 : 502, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(`Error al consultar la fuente: ${err.message}`)
      }
    })
  },
}

export default defineConfig({
  plugins: [react(), proxyPlugin],
})
