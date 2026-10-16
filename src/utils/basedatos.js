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
  noticias_id_check: 'El ID de la noticia debe tener el formato N-000.',
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
    tipo: 'TXT',
    confiabilidad: (f.confiabilidad || 'media').toLowerCase(),
    texto: r.texto,
    estado: 'sintético',
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

export function noticiaHaciaBD(n, fuentesPorDominio) {
  const fuente = fuentesPorDominio[(n.fuente || '').trim().toLowerCase()];
  if (!fuente) return { local: true }; // fuente fuera del catálogo de la base: queda solo en la app
  if (!/^N-[0-9]{3,}$/.test(n.id || '')) return { local: true };
  if (!(n.texto || '').trim() || !n.fecha) return { error: null }; // incompleta: se guardará luego
  return {
    fila: {
      id: n.id,
      fuente_id: fuente.id,
      url: n.url || `https://${fuente.dominio}`,
      fecha_publicacion: n.fecha,
      titulo: n.titulo || '',
      texto: n.texto,
      origen: 'sintetico',
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
