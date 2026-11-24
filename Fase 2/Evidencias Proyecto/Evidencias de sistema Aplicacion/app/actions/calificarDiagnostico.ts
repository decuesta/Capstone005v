// ============================================================
// app/actions/calificarDiagnostico.ts
// RF-14: guarda si a la persona le sirvió su diagnóstico ("útil" o
// "no útil") y un comentario opcional, en calificaciones_utilidad.
//
// Opción A (bajo riesgo, sin cambios en la base): escribe desde el
// servidor con la clave de servicio, igual que se guarda el diagnóstico.
// La tabla tiene RLS activado y ninguna política, así que el navegador
// no puede leerla ni escribirla directamente.
//
// Una calificación por diagnóstico: si ya existe, se actualiza (la
// persona puede cambiar de opinión; si no escribe un comentario nuevo,
// se conserva el anterior). Lo controla este servidor porque
// la tabla no tiene una restricción de unicidad.
// EVOLUCIÓN PREVISTA (opción B): pasar esta lógica a una función de la
// base (security definer) con una restricción unique(diagnostico_id),
// como registrar_evento_uso, cuando se compruebe su factibilidad.
//
// Una Server Action es un endpoint público: todo lo que llega se valida.
// ============================================================
"use server";

import { getSupabaseAdmin } from "@/utils/supabaseAdmin";

export type Calificacion = "util" | "no_util";

// Debe coincidir con el límite del cuadro de texto en CalificarUtilidad.tsx.
// (Un archivo "use server" solo puede exportar funciones async.)
const LARGO_MAXIMO_COMENTARIO = 500;

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function calificarDiagnostico(
  diagnosticoId: unknown,
  calificacion: unknown,
  comentario: unknown
): Promise<{ ok: boolean }> {
  // 1. Validación de lo que llega desde el navegador.
  if (typeof diagnosticoId !== "string" || !FORMATO_UUID.test(diagnosticoId)) return { ok: false };
  if (calificacion !== "util" && calificacion !== "no_util") return { ok: false };
  if (comentario !== null && comentario !== undefined && typeof comentario !== "string") return { ok: false };

  const textoComentario =
    typeof comentario === "string" ? comentario.trim().slice(0, LARGO_MAXIMO_COMENTARIO) : "";
  const comentarioFinal = textoComentario.length > 0 ? textoComentario : null;

  try {
    const supabase = getSupabaseAdmin();

    // 2. El diagnóstico tiene que existir.
    const { data: diagnostico, error: errorDiagnostico } = await supabase
      .from("diagnosticos")
      .select("id")
      .eq("id", diagnosticoId)
      .maybeSingle();
    if (errorDiagnostico || !diagnostico) return { ok: false };

    // 3. Si ya hay una calificación para este diagnóstico, se actualiza;
    //    si no, se crea.
    const { data: existente, error: errorBusqueda } = await supabase
      .from("calificaciones_utilidad")
      .select("id")
      .eq("diagnostico_id", diagnosticoId)
      .limit(1)
      .maybeSingle();
    if (errorBusqueda) {
      console.error("No se pudo buscar la calificación:", errorBusqueda.message);
      return { ok: false };
    }

    const { error } = existente
      ? await supabase
          .from("calificaciones_utilidad")
          // Si al cambiar de opinión no escribe un comentario nuevo, se
          // conserva el anterior.
          .update(comentarioFinal ? { calificacion, comentario: comentarioFinal } : { calificacion })
          .eq("id", existente.id)
      : await supabase
          .from("calificaciones_utilidad")
          .insert({ diagnostico_id: diagnosticoId, calificacion, comentario: comentarioFinal });

    if (error) {
      console.error("No se pudo guardar la calificación:", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("No se pudo guardar la calificación:", e);
    return { ok: false };
  }
}
