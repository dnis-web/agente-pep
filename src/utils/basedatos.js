/**
 * basedatos.js — Lectura y escritura en Supabase.
 *
 * Traduce entre los objetos que usa la app (camelCase, p. ej. nombreExtraido)
 * y las columnas de la base (snake_case, p. ej. nombre_extraido).
 * No contiene lógica de negocio: el score y la generación de candidatos
 * siguen en scoring.js y App.jsx.
 */
import { supabase } from '../lib/supabase';

export const ESTADOS_ABIERTOS = ['Pendiente', 'En investigación'];

// ── Utilidades ───────────────────────────────────────────────────────────────

function anio(fecha) {
  return fecha ? Number(String(fecha).slice(0, 4)) : '';
}

function paisDesdeNacionalidad(nacionalidad) {
  return nacionalidad === 'Guatemalteca' ? 'GT' : (nacionalidad || '');
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/** Clave natural de un candidato: misma noticia, mismo cliente, mismo nombre. */
export function claveCandidato(c) {
  return `${c.noticiaId}|${c.clienteId || ''}|${(c.nombreExtraido || '').trim()}`;
}

// Mensajes claros para las reglas de la base de datos (nombre de la regla → explicación)
const MENSAJES_REGLAS = {
  bitacora_motivo_check: 'El motivo debe tener al menos 10 caracteres.',
  candidatos_fragmento_check: 'El fragmento de evidencia debe tener al menos 10 caracteres.',
  prioridad_segun_score: 'La prioridad no corresponde al score (7 o más: Alta; 4 a 6: Media; 3 o menos: Baja).',
  score_igual_a_desglose: 'El score no coincide con la suma de su desglose.',
  candidatos_noticia_id_fkey: 'La noticia del candidato no existe en la base.',
  candidatos_cliente_id_fkey: 'El cliente del candidato no existe en la base.',
  candidatos_evento_check: 'El evento no es válido (Nombramiento, Cambio de cargo, Remoción, Elección, Posible homónimo u Otro).',
  candidatos_riesgo_homonimo_check: 'El riesgo de homónimo debe ser alto, medio o bajo.',
  clientes_id_check: 'El ID del cliente debe tener el formato CL-0000.',
  noticias_id_check: 'El ID de la noticia no tiene un formato válido (N-000 o el que genera Consultar fuentes).',
};

/** Traduce un error de la base a un mensaje en español. */
export function mensajeError(error) {
  const texto = error?.message || String(error || '');
  const regla = Object.keys(MENSAJES_REGLAS).find(r => texto.includes(r));
  if (regla) return MENSAJES_REGLAS[regla];
  if (/row-level security/i.test(texto)) return 'Tu usuario no tiene permiso para esta acción (revisa su perfil en la tabla perfiles).';
  if (/duplicate key/i.test(texto)) return 'Ese registro ya existe en la base.';
  if (/Failed to fetch|NetworkError|network/i.test(texto)) return 'No hay conexión con Supabase. Revisa tu internet o si el proyecto está pausado.';
  if (/JWT|session/i.test(texto)) return 'La sesión expiró. Cierra sesión y vuelve a entrar.';
  return texto;
}

function verificar({ data, error }, que) {
  if (error) throw new Error(`${que}: ${mensajeError(error)}`);
  return data;
}

// ── Base de datos → app ──────────────────────────────────────────────────────

export function clienteDesdeBD(r) {
  return {
    id: r.id,
    nombre: r.nombre_completo,
    nacimiento: anio(r.fecha_nacimiento),
    pais: paisDesdeNacionalidad(r.nacionalidad),
    profesion: r.ocupacion || '',
    departamento: r.departamento,
    // Datos completos de la base, para no perderlos al guardar cambios
    _bd: {
      fecha_nacimiento: r.fecha_nacimiento,
      departamento: r.departamento,
      nacionalidad: r.nacionalidad,
      fecha_alta: r.fecha_alta,
    },
  };
}

export function noticiaDesdeBD(r) {
  const f = r.fuentes || {};
  return {
    id: r.id,
    titulo: r.titulo,
    fuente: f.dominio || '',
    fuenteId: f.id || r.fuente_id,
    fuenteNombre: f.nombre || '',
    url: r.url,
    fecha: r.fecha_publicacion,
    tipo: r.origen === 'publica_autorizada' ? 'HTML' : 'TXT',
    confiabilidad: (f.confiabilidad || 'media').toLowerCase(),
    texto: r.texto,
    ...(r.texto_completo ? { textoCompleto: r.texto_completo } : {}),
    // 'ok' = consultada en una fuente real (como la deja fetcher.js); 'sintético' = corpus de prueba
    estado: r.origen === 'publica_autorizada' ? 'ok' : 'sintético',
    _bd: true,
  };
}

export function candidatoDesdeBD(r) {
  const n = r.noticias || {};
  return {
    id: r.id,
    noticiaId: r.noticia_id,
    clienteId: r.cliente_id || '',
    nombreExtraido: r.nombre_extraido,
    cargoExtraido: r.cargo_extraido,
    institucion: r.institucion || '',
    evento: r.evento,
    pais: r.pais || '',
    fecha: n.fecha_publicacion || '',
    fuente: n.fuentes?.dominio || '',
    fragmento: r.fragmento,
    porQue: r.por_que || '',
    riesgoHomonimo: r.riesgo_homonimo,
    scoreDetalle: r.score_detalle || {},
    score: r.score,
    prioridad: r.prioridad,
    estadoBD: r.estado,
    decision: null,
    motivoDecision: '',
    analista: '',
    fechaDecision: null,
  };
}

export function bitacoraDesdeBD(r) {
  const s = r.snapshot || {};
  return {
    candidatoId: r.candidato_id,
    candidatoNombre: s.nombre_extraido || r.candidato_id,
    cargoExtraido: s.cargo_extraido || '',
    clienteId: s.cliente_id || '',
    noticiaId: s.noticia_id || '',
    score: s.score ?? null,
    prioridad: s.prioridad || '',
    decision: r.decision,
    motivo: r.motivo,
    analista: r.analista_email || '',
    fecha: r.fecha_hora,
    _bdId: r.id,
  };
}

// ── App → base de datos (devuelven { fila } o { error }) ─────────────────────

export function clienteHaciaBD(c) {
  if (!/^CL-[0-9]{4}$/.test(c.id || '')) {
    return { error: `El cliente ${c.id} no se guardó: el ID debe tener el formato CL-0000.` };
  }
  const nombre = (c.nombre || '').trim();
  if (!nombre) return { error: null }; // aún vacío: se guardará cuando tenga nombre

  const bd = c._bd || {};
  const year = Number(c.nacimiento);
  let fechaNacimiento;
  if (bd.fecha_nacimiento && anio(bd.fecha_nacimiento) === year) {
    fechaNacimiento = bd.fecha_nacimiento;
  } else if (year >= 1900 && year <= new Date().getFullYear()) {
    fechaNacimiento = `${year}-01-01`;
  } else {
    return { error: `El cliente ${c.id} no se guardó: falta un año de nacimiento válido.` };
  }

  const nacionalidad = bd.nacionalidad && paisDesdeNacionalidad(bd.nacionalidad) === c.pais
    ? bd.nacionalidad
    : (c.pais === 'GT' ? 'Guatemalteca' : (c.pais || 'No indicada'));

  return {
    fila: {
      id: c.id,
      nombre_completo: nombre,
      fecha_nacimiento: fechaNacimiento,
      departamento: c.departamento || bd.departamento || 'No indicado',
      nacionalidad,
      ocupacion: c.profesion || null,
      fecha_alta: bd.fecha_alta || hoy(),
    },
  };
}

// N-001 (corpus) o N-<marca de tiempo>-F-01[-n] (noticias consultadas en las fuentes)
const ID_NOTICIA = /^N-[0-9]{3,}(-F-[0-9]{2}(-[0-9]+)?)?$/;

export function noticiaHaciaBD(n, fuentesPorDominio) {
  const fuente = fuentesPorDominio[(n.fuente || '').trim().toLowerCase()];
  if (!fuente) return { local: true }; // fuente fuera del catálogo de la base: queda solo en la app
  if (!ID_NOTICIA.test(n.id || '')) return { local: true };
  if (!(n.texto || '').trim() || !n.fecha) return { error: null }; // incompleta: se guardará luego
  // Las noticias que trae "Consultar fuentes" llegan con estado 'ok' y su ID termina en -F-NN
  const consultada = n.estado === 'ok' || /-F-[0-9]{2}(-[0-9]+)?$/.test(n.id);
  return {
    fila: {
      id: n.id,
      fuente_id: fuente.id,
      url: n.url || `https://${fuente.dominio}`,
      fecha_publicacion: n.fecha,
      titulo: n.titulo || '',
      texto: n.texto,
      texto_completo: n.textoCompleto || null,
      origen: consultada ? 'publica_autorizada' : 'sintetico',
    },
  };
}

export function candidatoHaciaBD(c) {
  return {
    noticia_id: c.noticiaId,
    cliente_id: c.clienteId || null,
    nombre_extraido: (c.nombreExtraido || '').trim(),
    cargo_extraido: c.cargoExtraido,
    institucion: c.institucion || null,
    pais: c.pais || null,
    evento: c.evento,
    fragmento: c.fragmento,
    por_que: c.porQue || null,
    riesgo_homonimo: c.riesgoHomonimo,
    score_detalle: c.scoreDetalle || {},
    score: c.score,
    prioridad: c.prioridad,
  };
}

// ── Historial de búsquedas (manuales y automáticas) ─────────────────────────

const ZONA = 'America/Guatemala';

export function busquedaDesdeBD(r) {
  const fecha = new Date(r.fecha_hora);
  return {
    id: r.id,
    tipo: r.tipo,
    timestamp: r.fecha_hora,
    fecha: fecha.toLocaleDateString('es-GT', { timeZone: ZONA }),
    hora: fecha.toLocaleTimeString('es-GT', { timeZone: ZONA }),
    ...(r.fecha_clave ? { fechaClave: r.fecha_clave } : {}),
    fuentesConsultadas: r.fuentes_consultadas,
    fuentesConNoticias: r.fuentes_con_noticias,
    sinMenciones: r.sin_menciones,
    errores: r.errores,
    noticiasEncontradas: r.noticias_encontradas,
    noticiasAgregadas: r.noticias_agregadas,
    candidatosGenerados: r.candidatos_generados,
    fuentesConError: r.fuentes_con_error || [],
    registradoPor: r.registrado_por || '',
  };
}

export function busquedaHaciaBD(b) {
  return {
    id: b.id,
    tipo: b.tipo === 'automatica' ? 'automatica' : 'manual',
    fecha_hora: b.timestamp,
    fecha_clave: b.tipo === 'automatica' ? (b.fechaClave || String(b.timestamp).slice(0, 10)) : null,
    fuentes_consultadas: b.fuentesConsultadas ?? 0,
    fuentes_con_noticias: b.fuentesConNoticias ?? 0,
    sin_menciones: b.sinMenciones ?? 0,
    errores: b.errores ?? 0,
    noticias_encontradas: b.noticiasEncontradas ?? 0,
    noticias_agregadas: b.noticiasAgregadas ?? null,
    candidatos_generados: b.candidatosGenerados ?? null,
    fuentes_con_error: b.fuentesConError || [],
  };
}

/** La tabla busquedas se crea con 07_busquedas.sql; si aún no existe, la app sigue funcionando. */
function faltaTabla(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205' || /busquedas/.test(error.message || '') && /not (exist|find)|schema cache/i.test(error.message || ''));
}

export async function cargarBusquedas() {
  const { data, error } = await supabase.from('busquedas').select('*')
    .order('fecha_hora', { ascending: false }).limit(500);
  if (faltaTabla(error)) return null;
  return verificar({ data, error }, 'Historial de búsquedas').map(busquedaDesdeBD);
}

/** Guarda búsquedas nuevas; las que ya existen se ignoran. Devuelve false si falta la tabla. */
export async function insertarBusquedas(busquedas) {
  if (busquedas.length === 0) return true;
  const { error } = await supabase.from('busquedas')
    .upsert(busquedas.map(busquedaHaciaBD), { onConflict: 'id', ignoreDuplicates: true });
  if (faltaTabla(error)) return false;
  if (error && error.code === '23505' && busquedas.length > 1) {
    // Una del lote choca con la búsqueda automática del día que registró otra computadora:
    // se guardan una por una para no perder las demás
    for (const b of busquedas) await insertarBusquedas([b]);
    return true;
  }
  // Otra computadora ya registró la búsqueda automática de ese día: no es un error
  if (error && error.code === '23505') return true;
  verificar({ error }, 'Guardar historial de búsquedas');
  return true;
}

/**
 * Reserva la búsqueda automática del día para esta computadora.
 * Devuelve false si otra computadora del equipo ya la registró (evita noticias duplicadas).
 */
export async function reclamarBusquedaAutomatica(registro) {
  const { error } = await supabase.from('busquedas').insert(busquedaHaciaBD({ ...registro, tipo: 'automatica' }));
  if (!error || faltaTabla(error)) return true;
  if (error.code === '23505') {
    // Mismo id (ya la importó esta misma computadora antes) o mismo día (otra computadora)
    const { data } = await supabase.from('busquedas').select('id').eq('id', registro.id).maybeSingle();
    return Boolean(data);
  }
  throw new Error(`Búsqueda automática: ${mensajeError(error)}`);
}

// ── Operaciones ──────────────────────────────────────────────────────────────

export async function cargarTodo() {
  const [fuentes, clientes, noticias, candidatos, bitacora] = await Promise.all([
    supabase.from('fuentes').select('*').order('id'),
    supabase.from('clientes').select('*').order('id'),
    supabase.from('noticias').select('*, fuentes(id, nombre, dominio, confiabilidad)').order('id'),
    supabase.from('candidatos')
      .select('*, noticias(fecha_publicacion, fuentes(dominio))')
      .in('estado', ESTADOS_ABIERTOS)
      .order('score', { ascending: false }),
    supabase.from('bitacora').select('*').order('fecha_hora'),
  ]);
  return {
    fuentes: verificar(fuentes, 'Fuentes'),
    clientes: verificar(clientes, 'Clientes').map(clienteDesdeBD),
    noticias: verificar(noticias, 'Noticias').map(noticiaDesdeBD),
    candidatos: verificar(candidatos, 'Candidatos').map(candidatoDesdeBD),
    bitacora: verificar(bitacora, 'Bitácora').map(bitacoraDesdeBD),
  };
}

export async function guardarFilas(tabla, filas) {
  if (filas.length === 0) return;
  verificar(await supabase.from(tabla).upsert(filas, { onConflict: 'id' }), `Guardar ${tabla}`);
}

export async function eliminarFilas(tabla, ids) {
  if (ids.length === 0) return;
  verificar(await supabase.from(tabla).delete().in('id', ids), `Eliminar ${tabla}`);
}

/** Inserta candidatos; los que ya existen (misma noticia, cliente y nombre) se ignoran. */
export async function insertarCandidatos(candidatos) {
  if (candidatos.length === 0) return [];
  const data = verificar(
    await supabase.from('candidatos')
      .upsert(candidatos.map(candidatoHaciaBD), {
        onConflict: 'noticia_id,cliente_id,nombre_extraido',
        ignoreDuplicates: true,
      })
      .select('id, noticia_id, cliente_id, nombre_extraido'),
    'Guardar candidatos',
  );
  return data || [];
}

export async function buscarIdCandidato(c) {
  let consulta = supabase.from('candidatos').select('id')
    .eq('noticia_id', c.noticiaId)
    .eq('nombre_extraido', (c.nombreExtraido || '').trim());
  consulta = c.clienteId ? consulta.eq('cliente_id', c.clienteId) : consulta.is('cliente_id', null);
  const data = verificar(await consulta.limit(1), 'Buscar candidato');
  return data?.[0]?.id || null;
}

export async function registrarDecision(candidatoIdBD, decision, motivo) {
  return verificar(
    await supabase.from('bitacora')
      .insert({ candidato_id: candidatoIdBD, decision, motivo })
      .select('id, analista_email, fecha_hora')
      .single(),
    'Registrar decisión',
  );
}
