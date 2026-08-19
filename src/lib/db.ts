import { supabase } from './supabase';
import type {
  Persona, Producto, Venta, Chip, Pago, VentaDetalle, SaldoPersona,
  Compania, EstadoChip, EstadoPago,
} from './types';

/**
 * Supabase may return the chip relation as an array (to-many) or object (to-one).
 * Normalize to a single object or null so the rest of the app can use `chip.numero`.
 */
function normalizeChip<T extends { chip?: Chip | Chip[] | null }>(venta: T): T {
  if (Array.isArray(venta.chip)) {
    return { ...venta, chip: venta.chip[0] ?? null };
  }
  return venta;
}

function normalizeVentas<T extends { chip?: Chip | Chip[] | null }>(ventas: T[]): T[] {
  return ventas.map(normalizeChip);
}

/* ---------------- Personas ---------------- */

export async function getPersonas(): Promise<Persona[]> {
  const { data, error } = await supabase
    .from('personas').select('*').order('apodo', { ascending: true });
  if (error) throw error;
  return data as Persona[];
}

export async function getPersonasActivas(): Promise<Persona[]> {
  const { data, error } = await supabase
    .from('personas').select('*').eq('activo', true).order('apodo', { ascending: true });
  if (error) throw error;
  return data as Persona[];
}

export async function crearPersona(apodo: string): Promise<Persona> {
  const { data, error } = await supabase
    .from('personas').insert({ apodo: apodo.trim().toUpperCase() }).select().single();
  if (error) throw error;
  return data as Persona;
}

export async function crearPersonasBatch(apodos: string[]): Promise<{ creadas: number; duplicadas: string[] }> {
  const unicos = [...new Set(apodos.map((a) => a.trim().toUpperCase()).filter(Boolean))];
  if (unicos.length === 0) return { creadas: 0, duplicadas: [] };

  // Check which already exist
  const { data: existentes } = await supabase
    .from('personas').select('apodo').in('apodo', unicos);
  const existSet = new Set((existentes as Persona[] | null)?.map((p) => p.apodo) ?? []);
  const duplicadas = unicos.filter((a) => existSet.has(a));
  const nuevos = unicos.filter((a) => !existSet.has(a));

  if (nuevos.length === 0) return { creadas: 0, duplicadas };

  const { error } = await supabase
    .from('personas').insert(nuevos.map((apodo) => ({ apodo })));
  if (error) throw error;
  return { creadas: nuevos.length, duplicadas };
}

export async function actualizarPersona(id: string, patch: Partial<Pick<Persona, 'apodo' | 'activo'>>): Promise<Persona> {
  const { data, error } = await supabase
    .from('personas').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Persona;
}

export async function eliminarPersona(id: string): Promise<void> {
  const { error } = await supabase.from('personas').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------- Productos ---------------- */

export async function getProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos').select('*').order('categoria', { ascending: true }).order('nombre', { ascending: true });
  if (error) throw error;
  return data as Producto[];
}

export async function actualizarPrecioProducto(id: string, precio: number): Promise<Producto> {
  const { data, error } = await supabase
    .from('productos').update({ precio }).eq('id', id).select().single();
  if (error) throw error;
  return data as Producto;
}

/* ---------------- Ventas + Chips ---------------- */

export interface NuevoChipInput {
  numero: string;
  compania: Compania;
  ultimos4: string;
  persona_usa_id: string | null;
  persona_paga_id: string | null;
  producto_id: string;
  precio_unitario: number;
}

export async function registrarChip(input: NuevoChipInput): Promise<{ venta: Venta; chip: Chip }> {
  // Insert venta first, then chip linked to it.
  const { data: ventaData, error: ventaErr } = await supabase
    .from('ventas').insert({
      producto_id: input.producto_id,
      persona_usa_id: input.persona_usa_id,
      persona_paga_id: input.persona_paga_id,
      cantidad: 1,
      precio_unitario: input.precio_unitario,
      total: input.precio_unitario,
      estado_pago: 'pendiente',
    }).select().single();
  if (ventaErr) throw ventaErr;
  const venta = ventaData as Venta;

  const { data: chipData, error: chipErr } = await supabase
    .from('chips').insert({
      venta_id: venta.id,
      numero: input.numero,
      compania: input.compania,
      ultimos4: input.ultimos4,
      estado_chip: 'en_uso',
    }).select().single();
  if (chipErr) {
    // Best-effort cleanup of orphaned venta.
    await supabase.from('ventas').delete().eq('id', venta.id);
    throw chipErr;
  }
  return { venta, chip: chipData as Chip };
}

export interface NuevaVentaProductoInput {
  producto_id: string;
  cantidad: number;
  persona_usa_id: string | null;
  persona_paga_id: string | null;
  precio_unitario: number;
}

export async function registrarVentaProducto(input: NuevaVentaProductoInput): Promise<Venta> {
  const { data, error } = await supabase
    .from('ventas').insert({
      producto_id: input.producto_id,
      persona_usa_id: input.persona_usa_id,
      persona_paga_id: input.persona_paga_id,
      cantidad: input.cantidad,
      precio_unitario: input.precio_unitario,
      total: input.precio_unitario * input.cantidad,
      estado_pago: 'pendiente',
    }).select().single();
  if (error) throw error;
  return data as Venta;
}

export async function getVentasDetalle(): Promise<VentaDetalle[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}

export async function getVentasDePersona(personaId: string): Promise<VentaDetalle[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .eq('persona_paga_id', personaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}

export async function buscarChips(params: {
  numero?: string;
  ultimos4?: string;
  compania?: Compania | '';
  personaUsa?: string;
  personaPaga?: string;
  estado?: EstadoChip | '';
}): Promise<VentaDetalle[]> {
  let q = supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .not('chip', 'is', null);

  if (params.numero) q = q.ilike('chip.numero', `%${params.numero}%`);
  if (params.ultimos4) q = q.eq('chip.ultimos4', params.ultimos4);
  if (params.compania) q = q.eq('chip.compania', params.compania);
  if (params.estado) q = q.eq('chip.estado_chip', params.estado);
  if (params.personaUsa) {
    q = q.ilike('persona_usa.apodo', `%${params.personaUsa}%`);
  }
  if (params.personaPaga) {
    q = q.ilike('persona_paga.apodo', `%${params.personaPaga}%`);
  }

  const { data, error } = await q.order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas((data as unknown as VentaDetalle[])).filter((v) => v.chip);
}

export async function setEstadoChip(chipId: string, estado: EstadoChip): Promise<Chip> {
  const { data, error } = await supabase
    .from('chips').update({ estado_chip: estado }).eq('id', chipId).select().single();
  if (error) throw error;
  return data as Chip;
}

export async function eliminarVenta(ventaId: string): Promise<void> {
  // chips are ON DELETE CASCADE linked to ventas, so deleting the venta removes the chip too
  const { error } = await supabase.from('ventas').delete().eq('id', ventaId);
  if (error) throw error;
}

export async function actualizarVentaPersona(
  ventaId: string,
  patch: { persona_usa_id?: string | null; persona_paga_id?: string | null },
): Promise<void> {
  const { error } = await supabase.from('ventas').update(patch).eq('id', ventaId);
  if (error) throw error;
}

export async function getVentasHoy(): Promise<VentaDetalle[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .gte('fecha', start)
    .lt('fecha', end)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}

export async function getVentasPorFecha(fechaISO: string): Promise<VentaDetalle[]> {
  // fechaISO = 'YYYY-MM-DD' (local date string). Query that calendar day.
  const [y, m, d] = fechaISO.split('-').map(Number);
  const start = new Date(y, m - 1, d).toISOString();
  const end = new Date(y, m - 1, d + 1).toISOString();
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .gte('fecha', start)
    .lt('fecha', end)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}

export async function getDiasConVentas(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('fecha')
    .order('fecha', { ascending: false });
  if (error) throw error;
  const dias = new Set<string>();
  for (const row of data as { fecha: string }[]) {
    const d = new Date(row.fecha);
    dias.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return Array.from(dias).sort().reverse();
}

/* ---------------- Pagos / Saldos ---------------- */

export async function getSaldos(): Promise<SaldoPersona[]> {
  const { data, error } = await supabase
    .from('vista_saldos').select('*').order('saldo', { ascending: false });
  if (error) throw error;
  return (data as SaldoPersona[]).map((s) => ({
    ...s,
    total_vendido: Number(s.total_vendido),
    total_abonado: Number(s.total_abonado),
    saldo: Number(s.saldo),
  }));
}

export async function getPagosDePersona(personaId: string): Promise<Pago[]> {
  const { data, error } = await supabase
    .from('pagos').select('*').eq('persona_id', personaId).order('fecha', { ascending: false });
  if (error) throw error;
  return data as Pago[];
}

export async function registrarPago(personaId: string, cantidad: number, nota?: string): Promise<Pago> {
  const { data, error } = await supabase
    .from('pagos').insert({ persona_id: personaId, cantidad, nota: nota?.trim() || null }).select().single();
  if (error) throw error;
  return data as Pago;
}

/**
 * Compute the effective payment state of a set of ventas vs. total pagos.
 * The DB's estado_pago column is informational; this is the source of truth.
 */
export function calcularEstadoPago(totalVenta: number, totalPagos: number): EstadoPago {
  if (totalPagos <= 0) return 'pendiente';
  if (totalPagos >= totalVenta) return 'liquidado';
  return 'abonado';
}
