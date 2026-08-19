import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save, Zap, ShoppingCart, Cpu, Headphones, Smartphone, Battery, RotateCcw, Clock, Trash2, Pencil, X } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { PersonAutocomplete, type PersonAutocompleteRef } from '@/components/PersonAutocomplete';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { registrarChip, registrarVentaProducto, getVentasHoy, eliminarVenta, actualizarVentaPersona } from '@/lib/db';
import { moneda, companiaLabel, companiaColor, horaCorta, estadoChipLabel, estadoChipColor } from '@/lib/format';
import type { Compania, Persona, Producto, VentaDetalle } from '@/lib/types';

type Modo = 'chip' | 'producto';

const COMPANIAS: { key: Compania; label: string; hotkey: string }[] = [
  { key: 'telcel', label: 'Telcel', hotkey: 'T' },
  { key: 'att', label: 'AT&T', hotkey: 'A' },
  { key: 'unefon', label: 'Unefon', hotkey: 'U' },
];

const PRODUCTO_ICONOS: Record<string, typeof Cpu> = {
  'Cargador': Battery,
  'Auriculares': Headphones,
  'Teléfono básico': Smartphone,
  'Teléfono Android': Smartphone,
};

export function VentasPage() {
  const { personas, productos, addPersonaLocal } = useApp();

  const chipProductos = useMemo(() => productos.filter((p) => p.categoria === 'chip'), [productos]);
  const otrosProductos = useMemo(() => productos.filter((p) => p.categoria !== 'chip'), [productos]);

  const [modo, setModo] = useState<Modo>('chip');

  // Shared state — always separate usa/paga
  const [personaUsa, setPersonaUsa] = useState<Persona | null>(null);
  const [personaPaga, setPersonaPaga] = useState<Persona | null>(null);

  // Chip state
  const [numero, setNumero] = useState('');
  const [compania, setCompania] = useState<Compania>('telcel');
  const [ultimos4, setUltimos4] = useState('');
  const [chipProducto, setChipProducto] = useState<Producto | null>(null);
  const [chipPrecio, setChipPrecio] = useState(110);

  // Producto state
  const [productoSel, setProductoSel] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [prodPrecio, setProdPrecio] = useState(0);

  // UI
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [hoyVentas, setHoyVentas] = useState<VentaDetalle[]>([]);
  const [editando, setEditando] = useState<VentaDetalle | null>(null);
  const [editUsa, setEditUsa] = useState<Persona | null>(null);
  const [editPaga, setEditPaga] = useState<Persona | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VentaDetalle | null>(null);

  // Refs for keyboard navigation
  const numeroRef = useRef<HTMLInputElement>(null);
  const ultimos4Ref = useRef<HTMLInputElement>(null);
  const companiaRef = useRef<HTMLDivElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const productoGridRef = useRef<HTMLDivElement>(null);
  const usaRef = useRef<PersonAutocompleteRef>(null);
  const pagaRef = useRef<PersonAutocompleteRef>(null);
  const guardarBtnRef = useRef<HTMLButtonElement>(null);

  // Initialize chip product & precio when productos load
  useEffect(() => {
    if (chipProductos.length && !chipProducto) {
      const telcel = chipProductos.find((p) => p.nombre === 'Chip Telcel') ?? chipProductos[0];
      setChipProducto(telcel);
      setChipPrecio(Number(telcel.precio));
    }
  }, [chipProductos, chipProducto]);

  useEffect(() => {
    if (otrosProductos.length && !productoSel) {
      const cargador = otrosProductos.find((p) => p.nombre === 'Cargador') ?? otrosProductos[0];
      setProductoSel(cargador);
      setProdPrecio(Number(cargador.precio));
    }
  }, [otrosProductos, productoSel]);

  const cargarHoy = useCallback(async () => {
    try {
      const v = await getVentasHoy();
      setHoyVentas(v);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { cargarHoy(); }, [cargarHoy]);

  // Focus first field when mode changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (modo === 'chip') numeroRef.current?.focus();
      else cantidadRef.current?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [modo]);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2200);
  };

  const resetChip = () => {
    setNumero('');
    setUltimos4('');
    setPersonaUsa(null);
    setPersonaPaga(null);
    setCompania('telcel');
  };

  const resetProducto = () => {
    setCantidad(1);
    setPersonaUsa(null);
    setPersonaPaga(null);
  };

  const onUsaChange = (p: Persona | null) => {
    setPersonaUsa(p);
    if (p) setTimeout(() => pagaRef.current?.focus(), 20);
  };

  const onPagaChange = (p: Persona | null) => {
    setPersonaPaga(p);
    if (p) setTimeout(() => guardarBtnRef.current?.focus(), 20);
  };

  const chipValid =
    numero.length === 10 &&
    ultimos4.length === 4 &&
    chipProducto !== null &&
    personaUsa !== null &&
    personaPaga !== null;

  const prodValid = productoSel !== null && cantidad >= 1 && personaUsa !== null && personaPaga !== null;

  const guardarChip = async () => {
    if (!chipValid || !chipProducto) return;
    setSaving(true);
    try {
      await registrarChip({
        numero,
        compania,
        ultimos4,
        persona_usa_id: personaUsa!.id,
        persona_paga_id: personaPaga!.id,
        producto_id: chipProducto.id,
        precio_unitario: chipPrecio,
      });
      showToast('ok', `Chip ${ultimos4} registrado — ${companiaLabel(compania)}`);
      resetChip();
      await cargarHoy();
      setTimeout(() => numeroRef.current?.focus(), 20);
    } catch (e: any) {
      showToast('err', e.message || 'Error al guardar el chip.');
    } finally {
      setSaving(false);
    }
  };

  const guardarProducto = async () => {
    if (!prodValid || !productoSel) return;
    setSaving(true);
    try {
      await registrarVentaProducto({
        producto_id: productoSel.id,
        cantidad,
        persona_usa_id: personaUsa!.id,
        persona_paga_id: personaPaga!.id,
        precio_unitario: prodPrecio,
      });
      showToast('ok', `${cantidad} × ${productoSel.nombre} registrado`);
      resetProducto();
      await cargarHoy();
      setTimeout(() => cantidadRef.current?.focus(), 20);
    } catch (e: any) {
      showToast('err', e.message || 'Error al guardar la venta.');
    } finally {
      setSaving(false);
    }
  };

  // --- Keyboard shortcuts for company selection ---
  const onCompaniaKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const match = COMPANIAS.find((c) => c.hotkey.toLowerCase() === key);
    if (match) {
      e.preventDefault();
      setCompania(match.key);
      setTimeout(() => ultimos4Ref.current?.focus(), 10);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      ultimos4Ref.current?.focus();
    }
  };

  // --- Keyboard shortcuts for product selection ---
  const onProductoKeyDown = (e: React.KeyboardEvent) => {
    if (!otrosProductos.length) return;
    const key = e.key.toLowerCase();
    const matches = otrosProductos.filter((p) => p.activo && p.nombre.toLowerCase().startsWith(key));
    if (matches.length > 0) {
      e.preventDefault();
      const target = matches[0];
      setProductoSel(target);
      setProdPrecio(Number(target.precio));
      setTimeout(() => usaRef.current?.focus(), 10);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      usaRef.current?.focus();
    }
  };

  // Number field: Enter jumps to company
  const onNumeroKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      companiaRef.current?.focus();
    }
  };

  // Últimos 4: Enter jumps to quien usa
  const onUltimos4KeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      usaRef.current?.focus();
    }
  };

  // Cantidad: Enter jumps to product selector
  const onCantidadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      productoGridRef.current?.focus();
    }
  };

  // Enter on save button triggers save
  const onGuardarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (modo === 'chip') guardarChip();
      else guardarProducto();
    }
  };

  // --- Edit / Delete handlers ---
  const abrirEditar = (v: VentaDetalle) => {
    setEditando(v);
    setEditUsa(v.persona_usa ?? null);
    setEditPaga(v.persona_paga ?? null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setSaving(true);
    try {
      await actualizarVentaPersona(editando.id, {
        persona_usa_id: editUsa?.id ?? null,
        persona_paga_id: editPaga?.id ?? null,
      });
      showToast('ok', 'Venta actualizada');
      setEditando(null);
      await cargarHoy();
    } catch (e: any) {
      showToast('err', e.message || 'Error al actualizar.');
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await eliminarVenta(confirmDelete.id);
      showToast('ok', 'Venta eliminada');
      setConfirmDelete(null);
      await cargarHoy();
    } catch (e: any) {
      showToast('err', e.message || 'Error al eliminar.');
    } finally {
      setSaving(false);
    }
  };

  // --- Per-person chip count summary for today ---
  const chipsPorPersona = useMemo(() => {
    const map = new Map<string, { apodo: string; chips: number; cargadores: number; auriculares: number; total: number }>();
    for (const v of hoyVentas) {
      const pid = v.persona_paga?.id;
      if (!pid) continue;
      const apodo = v.persona_paga?.apodo ?? '?';
      const entry = map.get(pid) ?? { apodo, chips: 0, cargadores: 0, auriculares: 0, total: 0 };
      if (v.chip) entry.chips++;
      if (v.producto?.nombre === 'Cargador') entry.cargadores += v.cantidad;
      if (v.producto?.nombre === 'Auriculares') entry.auriculares += v.cantidad;
      entry.total += Number(v.total);
      map.set(pid, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.chips - a.chips);
  }, [hoyVentas]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap size={22} className="text-brand-400" />
            Ventas
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Captura rápida — {hoyVentas.length} ventas hoy</p>
        </div>
        <div className="flex gap-1 p-1 bg-ink-900/60 border border-ink-700/50 rounded-xl">
          <button
            onClick={() => setModo('chip')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2
              ${modo === 'chip' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Cpu size={16} /> Chip
          </button>
          <button
            onClick={() => setModo('producto')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2
              ${modo === 'producto' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShoppingCart size={16} /> Producto
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-card border animate-slide-up flex items-center gap-2
            ${toast.kind === 'ok' ? 'bg-mint-600/20 border-mint-500/40 text-mint-200' : 'bg-rose-600/20 border-rose-500/40 text-rose-200'}`}
        >
          {toast.kind === 'ok' ? <Zap size={16} /> : <RotateCcw size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* CHIP FORM */}
      {modo === 'chip' && (
        <div className="card p-5 animate-fade-in">
          {/* Number + Company side by side */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="col-span-2">
              <label className="label-base">Número (10 dígitos)</label>
              <input
                ref={numeroRef}
                type="tel"
                inputMode="numeric"
                value={numero}
                maxLength={10}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={onNumeroKeyDown}
                placeholder="5537130051"
                className="input-base font-mono text-lg tracking-wider"
              />
              <p className="mt-1 text-xs text-slate-500">{numero.length}/10 dígitos</p>
            </div>
            <div>
              <label className="label-base">Compañía <span className="text-slate-600 normal-case tracking-normal text-[10px]">T/A/U</span></label>
              <div ref={companiaRef} className="grid grid-cols-1 gap-1 h-[42px]" tabIndex={0} onKeyDown={onCompaniaKeyDown}>
                <div className={`px-2 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center justify-center gap-1.5 ${companiaColor(compania)}`}>
                  {companiaLabel(compania)}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-600">T/A/U</p>
            </div>
          </div>

          {/* Últimos 4 */}
          <div className="mb-4">
            <label className="label-base">Últimos 4</label>
            <input
              ref={ultimos4Ref}
              type="tel"
              inputMode="numeric"
              value={ultimos4}
              maxLength={4}
              onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={onUltimos4KeyDown}
              placeholder="6061"
              className="input-base font-mono text-lg tracking-wider"
            />
            <p className="mt-1 text-xs text-slate-500">{ultimos4.length}/4 dígitos</p>
          </div>

          {/* Quién lo usa + Quién lo paga — always separate */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <PersonAutocomplete
              ref={usaRef}
              personas={personas}
              value={personaUsa}
              onChange={onUsaChange}
              label="Quién lo usa"
              onPersonaCreada={addPersonaLocal}
            />
            <PersonAutocomplete
              ref={pagaRef}
              personas={personas}
              value={personaPaga}
              onChange={onPagaChange}
              label="Quién lo paga"
              onPersonaCreada={addPersonaLocal}
            />
          </div>

          {/* Price + save */}
          <div className="flex items-end gap-3 pt-2 border-t border-ink-700/50">
            <div className="w-32">
              <label className="label-base">Precio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  value={chipPrecio}
                  onChange={(e) => setChipPrecio(Number(e.target.value))}
                  className="input-base pl-7 font-mono"
                />
              </div>
            </div>
            <Button
              ref={guardarBtnRef}
              onClick={guardarChip}
              onKeyDown={onGuardarKeyDown}
              disabled={!chipValid || saving}
              size="lg"
              className="flex-1"
            >
              <Save size={18} />
              {saving ? 'Guardando…' : 'Guardar chip'}
            </Button>
          </div>

          {/* Live preview */}
          {numero.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-ink-850/60 border border-ink-700/40 flex items-center gap-3">
              <Badge className={companiaColor(compania)}>{companiaLabel(compania)}</Badge>
              <span className="font-mono text-slate-300 tracking-wider">{numero || '—'}</span>
              <span className="font-mono text-brand-300">·{ultimos4 || '—'}</span>
              {(personaUsa || personaPaga) && (
                <span className="ml-auto text-xs text-slate-400">
                  {personaUsa?.apodo ?? '—'} / {personaPaga?.apodo ?? '—'}
                </span>
              )}
              <span className="text-sm font-semibold text-mint-300">{moneda(chipPrecio)}</span>
            </div>
          )}
        </div>
      )}

      {/* PRODUCTO FORM */}
      {modo === 'producto' && (
        <div className="card p-5 animate-fade-in">
          <div className="mb-4">
            <span className="label-base">Producto <span className="text-slate-600 normal-case tracking-normal">(C / A / primera letra)</span></span>
            <div ref={productoGridRef} className="grid grid-cols-2 gap-2" tabIndex={0} onKeyDown={onProductoKeyDown}>
              {otrosProductos.filter((p) => p.activo).map((p) => {
                const Icon = PRODUCTO_ICONOS[p.nombre] ?? ShoppingCart;
                const active = productoSel?.id === p.id;
                const hk = p.nombre.charAt(0).toUpperCase();
                return (
                  <button
                    key={p.id}
                    onClick={() => { setProductoSel(p); setProdPrecio(Number(p.precio)); usaRef.current?.focus(); }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition text-left
                      ${active
                        ? 'bg-brand-600/15 border-brand-500/40 text-white'
                        : 'bg-ink-850 border-ink-700 text-slate-400 hover:text-slate-200 hover:border-ink-600'}`}
                  >
                    <Icon size={16} className={active ? 'text-brand-300' : 'text-slate-500'} />
                    <span className="flex-1">{p.nombre}</span>
                    <kbd className={`text-[10px] font-mono px-1 rounded ${active ? 'bg-white/10' : 'bg-ink-700/50'}`}>{hk}</kbd>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label-base">Cantidad</label>
              <input
                ref={cantidadRef}
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                onKeyDown={onCantidadKeyDown}
                className="input-base font-mono"
              />
            </div>
            <div>
              <label className="label-base">Precio c/u</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  value={prodPrecio}
                  onChange={(e) => setProdPrecio(Number(e.target.value))}
                  className="input-base pl-7 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="label-base">Total</label>
              <div className="input-base font-mono text-mint-300 font-semibold flex items-center">
                {moneda(prodPrecio * cantidad)}
              </div>
            </div>
          </div>

          {/* Quién lo usa + Quién lo paga — always separate */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <PersonAutocomplete
              ref={usaRef}
              personas={personas}
              value={personaUsa}
              onChange={onUsaChange}
              label="Quién lo usa"
              onPersonaCreada={addPersonaLocal}
            />
            <PersonAutocomplete
              ref={pagaRef}
              personas={personas}
              value={personaPaga}
              onChange={onPagaChange}
              label="Quién lo paga"
              onPersonaCreada={addPersonaLocal}
            />
          </div>

          <Button
            ref={guardarBtnRef}
            onClick={guardarProducto}
            onKeyDown={onGuardarKeyDown}
            disabled={!prodValid || saving}
            size="lg"
            className="w-full"
          >
            <Save size={18} />
            {saving ? 'Guardando…' : `Guardar — ${moneda(prodPrecio * cantidad)}`}
          </Button>
        </div>
      )}

      {/* Quick tip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 font-mono text-[10px]">Enter</kbd> avanza al siguiente campo
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 font-mono text-[10px]">T/A/U</kbd> selecciona compañía
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 font-mono text-[10px]">Enter</kbd> en "quién paga" guarda
        </span>
      </div>

      {/* Per-person chip summary */}
      {chipsPorPersona.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <Clock size={15} className="text-brand-400" />
            Resumen del día por persona
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {chipsPorPersona.map((p) => (
              <div key={p.apodo} className="card p-3">
                <p className="text-sm font-semibold text-slate-100 uppercase tracking-wide truncate">{p.apodo}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {p.chips > 0 && <span className="text-brand-300">{p.chips} chip{p.chips !== 1 ? 's' : ''}</span>}
                  {p.cargadores > 0 && <span className="text-slate-400">{p.cargadores} cargador{p.cargadores !== 1 ? 'es' : ''}</span>}
                  {p.auriculares > 0 && <span className="text-slate-400">{p.auriculares} aux{p.auriculares !== 1 ? 'es' : ''}</span>}
                </div>
                <p className="mt-1 text-xs font-mono text-mint-300">{moneda(p.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's sales table */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <Clock size={15} className="text-brand-400" />
          Ventas de hoy
          <span className="text-xs text-slate-600 font-normal">({hoyVentas.length})</span>
        </h3>
        <div className="card overflow-hidden">
          {hoyVentas.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              Aún no hay ventas registradas hoy.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-850 border-b border-ink-700/40">
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <th className="text-left px-3 py-2 font-medium">Hora</th>
                    <th className="text-left px-3 py-2 font-medium">Número / Producto</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Usa</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Paga</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/30">
                  {hoyVentas.map((v) => (
                    <tr key={v.id} className="hover:bg-ink-850/40 transition group">
                      <td className="px-3 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">{horaCorta(v.fecha)}</td>
                      <td className="px-3 py-2">
                        {v.chip ? (
                          <span className="flex items-center gap-1.5">
                            <Badge className={companiaColor(v.chip.compania)}>{companiaLabel(v.chip.compania)}</Badge>
                            <span className="font-mono text-slate-300">{v.chip.numero}</span>
                            <span className="font-mono text-brand-300">·{v.chip.ultimos4}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">{v.cantidad} × {v.producto?.nombre}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{v.persona_usa?.apodo ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{v.persona_paga?.apodo ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition">
                          <button
                            onClick={() => abrirEditar(v)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-ink-800 transition"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(v)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-ink-800 transition"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando?.chip ? `Editar ·${editando.chip.ultimos4}` : 'Editar venta'}
        size="md"
      >
        {editando && (
          <div className="space-y-4">
            {editando.chip && (
              <div className="card-soft p-3 flex items-center gap-2">
                <Badge className={companiaColor(editando.chip.compania)}>{companiaLabel(editando.chip.compania)}</Badge>
                <span className="font-mono text-slate-300">{editando.chip.numero}</span>
                <span className="font-mono text-brand-300">·{editando.chip.ultimos4}</span>
              </div>
            )}
            {!editando.chip && (
              <div className="card-soft p-3 text-sm text-slate-300">
                {editando.cantidad} × {editando.producto?.nombre}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <PersonAutocomplete
                personas={personas}
                value={editUsa}
                onChange={setEditUsa}
                label="Quién lo usa"
                onPersonaCreada={addPersonaLocal}
              />
              <PersonAutocomplete
                personas={personas}
                value={editPaga}
                onChange={setEditPaga}
                label="Quién lo paga"
                onPersonaCreada={addPersonaLocal}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="subtle" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={guardarEdicion} disabled={saving}>
                <Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="¿Eliminar venta?"
        size="sm"
      >
        {confirmDelete && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              {confirmDelete.chip ? (
                <>Se eliminará el chip <span className="font-mono text-slate-200">{confirmDelete.chip.numero}</span> ·{confirmDelete.chip.ultimos4} ({companiaLabel(confirmDelete.chip.compania)}).</>
              ) : (
                <>Se eliminará {confirmDelete.cantidad} × {confirmDelete.producto?.nombre}.</>
              )}
              <br />Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="subtle" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmarEliminar} disabled={saving}>
                <Trash2 size={16} /> {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
