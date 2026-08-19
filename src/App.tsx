import { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/store/AppContext';
import { Sidebar, type SectionKey } from '@/components/Sidebar';
import { VentasPage } from '@/pages/VentasPage';
import { DeudasPage } from '@/pages/DeudasPage';
import { PersonasPage } from '@/pages/PersonasPage';
import { ProductosPage } from '@/pages/ProductosPage';
import { HistorialPage } from '@/pages/HistorialPage';
import { getSaldos } from '@/lib/db';

function Shell() {
  const { loading } = useApp();
  const [section, setSection] = useState<SectionKey>('ventas');
  const [deudasPend, setDeudasPend] = useState(0);

  useEffect(() => {
    getSaldos()
      .then((s) => setDeudasPend(s.filter((x) => x.saldo > 0).length))
      .catch(() => {});
  }, [section]);

  if (loading) {
    return (
      <div className="grid place-items-center h-screen bg-ink-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando bitácora…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar current={section} onChange={setSection} deudasPendientes={deudasPend} />
      <main className="flex-1 min-w-0 overflow-y-auto h-screen">
        {section === 'ventas' && <VentasPage />}
        {section === 'deudas' && <DeudasPage />}
        {section === 'personas' && <PersonasPage />}
        {section === 'productos' && <ProductosPage />}
        {section === 'historial' && <HistorialPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
