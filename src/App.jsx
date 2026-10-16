import { useState, useEffect, useRef } from 'react';
import { loadState, saveState, clearState } from './utils/storage';
import { clientesIniciales, noticiasIniciales, candidatosIniciales } from './data/inicial';
import { calcularScore } from './utils/scoring';
import Navbar from './components/Navbar';
import Bandeja from './components/Bandeja';
import Clientes from './components/Clientes';
import Noticias from './components/Noticias';
import Bitacora from './components/Bitacora';
import Metricas from './components/Metricas';
import Fuentes from './components/Fuentes';
import Login from './components/Login';
import EstadoConexion from './components/EstadoConexion';
import { useSincronizacion } from './utils/useSincronizacion';
import './index.css';

const ESTADO_INICIAL = {
  clientes: clientesIniciales,
  noticias: noticiasIniciales,
  candidatos: candidatosIniciales,
  bitacora: [],
  analista: 'Ana (Analista de Cumplimiento)',
};

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [vista, setVista] = useState('bandeja');
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);
  // Conexión con Supabase (si no hay .env.local, la app sigue en modo local)
  const sync = useSincronizacion(state, setState);

  useEffect(() => {
    saveState(state);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(true);
    toastTimer.current = setTimeout(() => setToast(false), 1600);
  }, [state]);

  function handleRestablecer() {
    if (!confirm('¿Restablecer todos los datos originales? Se perderán los cambios, decisiones y bitácora actuales.')) return;
    clearState();
    // Deep copy para evitar mutaciones del objeto original
    setState(JSON.parse(JSON.stringify(ESTADO_INICIAL)));
    setVista('bandeja');
  }

  function handleDecision(candidatoId, decision, motivo) {
    const ahora = new Date().toISOString();
    const candidato = state.candidatos.find(c => c.id === candidatoId);

    const nuevaEntrada = {
      candidatoId,
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

  // ── Enlaces con Supabase: se guardan los cambios sin alterar la lógica anterior ──
  if (sync.errorConfiguracion || sync.requiereLogin || sync.preparando || (sync.errorCarga && !sync.listo)) {
    return <Login sync={sync} />;
  }

  function decisionConGuardado(candidatoId, decision, motivo) {
    const candidato = state.candidatos.find(c => c.id === candidatoId);
    handleDecision(candidatoId, decision, motivo);
    sync.registrarDecision(candidato, decision, motivo);
  }

  function clientesConGuardado(nuevoState) {
    sync.marcarCambios('clientes', state.clientes, nuevoState.clientes);
    handleClientesChange(nuevoState);
  }

  function noticiasConGuardado(nuevoState) {
    sync.marcarCambios('noticias', state.noticias, nuevoState.noticias);
    setState(nuevoState);
  }

  function restablecerConRecarga() {
    if (!sync.conectado) return handleRestablecer();
    // Con Supabase la base es compartida: se avisa que el borrado afecta a todo el equipo
    if (!confirm('¿Restablecer todos los datos? Se borrarán los candidatos, las decisiones y la bitácora de la base de datos para TODO el equipo.')) return;
    clearState();
    setState(JSON.parse(JSON.stringify(ESTADO_INICIAL)));
    setVista('bandeja');
    sync.restablecer();
  }

  return (
    <>
      <Navbar
        vistaActiva={vista}
        onCambiarVista={setVista}
        pendientes={pendientes}
        onRestablecer={restablecerConRecarga}
      />
      <div className="app-main">
        {vista === 'bandeja'  && <Bandeja  state={state} onDecision={decisionConGuardado} />}
        {vista === 'clientes' && <Clientes state={state} onChange={clientesConGuardado} />}
        {vista === 'noticias' && <Noticias state={state} onChange={noticiasConGuardado} />}
        {vista === 'fuentes'  && <Fuentes  state={state} onChange={noticiasConGuardado} />}
        {vista === 'bitacora' && <Bitacora state={state} />}
        {vista === 'metricas' && <Metricas state={state} />}
      </div>
      {toast && <div className="autosave-toast">✓ Guardado</div>}
      <EstadoConexion sync={sync} />
    </>
  );
}
