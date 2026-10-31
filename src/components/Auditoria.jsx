import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// Valores reales usados en public.bitacora de este proyecto
const DECISIONES = ['', 'Aceptado', 'Rechazado', 'Investigar más'];

const FMT_FECHA = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Guatemala',
});
const FMT_HORA = new Intl.DateTimeFormat('es-GT', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Guatemala',
});

function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : FMT_FECHA.format(d);
}
function formatHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : FMT_HORA.format(d);
}

function badgeDecision(decision) {
  const mapa = {
    'aceptado':       { bg: '#d1fae5', color: '#065f46' },
    'rechazado':      { bg: '#fee2e2', color: '#991b1b' },
    'investigar más': { bg: '#ede9fe', color: '#4c1d95' },
    'investigar':     { bg: '#ede9fe', color: '#4c1d95' },
    'pendiente':      { bg: '#fef3c7', color: '#92400e' },
  };
  return mapa[(decision || '').toLowerCase()] || { bg: '#f1f5f9', color: '#475569' };
}

// ── Modal Snapshot ────────────────────────────────────────────────────────────

function ModalSnapshot({ registro, onClose }) {
  if (!registro) return null;
  const snap = registro.snapshot;
  const json = snap ? JSON.stringify(snap, null, 2) : 'Sin snapshot disponible.';
  return (
    <div className="auditoria-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auditoria-modal" onClick={e => e.stopPropagation()}>
        <div className="auditoria-modal-header">
          <div>
            <h3 className="auditoria-modal-titulo">Snapshot del registro</h3>
            <p className="auditoria-modal-sub">
              Candidato: <strong>{registro.candidato_id}</strong>
              {' · '}{formatFecha(registro.fecha_hora)} {formatHora(registro.fecha_hora)}
            </p>
          </div>
          <button className="auditoria-modal-cerrar" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="auditoria-modal-body">
          <pre className="auditoria-snapshot-pre">{json}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Auditoria() {
  const [registros,   setRegistros]   = useState([]);
  const [total,       setTotal]       = useState(0);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState(null);

  const [filtroCandidato, setFiltroCandidato] = useState('');
  const [filtroDecision,  setFiltroDecision]  = useState('');
  const [filtroDesde,     setFiltroDesde]     = useState('');
  const [filtroHasta,     setFiltroHasta]     = useState('');
  const [pagina,          setPagina]          = useState(1);
  const [registroModal,   setRegistroModal]   = useState(null);

  const fetchRegistros = useCallback(async () => {
    if (!supabase) {
      setError('Supabase no está configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const desde = (pagina - 1) * PAGE_SIZE;
      const hasta = desde + PAGE_SIZE - 1;

      let query = supabase
        .from('bitacora')
        .select('id, candidato_id, decision, motivo, analista_id, fecha_hora, snapshot', { count: 'exact' })
        .order('fecha_hora', { ascending: false })
        .range(desde, hasta);

      if (filtroCandidato.trim()) query = query.ilike('candidato_id', `%${filtroCandidato.trim()}%`);
      if (filtroDecision)         query = query.eq('decision', filtroDecision);
      if (filtroDesde)            query = query.gte('fecha_hora', new Date(filtroDesde).toISOString());
      if (filtroHasta) {
        const h = new Date(filtroHasta);
        h.setHours(23, 59, 59, 999);
        query = query.lte('fecha_hora', h.toISOString());
      }

      const { data, error: sbError, count } = await query;

      if (sbError) {
        setError(sbError.message || 'Error al consultar la bitácora.');
        setRegistros([]); setTotal(0);
        return;
      }
      setRegistros(data || []);
      setTotal(count ?? 0);
    } catch (e) {
      setError('Error de conexión: ' + e.message);
      setRegistros([]); setTotal(0);
    } finally {
      setCargando(false);
    }
  }, [pagina, filtroCandidato, filtroDecision, filtroDesde, filtroHasta]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  function aplicarFiltros() { setPagina(1); }
  function limpiarFiltros() {
    setFiltroCandidato(''); setFiltroDecision('');
    setFiltroDesde(''); setFiltroHasta(''); setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hayFiltros = filtroCandidato.trim() || filtroDecision || filtroDesde || filtroHasta;

  return (
    <div className="vista-contenedor">

      {/* Encabezado */}
      <div className="vista-header">
        <div>
          <h2 className="page-title">🔍 Auditoría</h2>
          <p className="page-sub">
            Registros en <code>public.bitacora</code> · Supabase
            {total > 0 && !cargando && (
              <span className="auditoria-total-badge">{total} registro{total !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <button className="btn-secundario" onClick={fetchRegistros} disabled={cargando}>
          {cargando ? '⏳ Cargando…' : '🔄 Recargar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="auditoria-filtros">
        <div className="auditoria-filtro-grupo">
          <label className="auditoria-filtro-label" htmlFor="f-candidato">Candidato</label>
          <input
            id="f-candidato" type="text" className="auditoria-filtro-input"
            placeholder="Nombre o ID…" value={filtroCandidato}
            onChange={e => setFiltroCandidato(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>
        <div className="auditoria-filtro-grupo">
          <label className="auditoria-filtro-label" htmlFor="f-decision">Decisión</label>
          <select id="f-decision" className="auditoria-filtro-input"
            value={filtroDecision}
            onChange={e => { setFiltroDecision(e.target.value); setPagina(1); }}>
            {DECISIONES.map(d => <option key={d} value={d}>{d || 'Todas'}</option>)}
          </select>
        </div>
        <div className="auditoria-filtro-grupo">
          <label className="auditoria-filtro-label" htmlFor="f-desde">Desde</label>
          <input id="f-desde" type="date" className="auditoria-filtro-input"
            value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPagina(1); }} />
        </div>
        <div className="auditoria-filtro-grupo">
          <label className="auditoria-filtro-label" htmlFor="f-hasta">Hasta</label>
          <input id="f-hasta" type="date" className="auditoria-filtro-input"
            value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPagina(1); }} />
        </div>
        <div className="auditoria-filtro-acciones">
          <button className="btn-primario" onClick={aplicarFiltros} disabled={cargando}>Buscar</button>
          {hayFiltros && (
            <button className="btn-secundario" onClick={limpiarFiltros} disabled={cargando}>✕ Limpiar</button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="auditoria-error" role="alert">
          <strong>Error:</strong> {error}
          <p className="auditoria-error-hint">
            Verifica que las políticas RLS de <code>public.bitacora</code> permitan
            SELECT al rol del usuario autenticado.
          </p>
          <button className="btn-secundario" onClick={fetchRegistros} style={{ marginTop: 8 }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Cargando */}
      {cargando && (
        <div className="auditoria-cargando" role="status">
          <div className="auditoria-spinner" aria-hidden="true" />
          <span>Consultando <code>public.bitacora</code>…</span>
        </div>
      )}

      {/* Vacío */}
      {!cargando && !error && registros.length === 0 && (
        <div className="empty-state">
          {hayFiltros
            ? 'No se encontraron registros con los filtros aplicados.'
            : 'La tabla public.bitacora no contiene registros aún.'}
        </div>
      )}

      {/* Tabla */}
      {!cargando && !error && registros.length > 0 && (
        <>
          <div className="auditoria-tabla-wrapper">
            <table className="auditoria-tabla" aria-label="Registros de auditoría">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Candidato ID</th>
                  <th scope="col">Decisión</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Analista</th>
                  <th scope="col" className="auditoria-col-accion">Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(reg => {
                  const badge = badgeDecision(reg.decision);
                  return (
                    <tr key={reg.id} className="auditoria-fila">
                      <td className="auditoria-fecha">{formatFecha(reg.fecha_hora)}</td>
                      <td className="auditoria-hora">{formatHora(reg.fecha_hora)}</td>
                      <td className="auditoria-candidato" title={reg.candidato_id}>
                        {reg.candidato_id || '—'}
                      </td>
                      <td>
                        <span className="decision-chip" style={{ background: badge.bg, color: badge.color }}>
                          {reg.decision || '—'}
                        </span>
                      </td>
                      <td className="auditoria-motivo" title={reg.motivo}>
                        {reg.motivo
                          ? reg.motivo.length > 80 ? reg.motivo.slice(0, 80) + '…' : reg.motivo
                          : '—'}
                      </td>
                      <td className="auditoria-analista" title={reg.analista_id}>
                        {reg.analista_id || '—'}
                      </td>
                      <td className="auditoria-col-accion">
                        {reg.snapshot
                          ? <button className="auditoria-btn-snapshot"
                              onClick={() => setRegistroModal(reg)}
                              aria-label={`Ver snapshot de ${reg.candidato_id}`}>{'{ }'}</button>
                          : <span className="auditoria-sin-snapshot">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="auditoria-paginacion" role="navigation" aria-label="Paginación">
              <button className="auditoria-pag-btn" onClick={() => setPagina(1)} disabled={pagina === 1}>«</button>
              <button className="auditoria-pag-btn" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>‹</button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(n => Math.abs(n - pagina) <= 2)
                .map(n => (
                  <button key={n} className={`auditoria-pag-btn ${n === pagina ? 'activa' : ''}`}
                    onClick={() => setPagina(n)} aria-current={n === pagina ? 'page' : undefined}>
                    {n}
                  </button>
                ))}
              <button className="auditoria-pag-btn" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>›</button>
              <button className="auditoria-pag-btn" onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas}>»</button>
              <span className="auditoria-pag-info">Página {pagina} de {totalPaginas} · {total} registros</span>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {registroModal && <ModalSnapshot registro={registroModal} onClose={() => setRegistroModal(null)} />}
    </div>
  );
}
