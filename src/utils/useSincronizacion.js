/**
 * useSincronizacion.js — Conecta el estado de la app con Supabase.
 *
 * - Sesión: inicio y cierre de sesión con Supabase Auth.
 * - Carga: al iniciar sesión trae clientes, noticias, candidatos abiertos y bitácora.
 * - Guardado: los cambios hechos por el usuario en Clientes y Noticias se guardan
 *   en la base 1.2 s después de dejar de escribir; los candidatos nuevos se
 *   guardan solos; cada decisión se registra en la bitácora.
 * - Lo que no tiene lugar en la base (p. ej. noticias de fuentes que no están en
 *   el catálogo de la base) sigue funcionando, pero solo en esta computadora.
 *
 * Si Supabase no está configurado, no hace nada y la app trabaja en modo local.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigurado, errorConfiguracion } from '../lib/supabase';
import {
  mensajeError,
  cargarTodo, guardarFilas, eliminarFilas, insertarCandidatos, buscarIdCandidato,
  registrarDecision as registrarDecisionBD, clienteHaciaBD, noticiaHaciaBD, claveCandidato,
  cargarBusquedas, insertarBusquedas, reclamarBusquedaAutomatica,
} from './basedatos';

const ESPERA_MS = 1200;

function idsCambiados(antes = [], despues = []) {
  const previos = new Map(antes.map(x => [x.id, JSON.stringify(x)]));
  const actuales = new Set(despues.map(x => x.id));
  const cambiados = despues.filter(x => previos.get(x.id) !== JSON.stringify(x)).map(x => x.id);
  const eliminados = antes.filter(x => !actuales.has(x.id)).map(x => x.id);
  return { cambiados, eliminados };
}

export function useSincronizacion(state, setState) {
  const [sesion, setSesion] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(supabaseConfigurado);
  const [cargando, setCargando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [aviso, setAviso] = useState({ tipo: 'ok', texto: '' });
  const [errorCarga, setErrorCarga] = useState('');

  const estadoActual = useRef(state);
  useEffect(() => { estadoActual.current = state; }, [state]);

  const ctx = useRef({
    fuentesPorDominio: {},
    noticiasBD: new Set(),
    clientesBD: new Set(),
    candidatosBD: new Map(),           // clave natural → id en la base (o null si se desconoce)
    busquedasBD: new Set(),            // ids del historial de búsquedas ya guardados
    hayTablaBusquedas: true,           // false si aún no se ejecutó 07_busquedas.sql
    pendientes: { clientes: new Set(), noticias: new Set() },
    eliminados: { clientes: new Set(), noticias: new Set() },
    temporizador: null,
    cola: Promise.resolve(),
  });

  const conectado = supabaseConfigurado && Boolean(sesion);
  const programarGuardadoRef = useRef(null);

  // ── Sesión ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setVerificandoSesion(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
      if (!nuevaSesion) { setCargado(false); setErrorCarga(''); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials'
      ? 'Correo o contraseña incorrectos.' : error.message);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // ── Carga desde la base ───────────────────────────────────────────────────
  const recargar = useCallback(async () => {
    if (!supabaseConfigurado || !supabase) return;
    setCargando(true);
    setErrorCarga('');
    try {
      const datos = await cargarTodo();
      const busquedasBD = await cargarBusquedas();
      const c = ctx.current;
      c.hayTablaBusquedas = busquedasBD !== null;
      c.busquedasBD = new Set((busquedasBD || []).map(b => b.id));
      c.fuentesPorDominio = Object.fromEntries(datos.fuentes.map(f => [f.dominio.toLowerCase(), f]));
      c.noticiasBD = new Set(datos.noticias.map(n => n.id));
      c.clientesBD = new Set(datos.clientes.map(x => x.id));
      c.candidatosBD = new Map(datos.candidatos.map(x => [claveCandidato(x), x.id]));
      c.pendientes = { clientes: new Set(), noticias: new Set() };
      c.eliminados = { clientes: new Set(), noticias: new Set() };

      const { data: usuario } = await supabase.auth.getUser();
      setState(prev => {
        // Se conserva lo que solo existe en esta computadora (p. ej. noticias de fuentes externas)
        const noticiasLocales = (prev.noticias || []).filter(n =>
          !c.noticiasBD.has(n.id) && n.estado !== 'sintético' && n.estado !== 'manual');
        const idsLocales = new Set(noticiasLocales.map(n => n.id));
        return {
          ...prev,
          clientes: datos.clientes,
          noticias: [...datos.noticias, ...noticiasLocales],
          candidatos: [
            ...datos.candidatos,
            ...(prev.candidatos || []).filter(x => idsLocales.has(x.noticiaId)),
          ],
          bitacora: [...datos.bitacora, ...(prev.bitacora || []).filter(b => b._local)],
          busquedas: [
            ...(busquedasBD || []),
            ...(prev.busquedas || []).filter(b => !c.busquedasBD.has(b.id)),
          ].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 2000),
          analista: usuario?.user?.email || prev.analista,
        };
      });
      // Noticias consultadas en esta computadora que aún no están en la base: se guardan ahora
      programarGuardadoRef.current?.();
      setCargado(true);
      setAviso({ tipo: 'ok', texto: 'Datos cargados' });
    } catch (e) {
      setErrorCarga(e.message);
      setAviso({ tipo: 'error', texto: e.message });
    } finally {
      setCargando(false);
    }
  }, [setState]);

  useEffect(() => {
    if (conectado && !cargado && !cargando && !errorCarga) recargar();
  }, [conectado, cargado, cargando, errorCarga, recargar]);

  // ── Guardado ──────────────────────────────────────────────────────────────
  const encolar = useCallback((tarea) => {
    const c = ctx.current;
    c.cola = c.cola.then(tarea).catch(e => setAviso({ tipo: 'error', texto: e.message }));
    return c.cola;
  }, []);

  const guardarPendientes = useCallback(async () => {
    const c = ctx.current;
    const actual = estadoActual.current;
    const avisos = [];

    // 1. Clientes
    const idsClientes = [...c.pendientes.clientes];
    const borrarClientes = [...c.eliminados.clientes].filter(id => c.clientesBD.has(id));
    c.pendientes.clientes.clear();
    c.eliminados.clientes.clear();
    const filasClientes = [];
    for (const id of idsClientes) {
      const cliente = actual.clientes.find(x => x.id === id);
      if (!cliente) continue;
      const { fila, error } = clienteHaciaBD(cliente);
      if (fila) filasClientes.push(fila);
      else if (error) avisos.push(error);
    }
    await guardarFilas('clientes', filasClientes);
    filasClientes.forEach(f => c.clientesBD.add(f.id));
    await eliminarFilas('clientes', borrarClientes);
    borrarClientes.forEach(id => c.clientesBD.delete(id));

    // 2. Noticias
    // Además de las editadas, las consultadas en las fuentes (estado 'ok') que aún no están en la base,
    // p. ej. las que importó la búsqueda automática o se consultaron antes de iniciar sesión
    const idsNoticias = [...new Set([
      ...c.pendientes.noticias,
      ...(actual.noticias || [])
        .filter(n => n.estado === 'ok' && !c.noticiasBD.has(n.id) && c.fuentesPorDominio[(n.fuente || '').trim().toLowerCase()])
        .map(n => n.id),
    ])];
    const borrarNoticias = [...c.eliminados.noticias].filter(id => c.noticiasBD.has(id));
    c.pendientes.noticias.clear();
    c.eliminados.noticias.clear();
    const filasNoticias = [];
    for (const id of idsNoticias) {
      const noticia = actual.noticias.find(x => x.id === id);
      if (!noticia) continue;
      const { fila, local } = noticiaHaciaBD(noticia, c.fuentesPorDominio);
      if (fila) filasNoticias.push(fila);
      else if (local && noticia.estado === 'manual' && noticia.fuente) {
        avisos.push(`La noticia ${noticia.id} queda solo en esta computadora: su fuente no está en el catálogo de la base.`);
      }
    }
    await guardarFilas('noticias', filasNoticias);
    filasNoticias.forEach(f => c.noticiasBD.add(f.id));
    await eliminarFilas('noticias', borrarNoticias);
    borrarNoticias.forEach(id => c.noticiasBD.delete(id));

    // 3. Candidatos nuevos (solo los de noticias y clientes que existen en la base)
    const nuevos = (actual.candidatos || []).filter(x =>
      !c.candidatosBD.has(claveCandidato(x)) &&
      c.noticiasBD.has(x.noticiaId) &&
      (!x.clienteId || c.clientesBD.has(x.clienteId)));
    nuevos.forEach(x => c.candidatosBD.set(claveCandidato(x), null));
    let insertados;
    try {
      insertados = await insertarCandidatos(nuevos);
    } catch (e) {
      nuevos.forEach(x => c.candidatosBD.delete(claveCandidato(x))); // se reintentará en el próximo cambio
      throw e;
    }
    insertados.forEach(r => c.candidatosBD.set(
      claveCandidato({ noticiaId: r.noticia_id, clienteId: r.cliente_id, nombreExtraido: r.nombre_extraido }), r.id));

    // 4. Historial de búsquedas nuevas (manuales y automáticas)
    let busquedasGuardadas = 0;
    if (c.hayTablaBusquedas) {
      const nuevasBusquedas = (actual.busquedas || []).filter(b => b?.id && b.timestamp && !c.busquedasBD.has(b.id));
      if (nuevasBusquedas.length) {
        c.hayTablaBusquedas = await insertarBusquedas(nuevasBusquedas);
        if (c.hayTablaBusquedas) {
          nuevasBusquedas.forEach(b => c.busquedasBD.add(b.id));
          busquedasGuardadas = nuevasBusquedas.length;
        }
      }
    }

    const guardados = filasClientes.length + filasNoticias.length + borrarClientes.length +
      borrarNoticias.length + insertados.length + busquedasGuardadas;
    if (avisos.length) setAviso({ tipo: 'aviso', texto: avisos[0] });
    else if (guardados) setAviso({ tipo: 'ok', texto: 'Cambios guardados' });
  }, []);

  const programarGuardado = useCallback(() => {
    const c = ctx.current;
    if (c.temporizador) clearTimeout(c.temporizador);
    c.temporizador = setTimeout(() => {
      c.temporizador = null;
      encolar(guardarPendientes);
    }, ESPERA_MS);
  }, [encolar, guardarPendientes]);

  useEffect(() => { programarGuardadoRef.current = programarGuardado; }, [programarGuardado]);

  /** Registra los cambios que hizo el usuario en Clientes o Noticias. */
  const marcarCambios = useCallback((tabla, antes, despues) => {
    if (!conectado || !cargado) return;
    const { cambiados, eliminados } = idsCambiados(antes, despues);
    const c = ctx.current;
    cambiados.forEach(id => { c.pendientes[tabla].add(id); c.eliminados[tabla].delete(id); });
    eliminados.forEach(id => { c.eliminados[tabla].add(id); c.pendientes[tabla].delete(id); });
    if (cambiados.length || eliminados.length) programarGuardado();
  }, [conectado, cargado, programarGuardado]);

  // Candidatos nuevos generados por el agente o al editar clientes
  useEffect(() => {
    if (!conectado || !cargado) return;
    const c = ctx.current;
    const hayNuevos = (state.candidatos || []).some(x =>
      !c.candidatosBD.has(claveCandidato(x)) && c.noticiasBD.has(x.noticiaId));
    if (hayNuevos) programarGuardado();
  }, [state.candidatos, conectado, cargado, programarGuardado]);

  // Búsquedas nuevas en el historial (botón Consultar o búsqueda automática)
  useEffect(() => {
    if (!conectado || !cargado) return;
    const c = ctx.current;
    if (c.hayTablaBusquedas && (state.busquedas || []).some(b => b?.id && !c.busquedasBD.has(b.id))) {
      programarGuardado();
    }
  }, [state.busquedas, conectado, cargado, programarGuardado]);

  /**
   * Antes de importar una búsqueda automática, la reserva en la base.
   * Devuelve false si otra computadora del equipo ya importó la de ese día.
   */
  const reclamarBusqueda = useCallback(async (registro) => {
    if (!conectado || !cargado) return true;
    const c = ctx.current;
    if (!c.hayTablaBusquedas) return true;
    const ok = await reclamarBusquedaAutomatica(registro);
    if (ok) c.busquedasBD.add(registro.id);
    return ok;
  }, [conectado, cargado]);

  /** Registra en la bitácora de la base la decisión tomada en la bandeja. */
  const registrarDecision = useCallback((candidato, decision, motivo) => {
    if (!conectado || !cargado || !candidato) return;
    const c = ctx.current;
    const marcarEntrada = (cambios) => setState(prev => ({
      ...prev,
      bitacora: prev.bitacora.map(b =>
        b.candidatoId === candidato.id && !b._bdId && !b._local ? { ...b, ...cambios } : b),
    }));

    if (!c.noticiasBD.has(candidato.noticiaId)) {
      marcarEntrada({ _local: true });
      setAviso({ tipo: 'aviso', texto: 'Decisión guardada solo en esta computadora: la noticia no está en la base.' });
      return;
    }

    // Esperar a que se guarden los candidatos pendientes antes de decidir
    if (c.temporizador) { clearTimeout(c.temporizador); c.temporizador = null; }
    encolar(guardarPendientes);
    encolar(async () => {
      const clave = claveCandidato(candidato);
      let idBD = /^C-[0-9]+$/.test(candidato.id)
        ? candidato.id
        : (c.candidatosBD.get(clave) || await buscarIdCandidato(candidato));
      if (!idBD && (!candidato.clienteId || c.clientesBD.has(candidato.clienteId))) {
        // El candidato aún no estaba guardado (se decidió antes del guardado automático)
        const [insertado] = await insertarCandidatos([candidato]);
        idBD = insertado?.id || await buscarIdCandidato(candidato);
        if (idBD) c.candidatosBD.set(clave, idBD);
      }
      if (!idBD) throw new Error('No se encontró el candidato en la base; la decisión no se guardó.');
      try {
        const fila = await registrarDecisionBD(idBD, decision, motivo);
        marcarEntrada({ _bdId: fila.id, candidatoId: idBD, analista: fila.analista_email, fecha: fila.fecha_hora });
        setAviso({ tipo: 'ok', texto: `Decisión registrada en la bitácora (${idBD})` });
      } catch (e) {
        // La decisión no se guardó: se quita de la bitácora local y el candidato vuelve a la bandeja
        setState(prev => ({
          ...prev,
          bitacora: prev.bitacora.filter(b => !(b.candidatoId === candidato.id && !b._bdId && !b._local)),
          candidatos: prev.candidatos.some(x => x.id === candidato.id)
            ? prev.candidatos
            : [...prev.candidatos, candidato],
        }));
        setAviso({ tipo: 'error', texto: `La decisión no se guardó. ${e.message.replace(/^Registrar decisión: /, '')} El candidato volvió a la bandeja.` });
      }
    });
  }, [conectado, cargado, encolar, guardarPendientes, setState]);

  // ── Restablecer (modo desarrollo) ─────────────────────────────────────────
  // Borra candidatos, bitácora y registro de cambios en la base con
  // limpiar_pruebas() y vuelve a cargar. En modo final esa función no existe:
  // no se borra nada y solo se recargan los datos.
  const restablecer = useCallback(async () => {
    if (!supabaseConfigurado || !supabase) return;
    const c = ctx.current;
    if (c.temporizador) { clearTimeout(c.temporizador); c.temporizador = null; }
    c.pendientes = { clientes: new Set(), noticias: new Set() };
    c.eliminados = { clientes: new Set(), noticias: new Set() };
    let error = null;
    await encolar(async () => {
      ({ error } = await supabase.rpc('limpiar_pruebas'));
    });
    await recargar();
    if (!error) {
      setAviso({ tipo: 'ok', texto: 'Pruebas borradas: bandeja y bitácora vacías' });
    } else if (/limpiar_pruebas|function|PGRST202/i.test(`${error.code} ${error.message}`)) {
      setAviso({ tipo: 'aviso', texto: 'La base está en modo final: los candidatos y la bitácora no se pueden borrar. Solo se recargaron los datos.' });
    } else {
      setAviso({ tipo: 'error', texto: `No se pudo restablecer. ${mensajeError(error)}` });
    }
  }, [encolar, recargar]);

  return {
    configurado: supabaseConfigurado,
    errorConfiguracion,
    conectado,
    requiereLogin: supabaseConfigurado && !verificandoSesion && !sesion,
    preparando: supabaseConfigurado && (verificandoSesion || (Boolean(sesion) && !cargado && !errorCarga)),
    errorCarga,
    listo: cargado,
    cargando,
    usuario: sesion?.user?.email || '',
    aviso,
    iniciarSesion,
    cerrarSesion,
    recargar,
    restablecer,
    reclamarBusqueda,
    marcarCambios,
    registrarDecision,
  };
}
