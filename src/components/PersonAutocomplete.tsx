import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Search, Plus, User, Check, X } from 'lucide-react';
import type { Persona } from '@/lib/types';
import { crearPersona } from '@/lib/db';

export interface PersonAutocompleteRef {
  focus: () => void;
}

interface PersonAutocompleteProps {
  personas: Persona[];
  value: Persona | null;
  onChange: (p: Persona | null) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  onEnterNext?: () => void;
  /** When true, only active personas are shown (but current value remains valid). */
  onlyActive?: boolean;
  /** Called when a new persona is created inline, so parent can refresh its list. */
  onPersonaCreada?: (p: Persona) => void;
}

export const PersonAutocomplete = forwardRef<PersonAutocompleteRef, PersonAutocompleteProps>(function PersonAutocomplete(
  { personas, value, onChange, placeholder = 'Buscar persona…', label, autoFocus, onEnterNext, onlyActive = true, onPersonaCreada },
  ref,
) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => { inputRef.current?.focus(); inputRef.current?.select(); },
  }));

  useEffect(() => {
    if (value) setQuery(value.apodo);
    else setQuery('');
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const base = onlyActive ? personas.filter((p) => p.activo) : personas;
    const q = query.trim().toLowerCase();
    if (!q) return base.slice(0, 8);
    return base.filter((p) => p.apodo.toLowerCase().includes(q)).slice(0, 12);
  }, [personas, query, onlyActive]);

  const exactExists = useMemo(
    () => personas.some((p) => p.apodo.toLowerCase() === query.trim().toLowerCase()),
    [personas, query],
  );

  const canCreate = query.trim().length > 0 && !exactExists;

  const select = (p: Persona) => {
    onChange(p);
    setOpen(false);
    setError(null);
    onEnterNext?.();
  };

  const handleCreate = async () => {
    const apodo = query.trim().toUpperCase();
    if (!apodo) return;
    setCreating(true);
    setError(null);
    try {
      const p = await crearPersona(apodo);
      onPersonaCreada?.(p);
      select(p);
    } catch (e: any) {
      setError(e.message || 'No se pudo crear la persona.');
    } finally {
      setCreating(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) {
        select(filtered[highlight]);
      } else if (canCreate) {
        handleCreate();
      } else {
        onEnterNext?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && (filtered.length > 0 || canCreate);

  return (
    <div className="relative w-full" ref={wrapRef}>
      {label && <label className="label-base">{label}</label>}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="input-base pl-9 pr-8 uppercase tracking-wide"
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-ink-800"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

      {showList && (
        <div className="absolute z-40 mt-1 w-full card p-1.5 animate-pop max-h-72 overflow-y-auto">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(p)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition
                ${i === highlight ? 'bg-brand-600/20 text-white' : 'text-slate-300 hover:bg-ink-800'}`}
            >
              <User size={14} className="text-slate-500 shrink-0" />
              <span className="truncate uppercase tracking-wide">{p.apodo}</span>
              {!p.activo && <span className="ml-auto text-[10px] text-slate-500">inactivo</span>}
              {value?.id === p.id && <Check size={14} className="ml-auto text-brand-400" />}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseEnter={() => setHighlight(filtered.length)}
              onClick={handleCreate}
              disabled={creating}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm border-t border-ink-700/50 mt-1 pt-2
                ${highlight === filtered.length ? 'bg-mint-600/20 text-mint-300' : 'text-mint-400 hover:bg-ink-800'}`}
            >
              <Plus size={14} className="shrink-0" />
              <span>Crear "<span className="uppercase tracking-wide">{query.trim().toUpperCase()}</span>"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
