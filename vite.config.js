import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readDB, recordRun } from './serverPersistence.js'
import { startScheduler } from './serverScheduler.js'
import { TODOS_DOMINIOS_AUTORIZADOS } from './src/data/fuentesAutorizadas.js'

// Proxy local que resuelve CORS desde Node.js — evita bloqueos de firewall
// Solo activo en desarrollo (vite dev server). No aplica en el build de producción.
const proxyPlugin = {
  name: 'local-cors-proxy',
  configureServer(server) {
    const stop = startScheduler();
    server.httpServer?.on('close', stop);
    server.middlewares.use('/api/pep/status', (req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(readDB())); });
    server.middlewares.use('/api/pep/manual', (req,res) => {
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {res.writeHead(403);res.end('Origen no autorizado');return;}
      if(req.method !== 'POST') {res.writeHead(405);res.end();return;}
      let body=''; req.on('data',chunk=>{body+=chunk;if(body.length>2_000_000)req.destroy();});
      req.on('end',()=>{try { const value=JSON.parse(body); if(value?.registro?.tipo !== 'manual' || !Array.isArray(value.resultados))throw Error('Formato inválido'); recordRun(value); res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}'); }catch(e){res.writeHead(400);res.end(e.message);} });
    });
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

      // Validar la URL y que el dominio pertenezca al catálogo de fuentes autorizadas
      let host
      try {
        const u = new URL(targetUrl)
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocolo')
        host = u.hostname
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('URL inválida')
        return
      }

      const permitido = TODOS_DOMINIOS_AUTORIZADOS.some(
        d => host === d || host.endsWith('.' + d)
      )
      if (!permitido) {
        res.writeHead(403, { 'Content-Type': 'text/plain' })
        res.end('Dominio no autorizado')
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

        const finalHost = new URL(response.url).hostname
        if (!TODOS_DOMINIOS_AUTORIZADOS.some(d => finalHost === d || finalHost.endsWith('.' + d))) {
          res.writeHead(403); res.end('Redirección a dominio no autorizado'); return
        }
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
        // err.cause suele traer la causa real (certificado SSL, DNS, conexión rechazada…)
        const causa = err.cause?.code || err.cause?.message || ''
        const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout')
        res.writeHead(isTimeout ? 504 : 502, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(`${isTimeout ? 'Timeout' : 'Error'} al consultar la fuente: ${err.message} ${causa}`.trim())
      }
    })
  },
}

export default defineConfig({
  server: { host: '127.0.0.1' },
  plugins: [react(), proxyPlugin],
})
