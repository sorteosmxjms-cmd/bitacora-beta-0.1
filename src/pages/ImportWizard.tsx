import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowLeft, Check, CircleAlert as AlertCircle,
  ClipboardPaste, FileSpreadsheet, TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ejecutarImportacion, normalizarApodo, buscarPersonaPorApodo, esApodoInvalido,
  precioParaTipo, shortLabelParaTipo,
  LABELS_COLUMNA,
  type TipoColumna, type FilaImportacion,
} from '@/lib/db';
import { moneda } from '@/lib/format';
import type { Persona } from '@/lib/types';

interface ImportWizardProps {
  personas: Persona[];
  onComplete: () => void;
  onCancel: () => void;
}

type Paso = 1 | 2 | 3 | 4;

/** Normalize a header string for matching: lowercase, remove spaces, remove special chars */
function normHeader(s: string): string {
  return s.toLowerCase().replace(/[\s._-]/g, '').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
}

function detectarTipo(header: string): TipoColumna {
  const h = normHeader(header);
  if (h === 'nombreoapodo' || h === 'apodo' || h === 'persona' || h === 'nombre') return 'persona';
  if (h.includes('deudatotal') || h.includes('total') || h.includes('deuda')) return 'total';
  if (h.includes('att') || h.includes('unefon') || h.includes('at&t')) return 'chip_att_unefon';
  if (h.includes('chip55') || h.includes('chip$55')) return 'chip_55';
  if (h.includes('chip110') || h.includes('chip$110')) return 'chip_110';
  if (h.includes('tipoc') || h.includes('cargtipoc') || h.includes('cargctipo')) return 'cargador_tipo_c';
  if (h.includes('cargador150') || (h.includes('cargador') && h.includes('150'))) return 'cargador_150';
  if (h.includes('cargador120') || (h.includes('cargador') && h.includes('120'))) return 'cargador_120';
  if (h.includes('cargador') || h.includes('carg')) return 'cargador_120';
  if (h.includes('aux150') || (h.includes('aux') && h.includes('150'))) return 'aux_150';
  if (h.includes('aux120') || (h.includes('aux') && h.includes('120'))) return 'aux_120';
  if (h.includes('aux') || h.includes('auricular')) return 'aux_120';
  if (h.includes('pilas') || h.includes('pila')) return 'pilas';
  if (h.includes('chip') && h.includes('110')) return 'chip_110';
  if (h.includes('chip') && h.includes('55')) return 'chip_55';
  if (h.includes('chip')) return 'chip_110';
  return 'ignorar';
}

export function ImportWizard({ personas, onComplete, onCancel }: ImportWizardProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [rawText, setRawText] = useState('');
  const [columnas, setColumnas] = useState<TipoColumna[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ personasCreadas: number; ventasCreadas: number; errores: string[] } | null>(null);

  // Step 1: parse raw text into rows/columns (TAB-separated)
  const rawRows = useMemo(() => {
    if (!rawText.trim()) return [];
    return rawText.split('\n').map((l) => l.replace(/\r/g, '')).filter((l) => l.trim());
  }, [rawText]);

  const rawMatrix = useMemo(() => {
    return rawRows.map((row) => row.split('\t').map((c) => c.trim()));
  }, [rawRows]);

  const numCols = useMemo(() => {
    return rawMatrix.reduce((max, row) => Math.max(max, row.length), 0);
  }, [rawMatrix]);

  // Detect if the first row is a header
  const hasHeader = useMemo(() => {
    if (rawMatrix.length === 0) return false;
    const firstRow = rawMatrix[0];
    // Check if any cell in first row matches known header names
    return firstRow.some((cell) => {
      const h = normHeader(cell);
      return h.includes('nombre') || h.includes('apodo') || h.includes('persona') ||
             h.includes('chip') || h.includes('cargador') || h.includes('aux') ||
             h.includes('deuda') || h.includes('pilas');
    });
  }, [rawMatrix]);

  // Auto-detect column types
  useEffect(() => {
    if (rawMatrix.length === 0 || numCols === 0) {
      setColumnas([]);
      return;
    }
    const headerRow = hasHeader ? rawMatrix[0] : [];
    const detected: TipoColumna[] = [];
    for (let c = 0; c < numCols; c++) {
      const header = headerRow[c] ?? '';
      if (header) {
        detected[c] = detectarTipo(header);
      } else {
        // No header — guess from position: col 0 = persona, last col = total
        if (c === 0) detected[c] = 'persona';
        else if (c === numCols - 1) detected[c] = 'total';
        else detected[c] = 'ignorar';
      }
    }
    setColumnas(detected);
  }, [rawMatrix, numCols, hasHeader]);

  // Build FilaImportacion from mapped columns
  const filasPreview = useMemo(() => {
    if (columnas.length === 0 || rawMatrix.length === 0) return [];

    const personaCol = columnas.findIndex((c) => c === 'persona');
    const totalCol = columnas.findIndex((c) => c === 'total');
    if (personaCol < 0) return [];

    // Skip header row if present
    const startRow = hasHeader ? 1 : 0;

    const filas: FilaImportacion[] = [];

    for (let r = startRow; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      const apodoRaw = (row[personaCol] ?? '').trim();
      const apodo = apodoRaw.toUpperCase();

      // Skip empty rows and non-person rows (totals, headers, numbers-only)
      if (!apodo || esApodoInvalido(apodo)) continue;

      // Build items from product columns
      const items: { tipo: TipoColumna; cantidad: number; precioUnitario: number }[] = [];
      let totalExcel = 0;

      for (let c = 0; c < columnas.length; c++) {
        const tipo = columnas[c];
        if (c === personaCol || tipo === 'ignorar' || tipo === 'total') {
          if (tipo === 'total') {
            const valStr = (row[c] ?? '').trim();
            totalExcel = parseFloat(valStr.replace(/[$,]/g, '')) || 0;
          }
          continue;
        }

        const valStr = (row[c] ?? '').trim();
        if (!valStr) continue;

        const cantidad = parseInt(valStr.replace(/[$,]/g, '')) || 0;
        if (cantidad > 0) {
          items.push({
            tipo,
            cantidad,
            precioUnitario: precioParaTipo(tipo),
          });
        }
      }

      const totalCalculado = items.reduce((a, i) => a + i.cantidad * i.precioUnitario, 0);

      // Check if persona exists
      const personaExistente = buscarPersonaPorApodo(apodo, personas);
      const esNueva = !personaExistente;

      // Validation
      let tieneAdvertencia = false;
      let notaAdvertencia = '';

      if (items.length === 0 && totalExcel === 0) {
        // Completely empty row — skip it
        continue;
      }

      if (items.length === 0 && totalExcel > 0) {
        tieneAdvertencia = true;
        notaAdvertencia = 'Sin desglose de productos — se usará el total del Excel';
      }

      // Compare calculated vs Excel total
      const diferencia = totalExcel > 0 ? totalCalculado - totalExcel : 0;

      if (totalExcel > 0 && Math.abs(diferencia) > 1) {
        tieneAdvertencia = true;
        notaAdvertencia = `Diferencia: calculado ${moneda(totalCalculado)} vs Excel ${moneda(totalExcel)} = ${moneda(Math.abs(diferencia))}`;
      }

      // Suspicious small amounts ($1, $2, $3)
      const montoSospechoso = totalCalculado > 0 && totalCalculado <= 5;
      if (montoSospechoso) {
        tieneAdvertencia = true;
        notaAdvertencia = `MONTO SOSPECHOSO: ${moneda(totalCalculado)} — verificar antes de importar`;
      }

      filas.push({
        apodo,
        items,
        totalCalculado,
        totalExcel,
        diferencia,
        personaExistente,
        esNueva,
        tieneAdvertencia,
        notaAdvertencia,
        montoSospechoso,
      });
    }

    return filas;
  }, [columnas, rawMatrix, hasHeader, personas]);

  // Validation stats for step 3
  const stats = useMemo(() => {
    const registros = filasPreview.length;
    const reconocidas = filasPreview.filter((f) => f.personaExistente).length;
    const nuevas = filasPreview.filter((f) => f.esNueva).length;
    const conAdvertencias = filasPreview.filter((f) => f.tieneAdvertencia).length;
    const correctos = filasPreview.filter((f) => !f.tieneAdvertencia).length;
    const totalCalculado = filasPreview.reduce((a, f) => a + f.totalCalculado, 0);
    const totalExcel = filasPreview.reduce((a, f) => a + f.totalExcel, 0);
    return {
      registros, reconocidas, nuevas, conAdvertencias, correctos,
      totalCalculado, totalExcel,
      diferencia: totalCalculado - totalExcel,
    };
  }, [filasPreview]);

  const hasPersonaCol = columnas.some((c) => c === 'persona');
  const canGoStep2 = rawMatrix.length > 0;
  const canConfirm = filasPreview.length > 0 && filasPreview.some((f) => f.apodo && f.totalCalculado > 0);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      // Only import rows that have a valid apodo and some total
      const validFilas = filasPreview.filter((f) => f.apodo && (f.totalCalculado > 0 || f.items.length > 0));
      const res = await ejecutarImportacion(validFilas, personas);
      setResult({ personasCreadas: res.personasCreadas, ventasCreadas: res.ventasCreadas, errores: res.errores });
      setPaso(4);
    } catch (e: any) {
      setError(e.message || 'Error al importar.');
    } finally {
      setSaving(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center gap-1 mb-4">
      {([1, 2, 3, 4] as Paso[]).map((p, i) => (
        <div key={p} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition
            ${paso === p ? 'bg-brand-600 text-white' : paso > p ? 'bg-mint-600/20 text-mint-300' : 'bg-ink-800 text-slate-500'}`}>
            {paso > p ? <Check size={12} /> : <span className="w-4 text-center">{p}</span>}
            <span className="hidden sm:inline">
              {p === 1 && 'Pegar datos'}
              {p === 2 && 'Mapear columnas'}
              {p === 3 && 'Revisar'}
              {p === 4 && 'Confirmar'}
            </span>
          </div>
          {i < 3 && <ArrowRight size={12} className="text-slate-600" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      {stepIndicator}

      {/* ===== PASO 1: PEGAR DATOS ===== */}
      {paso === 1 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 card-soft p-3 text-center">
              <ClipboardPaste size={20} className="mx-auto mb-1 text-brand-400" />
              <p className="text-xs text-slate-300 font-medium">Pegar desde Excel</p>
              <p className="text-[10px] text-slate-500">CTRL+C en Excel, CTRL+V aquí</p>
            </div>
            <div className="flex-1 card-soft p-3 text-center opacity-50">
              <FileSpreadsheet size={20} className="mx-auto mb-1 text-slate-500" />
              <p className="text-xs text-slate-400 font-medium">Subir archivo .xlsx</p>
              <p className="text-[10px] text-slate-600">Próximamente</p>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            En tu Excel, selecciona desde <span className="text-slate-200">NOMBRE O APODO</span> hasta <span className="text-slate-200">DEUDA TOTAL</span>,
            cópialo con <kbd className="px-1 rounded bg-ink-800 border border-ink-700 text-[10px] font-mono">CTRL+C</kbd> y pégalo abajo.
            <br />Puedes pegar solo algunas filas para probar primero.
          </p>

          <div className="card-soft p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-1">Tu formato de Excel:</p>
            <pre className="font-mono text-slate-400 overflow-x-auto">{'NOMBRE O APODO\tCHIP 110\tCHIP 55\tCHIP AT&T/UNEFON\tAUX 120\tAUX 150\tCARGADOR 120\tCARGADOR 150\tCARG. C\tPILAS\tDEUDA TOTAL'}</pre>
            <p className="mt-1 text-[10px]">Cada celda contiene una CANTIDAD. El sistema usa el precio fijo de cada columna.</p>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Pega aquí tu tabla de Excel…"
            rows={10}
            autoFocus
            spellCheck={false}
            className="input-base font-mono text-sm resize-y"
          />

          {rawRows.length > 0 && (
            <p className="text-xs text-slate-400">
              {rawRows.length} filas detectadas · {numCols} columnas {hasHeader && '(con encabezado)'}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="subtle" onClick={onCancel}>Cancelar</Button>
            <Button onClick={() => setPaso(2)} disabled={!canGoStep2}>
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ===== PASO 2: MAPEAR COLUMNAS ===== */}
      {paso === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Confirma qué significa cada columna. Cada tipo tiene un precio fijo que se usará para calcular el total.
          </p>

          {/* Show fixed prices reference */}
          <div className="card-soft p-3 grid grid-cols-3 gap-1.5 text-[10px] text-slate-500">
            <span>Chip $110 → <span className="text-slate-300 font-mono">$110</span></span>
            <span>Chip $55 → <span className="text-slate-300 font-mono">$55</span></span>
            <span>AT&T/Unefon → <span className="text-slate-300 font-mono">$110</span></span>
            <span>Aux $120 → <span className="text-slate-300 font-mono">$120</span></span>
            <span>Aux $150 → <span className="text-slate-300 font-mono">$150</span></span>
            <span>Cargador $120 → <span className="text-slate-300 font-mono">$120</span></span>
            <span>Cargador $150 → <span className="text-slate-300 font-mono">$150</span></span>
            <span>Carg Tipo C → <span className="text-slate-300 font-mono">$150</span></span>
            <span>Pilas → <span className="text-slate-300 font-mono">$300</span></span>
          </div>

          {/* Column mapping with preview */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-700/40">
                  {columnas.map((_, c) => (
                    <th key={c} className="px-1 py-1.5 text-left">
                      <select
                        value={columnas[c]}
                        onChange={(e) => {
                          const next = [...columnas];
                          next[c] = e.target.value as TipoColumna;
                          setColumnas(next);
                        }}
                        className="input-base text-[10px] py-1 px-1 min-w-[90px] max-w-[120px]"
                      >
                        {LABELS_COLUMNA.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawMatrix.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 5).map((row, r) => (
                  <tr key={r} className="border-b border-ink-700/20">
                    {columnas.map((_, c) => (
                      <td key={c} className="px-1 py-1.5 text-slate-400 font-mono max-w-[120px] truncate text-[10px]">
                        {row[c] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasPersonaCol && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle size={14} /> Debes marcar al menos una columna como "Nombre / Apodo".
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="subtle" onClick={() => setPaso(1)}><ArrowLeft size={16} /> Atrás</Button>
            <Button onClick={() => setPaso(3)} disabled={!hasPersonaCol}>
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ===== PASO 3: REVISAR Y VALIDAR ===== */}
      {paso === 3 && (
        <div className="space-y-4">
          {/* Validation summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Personas detectadas</p>
              <p className="text-base font-bold text-slate-200">{stats.registros}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Existente</p>
              <p className="text-base font-bold text-brand-300">{stats.reconocidas}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Nuevas</p>
              <p className="text-base font-bold text-mint-300">{stats.nuevas}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Correctos</p>
              <p className="text-base font-bold text-mint-300">{stats.correctos}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Para revisar</p>
              <p className={`text-base font-bold ${stats.conAdvertencias > 0 ? 'text-amber-400' : 'text-slate-200'}`}>{stats.conAdvertencias}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Total calculado</p>
              <p className="text-base font-bold font-mono text-mint-300">{moneda(stats.totalCalculado)}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Total Excel</p>
              <p className="text-base font-bold font-mono text-slate-300">{moneda(stats.totalExcel)}</p>
            </div>
            <div className="card-soft p-2.5 col-span-1">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Diferencia</p>
              <p className={`text-base font-bold font-mono ${Math.abs(stats.diferencia) > 1 ? 'text-amber-400' : 'text-mint-300'}`}>
                {moneda(Math.abs(stats.diferencia))}
              </p>
            </div>
          </div>

          {stats.conAdvertencias > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-400 card-soft p-2.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {stats.conAdvertencias} fila(s) marcadas como "REVISAR". Puedes continuar — los registros correctos se importarán.
                Las filas con diferencias se importarán con el total calculado (no el del Excel).
              </span>
            </div>
          )}

          {/* Per-person preview */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-700/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-ink-850">
                <tr className="text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-2 py-2 font-medium">Persona</th>
                  <th className="text-left px-2 py-2 font-medium">Desglose</th>
                  <th className="text-right px-2 py-2 font-medium">Calc.</th>
                  <th className="text-right px-2 py-2 font-medium">Excel</th>
                  <th className="text-center px-2 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/30">
                {filasPreview.map((f, i) => (
                  <tr key={i} className={f.tieneAdvertencia ? 'bg-amber-500/5' : ''}>
                    <td className="px-2 py-2">
                      <span className="font-medium uppercase text-slate-200">{f.apodo}</span>
                      {f.esNueva && <Badge className="ml-1 bg-mint-500/15 text-mint-300 border-mint-500/30 text-[9px]">NUEVA</Badge>}
                    </td>
                    <td className="px-2 py-2 text-slate-400 max-w-[200px]">
                      {f.items.length > 0
                        ? f.items.map((it, j) => (
                          <span key={j} className="text-[9px] mr-1 inline-block">
                            {it.cantidad}× {shortLabelParaTipo(it.tipo)}
                          </span>
                        ))
                        : <span className="text-slate-600">Sin desglose</span>
                      }
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300">{moneda(f.totalCalculado)}</td>
                    <td className="px-2 py-2 text-right font-mono text-slate-500">{f.totalExcel > 0 ? moneda(f.totalExcel) : '—'}</td>
                    <td className="px-2 py-2 text-center">
                      {f.montoSospechoso
                        ? <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[9px]">SOSPECHOSO</Badge>
                        : f.tieneAdvertencia
                        ? <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px]">REVISAR</Badge>
                        : <Badge className="bg-mint-500/15 text-mint-300 border-mint-500/30 text-[9px]">OK</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="subtle" onClick={() => setPaso(2)}><ArrowLeft size={16} /> Atrás</Button>
            <Button variant="success" onClick={handleConfirm} disabled={saving || !canConfirm}>
              <Check size={16} /> {saving ? 'Importando…' : 'Confirmar importación'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== PASO 4: RESULTADO ===== */}
      {paso === 4 && (
        <div className="space-y-4 text-center py-4">
          {result && result.errores.length === 0 ? (
            <>
              <CheckCircle2 size={40} className="mx-auto text-mint-400" />
              <p className="text-lg font-semibold text-slate-200">Importación completada</p>
              <p className="text-sm text-slate-400">
                {result.personasCreadas} persona{result.personasCreadas !== 1 ? 's' : ''} creada{result.personasCreadas !== 1 ? 's' : ''} ·
                {' '}{result.ventasCreadas} cargo{result.ventasCreadas !== 1 ? 's' : ''} registrado{result.ventasCreadas !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-slate-500">
                Puedes deshacer esta importación desde "Historial" en Deudas.
              </p>
            </>
          ) : result ? (
            <>
              <AlertCircle size={40} className="mx-auto text-amber-400" />
              <p className="text-lg font-semibold text-slate-200">Importación completada con advertencias</p>
              <p className="text-sm text-slate-400">
                {result.personasCreadas} creadas · {result.ventasCreadas} cargos · {result.errores.length} error{result.errores.length !== 1 ? 'es' : ''}
              </p>
              <div className="card-soft p-3 text-xs text-amber-400 text-left max-h-32 overflow-y-auto">
                {result.errores.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </>
          ) : null}

          <Button onClick={onComplete} className="mx-auto">
            <Check size={16} /> Hecho
          </Button>
        </div>
      )}
    </div>
  );
}
