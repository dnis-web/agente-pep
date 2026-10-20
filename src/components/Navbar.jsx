export default function Navbar({ vistaActiva, onCambiarVista, pendientes, onRestablecer }) {
  const vistas = [
    { key: 'dashboard', label: '◫ Inicio', badge: null },
    { key: 'bandeja',   label: '📥 Bandeja',        badge: pendientes || null },
    { key: 'clientes',  label: '👥 Clientes',        badge: null },
    { key: 'noticias',  label: '📰 Corpus',          badge: null },
    { key: 'fuentes',   label: '🌐 Fuentes',         badge: null },
    { key: 'bitacora',  label: '📋 Bitácora',        badge: null },
    { key: 'metricas',  label: '📊 Métricas',        badge: null },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">🛡</span>
        <div>
          <div className="navbar-title">Vigía PEP</div>
          <div className="navbar-sub">Agente de Monitoreo · Datos Sintéticos</div>
        </div>
      </div>
      <div className="navbar-links">
        {vistas.map(v => (
          <button
            key={v.key}
            className={`navbar-link ${vistaActiva === v.key ? 'activa' : ''}`}
            onClick={() => onCambiarVista(v.key)}
          >
            {v.label}
            {v.badge ? <span className="navbar-badge">{v.badge}</span> : null}
          </button>
        ))}
        <button className="navbar-link navbar-reset" onClick={onRestablecer} title="Restablecer datos originales">
          🔄 Restablecer
        </button>
      </div>
    </nav>
  );
}
