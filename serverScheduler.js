import { FUENTES_AUTORIZADAS } from './src/data/fuentesAutorizadas.js';
import { fetchTodasLasFuentes } from './src/utils/fetcher.js';
import { readDB, recordRun } from './serverPersistence.js';
const ZONE = 'America/Guatemala';
const parts = () => {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: ZONE, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
};
let busy = false;
export async function runAutomatic() {
 const now = parts(); const db = readDB();
 if (busy || now.hour < 20 || db.ultimaAuto === now.date) return false;
 busy = true;
 try {
   const ids = FUENTES_AUTORIZADAS.filter(f => db.fuentes[f.id]?.activa !== false).map(f=>f.id);
   const inicio = new Date();
   const resultados = await fetchTodasLasFuentes(ids);
   const conNoticias = new Set(resultados.filter(x=>x.estado==='ok').map(x=>x.fuenteId));
   const sinMenciones = new Set(resultados.filter(x=>x.estado==='sin_menciones').map(x=>x.fuenteId));
   const registro = { id:`AUTO-${inicio.getTime()}`, tipo:'automatica',timestamp:inicio.toISOString(),
     fecha:new Intl.DateTimeFormat('es-GT',{timeZone:ZONE,dateStyle:'short'}).format(inicio),
     hora:new Intl.DateTimeFormat('es-GT',{timeZone:ZONE,timeStyle:'medium'}).format(inicio), fechaClave:now.date,
     fuentesConsultadas:ids.length, fuentesConNoticias:conNoticias.size,sinMenciones:sinMenciones.size,
     errores:ids.length-conNoticias.size-sinMenciones.size,noticiasEncontradas:resultados.filter(x=>x.estado==='ok').length,
     fuentesConError:resultados.filter(x=>x.estado==='error').map(x=>({id:x.fuenteId,nombre:x.fuenteNombre,error:x.errorMsg})) };
   recordRun({resultados,registro},true);
   return true;
 } catch(e) { console.error('Búsqueda automática fallida:',e); return false; }
 finally { busy = false; }
}
export function startScheduler() {
 // Revisa cada minuto y recupera la ejecución pendiente si el equipo se enciende después de las 20:00.
 const timer = setInterval(()=>{void runAutomatic()},60_000);
 void runAutomatic();
 return () => clearInterval(timer);
}
