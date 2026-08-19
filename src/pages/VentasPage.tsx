import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, Zap, ShoppingCart, Cpu, RotateCcw, Clock, Trash2, Pencil,
  Plus, FileDown, ChevronDown, Package,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { PersonAutocomplete, type PersonAutocompleteRef } from '@/components/PersonAutocomplete';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  registrarChip, registrarVentaProducto, getVentasHoy, eliminarVenta,
  actualizarVentaPersona, crearProducto,
} from '@/lib/db';
import { moneda, companiaLabel, companiaColor, horaCorta } from '@/lib/format';
import { buildResumen } from '@/lib/reporte';
import { generatePDF } from '@/lib/pdf';
import type { Compania, Persona, Producto, VentaDetalle, CategoriaProducto } from '@/lib/types';

type Modo = 'chip' | 'producto';

const COMPANIAS: { key: Compania; label: string; hotkey: string }[] = [
  { key: 'telcel', label: 'Telcel', hotkey: 'T' },
  { key: 'att', label: 'AT&T', hotkey: 'A' },
  { key: 'unefon', label: 'Unefon', hotkey: 'U' },
];

export function VentasPage() {
  const { personas, productos, addPersonaLocal, refreshProductos } = useApp();

  const chipProductos = useMemo(() => productos.filter((p) => p.categoria === 'chip'), [productos]);
  const otrosProductos = useMemo(() => productos.filter((p) => p.categoria !== 'chip'), [productos]);

  const [modo, setModo] = useState<Modo>('chip');

  // Shared state
  const [personaUsa, setPersonaUsa] = useState<Persona | null>(null);
  const [personaPaga, setPersonaPaga] = useState<Persona | null>(null);

  // Chip state
  const [numero, setNumero] = useState('');
  const [compania, setCompania] = useState<Compania>('telcel');
  const [companiaOpen, setCompaniaOpen] = useState(false);
  const [ultimos4, setUltimos4] = useState('');
  const [chipProducto, setChipProducto] = useState<Producto | null>(null);
  const [chipPrecio, setChipPrecio] = useState(110);

  // Producto state
  const [productoSel, setProductoSel] = useState<Producto | null>(null);
  const [productoDropdownOpen, setProductoDropdownOpen] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [prodPrecio, setProdPrecio] = useState(0);
  const [showNuevoProd, setShowNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState<CategoriaProducto>('accesorio');
  const [nuevoProdPrecio, setNuevoProdPrecio] = useState('');
  const [savingProd, setSavingProd] = useState(false);

  // UI
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [hoyVentas, setHoyVentas] = useState<VentaDetalle[]>([]);
  const [editando, setEditando] = useState<VentaDetalle | null>(null);
  const [editUsa, setEditUsa] = useState<Persona | null>(null);
  const [editPaga, setEditPaga] = useState<Persona | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VentaDetalle | null>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // Refs
  const numeroRef = useRef<HTMLInputElement>(null);
  const ultimos4Ref = useRef<HTMLInputElement>(null);
  const companiaRef = useRef<HTMLDivElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const productoDropdownRef = useRef<HTMLDivElement>(null);
  const usaRef = useRef<PersonAutocompleteRef>(null);
  const pagaRef = useRef<PersonAutocompleteRef>(null);
  const guardarBtnRef = useRef<HTMLButtonElement>(null);

  // Initialize chip product & precio
  useEffect(() => {
    if (chipProductos.length && !chipProducto) {
      const telcel = chipProductos.find((p) => p.nombre === 'Chip Telcel') ?? chipProductos[0];
      setChipProducto(telcel);
      setChipPrecio(Number(telcel.precio));
    }
  }, [chipProductos, chipProducto]);

  // Initialize producto selection — use first accesorio
  useEffect(() => {
    if (otrosProductos.length && !productoSel) {
      const first = otrosProductos.find((p) => p.activo) ?? otrosProductos[0];
      setProductoSel(first);
      setProdPrecio(Number(first.precio));
    }
  }, [otrosProductos, productoSel]);

  const cargarHoy = useCallback(async () => {
    try {
      const v = await getVentasHoy();
      setHoyVentas(v);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { cargarHoy(); }, [cargarHoy]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (modo === 'chip') numeroRef.current?.focus();
      else cantidadRef.current?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [modo]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (companiaRef.current && !companiaRef.current.contains(e.target as Node)) setCompaniaOpen(false);
      if (productoDropdownRef.current && !productoDropdownRef.current.contains(e.target as Node)) setProductoDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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

  const handleCrearProducto = async () => {
    const nombre = nuevoProdNombre.trim();
    if (!nombre) return;
    setSavingProd(true);
    try {
      const p = await crearProducto(nombre, nuevoProdCategoria, Number(nuevoProdPrecio) || 0);
      await refreshProductos();
      setProductoSel(p);
      setProdPrecio(Number(p.precio));
      setShowNuevoProd(false);
      setNuevoProdNombre('');
      setNuevoProdPrecio('');
      showToast('ok', `Producto "${p.nombre}" creado`);
    } catch (e: any) {
      showToast('err', e.message || 'Error al crear producto.');
    } finally {
      setSavingProd(false);
    }
  };

  // Keyboard for company
  const onCompaniaKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const match = COMPANIAS.find((c) => c.hotkey.toLowerCase() === key);
    if (match) {
      e.preventDefault();
      setCompania(match.key);
      setCompaniaOpen(false);
      setTimeout(() => ultimos4Ref.current?.focus(), 10);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      ultimos4Ref.current?.focus();
    }
  };

  const onNumeroKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      companiaRef.current?.focus();
    }
  };

  const onUltimos4KeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      usaRef.current?.focus();
    }
  };

  const onCantidadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      setProductoDropdownOpen(true);
      productoDropdownRef.current?.focus();
    }
  };

  const onGuardarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (modo === 'chip') guardarChip();
      else guardarProducto();
    }
  };

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

  const cerrarDia = async () => {
    if (hoyVentas.length === 0) {
      showToast('err', 'No hay ventas hoy para reportar.');
      return;
    }
    setGenerandoPDF(true);
    try {
      const { porPersona, totales } = buildResumen(hoyVentas);
      const today = new Date();
      const fechaKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await generatePDF(fechaKey, porPersona, totales);
      showToast('ok', 'Reporte del día descargado');
    } catch (e: any) {
      showToast('err', e.message || 'Error al generar reporte.');
    } finally {
      setGenerandoPDF(false);
    }
  };

  const { porPersona, totales } = useMemo(() => buildResumen(hoyVentas), [hoyVentas]);

  const seleccionarCompania = (c: Compania) => {
    setCompania(c);
    setCompaniaOpen(false);
    setTimeout(() => ultimos4Ref.current?.focus(), 10);
  };

  const seleccionarProducto = (p: Producto) => {
    setProductoSel(p);
    setProdPrecio(Number(p.precio));
    setProductoDropdownOpen(false);
    setTimeout(() => usaRef.current?.focus(), 10);
  };

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
        <div className="flex items-center gap-2">
          <Button variant="success" size="sm" onClick={cerrarDia} disabled={generandoPDF || hoyVentas.length === 0}>
            <FileDown size={16} /> {generandoPDF ? 'Generando…' : 'Cerrar día'}
          </Button>
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
          {/* Number + Company */}
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
              <label className="label-base">Compañía <span className="text-slate-600 normal-case tracking-normal text-[10px]">T/A/U o clic</span></label>
              <div ref={companiaRef} className="relative" tabIndex={0} onKeyDown={onCompaniaKeyDown}>
                <button
                  type="button"
                  onClick={() => setCompaniaOpen((v) => !v)}
                  className={`w-full px-2 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center justify-between gap-1.5 ${companiaColor(compania)}`}
                >
                  <span>{companiaLabel(compania)}</span>
                  <ChevronDown size={14} className="opacity-60" />
                </button>
                {companiaOpen && (
                  <div className="absolute z-40 mt-1 w-full card p-1 animate-pop">
                    {COMPANIAS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => seleccionarCompania(c.key)}
                        className={`w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition flex items-center justify-between
                          ${compania === c.key ? 'bg-brand-600/20 text-white' : 'text-slate-300 hover:bg-ink-800'}`}
                      >
                        <span>{c.label}</span>
                        <kbd className="text-[10px] font-mono px-1 rounded bg-ink-700/50">{c.hotkey}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">T/A/U o clic</p>
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

          {/* Quién usa / paga */}
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
          {/* Dropdown selector */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="label-base mb-0">Producto</span>
              <button
                onClick={() => { setShowNuevoProd(true); setNuevoProdNombre(''); setNuevoProdPrecio(''); }}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
              >
                <Plus size={12} /> Nuevo producto
              </button>
            </div>
            <div ref={productoDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setProductoDropdownOpen((v) => !v)}
                className="w-full input-base flex items-center justify-between text-left"
              >
                <span className={productoSel ? 'text-slate-100' : 'text-slate-500'}>
                  {productoSel?.nombre ?? 'Selecciona un producto…'}
                </span>
                <ChevronDown size={16} className="text-slate-500 shrink-0" />
              </button>
              {productoDropdownOpen && (
                <div className="absolute z-40 mt-1 w-full card p-1.5 animate-pop max-h-64 overflow-y-auto">
                  {otrosProductos.filter((p) => p.activo).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => seleccionarProducto(p)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition
                        ${productoSel?.id === p.id ? 'bg-brand-600/20 text-white' : 'text-slate-300 hover:bg-ink-800'}`}
                    >
                      <Package size={15} className={productoSel?.id === p.id ? 'text-brand-300' : 'text-slate-500'} />
                      <span className="flex-1">{p.nombre}</span>
                      <span className="text-xs text-slate-500 capitalize">{p.categoria}</span>
                      <span className="font-mono text-xs text-mint-300">{moneda(Number(p.precio))}</span>
                    </button>
                  ))}
                  {otrosProductos.filter((p) => p.activo).length === 0 && (
                    <p className="px-3 py-3 text-sm text-slate-500 text-center">No hay productos. Crea uno nuevo.</p>
                  )}
                </div>
              )}
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

          {/* Quién usa / paga */}
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

      {/* Quick tips */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 font-mono text-[10px]">Enter</kbd> avanza al siguiente campo
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 font-mono text-[10px]">T/A/U</kbd> o clic para compañía
        </span>
      </div>

      {/* Today's sales table — FIRST (top) */}
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

      {/* Per-person summary — BELOW today's sales */}
      {porPersona.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <Clock size={15} className="text-brand-400" />
            Resumen del día por persona
          </h3>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-ink-850/60 border-b border-ink-700/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <div className="col-span-3">Persona</div>
              <div className="col-span-1 text-center">Chips</div>
              <div className="col-span-2 text-center">Carg.</div>
              <div className="col-span-2 text-center">Aux.</div>
              <div className="col-span-2 text-center">Tel.</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            <div className="divide-y divide-ink-700/40">
              {porPersona.map((p) => (
                <div key={p.apodo} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-ink-850/40 transition">
                  <div className="col-span-3 font-medium uppercase tracking-wide text-slate-100 truncate">{p.apodo}</div>
                  <div className="col-span-1 text-center font-mono text-brand-300">{p.chips || '—'}</div>
                  <div className="col-span-2 text-center font-mono text-slate-400">{p.cargadores || '—'}</div>
                  <div className="col-span-2 text-center font-mono text-slate-400">{p.auriculares || '—'}</div>
                  <div className="col-span-2 text-center font-mono text-slate-400">{p.telefonos || '—'}</div>
                  <div className="col-span-2 text-right font-mono font-semibold text-mint-300">{moneda(p.total)}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-ink-850/60 border-t border-ink-700/40 items-center">
              <div className="col-span-9 text-xs font-semibold uppercase tracking-wider text-slate-500">Total del día</div>
              <div className="col-span-3 text-right font-mono font-bold text-mint-300">
                {moneda(totales.total)}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* New product modal */}
      <Modal
        open={showNuevoProd}
        onClose={() => setShowNuevoProd(false)}
        title="Nuevo producto"
        size="sm"
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={nuevoProdNombre}
            onChange={(e) => setNuevoProdNombre(e.target.value)}
            placeholder="Ej. Funda, Mica, Batería…"
            autoFocus
          />
          <div>
            <label className="label-base">Categoría</label>
            <select
              value={nuevoProdCategoria}
              onChange={(e) => setNuevoProdCategoria(e.target.value as CategoriaProducto)}
              className="input-base"
            >
              <option value="accesorio">Accesorio</option>
              <option value="telefono">Teléfono</option>
            </select>
          </div>
          <Input
            label="Precio"
            type="number"
            value={nuevoProdPrecio}
            onChange={(e) => setNuevoProdPrecio(e.target.value)}
            placeholder="0"
            className="font-mono"
          />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="subtle" onClick={() => setShowNuevoProd(false)}>Cancelar</Button>
            <Button onClick={handleCrearProducto} disabled={savingProd || !nuevoProdNombre.trim()}>
              <Plus size={16} /> {savingProd ? 'Guardando…' : 'Crear producto'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
