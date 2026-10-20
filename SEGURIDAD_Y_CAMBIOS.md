# Agente PEP — versión revisada

Esta entrega se reconstruyó desde `agente-pep-fuentes-depuradas.zip`, incorporando exclusivamente los componentes visuales modificados. No se copiaron los archivos `index.html` ni `serverScheduler.js` del ZIP que Windows Defender bloqueó: se conservaron los de la versión anterior.

## Mejoras
- Dashboard con indicadores y accesos rápidos.
- Historial filtrable y exportación CSV con mitigación de inyección de fórmulas en hojas de cálculo.
- Vista de seguimiento de la última búsqueda.
- Nueve fuentes del catálogo depurado.
- Se conserva la programación local a las 20:00, mientras `npm run dev` permanezca activo.
- Vite limitado a 127.0.0.1 y verificación básica de Origin para registro manual.

## Límites de seguridad
La inspección estática y la compilación no sustituyen un análisis antivirus. No se puede garantizar ausencia de malware. Mantén Windows Defender activo; si bloquea esta versión, no fuerces su ejecución. No incluye `node_modules`, ejecutables, ni scripts de PowerShell.

## Instalación
1. Haz copia de seguridad de tu proyecto actual, especialmente `data-runtime`.
2. Extrae en carpeta nueva.
3. En Windows, ejecuta `npm ci` y luego `npm run dev`.
4. Visita `http://127.0.0.1:5173/`.

El historial persistente de la instalación anterior no se transfiere automáticamente. Para conservarlo, copia la carpeta `data-runtime` desde tu instalación previa tras revisar su contenido.
