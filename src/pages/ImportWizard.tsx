import { useEffect, useMemo, useState } from 'react';
import { CloudUpload as UploadCloud, ArrowRight, ArrowLeft, Check, CircleAlert as AlertCircle, ClipboardPaste, FileSpreadsheet, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ejecutarImportacion, normalizarApodo, buscarPersonaPorApodo,
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

const TIPOS_COLUMNA: { value: TipoColumna; label: string; precio?: number }[] = [
  { value: 'persona', label: 'Persona / Apodo' },
  { value: 'chip_telcel', label: 'Chip Telcel' },
  { value: 'chip_att', label: 'Chip AT&T' },
  { value: 'chip_unefon', label: 'Chip Unefon' },
  { value: 'chip_precio55', label: 'Chip $55 (histórico)', precio: 55 },
  { value: 'chip_precio110', label: 'Chip $110', precio: 110 },
  { value: 'cargador', label: 'Cargador', precio: 150 },
  { value: 'auricular', label: 'Auricular', precio: 150 },
  { value: 'telefono_basico', label: 'Teléfono básico' },
  { value: 'telefono_android', label: 'Teléfono Android' },
  { value: 'total', label: 'Total' },
  { value: 'otro', label: 'Otro' },
  { value: 'ignorar', label: 'Ignorar columna' },
];

function precioParaTipo(tipo: TipoColumna): number {
  const t = TIPOS_COLUMNA.find((x) => x.value === tipo);
  return t?.precio ?? 0;
}

function labelParaTipo(tipo: TipoColumna): string {
  return TIPOS_COLUMNA.find((x) => x.value === tipo)?.label ?? tipo;
}

export function ImportWizard({ personas, onComplete, onCancel }: ImportWizardProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [rawText, setRawText] = useState('');
  const [columnas, setColumnas] = useState<TipoColumna[]>([]);
  const [editingFilas, setEditingFilas] = useState<FilaImportacion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ personasCreadas: number; ventasCreadas: number; errores: string[] } | null>(null);

  // Step 1: parse raw text into rows/columns
  const rawRows = useMemo(() => {
    if (!rawText.trim()) return [];
    return rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  }, [rawText]);

  const rawMatrix = useMemo(() => {
    return rawRows.map((row) => row.split(/\t|,|;/).map((c) => c.trim()));
  }, [rawRows]);

  const numCols = useMemo(() => {
    return rawMatrix.reduce((max, row) => Math.max(max, row.length), 0);
  }, [rawMatrix]);

  // Auto-detect column types
  useEffect(() => {
    if (rawMatrix.length === 0 || numCols === 0) {
      setColumnas([]);
      return;
    }
    const detected: TipoColumna[] = [];
    for (let c = 0; c < numCols; c++) {
      const header = (rawMatrix[0]?.[c] ?? '').toLowerCase().trim();
      const sampleVals = rawMatrix.slice(1, 5).map((r) => (r[c] ?? '').toLowerCase().trim());

      if (c === 0 || header.includes('apodo') || header.includes('persona') || header.includes('nombre')) {
        detected[c] = 'persona';
      } else if (header.includes('total') || header.includes('deuda') || header.includes('saldo')) {
        detected[c] = 'total';
      } else if (header.includes('telcel')) {
        detected[c] = 'chip_telcel';
      } else if (header.includes('att') || header.includes('at&t')) {
        detected[c] = 'chip_att';
      } else if (header.includes('unefon')) {
        detected[c] = 'chip_unefon';
      } else if (header.includes('carg')) {
        detected[c] = 'cargador';
      } else if (header.includes('aur') || header.includes('aux')) {
        detected[c] = 'auricular';
      } else if (header.includes('tel') && header.includes('bas')) {
        detected[c] = 'telefono_basico';
      } else if (header.includes('tel') && header.includes('and')) {
        detected[c] = 'telefono_android';
      } else if (header.includes('55')) {
        detected[c] = 'chip_precio55';
      } else if (header.includes('110')) {
        detected[c] = 'chip_precio110';
      } else {
        // Try to guess from sample values
        const allNumeric = sampleVals.every((v) => v === '' || /^\d+(\.\d+)?$/.test(v.replace(/[$,]/g, '')));
        if (allNumeric && c === numCols - 1) {
          detected[c] = 'total';
        } else if (allNumeric) {
          detected[c] = 'otro';
        } else {
          detected[c] = c === 0 ? 'persona' : 'ignorar';
        }
      }
    }
    setColumnas(detected);
  }, [rawMatrix, numCols]);

  // Step 2→3: build FilaImportacion from mapped columns
  const filasPreview = useMemo(() => {
    if (columnas.length === 0 || rawMatrix.length === 0) return [];

    // Find which column is persona and which is total
    const personaCol = columnas.findIndex((c) => c === 'persona');
    const totalCol = columnas.findIndex((c) => c === 'total');

    // Skip header row if first cell looks like a header
    const startRow = (personaCol >= 0 && rawMatrix[0]?.[personaCol]?.toLowerCase().match(/apodo|persona|nombre/)) ? 1 : 0;

    const filas: FilaImportacion[] = [];

    for (let r = startRow; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      const apodo = personaCol >= 0 ? (row[personaCol] ?? '').trim() : '';

      let tieneAdvertencia = false;
      let notaAdvertencia = '';

      if (!apodo) {
        tieneAdvertencia = true;
        notaAdvertencia = 'Sin apodo';
      }

      // Build items from non-persona, non-total, non-ignorar columns
      const items: { tipo: TipoColumna; cantidad: number; precioUnitario: number }[] = [];
      let totalFromRow = 0;

      for (let c = 0; c < columnas.length; c++) {
        const tipo = columnas[c];
        if (c === personaCol || tipo === 'ignorar') continue;

        const valStr = (row[c] ?? '').trim();
        if (!valStr) continue;

        if (tipo === 'total') {
          totalFromRow = parseFloat(valStr.replace(/[$,]/g, '')) || 0;
          continue;
        }

        const cantidad = parseInt(valStr.replace(/[$,]/g, '')) || 0;
        if (cantidad > 0) {
          items.push({
            tipo,
            cantidad,
            precioUnitario: precioParaTipo(tipo),
          });
        }
      }

      // Check if persona exists
      const personaExistente = apodo ? buscarPersonaPorApodo(apodo, personas) : null;
      const esNueva = apodo ? !personaExistente : false;

      // If no items but has total, that's fine — will be a manual debt
      // If items exist, compute total from items if no total column
      if (items.length === 0 && totalFromRow === 0) {
        tieneAdvertencia = true;
        notaAdvertencia = 'Sin cantidad ni total';
      }

      // If items exist but total doesn't match items sum, flag it
      if (items.length > 0 && totalCol >= 0 && totalFromRow > 0) {
        const itemsTotal = items.reduce((a, i) => a + i.cantidad * i.precioUnitario, 0);
        if (Math.abs(itemsTotal - totalFromRow) > 1) {
          tieneAdvertencia = true;
          notaAdvertencia = `Total no coincide: items=${moneda(itemsTotal)} vs total=${moneda(totalFromRow)}`;
        }
      }

      // If no total column, compute from items
      if (totalFromRow === 0 && items.length > 0) {
        totalFromRow = items.reduce((a, i) => a + i.cantidad * i.precioUnitario, 0);
      }

      filas.push({
        apodo: apodo.toUpperCase(),
        items,
        total: totalFromRow,
        personaExistente,
        esNueva,
        tieneAdvertencia,
        notaAdvertencia,
      });
    }

    return filas;
  }, [columnas, rawMatrix, personas]);

  // Validation stats for step 3
  const stats = useMemo(() => {
    const registros = filasPreview.length;
    const reconocidas = filasPreview.filter((f) => f.personaExistente).length;
    const nuevas = filasPreview.filter((f) => f.esNueva).length;
    const conAdvertencias = filasPreview.filter((f) => f.tieneAdvertencia).length;
    const totalMonetario = filasPreview.reduce((a, f) => a + f.total, 0);
    return { registros, reconocidas, nuevas, conAdvertencias, totalMonetario };
  }, [filasPreview]);

  const hasPersonaCol = columnas.some((c) => c === 'persona');
  const hasTotalCol = columnas.some((c) => c === 'total');

  const canGoStep2 = rawMatrix.length > 0 && hasPersonaCol;
  const canGoStep3 = hasPersonaCol;
  const canConfirm = filasPreview.length > 0 && filasPreview.some((f) => f.apodo && f.total > 0);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const validFilas = filasPreview.filter((f) => f.apodo && (f.total > 0 || f.items.length > 0));
      const res = await ejecutarImportacion(validFilas, personas);
      setResult({ personasCreadas: res.personasCreadas, ventasCreadas: res.ventasCreadas, errores: res.errores });
      setPaso(4);
    } catch (e: any) {
      setError(e.message || 'Error al importar.');
    } finally {
      setSaving(false);
    }
  };

  const updateFila = (idx: number, patch: Partial<FilaImportacion>) => {
    setEditingFilas((prev) => {
      const next = [...filasPreview];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // Use editingFilas if they've been modified, otherwise use filasPreview
  const filas = editingFilas.length > 0 ? editingFilas : filasPreview;

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
            Selecciona un rango en tu Excel, cópialo con <kbd className="px-1 rounded bg-ink-800 border border-ink-700 text-[10px] font-mono">CTRL+C</kbd> y pégalo abajo.
            <br />El sistema detectará automáticamente las columnas.
          </p>

          <div className="card-soft p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-1">Ejemplo de formato:</p>
            <pre className="font-mono text-slate-400 overflow-x-auto">{'PINKY\t2\t3\t1\t0\t0\t920\nCHUY\t5\t0\t0\t2\t0\t850'}</pre>
            <p className="mt-1 text-[10px]">Apodo, Chips Telcel, Chips AT&T, Cargadores, Auriculares, Teléfonos, Total</p>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => { setRawText(e.target.value); setEditingFilas([]); }}
            placeholder="Pega aquí tu tabla de Excel…"
            rows={10}
            autoFocus
            spellCheck={false}
            className="input-base font-mono text-sm resize-y"
          />

          {rawRows.length > 0 && (
            <p className="text-xs text-slate-400">
              {rawRows.length} filas detectadas · {numCols} columnas
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
            Indica qué significa cada columna. El sistema auto-detectó las columnas — ajusta si es necesario.
          </p>

          {/* Preview first few rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-700/40">
                  {columnas.map((_, c) => (
                    <th key={c} className="px-2 py-1.5 text-left">
                      <select
                        value={columnas[c]}
                        onChange={(e) => {
                          const next = [...columnas];
                          next[c] = e.target.value as TipoColumna;
                          setColumnas(next);
                          setEditingFilas([]);
                        }}
                        className="input-base text-xs py-1 px-1.5 min-w-[100px]"
                      >
                        {TIPOS_COLUMNA.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawMatrix.slice(0, 5).map((row, r) => (
                  <tr key={r} className="border-b border-ink-700/20">
                    {columnas.map((_, c) => (
                      <td key={c} className="px-2 py-1.5 text-slate-400 font-mono max-w-[120px] truncate">
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
              <AlertTriangle size={14} /> Debes marcar al menos una columna como "Persona / Apodo".
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="subtle" onClick={() => setPaso(1)}><ArrowLeft size={16} /> Atrás</Button>
            <Button onClick={() => setPaso(3)} disabled={!canGoStep3}>
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ===== PASO 3: REVISAR Y VALIDAR ===== */}
      {paso === 3 && (
        <div className="space-y-4">
          {/* Validation summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="card-soft p-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Registros detectados</p>
              <p className="text-lg font-bold text-slate-200">{stats.registros}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Personas reconocidas</p>
              <p className="text-lg font-bold text-brand-300">{stats.reconocidas}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Personas nuevas</p>
              <p className="text-lg font-bold text-mint-300">{stats.nuevas}</p>
            </div>
            <div className="card-soft p-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Con advertencias</p>
              <p className={`text-lg font-bold ${stats.conAdvertencias > 0 ? 'text-amber-400' : 'text-slate-200'}`}>{stats.conAdvertencias}</p>
            </div>
            <div className="card-soft p-2.5 col-span-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total monetario a importar</p>
              <p className="text-xl font-bold font-mono text-mint-300">{moneda(stats.totalMonetario)}</p>
            </div>
          </div>

          {stats.conAdvertencias > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-400 card-soft p-2.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {stats.conAdvertencias} fila(s) con advertencias marcadas como "REVISAR".
                Puedes continuar — las filas problemáticas se omitirán o se crearán sin desglose.
              </span>
            </div>
          )}

          {/* Preview table */}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-ink-700/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-ink-850">
                <tr className="text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-2 py-2 font-medium">Persona</th>
                  <th className="text-left px-2 py-2 font-medium">Items</th>
                  <th className="text-right px-2 py-2 font-medium">Total</th>
                  <th className="text-center px-2 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/30">
                {filas.map((f, i) => (
                  <tr key={i} className={f.tieneAdvertencia ? 'bg-amber-500/5' : ''}>
                    <td className="px-2 py-2">
                      <span className="font-medium uppercase text-slate-200">{f.apodo || '—'}</span>
                      {f.esNueva && <Badge className="ml-1 bg-mint-500/15 text-mint-300 border-mint-500/30 text-[9px]">NUEVA</Badge>}
                    </td>
                    <td className="px-2 py-2 text-slate-400">
                      {f.items.length > 0
                        ? f.items.map((it, j) => (
                          <span key={j} className="text-[10px] mr-1">
                            {it.cantidad}× {labelParaTipo(it.tipo)}
                          </span>
                        ))
                        : <span className="text-slate-600">Sin desglose</span>
                      }
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300">{moneda(f.total)}</td>
                    <td className="px-2 py-2 text-center">
                      {f.tieneAdvertencia
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
                Puedes deshacer esta importación desde el botón "Historial" en Deudas.
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
