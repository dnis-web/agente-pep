# Conexión con Supabase

La app guarda sus datos en Supabase cuando existe el archivo `.env.local`. Sin él, funciona en modo local (localStorage), como antes.

## Configuración (una vez por computadora)

1. Copiar `.env.example` como `.env.local` en la raíz del proyecto.
2. Completar los dos valores con los datos de **Supabase → Project Settings → API**:
   - `VITE_SUPABASE_URL`: Project URL
   - `VITE_SUPABASE_ANON_KEY`: anon public key
3. `npm install` y `npm run dev`.
4. Iniciar sesión con la cuenta del equipo.

`.env.local` no se sube a GitHub (lo excluye `*.local` en `.gitignore`). Nunca usar la clave `service_role` en la app.

## Qué se guarda en la base

| En la app | En Supabase |
|---|---|
| Clientes: agregar, editar, eliminar | Tabla `clientes` (1.2 s después de dejar de escribir) |
| Corpus: agregar, editar, eliminar noticias de fuentes del catálogo de la base | Tabla `noticias` |
| Candidatos generados por "Ejecutar Agente" o al editar clientes | Tabla `candidatos` (sin duplicar) |
| Aceptar, Investigar o Rechazar en la bandeja | Tabla `bitacora`, con el correo del usuario |

## Qué queda solo en la computadora

- Noticias de fuentes que no están en la tabla `fuentes` de la base (por ejemplo, las del botón "Consultar fuentes"), y los candidatos y decisiones que salgan de ellas.
- Clientes con ID que no cumple el formato `CL-0000` o sin año de nacimiento: aparece un aviso.

## Comportamiento

- **Bandeja:** muestra los candidatos en estado Pendiente o En investigación. Un candidato marcado "Investigar" vuelve a aparecer al recargar, porque en la base sigue abierto.
- **Restablecer:** limpia la vista local y vuelve a cargar los datos de la base. No borra nada en Supabase.
- **Indicador (abajo a la izquierda):** usuario, último mensaje (verde: guardado; naranja: aviso; rojo: error), recargar y salir.
- **Varias personas a la vez:** cada una ve los cambios de las demás al presionar "↻ Recargar".

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/lib/supabase.js` | Cliente de conexión |
| `src/utils/basedatos.js` | Lectura y escritura; traduce nombres de campos (app ↔ base) |
| `src/utils/useSincronizacion.js` | Sesión, carga inicial y guardado automático |
| `src/components/Login.jsx` | Pantalla de inicio de sesión |
| `src/components/EstadoConexion.jsx` | Indicador de conexión |
| `src/App.jsx` | Solo enlaces a lo anterior; la lógica existente no cambió |
