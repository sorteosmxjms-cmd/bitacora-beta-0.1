import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Calendar, ChevronLeft, ChevronRight, Download, Cpu, Battery,
  Headphones, Smartphone, Users, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getVentasPorFecha, getDiasConVentas } from '@/lib/db';
import { buildResumen, type ResumenPersona } from '@/lib/reporte';
import {
  moneda, fechaLarga, horaCorta, claveDia,
  companiaLabel, companiaColor,
} from '@/lib/format';
import type { VentaDetalle } from '@/lib/types';
import { generatePDF } from '@/lib/pdf';

export function ReportesPage() {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [fechaSel, setFechaSel] = useState(todayKey);
  const [ventas, setVentas] = useState<VentaDetalle[]>([]);
  const [diasConVentas, setDiasConVentas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [personaExpandida, setPersonaExpandida] = useState<string | null>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [v, dias] = await Promise.all([getVentasPorFecha(fechaSel), getDiasConVentas()]);
      setVentas(v);
      setDiasConVentas(dias);
    } finally {
      setLoading(false);
    }
  }, [fechaSel]);

  useEffect(() => { cargar(); }, [cargar]);

  const { porPersona, totales } = useMemo(() => buildResumen(ventas), [ventas]);

  const irAyer = () => {
    const [y, m, d] = fechaSel.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    setFechaSel(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`);
  };

  const irManana = () => {
    const [y, m, d] = fechaSel.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    setFechaSel(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
  };

  const irHoy = () => setFechaSel(todayKey);

  const esHoy = fechaSel === todayKey;
  const tieneVentas = diasConVentas.includes(fechaSel);

  const descargarPDF = async () => {
    setGenerandoPDF(true);
    try {
      await generatePDF(fechaSel, porPersona, totales);
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText size={22} className="text-brand-400" />
            Reportes
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Reporte diario de ventas por persona</p>
        </div>
        <Button onClick={descargarPDF} disabled={loading || ventas.length === 0 || generandoPDF} variant="success">
          <Download size={16} /> {generandoPDF ? 'Generando…' : 'Descargar PDF'}
        </Button>
      </div>

      {/* Date navigator */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between gap-4">
          <Button variant="subtle" size="sm" onClick={irAyer}>
            <ChevronLeft size={16} /> Ayer
          </Button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-brand-400" />
              <span className="text-lg font-semibold text-white capitalize">{fechaLarga(fechaSel)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaSel}
                onChange={(e) => setFechaSel(e.target.value)}
                className="bg-ink-850 border border-ink-700 rounded-lg px-2.5 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
              />
              {!esHoy && (
                <button
                  onClick={irHoy}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                >
                  Ir a hoy
                </button>
              )}
            </div>
          </div>

          <Button variant="subtle" size="sm" onClick={irManana} disabled={esHoy}>
            Mañana <ChevronRight size={16} />
          </Button>
        </div>

        {/* Day chips with sales */}
        {diasConVentas.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ink-700/40">
            <p className="text-xs text-slate-500 mb-1.5">Días con ventas:</p>
            <div className="flex flex-wrap gap-1.5">
              {diasConVentas.slice(0, 30).map((d) => (
                <button
                  key={d}
                  onClick={() => setFechaSel(d)}
                  className={`px-2 py-1 rounded-md text-xs font-mono transition
                    ${d === fechaSel
                      ? 'bg-brand-600 text-white'
                      : 'bg-ink-800 text-slate-400 hover:text-slate-200 hover:bg-ink-700'}`}
                >
                  {d.slice(8)}/{d.slice(5, 7)}
                </button>
              ))}
              {diasConVentas.length > 30 && (
                <span className="px-2 py-1 text-xs text-slate-600">…y {diasConVentas.length - 30} más</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="card py-12 text-center text-slate-500">Cargando reporte…</div>
      ) : ventas.length === 0 ? (
        <div className="card py-16 text-center">
          <Calendar size={36} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">No hay ventas registradas el {fechaLarga(fechaSel)}.</p>
          {!tieneVentas && <p className="text-xs text-slate-600 mt-1">Selecciona otra fecha usando los botones o el calendario.</p>}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {/* Totales summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatCard icon={Cpu} label="Chips" value={String(totales.chips)} color="text-brand-300" />
            <StatCard icon={Battery} label="Cargadores" value={String(totales.cargadores)} color="text-slate-300" />
            <StatCard icon={Headphones} label="Auxiliares" value={String(totales.auriculares)} color="text-slate-300" />
            <StatCard icon={Smartphone} label="Teléfonos" value={String(totales.telefonos)} color="text-slate-300" />
            <StatCard icon={Users} label="Total" value={moneda(totales.total)} color="text-mint-300" />
          </div>

          {/* Per-person breakdown */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-ink-850/60 border-b border-ink-700/40">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Users size={15} className="text-brand-400" />
                Desglose por persona ({porPersona.length})
              </h3>
            </div>
            <div className="divide-y divide-ink-700/40">
              {porPersona.map((p) => (
                <PersonaRow
                  key={p.apodo}
                  persona={p}
                  expandida={personaExpandida === p.apodo}
                  onToggle={() => setPersonaExpandida(personaExpandida === p.apodo ? null : p.apodo)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Cpu; label: string; value: string; color: string }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="grid place-items-center w-9 h-9 rounded-lg bg-ink-800 border border-ink-700">
        <Icon size={16} className={color} />
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function PersonaRow({ persona, expandida, onToggle }: { persona: ResumenPersona; expandida: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-ink-850/40 transition text-left"
      >
        <div className="col-span-3 font-medium uppercase tracking-wide text-slate-100 truncate">{persona.apodo}</div>
        <div className="col-span-1 text-center font-mono text-brand-300">{persona.chips || '—'}</div>
        <div className="col-span-2 text-center font-mono text-slate-400">{persona.cargadores || '—'}</div>
        <div className="col-span-2 text-center font-mono text-slate-400">{persona.auriculares || '—'}</div>
        <div className="col-span-2 text-center font-mono text-slate-400">{persona.telefonos || '—'}</div>
        <div className="col-span-2 text-right font-mono font-semibold text-mint-300">{moneda(persona.total)}</div>
      </button>

      {expandida && (
        <div className="px-4 pb-3 bg-ink-900/40">
          <div className="rounded-lg border border-ink-700/40 divide-y divide-ink-700/30">
            {persona.desglose.map((v) => (
              <div key={v.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                <span className="text-xs text-slate-600 font-mono w-16 shrink-0 flex items-center gap-1">
                  <Clock size={11} /> {horaCorta(v.fecha)}
                </span>
                {v.chip ? (
                  <span className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Badge className={companiaColor(v.chip.compania)}>{companiaLabel(v.chip.compania)}</Badge>
                    <span className="font-mono text-slate-300">{v.chip.numero}</span>
                    <span className="font-mono text-brand-300">·{v.chip.ultimos4}</span>
                  </span>
                ) : (
                  <span className="flex-1 truncate text-slate-300">
                    {v.cantidad} × {v.producto?.nombre}
                  </span>
                )}
                <span className="font-mono text-slate-400 text-xs">
                  {v.persona_usa?.apodo ?? '—'}
                  {v.persona_usa?.apodo !== v.persona_paga?.apodo && ` / ${v.persona_paga?.apodo ?? '—'}`}
                </span>
                <span className="font-mono text-mint-300">{moneda(Number(v.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
