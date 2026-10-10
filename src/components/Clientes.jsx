import { useState, useRef } from 'react';

function nuevoCliente() {
  return { id: `CL-${String(Math.floor(Math.random() * 9000) + 1000)}`, nombre: '', nacimiento: '', pais: 'GT', profesion: '' };
}

function parsearCSV(texto) {
  const lineas = texto.trim().split('\n').map(l => l.trim()).filter(l => l);
  if (lineas.length < 2) return { clientes: [], errores: ['El archivo no tiene suficientes filas.'] };

  // Detectar separador (coma o punto y coma)
  const separador = lineas[0].includes(';') ? ';' : ',';
  const encabezados = lineas[0].split(separador).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Mapear columnas flexiblemente
  const idxId         = encabezados.findIndex(h => h.includes('id'));
  const idxNombre     = encabezados.findIndex(h => h.includes('nombre') || h.includes('name'));
  const idxNacimiento = encabezados.findIndex(h => h.includes('nac') || h.includes('birth') || h.includes('año') || h.includes('anio'));
  const idxPais       = encabezados.findIndex(h => h.includes('pais') || h.includes('país') || h.includes('country'));
  const idxProfesion  = encabezados.findIndex(h => h.includes('prof') || h.includes('ocup') || h.includes('cargo'));

  if (idxNombre === -1) {
    return { clientes: [], errores: ['No se encontró columna de nombre. El CSV debe tener una columna "nombre" o "name".'] };
  }

  const clientes = [];
  const errores = [];

  lineas.slice(1).forEach((linea, i) => {
    const cols = linea.split(separador).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const nombre = cols[idxNombre] || '';
    if (!nombre) {
      errores.push(`Fila ${i + 2}: nombre vacío, se omitió.`);
      return;
    }
    clientes.push({
      id:          idxId !== -1 && cols[idxId] ? cols[idxId] : `CL-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      nombre,
      nacimiento:  idxNacimiento !== -1 ? cols[idxNacimiento] || '' : '',
      pais:        idxPais !== -1 ? cols[idxPais] || 'GT' : 'GT',
      profesion:   idxProfesion !== -1 ? cols[idxProfesion] || '' : '',
    });
  });

  return { clientes, errores };
}

export default function Clientes({ state, onChange }) {
  const { clientes } = state;
  const [editando, setEditando]     = useState(null);
  const [mensaje, setMensaje]       = useState(null); // { tipo: 'exito'|'error', texto }
  const [erroresCSV, setErroresCSV] = useState([]);
  const inputFileRef                = useRef(null);

  function actualizar(id, field, val) {
    onChange({ ...state, clientes: clientes.map(c => c.id === id ? { ...c, [field]: val } : c) });
  }

  function agregar() {
    const nc = nuevoCliente();
    onChange({ ...state, clientes: [...clientes, nc] });
    setEditando(nc.id);
  }

  function eliminar(id) {
    if (!confirm('¿Eliminar este cliente?')) return;
    onChange({ ...state, clientes: clientes.filter(c => c.id !== id) });
  }

  function handleArchivoCSV(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    // Limpiar el input para permitir cargar el mismo archivo de nuevo
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target.result;
      const { clientes: nuevos, errores } = parsearCSV(texto);

      if (nuevos.length === 0) {
        setMensaje({ tipo: 'error', texto: 'No se importó ningún cliente. Revisa el formato del archivo.' });
        setErroresCSV(errores);
        return;
      }

      const modo = confirm(
        `Se encontraron ${nuevos.length} cliente(s) en el CSV.\n\n` +
        `• Aceptar → REEMPLAZAR la lista actual con los del CSV\n` +
        `• Cancelar → AGREGAR los del CSV a la lista actual`
      );

      const listaFinal = modo ? nuevos : [...clientes, ...nuevos];
      onChange({ ...state, clientes: listaFinal });
      setMensaje({ tipo: 'exito', texto: `✓ Se importaron ${nuevos.length} cliente(s) desde el CSV.` });
      setErroresCSV(errores);
      setTimeout(() => setMensaje(null), 4000);
    };
    reader.readAsText(archivo, 'UTF-8');
  }

  function descargarPlantilla() {
    const contenido = 'id,nombre,nacimiento,pais,profesion\nCL-0001,Juan Pérez López,1980,GT,Empresario\nCL-0002,María García Ruiz,1990,GT,Contadora\n';
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="vista-contenedor">
      <div className="vista-header">
        <div>
          <h2 className="page-title">Base de Clientes Sintética</h2>
          <p className="page-sub">Datos ficticios para demostración académica. No usar datos reales.</p>
        </div>
        <div className="vista-header-acciones">
          {/* Input oculto para el archivo */}
          <input
            ref={inputFileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleArchivoCSV}
          />
          <button className="btn-secundario" onClick={descargarPlantilla} title="Descargar plantilla CSV">
            📥 Plantilla CSV
          </button>
          <button className="btn-csv" onClick={() => inputFileRef.current.click()}>
            📂 Cargar CSV
          </button>
          <button className="btn-primario" onClick={agregar}>+ Agregar Cliente</button>
        </div>
      </div>

      {/* Mensajes */}
      {mensaje && (
        <div className={`csv-mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>
      )}
      {erroresCSV.length > 0 && (
        <div className="csv-errores">
          <strong>Avisos del CSV:</strong>
          <ul>{erroresCSV.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {/* Instrucciones CSV */}
      <div className="csv-instrucciones">
        <strong>📋 Formato del CSV:</strong> El archivo debe tener columnas <code>id, nombre, nacimiento, pais, profesion</code>.
        Puedes usar coma (,) o punto y coma (;) como separador. Descarga la plantilla para ver el formato exacto.
      </div>

      <div className="tabla-wrapper">
        <table className="tabla">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre completo</th>
              <th>Nacimiento</th>
              <th>País</th>
              <th>Profesión</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#888', padding: '24px', fontStyle: 'italic' }}>
                  No hay clientes. Agrega uno manualmente o carga un CSV.
                </td>
              </tr>
            )}
            {clientes.map(c => (
              <tr key={c.id} className={editando === c.id ? 'fila-editando' : ''}>
                <td><span className="id-chip">{c.id}</span></td>
                <td>
                  {editando === c.id
                    ? <input className="tabla-input" value={c.nombre} onChange={e => actualizar(c.id, 'nombre', e.target.value)} placeholder="Nombre completo" />
                    : c.nombre || <em className="texto-suave">Sin nombre</em>}
                </td>
                <td>
                  {editando === c.id
                    ? <input className="tabla-input w80" type="number" value={c.nacimiento} onChange={e => actualizar(c.id, 'nacimiento', e.target.value)} placeholder="Año" />
                    : c.nacimiento}
                </td>
                <td>
                  {editando === c.id
                    ? <input className="tabla-input w60" value={c.pais} onChange={e => actualizar(c.id, 'pais', e.target.value)} placeholder="GT" />
                    : c.pais}
                </td>
                <td>
                  {editando === c.id
                    ? <input className="tabla-input" value={c.profesion} onChange={e => actualizar(c.id, 'profesion', e.target.value)} placeholder="Profesión" />
                    : c.profesion}
                </td>
                <td>
                  <div className="tabla-acciones">
                    {editando === c.id
                      ? <button className="btn-sm btn-ok" onClick={() => setEditando(null)}>✓ Listo</button>
                      : <button className="btn-sm btn-edit" onClick={() => setEditando(c.id)}>✏ Editar</button>}
                    <button className="btn-sm btn-del" onClick={() => eliminar(c.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
