# Conexión con Supabase

La app guarda sus datos en Supabase cuando existe el archivo `.env.local`. Sin él, funciona en modo local (localStorage), como antes.

## Configuración (una vez por computadora)

1. Copiar `.env.example` como `.env.local` en la raíz del proyecto.
2. Completar los dos valores con los datos de **Supabase → Project Settings → API**:
   - `VITE_SUPABASE_URL`: API URL, por ejemplo `https://abcdefgh.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: la **publishable key** (`sb_publishable_...`), o la antigua anon public key
3. `npm install` y `npm run dev`.
4. Iniciar sesión con la cuenta del equipo.

`.env.local` no se sube a GitHub (lo excluye `*.local` en `.gitignore`). Nunca usar la clave secreta (`sb_secret_...` o `service_role`) en la app: la app la rechaza.

Si un valor está mal escrito, la app muestra en pantalla qué corregir. Después de editar `.env.local`, recarga la página; si no toma el cambio, detén la app (Ctrl + C) y vuelve a ejecutar `npm run dev`.

## Qué se guarda en la base

| En la app | En Supabase |
|---|---|
| Clientes: agregar, editar, eliminar | Tabla `clientes` (1.2 s después de dejar de escribir) |
| Corpus: agregar, editar, eliminar noticias de fuentes del catálogo de la base | Tabla `noticias` (`origen = sintetico`) |
| Fuentes: noticias que trae "Consultar fuentes" | Tabla `noticias` (`origen = publica_autorizada`, con URL, fecha y texto completo) |
| Candidatos generados por "Ejecutar Agente" o al editar clientes | Tabla `candidatos` (sin duplicar) |
| Aceptar, Investigar o Rechazar en la bandeja | Tabla `bitacora`, con el correo del usuario |
| Historial de búsquedas (botón Consultar y búsqueda automática de las 8 p. m.) | Tabla `busquedas` (requiere `07_busquedas.sql`). Solo una búsqueda automática por día para todo el equipo |

## Qué queda solo en la computadora

- Noticias de fuentes que no están en la tabla `fuentes` de la base, y los candidatos y decisiones que salgan de ellas. Para que "Consultar fuentes" guarde en la base hay que ejecutar antes `06_fuentes_reales.sql`.
- Clientes con ID que no cumple el formato `CL-0000` o sin año de nacimiento: aparece un aviso.

## Comportamiento

- **Bandeja:** muestra los candidatos en estado Pendiente o En investigación. Un candidato marcado "Investigar" vuelve a aparecer al recargar, porque en la base sigue abierto.
- **Restablecer:** en modo desarrollo borra en Supabase los candidatos, la bitácora, las noticias consultadas y el registro de cambios (función `limpiar_pruebas()`), y vuelve a cargar. Afecta a todo el equipo. En modo final no borra nada: solo recarga.
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
