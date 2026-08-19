import { useEffect, useMemo, useState } from 'react';
import { History, Search, Calendar, Cpu, ChevronRight, ChevronLeft, X, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { getVentasDetalle, buscarChips, setEstadoChip } from '@/lib/db';
import {
  moneda, fechaCorta, horaCorta, fechaLarga, claveDia,
  companiaLabel, companiaColor, estadoChipLabel, estadoChipColor,
  estadoPagoLabel, estadoPagoColor,
} from '@/lib/format';
import type { VentaDetalle, Compania, EstadoChip } from '@/lib/types';

type Vista = 'reciente' | 'buscar';

export function HistorialPage() {
  const [vista, setVista] = useState<Vista>('reciente');
  const [todas, setTodas] = useState<VentaDetalle[]>([]);
  const [loading, setLoading] = useState(true);

  // search fields
  const [sNumero, setSNumero] = useState('');
  const [sUlt4, setSUlt4] = useState('');
  const [sCompania, setSCompania] = useState<Compania | ''>('');
  const [sPersonaUsa, setSPersonaUsa] = useState('');
  const [sPersonaPaga, setSPersonaPaga] = useState('');
  const [sEstado, setSEstado] = useState<EstadoChip | ''>('');
  const [resultados, setResultados] = useState<VentaDetalle[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);

  const cargar = async () => {
    try {
      const v = await getVentasDetalle();
      setTodas(v);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const porDia = useMemo(() => {
    const grupos = new Map<string, VentaDetalle[]>();
    for (const v of todas) {
      const k = claveDia(v.fecha);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(v);
    }
    return Array.from(grupos.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [todas]);

  const hacerBusqueda = async () => {
    setBuscando(true);
    try {
      const r = await buscarChips({
        numero: sNumero.trim() || undefined,
        ultimos4: sUlt4.trim() || undefined,
        compania: sCompania || undefined,
        personaUsa: sPersonaUsa.trim() || undefined,
        personaPaga: sPersonaPaga.trim() || undefined,
        estado: sEstado || undefined,
      });
      setResultados(r);
    } finally {
      setBuscando(false);
    }
  };

  const limpiarBusqueda = () => {
    setSNumero(''); setSUlt4(''); setSCompania(''); setSPersonaUsa(''); setSPersonaPaga(''); setSEstado('');
    setResultados([]);
  };

  const darBaja = async (v: VentaDetalle, nuevo: EstadoChip) => {
    if (!v.chip) return;
    const chipId = v.chip.id;
    try {
      await setEstadoChip(chipId, nuevo);
      const actualizadas = todas.map((x) =>
        x.chip?.id === chipId ? { ...x, chip: { ...x.chip!, estado_chip: nuevo } } : x,
      );
      setTodas(actualizadas);
      setDetalle({ ...v, chip: { ...v.chip, estado_chip: nuevo } });
      if (resultados.length) {
        setResultados(resultados.map((x) =>
          x.chip?.id === chipId ? { ...x, chip: { ...x.chip!, estado_chip: nuevo } } : x,
        ));
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const chipsCount = (dia: VentaDetalle[]) => dia.filter((v) => v.chip).length;
  const totalDia = (dia: VentaDetalle[]) => dia.reduce((a, v) => a + Number(v.total), 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <History size={22} className="text-brand-400" />
            Historial
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Ventas por día y búsqueda de chips</p>
        </div>
        <div className="flex gap-1 p-1 bg-ink-900/60 border border-ink-700/50 rounded-lg">
          <button
            onClick={() => setVista('reciente')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5
              ${vista === 'reciente' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Calendar size={14} /> Por día
          </button>
          <button
            onClick={() => setVista('buscar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5
              ${vista === 'buscar' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Search size={14} /> Buscar chip
          </button>
        </div>
      </div>

      {/* VISTA POR DÍA */}
      {vista === 'reciente' && (
        <div className="space-y-4 animate-fade-in">
          {loading ? (
            <div className="card py-12 text-center text-slate-500">Cargando historial…</div>
          ) : porDia.length === 0 ? (
            <div className="card py-16 text-center">
              <Calendar size={36} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">Aún no hay ventas registradas.</p>
            </div>
          ) : (
            porDia.map(([dia, ventas]) => (
              <div key={dia} className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-ink-850/60 border-b border-ink-700/40">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-200">{fechaLarga(dia)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-brand-300">{chipsCount(ventas)} chips</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{ventas.length} ventas</span>
                    <span className="text-slate-500">·</span>
                    <span className="font-mono text-mint-300">{moneda(totalDia(ventas))}</span>
                  </div>
                </div>
                <div className="divide-y divide-ink-700/30">
                  {ventas.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setDetalle(v)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-850/40 transition text-left"
                    >
                      <span className="text-xs text-slate-600 font-mono w-16 shrink-0">{horaCorta(v.fecha)}</span>
                      {v.chip ? (
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge className={companiaColor(v.chip.compania)}>{companiaLabel(v.chip.compania)}</Badge>
                          <span className="font-mono text-slate-300">{v.chip.numero}</span>
                          <span className="font-mono text-brand-300">·{v.chip.ultimos4}</span>
                          <Badge className={estadoChipColor(v.chip.estado_chip)}>{estadoChipLabel(v.chip.estado_chip)}</Badge>
                        </span>
                      ) : (
                        <span className="flex-1 truncate text-slate-300">{v.cantidad} × {v.producto?.nombre}</span>
                      )}
                      <span className="text-xs text-slate-500 hidden sm:block">
                        {v.persona_usa?.apodo}{v.persona_paga && v.persona_paga.id !== v.persona_usa?.id ? ` / ${v.persona_paga.apodo}` : ''}
                      </span>
                      <span className="font-mono text-slate-300 w-20 text-right">{moneda(Number(v.total))}</span>
                      <ChevronRight size={14} className="text-slate-600" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VISTA BUSCAR */}
      {vista === 'buscar' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card p-4">
            <div className="grid grid-cols-3 gap-3">
              <Input label="Número" value={sNumero} onChange={(e) => setSNumero(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="5537130051" className="font-mono" />
              <Input label="Últimos 4" value={sUlt4} onChange={(e) => setSUlt4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="5263" className="font-mono" />
              <div>
                <label className="label-base">Compañía</label>
                <select value={sCompania} onChange={(e) => setSCompania(e.target.value as Compania | '')} className="input-base">
                  <option value="">Todas</option>
                  <option value="telcel">Telcel</option>
                  <option value="att">AT&T</option>
                  <option value="unefon">Unefon</option>
                </select>
              </div>
              <Input label="Quién lo usa" value={sPersonaUsa} onChange={(e) => setSPersonaUsa(e.target.value)} placeholder="RECIO" className="uppercase" />
              <Input label="Quién lo paga" value={sPersonaPaga} onChange={(e) => setSPersonaPaga(e.target.value)} placeholder="ARG" className="uppercase" />
              <div>
                <label className="label-base">Estado del chip</label>
                <select value={sEstado} onChange={(e) => setSEstado(e.target.value as EstadoChip | '')} className="input-base">
                  <option value="">Todos</option>
                  <option value="en_uso">En uso</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="subtle" onClick={limpiarBusqueda}><X size={14} /> Limpiar</Button>
              <Button onClick={hacerBusqueda} disabled={buscando}>
                <Search size={16} /> {buscando ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>
          </div>

          {resultados.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-ink-850/60 border-b border-ink-700/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
              </div>
              <div className="divide-y divide-ink-700/30">
                {resultados.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setDetalle(v)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-850/40 transition text-left"
                  >
                    <Badge className={companiaColor(v.chip!.compania)}>{companiaLabel(v.chip!.compania)}</Badge>
                    <span className="font-mono text-slate-300">{v.chip!.numero}</span>
                    <span className="font-mono text-brand-300">·{v.chip!.ultimos4}</span>
                    <Badge className={estadoChipColor(v.chip!.estado_chip)}>{estadoChipLabel(v.chip!.estado_chip)}</Badge>
                    <span className="flex-1" />
                    <span className="text-xs text-slate-500">{v.persona_usa?.apodo}</span>
                    <span className="text-xs text-slate-600">{fechaCorta(v.fecha)}</span>
                    <ChevronRight size={14} className="text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultados.length === 0 && !buscando && (sNumero || sUlt4 || sCompania || sPersonaUsa || sPersonaPaga || sEstado) && (
            <div className="card py-10 text-center text-slate-500">
              <Search size={28} className="mx-auto mb-2 opacity-40" />
              Presiona "Buscar" para ver resultados.
            </div>
          )}
        </div>
      )}

      {/* DETALLE MODAL */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title={detalle?.chip ? `Chip ·${detalle.chip.ultimos4}` : 'Detalle de venta'}
        size="md"
      >
        {detalle && (
          <div className="space-y-4">
            {detalle.chip && (
              <div className="card-soft p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-brand-400" />
                  <span className="font-mono text-lg tracking-wider text-slate-100">{detalle.chip.numero}</span>
                  <Badge className={companiaColor(detalle.chip.compania)}>{companiaLabel(detalle.chip.compania)}</Badge>
                  <Badge className={estadoChipColor(detalle.chip.estado_chip)}>{estadoChipLabel(detalle.chip.estado_chip)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Field label="Últimos 4" value={detalle.chip.ultimos4} mono />
                  <Field label="Precio" value={moneda(Number(detalle.precio_unitario))} mono />
                  <Field label="Quién lo usa" value={detalle.persona_usa?.apodo ?? '—'} />
                  <Field label="Quién lo paga" value={detalle.persona_paga?.apodo ?? '—'} />
                  <Field label="Fecha" value={fechaCorta(detalle.fecha)} />
                  <Field label="Hora" value={horaCorta(detalle.fecha)} />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-ink-700/40">
                  <Badge className={estadoPagoColor(detalle.estado_pago)}>{estadoPagoLabel(detalle.estado_pago)}</Badge>
                  {detalle.chip.estado_chip === 'en_uso' ? (
                    <Button size="sm" variant="danger" onClick={() => darBaja(detalle, 'baja')}>
                      <ArrowDownToLine size={14} /> Dar de baja
                    </Button>
                  ) : (
                    <Button size="sm" variant="subtle" onClick={() => darBaja(detalle, 'en_uso')}>
                      <ArrowDownToLine size={14} /> Reactivar
                    </Button>
                  )}
                </div>
              </div>
            )}
            {!detalle.chip && (
              <div className="card-soft p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Field label="Producto" value={detalle.producto?.nombre ?? '—'} />
                  <Field label="Cantidad" value={String(detalle.cantidad)} mono />
                  <Field label="Precio c/u" value={moneda(Number(detalle.precio_unitario))} mono />
                  <Field label="Total" value={moneda(Number(detalle.total))} mono />
                  <Field label="Quién lo usa" value={detalle.persona_usa?.apodo ?? '—'} />
                  <Field label="Quién lo paga" value={detalle.persona_paga?.apodo ?? '—'} />
                  <Field label="Fecha" value={fechaCorta(detalle.fecha)} />
                  <Field label="Hora" value={horaCorta(detalle.fecha)} />
                </div>
                <div className="pt-2 border-t border-ink-700/40">
                  <Badge className={estadoPagoColor(detalle.estado_pago)}>{estadoPagoLabel(detalle.estado_pago)}</Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
