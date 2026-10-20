import { useMemo, useState } from 'react';

const columnas = ['Fecha', 'Hora', 'Tipo', 'Fuentes', 'Con noticias', 'Sin menciones', 'Con error', 'Noticias nuevas', 'Candidatos nuevos', 'Fuentes con error'];
const csvCell = valor => {
  const raw = String(valor ?? '');
  const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};
export default function BitacoraBusquedas({ busquedas = [] }) {
  const [tipo, setTipo] = useState('todas');
  const [texto, setTexto] = useState('');
  const [soloErrores, setSoloErrores] = useState(false);
  const filtradas = useMemo(() => busquedas.filter(b => {
    if (tipo !== 'todas' && b.tipo !== tipo) return false;
    if (soloErrores && !Number(b.errores)) return false;
    return `${b.fecha} ${b.hora} ${(b.fuentesConError || []).map(f => f.id).join(' ')}`.toLowerCase().includes(texto.trim().toLowerCase());
  }), [busquedas, tipo, texto, soloErrores]);
  function exportar() {
    const filas = filtradas.map(b => [b.fecha, b.hora, b.tipo, b.fuentesConsultadas, b.fuentesConNoticias, b.sinMenciones, b.errores, b.noticiasAgregadas ?? 0, b.candidatosGenerados ?? 0, (b.fuentesConError || []).map(f => f.id).join('; ')]);
    const contenido = '\uFEFF' + [columnas, ...filas].map(f => f.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `bitacora-pep-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="vista-contenedor historial-mejorado"><div className="vista-header"><div><h2 className="page-title">Historial de búsquedas</h2><p className="page-sub">Auditoría de consultas manuales y automáticas · Horario Guatemala</p></div><button className="btn-primario" disabled={!filtradas.length} onClick={exportar}>↓ Exportar CSV</button></div>
    <div className="historial-toolbar"><input className="form-input" aria-label="Buscar en historial" placeholder="Buscar fecha, hora o fuente (ej. F-02)" value={texto} onChange={e => setTexto(e.target.value)} /><select className="form-select" aria-label="Filtrar tipo de búsqueda" value={tipo} onChange={e => setTipo(e.target.value)}><option value="todas">Todas las búsquedas</option><option value="manual">Manuales</option><option value="automatica">Automáticas</option></select><label className="historial-check"><input type="checkbox" checked={soloErrores} onChange={e => setSoloErrores(e.target.checked)}/> Solo con errores</label></div>
    <p className="historial-count">Mostrando {filtradas.length} de {busquedas.length} registros</p>
    {filtradas.length === 0 ? <div className="empty-state">No hay registros que coincidan con los filtros.</div> : <div className="historial-scroll"><table className="historial-tabla"><thead><tr>{columnas.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{filtradas.map(b => <tr key={b.id}><td>{b.fecha}</td><td>{b.hora}</td><td><span className={`historial-tipo ${b.tipo === 'automatica' ? 'auto' : ''}`}>{b.tipo === 'automatica' ? '◷ Automática' : '◉ Manual'}</span></td><td>{b.fuentesConsultadas}</td><td>{b.fuentesConNoticias}</td><td>{b.sinMenciones}</td><td><span className={Number(b.errores) ? 'historial-error' : 'historial-ok'}>{b.errores}</span></td><td>{b.noticiasAgregadas ?? 0}</td><td>{b.candidatosGenerados ?? 0}</td><td className="historial-fuentes" title={(b.fuentesConError || []).map(f => `${f.id}: ${f.error}`).join('\n')}>{(b.fuentesConError || []).map(f => f.id).join(', ') || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
