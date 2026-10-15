/**
 * fetcher.js — Ingesta automática desde fuentes autorizadas
 *
 * Las peticiones van a /api/proxy?url=... que es el middleware definido en vite.config.js.
 * Ese middleware corre en Node.js (sin restricciones CORS) y añade un User-Agent real
 * para evitar el bloqueo 403 de los firewalls gubernamentales.
 *
 * Solo datos públicos. Sin datos reales de clientes. Uso académico.
 */

import { FUENTES_AUTORIZADAS } from '../data/fuentesAutorizadas';

// Timeout por petición (ms)
const TIMEOUT_MS = 15000;

// Palabras clave de cargos PEP — Guatemala
const PALABRAS_PEP = [
  'ministro', 'ministra', 'viceministro', 'viceministra',
  'director', 'directora', 'subdirector', 'subdirectora',
  'secretario', 'secretaria',
  'presidente', 'presidenta', 'vicepresidente', 'vicepresidenta',
  'diputado', 'diputada',
  'magistrado', 'magistrada',
  'fiscal', 'fiscalía',
  'gobernador', 'gobernadora',
  'embajador', 'embajadora', 'cónsul', 'consul',
  'superintendente',
  'alcalde', 'alcaldesa', 'síndico', 'concejal',
  'nombramiento', 'nombrado', 'nombrada',
  'designado', 'designada', 'designó', 'designa',
  'juramentó', 'juramentada', 'juramentado',
  'asume cargo', 'toma posesión', 'fue electo', 'fue electa',
  'nuevo ministro', 'nueva ministra',
  'nuevo director', 'nueva directora',
];

// ── HELPERS ──────────────────────────────────────────────────────────────────

function contieneTerminoPEP(texto) {
  const t = texto.toLowerCase();
  return PALABRAS_PEP.some(p => t.includes(p));
}

function extraerFragmento(texto, maxLen = 500) {
  const t = texto.toLowerCase();
  let mejorIdx = -1;
  for (const kw of PALABRAS_PEP) {
    const idx = t.indexOf(kw);
    if (idx !== -1) { mejorIdx = idx; break; }
  }
  if (mejorIdx === -1) return texto.substring(0, maxLen);
  const inicio = Math.max(0, mejorIdx - 100);
  const fin = Math.min(texto.length, mejorIdx + maxLen);
  return (inicio > 0 ? '…' : '') + texto.substring(inicio, fin).trim() + (fin < texto.length ? '…' : '');
}

/** Convierte HTML a texto plano */
function htmlATexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extrae el bloque de contenido principal del HTML.
 * Prioriza <article>, <main>, bloques con clase "content/noticia/post".
 * Evita nav, footer, sidebar.
 */
function extraerContenidoPrincipal(html) {
  const bloques = [
    /<article[\s\S]*?<\/article>/gi,
    /<main[\s\S]*?<\/main>/gi,
    /<div[^>]+class="[^"]*(?:content|article|noticia|post|entry|news|body)[^"]*"[\s\S]*?<\/div>/gi,
    /<section[^>]+class="[^"]*(?:content|article|noticia|news)[^"]*"[\s\S]*?<\/section>/gi,
  ];

  for (const regex of bloques) {
    const matches = [...html.matchAll(regex)];
    const partes = matches.map(m => htmlATexto(m[0])).filter(t => t.length > 100);
    if (partes.length > 0) return partes.join('\n\n').substring(0, 6000);
  }

  // Fallback: texto completo
  return htmlATexto(html).substring(0, 6000);
}

/** Extrae título: prioriza <h1>, luego <title> */
function extraerTitulo(html) {
  const h1 = html.match(/<h1[^>]*>([^<]{5,})<\/h1>/i);
  if (h1) return h1[1].trim().substring(0, 150);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) return title[1].replace(/\s+/g, ' ').trim().substring(0, 150);
  return '';
}

/** Detecta si el contenido es RSS/Atom */
function esRSS(contenido) {
  const c = contenido.trimStart().substring(0, 300);
  return c.includes('<rss') || c.includes('<feed') || c.includes('<?xml');
}

/** Parsea RSS 2.0 / Atom — extrae hasta 20 ítems */
function parsearRSS(xml) {
  const items = [];
  const bloques = [
    ...[...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m => m[0]),
    ...[...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map(m => m[0]),
  ];

  for (const bloque of bloques.slice(0, 20)) {
    const titulo = (
      bloque.match(/<title[^>]*><!\[CDATA\[(.+?)\]\]>/i) ||
      bloque.match(/<title[^>]*>([^<]+)<\/title>/i) || []
    )[1] || '';

    const descRaw = (
      bloque.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/i) ||
      bloque.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
      bloque.match(/<content[^>]*>([\s\S]*?)<\/content>/i) || []
    )[1] || '';

    const link = (
      bloque.match(/<link[^>]*>([^<]+)<\/link>/i) ||
      bloque.match(/<link[^>]*href="([^"]+)"/i) || []
    )[1] || '';

    const fecha = (
      bloque.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i) ||
      bloque.match(/<published[^>]*>([^<]+)<\/published>/i) ||
      bloque.match(/<updated[^>]*>([^<]+)<\/updated>/i) || []
    )[1] || '';

    const texto = htmlATexto(descRaw);
    if (titulo || texto) {
      items.push({ titulo: titulo.trim(), texto, link: link.trim(), fecha: fecha.trim() });
    }
  }
  return items;
}

// ── FETCH VÍA PROXY LOCAL ────────────────────────────────────────────────────

/**
 * Hace la petición a través del middleware local de Vite en /api/proxy.
 * El middleware corre en Node.js, añade User-Agent real y no tiene restricciones CORS.
 */
async function fetchLocal(url, signal) {
  const endpoint = `/api/proxy?url=${encodeURIComponent(url)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Propagar abort externo
  signal?.addEventListener('abort', () => controller.abort());

  try {
    const resp = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      return { contenido: null, error: `HTTP ${resp.status} desde el proxy local` };
    }

    const contenido = await resp.text();
    if (!contenido || contenido.length < 50) {
      return { contenido: null, error: 'Respuesta vacía del proxy local' };
    }

    return { contenido, httpStatus: resp.headers.get('X-Proxy-Status') };

  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw e;
    return { contenido: null, error: e.message };
  }
}

// ── PROCESAMIENTO POR FUENTE ──────────────────────────────────────────────────

export async function fetchNoticiasFromFuente(fuente, signal) {
  const url = fuente.urlNoticias || fuente.url;
  const esAlta = fuente.nivelConfiabilidad.includes('Nivel 1') ||
                 fuente.nivelConfiabilidad === 'Oficial Regulador';
  const confiabilidad = esAlta ? 'alta' : 'media';
  const fechaHoy = new Date().toISOString().slice(0, 10);

  const base = {
    fuente: fuente.dominio,
    fuenteId: fuente.id,
    fuenteNombre: fuente.nombre,
    url,
    fecha: fechaHoy,
    tipo: 'HTML',
    confiabilidad,
  };

  const { contenido, error } = await fetchLocal(url, signal);

  if (!contenido) {
    return [{
      ...base,
      id: `N-${Date.now()}-${fuente.id}`,
      titulo: `[Sin acceso] ${fuente.nombre}`,
      texto: '',
      estado: 'error',
      errorMsg: error || 'El proxy local no pudo obtener el contenido.',
    }];
  }

  // ── RAMA RSS ──
  if (esRSS(contenido)) {
    const items = parsearRSS(contenido);
    const relevantes = items.filter(i => contieneTerminoPEP(i.titulo + ' ' + i.texto));

    if (relevantes.length === 0) {
      return [{
        ...base,
        id: `N-${Date.now()}-${fuente.id}`,
        titulo: `[Sin menciones PEP] ${fuente.nombre}`,
        texto: items[0]?.titulo || '',
        estado: 'sin_menciones',
        errorMsg: 'El feed RSS no contiene menciones de cargos PEP en este momento.',
      }];
    }

    return relevantes.map((item, i) => ({
      ...base,
      id: `N-${Date.now()}-${fuente.id}-${i}`,
      titulo: item.titulo || `Noticia de ${fuente.nombre}`,
      texto: extraerFragmento(item.titulo + ' ' + item.texto),
      textoCompleto: (item.titulo + ' ' + item.texto).substring(0, 3000),
      url: item.link || url,
      fecha: item.fecha
        ? (new Date(item.fecha).toISOString().slice(0, 10) || fechaHoy)
        : fechaHoy,
      estado: 'ok',
      errorMsg: null,
    }));
  }

  // ── RAMA HTML ──
  const texto = extraerContenidoPrincipal(contenido);

  if (!contieneTerminoPEP(texto)) {
    return [{
      ...base,
      id: `N-${Date.now()}-${fuente.id}`,
      titulo: `[Sin menciones PEP] ${fuente.nombre}`,
      texto: texto.substring(0, 300),
      estado: 'sin_menciones',
      errorMsg: 'El contenido no contiene menciones de cargos PEP.',
    }];
  }

  const titulo = extraerTitulo(contenido) || `Noticias de ${fuente.nombre}`;
  const fragmento = extraerFragmento(texto);

  return [{
    ...base,
    id: `N-${Date.now()}-${fuente.id}`,
    titulo,
    texto: fragmento,
    textoCompleto: texto.substring(0, 3000),
    estado: 'ok',
    errorMsg: null,
  }];
}

// ── ORQUESTADOR ──────────────────────────────────────────────────────────────

/**
 * Consulta todas las fuentes seleccionadas con concurrencia controlada.
 * @param {string[]} fuenteIds
 * @param {Function} onProgreso - (fuenteId, estado) => void
 * @param {AbortSignal} signal
 * @returns {Promise<Array>}
 */
export async function fetchTodasLasFuentes(fuenteIds, onProgreso, signal) {
  const fuentes = FUENTES_AUTORIZADAS.filter(f => fuenteIds.includes(f.id));
  const noticias = [];

  // 3 peticiones simultáneas al proxy local — Node.js lo maneja sin problema
  const CONCURRENCIA = 3;

  for (let i = 0; i < fuentes.length; i += CONCURRENCIA) {
    if (signal?.aborted) break;

    const lote = fuentes.slice(i, i + CONCURRENCIA);

    await Promise.all(lote.map(async (fuente) => {
      if (signal?.aborted) return;
      onProgreso?.(fuente.id, 'cargando');
      try {
        const resultados = await fetchNoticiasFromFuente(fuente, signal);
        noticias.push(...resultados);
        onProgreso?.(fuente.id, resultados[0]?.estado || 'ok');
      } catch (e) {
        if (e.name === 'AbortError') return;
        onProgreso?.(fuente.id, 'error');
      }
    }));

    // Pequeña pausa entre lotes para no sobrecargar el proxy local
    if (i + CONCURRENCIA < fuentes.length && !signal?.aborted) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return noticias;
}
