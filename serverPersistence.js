import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data-runtime');
const file = path.join(dir, 'busquedas.json');
const empty = () => ({ busquedas: [], pendientes: [], fuentes: {}, ultimaAuto: null });
export function readDB() { try { return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { return empty(); } }
export function writeDB(data) { fs.mkdirSync(dir, { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, file); }
export function recordRun(resultado, auto = false) {
 const db = readDB(); const r = resultado.registro;
 if (!db.busquedas.some(x => x.id === r.id)) db.busquedas.unshift(r);
 db.busquedas = db.busquedas.slice(0, 2000);
 for (const f of resultado.resultados) {
   const s = db.fuentes[f.fuenteId] || { fallosConsecutivos: 0, activa: true };
   if (f.estado === 'error') { s.fallosConsecutivos++; s.ultimoError = f.errorMsg; }
   else { s.fallosConsecutivos = 0; s.ultimoError = null; s.ultimaRespuesta = new Date().toISOString(); }
   s.ultimoEstado = f.estado; s.activa = s.fallosConsecutivos < 3;
   db.fuentes[f.fuenteId] = s;
 }
 if (auto) { db.ultimaAuto = r.fechaClave; db.pendientes.push(resultado); db.pendientes = db.pendientes.slice(-30); }
 writeDB(db); return db;
}
// Restablecer: borra el historial y las búsquedas pendientes de importar.
// Conserva ultimaAuto (para no repetir hoy la búsqueda automática) y el estado de las fuentes.
export function resetRuns() { const db = readDB(); db.busquedas = []; db.pendientes = []; writeDB(db); return db; }
