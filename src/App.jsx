import { useState, useEffect, useRef } from 'react';
import { loadState, saveState, clearState } from './utils/storage';
import { clientesIniciales, noticiasIniciales, candidatosIniciales } from './data/inicial';
import { calcularScore } from './utils/scoring';
import { ejecutarBusqueda, fusionarResultado, todasLasFuentesIds } from './utils/busqueda';

import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Bandeja from './components/Bandeja';
import Clientes from './components/Clientes';
import Noticias from './components/Noticias';
import Bitacora from './components/Bitacora';
import BitacoraBusquedas from './components/BitacoraBusquedas';
import Metricas from './components/Metricas';
import Fuentes from './components/Fuentes';
import './index.css';

const ESTADO_INICIAL = {
  clientes: clientesIniciales,
  noticias: noticiasIniciales,
  candidatos: candidatosIniciales,
  bitacora: [],
  busquedas: [],
  analista: 'Ana (Analista de Cumplimiento)',
};

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [vista, setVista] = useState('dashboard');
  const [estadoFuentes, setEstadoFuentes] = useState({});
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    saveState(state);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(true);
    toastTimer.current = setTimeout(() => setToast(false), 1600);
  }, [state]);

  // El programador vive en Node/Vite, no en el navegador.
  // El navegador importa las ejecuciones persistidas al abrirse y periódicamente.
  useEffect(() => {
    let activo = true;
    const sincronizar = async () => {
      try {
        const res = await fetch('/api/pep/status');
        if (!res.ok) return;
        const db = await res.json();
        if (!activo) return;
        setEstadoFuentes(db.fuentes || {});
        setState(prev => {
          let next = prev;
          const ids = new Set((prev.busquedas || []).map(b => b.id));
          for (const item of (db.pendientes || [])) {
            if (!ids.has(item.registro.id)) {
              next = fusionarResultado(next, item, { generarCandidatos: true });
              ids.add(item.registro.id);
            }
          }
          const registros = [...(db.busquedas || []), ...(next.busquedas || [])];
          const vistos = new Set();
          const unicos = registros.filter(r => { if (vistos.has(r.id)) return false; vistos.add(r.id); return true; });
          if (next === prev && unicos.length === (prev.busquedas || []).length) return prev;
          return { ...next, busquedas: unicos.slice(0, 2000) };
        });
      } catch (e) { console.warn('No se pudo sincronizar bitácora:', e.message); }
    };
    void sincronizar();
    const timer = setInterval(sincronizar, 30000);
    return () => { activo = false; clearInterval(timer); };
  }, []);

  function handleRestablecer() {
    if (!confirm('¿Restablecer todos los datos originales? Se perderán los cambios, decisiones y bitácora actuales.')) return;
    clearState();
    // Deep copy para evitar mutaciones del objeto original
    setState(JSON.parse(JSON.stringify(ESTADO_INICIAL)));
    setVista('dashboard');
  }

  function handleDecision(candidatoId, decision, motivo) {
    const ahora = new Date().toISOString();
    const candidato = state.candidatos.find(c => c.id === candidatoId);

    const nuevaEntrada = {
      candidatoId,
      noticiaId: candidato?.noticiaId || '',
      candidatoNombre: candidato?.nombreExtraido || candidatoId,
      cargoExtraido: candidato?.cargoExtraido || '',
      clienteId: candidato?.clienteId || '',
      score: candidato?.score ?? null,
      prioridad: candidato?.prioridad || '',
      decision,
      motivo,
      analista: state.analista,
      fecha: ahora,
    };

    setState(prev => ({
      ...prev,
      // Paso 3: eliminar el candidato de la bandeja al tomar cualquier decisión
      candidatos: prev.candidatos.filter(c => c.id !== candidatoId),
      bitacora: [...prev.bitacora, nuevaEntrada],
    }));
  }

  /**
   * Normaliza un string: minúsculas, sin tildes, sin caracteres especiales.
   */
  function normalizar(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Paso 2: al guardar cambios en Clientes, cruza cada cliente nuevo o modificado
   * contra todas las noticias del corpus. Si el nombre (o alguna de sus palabras
   * de más de 3 letras) aparece en el texto de una noticia, genera un candidato
   * pendiente y lo agrega a la bandeja (sin duplicar pares clienteId+noticiaId).
   */
  function handleClientesChange(nuevoState) {
    const clientesAntes = new Set(state.clientes.map(c => c.id));
    const clientesNuevos = nuevoState.clientes.filter(c => !clientesAntes.has(c.id));
    const clientesModificados = nuevoState.clientes.filter(c => {
      const anterior = state.clientes.find(x => x.id === c.id);
      return anterior && normalizar(anterior.nombre) !== normalizar(c.nombre);
    });

    const clientesACruzar = [...clientesNuevos, ...clientesModificados];

    if (clientesACruzar.length === 0) {
      setState(nuevoState);
      return;
    }

    const candidatosExistentes = nuevoState.candidatos || [];
    const nuevosGenerados = [];

    for (const cliente of clientesACruzar) {
      if (!cliente.nombre.trim()) continue;

      // Palabras del nombre con más de 3 letras (ignorar iniciales y artículos)
      const palabras = normalizar(cliente.nombre)
        .split(/\s+/)
        .filter(p => p.length > 3);

      if (palabras.length === 0) continue;

      for (const noticia of nuevoState.noticias) {
        // Evitar duplicados: mismo par (clienteId, noticiaId) ya en bandeja
        const yaExiste = candidatosExistentes.some(
          c => c.clienteId === cliente.id && c.noticiaId === noticia.id
        ) || nuevosGenerados.some(
          c => c.clienteId === cliente.id && c.noticiaId === noticia.id
        );
        if (yaExiste) continue;

        const textoNorm = normalizar(noticia.texto + ' ' + noticia.titulo);
        const coincidencias = palabras.filter(p => textoNorm.includes(p));

        if (coincidencias.length === 0) continue;

        // Calcular score usando el motor existente
        const { scoreDetalle, score, prioridad } = calcularScore(
          noticia,
          cliente,
          cliente.nombre,
          // Detectar cargo mencionado en el texto
          (() => {
            const cargosTest = ['director', 'ministr', 'alcalde', 'diputad',
              'presidente', 'secretari', 'gobernador', 'magistrado', 'fiscal',
              'embajador', 'superintendente', 'viceministr'];
            for (const c of cargosTest) {
              const idx = textoNorm.indexOf(c);
              if (idx !== -1) {
                return noticia.texto.substring(idx, idx + 35).split(' ').slice(0, 5).join(' ');
              }
            }
            return 'Cargo mencionado en noticia';
          })(),
          false
        );

        // Extraer fragmento relevante del texto
        let fragmento = noticia.texto;
        for (const palabra of palabras) {
          const idx = textoNorm.indexOf(palabra);
          if (idx !== -1) {
            const ini = Math.max(0, idx - 60);
            const fin = Math.min(noticia.texto.length, idx + 200);
            fragmento = (ini > 0 ? '…' : '') + noticia.texto.substring(ini, fin) + '…';
            break;
          }
        }

        nuevosGenerados.push({
          id: `CAND-${Date.now()}-${cliente.id}-${noticia.id}`,
          noticiaId: noticia.id,
          clienteId: cliente.id,
          nombreExtraido: cliente.nombre,
          cargoExtraido: (() => {
            const cargosTest = ['director', 'ministr', 'alcalde', 'diputad',
              'presidente', 'secretari', 'gobernador', 'magistrado', 'fiscal',
              'embajador', 'superintendente', 'viceministr'];
            for (const c of cargosTest) {
              const idx = textoNorm.indexOf(c);
              if (idx !== -1) {
                return noticia.texto.substring(idx, idx + 35).split(' ').slice(0, 5).join(' ');
              }
            }
            return 'Cargo mencionado en noticia';
          })(),
          institucion: '',
          evento: score >= 7 ? 'Nombramiento' : score >= 4 ? 'Cambio de cargo' : 'Posible homónimo',
          pais: cliente.pais || 'GT',
          fecha: noticia.fecha,
          fuente: noticia.fuente,
          fragmento,
          porQue: `Nombre del cliente coincide con mención en: "${noticia.titulo}". Palabras coincidentes: ${coincidencias.join(', ')}.`,
          riesgoHomonimo: score < 2 ? 'alto' : score < 5 ? 'medio' : 'bajo',
          scoreDetalle,
          score,
          prioridad,
          decision: null,
          motivoDecision: '',
          analista: '',
          fechaDecision: null,
        });
      }
    }

    setState({
      ...nuevoState,
      candidatos: [...candidatosExistentes, ...nuevosGenerados],
    });
  }

  // Todos los candidatos en bandeja son pendientes (se eliminan al decidir)
  const pendientes = state.candidatos.length;

  return (
    <>
      <Navbar
        vistaActiva={vista}
        onCambiarVista={setVista}
        pendientes={pendientes}
        onRestablecer={handleRestablecer}
      />
      <div className="app-main">
        {vista === 'dashboard' && <Dashboard state={state} estadoFuentes={estadoFuentes} onCambiarVista={setVista} />}
        {vista === 'bandeja'  && <Bandeja  state={state} onDecision={handleDecision} />}
        {vista === 'clientes' && <Clientes state={state} onChange={handleClientesChange} />}
        {vista === 'noticias' && <Noticias state={state} onChange={setState} />}
        {vista === 'fuentes'  && <Fuentes  state={state} onChange={setState} estadoFuentes={estadoFuentes} />}
        {vista === 'bitacora' && (
          <>
            <Bitacora state={state} />
            <BitacoraBusquedas busquedas={state.busquedas || []} />
          </>
        )}
        {vista === 'metricas' && <Metricas state={state} />}
      </div>
      {toast && <div className="autosave-toast">✓ Guardado</div>}
    </>
  );
}
