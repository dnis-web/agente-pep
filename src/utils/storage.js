import { clientesIniciales, noticiasIniciales, candidatosIniciales } from '../data/inicial';

const KEY = 'agente_pep_v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    clientes: clientesIniciales,
    noticias: noticiasIniciales,
    candidatos: candidatosIniciales,
    bitacora: [],
    analista: 'Ana (Analista de Cumplimiento)',
  };
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(KEY);
}
