import { exportarBitacoraPDF } from '../utils/pdfExport';
import { colorDecision } from '../utils/scoring';

export default function Bitacora({ state }) {
  const { bitacora, clientes } = state;

  function handleExportar() {
    exportarBitacoraPDF(state);
  }

  return (
    <div className="vista-contenedor">
      <div className="vista-header">
        <div>
          <h2 className="page-title">Bitácora de Auditoría</h2>
          <p className="page-sub">Registro auditable de todas las decisiones humanas. Quién, cuándo, decisión y motivo.</p>
        </div>
        <button className="btn-primario" onClick={handleExportar}>📄 Exportar PDF</button>
      </div>

      {bitacora.length === 0 ? (
        <div className="empty-state">
          No hay decisiones registradas aún. Ve a la <strong>Bandeja</strong> y toma una decisión sobre algún candidato.
        </div>
      ) : (
        <div className="bitacora-lista">
          {[...bitacora].reverse().map((entrada, i) => {
            const cd = colorDecision(entrada.decision);
            // El candidato ya no está en la bandeja (se elimina al decidir),
            // por eso el cliente y el score se leen de la propia entrada.
            const cliente = clientes.find(c => c.id === entrada.clienteId);
            return (
              <div key={i} className="bitacora-entrada">
                <div className="bitacora-entrada-izq">
                  <div className="bitacora-fecha">{new Date(entrada.fecha).toLocaleDateString('es-GT')}</div>
                  <div className="bitacora-hora">{new Date(entrada.fecha).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="bitacora-linea">
                  <div className="bitacora-punto" style={{ background: cd.text }}></div>
                </div>
                <div className="bitacora-entrada-der">
                  <div className="bitacora-top">
                    <span className="bitacora-analista">{entrada.analista}</span>
                    <span className="decision-chip" style={{ background: cd.bg, color: cd.text }}>
                      {entrada.decision}
                    </span>
                    <span className="bitacora-candidato">{entrada.candidatoNombre}</span>
                  </div>
                  {entrada.motivo && (
                    <div className="bitacora-motivo">Motivo: {entrada.motivo}</div>
                  )}
                  {cliente && (
                    <div className="bitacora-cliente">
                      Cliente: {cliente.id} · {cliente.nombre}
                    </div>
                  )}
                  {entrada.score != null && (
                    <div className="bitacora-score">
                      Score {entrada.score} · {entrada.prioridad} · {entrada.cargoExtraido}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
