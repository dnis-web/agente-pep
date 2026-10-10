import { useState, useEffect, useRef } from 'react';
import { loadState, saveState, clearState } from './utils/storage';
import { clientesIniciales, noticiasIniciales, candidatosIniciales } from './data/inicial';
import Navbar from './components/Navbar';
import Bandeja from './components/Bandeja';
import Clientes from './components/Clientes';
import Noticias from './components/Noticias';
import Bitacora from './components/Bitacora';
import Metricas from './components/Metricas';
import './index.css';

const ESTADO_INICIAL = {
  clientes: clientesIniciales,
  noticias: noticiasIniciales,
  candidatos: candidatosIniciales,
  bitacora: [],
  analista: 'Ana (Analista de Cumplimiento)',
};

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [vista, setVista] = useState('bandeja');
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    saveState(state);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(true);
    toastTimer.current = setTimeout(() => setToast(false), 1600);
  }, [state]);

  function handleRestablecer() {
    if (!confirm('¿Restablecer todos los datos originales? Se perderán los cambios, decisiones y bitácora actuales.')) return;
    clearState();
    // Deep copy para evitar mutaciones del objeto original
    setState(JSON.parse(JSON.stringify(ESTADO_INICIAL)));
    setVista('bandeja');
  }

  function handleDecision(candidatoId, decision, motivo) {
    const ahora = new Date().toISOString();
    const candidato = state.candidatos.find(c => c.id === candidatoId);

    const nuevosCandidatos = state.candidatos.map(c =>
      c.id === candidatoId
        ? { ...c, decision, motivoDecision: motivo, analista: state.analista, fechaDecision: ahora }
        : c
    );

    const nuevaEntrada = {
      candidatoId,
      candidatoNombre: candidato?.nombreExtraido || candidatoId,
      decision,
      motivo,
      analista: state.analista,
      fecha: ahora,
    };

    setState({
      ...state,
      candidatos: nuevosCandidatos,
      bitacora: [...state.bitacora, nuevaEntrada],
    });
  }

  const pendientes = state.candidatos.filter(c => !c.decision).length;

  return (
    <>
      <Navbar
        vistaActiva={vista}
        onCambiarVista={setVista}
        pendientes={pendientes}
        onRestablecer={handleRestablecer}
      />
      <div className="app-main">
        {vista === 'bandeja'  && <Bandeja  state={state} onDecision={handleDecision} />}
        {vista === 'clientes' && <Clientes state={state} onChange={setState} />}
        {vista === 'noticias' && <Noticias state={state} onChange={setState} />}
        {vista === 'bitacora' && <Bitacora state={state} />}
        {vista === 'metricas' && <Metricas state={state} />}
      </div>
      {toast && <div className="autosave-toast">✓ Guardado</div>}
    </>
  );
}
