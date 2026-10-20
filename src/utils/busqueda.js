/**
 * busqueda.js — Lógica común de búsqueda en las fuentes autorizadas.
 * La usan tanto el botón manual (Fuentes.jsx) como la búsqueda automática de las 8 pm (App.jsx).
 */

import { fetchTodasLasFuentes } from './fetcher';
import { procesarNoticias } from './scoring';
import { FUENTES_AUTORIZADAS } from '../data/fuentesAutorizadas';

let enCurso = false; // evita que una búsqueda manual y la automática se pisen

export const todasLasFuentesIds = () => FUENTES_AUTORIZADAS.map(f => f.id);

/**
 * Ejecuta una búsqueda y devuelve { resultados, registro }.
 * Devuelve null si ya había otra búsqueda en curso.
 */
export async function ejecutarBusqueda({ tipo, fuenteIds, onProgreso, signal }) {
  if (enCurso) return null;
  enCurso = true;
  try {
    const inicio = new Date();
    const resultados = await fetchTodasLasFuentes(fuenteIds, onProgreso, signal);

    const idsOk = new Set(resultados.filter(n => n.estado === 'ok').map(n => n.fuenteId));
    const idsSin = new Set(resultados.filter(n => n.estado === 'sin_menciones').map(n => n.fuenteId));

    const registro = {
      id: `BUS-${inicio.getTime()}`,
      tipo, // 'manual' | 'automatica'
      timestamp: inicio.toISOString(),
      fecha: inicio.toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }),
      hora: inicio.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala' }),
      fuentesConsultadas: fuenteIds.length,
      fuentesConNoticias: idsOk.size,
      sinMenciones: idsSin.size,
      errores: fuenteIds.length - idsOk.size - idsSin.size,
      noticiasEncontradas: resultados.filter(n => n.estado === 'ok').length,
      // Detalle de fallos: sirve para decidir qué fuentes eliminar del catálogo
      fuentesConError: resultados
        .filter(n => n.estado === 'error')
        .map(n => ({ id: n.fuenteId, nombre: n.fuenteNombre, error: n.errorMsg })),
    };

    return { resultados, registro };
  } finally {
    enCurso = false;
  }
}

// Clave para detectar duplicados. Las páginas HTML siempre tienen la misma URL,
// así que se combina con el inicio del texto para no descartar contenido nuevo.
const clave = n => `${n.url}|${(n.textoCompleto || n.texto || '').slice(0, 200)}`;

/**
 * Devuelve el nuevo estado con las noticias agregadas y la búsqueda registrada.
 * Si generarCandidatos es true, cruza SOLO las noticias nuevas con los clientes
 * y agrega los candidatos a la bandeja (sin repetir los ya decididos).
 */
export function fusionarResultado(prev, { resultados, registro }, { generarCandidatos = false } = {}) {
  const existentes = new Set((prev.noticias || []).map(clave));
  const nuevas = [];
  for (const n of resultados) {
    if (n.estado !== 'ok') continue;
    const k = clave(n);
    if (existentes.has(k)) continue;
    existentes.add(k);
    nuevas.push(n);
  }

  let candidatosNuevos = [];
  if (generarCandidatos && nuevas.length > 0) {
    const yaVistos = new Set([
      ...(prev.candidatos || []).map(c => `${c.clienteId}|${c.noticiaId}`),
      ...(prev.bitacora || []).filter(b => b.noticiaId).map(b => `${b.clienteId}|${b.noticiaId}`),
    ]);
    candidatosNuevos = procesarNoticias(nuevas, prev.clientes || [])
      .filter(c => !yaVistos.has(`${c.clienteId}|${c.noticiaId}`));
  }

  return {
    ...prev,
    noticias: [...(prev.noticias || []), ...nuevas],
    candidatos: [...(prev.candidatos || []), ...candidatosNuevos],
    busquedas: [
      { ...registro, noticiasAgregadas: nuevas.length, candidatosGenerados: candidatosNuevos.length },
      ...(prev.busquedas || []),
    ].slice(0, 500),
  };
}
