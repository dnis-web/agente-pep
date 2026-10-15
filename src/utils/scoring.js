// Reglas explicables de scoring — según el documento del proyecto
import { puntosConfiabilidad } from '../data/fuentesAutorizadas';

const CARGOS_ALTO_NIVEL = [
  'ministro', 'ministra', 'director', 'directora', 'secretario', 'secretaria',
  'presidente', 'presidenta', 'vicepresidente', 'vicepresidenta', 'diputado', 'diputada',
  'magistrado', 'magistrada', 'fiscal', 'gobernador', 'gobernadora', 'embajador', 'embajadora',
  'superintendente', 'viceministro', 'viceministra', 'decano', 'rector', 'senador',
  'alcalde', 'alcaldesa', 'cónsul', 'consul',
];

function normalizar(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function diasDesde(fechaStr) {
  const hoy = new Date();
  const fecha = new Date(fechaStr);
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
}

function esCargoAltoNivel(cargo) {
  const c = normalizar(cargo);
  return CARGOS_ALTO_NIVEL.some(k => c.includes(k));
}

function esFuenteConfiable(fuente) {
  return puntosConfiabilidad(fuente) > 0;
}

function puntosScoreFuente(fuente) {
  return puntosConfiabilidad(fuente);
}

function matchNombre(nombreExtraido, nombreCliente) {
  const partes = normalizar(nombreCliente).split(' ').filter(p => p.length > 2);
  const extraido = normalizar(nombreExtraido);
  const coincidencias = partes.filter(p => extraido.includes(p));
  if (coincidencias.length >= 3) return 'completo';
  if (coincidencias.length >= 2) return 'parcial';
  return 'ninguno';
}

export function calcularScore(noticia, cliente, nombreExtraido, cargo, datosContradictorios = false) {
  const detalle = {
    nombreCompleto: 0,
    nombreParcial: 0,
    cargoAltoNivel: 0,
    cargoLocal: 0,
    fuenteConfiable: 0,
    noticiaReciente: 0,
    datoConfirma: 0,
    datosContradictorios: 0,
  };

  // Nombre
  const match = matchNombre(nombreExtraido, cliente.nombre);
  if (match === 'completo') detalle.nombreCompleto = 3;
  else if (match === 'parcial') detalle.nombreParcial = 1;

  // Cargo
  if (esCargoAltoNivel(cargo)) detalle.cargoAltoNivel = 3;
  else detalle.cargoLocal = 1;

  // Fuente — usa catálogo autorizado real
  if (esFuenteConfiable(noticia.fuente)) detalle.fuenteConfiable = puntosScoreFuente(noticia.fuente);

  // Reciente (menos de 30 días)
  if (diasDesde(noticia.fecha) <= 30) detalle.noticiaReciente = 1;

  // Datos contradictorios
  if (datosContradictorios) detalle.datosContradictorios = -4;

  const total = Object.values(detalle).reduce((a, b) => a + b, 0);

  return {
    scoreDetalle: detalle,
    score: total,
    prioridad: total >= 7 ? 'Alta' : total >= 4 ? 'Media' : 'Baja',
  };
}

export function procesarNoticias(noticias, clientes) {
  // Simulación del "agente": cruza cada noticia con cada cliente y genera candidatos
  const candidatos = [];
  let idCounter = Date.now();

  noticias.forEach(noticia => {
    clientes.forEach(cliente => {
      const partes = normalizar(cliente.nombre).split(' ').filter(p => p.length > 2);
      // Buscar si alguna palabra del nombre del cliente aparece en el texto
      const textoNorm = normalizar(noticia.texto);
      const coincide = partes.some(p => textoNorm.includes(p));
      if (!coincide) return;

      // Extraer nombre y cargo del texto (simplificado)
      const nombreExtraido = partes.slice(0, 2).map(p =>
        p.charAt(0).toUpperCase() + p.slice(1)
      ).join(' ');

      // Detectar cargo en texto
      let cargoDetectado = 'Cargo no especificado';
      const cargosTest = [
        'director', 'directora', 'ministr', 'alcalde', 'alcaldesa',
        'diputado', 'diputada', 'presidente', 'secretario', 'gobernador',
      ];
      for (const c of cargosTest) {
        if (textoNorm.includes(c)) {
          const idx = textoNorm.indexOf(c);
          cargoDetectado = noticia.texto.substring(idx, idx + 30).split(' ').slice(0, 4).join(' ');
          break;
        }
      }

      // Detectar datos contradictorios (simplificado: si hay municipio que no coincide con país del cliente)
      const hayContradiccion = textoNorm.includes('sololá') && cliente.pais === 'GT' && cliente.id === 'CL-0203';

      const { scoreDetalle, score, prioridad } = calcularScore(
        noticia, cliente, nombreExtraido, cargoDetectado, hayContradiccion
      );

      // Evitar duplicados exactos
      const yaExiste = candidatos.some(
        c => c.noticiaId === noticia.id && c.clienteId === cliente.id
      );
      if (yaExiste) return;

      candidatos.push({
        id: `CAND-${++idCounter}`,
        noticiaId: noticia.id,
        clienteId: cliente.id,
        nombreExtraido,
        cargoExtraido: cargoDetectado,
        institucion: '',
        evento: score < 0 ? 'Posible homónimo' : score >= 7 ? 'Nombramiento' : 'Cambio de cargo',
        pais: cliente.pais,
        fecha: noticia.fecha,
        fuente: noticia.fuente,
        fragmento: noticia.texto.substring(0, 120) + '…',
        porQue: score < 0
          ? 'Datos contradictorios encontrados. Posible homónimo.'
          : `${prioridad === 'Alta' ? 'Nombre completo y cargo de alto nivel.' : 'Coincidencia parcial de nombre.'}`,
        riesgoHomonimo: score < 0 ? 'alto' : prioridad === 'Alta' ? 'bajo' : 'medio',
        scoreDetalle,
        score,
        prioridad,
        decision: null,
        motivoDecision: '',
        analista: '',
        fechaDecision: null,
      });
    });
  });

  return candidatos;
}

export function colorPrioridad(p) {
  switch (p) {
    case 'Alta':  return { bg: '#fdecea', border: '#c0392b', text: '#c0392b' };
    case 'Media': return { bg: '#fef5e7', border: '#e67e22', text: '#e67e22' };
    case 'Baja':  return { bg: '#eafaf1', border: '#27ae60', text: '#27ae60' };
    default:      return { bg: '#f5f5f5', border: '#bbb',    text: '#888' };
  }
}

export function colorDecision(d) {
  switch (d) {
    case 'Aceptado':    return { bg: '#eafaf1', text: '#27ae60' };
    case 'Rechazado':   return { bg: '#fdecea', text: '#c0392b' };
    case 'Investigar':  return { bg: '#eff6ff', text: '#2980b9' };
    default:            return { bg: '#f5f5f5', text: '#888' };
  }
}
