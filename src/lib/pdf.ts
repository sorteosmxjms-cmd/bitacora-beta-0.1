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

const BRAND_COLOR: [number, number, number] = [27, 111, 255];
const DARK_COLOR: [number, number, number] = [15, 23, 42];
const GRAY_COLOR: [number, number, number] = [100, 116, 139];
const LIGHT_GRAY: [number, number, number] = [241, 245, 249];

export async function generatePDF(
  fechaISO: string,
  porPersona: ResumenPersona[],
  totales: TotalesReporte,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;

  // ===== HEADER BAR =====
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BITACORA', margin, 15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte de Ventas Diario', margin, 23);

  // Date on right
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const fechaStr = fechaLarga(fechaISO);
  doc.text(fechaStr, pageW - margin, 15, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 255);
  const hoy = new Date();
  doc.text(
    `Generado: ${hoy.toLocaleDateString('es-MX')} ${hoy.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
    pageW - margin, 23, { align: 'right' },
  );

  // ===== SUMMARY CARDS =====
  let y = 42;
  const cardW = (pageW - margin * 2 - 12) / 5;
  const cards = [
    { label: 'CHIPS', value: String(totales.chips), color: BRAND_COLOR },
    { label: 'CARGADORES', value: String(totales.cargadores), color: [100, 116, 139] as [number, number, number] },
    { label: 'AUXILIARES', value: String(totales.auriculares), color: [100, 116, 139] as [number, number, number] },
    { label: 'TELEFONOS', value: String(totales.telefonos), color: [100, 116, 139] as [number, number, number] },
    { label: 'TOTAL', value: moneda(totales.total), color: [16, 185, 129] as [number, number, number] },
  ];

  for (const card of cards) {
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin + (cardW + 3) * cards.indexOf(card), y, cardW, 18, 2, 2, 'F');
    doc.setTextColor(...GRAY_COLOR);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(card.label, margin + (cardW + 3) * cards.indexOf(card) + 3, y + 6);
    doc.setTextColor(...card.color);
    doc.setFontSize(13);
    doc.text(card.value, margin + (cardW + 3) * cards.indexOf(card) + 3, y + 14);
  }

  y += 26;

  // ===== SECTION: RESUMEN POR PERSONA =====
  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen por Persona', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
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
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    footStyles: { fillColor: DARK_COLOR, textColor: 255, fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' as const },
      1: { halign: 'center' as const },
      2: { halign: 'center' as const },
      3: { halign: 'center' as const },
      4: { halign: 'center' as const },
      5: { halign: 'right' as const, fontStyle: 'bold' as const },
    },
    margin: { left: margin, right: margin },
  });

  // ===== SECTION: DETALLE POR PERSONA =====
  y = (doc as any).lastAutoTable.finalY + 12;

  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle por Persona', margin, y);
  y += 4;

  for (const persona of porPersona) {
    if (y > pageH - 50) {
      doc.addPage();
      y = 20;
    }

    // Person header bar
    doc.setFillColor(...BRAND_COLOR);
    doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(persona.apodo, margin + 3, y + 5);
    doc.text(moneda(persona.total), pageW - margin - 3, y + 5, { align: 'right' });
    y += 9;

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
        `${v.cantidad} pza`,
        '',
        v.persona_usa?.apodo ?? '—',
        moneda(Number(v.total)),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Producto', 'Detalle', 'Ult4', 'Usa', 'Total']],
      body: detalleRows,
      theme: 'grid',
      headStyles: { fillColor: LIGHT_GRAY, textColor: [71, 85, 105], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [71, 85, 105] },
      alternateRowStyles: { fillColor: [252, 253, 255] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 30 },
        5: { halign: 'right' as const, fontStyle: 'bold' as const },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer line
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_COLOR);
    doc.setFont('helvetica', 'normal');
    doc.text('Bitacora - Gestion de Chips', margin, pageH - 7);
    doc.text(`Pagina ${i} de ${pageCount}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  const filename = `reporte_${fechaISO}.pdf`;
  doc.save(filename);
}
