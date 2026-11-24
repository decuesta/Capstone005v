// ============================================================
// app/components/CalificarUtilidad.tsx
// RF-14: "¿Te sirvió este diagnóstico?". La persona elige "Sí" o "No",
// puede dejar un comentario opcional y envía. Se guarda una calificación
// por diagnóstico (si vuelve a enviar, se actualiza), desde el servidor
// (app/actions/calificarDiagnostico.ts).
// Después de enviar se muestra un agradecimiento; se recuerda mientras
// la pestaña siga abierta (sessionStorage) para no volver a preguntar al
// ir al plan paso a paso y volver.
// Si el envío falla, se avisa y se puede reintentar; nada más de la
// pantalla se ve afectado.
// ============================================================
"use client";

import { useState } from "react";
import { calificarDiagnostico, type Calificacion } from "@/app/actions/calificarDiagnostico";

// Debe coincidir con el límite del servidor (calificarDiagnostico.ts).
const LARGO_MAXIMO_COMENTARIO = 500;

function yaCalificado(clave: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

export default function CalificarUtilidad({ diagnosticoId }: { diagnosticoId: string }) {
  const clave = `ematch_calificado_${diagnosticoId}`;
  const [enviado, setEnviado] = useState<boolean>(() => yaCalificado(clave));
  const [seleccion, setSeleccion] = useState<Calificacion | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);

  async function enviar() {
    if (!seleccion) return;
    setEnviando(true);
    setError(false);
    const { ok } = await calificarDiagnostico(diagnosticoId, seleccion, comentario);
    setEnviando(false);
    if (!ok) {
      setError(true);
      return;
    }
    setEnviado(true);
    try {
      sessionStorage.setItem(clave, "1");
    } catch {
      // Sin sessionStorage: el agradecimiento dura mientras la pantalla esté abierta.
    }
  }

  if (enviado) {
    return (
      <div className="rounded-lg border p-4 bg-green-50">
        <p className="text-sm text-green-800 font-semibold">¡Gracias! Tu opinión nos ayuda a mejorar E-Match.</p>
        <button
          onClick={() => setEnviado(false)}
          className="mt-1 text-xs text-slate-500 hover:text-slate-800"
        >
          Cambiar mi respuesta
        </button>
      </div>
    );
  }

  const claseOpcion = (valor: Calificacion) =>
    `px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
      seleccion === valor
        ? "bg-blue-600 border-blue-600 text-white"
        : "border-slate-300 text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold">¿Te sirvió este diagnóstico?</h3>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSeleccion("util")} className={claseOpcion("util")} aria-pressed={seleccion === "util"}>
          👍 Sí, me sirvió
        </button>
        <button onClick={() => setSeleccion("no_util")} className={claseOpcion("no_util")} aria-pressed={seleccion === "no_util"}>
          👎 No me sirvió
        </button>
      </div>

      {seleccion && (
        <>
          <label className="block text-sm">
            <span className="text-slate-700">Comentario (opcional)</span>
            <textarea
              value={comentario}
              maxLength={LARGO_MAXIMO_COMENTARIO}
              rows={3}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="¿Qué te sirvió o qué le faltó? No incluyas datos personales."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
            />
          </label>
          <button
            onClick={enviar}
            disabled={enviando}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600">No pudimos guardar tu respuesta. Intenta de nuevo en un momento.</p>
      )}
    </div>
  );
}
