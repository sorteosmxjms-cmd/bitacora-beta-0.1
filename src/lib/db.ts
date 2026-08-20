import { supabase } from './supabase';
import type {
  Persona, Producto, Venta, Chip, Pago, VentaDetalle, SaldoPersona,
  Compania, EstadoChip, EstadoPago, CategoriaProducto, LoteImportacion,
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

export async function crearProducto(nombre: string, categoria: CategoriaProducto, precio: number): Promise<Producto> {
  const { data, error } = await supabase
    .from('productos').insert({ nombre: nombre.trim(), categoria, precio }).select().single();
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

export async function actualizarVenta(
  ventaId: string,
  patch: { persona_paga_id?: string | null; cantidad?: number; precio_unitario?: number; total?: number; nota?: string | null },
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

export async function registrarPago(personaId: string, cantidad: number, nota?: string, fecha?: string): Promise<Pago> {
  const insert: Record<string, unknown> = { persona_id: personaId, cantidad, nota: nota?.trim() || null };
  if (fecha) insert.fecha = new Date(fecha).toISOString();
  const { data, error } = await supabase
    .from('pagos').insert(insert).select().single();
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

/* ---------------- Pagos / Abonos: editar y eliminar ---------------- */

export async function actualizarPago(
  pagoId: string,
  patch: { cantidad?: number; nota?: string | null; fecha?: string },
): Promise<void> {
  const { error } = await supabase.from('pagos').update(patch).eq('id', pagoId);
  if (error) throw error;
}

export async function eliminarPago(pagoId: string): Promise<void> {
  const { error } = await supabase.from('pagos').delete().eq('id', pagoId);
  if (error) throw error;
}

/* ---------------- Lotes de importación ---------------- */

export async function getLotes(): Promise<LoteImportacion[]> {
  const { data, error } = await supabase
    .from('lotes_importacion').select('*').order('fecha', { ascending: false });
  if (error) throw error;
  return (data as LoteImportacion[]).map((l) => ({
    ...l,
    total_importado: Number(l.total_importado),
  }));
}

export async function getVentasDeLote(loteId: string): Promise<VentaDetalle[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .eq('lote_id', loteId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}

export async function eliminarLote(loteId: string): Promise<{ eliminadas: number }> {
  // Delete all ventas with this lote_id, then delete the lote itself
  const { data: deleted, error: delErr } = await supabase
    .from('ventas').delete().eq('lote_id', loteId).select('id');
  if (delErr) throw delErr;
  const eliminadas = (deleted as { id: string }[])?.length ?? 0;

  const { error: loteErr } = await supabase
    .from('lotes_importacion').delete().eq('id', loteId);
  if (loteErr) throw loteErr;

  return { eliminadas };
}

/* ---------------- Importación masiva de deudas (nuevo sistema) ---------------- */

/** Column types matching the real Excel structure with FIXED historical prices */
export type TipoColumna =
  | 'persona'
  | 'chip_110' | 'chip_55' | 'chip_att_unefon'
  | 'aux_120' | 'aux_150'
  | 'cargador_120' | 'cargador_150' | 'cargador_tipo_c'
  | 'pilas'
  | 'total' | 'ignorar';

/** Fixed historical prices per column type — NEVER invented or divided */
export const PRECIOS_HISTORICOS: Record<TipoColumna, number> = {
  persona: 0,
  chip_110: 110,
  chip_55: 55,
  chip_att_unefon: 110,
  aux_120: 120,
  aux_150: 150,
  cargador_120: 120,
  cargador_150: 150,
  cargador_tipo_c: 150,
  pilas: 300,
  total: 0,
  ignorar: 0,
};

export const LABELS_COLUMNA: { value: TipoColumna; label: string; precio: number }[] = [
  { value: 'persona', label: 'Nombre / Apodo', precio: 0 },
  { value: 'chip_110', label: 'Chip $110', precio: 110 },
  { value: 'chip_55', label: 'Chip $55', precio: 55 },
  { value: 'chip_att_unefon', label: 'Chip AT&T/Unefon $110', precio: 110 },
  { value: 'aux_120', label: 'Auxiliar $120', precio: 120 },
  { value: 'aux_150', label: 'Auxiliar $150', precio: 150 },
  { value: 'cargador_120', label: 'Cargador $120', precio: 120 },
  { value: 'cargador_150', label: 'Cargador $150', precio: 150 },
  { value: 'cargador_tipo_c', label: 'Cargador Tipo C $150', precio: 150 },
  { value: 'pilas', label: 'Pilas $300', precio: 300 },
  { value: 'total', label: 'Deuda Total (validación)', precio: 0 },
  { value: 'ignorar', label: 'Ignorar columna', precio: 0 },
];

export function precioParaTipo(tipo: TipoColumna): number {
  return PRECIOS_HISTORICOS[tipo] ?? 0;
}

export function labelParaTipo(tipo: TipoColumna): string {
  return LABELS_COLUMNA.find((x) => x.value === tipo)?.label ?? tipo;
}

export function shortLabelParaTipo(tipo: TipoColumna): string {
  const map: Record<TipoColumna, string> = {
    persona: 'Persona',
    chip_110: 'Chip $110',
    chip_55: 'Chip $55',
    chip_att_unefon: 'AT&T/Unefon',
    aux_120: 'Aux $120',
    aux_150: 'Aux $150',
    cargador_120: 'Carg $120',
    cargador_150: 'Carg $150',
    cargador_tipo_c: 'Carg Tipo C',
    pilas: 'Pilas',
    total: 'Total',
    ignorar: 'Ignorar',
  };
  return map[tipo] ?? tipo;
}

export interface FilaImportacion {
  apodo: string;
  items: { tipo: TipoColumna; cantidad: number; precioUnitario: number }[];
  totalCalculado: number;
  totalExcel: number;
  diferencia: number;
  personaExistente: Persona | null;
  esNueva: boolean;
  tieneAdvertencia: boolean;
  notaAdvertencia: string;
  montoSospechoso: boolean;
}

export interface ResultadoImportacion {
  loteId: string;
  personasCreadas: number;
  ventasCreadas: number;
  errores: string[];
}

/** Words that indicate a row is NOT a person (totals, headers, etc.) */
const APODOS_INVALIDOS = ['total', 'nombre o apodo', 'nombre', 'apodo', 'deuda total', 'suma', 'gran total'];

export function esApodoInvalido(apodo: string): boolean {
  const norm = normalizarApodo(apodo).toLowerCase();
  return APODOS_INVALIDOS.includes(norm) || norm.startsWith('total') || /^\d+$/.test(norm);
}

/** Normalize apodo for comparison: uppercase, trim, collapse double spaces */
export function normalizarApodo(apodo: string): string {
  return apodo.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Find an existing persona by normalized apodo (sync, array lookup) */
export function buscarPersonaPorApodo(apodo: string, personas: Persona[]): Persona | null {
  const norm = normalizarApodo(apodo);
  return personas.find((p) => normalizarApodo(p.apodo) === norm) ?? null;
}

/** Create a persona if not found, return existing or new */
export async function ensurePersona(apodo: string, personas: Persona[]): Promise<{ persona: Persona; creada: boolean }> {
  const existing = await buscarPersonaPorApodo(apodo, personas);
  if (existing) return { persona: existing, creada: false };
  const persona = await crearPersona(apodo);
  return { persona, creada: true };
}

/** Ensure a producto exists for historical import items */
async function ensureProductoHistorico(
  nombre: string,
  categoria: CategoriaProducto,
  prodMap: Map<string, Producto>,
): Promise<Producto> {
  if (prodMap.has(nombre)) return prodMap.get(nombre)!;
  const created = await crearProducto(nombre, categoria, 0);
  prodMap.set(nombre, created);
  return created;
}

/**
 * Execute a full import with a lote_id for tracking and undo.
 * Each FilaImportacion gets one or more ventas with origen='historica'.
 */
export async function ejecutarImportacion(
  filas: FilaImportacion[],
  personasActuales: Persona[],
  notaLote?: string,
): Promise<ResultadoImportacion> {
  let personasCreadas = 0;
  let ventasCreadas = 0;
  const errores: string[] = [];

  // Load all productos for caching
  const { data: prods } = await supabase.from('productos').select('*');
  const prodMap = new Map<string, Producto>();
  for (const p of (prods as Producto[]) ?? []) {
    prodMap.set(p.nombre, p);
  }

  // Create the lote
  const totalImportado = filas.reduce((a, f) => a + f.totalCalculado, 0);
  const { data: loteData, error: loteErr } = await supabase
    .from('lotes_importacion')
    .insert({ registros: filas.length, total_importado: totalImportado, nota: notaLote?.trim() || null })
    .select().single();
  if (loteErr) throw loteErr;
  const loteId = (loteData as LoteImportacion).id;

  // Build persona cache from current list + any we create
  const personasCache = [...personasActuales];

  for (const fila of filas) {
    try {
      const apodo = fila.apodo.trim();
      if (!apodo) {
        errores.push('Fila sin apodo');
        continue;
      }

      // Find or create persona
      const { persona, creada } = await ensurePersona(apodo, personasCache);
      if (creada) {
        personasCreadas++;
        personasCache.push(persona);
      }

      if (fila.items.length === 0 && fila.totalCalculado > 0) {
        // No item breakdown — create a single manual debt entry using totalCalculado
        const prodManual = await ensureProductoHistorico('Deuda histórica (manual)', 'accesorio', prodMap);
        const { error } = await supabase.from('ventas').insert({
          producto_id: prodManual.id,
          persona_paga_id: persona.id,
          cantidad: 1,
          precio_unitario: fila.totalCalculado,
          total: fila.totalCalculado,
          estado_pago: 'pendiente',
          origen: 'historica',
          lote_id: loteId,
          nota: 'Deuda histórica importada',
        });
        if (error) throw error;
        ventasCreadas++;
        continue;
      }

      // Create one venta per item type — prices come from the column definition, NEVER invented
      for (const item of fila.items) {
        if (item.cantidad <= 0) continue;
        const prodNombre = productoNombreParaTipo(item.tipo);
        const prodCat = productoCategoriaParaTipo(item.tipo);
        const prod = await ensureProductoHistorico(prodNombre, prodCat, prodMap);

        const { error } = await supabase.from('ventas').insert({
          producto_id: prod.id,
          persona_paga_id: persona.id,
          cantidad: item.cantidad,
          precio_unitario: item.precioUnitario,
          total: item.precioUnitario * item.cantidad,
          estado_pago: 'pendiente',
          origen: 'historica',
          lote_id: loteId,
        });
        if (error) throw error;
        ventasCreadas++;
      }
    } catch (e: any) {
      errores.push(`${fila.apodo}: ${e.message}`);
    }
  }

  return { loteId, personasCreadas, ventasCreadas, errores };
}

function productoNombreParaTipo(tipo: TipoColumna): string {
  switch (tipo) {
    case 'chip_110': return 'Chip $110 (histórico)';
    case 'chip_55': return 'Chip $55 (histórico)';
    case 'chip_att_unefon': return 'Chip AT&T/Unefon $110 (histórico)';
    case 'aux_120': return 'Auxiliar $120 (histórico)';
    case 'aux_150': return 'Auxiliar $150 (histórico)';
    case 'cargador_120': return 'Cargador $120 (histórico)';
    case 'cargador_150': return 'Cargador $150 (histórico)';
    case 'cargador_tipo_c': return 'Cargador Tipo C $150 (histórico)';
    case 'pilas': return 'Pilas $300 (histórico)';
    default: return 'Deuda histórica (manual)';
  }
}

function productoCategoriaParaTipo(tipo: TipoColumna): CategoriaProducto {
  if (tipo.startsWith('chip')) return 'chip';
  return 'accesorio';
}

/** Create a single manual historical debt for one person */
export async function crearDeudaManual(
  personaId: string,
  total: number,
  nota: string,
): Promise<void> {
  // Get or create the manual debt producto
  const { data: prods } = await supabase.from('productos').select('*').eq('nombre', 'Deuda histórica (manual)');
  let prodId: string;
  if (prods && prods.length > 0) {
    prodId = (prods[0] as Producto).id;
  } else {
    const p = await crearProducto('Deuda histórica (manual)', 'accesorio', 0);
    prodId = p.id;
  }

  const { error } = await supabase.from('ventas').insert({
    producto_id: prodId,
    persona_paga_id: personaId,
    cantidad: 1,
    precio_unitario: total,
    total,
    estado_pago: 'pendiente',
    origen: 'historica',
    nota: nota.trim() || null,
  });
  if (error) throw error;
}

/** Delete a single historical debt (venta) and its related chips */
export async function eliminarDeuda(ventaId: string): Promise<void> {
  const { error } = await supabase.from('ventas').delete().eq('id', ventaId);
  if (error) throw error;
}

/** Get all historical ventas (origen='historica') with persona and producto info */
export async function getVentasHistoricas(): Promise<VentaDetalle[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .eq('origen', 'historica')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}

/** Delete multiple ventas by ID (batch) — returns count deleted */
export async function eliminarVentasBatch(ventaIds: string[]): Promise<{ eliminadas: number }> {
  if (ventaIds.length === 0) return { eliminadas: 0 };
  const { data: deleted, error } = await supabase
    .from('ventas').delete().in('id', ventaIds).select('id');
  if (error) throw error;
  return { eliminadas: (deleted as { id: string }[])?.length ?? 0 };
}

/** Get all ventas with origen='historica' and no lote_id (old imports before lote system) */
export async function getVentasHistoricasSinLote(): Promise<VentaDetalle[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      producto:productos(*),
      persona_usa:personas!ventas_persona_usa_id_fkey(*),
      persona_paga:personas!ventas_persona_paga_id_fkey(*),
      chip:chips(*)
    `)
    .eq('origen', 'historica')
    .is('lote_id', null)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return normalizeVentas(data as unknown as VentaDetalle[]);
}
