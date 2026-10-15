// Datos sintéticos precargados — ficticios, solo para demostración académica

export const clientesIniciales = [
  { id: 'CL-0087', nombre: 'Lucía Barrios Peña',      nacimiento: 1984, pais: 'GT', profesion: 'Empresaria' },
  { id: 'CL-0142', nombre: 'C. A. Mendizábal Rey',    nacimiento: 1971, pais: 'GT', profesion: 'Comerciante' },
  { id: 'CL-0203', nombre: 'José A. Pérez Lima',       nacimiento: 1990, pais: 'GT', profesion: 'Ingeniero' },
  { id: 'CL-0311', nombre: 'María E. López Fuentes',  nacimiento: 1988, pais: 'GT', profesion: 'Contadora' },
];

export const noticiasIniciales = [
  {
    id: 'N-001',
    titulo: 'Gobierno designa nuevo Director de Aduanas',
    fuente: 'dca.gob.gt',
    fuenteId: 'F-01',
    fuenteNombre: 'Diario de Centro América',
    url: 'https://dca.gob.gt',
    fecha: '2026-09-12',
    tipo: 'HTML',
    confiabilidad: 'alta',
    texto: 'El Ejecutivo designó a Carlos Mendizábal como director de la Superintendencia de Aduanas, en sustitución del anterior titular. El nombramiento fue oficializado mediante Acuerdo Gubernativo. Mendizábal, de 55 años, se desempeñaba anteriormente en el sector privado.',
    estado: 'sintético',
  },
  {
    id: 'N-002',
    titulo: 'Barrios asume cartera de Energía',
    fuente: 'agn.gt',
    fuenteId: 'F-04',
    fuenteNombre: 'Agencia Guatemalteca de Noticias',
    url: 'https://agn.gt',
    fecha: '2026-09-12',
    tipo: 'HTML',
    confiabilidad: 'alta',
    texto: 'Lucía Barrios asume el Ministerio de Energía y Minas; antes se desempeñaba como diputada del Congreso por el departamento de Guatemala. La nueva ministra indicó que sus prioridades serán la transición energética.',
    estado: 'sintético',
  },
  {
    id: 'N-003',
    titulo: 'Alcalde José Pérez inaugura mercado municipal',
    fuente: 'prensalibre.com',
    fuenteId: 'F-06',
    fuenteNombre: 'Prensa Libre',
    url: 'https://www.prensalibre.com',
    fecha: '2026-09-11',
    tipo: 'HTML',
    confiabilidad: 'media',
    texto: 'El alcalde José Pérez inauguró el nuevo mercado municipal de San Lucas Tolimán, Sololá. El funcionario indicó que la obra beneficiará a más de 2,000 familias del municipio.',
    estado: 'sintético',
  },
];

// Candidatos vacíos al inicio — se generan dinámicamente al cruzar clientes con noticias
export const candidatosIniciales = [];
