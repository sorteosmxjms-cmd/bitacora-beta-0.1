import { useEffect, useMemo, useState, useCallback } from 'react';
import { Wallet, Plus, TrendingDown, CircleCheck as CheckCircle2, Clock, Check, CloudUpload as UploadCloud, Search, Pencil, Trash2, ArrowLeft, History, TriangleAlert as AlertTriangle, CircleAlert as AlertCircle, FileDown, ArrowRight, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PersonAutocomplete } from '@/components/PersonAutocomplete';
import { useApp } from '@/store/AppContext';
import {
  getSaldos, getPagosDePersona, getVentasDePersona, getVentasDetalle, registrarPago, calcularEstadoPago,
  actualizarPago, eliminarPago, actualizarVenta, eliminarDeuda, crearDeudaManual,
  getLotes, getVentasDeLote, eliminarLote,
  getVentasHistoricas, getVentasHistoricasSinLote, eliminarVentasBatch,
  shortLabelParaTipo,
} from '@/lib/db';
import {
  moneda, fechaCorta, horaCorta, companiaLabel, companiaColor,
  estadoPagoLabel, estadoPagoColor,
} from '@/lib/format';
import type { SaldoPersona, Pago, VentaDetalle, LoteImportacion, Persona } from '@/lib/types';
import { Settings2, Layers } from 'lucide-react';
import { ImportWizard } from './ImportWizard';

export function DeudasPage() {
  const { personas, addPersonaLocal } = useApp();

  const [saldos, setSaldos] = useState<SaldoPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Person detail
  const [detalle, setDetalle] = useState<SaldoPersona | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ventas, setVentas] = useState<VentaDetalle[]>([]);

  // Abono modal
  const [showAbono, setShowAbono] = useState(false);
  const [abonoCant, setAbonoCant] = useState('');
  const [abonoFecha, setAbonoFecha] = useState('');
  const [abonoNota, setAbonoNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit abono
  const [editAbono, setEditAbono] = useState<Pago | null>(null);

  // Edit debt (venta)
  const [editVenta, setEditVenta] = useState<VentaDetalle | null>(null);
  const [editCant, setEditCant] = useState(1);
  const [editPrecio, setEditPrecio] = useState(0);
  const [editNota, setEditNota] = useState('');
  const [editPersonaPaga, setEditPersonaPaga] = useState<Persona | null>(null);

  // Delete confirm
  const [confirmDeleteVenta, setConfirmDeleteVenta] = useState<VentaDetalle | null>(null);
  const [confirmDeleteAbono, setConfirmDeleteAbono] = useState<Pago | null>(null);

  // Admin data modal
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'importaciones' | 'historicos' | 'prueba'>('importaciones');
  const [allVentasHistoricas, setAllVentasHistoricas] = useState<VentaDetalle[]>([]);
  const [selectedVentas, setSelectedVentas] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  // All ventas for DETALLE column summaries
  const [allVentas, setAllVentas] = useState<VentaDetalle[]>([]);

  // Import wizard
  const [showImport, setShowImport] = useState(false);

  // Manual debt
  const [showManual, setShowManual] = useState(false);
  const [manualPersona, setManualPersona] = useState<Persona | null>(null);
  const [manualTotal, setManualTotal] = useState('');
  const [manualNota, setManualNota] = useState('');

  // Import history
  const [showHistorial, setShowHistorial] = useState(false);
  const [lotes, setLotes] = useState<LoteImportacion[]>([]);
  const [loteDetalle, setLoteDetalle] = useState<LoteImportacion | null>(null);
  const [loteVentas, setLoteVentas] = useState<VentaDetalle[]>([]);
  const [confirmDeleteLote, setConfirmDeleteLote] = useState<LoteImportacion | null>(null);

  // Toast
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarSaldos = useCallback(async () => {
    try {
      const s = await getSaldos();
      setSaldos(s.filter((x) => x.total_vendido > 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarSaldos(); }, [cargarSaldos]);

  // Load all ventas for DETALLE column summaries
  useEffect(() => {
    (async () => {
      try {
        const v = await getVentasDetalle();
        setAllVentas(v);
      } catch { /* ignore */ }
    })();
  }, [saldos]);

  const cargarDetalle = useCallback(async (personaId: string) => {
    const [pg, vt] = await Promise.all([getPagosDePersona(personaId), getVentasDePersona(personaId)]);
    setPagos(pg);
    setVentas(vt);
  }, []);

  useEffect(() => {
    if (!detalle) return;
    cargarDetalle(detalle.persona_id);
  }, [detalle, cargarDetalle]);

  const totalDeuda = useMemo(() => saldos.reduce((a, s) => a + s.saldo, 0), [saldos]);
  const saldoPendientes = saldos.filter((s) => s.saldo > 0).length;

  const saldosFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return saldos;
    const q = searchQuery.trim().toLowerCase();
    return saldos.filter((s) => s.apodo.toLowerCase().includes(q));
  }, [saldos, searchQuery]);

  // Per-person summary for DETALLE column
  const resumenPorPersona = useMemo(() => {
    const map = new Map<string, { label: string; cantidad: number; precio: number; origen: string }[]>();
    for (const v of allVentas) {
      const pid = v.persona_paga_id;
      if (!pid) continue;
      const nombre = v.producto?.nombre ?? 'Producto';
      const precio = Number(v.precio_unitario);
      const key = `${nombre}|${precio}|${v.origen}`;
      const grupos = map.get(pid) ?? [];
      const existing = grupos.find((g) => `${g.label}|${g.precio}|${g.origen}` === key);
      if (existing) {
        existing.cantidad += v.cantidad;
      } else {
        grupos.push({ label: nombre, cantidad: v.cantidad, precio, origen: v.origen });
      }
      map.set(pid, grupos);
    }
    return map;
  }, [allVentas]);

  function shortDetalle(personaId: string): string {
    const grupos = resumenPorPersona.get(personaId);
    if (!grupos || grupos.length === 0) return '';
    const sorted = [...grupos].sort((a, b) => b.cantidad * b.precio - a.cantidad * a.precio);
    const first = sorted[0];
    const parts = sorted.slice(0, 2).map((g) =>
      `${g.cantidad} ${g.label.replace(' (histórico)', '').replace(' (importado)', '')}`
    );
    let text = parts.join(' · ');
    if (sorted.length > 2) text += ` · +${sorted.length - 2} más`;
    return text;
  }

  // ===== Abono handlers =====
  const abrirAbono = (s: SaldoPersona) => {
    setDetalle(s);
    setShowAbono(true);
    setAbonoCant('');
    setAbonoFecha(new Date().toISOString().slice(0, 10));
    setAbonoNota('');
    setError(null);
  };

  const registrarAbono = async () => {
    if (!detalle) return;
    const cant = Number(abonoCant);
    if (!cant || cant <= 0) { setError('Cantidad inválida.'); return; }
    setSaving(true);
    setError(null);
    try {
      await registrarPago(detalle.persona_id, cant, abonoNota, abonoFecha);
      await cargarSaldos();
      const s = await getSaldos();
      const updated = s.find((x) => x.persona_id === detalle.persona_id);
      if (updated) setDetalle(updated);
      await cargarDetalle(detalle.persona_id);
      setShowAbono(false);
      showToast('ok', `Abono de ${moneda(cant)} registrado`);
    } catch (e: any) {
      setError(e.message || 'Error al registrar abono.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Edit abono =====
  const abrirEditAbono = (p: Pago) => {
    setEditAbono(p);
    setAbonoCant(String(p.cantidad));
    setAbonoFecha(p.fecha.slice(0, 10));
    setAbonoNota(p.nota || '');
    setError(null);
  };

  const guardarEditAbono = async () => {
    if (!editAbono || !detalle) return;
    const cant = Number(abonoCant);
    if (!cant || cant <= 0) { setError('Cantidad inválida.'); return; }
    setSaving(true);
    try {
      await actualizarPago(editAbono.id, {
        cantidad: cant,
        nota: abonoNota.trim() || null,
        fecha: new Date(abonoFecha).toISOString(),
      });
      await cargarSaldos();
      const s = await getSaldos();
      const updated = s.find((x) => x.persona_id === detalle.persona_id);
      if (updated) setDetalle(updated);
      await cargarDetalle(detalle.persona_id);
      setEditAbono(null);
      showToast('ok', 'Abono actualizado');
    } catch (e: any) {
      setError(e.message || 'Error al actualizar abono.');
    } finally {
      setSaving(false);
    }
  };

  const eliminarAbonoConfirm = async () => {
    if (!confirmDeleteAbono || !detalle) return;
    setSaving(true);
    try {
      await eliminarPago(confirmDeleteAbono.id);
      await cargarSaldos();
      const s = await getSaldos();
      const updated = s.find((x) => x.persona_id === detalle.persona_id);
      if (updated) setDetalle(updated);
      await cargarDetalle(detalle.persona_id);
      setConfirmDeleteAbono(null);
      showToast('ok', 'Abono eliminado');
    } catch (e: any) {
      showToast('err', e.message || 'Error al eliminar abono.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Edit debt (venta) =====
  const abrirEditVenta = (v: VentaDetalle) => {
    setEditVenta(v);
    setEditCant(v.cantidad);
    setEditPrecio(Number(v.precio_unitario));
    setEditNota(v.nota || '');
    setEditPersonaPaga(v.persona_paga ?? null);
    setError(null);
  };

  const guardarEditVenta = async () => {
    if (!editVenta) return;
    setSaving(true);
    try {
      const total = editCant * editPrecio;
      await actualizarVenta(editVenta.id, {
        cantidad: editCant,
        precio_unitario: editPrecio,
        total,
        nota: editNota.trim() || null,
        persona_paga_id: editPersonaPaga?.id ?? null,
      });
      if (detalle) await cargarDetalle(detalle.persona_id);
      await cargarSaldos();
      if (detalle) {
        const s = await getSaldos();
        const updated = s.find((x) => x.persona_id === detalle.persona_id);
        if (updated) setDetalle(updated);
      }
      setEditVenta(null);
      showToast('ok', 'Deuda actualizada');
    } catch (e: any) {
      setError(e.message || 'Error al actualizar.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Delete debt =====
  const eliminarVentaConfirm = async () => {
    if (!confirmDeleteVenta) return;
    setSaving(true);
    try {
      await eliminarDeuda(confirmDeleteVenta.id);
      if (detalle) await cargarDetalle(detalle.persona_id);
      await cargarSaldos();
      if (detalle) {
        const s = await getSaldos();
        const updated = s.find((x) => x.persona_id === detalle.persona_id);
        if (updated) setDetalle(updated);
        else setDetalle(null);
      }
      setConfirmDeleteVenta(null);
      showToast('ok', 'Deuda eliminada');
    } catch (e: any) {
      showToast('err', e.message || 'Error al eliminar.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Manual debt =====
  const guardarManualDeuda = async () => {
    if (!manualPersona) { setError('Selecciona una persona.'); return; }
    const total = Number(manualTotal);
    if (!total || total <= 0) { setError('Total inválido.'); return; }
    setSaving(true);
    setError(null);
    try {
      await crearDeudaManual(manualPersona.id, total, manualNota);
      await cargarSaldos();
      setShowManual(false);
      setManualPersona(null);
      setManualTotal('');
      setManualNota('');
      showToast('ok', `Deuda histórica de ${moneda(total)} agregada a ${manualPersona.apodo}`);
    } catch (e: any) {
      setError(e.message || 'Error al crear deuda.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Admin data handlers =====
  const cargarVentasHistoricas = async () => {
    setAdminLoading(true);
    try {
      const v = await getVentasHistoricas();
      setAllVentasHistoricas(v);
    } catch { /* ignore */ }
    setAdminLoading(false);
  };

  const toggleSeleccion = (id: string) => {
    setSelectedVentas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeleccionarTodos = () => {
    if (selectedVentas.size === allVentasHistoricas.length) {
      setSelectedVentas(new Set());
    } else {
      setSelectedVentas(new Set(allVentasHistoricas.map((v) => v.id)));
    }
  };

  const eliminarBulkConfirm = async () => {
    setSaving(true);
    try {
      await eliminarVentasBatch(Array.from(selectedVentas));
      await cargarSaldos();
      setSelectedVentas(new Set());
      setConfirmBulkDelete(false);
      await cargarVentasHistoricas();
      const v = await getVentasDetalle();
      setAllVentas(v);
      showToast('ok', `${selectedVentas.size} cargo(s) eliminado(s)`);
    } catch (e: any) {
      showToast('err', e.message || 'Error al eliminar.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Import handler (called from wizard) =====
  const handleImportComplete = async () => {
    setShowImport(false);
    await cargarSaldos();
    showToast('ok', 'Deudas importadas correctamente');
  };

  // ===== Import history =====
  const cargarLotes = async () => {
    try {
      const l = await getLotes();
      setLotes(l);
    } catch { /* ignore */ }
  };

  const verLoteDetalle = async (l: LoteImportacion) => {
    setLoteDetalle(l);
    const v = await getVentasDeLote(l.id);
    setLoteVentas(v);
  };

  const eliminarLoteConfirm = async () => {
    if (!confirmDeleteLote) return;
    setSaving(true);
    try {
      await eliminarLote(confirmDeleteLote.id);
      await cargarSaldos();
      await cargarLotes();
      setConfirmDeleteLote(null);
      setLoteDetalle(null);
      showToast('ok', 'Importación deshecha');
    } catch (e: any) {
      showToast('err', e.message || 'Error al deshacer importación.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Desglose (breakdown) for detail view =====
  const desglose = useMemo(() => {
    const grupos = new Map<string, { label: string; cantidad: number; precio: number; total: number; origen: string }>();
    for (const v of ventas) {
      const key = `${v.producto?.nombre ?? 'Producto'}|${v.precio_unitario}|${v.origen}`;
      const existing = grupos.get(key);
      const subtotal = Number(v.total);
      if (existing) {
        existing.cantidad += v.cantidad;
        existing.total += subtotal;
      } else {
        grupos.set(key, {
          label: v.producto?.nombre ?? 'Producto',
          cantidad: v.cantidad,
          precio: Number(v.precio_unitario),
          total: subtotal,
          origen: v.origen,
        });
      }
    }
    return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
  }, [ventas]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet size={22} className="text-brand-400" />
            Deudas
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {saldoPendientes} personas con saldo · {saldos.length} en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => { setShowAdmin(true); cargarVentasHistoricas(); cargarLotes(); }}>
            <Settings2 size={14} /> Administrar datos
          </Button>
          <Button variant="subtle" size="sm" onClick={() => { setShowHistorial(true); cargarLotes(); }}>
            <History size={14} /> Historial
          </Button>
          <Button variant="subtle" size="sm" onClick={() => { setShowManual(true); setError(null); }}>
            <Plus size={14} /> Deuda manual
          </Button>
          <Button variant="subtle" size="sm" onClick={() => { setShowImport(true); }}>
            <UploadCloud size={14} /> Importar deudas
          </Button>
          <div className="card-soft px-4 py-2.5">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Saldo total</p>
            <p className="text-xl font-bold text-rose-400 font-mono">{moneda(totalDeuda)}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar persona…"
            className="input-base pl-9"
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-card border animate-slide-up flex items-center gap-2
          ${toast.kind === 'ok' ? 'bg-mint-600/20 border-mint-500/40 text-mint-200' : 'bg-rose-600/20 border-rose-500/40 text-rose-200'}`}>
          {toast.kind === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* Main table */}
      {loading ? (
        <div className="card py-12 text-center text-slate-500">Cargando saldos…</div>
      ) : saldosFiltrados.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-mint-400/60" />
          <p className="text-slate-400">{searchQuery ? 'No se encontraron personas.' : 'No hay deudas registradas.'}</p>
          {!searchQuery && (
            <p className="text-xs text-slate-600 mt-1">Importa deudas antiguas o agrega una manual para comenzar.</p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-ink-850/60 border-b border-ink-700/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <div className="col-span-3">Persona</div>
            <div className="col-span-2">Detalle</div>
            <div className="col-span-2 text-right">Deuda</div>
            <div className="col-span-2 text-right">Abonos</div>
            <div className="col-span-2 text-right">Saldo</div>
            <div className="col-span-1 text-right">Acción</div>
          </div>
          <div className="divide-y divide-ink-700/40">
            {saldosFiltrados.map((s) => {
              return (
                <div
                  key={s.persona_id}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-ink-850/40 transition cursor-pointer"
                  onClick={() => setDetalle(s)}
                >
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="font-medium uppercase tracking-wide text-slate-100">{s.apodo}</span>
                    {s.saldo <= 0 && <Badge className="bg-mint-500/15 text-mint-300 border-mint-500/30"><Check size={11} /> Liquidado</Badge>}
                  </div>
                  <div className="col-span-2 text-xs text-slate-500 truncate">
                    {shortDetalle(s.persona_id) || '—'}
                  </div>
                  <div className="col-span-2 text-right font-mono text-slate-400">{moneda(s.total_vendido)}</div>
                  <div className="col-span-2 text-right font-mono text-brand-300">{moneda(s.total_abonado)}</div>
                  <div className={`col-span-2 text-right font-mono font-semibold ${s.saldo > 0 ? 'text-rose-400' : 'text-mint-300'}`}>
                    {moneda(s.saldo)}
                  </div>
                  <div className="col-span-1 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="subtle" onClick={() => abrirAbono(s)}>
                      <Plus size={12} /> Abono
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== DETALLE MODAL ===== */}
      <Modal
        open={!!detalle && !showAbono && !editAbono && !editVenta && !confirmDeleteVenta && !confirmDeleteAbono}
        onClose={() => setDetalle(null)}
        title={detalle ? `Detalle — ${detalle.apodo}` : ''}
        size="lg"
      >
        {detalle && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card-soft px-3 py-2.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><TrendingDown size={12} /> Deuda original</p>
                <p className="text-lg font-bold font-mono text-slate-200">{moneda(detalle.total_vendido)}</p>
              </div>
              <div className="card-soft px-3 py-2.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><CheckCircle2 size={12} /> Abonos</p>
                <p className="text-lg font-bold font-mono text-brand-300">{moneda(detalle.total_abonado)}</p>
              </div>
              <div className="card-soft px-3 py-2.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><Clock size={12} /> Saldo actual</p>
                <p className={`text-lg font-bold font-mono ${detalle.saldo > 0 ? 'text-rose-400' : 'text-mint-300'}`}>{moneda(detalle.saldo)}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { setShowAbono(true); setAbonoCant(''); setAbonoFecha(new Date().toISOString().slice(0, 10)); setAbonoNota(''); setError(null); }} disabled={detalle.saldo <= 0}>
                <Plus size={16} /> Registrar abono
              </Button>
            </div>

            {/* Desglose */}
            {desglose.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Desglose de la deuda</h4>
                <div className="rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                  {desglose.map((d, i) => (
                    <div key={i} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                      <span className="flex-1 text-slate-300">
                        {d.cantidad} × {d.label}
                        {d.origen === 'historica' && <Badge className="ml-2 bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">histórica</Badge>}
                      </span>
                      <span className="font-mono text-xs text-slate-500">@ {moneda(d.precio)}</span>
                      <span className="font-mono text-slate-200 w-24 text-right">{moneda(d.total)}</span>
                    </div>
                  ))}
                  <div className="px-3 py-2.5 flex items-center justify-between bg-ink-850/40">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total cargos</span>
                    <span className="font-mono font-semibold text-slate-200">{moneda(detalle.total_vendido)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ventas individuales con editar/eliminar */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                Cargos individuales
                <span className="text-xs text-slate-600 font-normal">({ventas.length})</span>
              </h4>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                {ventas.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-500 text-center">Sin cargos.</p>
                ) : ventas.map((v) => (
                  <div key={v.id} className="px-3 py-2.5 flex items-center gap-3 text-sm group">
                    <span className="text-xs text-slate-600 font-mono w-20 shrink-0">{fechaCorta(v.fecha)}</span>
                    <span className="flex-1 truncate text-slate-300">
                      {v.chip ? (
                        <span className="flex items-center gap-1.5">
                          <Badge className={companiaColor(v.chip.compania)}>{companiaLabel(v.chip.compania)}</Badge>
                          <span className="font-mono">{v.chip.numero}</span>
                        </span>
                      ) : (
                        <span>{v.cantidad} × {v.producto?.nombre}</span>
                      )}
                      {v.origen === 'historica' && <Badge className="ml-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">hist</Badge>}
                    </span>
                    <span className="font-mono text-slate-300">{moneda(Number(v.total))}</span>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                      <button onClick={() => abrirEditVenta(v)} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-ink-800 transition" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteVenta(v)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-ink-800 transition" title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de abonos con editar/eliminar */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                Historial de abonos
                <span className="text-xs text-slate-600 font-normal">({pagos.length})</span>
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                {pagos.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-500 text-center">Sin abonos registrados.</p>
                ) : pagos.map((pg) => (
                  <div key={pg.id} className="px-3 py-2.5 flex items-center gap-3 text-sm group">
                    <span className="text-xs text-slate-600 font-mono w-20 shrink-0">{fechaCorta(pg.fecha)}</span>
                    <span className="flex-1 text-slate-400 truncate">{pg.nota || <span className="text-slate-600">Sin nota</span>}</span>
                    <span className="font-mono text-mint-300">−{moneda(Number(pg.cantidad))}</span>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                      <button onClick={() => abrirEditAbono(pg)} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-ink-800 transition" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteAbono(pg)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-ink-800 transition" title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== ABONO MODAL ===== */}
      <Modal open={showAbono} onClose={() => setShowAbono(false)} title={detalle ? `Abono — ${detalle.apodo}` : ''} size="sm">
        {detalle && (
          <div className="space-y-3">
            <div className="card-soft px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">Saldo actual</span>
              <span className="text-lg font-bold font-mono text-rose-400">{moneda(detalle.saldo)}</span>
            </div>
            <Input
              label="Cantidad del abono"
              type="number"
              value={abonoCant}
              onChange={(e) => setAbonoCant(e.target.value)}
              placeholder="0"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && registrarAbono()}
              className="font-mono text-lg"
            />
            <Input
              label="Fecha"
              type="date"
              value={abonoFecha}
              onChange={(e) => setAbonoFecha(e.target.value)}
            />
            <Input
              label="Nota (opcional)"
              value={abonoNota}
              onChange={(e) => setAbonoNota(e.target.value)}
              placeholder="Ej. Pago parcial"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            {abonoCant && Number(abonoCant) > 0 && (
              <div className="card-soft px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-400">Nuevo saldo</span>
                <span className="font-mono font-semibold text-mint-300">{moneda(Math.max(0, detalle.saldo - Number(abonoCant)))}</span>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="subtle" onClick={() => setShowAbono(false)}>Cancelar</Button>
              <Button variant="success" onClick={registrarAbono} disabled={saving || !abonoCant}>
                <CheckCircle2 size={16} /> {saving ? 'Guardando…' : 'Registrar abono'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== EDIT ABONO MODAL ===== */}
      <Modal open={!!editAbono} onClose={() => setEditAbono(null)} title="Editar abono" size="sm">
        {editAbono && (
          <div className="space-y-3">
            <Input
              label="Cantidad"
              type="number"
              value={abonoCant}
              onChange={(e) => setAbonoCant(e.target.value)}
              autoFocus
              className="font-mono text-lg"
            />
            <Input
              label="Fecha"
              type="date"
              value={abonoFecha}
              onChange={(e) => setAbonoFecha(e.target.value)}
            />
            <Input
              label="Nota"
              value={abonoNota}
              onChange={(e) => setAbonoNota(e.target.value)}
              placeholder="Nota del abono"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="subtle" onClick={() => setEditAbono(null)}>Cancelar</Button>
              <Button onClick={guardarEditAbono} disabled={saving}>
                <Check size={16} /> {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== EDIT VENTA MODAL ===== */}
      <Modal open={!!editVenta} onClose={() => setEditVenta(null)} title="Editar cargo" size="md">
        {editVenta && (
          <div className="space-y-3">
            <div className="card-soft p-3 text-sm text-slate-300">
              {editVenta.chip ? (
                <span className="flex items-center gap-2">
                  <Badge className={companiaColor(editVenta.chip.compania)}>{companiaLabel(editVenta.chip.compania)}</Badge>
                  <span className="font-mono">{editVenta.chip.numero}</span>
                </span>
              ) : (
                <span>{editVenta.producto?.nombre}</span>
              )}
              {editVenta.origen === 'historica' && <Badge className="ml-2 bg-amber-500/15 text-amber-400 border-amber-500/30">histórica</Badge>}
            </div>
            <PersonAutocomplete
              personas={personas}
              value={editPersonaPaga}
              onChange={setEditPersonaPaga}
              label="Quién paga"
              onPersonaCreada={addPersonaLocal}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Cantidad"
                type="number"
                value={String(editCant)}
                onChange={(e) => setEditCant(Math.max(1, Number(e.target.value)))}
                className="font-mono"
              />
              <div>
                <label className="label-base">Precio unitario (histórico)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(Number(e.target.value))}
                    className="input-base pl-7 font-mono"
                  />
                </div>
              </div>
            </div>
            <Input
              label="Nota"
              value={editNota}
              onChange={(e) => setEditNota(e.target.value)}
              placeholder="Nota opcional"
            />
            <div className="card-soft px-4 py-2.5 flex items-center justify-between text-sm">
              <span className="text-slate-400">Nuevo total</span>
              <span className="font-mono font-semibold text-mint-300">{moneda(editCant * editPrecio)}</span>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="subtle" onClick={() => setEditVenta(null)}>Cancelar</Button>
              <Button onClick={guardarEditVenta} disabled={saving}>
                <Check size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== CONFIRM DELETE VENTA ===== */}
      <Modal open={!!confirmDeleteVenta} onClose={() => setConfirmDeleteVenta(null)} title="¿Eliminar cargo?" size="sm">
        {confirmDeleteVenta && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              {confirmDeleteVenta.chip ? (
                <>Se eliminará el chip <span className="font-mono text-slate-200">{confirmDeleteVenta.chip.numero}</span>.</>
              ) : (
                <>Se eliminará {confirmDeleteVenta.cantidad} × {confirmDeleteVenta.producto?.nombre}.</>
              )}
              <br />Esto reducirá la deuda en {moneda(Number(confirmDeleteVenta.total))}.<br />Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="subtle" onClick={() => setConfirmDeleteVenta(null)}>Cancelar</Button>
              <Button variant="danger" onClick={eliminarVentaConfirm} disabled={saving}>
                <Trash2 size={16} /> {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== CONFIRM DELETE ABONO ===== */}
      <Modal open={!!confirmDeleteAbono} onClose={() => setConfirmDeleteAbono(null)} title="¿Eliminar abono?" size="sm">
        {confirmDeleteAbono && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Se eliminará el abono de {moneda(Number(confirmDeleteAbono.cantidad))} del {fechaCorta(confirmDeleteAbono.fecha)}.
              <br />El saldo aumentará en esa cantidad.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="subtle" onClick={() => setConfirmDeleteAbono(null)}>Cancelar</Button>
              <Button variant="danger" onClick={eliminarAbonoConfirm} disabled={saving}>
                <Trash2 size={16} /> {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== ADMIN DATA MODAL ===== */}
      <Modal open={showAdmin} onClose={() => setShowAdmin(false)} title="Administrar datos" size="lg">
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-ink-700/40 pb-2">
            <button
              onClick={() => setAdminTab('importaciones')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${adminTab === 'importaciones' ? 'bg-brand-600/20 text-brand-300' : 'text-slate-500 hover:bg-ink-800'}`}
            >Importaciones</button>
            <button
              onClick={() => setAdminTab('historicos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${adminTab === 'historicos' ? 'bg-brand-600/20 text-brand-300' : 'text-slate-500 hover:bg-ink-800'}`}
            >Cargos históricos</button>
            <button
              onClick={() => setAdminTab('prueba')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${adminTab === 'prueba' ? 'bg-rose-600/20 text-rose-300' : 'text-slate-500 hover:bg-ink-800'}`}
            >Datos de prueba</button>
          </div>

          {/* Tab: Importaciones */}
          {adminTab === 'importaciones' && (
            <div className="space-y-2">
              {lotes.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No hay importaciones con lote. Los cargos de la importación anterior aparecen en "Cargos históricos".</p>
              ) : (
                <div className="rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                  {lotes.map((l) => (
                    <div key={l.id} className="px-3 py-2.5 flex items-center gap-3 text-xs">
                      <span className="text-slate-500 font-mono w-28 shrink-0">{fechaCorta(l.fecha)} {horaCorta(l.fecha)}</span>
                      <span className="text-slate-400">{l.registros} registros</span>
                      <span className="font-mono text-slate-300">{moneda(Number(l.total_importado))}</span>
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="subtle" onClick={() => { setShowHistorial(true); setShowAdmin(false); verLoteDetalle(l); }}>Ver</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDeleteLote(l)}>
                          <Trash2 size={11} /> Deshacer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Cargos históricos */}
          {adminTab === 'historicos' && (
            <div className="space-y-2">
              {adminLoading ? (
                <p className="text-sm text-slate-500 text-center py-4">Cargando…</p>
              ) : allVentasHistoricas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No hay cargos históricos.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={toggleSeleccionarTodos}
                      className="text-xs text-brand-400 hover:text-brand-300"
                    >
                      {selectedVentas.size === allVentasHistoricas.length ? 'Deseleccionar todo' : `Seleccionar todo (${allVentasHistoricas.length})`}
                    </button>
                    {selectedVentas.size > 0 && (
                      <Button size="sm" variant="danger" onClick={() => setConfirmBulkDelete(true)}>
                        <Trash2 size={12} /> Eliminar seleccionados ({selectedVentas.size})
                      </Button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                    {allVentasHistoricas.map((v) => (
                      <label key={v.id} className="px-3 py-2 flex items-center gap-2 text-xs hover:bg-ink-850/40 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedVentas.has(v.id)}
                          onChange={() => toggleSeleccion(v.id)}
                          className="w-3.5 h-3.5 rounded accent-brand-500"
                        />
                        <span className="font-medium uppercase text-slate-200 w-20 shrink-0 truncate">{v.persona_paga?.apodo ?? '—'}</span>
                        <span className="text-slate-400 flex-1 truncate">{v.cantidad} × {v.producto?.nombre}</span>
                        <span className="font-mono text-slate-500 text-[10px]">@{moneda(Number(v.precio_unitario))}</span>
                        <span className="font-mono text-slate-300">{moneda(Number(v.total))}</span>
                        {!v.lote_id && <Badge className="bg-rose-500/10 text-rose-400/80 border-rose-500/20 text-[8px]">sin lote</Badge>}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600">Total: {allVentasHistoricas.length} cargos · {moneda(allVentasHistoricas.reduce((a, v) => a + Number(v.total), 0))}</p>
                </>
              )}
            </div>
          )}

          {/* Tab: Datos de prueba */}
          {adminTab === 'prueba' && (
            <div className="space-y-3">
              <div className="card-soft p-3 text-sm text-slate-400">
                <p className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Limpiar datos de prueba / importaciones anteriores
                </p>
                <p className="text-xs mb-2">
                  Los cargos actuales sin lote ({allVentasHistoricas.filter((v) => !v.lote_id).length} registros)
                  provienen de la importación incorrecta anterior (productos "(importado)" con precios inventados).
                </p>
                <p className="text-xs text-slate-500 mb-2">Al eliminar:</p>
                <ul className="text-xs text-slate-500 space-y-0.5 mb-3">
                  <li>✓ Se eliminan los cargos/deudas incorrectos</li>
                  <li>✗ NO se eliminan las personas del catálogo</li>
                  <li>✗ NO se eliminan ventas reales (con chip)</li>
                  <li>✗ NO se eliminan abonos</li>
                </ul>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const sinLote = allVentasHistoricas.filter((v) => !v.lote_id);
                    setSelectedVentas(new Set(sinLote.map((v) => v.id)));
                    setConfirmBulkDelete(true);
                  }}
                  disabled={allVentasHistoricas.filter((v) => !v.lote_id).length === 0}
                >
                  <Trash2 size={14} /> Seleccionar todos los cargos sin lote ({allVentasHistoricas.filter((v) => !v.lote_id).length})
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ===== CONFIRM BULK DELETE ===== */}
      <Modal open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} title="Confirmar eliminación" size="sm">
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-amber-400 text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p>Se eliminarán:</p>
              <ul className="text-slate-300 mt-1 ml-3 text-xs space-y-0.5">
                <li>{selectedVentas.size} cargo(s) seleccionado(s)</li>
                <li>Total: {moneda(allVentasHistoricas.filter((v) => selectedVentas.has(v.id)).reduce((a, v) => a + Number(v.total), 0))}</li>
              </ul>
              <p className="mt-2 text-slate-500">NO se eliminarán: personas, ventas reales, chips, abonos.</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="subtle" onClick={() => setConfirmBulkDelete(false)}>Cancelar</Button>
            <Button variant="danger" onClick={eliminarBulkConfirm} disabled={saving}>
              <Trash2 size={16} /> {saving ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===== IMPORT WIZARD ===== */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Importar deudas antiguas" size="lg">
        <ImportWizard
          personas={personas}
          onComplete={handleImportComplete}
          onCancel={() => setShowImport(false)}
        />
      </Modal>

      {/* ===== MANUAL DEBT MODAL ===== */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title="Agregar deuda histórica manual" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Para cuando no tienes el desglose exacto pero sabes el total.</p>
          <PersonAutocomplete
            personas={personas}
            value={manualPersona}
            onChange={setManualPersona}
            label="Persona"
            onPersonaCreada={addPersonaLocal}
          />
          <Input
            label="Total inicial de la deuda"
            type="number"
            value={manualTotal}
            onChange={(e) => setManualTotal(e.target.value)}
            placeholder="0"
            className="font-mono text-lg"
          />
          <Input
            label="Descripción / nota"
            value={manualNota}
            onChange={(e) => setManualNota(e.target.value)}
            placeholder="Ej. Saldo pendiente de bitácora anterior"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="subtle" onClick={() => setShowManual(false)}>Cancelar</Button>
            <Button onClick={guardarManualDeuda} disabled={saving || !manualPersona || !manualTotal}>
              <Plus size={16} /> {saving ? 'Guardando…' : 'Agregar deuda'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===== IMPORT HISTORY MODAL ===== */}
      <Modal open={showHistorial} onClose={() => { setShowHistorial(false); setLoteDetalle(null); }} title="Historial de importaciones" size="lg">
        <div className="space-y-3">
          {lotes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No hay importaciones registradas.</p>
          ) : loteDetalle ? (
            <div className="space-y-3">
              <button onClick={() => setLoteDetalle(null)} className="text-xs text-brand-400 flex items-center gap-1 hover:text-brand-300">
                <ArrowLeft size={14} /> Volver
              </button>
              <div className="card-soft p-3 grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-slate-500 text-xs">Fecha</span><p className="text-slate-200">{fechaCorta(loteDetalle.fecha)} {horaCorta(loteDetalle.fecha)}</p></div>
                <div><span className="text-slate-500 text-xs">Registros</span><p className="text-slate-200">{loteDetalle.registros}</p></div>
                <div><span className="text-slate-500 text-xs">Total</span><p className="font-mono text-slate-200">{moneda(Number(loteDetalle.total_importado))}</p></div>
              </div>
              {loteDetalle.nota && <p className="text-xs text-slate-500">Nota: {loteDetalle.nota}</p>}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                {loteVentas.map((v) => (
                  <div key={v.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                    <span className="flex-1 text-slate-300">{v.persona_paga?.apodo ?? '—'} — {v.cantidad} × {v.producto?.nombre}</span>
                    <span className="font-mono text-slate-300">{moneda(Number(v.total))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="danger" size="sm" onClick={() => setConfirmDeleteLote(loteDetalle)}>
                  <Trash2 size={14} /> Deshacer importación
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
              {lotes.map((l) => (
                <div key={l.id} className="px-3 py-3 flex items-center gap-3 text-sm hover:bg-ink-850/40 transition">
                  <span className="text-xs text-slate-500 font-mono w-32 shrink-0">{fechaCorta(l.fecha)} {horaCorta(l.fecha)}</span>
                  <span className="text-slate-400">{l.registros} registros</span>
                  <span className="font-mono text-slate-300">{moneda(Number(l.total_importado))}</span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="subtle" onClick={() => verLoteDetalle(l)}>Ver</Button>
                    <Button size="sm" variant="danger" onClick={() => setConfirmDeleteLote(l)}>
                      <Trash2 size={12} /> Deshacer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ===== CONFIRM DELETE LOTE ===== */}
      <Modal open={!!confirmDeleteLote} onClose={() => setConfirmDeleteLote(null)} title="¿Deshacer importación?" size="sm">
        {confirmDeleteLote && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-amber-400 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>
                Se eliminarán {confirmDeleteLote.registros} registros con un total de {moneda(Number(confirmDeleteLote.total_importado))}.
                <br />Las personas creadas en esta importación permanecerán.<br />Esta acción no se puede deshacer.
              </span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="subtle" onClick={() => setConfirmDeleteLote(null)}>Cancelar</Button>
              <Button variant="danger" onClick={eliminarLoteConfirm} disabled={saving}>
                <Trash2 size={16} /> {saving ? 'Eliminando…' : 'Sí, deshacer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
