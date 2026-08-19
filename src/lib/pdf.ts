import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ResumenPersona } from './reporte';
import { moneda, fechaLarga, horaCorta, companiaLabel } from './format';

interface TotalesReporte {
  chips: number;
  cargadores: number;
  auriculares: number;
  telefonos: number;
  total: number;
}

export async function generatePDF(
  fechaISO: string,
  porPersona: ResumenPersona[],
  totales: TotalesReporte,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Bitacora — Reporte de Ventas', margin, 20);

  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha: ${fechaLarga(fechaISO)}`, margin, 28);

  // Totals summary box
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const resumenLine = `Chips: ${totales.chips}  |  Cargadores: ${totales.cargadores}  |  Auxiliares: ${totales.auriculares}  |  Telefonos: ${totales.telefonos}  |  TOTAL: ${moneda(totales.total)}`;
  doc.text(resumenLine, margin, 36);

  // Separator
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, 40, pageW - margin, 40);

  // Per-person summary table
  autoTable(doc, {
    startY: 44,
    head: [['Persona', 'Chips', 'Carg.', 'Aux.', 'Tel.', 'Total']],
    body: porPersona.map((p) => [
      p.apodo,
      String(p.chips),
      String(p.cargadores),
      String(p.auriculares),
      String(p.telefonos),
      moneda(p.total),
    ]),
    foot: [['TOTAL', String(totales.chips), String(totales.cargadores), String(totales.auriculares), String(totales.telefonos), moneda(totales.total)]],
    theme: 'striped',
    headStyles: { fillColor: [27, 111, 255], textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { halign: 'center' as const },
      2: { halign: 'center' as const },
      3: { halign: 'center' as const },
      4: { halign: 'center' as const },
      5: { halign: 'right' as const },
    },
    margin: { left: margin, right: margin },
  });

  // Detail tables per person
  let y = (doc as any).lastAutoTable.finalY + 8;

  for (const persona of porPersona) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${persona.apodo} — ${moneda(persona.total)}`, margin, y);
    y += 4;

    const detalleRows = persona.desglose.map((v) => {
      if (v.chip) {
        return [
          horaCorta(v.fecha),
          `Chip ${companiaLabel(v.chip.compania)}`,
          v.chip.numero,
          `·${v.chip.ultimos4}`,
          v.persona_usa?.apodo ?? '—',
          moneda(Number(v.total)),
        ];
      }
      return [
        horaCorta(v.fecha),
        v.producto?.nombre ?? 'Producto',
        String(v.cantidad),
        '',
        v.persona_usa?.apodo ?? '—',
        moneda(Number(v.total)),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Producto', 'Numero', 'Ult4', 'Usa', 'Total']],
      body: detalleRows,
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [71, 85, 105] },
      columnStyles: {
        0: { cellWidth: 18 },
        5: { halign: 'right' as const },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Pagina ${i} de ${pageCount}`,
      pageW - margin - 20,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  const filename = `reporte_${fechaISO}.pdf`;
  doc.save(filename);
}
