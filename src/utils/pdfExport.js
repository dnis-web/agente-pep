import jsPDF from 'jspdf';

export function exportarBitacoraPDF(state) {
  const { bitacora, candidatos, clientes, analista } = state;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - M * 2;
  let y = 0;

  const C = {
    primario:   [15, 52, 96],
    secundario: [30, 100, 180],
    acento:     [255, 140, 0],
    fondo:      [245, 248, 252],
    texto:      [25, 25, 25],
    suave:      [100, 110, 120],
    blanco:     [255, 255, 255],
  };

  function addFooter() {
    doc.setFillColor(...C.primario);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setTextColor(...C.blanco);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const p = doc.internal.getCurrentPageInfo().pageNumber;
    const t = doc.internal.getNumberOfPages();
    doc.text('Vigía PEP — Bitácora Auditable · Datos sintéticos · Uso académico', M, H - 3.5);
    doc.text(`Página ${p} de ${t}`, W - M, H - 3.5, { align: 'right' });
  }

  function checkPage(n = 20) {
    if (y + n > H - 14) {
      addFooter();
      doc.addPage();
      y = 22;
    }
  }

  function body(text, indent = 0) {
    const lines = doc.splitTextToSize(text, CW - indent);
    checkPage(lines.length * 5 + 2);
    doc.text(lines, M + indent, y);
    y += lines.length * 5 + 2;
  }

  // ── ENCABEZADO ──
  doc.setFillColor(...C.primario);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFillColor(...C.acento);
  doc.rect(0, 28, W, 3, 'F');
  doc.setTextColor(...C.blanco);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('VIGÍA PEP · BITÁCORA DE DECISIONES', W / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 210, 255);
  doc.text('Agente Inteligente para Monitoreo de Nuevos PEP · Datos sintéticos · Prototipo académico', W / 2, 20, { align: 'center' });
  doc.setTextColor(255, 200, 100);
  doc.text(`Generado: ${new Date().toLocaleString('es-GT')} · Analista: ${analista}`, W / 2, 25.5, { align: 'center' });
  y = 38;

  // ── RESUMEN ──
  const total = candidatos.length;
  const aceptados = candidatos.filter(c => c.decision === 'Aceptado').length;
  const rechazados = candidatos.filter(c => c.decision === 'Rechazado').length;
  const investigar = candidatos.filter(c => c.decision === 'Investigar').length;
  const pendientes = candidatos.filter(c => !c.decision).length;

  doc.setFillColor(...C.fondo);
  doc.roundedRect(M, y, CW, 24, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primario);
  doc.text('RESUMEN EJECUTIVO', M + 4, y + 7);

  const stats = [
    ['Total candidatos', String(total)],
    ['Aceptados (PEP)', String(aceptados)],
    ['Rechazados', String(rechazados)],
    ['Para investigar', String(investigar)],
    ['Pendientes', String(pendientes)],
  ];
  const colW = CW / stats.length;
  stats.forEach(([label, val], i) => {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.secundario);
    doc.text(val, M + colW * i + colW / 2, y + 16, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.suave);
    doc.text(label, M + colW * i + colW / 2, y + 21, { align: 'center' });
  });
  y += 30;

  // ── CANDIDATOS ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primario);
  doc.text('CANDIDATOS Y DECISIONES', M, y);
  y += 8;

  const colorPrioridad = (p) => p === 'Alta' ? [192, 57, 43] : p === 'Media' ? [230, 126, 34] : [39, 174, 96];
  const colorDec = (d) => d === 'Aceptado' ? [39, 174, 96] : d === 'Rechazado' ? [192, 57, 43] : d === 'Investigar' ? [41, 128, 185] : [150, 150, 150];

  candidatos.forEach((cand, i) => {
    const cliente = clientes.find(c => c.id === cand.clienteId);
    const noticia = state.noticias.find(n => n.id === cand.noticiaId);
    checkPage(55);

    // Cabecera candidato
    doc.setFillColor(...colorPrioridad(cand.prioridad));
    doc.roundedRect(M, y, CW, 8, 2, 2, 'F');
    doc.setTextColor(...C.blanco);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}. ${cand.nombreExtraido} · ${cand.cargoExtraido}`, M + 3, y + 5.5);
    doc.text(`SCORE ${cand.score} · ${cand.prioridad.toUpperCase()}`, W - M - 3, y + 5.5, { align: 'right' });
    y += 10;

    doc.setTextColor(...C.texto);
    doc.setFontSize(8.5);

    // Info
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.suave);
    doc.text('Cliente relacionado:', M + 2, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.texto);
    doc.text(`${cand.clienteId} · ${cliente?.nombre || '-'}`, M + 40, y);
    y += 5;

    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.suave);
    doc.text('Evento:', M + 2, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.texto);
    doc.text(`${cand.evento} · Fuente: ${cand.fuente} · ${cand.fecha}`, M + 40, y);
    y += 5;

    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.suave);
    doc.text('Fragmento:', M + 2, y);
    y += 4;
    doc.setFont('helvetica', 'italic'); doc.setTextColor(60, 60, 80);
    const frLines = doc.splitTextToSize(`"${cand.fragmento}"`, CW - 6);
    checkPage(frLines.length * 4.5 + 4);
    doc.text(frLines, M + 4, y);
    y += frLines.length * 4.5 + 2;

    // Score detalle
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.suave);
    doc.text('Score detalle:', M + 2, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.texto);
    const d = cand.scoreDetalle;
    const scoreItems = [];
    if (d.nombreCompleto) scoreItems.push(`+${d.nombreCompleto} nombre completo`);
    if (d.nombreParcial) scoreItems.push(`+${d.nombreParcial} nombre parcial`);
    if (d.cargoAltoNivel) scoreItems.push(`+${d.cargoAltoNivel} cargo alto nivel`);
    if (d.cargoLocal) scoreItems.push(`+${d.cargoLocal} cargo local`);
    if (d.fuenteConfiable) scoreItems.push(`+${d.fuenteConfiable} fuente confiable`);
    if (d.noticiaReciente) scoreItems.push(`+${d.noticiaReciente} noticia reciente`);
    if (d.datoConfirma) scoreItems.push(`+${d.datoConfirma} dato confirma`);
    if (d.datosContradictorios) scoreItems.push(`${d.datosContradictorios} datos contradictorios`);
    const scoreLines = doc.splitTextToSize(scoreItems.join('  ·  '), CW - 6);
    checkPage(scoreLines.length * 4.5 + 2);
    doc.text(scoreLines, M + 4, y);
    y += scoreLines.length * 4.5 + 3;

    // Decisión
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorDec(cand.decision));
    doc.text(`Decisión: ${cand.decision || 'PENDIENTE'}`, M + 2, y);
    y += 5;
    if (cand.motivoDecision) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.texto);
      const mLines = doc.splitTextToSize(`Motivo: ${cand.motivoDecision}`, CW - 6);
      checkPage(mLines.length * 4.5 + 2);
      doc.text(mLines, M + 4, y);
      y += mLines.length * 4.5 + 2;
    }
    if (cand.fechaDecision) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.suave);
      doc.text(`${cand.analista} · ${new Date(cand.fechaDecision).toLocaleString('es-GT')}`, M + 4, y);
      y += 5;
    }
    y += 4;

    // Separador
    doc.setDrawColor(...C.fondo);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + CW, y);
    y += 5;
  });

  // ── BITÁCORA ──
  checkPage(15);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primario);
  doc.text('BITÁCORA DE AUDITORÍA', M, y);
  y += 8;

  if (bitacora.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.suave);
    doc.text('No hay decisiones registradas en la bitácora.', M, y);
    y += 6;
  } else {
    bitacora.forEach((entrada, i) => {
      // Calcular altura dinámica según contenido
      const tituloLines = doc.splitTextToSize(
        `${i + 1}. ${entrada.analista} · ${entrada.decision} · ${entrada.candidatoNombre}`,
        CW - 6
      );
      const motivoLines = entrada.motivo
        ? doc.splitTextToSize(`Motivo: ${entrada.motivo}`, CW - 6)
        : [];
      const totalH = (tituloLines.length + motivoLines.length) * 5 + 14;
      checkPage(totalH + 4);

      doc.setFillColor(...C.fondo);
      doc.roundedRect(M, y, CW, totalH, 2, 2, 'F');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.primario);
      doc.text(tituloLines, M + 3, y + 6);

      let yOffset = y + 6 + tituloLines.length * 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.suave);
      doc.text(new Date(entrada.fecha).toLocaleString('es-GT'), M + 3, yOffset);
      yOffset += 5;

      if (motivoLines.length > 0) {
        doc.setTextColor(...C.texto);
        doc.text(motivoLines, M + 3, yOffset);
        yOffset += motivoLines.length * 5;
      }

      y += totalH + 5;
    });
  }

  // Footers en todas las páginas
  const total2 = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total2; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.primario);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setTextColor(...C.blanco);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Vigía PEP — Bitácora Auditable · Datos sintéticos · Prototipo académico', M, H - 3.5);
    doc.text(`Página ${p} de ${total2}`, W - M, H - 3.5, { align: 'right' });
  }

  doc.save('VigiaPEP_Bitacora.pdf');
}
