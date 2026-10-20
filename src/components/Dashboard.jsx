import { useMemo } from 'react';

const numero = value => Number(value || 0).toLocaleString('es-GT');
const fechaLegible = registro => [registro?.fecha, registro?.hora].filter(Boolean).join(' · ') || 'Sin ejecuciones';

export default function Dashboard({ state, estadoFuentes, onCambiarVista }) {
  const busquedas = state.busquedas || [];
  const ultima = busquedas[0];
  const estadisticas = useMemo(() => ({
    clientes: state.clientes?.length || 0,
    pendientes: state.candidatos?.length || 0,
    noticias: state.noticias?.length || 0,
    ejecuciones: busquedas.length,
    errores: busquedas.reduce((total, b) => total + Number(b.errores || 0), 0),
    automaticas: busquedas.filter(b => b.tipo === 'automatica').length,
  }), [state, busquedas]);
  const indicadores = [
    { icono: '◉', etiqueta: 'Clientes registrados', valor: estadisticas.clientes, tono: 'azul', vista: 'clientes' },
    { icono: '!', etiqueta: 'Casos por revisar', valor: estadisticas.pendientes, tono: 'naranja', vista: 'bandeja' },
    { icono: '▤', etiqueta: 'Noticias recopiladas', valor: estadisticas.noticias, tono: 'verde', vista: 'noticias' },
    { icono: '↻', etiqueta: 'Búsquedas registradas', valor: estadisticas.ejecuciones, tono: 'morado', vista: 'bitacora' },
  ];
  const ultimaFuentes = Number(ultima?.fuentesConsultadas || 0);
  const ultimaExitosas = Math.max(0, ultimaFuentes - Number(ultima?.errores || 0));
  const porcentaje = ultimaFuentes ? Math.round(100 * ultimaExitosas / ultimaFuentes) : 0;
  return (
    <section className="dashboard" aria-label="Panel general de Agente PEP">
      <div className="dashboard-hero">
        <div><div className="dashboard-eyebrow">CENTRO DE MONITOREO · CUMPLIMIENTO</div>
          <h1>Panel de control</h1>
          <p>Seguimiento de fuentes, resultados y alertas de personas políticamente expuestas.</p>
          <div className="dashboard-hero-actions"><button onClick={() => onCambiarVista('fuentes')}>Consultar fuentes →</button><button className="secundario" onClick={() => onCambiarVista('bitacora')}>Ver historial</button></div>
        </div>
        <div className="dashboard-schedule"><span className="schedule-dot"/> Programación diaria <strong>20:00</strong><small>Hora de Guatemala · servidor local activo</small></div>
      </div>
      <div className="dashboard-stats">{indicadores.map(k => <button className={`dashboard-stat ${k.tono}`} key={k.etiqueta} onClick={() => onCambiarVista(k.vista)}><span className="stat-icon">{k.icono}</span><span className="stat-info"><small>{k.etiqueta}</small><strong>{numero(k.valor)}</strong><span>Ver detalle →</span></span></button>)}</div>
      <div className="dashboard-panels">
        <article className="dashboard-panel"><div className="dashboard-panel-head"><div><h2>Estado de la última búsqueda</h2><p>{fechaLegible(ultima)}</p></div><span className="dashboard-tag">{ultima?.tipo === 'automatica' ? 'Automática' : ultima ? 'Manual' : 'Sin datos'}</span></div>
          {ultima ? <><div className="dashboard-success"><strong>{porcentaje}%</strong><div><b>Fuentes sin error</b><span>{ultimaExitosas} de {ultimaFuentes} consultadas</span></div></div><div className="dashboard-progress"><span style={{width: `${porcentaje}%`}}/></div><div className="dashboard-mini-grid"><div><strong>{numero(ultima.noticiasAgregadas)}</strong><span>Noticias nuevas</span></div><div><strong>{numero(ultima.candidatosGenerados)}</strong><span>Candidatos nuevos</span></div><div><strong>{numero(ultima.errores)}</strong><span>Fuentes con error</span></div></div></> : <p className="dashboard-empty">Realiza una búsqueda para visualizar el estado de las fuentes.</p>}
        </article>
        <article className="dashboard-panel"><div className="dashboard-panel-head"><div><h2>Actividad del sistema</h2><p>Resumen de operación y auditoría</p></div></div><div className="dashboard-activity"><div><span>◷</span><div><b>Búsqueda automática</b><small>Todos los días a las 8:00 p. m. (Guatemala)</small></div></div><div><span>✓</span><div><b>Bitácora de ejecuciones</b><small>{numero(estadisticas.ejecuciones)} registros disponibles</small></div></div><div><span>↗</span><div><b>Ejecuciones automáticas registradas</b><small>{numero(estadisticas.automaticas)} en el historial actual</small></div></div><div><span>⚑</span><div><b>Errores históricos de fuentes</b><small>{numero(estadisticas.errores)} incidencias registradas</small></div></div></div><button className="dashboard-link" onClick={() => onCambiarVista('metricas')}>Abrir métricas →</button></article>
      </div>
      <p className="dashboard-footnote">Los indicadores muestran datos registrados, no verificaciones en tiempo real. Las coincidencias requieren validación humana antes de cualquier decisión.</p>
    </section>
  );
}
