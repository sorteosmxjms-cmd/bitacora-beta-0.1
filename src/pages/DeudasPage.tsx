import { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, TrendingDown, CircleCheck as CheckCircle2, Clock, Check, CloudUpload as UploadCloud, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  getSaldos, getPagosDePersona, getVentasDePersona, registrarPago, calcularEstadoPago,
  importarDeudas, type FilaDeudaImport,
} from '@/lib/db';
import {
  moneda, fechaCorta, horaCorta, companiaLabel, companiaColor,
  estadoPagoLabel, estadoPagoColor,
} from '@/lib/format';
import type { SaldoPersona, Pago, VentaDetalle } from '@/lib/types';

export function DeudasPage() {
  const [saldos, setSaldos] = useState<SaldoPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<SaldoPersona | null>(null);
  const [showAbono, setShowAbono] = useState(false);
  const [abonoCant, setAbonoCant] = useState('');
  const [abonoNota, setAbonoNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ventas, setVentas] = useState<VentaDetalle[]>([]);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ personasCreadas: number; ventasCreadas: number; errores: string[] } | null>(null);

  const cargarSaldos = async () => {
    try {
      const s = await getSaldos();
      setSaldos(s.filter((x) => x.total_vendido > 0));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarSaldos(); }, []);

  useEffect(() => {
    if (!detalle) return;
    (async () => {
      const [pg, vt] = await Promise.all([getPagosDePersona(detalle.persona_id), getVentasDePersona(detalle.persona_id)]);
      setPagos(pg);
      setVentas(vt);
    })();
  }, [detalle]);

  const totalDeuda = useMemo(() => saldos.reduce((a, s) => a + s.saldo, 0), [saldos]);

  const abrirAbono = (s: SaldoPersona) => {
    setDetalle(s);
    setShowAbono(true);
    setAbonoCant('');
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
      await registrarPago(detalle.persona_id, cant, abonoNota);
      const s = await getSaldos();
      setSaldos(s.filter((x) => x.total_vendido > 0));
      const updated = s.find((x) => x.persona_id === detalle.persona_id);
      if (updated) setDetalle(updated);
      const [pg] = await Promise.all([getPagosDePersona(detalle.persona_id)]);
      setPagos(pg);
      setShowAbono(false);
    } catch (e: any) {
      setError(e.message || 'Error al registrar abono.');
    } finally {
      setSaving(false);
    }
  };

  // Parse Excel-like paste: apodo, chips, auxiliares, cargadores, total
  const importPreview = useMemo(() => {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean);
    const filas: FilaDeudaImport[] = [];
    for (const line of lines) {
      // Support tab, comma, semicolon, or multiple spaces
      const parts = line.split(/[\t,;]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const apodo = parts[0];
      const chips = parseInt(parts[1]) || 0;
      const auxiliares = parts.length > 2 ? parseInt(parts[2]) || 0 : 0;
      const cargadores = parts.length > 3 ? parseInt(parts[3]) || 0 : 0;
      const total = parts.length > 4 ? parseFloat(parts[4].replace(/[$,]/g, '')) || 0 : 0;
      filas.push({ apodo, chips, auxiliares, cargadores, total });
    }
    return { total: lines.length, filas };
  }, [importText]);

  const handleImport = async () => {
    if (importPreview.filas.length === 0) return;
    setSaving(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await importarDeudas(importPreview.filas);
      setImportResult(result);
      await cargarSaldos();
      if (result.errores.length === 0) {
        setImportText('');
      }
    } catch (e: any) {
      setError(e.message || 'Error al importar.');
    } finally {
      setSaving(false);
    }
  };

  const saldoPendientes = saldos.filter((s) => s.saldo > 0).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
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
          <Button variant="subtle" onClick={() => { setShowImport(true); setImportText(''); setImportResult(null); setError(null); }}>
            <UploadCloud size={16} /> Importar deudas
          </Button>
          <div className="card-soft px-4 py-2.5">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Saldo total</p>
            <p className="text-xl font-bold text-rose-400 font-mono">{moneda(totalDeuda)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card py-12 text-center text-slate-500">Cargando saldos…</div>
      ) : saldos.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-mint-400/60" />
          <p className="text-slate-400">No hay deudas registradas.</p>
          <p className="text-xs text-slate-600 mt-1">Las ventas a crédito aparecerán aquí. Puedes importar deudas existentes con el botón "Importar deudas".</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-ink-850/60 border-b border-ink-700/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <div className="col-span-4">Persona</div>
            <div className="col-span-2 text-right">Deuda</div>
            <div className="col-span-2 text-right">Abonos</div>
            <div className="col-span-2 text-right">Saldo</div>
            <div className="col-span-2 text-right">Acción</div>
          </div>
          <div className="divide-y divide-ink-700/40">
            {saldos.map((s) => (
              <div
                key={s.persona_id}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-ink-850/40 transition cursor-pointer"
                onClick={() => setDetalle(s)}
              >
                <div className="col-span-4 flex items-center gap-2">
                  <span className="font-medium uppercase tracking-wide text-slate-100">{s.apodo}</span>
                  {s.saldo <= 0 && <Badge className="bg-mint-500/15 text-mint-300 border-mint-500/30"><Check size={11} /> Liquidado</Badge>}
                </div>
                <div className="col-span-2 text-right font-mono text-slate-400">{moneda(s.total_vendido)}</div>
                <div className="col-span-2 text-right font-mono text-brand-300">{moneda(s.total_abonado)}</div>
                <div className={`col-span-2 text-right font-mono font-semibold ${s.saldo > 0 ? 'text-rose-400' : 'text-mint-300'}`}>
                  {moneda(s.saldo)}
                </div>
                <div className="col-span-2 text-right">
                  <Button size="sm" variant="subtle" onClick={(e) => { e.stopPropagation(); abrirAbono(s); }}>
                    <Plus size={14} /> Abono
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETALLE MODAL */}
      <Modal
        open={!!detalle && !showAbono}
        onClose={() => setDetalle(null)}
        title={detalle ? `Detalle — ${detalle.apodo}` : ''}
        size="lg"
      >
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="card-soft px-3 py-2.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><TrendingDown size={12} /> Deuda</p>
                <p className="text-lg font-bold font-mono text-slate-200">{moneda(detalle.total_vendido)}</p>
              </div>
              <div className="card-soft px-3 py-2.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><CheckCircle2 size={12} /> Abonos</p>
                <p className="text-lg font-bold font-mono text-brand-300">{moneda(detalle.total_abonado)}</p>
              </div>
              <div className="card-soft px-3 py-2.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><Clock size={12} /> Saldo</p>
                <p className={`text-lg font-bold font-mono ${detalle.saldo > 0 ? 'text-rose-400' : 'text-mint-300'}`}>{moneda(detalle.saldo)}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { setShowAbono(true); setAbonoCant(''); setAbonoNota(''); setError(null); }} disabled={detalle.saldo <= 0}>
                <Plus size={16} /> Registrar abono
              </Button>
            </div>

            {/* Historial de ventas */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Ventas</h4>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                {ventas.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-500 text-center">Sin ventas.</p>
                ) : ventas.map((v) => {
                  const estadoReal = calcularEstadoPago(Number(v.total), detalle.total_abonado);
                  return (
                    <div key={v.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                      <span className="text-xs text-slate-600 font-mono w-24 shrink-0">{fechaCorta(v.fecha)} {horaCorta(v.fecha)}</span>
                      <span className="flex-1 truncate text-slate-300">
                        {v.chip ? (
                          <span className="flex items-center gap-1.5">
                            <Badge className={companiaColor(v.chip.compania)}>{companiaLabel(v.chip.compania)}</Badge>
                            <span className="font-mono">{v.chip.numero}</span>
                            <span className="text-brand-300 font-mono">·{v.chip.ultimos4}</span>
                          </span>
                        ) : (
                          <span>{v.cantidad} × {v.producto?.nombre}</span>
                        )}
                      </span>
                      <span className="font-mono text-slate-300">{moneda(Number(v.total))}</span>
                      <Badge className={estadoPagoColor(estadoReal)}>{estadoPagoLabel(estadoReal)}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historial de pagos */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Abonos</h4>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
                {pagos.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-500 text-center">Sin abonos registrados.</p>
                ) : pagos.map((pg) => (
                  <div key={pg.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                    <span className="text-xs text-slate-600 font-mono w-24 shrink-0">{fechaCorta(pg.fecha)} {horaCorta(pg.fecha)}</span>
                    <span className="flex-1 text-slate-400 truncate">{pg.nota || <span className="text-slate-600">Sin nota</span>}</span>
                    <span className="font-mono text-mint-300">−{moneda(Number(pg.cantidad))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ABONO MODAL */}
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

      {/* IMPORT DEUDAS MODAL */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Importar deudas desde Excel" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Pega tu lista de deudas con el formato: <span className="text-slate-200">Apodo, Chips, Auxiliares, Cargadores, Total</span>.
            <br />Puedes copiar y pegar directamente desde Excel (columnas separadas por tabulador).
            Las personas que no existan se crearán automáticamente.
          </p>
          <div className="card-soft p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-1">Ejemplo:</p>
            <pre className="font-mono text-slate-400">{'WERO\t2\t1\t0\t370\nRECIO\t5\t0\t2\t850\nARG\t3\t0\t0\t330'}</pre>
          </div>
          <textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportResult(null); }}
            placeholder={'WERO\t2\t1\t0\t370\nRECIO\t5\t0\t2\t850'}
            rows={12}
            autoFocus
            spellCheck={false}
            className="input-base font-mono text-sm resize-y"
          />
          {importText.trim() && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">
                <span className="font-semibold text-slate-200">{importPreview.total}</span> líneas
              </span>
              <span className="text-slate-400">
                <span className="font-semibold text-brand-300">{importPreview.filas.length}</span> filas válidas
              </span>
            </div>
          )}
          {importResult && (
            <div className="card-soft p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-mint-300">
                <Check size={15} /> {importResult.personasCreadas} persona{importResult.personasCreadas !== 1 ? 's' : ''} creada{importResult.personasCreadas !== 1 ? 's' : ''} · {importResult.ventasCreadas} venta{importResult.ventasCreadas !== 1 ? 's' : ''} registrada{importResult.ventasCreadas !== 1 ? 's' : ''}
              </div>
              {importResult.errores.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {importResult.errores.length} error{importResult.errores.length !== 1 ? 'es' : ''}: {importResult.errores.slice(0, 5).join(', ')}
                    {importResult.errores.length > 5 && ` … y ${importResult.errores.length - 5} más`}
                  </span>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="subtle" onClick={() => setShowImport(false)}>Cerrar</Button>
            <Button
              onClick={handleImport}
              disabled={saving || importPreview.filas.length === 0}
            >
              <UploadCloud size={16} /> {saving ? 'Procesando…' : 'Importar deudas'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
