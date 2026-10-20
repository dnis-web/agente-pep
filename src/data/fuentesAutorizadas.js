// Catálogo de fuentes activas: excluidas F-00, F-02, F-05, F-09, F-10, F-12, F-13, F-15, F-16, F-17 por fallos en búsquedas del 17 y 18/10/2026.
// Exclusión operativa basada en la bitácora, no comprobación de indisponibilidad permanente.
// Fuente: Catalogo-Fuentes-Autorizadas-Actualizado — Datos académicos de demostración

export const FUENTES_AUTORIZADAS = [
  {
    id: 'F-01',
    nombre: 'Diario de Centro América',
    dominio: 'dca.gob.gt',
    url: 'https://dca.gob.gt',
    urlNoticias: 'https://dca.gob.gt/noticias-guatemala-diario-centro-america/category/en-el-pais/',
    rol: 'Monitoreo Noticias',
    nivelConfiabilidad: 'Verificada Nivel 1',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Órgano oficial de publicación de Acuerdos Gubernativos del Estado',
  },
  {
    id: 'F-03',
    nombre: 'Congreso de la República de Guatemala',
    dominio: 'congreso.gob.gt',
    url: 'https://congreso.gob.gt',
    urlNoticias: 'https://congreso.gob.gt/noticias/',
    rol: 'Monitoreo Noticias',
    nivelConfiabilidad: 'Verificada Nivel 1',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Fuente oficial legislativa para juramentaciones y licencias',
  },
  {
    id: 'F-04',
    nombre: 'Agencia Guatemalteca de Noticias',
    dominio: 'agn.gt',
    url: 'https://agn.gt',
    urlNoticias: 'https://agn.gt/category/guatemala/',
    rol: 'Monitoreo Noticias',
    nivelConfiabilidad: 'Verificada Nivel 1',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Agencia oficial de comunicación del Organismo Ejecutivo',
  },
  {
    id: 'F-06',
    nombre: 'Prensa Libre',
    dominio: 'prensalibre.com',
    url: 'https://www.prensalibre.com',
    urlNoticias: 'https://www.prensalibre.com/guatemala/politica/',
    rol: 'Monitoreo Prensa',
    nivelConfiabilidad: 'Verificada Nivel 2',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Medio periodístico nacional con consejo editorial establecido',
  },
  {
    id: 'F-07',
    nombre: 'Diario La Hora',
    dominio: 'lahora.gt',
    url: 'https://lahora.gt',
    urlNoticias: 'https://lahora.gt/nacionales/',
    rol: 'Monitoreo Prensa',
    nivelConfiabilidad: 'Verificada Nivel 2',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Medio periodístico nacional de circulación verificada',
  },
  {
    id: 'F-08',
    nombre: 'Soy502',
    dominio: 'soy502.com',
    url: 'https://www.soy502.com',
    urlNoticias: 'https://www.soy502.com/rss',
    rol: 'Monitoreo Prensa',
    nivelConfiabilidad: 'Verificada Nivel 2',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Portal digital periodístico nacional verificable',
  },
  {
    id: 'F-11',
    nombre: 'Ministerio Público de Guatemala (MP)',
    dominio: 'mp.gob.gt',
    url: 'https://mp.gob.gt',
    urlNoticias: 'https://mp.gob.gt/noticias/',
    rol: 'Monitoreo Noticias',
    nivelConfiabilidad: 'Verificada Nivel 1',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Institución oficial autónoma para nombramientos de Fiscal General y Fiscales de Distrito o Sección',
  },
  {
    id: 'F-14',
    nombre: 'Asociación Nacional de Municipalidades (ANAM)',
    dominio: 'anam.org.gt',
    url: 'https://anam.org.gt',
    urlNoticias: 'https://anam.org.gt/noticias/',
    rol: 'Monitoreo Cruce',
    nivelConfiabilidad: 'Verificada Nivel 1',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Entidad oficial representativa para verificación de los 340 Alcaldes y Corporaciones Municipales',
  },
  {
    id: 'F-18',
    nombre: 'República GT',
    dominio: 'republica.gt',
    url: 'https://republica.gt',
    urlNoticias: 'https://republica.gt/politica/',
    rol: 'Monitoreo Prensa',
    nivelConfiabilidad: 'Verificada Nivel 2',
    puntosScore: 1,
    estado: 'Autorizada',
    justificacion: 'Medio periodístico digital nacional con cobertura de nombramientos y actividad pública',
  },
];

// Dominios de nivel 1 (instituciones oficiales del Estado)
export const DOMINIOS_NIVEL_1 = FUENTES_AUTORIZADAS
  .filter(f => f.nivelConfiabilidad === 'Verificada Nivel 1' || f.nivelConfiabilidad === 'Oficial Regulador')
  .map(f => f.dominio);

// Dominios de nivel 2 (prensa verificada)
export const DOMINIOS_NIVEL_2 = FUENTES_AUTORIZADAS
  .filter(f => f.nivelConfiabilidad === 'Verificada Nivel 2')
  .map(f => f.dominio);

// Todos los dominios autorizados
export const TODOS_DOMINIOS_AUTORIZADOS = FUENTES_AUTORIZADAS.map(f => f.dominio);

/**
 * Retorna la fuente autorizada que corresponde a un dominio dado (búsqueda parcial).
 * @param {string} dominio - dominio o URL a verificar
 * @returns {object|null} - fuente autorizada o null
 */
export function buscarFuentePorDominio(dominio) {
  if (!dominio) return null;
  const d = dominio.toLowerCase();
  return FUENTES_AUTORIZADAS.find(f => d.includes(f.dominio) || f.dominio.includes(d)) || null;
}

/**
 * Calcula los puntos de score de confiabilidad de una fuente.
 * Nivel 1 y Oficial = +1 punto garantizado, F-00 aplica regla especial.
 * Nivel 2 = +1 punto.
 * No autorizada = 0 puntos.
 */
export function puntosConfiabilidad(dominio) {
  const fuente = buscarFuentePorDominio(dominio);
  if (!fuente) return 0;
  if (fuente.id === 'F-00') return 1; // regla especial, se trata como Nivel 1
  return typeof fuente.puntosScore === 'number' ? fuente.puntosScore : 1;
}
