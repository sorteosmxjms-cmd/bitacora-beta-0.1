import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Persona, Producto } from '@/lib/types';
import { getPersonas, getProductos } from '@/lib/db';

interface AppState {
  personas: Persona[];
  productos: Producto[];
  loading: boolean;
  refreshPersonas: () => Promise<void>;
  refreshProductos: () => Promise<void>;
  addPersonaLocal: (p: Persona) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPersonas = useCallback(async () => {
    const data = await getPersonas();
    setPersonas(data);
  }, []);

  const refreshProductos = useCallback(async () => {
    const data = await getProductos();
    setProductos(data);
  }, []);

  const addPersonaLocal = useCallback((p: Persona) => {
    setPersonas((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p].sort((a, b) => a.apodo.localeCompare(b.apodo));
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [p, prod] = await Promise.all([getPersonas(), getProductos()]);
        setPersonas(p);
        setProductos(prod);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Ctx.Provider value={{ personas, productos, loading, refreshPersonas, refreshProductos, addPersonaLocal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
