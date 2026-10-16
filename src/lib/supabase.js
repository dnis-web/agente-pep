/**
 * supabase.js — Cliente de conexión a la base de datos (Supabase).
 *
 * Los datos de conexión se leen de .env.local (no se sube a GitHub):
 *   VITE_SUPABASE_URL=https://<proyecto>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<publishable key: sb_publishable_...>
 *
 * Si no existen, la app funciona en modo local (localStorage), igual que antes.
 * Nunca usar aquí la clave secreta (sb_secret_... / service_role).
 */
import { createClient } from '@supabase/supabase-js';

/** Quita comillas y espacios, agrega https:// si falta y elimina rutas como /rest/v1/. */
function limpiarUrl(valor) {
  let u = (valor || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  // El dominio no puede tener espacios y debe tener al menos un punto (abc.supabase.co)
  if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i.test(u)) return '';
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
}

function limpiarClave(valor) {
  return (valor || '').trim().replace(/^["']|["']$/g, '').trim();
}

const urlOriginal = import.meta.env.VITE_SUPABASE_URL;
const url = limpiarUrl(urlOriginal);
const clave = limpiarClave(import.meta.env.VITE_SUPABASE_ANON_KEY);

let cliente = null;
let error = '';

if (urlOriginal || clave) {
  if (!url) {
    error = `VITE_SUPABASE_URL no es una dirección válida ("${urlOriginal || ''}"). Debe verse así: https://abcdefgh.supabase.co`;
  } else if (!clave) {
    error = 'Falta VITE_SUPABASE_ANON_KEY en .env.local (la publishable key, sb_publishable_...).';
  } else if (/^sb_secret_/.test(clave) || /service_role/.test(clave)) {
    error = 'En .env.local se puso la clave SECRETA. Usa la publishable key (sb_publishable_...) y cambia la clave secreta en Supabase, porque quedó expuesta.';
  } else {
    try {
      cliente = createClient(url, clave);
    } catch (e) {
      error = `No se pudo crear la conexión con Supabase: ${e.message}`;
    }
  }
}

export const supabaseConfigurado = Boolean(cliente);
export const supabase = cliente;
export const errorConfiguracion = error;
