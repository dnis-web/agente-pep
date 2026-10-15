import { useState } from 'react';
import { procesarNoticias } from '../utils/scoring';
import { buscarFuentePorDominio, FUENTES_AUTORIZADAS } from '../data/fuentesAutorizadas';

function nuevaNoticia() {
  return {
    id: `N-${Date.now()}`,
    titulo: '', fuente: '', fecha: new Date().toISOString().slice(0, 10),
    tipo: 'HTML', confiabilidad: 'media', texto: '', estado: 'manual',
  };
}

export default function Noticias({ state, onChange }) {
  const { noticias, clientes } = state;
  const [expandida, setExpandida] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  function agregarNoticia() {
    const nn = nuevaNoticia();
    onChange({ ...state, noticias: [...noticias, nn] });
    setExpandida(nn.id);
  }

  function actualizar(id, field, val) {
    onChange({ ...state, noticias: noticias.map(n => n.id === id ? { ...n, [field]: val } : n) });
  }

  function eliminar(id) {
    if (!confirm('¿Eliminar esta noticia del corpus?')) return;
    onChange({ ...state, noticias: noticias.filter(n => n.id !== id) });
  }

  function procesarTodo() {
    setProcesando(true);
    setTimeout(() => {
      const nuevos = procesarNoticias(state.noticias, clientes);
      // Conservar decisiones ya tomadas
      const existentes = state.candidatos.filter(c => c.decision);
      const sinDuplicar = nuevos.filter(n =>
        !existentes.some(e => e.noticiaId === n.noticiaId && e.clienteId === n.clienteId)
      );
      onChange({ ...state, candidatos: [...existentes, ...sinDuplicar] });
      setProcesando(false);
      setMensaje(`✓ Agente procesó ${state.noticias.length} noticias y generó ${sinDuplicar.length} nuevos candidatos.`);
      setTimeout(() => setMensaje(''), 4000);
    }, 1200);
  }

  return (
    <div className="vista-contenedor">
      <div className="vista-header">
        <div>
          <h2 className="page-title">Corpus de Noticias de Prueba</h2>
          <p className="page-sub">Noticias ficticias descargadas o simuladas. Términos de uso verificados.</p>
        </div>
        <div className="vista-header-acciones">
          <button className="btn-secundario" onClick={agregarNoticia}>+ Agregar Noticia</button>
          <button className="btn-agente" onClick={procesarTodo} disabled={procesando}>
            {procesando ? '⏳ Procesando...' : '🤖 Ejecutar Agente'}
          </button>
        </div>
      </div>

      {mensaje && <div className="toast-exito">{mensaje}</div>}

      <div className="aviso-agente">
        <strong>🤖 ¿Cómo funciona el agente?</strong> Al hacer clic en "Ejecutar Agente", el sistema cruza cada noticia del corpus con la base de clientes, calcula el score según las reglas explicables y genera candidatos PEP para revisión humana. Para ingerir noticias automáticamente desde las fuentes oficiales, ve a la pestaña <strong>🌐 Fuentes</strong>.
      </div>

      <div className="noticias-lista">
        {noticias.map(n => {
          const fuenteAuth = buscarFuentePorDominio(n.fuente);
          return (
          <div key={n.id} className="noticia-card">
            <div className="noticia-card-header" onClick={() => setExpandida(expandida === n.id ? null : n.id)}>
              <div className="noticia-card-left">
                <span className={`tipo-badge ${n.tipo}`}>{n.tipo}</span>
                <span className={`conf-badge ${n.confiabilidad}`}>{n.confiabilidad}</span>
                {fuenteAuth && (
                  <span className="fuente-autorizada-badge" title={fuenteAuth.justificacion}>
                    ✅ {fuenteAuth.id}
                  </span>
                )}
                <span className="noticia-titulo-preview">{n.titulo || <em>Sin título</em>}</span>
              </div>
              <div className="noticia-card-right">
                <span className="noticia-fuente">{n.fuente}</span>
                <span className="noticia-fecha">{n.fecha}</span>
                <button className="btn-sm btn-del" onClick={e => { e.stopPropagation(); eliminar(n.id); }}>✕</button>
                <span className="expand-icon">{expandida === n.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandida === n.id && (
              <div className="noticia-card-body">
                {fuenteAuth && (
                  <div className="fuente-auth-info">
                    <strong>📌 Fuente autorizada:</strong> {fuenteAuth.nombre} ({fuenteAuth.nivelConfiabilidad}) —&nbsp;
                    <a href={fuenteAuth.url} target="_blank" rel="noopener noreferrer">{fuenteAuth.dominio}</a>
                    <span className="fuente-auth-rol"> · {fuenteAuth.rol}</span>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Título</label>
                    <input className="form-input" value={n.titulo} onChange={e => actualizar(n.id, 'titulo', e.target.value)} placeholder="Título de la noticia" />
                  </div>
                  <div className="form-group w200">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={n.tipo} onChange={e => actualizar(n.id, 'tipo', e.target.value)}>
                      <option>TXT</option><option>PDF</option><option>HTML</option>
                    </select>
                  </div>
                  <div className="form-group w200">
                    <label className="form-label">Confiabilidad</label>
                    <select className="form-select" value={n.confiabilidad} onChange={e => actualizar(n.id, 'confiabilidad', e.target.value)}>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Fuente (dominio)</label>
                    <input
                      className="form-input"
                      value={n.fuente}
                      onChange={e => actualizar(n.id, 'fuente', e.target.value)}
                      placeholder="ej. dca.gob.gt"
                      list={`fuentes-list-${n.id}`}
                    />
                    <datalist id={`fuentes-list-${n.id}`}>
                      {FUENTES_AUTORIZADAS.map(f => (
                        <option key={f.id} value={f.dominio}>{f.nombre}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group w180">
                    <label className="form-label">Fecha</label>
                    <input className="form-input" type="date" value={n.fecha} onChange={e => actualizar(n.id, 'fecha', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Texto de la noticia</label>
                  <textarea className="form-textarea" rows={5} value={n.texto} onChange={e => actualizar(n.id, 'texto', e.target.value)} placeholder="Pega o escribe el texto completo de la noticia aquí..." />
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
