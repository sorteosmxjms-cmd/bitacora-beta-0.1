import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Faltan las variables de entorno de Supabase.');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
