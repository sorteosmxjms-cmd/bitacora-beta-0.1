export type Compania = 'telcel' | 'att' | 'unefon';
export type EstadoChip = 'en_uso' | 'baja';
export type EstadoPago = 'pendiente' | 'abonado' | 'liquidado';
export type CategoriaProducto = 'chip' | 'accesorio' | 'telefono';
export type OrigenVenta = 'venta' | 'historica';

export interface Persona {
  id: string;
  apodo: string;
  activo: boolean;
  creado_en: string;
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  precio: number;
  activo: boolean;
  creado_en: string;
}

export interface Venta {
  id: string;
  fecha: string;
  producto_id: string;
  persona_usa_id: string | null;
  persona_paga_id: string | null;
  cantidad: number;
  precio_unitario: number;
  total: number;
  estado_pago: EstadoPago;
  origen: OrigenVenta;
  nota: string | null;
  lote_id: string | null;
}

export interface Chip {
  id: string;
  venta_id: string;
  numero: string;
  compania: Compania;
  ultimos4: string;
  estado_chip: EstadoChip;
  creado_en: string;
}

export interface Pago {
  id: string;
  persona_id: string;
  cantidad: number;
  fecha: string;
  nota: string | null;
}

/** Venta joined with product and personas for display. */
export interface VentaDetalle extends Venta {
  producto?: Producto;
  persona_usa?: Persona | null;
  persona_paga?: Persona | null;
  chip?: Chip | null;
}

export interface SaldoPersona {
  persona_id: string;
  apodo: string;
  total_vendido: number;
  total_abonado: number;
  saldo: number;
}

export interface LoteImportacion {
  id: string;
  fecha: string;
  registros: number;
  total_importado: number;
  nota: string | null;
}
