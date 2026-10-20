# Agente PEP — Windows / Visual Studio Code

## Inicio
1. Instalar Node.js 22.12+ (o versión compatible con Vite 8).
2. Abrir esta carpeta en Visual Studio Code y abrir **Terminal > New Terminal**.
3. Ejecutar `npm install` y luego `npm run dev`.
4. Abrir la dirección local que aparece en la terminal (normalmente http://localhost:5173).

## Búsqueda automática
El programador se ejecuta **en el proceso Node de `npm run dev`**, no en la pestaña del navegador. Revisa cada minuto si son las 20:00 o más en `America/Guatemala`. Ejecuta una vez por fecha local. Si el equipo o proceso estuvo apagado a las 20:00, ejecuta la búsqueda pendiente al volver a iniciar después de esa hora (el mismo día). Si se apagó todo el día, no reconstruye búsquedas de días anteriores.

**Importante:** Windows debe estar encendido y sin suspensión, y `npm run dev` debe seguir ejecutándose. Para un funcionamiento continuo, usar el Programador de tareas de Windows para iniciar `npm run dev` al iniciar sesión, configurando la carpeta de trabajo del proyecto. No hay garantía de ejecución a las 20:00 si el equipo está apagado, suspendido o sin Internet.

## Bitácora y fuentes
Las ejecuciones se registran en `data-runtime/busquedas.json` (archivo local persistente, excluido de Git). La vista «Historial de búsquedas» sincroniza el historial del servidor cada 30 segundos. Se guardan fecha/hora de Guatemala, tipo de búsqueda, totales y fuentes con errores.

Las fuentes con **3 errores consecutivos** se desactivan de futuras búsquedas automáticas y de la selección manual. Una respuesta sin menciones cuenta como acceso válido. No se elimina el catálogo original: los errores de red o de proxy pueden ser temporales. Para reactivar una fuente, editar `data-runtime/busquedas.json` con la aplicación detenida y establecer `activa: true` y `fallosConsecutivos: 0` para su ID.

## Limitaciones
Las consultas son de páginas públicas y pueden devolver 403, 404, 429, errores TLS, bloqueos anti-bot o páginas dinámicas. Una página accesible no garantiza que se hayan extraído noticias correctas. **No se han verificado en vivo todas las fuentes** desde este entorno; la depuración ocurre durante las ejecuciones locales y deja evidencia por fuente. La aplicación es un prototipo académico, no un motor de cumplimiento certificado. Mantener supervisión humana de coincidencias PEP.

Para publicar un build de producción hay que desplegar el backend y el programador por separado: el middleware `/api/*` funciona con `npm run dev` de Vite y no está incluido en el build estático.
