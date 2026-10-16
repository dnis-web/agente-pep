import { useState } from 'react';
import './Conexion.css';

/**
 * Login.jsx — Pantalla de inicio de sesión (Supabase Auth).
 * También muestra la espera y los errores de carga de datos.
 */
export default function Login({ sync }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await sync.iniciarSesion(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const marca = (
    <div className="login-marca">
      <span className="login-marca-icono">🛡</span>
      <div>
        <div className="login-titulo">Sistema PEP</div>
        <div className="login-sub">Agente de Monitoreo</div>
      </div>
    </div>
  );

  // .env.local con datos inválidos
  if (sync.errorConfiguracion) {
    return (
      <div className="login-fondo">
        <div className="login-tarjeta">
          {marca}
          <div className="login-error">Revisa el archivo .env.local: {sync.errorConfiguracion}</div>
          <p className="login-nota">
            Después de corregirlo, guarda el archivo y recarga esta página. Si borras .env.local,
            la app funciona en modo local, sin Supabase.
          </p>
        </div>
      </div>
    );
  }

  // Sesión iniciada, pero la carga de datos falló
  if (sync.errorCarga) {
    return (
      <div className="login-fondo">
        <div className="login-tarjeta">
          {marca}
          <div className="login-error">No se pudieron cargar los datos: {sync.errorCarga}</div>
          <p className="login-nota">
            Si el usuario no tiene perfil en la tabla <code>perfiles</code>, la base no le muestra datos.
          </p>
          <div className="login-acciones">
            <button className="btn-primario" onClick={sync.recargar} disabled={sync.cargando}>
              {sync.cargando ? 'Cargando…' : 'Reintentar'}
            </button>
            <button className="btn-secundario" onClick={sync.cerrarSesion}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  // Verificando la sesión o cargando datos
  if (sync.preparando) {
    return (
      <div className="login-fondo">
        <div className="login-tarjeta">
          {marca}
          <p className="login-sub">Cargando datos…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-fondo">
      <form className="login-tarjeta" onSubmit={entrar}>
        {marca}
        {error && <div className="login-error">{error}</div>}
        <div className="login-campo">
          <label className="form-label" htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="login-campo">
          <label className="form-label" htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primario login-boton" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
        <p className="login-nota">
          Los datos se guardan en la base de datos del equipo.
        </p>
      </form>
    </div>
  );
}
