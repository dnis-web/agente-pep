import { useState, useRef } from 'react';
import { FUENTES_AUTORIZADAS } from '../data/fuentesAutorizadas';
import { ejecutarBusqueda, fusionarResultado } from '../utils/busqueda';

const ROLES_COLOR = {
  'Normativa Base Cargos PEP': { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
  'Monitoreo Noticias':         { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  'Monitoreo Prensa':           { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  'Monitoreo Cruce':            { bg: '#faf5ff', text: '#7e22ce', border: '#d8b4fe' },
};

const NIVEL_COLOR = {
  'Oficial Regulador':    { bg: '#1d4ed8', text: '#fff' },
  'Verificada Nivel 1':   { bg: '#15803d', text: '#fff' },
  'Verificada Nivel 2':   { bg: '#b45309', text: '#fff' },
};

export default function Fuentes({ state, onChange, estadoFuentes = {} }) {
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [progreso, setProgreso] = useState({}); // { fuenteId: 'cargando'|'ok'|'error'|'sin_menciones' }
  const [cargando, setCargando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const abortRef = useRef(null);

  const fuentesActivas = FUENTES_AUTORIZADAS.filter(f => estadoFuentes[f.id]?.activa !== false);
  const roles = ['TODOS', ...new Set(fuentesActivas.map(f => f.rol))];

  const fuentesFiltradas = fuentesActivas.filter(f =>
    filtroRol === 'TODOS' || f.rol === filtroRol
  );

  function toggleFuente(id) {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function seleccionarTodas() {
    setSeleccionadas(new Set(fuentesFiltradas.map(f => f.id)));
  }

  function limpiarSeleccion() {
    setSeleccionadas(new Set());
  }

  async function iniciarFetch() {
    if (seleccionadas.size === 0) {
      alert('Selecciona al menos una fuente para consultar.');
      return;
    }

    setCargando(true);
    setProgreso({});
    setResumen(null);

    abortRef.current = new AbortController();

    try {
      const resultado = await ejecutarBusqueda({
        tipo: 'manual',
        fuenteIds: [...seleccionadas],
        onProgreso: (fuenteId, estado) =>
          setProgreso(prev => ({ ...prev, [fuenteId]: estado })),
        signal: abortRef.current.signal,
      });

      if (!resultado) {
        alert('Ya hay una búsqueda en curso. Intenta de nuevo en unos minutos.');
        return;
      }
      if (abortRef.current.signal.aborted) return; // cancelada: no se registra

      // Agrega las noticias nuevas y registra la búsqueda en el historial
      onChange(prev => fusionarResultado(prev, resultado));
      // La bitácora del servidor persiste aunque se cierre el navegador.
      fetch('/api/pep/manual', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(resultado) })
        .then(res => { if (!res.ok) console.error('No se guardó la bitácora del servidor'); })
        .catch(err => console.error('No se guardó la bitácora del servidor:', err));

      const r = resultado.registro;
      setResumen({
        total: r.fuentesConsultadas,
        encontradas: r.noticiasEncontradas,
        sinMenciones: r.sinMenciones,
        errores: r.errores,
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        setResumen({ error: 'Error inesperado al consultar las fuentes.' });
      }
    } finally {
      setCargando(false);
    }
  }

  function cancelar() {
    abortRef.current?.abort();
    setCargando(false);
    setResumen({ cancelado: true });
  }

  function estadoIcon(fuenteId) {
    const e = progreso[fuenteId];
    if (!e) return '';
    if (e === 'cargando') return '⏳';
    if (e === 'ok') return '✅';
    if (e === 'sin_menciones') return '🔵';
    if (e === 'error') return '❌';
    return '';
  }

  return (
    <div className="vista-contenedor">
      <div className="vista-header">
        <div>
          <h2 className="page-title">Catálogo de Fuentes Autorizadas</h2>
          <p className="page-sub">
            {fuentesActivas.length} fuentes activas de {FUENTES_AUTORIZADAS.length} del catálogo — Selecciona y consulta para ingerir noticias automáticamente.
            La búsqueda automática se ejecuta a las 8:00 p. m. de Guatemala mientras el servidor local esté encendido.
          </p>
        </div>
        <div className="vista-header-acciones">
          {cargando ? (
            <button className="btn-secundario" onClick={cancelar}>⛔ Cancelar</button>
          ) : (
            <button
              className="btn-agente"
              onClick={iniciarFetch}
              disabled={seleccionadas.size === 0}
            >
              🌐 Consultar {seleccionadas.size > 0 ? `(${seleccionadas.size})` : ''} fuentes
            </button>
          )}
        </div>
      </div>

      {/* Aviso académico */}
      <div className="aviso-agente" style={{ marginBottom: '1rem' }}>
        <strong>🔒 Uso académico:</strong> Solo se consultan fuentes del catálogo autorizado mediante el proxy local de la aplicación.
        No se envían datos de clientes ni información sensible. El contenido obtenido es texto público de páginas de noticias.
        Solo se agregan al corpus las noticias que contienen menciones de cargos PEP.
      </div>

      {/* Resumen de resultado */}
      {resumen && !resumen.cancelado && !resumen.error && (
        <div className="toast-exito" style={{ marginBottom: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span>✅ <strong>{resumen.encontradas}</strong> noticias con menciones PEP encontradas</span>
          <span>🔵 <strong>{resumen.sinMenciones}</strong> fuentes sin menciones PEP</span>
          <span>❌ <strong>{resumen.errores}</strong> fuentes con error de acceso</span>
        </div>
      )}
      {resumen?.cancelado && (
        <div className="aviso-agente" style={{ marginBottom: '1rem' }}>⛔ Consulta cancelada por el usuario.</div>
      )}
      {resumen?.error && (
        <div className="error-box" style={{ marginBottom: '1rem' }}>⚠ {resumen.error}</div>
      )}

      {/* Filtros de rol */}
      <div className="filtros-bar" style={{ marginBottom: '1rem' }}>
        {roles.map(r => (
          <button
            key={r}
            className={`filtro-btn ${filtroRol === r ? 'activo' : ''}`}
            onClick={() => setFiltroRol(r)}
          >
            {r}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-sm" onClick={seleccionarTodas}>Seleccionar filtradas</button>
        <button className="btn-sm" onClick={limpiarSeleccion} style={{ marginLeft: '0.5rem' }}>Limpiar</button>
      </div>

      {/* Tabla de fuentes */}
      <div className="fuentes-grid">
        {fuentesFiltradas.map(fuente => {
          const rolColor = ROLES_COLOR[fuente.rol] || { bg: '#f5f5f5', text: '#555', border: '#ccc' };
          const nivelColor = NIVEL_COLOR[fuente.nivelConfiabilidad] || { bg: '#888', text: '#fff' };
          const seleccionada = seleccionadas.has(fuente.id);
          const estado = progreso[fuente.id];

          return (
            <div
              key={fuente.id}
              className={`fuente-card ${seleccionada ? 'seleccionada' : ''}`}
              onClick={() => toggleFuente(fuente.id)}
              style={{ borderLeft: seleccionada ? '4px solid #2e6da4' : '4px solid transparent' }}
            >
              <div className="fuente-card-top">
                <div className="fuente-check">
                  <input
                    type="checkbox"
                    checked={seleccionada}
                    onChange={() => toggleFuente(fuente.id)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="fuente-id">{fuente.id}</div>
                <span className="fuente-nivel" style={{ background: nivelColor.bg, color: nivelColor.text }}>
                  {fuente.nivelConfiabilidad}
                </span>
                {estado && (
                  <span className="fuente-estado-icon" title={estado}>{estadoIcon(fuente.id)}</span>
                )}
              </div>

              <div className="fuente-nombre">{fuente.nombre}</div>

              <div className="fuente-dominio">
                <a
                  href={fuente.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="fuente-link"
                >
                  🔗 {fuente.dominio}
                </a>
              </div>

              <div className="fuente-tags">
                <span className="fuente-rol" style={{ background: rolColor.bg, color: rolColor.text, border: `1px solid ${rolColor.border}` }}>
                  {fuente.rol}
                </span>
                <span className="fuente-score-pts">
                  Score: {fuente.id === 'F-00' ? 'Regla +3/+2' : `+${fuente.puntosScore}`}
                </span>
              </div>

              <div className="fuente-justificacion">{fuente.justificacion}</div>

              {/* Barra de progreso */}
              {(cargando || estado) && seleccionada && (
                <div className={`fuente-progress-bar ${estado || 'pendiente'}`}>
                  {!estado && <span>En cola…</span>}
                  {estado === 'cargando' && <span>⏳ Consultando…</span>}
                  {estado === 'ok' && <span>✅ Noticias PEP encontradas</span>}
                  {estado === 'sin_menciones' && <span>🔵 Accesible, sin menciones PEP ahora</span>}
                  {estado === 'error' && <span>❌ No accesible (ver causa en Bitácora → Historial de búsquedas)</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
