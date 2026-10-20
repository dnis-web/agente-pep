import { clientesIniciales, noticiasIniciales, candidatosIniciales } from '../data/inicial';

// v2: candidatos ahora se generan dinámicamente; bandeja empieza vacía
const KEY = 'agente_pep_v2';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    // busquedas: [] garantiza que datos guardados antes de este cambio también tengan el campo
    if (raw) return { busquedas: [], ...JSON.parse(raw) };
  } catch {}
  return {
    clientes: clientesIniciales,
    noticias: noticiasIniciales,
    candidatos: candidatosIniciales, // []
    bitacora: [],
    busquedas: [], // historial de búsquedas (manuales y automáticas)
    analista: 'Ana (Analista de Cumplimiento)',
  };
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(KEY);
}
