import { useState } from 'react';
import { Package, Pencil, Check, X, Cpu, Battery, Headphones, Smartphone } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { actualizarPrecioProducto } from '@/lib/db';
import { moneda } from '@/lib/format';
import type { CategoriaProducto, Producto } from '@/lib/types';

const CATEGORIA_LABEL: Record<CategoriaProducto, string> = {
  chip: 'Chips',
  accesorio: 'Accesorios',
  telefono: 'Teléfonos',
};

const ICONO: Record<string, typeof Cpu> = {
  chip: Cpu,
  accesorio: Battery,
  telefono: Smartphone,
};

export function ProductosPage() {
  const { productos, refreshProductos } = useApp();
  const [editando, setEditando] = useState<Producto | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const porCategoria = (cat: CategoriaProducto) => productos.filter((p) => p.categoria === cat);

  const startEdit = (p: Producto) => {
    setEditando(p);
    setNuevoPrecio(String(Number(p.precio)));
    setError(null);
  };

  const save = async () => {
    if (!editando) return;
    const precio = Number(nuevoPrecio);
    if (isNaN(precio) || precio < 0) { setError('Precio inválido.'); return; }
    setSaving(true);
    setError(null);
    try {
      await actualizarPrecioProducto(editando.id, precio);
      await refreshProductos();
      setEditando(null);
    } catch (e: any) {
      setError(e.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Package size={22} className="text-brand-400" />
          Productos
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Catálogo y precios — los cambios no afectan ventas anteriores.</p>
      </div>

      <div className="space-y-6">
        {(['chip', 'accesorio', 'telefono'] as CategoriaProducto[]).map((cat) => {
          const Icon = ICONO[cat];
          const items = porCategoria(cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Icon size={13} /> {CATEGORIA_LABEL[cat]}
              </h3>
              <div className="card overflow-hidden divide-y divide-ink-700/40">
                {items.map((p) => {
                  const IconProd = p.nombre.includes('Auriculares') ? Headphones
                    : p.nombre.includes('Cargador') ? Battery
                    : p.nombre.includes('Teléfono') ? Smartphone : Cpu;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="grid place-items-center w-8 h-8 rounded-lg bg-ink-800 border border-ink-700 text-slate-400">
                        <IconProd size={15} />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-slate-100">{p.nombre}</span>
                        {p.categoria === 'chip' && (
                          <span className="ml-2 text-xs text-slate-600">precio inicial del chip</span>
                        )}
                      </div>
                      {editando?.id === p.id ? (
                        <div className="flex items-center gap-2">
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <input
                              type="number"
                              value={nuevoPrecio}
                              onChange={(e) => setNuevoPrecio(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && save()}
                              autoFocus
                              className="input-base pl-7 py-1.5 font-mono"
                            />
                          </div>
                          <button onClick={save} disabled={saving} className="p-1.5 rounded-lg text-mint-400 hover:bg-mint-600/15">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditando(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-ink-800">
                            <X size={16} />
                          </button>
                          {error && <span className="text-xs text-rose-400">{error}</span>}
                        </div>
                      ) : (
                        <>
                          <span className="font-mono font-semibold text-mint-300 w-24 text-right">{moneda(Number(p.precio))}</span>
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-ink-800 transition"
                          >
                            <Pencil size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 card-soft px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
        <Package size={14} className="mt-0.5 shrink-0" />
        <span>Los precios se guardan por venta al momento de registrar. Modificar un precio aquí no cambia el historial.</span>
      </div>
    </div>
  );
}
