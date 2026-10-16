import './Conexion.css';

/**
 * EstadoConexion.jsx — Indicador fijo (esquina inferior izquierda) del estado
 * de la conexión con Supabase: usuario, último mensaje, recargar y salir.
 */
export default function EstadoConexion({ sync }) {
  if (!sync.conectado) return null;
  const tipo = sync.aviso?.tipo || 'ok';
  // Solo se muestran avisos y errores; los mensajes de éxito no ocupan espacio.
  const mensaje = tipo === 'ok' ? '' : sync.aviso?.texto || '';

  return (
    <div className={`conexion-estado ${tipo}`} role="status" title={mensaje || sync.aviso?.texto || 'Conectado'}>
      <span className="conexion-punto" />
      <span className="conexion-texto">
        <span className="conexion-usuario">{sync.usuario}</span>
        {mensaje && <span className="conexion-mensaje"> · {mensaje}</span>}
      </span>
      <button className="conexion-boton" onClick={sync.recargar} disabled={sync.cargando}>
        {sync.cargando ? '…' : '↻ Recargar'}
      </button>
      <button className="conexion-boton" onClick={sync.cerrarSesion}>Salir</button>
    </div>
  );
}
