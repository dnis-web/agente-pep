/**
 * supabase.js — Cliente de conexión a la base de datos (Supabase).
 *
 * Los datos de conexión se leen de .env.local (no se sube a GitHub):
 *   VITE_SUPABASE_URL=https://<proyecto>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon public key>
 *
 * Si no existen, la app funciona en modo local (localStorage), igual que antes.
 * Nunca usar aquí la clave service_role.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && clave);

export const supabase = supabaseConfigurado ? createClient(url, clave) : null;
