export default function Metricas({ state }) {
  const { candidatos } = state;

  // Calcular matriz de confusión
  // Un candidato "es PEP real" si fue Aceptado, "no es PEP" si fue Rechazado
  // Agente dijo SÍ si score >= 4 (Media o Alta)
  // Agente dijo NO si score < 4 (Baja)

  const decididos = candidatos.filter(c => c.decision === 'Aceptado' || c.decision === 'Rechazado');
  const VP = decididos.filter(c => c.decision === 'Aceptado' && c.score >= 4).length;
  const FP = decididos.filter(c => c.decision === 'Rechazado' && c.score >= 4).length;
  const FN = decididos.filter(c => c.decision === 'Aceptado' && c.score < 4).length;
  const VN = decididos.filter(c => c.decision === 'Rechazado' && c.score < 4).length;

  const precision = (VP + FP) > 0 ? (VP / (VP + FP) * 100).toFixed(1) : null;
  const recobrado = (VP + FN) > 0 ? (VP / (VP + FN) * 100).toFixed(1) : null;

  const total = candidatos.length;
  const pendientes = candidatos.filter(c => !c.decision).length;
  const aceptados = candidatos.filter(c => c.decision === 'Aceptado').length;
  const rechazados = candidatos.filter(c => c.decision === 'Rechazado').length;
  const investigar = candidatos.filter(c => c.decision === 'Investigar').length;

  const altas = candidatos.filter(c => c.prioridad === 'Alta').length;
  const medias = candidatos.filter(c => c.prioridad === 'Media').length;
  const bajas = candidatos.filter(c => c.prioridad === 'Baja').length;

  return (
    <div className="vista-contenedor">
      <div className="vista-header">
        <div>
          <h2 className="page-title">Métricas del Conjunto de Prueba</h2>
          <p className="page-sub">El equipo mide y reporta estos valores con su propio dataset sintético.</p>
        </div>
      </div>

      {/* Stats generales */}
      <div className="metricas-grid">
        {[
          { label: 'Total candidatos', val: total, color: '#2e6da4' },
          { label: 'Alta prioridad', val: altas, color: '#c0392b' },
          { label: 'Media prioridad', val: medias, color: '#e67e22' },
          { label: 'Baja prioridad', val: bajas, color: '#27ae60' },
          { label: 'Aceptados (PEP)', val: aceptados, color: '#27ae60' },
          { label: 'Para investigar', val: investigar, color: '#2980b9' },
          { label: 'Rechazados', val: rechazados, color: '#c0392b' },
          { label: 'Pendientes', val: pendientes, color: '#888' },
        ].map(({ label, val, color }) => (
          <div key={label} className="metrica-card">
            <div className="metrica-val" style={{ color }}>{val}</div>
            <div className="metrica-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Matriz de confusión */}
      <div className="seccion-metrica">
        <h3 className="seccion-titulo">Resultados del Conjunto de Prueba</h3>
        <p className="seccion-sub">
          Basado en candidatos con decisión registrada ({decididos.length} de {total}).
          Agente dice SÍ si score ≥ 4, NO si score &lt; 4.
        </p>

        <div className="matriz-container">
          <div className="matriz-tabla">
            <div className="matriz-head-corner"></div>
            <div className="matriz-head">AGENTE: SÍ</div>
            <div className="matriz-head">AGENTE: NO</div>

            <div className="matriz-row-label">ES PEP</div>
            <div className="matriz-cell vp">
              <div className="matriz-cell-label">VP</div>
              <div className="matriz-cell-val">{VP}</div>
            </div>
            <div className="matriz-cell fn">
              <div className="matriz-cell-label">FN</div>
              <div className="matriz-cell-val">{FN}</div>
            </div>

            <div className="matriz-row-label">NO ES PEP</div>
            <div className="matriz-cell fp">
              <div className="matriz-cell-label">FP</div>
              <div className="matriz-cell-val">{FP}</div>
            </div>
            <div className="matriz-cell vn">
              <div className="matriz-cell-label">VN</div>
              <div className="matriz-cell-val">{VN}</div>
            </div>
          </div>

          <div className="matriz-formulas">
            <div className="formula-card">
              <div className="formula-nombre">Precisión</div>
              <div className="formula-expr">VP ÷ (VP + FP)</div>
              <div className="formula-val">{precision !== null ? `${precision}%` : '[ medir ]'}</div>
            </div>
            <div className="formula-card">
              <div className="formula-nombre">Recobrado</div>
              <div className="formula-expr">VP ÷ (VP + FN)</div>
              <div className="formula-val">{recobrado !== null ? `${recobrado}%` : '[ medir ]'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Limitaciones */}
      <div className="seccion-metrica">
        <h3 className="seccion-titulo">Limitaciones que el equipo debe declarar</h3>
        <div className="limitaciones-grid">
          {[
            { titulo: 'Homónimos', desc: 'Personas con el mismo nombre pero diferente identidad pueden generar falsos positivos.' },
            { titulo: 'Apodos y ortografía', desc: 'Variaciones en la escritura de nombres (tildes, abreviaciones) reducen la precisión del cruce.' },
            { titulo: 'Fuentes limitadas', desc: 'El corpus de prueba es pequeño y no representa la diversidad de fuentes reales.' },
            { titulo: 'Corpus pequeño', desc: 'Con pocos ejemplos, las métricas de precisión y recobrado no son estadísticamente representativas.' },
            { titulo: 'Sesgo de medios', desc: 'Los medios cubren más cargos nacionales que locales, generando subrepresentación de PEP locales.' },
          ].map(({ titulo, desc }) => (
            <div key={titulo} className="limitacion-card">
              <div className="limitacion-titulo">⚠ {titulo}</div>
              <div className="limitacion-desc">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pregunta del jurado */}
      <div className="jurado-box">
        <div className="jurado-icon">❓</div>
        <div>
          <div className="jurado-titulo">Pregunta del jurado</div>
          <div className="jurado-texto">¿Qué errores o sesgos puede producir el agente?</div>
          <div className="jurado-resp">Ver sección de limitaciones arriba. El equipo debe declarar estas limitaciones en la demo y explicar qué medidas mitigan cada una.</div>
        </div>
      </div>
    </div>
  );
}
