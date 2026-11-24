// ============================================================
// utils/supabaseAdmin.ts
// Cliente de Supabase con la clave de servicio (service_role), SOLO
// para usar en el servidor (Server Actions / Route Handlers). Esta
// clave se salta Row Level Security, así que nunca debe importarse
// desde un componente cliente ni llevar el prefijo NEXT_PUBLIC_.
// Se crea al llamarlo (no al cargar el módulo) para que, si falta la
// variable de entorno, el error sea claro y no rompa el resto de la app.
// ============================================================
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}