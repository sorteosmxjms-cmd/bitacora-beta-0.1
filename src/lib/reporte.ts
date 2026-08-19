import type { VentaDetalle } from './types';

export interface ResumenPersona {
  apodo: string;
  chips: number;
  cargadores: number;
  auriculares: number;
  telefonos: number;
  total: number;
  desglose: VentaDetalle[];
}

export function buildResumen(ventas: VentaDetalle[]): {
  porPersona: ResumenPersona[];
  totales: { chips: number; cargadores: number; auriculares: number; telefonos: number; total: number };
} {
  const map = new Map<string, ResumenPersona>();

  for (const v of ventas) {
    const pid = v.persona_paga?.id ?? 'sin-persona';
    const apodo = v.persona_paga?.apodo ?? 'SIN PERSONA';
    const entry = map.get(pid) ?? {
      apodo,
      chips: 0,
      cargadores: 0,
      auriculares: 0,
      telefonos: 0,
      total: 0,
      desglose: [] as VentaDetalle[],
    };

    if (v.chip) entry.chips++;
    if (v.producto?.categoria === 'accesorio' && v.producto?.nombre === 'Cargador') entry.cargadores += v.cantidad;
    if (v.producto?.categoria === 'accesorio' && v.producto?.nombre === 'Auriculares') entry.auriculares += v.cantidad;
    if (v.producto?.categoria === 'telefono') entry.telefonos += v.cantidad;
    entry.total += Number(v.total);
    entry.desglose.push(v);

    map.set(pid, entry);
  }

  const porPersona = Array.from(map.values()).sort((a, b) => b.total - a.total);

  const totales = porPersona.reduce(
    (acc, p) => ({
      chips: acc.chips + p.chips,
      cargadores: acc.cargadores + p.cargadores,
      auriculares: acc.auriculares + p.auriculares,
      telefonos: acc.telefonos + p.telefonos,
      total: acc.total + p.total,
    }),
    { chips: 0, cargadores: 0, auriculares: 0, telefonos: 0, total: 0 },
  );

  return { porPersona, totales };
}
