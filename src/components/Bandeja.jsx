import { useState } from 'react';
import { colorPrioridad, colorDecision } from '../utils/scoring';

const FILTROS = ['TODOS', 'Alta', 'Media', 'Baja', 'Pendientes'];

export default function Bandeja({ state, onDecision }) {
  const { candidatos, clientes, noticias } = state;
  const [filtro, setFiltro] = useState('TODOS');
  const [seleccionado, setSeleccionado] = useState(null);
  const [motivo, setMotivo] = useState('');

  const candidatosFiltrados = candidatos.filter(c => {
    if (filtro === 'TODOS') return true;
    if (filtro === 'Pendientes') return !c.decision;
    return c.prioridad === filtro;
  });

  const conteo = {
    TODOS: candidatos.length,
    Alta: candidatos.filter(c => c.prioridad === 'Alta').length,
    Media: candidatos.filter(c => c.prioridad === 'Media').length,
    Baja: candidatos.filter(c => c.prioridad === 'Baja').length,
    Pendientes: candidatos.filter(c => !c.decision).length,
  };

  function handleDecision(candidatoId, decision) {
    if (!motivo.trim()) {
      alert('Por favor escribe un motivo antes de registrar la decisión.');
      return;
    }
    onDecision(candidatoId, decision, motivo);
    setMotivo('');
    setSeleccionado(null);
  }

  const cand = seleccionado ? candidatos.find(c => c.id === seleccionado) : null;
  const cliente = cand ? clientes.find(c => c.id === cand.clienteId) : null;
  const noticia = cand ? noticias.find(n => n.id === cand.noticiaId) : null;

  return (
    <div className="bandeja-layout">
      {/* Lista */}
      <div className="bandeja-lista">
        <div className="bandeja-header">
          <h2 className="page-title">Bandeja de Revisión PEP</h2>
          <p className="page-sub">Corpus de prueba · Datos sintéticos · {new Date().toLocaleDateString('es-GT')}</p>
        </div>

        <div className="filtros-bar">
          {FILTROS.map(f => (
            <button
              key={f}
              className={`filtro-btn ${filtro === f ? 'activo' : ''}`}
              onClick={() => setFiltro(f)}
            >
              {f} <span className="filtro-count">{conteo[f]}</span>
            </button>
          ))}
        </div>

        {candidatosFiltrados.length === 0 && (
          <div className="empty-state">No hay candidatos en esta categoría.</div>
        )}

        <div className="candidatos-lista">
          {candidatosFiltrados.map(c => {
            const cl = clientes.find(x => x.id === c.clienteId);
            const cp = colorPrioridad(c.prioridad);
            const cd = colorDecision(c.decision);
            return (
              <div
                key={c.id}
                className={`candidato-card ${seleccionado === c.id ? 'seleccionado' : ''}`}
                onClick={() => { setSeleccionado(c.id); setMotivo(''); }}
                style={{ borderLeft: `4px solid ${cp.border}` }}
              >
                <div className="candidato-card-top">
                  <span className="prioridad-badge" style={{ background: cp.bg, color: cp.text, border: `1px solid ${cp.border}` }}>
                    {c.prioridad}
                  </span>
                  <span className="candidato-nombre">{c.nombreExtraido}</span>
                  <span className="candidato-score">Score {c.score}</span>
                </div>
                <div className="candidato-card-mid">
                  <span className="candidato-cargo">🏛 {c.cargoExtraido}</span>
                  <span className="candidato-evento">· {c.evento}</span>
                </div>
                <div className="candidato-card-bot">
                  <span className="candidato-cliente">👤 {cl?.nombre} ({c.clienteId})</span>
                  {c.decision && (
                    <span className="decision-chip" style={{ background: cd.bg, color: cd.text }}>
                      {c.decision}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel de detalle */}
      <div className="bandeja-detalle">
        {!cand ? (
          <div className="detalle-placeholder">
            <div className="detalle-placeholder-icon">👆</div>
            <div>Selecciona un candidato para ver la evidencia y tomar una decisión.</div>
          </div>
        ) : (
          <div className="detalle-contenido">
            {/* Cabecera */}
            <div className="detalle-header" style={{ borderBottom: `3px solid ${colorPrioridad(cand.prioridad).border}` }}>
              <div className="detalle-header-top">
                <span className="prioridad-badge lg" style={{
                  background: colorPrioridad(cand.prioridad).bg,
                  color: colorPrioridad(cand.prioridad).text,
                  border: `1px solid ${colorPrioridad(cand.prioridad).border}`
                }}>
                  {cand.prioridad}
                </span>
                <span className="detalle-score">Score {cand.score}</span>
              </div>
              <h3 className="detalle-nombre">{cand.nombreExtraido}</h3>
              <div className="detalle-cargo">{cand.cargoExtraido}</div>
              <div className="detalle-evento">{cand.evento} · {cand.fecha}</div>
            </div>

            {/* Fuente y fragmento */}
            <div className="detalle-seccion">
              <div className="detalle-seccion-titulo">📄 Fuente y Fragmento</div>
              <div className="detalle-fuente">{cand.fuente}</div>
              {noticia && <div className="detalle-noticia-titulo">"{noticia.titulo}"</div>}
              <div className="detalle-fragmento">"{cand.fragmento}"</div>
            </div>

            {/* Por qué es candidato */}
            <div className="detalle-seccion">
              <div className="detalle-seccion-titulo">🔍 Por qué es candidato</div>
              <p className="detalle-porq">{cand.porQue}</p>
              <div className="detalle-homonimo">
                Riesgo de homónimo:
                <span className={`homonimo-badge ${cand.riesgoHomonimo}`}>{cand.riesgoHomonimo}</span>
              </div>
            </div>

            {/* Score detalle */}
            <div className="detalle-seccion">
              <div className="detalle-seccion-titulo">📊 Desglose del Score</div>
              <div className="score-grid">
                {[
                  ['Nombre completo', cand.scoreDetalle.nombreCompleto, '+3'],
                  ['Nombre parcial', cand.scoreDetalle.nombreParcial, '+1'],
                  ['Cargo alto nivel', cand.scoreDetalle.cargoAltoNivel, '+3'],
                  ['Cargo local', cand.scoreDetalle.cargoLocal, '+1'],
                  ['Fuente confiable', cand.scoreDetalle.fuenteConfiable, '+1'],
                  ['Noticia reciente', cand.scoreDetalle.noticiaReciente, '+1'],
                  ['Dato confirma', cand.scoreDetalle.datoConfirma, '+2'],
                  ['Datos contradictorios', cand.scoreDetalle.datosContradictorios, '-4'],
                ].map(([label, val, max]) => (
                  <div key={label} className={`score-item ${val !== 0 ? 'activo' : ''} ${val < 0 ? 'negativo' : ''}`}>
                    <span className="score-item-val">{val > 0 ? `+${val}` : val}</span>
                    <span className="score-item-label">{label}</span>
                    <span className="score-item-max">{max}</span>
                  </div>
                ))}
                <div className="score-total">
                  <span>TOTAL</span>
                  <span className="score-total-val">{cand.score}</span>
                </div>
              </div>
            </div>

            {/* Cliente relacionado */}
            <div className="detalle-seccion">
              <div className="detalle-seccion-titulo">👤 Cliente Relacionado</div>
              <div className="cliente-info">
                <div><strong>{cliente?.id}</strong> · {cliente?.nombre}</div>
                <div>Nacimiento: {cliente?.nacimiento} · País: {cliente?.pais} · {cliente?.profesion}</div>
              </div>
            </div>

            {/* Decisión */}
            <div className="detalle-seccion">
              <div className="detalle-seccion-titulo">⚖️ Decisión Humana</div>
              {cand.decision ? (
                <div className="decision-registrada" style={{
                  background: colorDecision(cand.decision).bg,
                  color: colorDecision(cand.decision).text
                }}>
                  <div className="decision-registrada-titulo">{cand.decision}</div>
                  <div className="decision-registrada-meta">{cand.analista} · {cand.fechaDecision ? new Date(cand.fechaDecision).toLocaleString('es-GT') : ''}</div>
                  {cand.motivoDecision && <div className="decision-registrada-motivo">Motivo: {cand.motivoDecision}</div>}
                </div>
              ) : (
                <div className="decision-form">
                  <p className="decision-aviso">Nada se clasifica sin decisión humana.</p>
                  <textarea
                    className="decision-motivo-input"
                    placeholder="Escribe el motivo de tu decisión antes de seleccionar una acción..."
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    rows={3}
                  />
                  <div className="decision-botones">
                    <button className="btn-aceptar" onClick={() => handleDecision(cand.id, 'Aceptado')}>
                      ✓ Aceptar
                    </button>
                    <button className="btn-investigar" onClick={() => handleDecision(cand.id, 'Investigar')}>
                      🔎 Investigar más
                    </button>
                    <button className="btn-rechazar" onClick={() => handleDecision(cand.id, 'Rechazado')}>
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
