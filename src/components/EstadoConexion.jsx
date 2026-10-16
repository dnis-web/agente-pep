import './Conexion.css';

/**
 * EstadoConexion.jsx — Indicador fijo (esquina inferior izquierda) del estado
 * de la conexión con Supabase: usuario, último mensaje, recargar y salir.
 */
export default function EstadoConexion({ sync }) {
  if (!sync.conectado) return null;
  const tipo = sync.aviso?.tipo || 'ok';
  const mensaje = sync.aviso?.texto || 'Conectado';

  return (
    <div className={`conexion-estado ${tipo}`} role="status" title={mensaje}>
      <span className="conexion-punto" />
      <span className="conexion-texto">
        <strong>Supabase</strong>
        <span className="conexion-usuario"> · {sync.usuario}</span>
        <span className="conexion-mensaje"> · {mensaje}</span>
      </span>
      <button className="conexion-boton" onClick={sync.recargar} disabled={sync.cargando}>
        {sync.cargando ? '…' : '↻ Recargar'}
      </button>
      <button className="conexion-boton" onClick={sync.cerrarSesion}>Salir</button>
    </div>
  );
}
