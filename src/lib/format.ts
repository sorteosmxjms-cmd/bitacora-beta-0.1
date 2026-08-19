export const moneda = (n: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n || 0);

export const fechaCorta = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const horaCorta = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const fechaLarga = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

export const claveDia = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const companiaLabel = (c: string): string => {
  const map: Record<string, string> = { telcel: 'Telcel', att: 'AT&T', unefon: 'Unefon' };
  return map[c] ?? c;
};

export const companiaColor = (c: string): string => {
  const map: Record<string, string> = {
    telcel: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
    att: 'bg-mint-500/15 text-mint-300 border-mint-500/30',
    unefon: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };
  return map[c] ?? 'bg-ink-700 text-slate-300 border-ink-600';
};

export const estadoPagoLabel = (e: string): string => {
  const map: Record<string, string> = { pendiente: 'Pendiente', abonado: 'Abonado', liquidado: 'Liquidado' };
  return map[e] ?? e;
};

export const estadoPagoColor = (e: string): string => {
  const map: Record<string, string> = {
    pendiente: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    abonado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    liquidado: 'bg-mint-500/15 text-mint-300 border-mint-500/30',
  };
  return map[e] ?? 'bg-ink-700 text-slate-300 border-ink-600';
};

export const estadoChipLabel = (e: string): string => {
  const map: Record<string, string> = { en_uso: 'En uso', baja: 'Baja' };
  return map[e] ?? e;
};

export const estadoChipColor = (e: string): string => {
  const map: Record<string, string> = {
    en_uso: 'bg-mint-500/15 text-mint-300 border-mint-500/30',
    baja: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
  return map[e] ?? 'bg-ink-700 text-slate-300 border-ink-600';
};
