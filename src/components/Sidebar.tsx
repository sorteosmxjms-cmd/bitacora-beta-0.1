import { useEffect, useState } from 'react';
import { ShoppingCart, Wallet, Users, Package, History, CircuitBoard, type LucideIcon } from 'lucide-react';

export type SectionKey = 'ventas' | 'deudas' | 'personas' | 'productos' | 'historial';

interface NavItem {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { key: 'ventas', label: 'Ventas', icon: ShoppingCart },
  { key: 'deudas', label: 'Deudas', icon: Wallet },
  { key: 'personas', label: 'Personas', icon: Users },
  { key: 'productos', label: 'Productos', icon: Package },
  { key: 'historial', label: 'Historial', icon: History },
];

interface SidebarProps {
  current: SectionKey;
  onChange: (s: SectionKey) => void;
  deudasPendientes: number;
}

export function Sidebar({ current, onChange, deudasPendientes }: SidebarProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-ink-900/60 border-r border-ink-700/50 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-ink-700/50">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300">
            <CircuitBoard size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Bitácora</h1>
            <p className="text-[11px] text-slate-500">Gestión de chips</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = current === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${active
                  ? 'bg-brand-600/15 text-white border border-brand-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-ink-800/60 border border-transparent'}`}
            >
              <Icon size={18} className={active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.key === 'deudas' && deudasPendientes > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {deudasPendientes}
                </span>
              )}
              {item.key === 'ventas' && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-mint-500/20 text-mint-300 border border-mint-500/30">
                  principal
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-ink-700/50 text-[11px] text-slate-500">
        <p className="font-mono">{now.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
        <p className="font-mono text-slate-600">{now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </aside>
  );
}
