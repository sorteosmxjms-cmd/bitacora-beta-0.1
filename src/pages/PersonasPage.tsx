import { useMemo, useState } from 'react';
import { Users, Plus, Search, Pencil, Power, Check, X, CloudUpload as UploadCloud, CircleAlert as AlertCircle, Trash2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { crearPersona, actualizarPersona, eliminarPersona, crearPersonasBatch } from '@/lib/db';
import { fechaCorta } from '@/lib/format';
import type { Persona } from '@/lib/types';

export function PersonasPage() {
  const { personas, refreshPersonas } = useApp();
  const [query, setQuery] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [editando, setEditando] = useState<Persona | null>(null);
  const [nuevoApodo, setNuevoApodo] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ creadas: number; duplicadas: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Persona | null>(null);

  const importPreview = useMemo(() => {
    const lines = importText.split(/[\n,;]+/).map((l) => l.trim().toUpperCase()).filter(Boolean);
    const unicos = [...new Set(lines)];
    return { total: lines.length, unicos: unicos.length, names: unicos };
  }, [importText]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personas.filter((p) => {
      if (filtroActivo === 'activos' && !p.activo) return false;
      if (filtroActivo === 'inactivos' && p.activo) return false;
      if (q && !p.apodo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [personas, query, filtroActivo]);

  const activos = personas.filter((p) => p.activo).length;
  const inactivos = personas.length - activos;

  const handleCreate = async () => {
    const apodo = nuevoApodo.trim().toUpperCase();
    if (!apodo) return;
    setSaving(true);
    setError(null);
    try {
      await crearPersona(apodo);
      await refreshPersonas();
      setShowNew(false);
      setNuevoApodo('');
    } catch (e: any) {
      setError(e.message || 'No se pudo crear la persona.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editando) return;
    const apodo = nuevoApodo.trim().toUpperCase();
    if (!apodo) return;
    setSaving(true);
    setError(null);
    try {
      await actualizarPersona(editando.id, { apodo });
      await refreshPersonas();
      setEditando(null);
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (p: Persona) => {
    try {
      await actualizarPersona(p.id, { activo: !p.activo });
      await refreshPersonas();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const confirmarEliminar = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    setError(null);
    try {
      await eliminarPersona(confirmDelete.id);
      await refreshPersonas();
      setConfirmDelete(null);
    } catch (e: any) {
      setError(e.message || 'No se pudo eliminar. Puede tener ventas o pagos asociados.');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (importPreview.unicos === 0) return;
    setSaving(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await crearPersonasBatch(importPreview.names);
      setImportResult(result);
      await refreshPersonas();
      if (result.creadas > 0 && result.duplicadas.length === 0) {
        setImportText('');
      }
    } catch (e: any) {
      setError(e.message || 'Error al importar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users size={22} className="text-brand-400" />
            Personas
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {activos} activas · {inactivos} inactivas · {personas.length} en total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => { setShowImport(true); setImportText(''); setImportResult(null); setError(null); }}>
            <UploadCloud size={16} /> Importar
          </Button>
          <Button onClick={() => { setShowNew(true); setNuevoApodo(''); setError(null); }}>
            <Plus size={16} /> Nueva persona
          </Button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por apodo…"
            className="input-base pl-9 uppercase tracking-wide"
          />
        </div>
        <div className="flex gap-1 p-1 bg-ink-900/60 border border-ink-700/50 rounded-lg">
          {(['todos', 'activos', 'inactivos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroActivo(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition
                ${filtroActivo === f ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-500">
            <Users size={32} className="mx-auto mb-2 opacity-40" />
            {query ? 'No se encontraron personas.' : 'Aún no hay personas. Crea la primera.'}
          </div>
        ) : (
          <div className="divide-y divide-ink-700/40">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-850/40 transition">
                <div className={`w-2 h-2 rounded-full ${p.activo ? 'bg-mint-400' : 'bg-slate-600'}`} />
                <span className="flex-1 font-medium tracking-wide uppercase text-slate-100">{p.apodo}</span>
                <Badge className={p.activo ? 'bg-mint-500/15 text-mint-300 border-mint-500/30' : 'bg-ink-700 text-slate-400 border-ink-600'}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </Badge>
                <span className="text-xs text-slate-600 font-mono hidden sm:block">{fechaCorta(p.creado_en)}</span>
                <button
                  onClick={() => { setEditando(p); setNuevoApodo(p.apodo); setError(null); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-ink-800 transition"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => toggleActivo(p)}
                  className={`p-1.5 rounded-lg transition
                    ${p.activo ? 'text-slate-500 hover:text-amber-400 hover:bg-ink-800' : 'text-slate-500 hover:text-mint-300 hover:bg-ink-800'}`}
                >
                  <Power size={15} />
                </button>
                <button
                  onClick={() => { setConfirmDelete(p); setError(null); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-ink-800 transition"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New person modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva persona" size="sm">
        <div className="space-y-3">
          <Input
            label="Apodo"
            value={nuevoApodo}
            onChange={(e) => setNuevoApodo(e.target.value)}
            placeholder="Ej. WERO CHERRY"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="uppercase tracking-wide"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="subtle" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !nuevoApodo.trim()}>
              <Check size={16} /> {saving ? 'Guardando…' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar persona" size="sm">
        <div className="space-y-3">
          <Input
            label="Apodo"
            value={nuevoApodo}
            onChange={(e) => setNuevoApodo(e.target.value)}
            autoFocus
            className="uppercase tracking-wide"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="subtle" onClick={() => setEditando(null)}><X size={16} /> Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !nuevoApodo.trim()}>
              <Check size={16} /> {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="¿Eliminar persona?" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Se eliminará a <span className="font-semibold text-slate-200 uppercase">{confirmDelete?.apodo}</span> permanentemente.
            <br />Si tiene ventas o pagos asociados, esos registros se conservarán pero quedarán sin persona asignada.
          </p>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarEliminar} disabled={saving}>
              <Trash2 size={16} /> {saving ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Importación masiva" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Pega una lista de apodos, uno por renglón. Se ignoran duplicados y nombres vacíos.
          </p>
          <textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportResult(null); }}
            placeholder={'WERO CHERRY\nWERO SCAR\nWERCO SHET\nWERCO DARIO\nRECIO\nARG\nCHUY\nAARON'}
            rows={12}
            autoFocus
            spellCheck={false}
            className="input-base font-mono text-sm uppercase tracking-wide resize-y"
          />
          {importText.trim() && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">
                <span className="font-semibold text-slate-200">{importPreview.total}</span> líneas
              </span>
              <span className="text-slate-400">
                <span className="font-semibold text-brand-300">{importPreview.unicos}</span> nombres únicos
              </span>
            </div>
          )}
          {importResult && (
            <div className="card-soft p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-mint-300">
                <Check size={15} /> {importResult.creadas} persona{importResult.creadas !== 1 ? 's' : ''} creada{importResult.creadas !== 1 ? 's' : ''}
              </div>
              {importResult.duplicadas.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {importResult.duplicadas.length} ya existían: {importResult.duplicadas.slice(0, 8).join(', ')}
                    {importResult.duplicadas.length > 8 && ` … y ${importResult.duplicadas.length - 8} más`}
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
              disabled={saving || importPreview.unicos === 0}
            >
              <UploadCloud size={16} /> {saving ? 'Procesando…' : 'Procesar importación'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
